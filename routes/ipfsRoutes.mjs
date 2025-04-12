import express from 'express';
import { CID } from 'multiformats/cid';
import CryptoService from '../services/CryptoService.mjs'; // Import CryptoService for decryption

const router = express.Router();

export default function setupIpfsRoutes(fsUnix) {
  router.get('/ipfs/:cid', async (req, res) => {
    try {
      const cid = CID.parse(req.params.cid);
      const chunks = [];

      // Retrieve data from IPFS
      for await (const chunk of fsUnix.cat(cid)) {
        chunks.push(chunk);
      }

      const dataBytes = Buffer.concat(chunks);

      if (!dataBytes || dataBytes.length === 0) {
        throw new Error('Empty content for CID');
      }

      // Decode the data as a string
      const decodedText = new TextDecoder().decode(dataBytes);

      // Log the raw decoded text for debugging
      console.log('Decoded Text:', decodedText);

      // Parse the stringified JSON object
      let parsed;
      try {
        parsed = JSON.parse(decodedText); // First parse the stringified JSON
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed); // Parse again if it's still a string
        }
      } catch (err) {
        throw new Error('Failed to parse JSON from IPFS data');
      }

      // If the data contains encrypted fields, decrypt it
      if (parsed.iv && parsed.encrypted && parsed.key) {
        const decryptedData = CryptoService.decryptData(parsed);
        res.json(decryptedData);
      } else {
        // If no encryption is detected, return the parsed data as-is
        res.json(parsed);
      }
    } catch (err) {
      console.error('IPFS retrieval error:', err);
      res.status(500).json({ error: `IPFS retrieval failed: ${err.message}` });
    }
  });

  return router;
}



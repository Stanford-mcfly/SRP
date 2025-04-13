import express from 'express';
import { CID } from 'multiformats/cid';

const router = express.Router();

export default function setupIpfsRoutes(fsUnix) {
  router.get('/ipfs/:cid', async (req, res) => {
    try {
      const cid = req.params.cid;

      // Validate CID format before proceeding
      if (!cid) {
        return res.status(400).json({ error: 'CID is required' });
      }

      // Retrieve data from IPFS using fsUnix
      const chunks = [];
      for await (const chunk of fsUnix.cat(CID.parse(cid))) {
        chunks.push(chunk);
      }

      const dataBytes = Buffer.concat(chunks);

      if (!dataBytes || dataBytes.length === 0) {
        throw new Error('Empty content for CID');
      }

      const decodedText = new TextDecoder().decode(dataBytes);
      res.json({ data: JSON.parse(JSON.parse(decodedText)) });
    } catch (err) {
      console.error('IPFS retrieval error:', err);
      res.status(500).json({ error: `IPFS retrieval failed: ${err.message}` });
    }
  });

  return router;
}



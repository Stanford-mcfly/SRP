import express from 'express';
import { CID } from 'multiformats/cid';
import CryptoService from '../services/CryptoService.mjs'; // Assuming you have a CryptoService for encryption/decryption
import FuzzyHashService from '../services/FuzzyHashService.mjs'; // For fuzzy hashing

const router = express.Router();

export default function setupRefugeeRoutes(contract, fsUnix) {
  router.get('/refugees', async (req, res) => {
    try {
      const refugeeCount = await contract.methods.refugeeCount().call();
      const refugees = [];

      for (let i = 1; i <= refugeeCount; i++) {
        const refugee = await contract.methods.refugees(i).call();

        // Retrieve data from IPFS using the CID
        const cid = CID.parse(refugee.ipfsCID);
        const chunks = [];

        for await (const chunk of fsUnix.cat(cid)) {
          chunks.push(chunk);
        }

        const dataBytes = Buffer.concat(chunks);

        if (!dataBytes || dataBytes.length === 0) {
          throw new Error(`Empty content for CID: ${refugee.ipfsCID}`);
        }

        const decodedText = new TextDecoder().decode(dataBytes);
        const encryptedData = JSON.parse(JSON.parse(decodedText));

        // Decrypt the data
        const decryptedData = CryptoService.decryptData(encryptedData);
        const fuzzyHash = FuzzyHashService.generateHash(decryptedData.embedding);
        // Add refugee details to the response
        refugees.push({
          id: refugee.id.toString(), // Convert BigInt to string
          BiometricHash: fuzzyHash, // Extract embedding from decrypted data
          name: decryptedData.biometricData.name, // Extract name from decrypted data
          nationality: decryptedData.biometricData.nationality, // Extract nationality from decrypted data
          dateOfBirth: decryptedData.biometricData.dateOfBirth, // Extract date of birth from decrypted data
          biometricSignature: decryptedData.biometricData.biometricSignature, // Extract biometric signature
          isSuspect: refugee.isSuspect // Boolean value from the smart contract
        });
      }

      res.json(refugees);
    } catch (err) {
      console.error('Error fetching refugees:', err);
      res.status(500).json({ error: `Failed to fetch refugees: ${err.message}` });
    }
  });

  return router;
}

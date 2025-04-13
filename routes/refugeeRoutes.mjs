import express from 'express';
import { CID } from 'multiformats/cid';
import CryptoService from '../services/CryptoService.mjs'; // Assuming you have a CryptoService for encryption/decryption
import FuzzyHashService from '../services/FuzzyHashService.mjs'; // For fuzzy hashing
import IpfsService from '../services/IpfsService.mjs';
import FaceRecognitionService from '../services/FaceRecognitionService.mjs';

const router = express.Router();

export default function setupRefugeeRoutes(contract, fsUnix) {
  const ipfsService = new IpfsService(fsUnix);

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

        // Parse the decoded text only once
        const encryptedData = JSON.parse(decodedText);

        // Decrypt the data
        const decryptedData = CryptoService.decryptData(encryptedData);

    
        // Generate a fuzzy hash for the embedding
        const fuzzyHash = await FuzzyHashService.generateHash(decryptedData.embedding);

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

  router.post('/register', async (req, res) => {
    try {
      const { image, biometricData } = req.body;
      if (!image || !biometricData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const embedding = await FaceRecognitionService.detectFace(image);
      if (!embedding) throw new Error('No face detected');

      const fuzzyHash = await CryptoService.generateFuzzyHash(embedding);
      const isDuplicate = await contract.methods.fuzzyHashes(fuzzyHash).call();
      if (isDuplicate) return res.status(409).json({ error: 'Duplicate entry' });

      const encryptedData = CryptoService.encryptData({ biometricData });
      const cid = await ipfsService.storeData(encryptedData);

      const commitment = web3.utils.soliditySha3(fuzzyHash, Date.now());
      const accounts = await web3.eth.getAccounts();
      await contract.methods.register(fuzzyHash, cid, commitment).send({ from: accounts[1], gas: 500000 });

      res.status(201).json({ message: 'Registration successful' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

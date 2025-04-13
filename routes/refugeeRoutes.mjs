import express from 'express';
import path from 'path'; // Import the path module
import { fileURLToPath } from 'url'; // Import fileURLToPath from 'url'
import { CID } from 'multiformats/cid';
import CryptoService from '../services/CryptoService.mjs'; // Assuming you have a CryptoService for encryption/decryption
import FuzzyHashService from '../services/FuzzyHashService.mjs'; // For fuzzy hashing
import IpfsService from '../services/IpfsService.mjs';
import FaceRecognitionService from '../services/FaceRecognitionService.mjs';
import * as json from '@ipld/dag-json'; // Import the JSON encoding/decoding library
import Web3 from 'web3'; // Import Web3
import dotenv from 'dotenv'; // Import dotenv to load environment variables
import QRCode from 'qrcode'; // Ensure QRCode is imported

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Load environment variables

// Initialize Web3 with the provider URL from .env
const web3 = new Web3(process.env.PROVIDER_URL);

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
        const encryptedData = JSON.parse(decodedText);

        // Decrypt the data
        const decryptedData = CryptoService.decryptData(encryptedData);

        // Ensure embedding exists
        if (!decryptedData.embedding) {
          throw new Error('Embedding data is missing');
        }

        // Generate a fuzzy hash for the embedding
        const fuzzyHash = await FuzzyHashService.generateHash(decryptedData.embedding);

        // Add refugee details to the array
        refugees.push({
          id: refugee.id.toString(),
          BiometricHash: fuzzyHash,
          name: decryptedData.biometricData.name,
          nationality: decryptedData.biometricData.nationality,
          dateOfBirth: decryptedData.biometricData.dateOfBirth,
          biometricSignature: decryptedData.biometricData.biometricSignature,
          isSuspect: refugee.isSuspect,
          ipfsCID: refugee.ipfsCID,
          timestamp: parseInt(refugee.timestamp) // Include the timestamp
        });
      }

      // Sort refugees by timestamp in descending order (latest first)
      refugees.sort((a, b) => b.timestamp - a.timestamp);

      res.json(refugees);
    } catch (err) {
      console.error('Error fetching refugees:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/register', async (req, res) => {
    try {
      const { image, biometricData } = req.body;

      // Validate input
      if (!image || !biometricData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Detect face and generate embedding
      const embedding = await FaceRecognitionService.detectFace(image);
      if (!embedding) throw new Error('No face detected');

      // Generate fuzzy hash
      const fuzzyHash = await CryptoService.generateFuzzyHash(embedding);

      // Check for duplicates
      const isDuplicate = await contract.methods.fuzzyHashes(fuzzyHash).call();
      if (isDuplicate) return res.status(409).json({ error: 'Duplicate entry' });

      // Encrypt data and store in IPFS
      const encryptedData = CryptoService.encryptData({ embedding, biometricData });
      const cid = await ipfsService.storeData(encryptedData);

      // Generate commitment
      const commitment = web3.utils.soliditySha3(fuzzyHash, Date.now());

      // Get Web3 accounts
      const accounts = await web3.eth.getAccounts();
      console.log('Web3 accounts:', accounts);
      console.log('Request from:', accounts[0], '| Officer should be:', process.env.OFFICER_ADDRESS);

      // Register refugee in the smart contract
      console.log('Sending transaction with:', { fuzzyHash, cid, commitment });
      await contract.methods.register(fuzzyHash, cid, commitment).send({
        from: accounts[1], // Use the second account
        gas: 500000
      });
      console.log('Transaction successful');

      // Get the refugee ID
      const refugeeId = await contract.methods.refugeeCount().call();

      // Generate QR code for verification
      const qrPath = path.join(__dirname, 'qr', `${refugeeId}.png`);
      await QRCode.toFile(qrPath, JSON.stringify({ id: refugeeId, verificationUrl: `/verify/${refugeeId}` }));

      // Respond with success
      res.status(201).json({ refugeeId, qrUrl: `/qr/${refugeeId}.png` });
    } catch (err) {
      console.error('Error in /register:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/refugees/:id/suspect', async (req, res) => {
    try {
      const refugeeId = req.params.id;
      const officerAddress = req.headers['officer-address'];

      console.log('Refugee ID:', refugeeId);
      console.log('Officer Address:', officerAddress);

      if (!officerAddress) {
        return res.status(400).json({ error: 'Officer address is required' });
      }

      const isOfficer = await contract.methods.officers('0x20b5877AB59fF86cfA7E9fe2FB5078F4f1FbDb55').call();
      console.log('Is Officer:', isOfficer);

      // Fetch refugee details from the smart contract
      const refugee = await contract.methods.refugees(refugeeId).call();
      console.log('Refugee:', refugee);

      if (!refugee.id) {
        return res.status(404).json({ error: 'Refugee not found' });
      }

      // Retrieve the current data from IPFS
      const cid = CID.parse(refugee.ipfsCID);
      console.log('Current IPFS CID:', cid.toString());

      const chunks = [];
      for await (const chunk of fsUnix.cat(cid)) {
        chunks.push(chunk);
      }
      const dataBytes = Buffer.concat(chunks);
      const encryptedData = JSON.parse(new TextDecoder().decode(dataBytes));

      // Decrypt the data
      const decryptedData = CryptoService.decryptData(encryptedData);
      console.log('Decrypted Data:', decryptedData);

      // Update the `isSuspect` field
      decryptedData.isSuspect = true;

      // Encrypt the updated data
      const updatedEncryptedData = CryptoService.encryptData(decryptedData);

      // Store the updated data in IPFS
      const updatedBytes = json.encode(updatedEncryptedData);
      const updatedCid = await fsUnix.addBytes(updatedBytes);
      console.log('Updated IPFS CID:', updatedCid.toString());
      // Update the CID and mark as suspect in the smart contract
      await contract.methods.markSuspect(refugeeId, updatedCid.toString()).send({
        from: officerAddress,
        gas: 500000
      });

      res.status(200).json({ message: 'Refugee marked as suspect successfully', cid: updatedCid.toString() });
    } catch (err) {
      console.error('Error marking refugee as suspect:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

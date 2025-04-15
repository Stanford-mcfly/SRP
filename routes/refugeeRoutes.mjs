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
import multer from 'multer'; // For handling image uploads
import fs from 'fs';
import { spawn,exec } from 'child_process';
import util from 'util';
import * as snarkjs from 'snarkjs'; // Import snarkjs

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // Load environment variables

// Initialize Web3 with the provider URL from .env
const web3 = new Web3(process.env.PROVIDER_URL);

const router = express.Router();
const execPromise = util.promisify(exec); // Helper to execute shell commands

export default function setupRefugeeRoutes(contract, fsUnix) {
  const ipfsService = new IpfsService(fsUnix);

  // Multer setup for image upload
  const upload = multer({ dest: 'uploads/' });

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
      if (!image || !biometricData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
  
      // Detect face embedding
      const embedding = await FaceRecognitionService.detectFace(image);
      if (!embedding) throw new Error('No face detected');
  
      // Generate a fuzzy hash
      const fuzzyHash = await CryptoService.generateFuzzyHash(embedding);
      const formattedFuzzyHash = web3.utils.soliditySha3(fuzzyHash); // Convert to bytes32
  
      // Check for duplicate entries
      const isDuplicate = await contract.methods.fuzzyHashes(formattedFuzzyHash).call();
      if (isDuplicate) return res.status(409).json({ error: 'Duplicate entry' });
  
      // Generate random salt
      const salt = Math.floor(Math.random() * 1e12);
  
      // Encrypt the embedding, biometric data, and salt
      const encryptedData = CryptoService.encryptData({ embedding, biometricData, salt });
  
      // Encode the encrypted data as JSON
      const encodedData = json.encode(encryptedData);
  
      // Add the encoded data to IPFS
      const cid = await fsUnix.addBytes(encodedData);
      console.log('Stored CID:', cid.toString());
  
      // Generate commitment
      const commitment = web3.utils.soliditySha3(formattedFuzzyHash, salt);
  
      // Get accounts and send the transaction
      const accounts = await web3.eth.getAccounts();
      await contract.methods.register(formattedFuzzyHash, cid.toString(), commitment)
        .send({ from: accounts[1], gas: 500000 });
  
      console.log('Transaction successful');
      
      const refugeeId = await contract.methods.refugeeCount().call();
      await QRCode.toFile(
        path.join(__dirname, '../qr', `${refugeeId}.png`),
        JSON.stringify({
          id: refugeeId.toString(),
          verificationUrl: `/verify/${refugeeId}`
        })
      );
  
      res.status(201).json({ refugeeId: refugeeId.toString(), qrUrl: `/qr/${refugeeId}.png` });
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

  // New /verify route
  router.post('/verify/:id', async (req, res) => {
    try {
      const refugeeId = Number(req.params.id);
      const { image } = req.body;

      if (!image || isNaN(refugeeId)) {
        return res.status(400).json({ error: 'Invalid input or refugee ID' });
      }

      // Fetch refugee details from the smart contract
      const refugee = await contract.methods.refugees(refugeeId).call();
      if (!refugee || !refugee.ipfsCID) {
        return res.status(404).json({ error: 'Refugee not found' });
      }

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
      console.log('Decrypted Data:', decryptedData);

      // Ensure embedding exists
      if (!decryptedData.embedding) {
        throw new Error('Embedding data is missing');
      }

      // 1. Detect face embedding from uploaded image
      const freshEmbedding = await FaceRecognitionService.detectFace(image);
      if (!freshEmbedding) throw new Error('Face not detected in the uploaded image');

      // 2. Reduce to 5 dimensions (same as circuit)
      const DIMENSIONS = 5;
      const normalizeToMax1023 = (arr) => {
        const inputMin = Math.min(...arr);
        const inputMax = Math.max(...arr);
        if (inputMin === inputMax) return arr.map(() => 512); // avoid divide-by-zero

        return arr.map(x =>
          Math.floor(((x - inputMin) / (inputMax - inputMin)) * 1023)
        );
      };

      const storedReduced = normalizeToMax1023(decryptedData.embedding.slice(0, DIMENSIONS));
      const freshReduced = normalizeToMax1023(freshEmbedding.slice(0, DIMENSIONS));

      // 3. Build input.json matching circuit structure
      const inputJson = {
        storedCommitment: BigInt(refugee.zkpCommitment).toString(), // ensure it's stringified BigInt
        salt: decryptedData.salt.toString(),
        freshBiometric: freshReduced.map(n => n.toString()) // ensure strings
      };

      console.log('Input JSON for ZKP:', inputJson);

      // 4. Generate proof and public signals using snarkjs.groth16.fullProve
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputJson,
        "./biometric_js/biometric.wasm",
        "./biometric.zkey"
      );

      console.log("Public Signals:", publicSignals);
      console.log("Proof:", proof);

      // Save proof and public signals to files (optional, if needed for debugging or verification)
      fs.writeFileSync("./biometric_js/proof.json", JSON.stringify(proof, null, 2));
      fs.writeFileSync("./biometric_js/public.json", JSON.stringify(publicSignals, null, 2));

      // 5. Verify proof using snarkjs API
      const vKey = JSON.parse(fs.readFileSync("./biometric_js/verification_key.json", "utf-8"));
      const resp = await snarkjs.groth16.verify(vKey, publicSignals, proof);

      console.log("Verification Result:", resp);

      if (!resp) {
        throw new Error('Proof verification failed');
      }

      console.log("Verification OK",resp);

      // 6. Return matched data
      res.json({
        match: true,
        refugeeId: refugee.id.toString(),
        biometricData: decryptedData.biometricData,
        commitment: refugee.zkpCommitment
      });
    } catch (err) {
      console.error('Verification failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

import dotenv from 'dotenv';
import express from 'express';
import { createHeliaHTTP } from '@helia/http';
import { FsBlockstore } from 'blockstore-fs';
import { unixfs } from '@helia/unixfs'; // Import the UnixFS module
import setupIpfsRoutes from './routes/ipfsRoutes.mjs';
import setupRefugeeRoutes from './routes/refugeeRoutes.mjs';
import FaceRecognitionService from './services/FaceRecognitionService.mjs';
import fs from 'fs'; // Import the fs module
import Web3 from 'web3'; // Import Web3 for interacting with the smart contract
import cors from 'cors'; // Import CORS

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors()); // Enable CORS

// Initialize Helia with UnixFS
let fsUnix;
(async () => {
  const blockstore = new FsBlockstore('./blockstore'); // Use a filesystem blockstore
  const helia = await createHeliaHTTP({ blockstore }); // Create a Helia instance
  fsUnix = unixfs(helia); // Initialize UnixFS with the Helia instance

  // Read the contract ABI
  const contractABI = JSON.parse(fs.readFileSync('./build/contracts/RefugeeBiometric.json', 'utf8')).abi;

  // Initialize Web3 and the contract
  const web3 = new Web3(process.env.PROVIDER_URL); // Connect to the Ethereum provider
  const contract = new web3.eth.Contract(contractABI, process.env.CONTRACT_ADDRESS); // Create the contract instance

  // Set up routes
  app.use( setupIpfsRoutes(fsUnix)); // Set up IPFS routes
  app.use( setupRefugeeRoutes(contract, fsUnix)); // Set up Refugee routes

  // Initialize face recognition models
  await FaceRecognitionService.initializeFaceAPI('./models');

  // Start the server
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
})();
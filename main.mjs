import dotenv from 'dotenv';
import express from 'express';
import { createHeliaHTTP } from '@helia/http';
import { unixfs } from '@helia/unixfs';
import { MemoryBlockstore } from 'blockstore-core';
import { FsBlockstore } from 'blockstore-fs';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as json from '@ipld/dag-json';
import crypto from 'crypto';
import Web3 from 'web3';
import QRCode from 'qrcode';
import { createCanvas, loadImage, Canvas, Image, ImageData } from 'canvas';
import * as faceapi from 'face-api.js';
import { buildPoseidon } from 'circomlibjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express with increased payload size
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure Canvas for face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Create required directories
const requiredDirs = [
  path.join(__dirname, 'models', 'ssd_mobilenetv1'),
  path.join(__dirname, 'models', 'face_landmark_68'),
  path.join(__dirname, 'models', 'face_recognition'),
  path.join(__dirname, 'qr')
];

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize Web3
const web3 = new Web3(
  new Web3.providers.HttpProvider(process.env.PROVIDER_URL || 'http://localhost:7545')
);
const contractABI = JSON.parse(fs.readFileSync('./build/contracts/RefugeeBiometric.json', 'utf8')).abi;
const contract = new web3.eth.Contract(contractABI, process.env.CONTRACT_ADDRESS);

// Initialize Helia with UnixFS
let helia, fsUnix;
(async () => {
  const blockstore = new FsBlockstore('./blockstore'); // Use a filesystem blockstore
  helia = await createHeliaHTTP({ blockstore });
  fsUnix = unixfs(helia);
  console.log('Helia instance initialized with UnixFS');
})();

// Face Recognition Setup
async function initializeFaceAPI() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(
      path.join(__dirname, 'models', 'ssd_mobilenetv1')
    );
    await faceapi.nets.faceLandmark68Net.loadFromDisk(
      path.join(__dirname, 'models', 'face_landmark_68')
    );
    await faceapi.nets.faceRecognitionNet.loadFromDisk(
      path.join(__dirname, 'models', 'face_recognition')
    );
    console.log('Face models loaded successfully');
  } catch (err) {
    throw new Error(`Face model loading failed: ${err.message}`);
  }
}

// Face Detection (returns first 5 dimensions)
async function detectFace(imageBase64) {
  try {
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const detection = await faceapi.detectSingleFace(canvas)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection ? Array.from(detection.descriptor).slice(0, 5) : null;
  } catch (err) {
    throw new Error(`Face detection failed: ${err.message}`);
  }
}

// Cryptographic Services
class CryptoService {
  static encryptData(data) {
    try {
      // Recursively convert BigInt to string
      const safeData = JSON.parse(JSON.stringify(data, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
  
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(JSON.stringify(safeData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return JSON.stringify({ iv: iv.toString('hex'), encrypted, key: key.toString('hex') });
    } catch (err) {
      throw new Error(`Encryption failed: ${err.message}`);
    }
  }
  

  static decryptData(encryptedData) {
    try {
      const { iv, encrypted, key } = JSON.parse(encryptedData);
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }

  static async generateFuzzyHash(embedding) {
    try {
      const poseidon = await buildPoseidon();
      const normalized = embedding.map(x => Math.round(x * 1000));
      const hash = poseidon(normalized);
      const hashBigInt = BigInt(poseidon.F.toString(hash));
      const hexString = hashBigInt.toString(16).padStart(64, '0');
      const buffer = Buffer.from(hexString, 'hex');
      return web3.utils.bytesToHex(buffer);
    } catch (err) {
      throw new Error(`Hash generation failed: ${err.message}`);
    }
  }
}

// IPFS Services
class IpfsService {
  static async storeData(data) {
    try {
      const bytes = json.encode(data); // Encode data as JSON
      const cid = await fsUnix.addBytes(bytes); // Add bytes to UnixFS
      return cid.toString();
    } catch (err) {
      throw new Error(`IPFS storage failed: ${err.message}`);
    }
  }

  static async retrieveData(cidStr) {
    try {
      const cid = CID.parse(cidStr); // Parse the CID
      const bytes = await fsUnix.cat(cid); // Retrieve the block
      return json.decode(bytes); // Decode the JSON data
    } catch (err) {
      throw new Error(`IPFS retrieval failed: ${err.message}`);
    }
  }
}

// Routes
app.post('/register', async (req, res) => {
  try {
    const { image, biometricData } = req.body;
    if (!image || !biometricData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const embedding = await detectFace(image);
    if (!embedding) throw new Error('No face detected');

    const fuzzyHash = await CryptoService.generateFuzzyHash(embedding);
    const isDuplicate = await contract.methods.fuzzyHashes(fuzzyHash).call();
    if (isDuplicate) return res.status(409).json({ error: 'Duplicate entry' });

    const encryptedData = CryptoService.encryptData({ embedding, biometricData });
    const cid = await IpfsService.storeData(encryptedData);

    const commitment = web3.utils.soliditySha3(fuzzyHash, Date.now());
    const accounts = await web3.eth.getAccounts();
    console.log('Web3 accounts:', accounts);
console.log('Request from:', accounts[0], '| Officer should be:', process.env.OFFICER_ADDRESS);

    console.log('Sending transaction with:', { fuzzyHash, cid, commitment });

await contract.methods.register(fuzzyHash, cid, commitment)
  .send({ from: accounts[1], gas: 500000 });

console.log('Transaction successful');


    const refugeeId = await contract.methods.refugeeCount().call();
    await QRCode.toFile(
      path.join(__dirname, 'qr', `${refugeeId}.png`),
      JSON.stringify({ id: refugeeId, verificationUrl: `/verify/${refugeeId}` })
    );

    res.status(201).json({ refugeeId, qrUrl: `/qr/${refugeeId}.png` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/verify/:id', async (req, res) => {
  try {
    const refugee = await contract.methods.refugees(req.params.id).call();
    if (!refugee.ipfsCID) return res.status(404).json({ error: 'Refugee not found' });

    const block = await IpfsService.retrieveData(refugee.ipfsCID);
    const decryptedData = CryptoService.decryptData(block);

    res.json({
      ...decryptedData,
      blockchainData: {
        id: refugee.id,
        commitment: refugee.zkpCommitment,
        registrationDate: refugee.registrationDate
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server Startup
async function startServer() {
  try {
    await initializeFaceAPI();
    app.listen(3000, () => {
      console.log('Server running on port 3000');
    });
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
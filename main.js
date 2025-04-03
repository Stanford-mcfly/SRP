require('dotenv').config();
const express = require('express');
const { create } = require('ipfs-http-client');
const crypto = require('crypto');
const { Web3 } = require('web3');
const QRCode = require('qrcode');
const { Canvas, Image, createCanvas, loadImage } = require('canvas');
const faceapi = require('@vladmandic/face-api');
const { poseidon } = require('circomlib');
const fs = require('fs');

const app = express();
app.use(express.json());

// Ensure QR code directory exists
if (!fs.existsSync('./qr')) fs.mkdirSync('./qr');

// Initialize Web3
const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
const web3 = new Web3(provider);
const contractABI = require('./build/contracts/RefugeeBiometric.json').abi;
const contract = new web3.eth.Contract(contractABI, process.env.CONTRACT_ADDRESS);

// IPFS Setup
const ipfs = create({ host: 'localhost', port: 5001, protocol: 'http' });

// Load Face Recognition Models
async function loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk('./models');
    await faceapi.nets.faceLandmark68Net.loadFromDisk('./models');
    await faceapi.nets.faceRecognitionNet.loadFromDisk('./models');
}
loadModels();

// Convert base64 image into face descriptor
async function detectFace(imageBase64) {
    const buffer = Buffer.from(imageBase64, 'base64');
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const detection = await faceapi.detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection ? Array.from(detection.descriptor) : null;
}

// Generate Fuzzy Hash
function generateFuzzyHash(embedding) {
    const normalized = embedding.map(x => Math.round(x * 1000));
    return web3.utils.bytesToHex(poseidon(normalized));
}

// Encrypt Data (AES-256)
function encryptData(data) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return JSON.stringify({ iv: iv.toString('hex'), encrypted, key: key.toString('hex') });
}

// Decrypt Data (AES-256)
function decryptData(encryptedData) {
    const { iv, encrypted, key } = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

// Refugee Registration
app.post('/register', async (req, res) => {
    try {
        const { image, biometricData } = req.body;

        // 1. Face Detection
        const embedding = await detectFace(image);
        if (!embedding) throw new Error('No face detected');

        // 2. Generate Fuzzy Hash
        const fuzzyHash = generateFuzzyHash(embedding);

        // 3. Check for Duplicates
        const isDuplicate = await contract.methods.fuzzyHashes(fuzzyHash).call();
        if (isDuplicate) return res.status(400).send('Duplicate entry detected');

        // 4. Encrypt and Store Biometric Data on IPFS
        const encryptedData = encryptData({ embedding, biometricData });
        const { cid } = await ipfs.add(encryptedData);

        // 5. Generate Commitment for Zero-Knowledge Proof
        const commitment = web3.utils.soliditySha3(fuzzyHash, Date.now());

        // 6. Store Refugee Data on Blockchain
        const accounts = await web3.eth.getAccounts();
        await contract.methods.register(fuzzyHash, cid.toString(), commitment)
            .send({ from: accounts[0] });

        // 7. Generate and Save QR Code
        const refugeeId = await contract.methods.refugeeCount().call();
        await QRCode.toFile(`./qr/${refugeeId}.png`, `refugee://verify/${refugeeId}`);

        res.json({ refugeeId, qrUrl: `/qr/${refugeeId}.png` });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Refugee Verification
app.get('/verify/:id', async (req, res) => {
    try {
        // Fetch refugee data from blockchain
        const refugee = await contract.methods.refugees(req.params.id).call();
        if (!refugee.ipfsCID) return res.status(404).send('Refugee not found');

        // Retrieve and decrypt biometric data
        const encryptedData = await ipfs.cat(refugee.ipfsCID);
        const decryptedData = decryptData(encryptedData);

        res.json(decryptedData);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Start the Server
app.listen(3000, () => console.log('Server running on port 3000'));

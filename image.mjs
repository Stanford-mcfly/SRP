import fs from 'fs';
import axios from 'axios';
import sharp from 'sharp';
import Web3 from 'web3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function sendRequest() {
  try {
    // 1. Initialize Web3 and set up accounts
    const web3 = new Web3(process.env.PROVIDER_URL); // Fetch provider URL from .env
    const adminAddress = process.env.ADMIN_ADDRESS; // Fetch admin address from .env
    const officerAddress = process.env.OFFICER_ADDRESS; // Fetch officer address from .env
    const contractAddress = process.env.CONTRACT_ADDRESS; // Fetch contract address from .env
    const contractABI = JSON.parse(fs.readFileSync('./build/contracts/RefugeeBiometric.json', 'utf8')).abi;
    const contract = new web3.eth.Contract(contractABI, contractAddress);

    // 2. Add officer (only needs to be done once by the admin)
    const isOfficer = await contract.methods.officers(officerAddress).call();
    console.log('Is Officer:', isOfficer);
    if (!isOfficer) {
      console.log('Adding officer...');
      await contract.methods.addOfficer(officerAddress).send({ from: adminAddress, gas: 500000 });
      console.log('Officer added successfully.');
    }

    // 3. Optimize image
    const optimized = await sharp('./image.png')
      .resize(800, 800)
      .jpeg({ quality: 80 })
      .toBuffer();

    // 4. Create payload
    const payload = {
      image: `data:image/jpeg;base64,${optimized.toString('base64')}`,
      biometricData: {
        name: "Amina Al-Sayed",
        nationality: "Syrian",
        dateOfBirth: "1990-05-15",
        biometricSignature: "R2D2-C3PO-2023"
      }
    };

    // 5. Send request as the officer
    const response = await axios.post('http://localhost:3000/register', payload, {
      headers: {
        'Officer-Address': officerAddress // Include the officer's address in the request headers
      }
    });

    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendRequest();
import fs from 'fs';
import axios from 'axios';
import sharp from 'sharp';
import Web3 from 'web3';

async function sendRequest() {
  try {
    // 1. Initialize Web3 and set up accounts
    const web3 = new Web3('http://127.0.0.1:7545'); // Replace with your provider URL
    const adminAddress = '0x92eaA14Dd2B90Ed3E2b1Ea882a5709f50Cf1BFFd'; // Replace with the admin's address
    const officerAddress = '0x20b5877AB59fF86cfA7E9fe2FB5078F4f1FbDb55'; // Replace with the officer's address
    const contractAddress = '0x3908f5dB29B3b2DF1E7109543cFAca1e24FB7cf1'; // Replace with the deployed contract address
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
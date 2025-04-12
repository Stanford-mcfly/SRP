const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');

async function sendRequest() {
  try {
    // 1. Optimize image
    const optimized = await sharp('./image.png')
      .resize(800, 800)
      .jpeg({ quality: 80 })
      .toBuffer();

    // 2. Create payload
    const payload = {
      image: `data:image/jpeg;base64,${optimized.toString('base64')}`,
      biometricData: {
        name: "Amina Al-Sayed",
        nationality: "Syrian",
        dateOfBirth: "1990-05-15",
        biometricSignature: "R2D2-C3PO-2023"
      }
    };

    // 3. Send request
    const response = await axios.post('http://localhost:3000/register', payload);
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

sendRequest();
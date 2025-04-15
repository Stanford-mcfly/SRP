import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';

// Replace this with the actual refugee ID to verify
const refugeeId = 3;

async function verifyRefugee(id) {
  try {
    // 1. Convert PNG to optimized JPEG buffer (face-api works better with this)
    const optimized = await sharp('./man5.png')
      .resize(800, 800) // Optional, consistent sizing
      .jpeg({ quality: 80 }) // Convert to JPEG
      .toBuffer();

    // 2. Prepare base64 data URL
    const base64Image = `data:image/jpeg;base64,${optimized.toString('base64')}`;

    // 3. Send the verification request (include the image in the body)
    const response = await axios.post(`http://localhost:3000/verify/${id}`, {
      image: base64Image
    });

    // 4. Log the result
    console.log('✅ Verification Success:\n', JSON.stringify(response.data, null, 2));

  } catch (err) {
    console.error('❌ Verification Failed:', err.response?.data || err.message);
  }
}

verifyRefugee(refugeeId);
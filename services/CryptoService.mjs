import crypto from 'crypto';
import { buildPoseidon } from 'circomlibjs';
import Web3 from 'web3';

const web3 = new Web3();

class CryptoService {
  static encryptData(data) {
    try {
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

export default CryptoService;
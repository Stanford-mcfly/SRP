import { buildPoseidon } from 'circomlibjs';

class FuzzyHashService {
  static async generateHash(embedding) {
    try {
      const poseidon = await buildPoseidon();

      // Normalize the embedding (e.g., scale values to integers)
      const normalizedEmbedding = embedding.map(value => Math.round(value * 1000));

      // Generate the Poseidon hash
      const hash = poseidon(normalizedEmbedding);

      // Convert the hash to a hexadecimal string
      const hashBigInt = BigInt(poseidon.F.toString(hash));
      return hashBigInt.toString(16).padStart(64, '0'); // Return as a 64-character hex string
    } catch (err) {
      throw new Error(`Fuzzy hash generation failed: ${err.message}`);
    }
  }
}

export default FuzzyHashService;
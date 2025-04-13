import { buildPoseidon } from 'circomlibjs';

class FuzzyHashService {
  static async generateHash(embedding) {
    try {
      const poseidon = await buildPoseidon();
      const normalized = embedding.map(x => Math.round(x * 1000)); // Normalize the embedding
      const hash = poseidon(normalized);
      const hashBigInt = BigInt(poseidon.F.toString(hash));
      return `0x${hashBigInt.toString(16).padStart(64, '0')}`; // Return the hash as a hex string
    } catch (err) {
      throw new Error(`Fuzzy hash generation failed: ${err.message}`);
    }
  }
}

export default FuzzyHashService;
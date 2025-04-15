import { CID } from 'multiformats/cid';
import { unixfs } from '@helia/unixfs';
import { createHeliaHTTP } from '@helia/http';
import { FsBlockstore } from 'blockstore-fs';
import * as json from '@ipld/dag-json';

class IpfsService {
  constructor() {
    this.fsUnix = null;
  }

  async initialize() {
    const blockstore = new FsBlockstore('./blockstore'); // Use a filesystem blockstore
    const helia = await createHeliaHTTP({ blockstore });
    this.fsUnix = unixfs(helia);
  }

  async storeData(data) {
    if (!this.fsUnix) {
      throw new Error('IPFS service is not initialized. Call initialize() first.');
    }

    try {
      const bytes = json.encode(data); // Encode data as JSON
      const cid = await this.fsUnix.addBytes(bytes); // Add bytes to UnixFS
      return cid.toString();
    } catch (err) {
      throw new Error(`IPFS storage failed: ${err.message}`);
    }
  }

  async retrieveData(cidStr) {
    if (!this.fsUnix) {
      throw new Error('IPFS service is not initialized. Call initialize() first.');
    }

    try {
      const cid = CID.parse(cidStr); // Parse the CID
      const bytes = await this.fsUnix.cat(cid); // Retrieve the block
      return json.decode(bytes); // Decode the JSON data
    } catch (err) {
      throw new Error(`IPFS retrieval failed: ${err.message}`);
    }
  }
}

export default IpfsService;
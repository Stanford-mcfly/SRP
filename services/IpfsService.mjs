import { CID } from 'multiformats/cid';
import { unixfs } from '@helia/unixfs';
import { createHeliaHTTP } from '@helia/http';
import { FsBlockstore } from 'blockstore-fs';
import * as json from '@ipld/dag-json';

let fsUnix;

// Initialize Helia with UnixFS
(async () => {
  const blockstore = new FsBlockstore('./blockstore'); // Use a filesystem blockstore
  const helia = await createHeliaHTTP({ blockstore });
  fsUnix = unixfs(helia);
})();

class IpfsService {
  constructor(fsUnix) {
    this.fsUnix = fsUnix;
  }

  async storeData(data) {
    try {
      const bytes = json.encode(data); // Encode data as JSON
      const cid = await this.fsUnix.addBytes(bytes); // Add bytes to UnixFS
      return cid.toString();
    } catch (err) {
      throw new Error(`IPFS storage failed: ${err.message}`);
    }
  }

  async retrieveData(cidStr) {
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
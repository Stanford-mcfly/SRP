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
  static async retrieveData(cidStr) {
    try {
      const cid = CID.parse(cidStr); // Parse the CID
      const bytes = await fsUnix.cat(cid); // Retrieve the block

      // Debugging: Log the raw data retrieved from IPFS
      console.log('Raw IPFS Data:', bytes);

      // Ensure the data is a Uint8Array
      if (!(bytes instanceof Uint8Array)) {
        throw new Error('Data retrieved from IPFS is not a Uint8Array');
      }

      return json.decode(bytes); // Decode the JSON data
    } catch (err) {
      throw new Error(`IPFS retrieval failed: ${err.message}`);
    }
  }
}

export default IpfsService;
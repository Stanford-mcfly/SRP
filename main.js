const Web3 = require('web3');
const QRCode = require('qrcode');
const contractJson = require('./build/contracts/RefugeeBiometric.json');
const web3 = new Web3('http://localhost:7545');
const privateKey = '0xaf85cbe8ff5c1e21f13be8053ccdc3f85d7b55491a1d864e7a2645eca9536843';
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
web3.eth.accounts.wallet.add(account);

const contractAddress = '<DEPLOYED_CONTRACT_ADDRESS>';
const contract = new web3.eth.Contract(contractJson.abi, contractAddress);

// Synthetic data generator
const faker = require('faker');

async function addRefugee() {
  const name = faker.name.findName();
  const biometricHash = web3.utils.sha3(faker.datatype.uuid()); // Mock hash

  const tx = contract.methods.addBiometricData(name, biometricHash);
  const gas = await tx.estimateGas({ from: account.address });
  const receipt = await tx.send({ from: account.address, gas });

  // Generate QR Code with refugee ID
  const refugeeId = receipt.events.DataAdded.returnValues.id;
  const url = `http://localhost:3000/refugee?id=${refugeeId}`;
  QRCode.toFile(`./qr_codes/${refugeeId}.png`, url, (err) => {
    if (err) throw err;
    console.log(`QR code generated for refugee ${refugeeId}`);
  });
}

// Add 5 synthetic refugees
for (let i = 0; i < 5; i++) {
  addRefugee().catch(console.error);
}
const Web3 = require('web3');
const web3 = new Web3('http://localhost:7545');

async function test() {
  try {
    const block = await web3.eth.getBlockNumber();
    console.log(`Connected! Current block: ${block}`);
    const accounts = await web3.eth.getAccounts();
    console.log(`First account: ${accounts[0]}`);
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

test();
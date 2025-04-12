module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // localhost
      port: 7545,        // Default Ganache port (or 8545 if using CLI)
      network_id: "*",   // Any network
    },
  },
  compilers: {
    solc: {
      
      version: "0.5.1", // Ensure this matches the Solidity version used
    },
  },
};

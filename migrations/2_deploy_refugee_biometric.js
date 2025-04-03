const RefugeeBiometric = artifacts.require("RefugeeBiometric");

module.exports = function(deployer) {
  deployer.deploy(RefugeeBiometric);
};
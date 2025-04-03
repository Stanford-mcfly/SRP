const Verifier = artifacts.require("Groth16Verifier");
const RefugeeBiometric = artifacts.require("RefugeeBiometric");

module.exports = async function (deployer) {
    await deployer.deploy(Verifier);  // Deploy Verifier first
    const verifierInstance = await Verifier.deployed();  

    await deployer.deploy(RefugeeBiometric, verifierInstance.address);  // Pass its address
};

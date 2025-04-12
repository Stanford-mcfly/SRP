// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

contract SimpleStorage {
    struct Refugee {
        string name;
        string ipfsHash; // Face descriptor stored in IPFS
    }

    // Mapping: face hash (CID) => refugee details
    mapping(string => Refugee) private refugees;

    // List of all registered face hashes
    string[] private registeredFaceHashes;

    // Register a refugee using IPFS hash as key
    function registerRefugee(string memory _name, string memory _ipfsHash) public {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(refugees[_ipfsHash].ipfsHash).length == 0, "Refugee already registered");

        refugees[_ipfsHash] = Refugee(_name, _ipfsHash);
        registeredFaceHashes.push(_ipfsHash);
    }

    // Get refugee details by face hash
    function getRefugeeByFaceHash(string memory _ipfsHash) public view returns (string memory name, string memory hash) {
        Refugee memory r = refugees[_ipfsHash];
        return (r.name, r.ipfsHash);
    }

    // Return all registered face hashes
    function getAllFaceHashes() public view returns (string[] memory) {
        return registeredFaceHashes;
    }
}

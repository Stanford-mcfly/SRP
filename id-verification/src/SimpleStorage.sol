// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    mapping(address => string) private faceHashes;

    function storeFaceHash(string memory ipfsHash) public {
        faceHashes[msg.sender] = ipfsHash;
    }

    function getFaceHash() public view returns (string memory) {
        return faceHashes[msg.sender];
    }
}

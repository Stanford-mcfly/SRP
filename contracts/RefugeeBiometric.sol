// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external view returns (bool);
}

contract RefugeeBiometric {
    struct Refugee {
        uint256 id;
        bytes32 fuzzyHash;
        string ipfsCID;
        bool isSuspect;
        bytes32 zkpCommitment;
          uint256 timestamp; 
    }

    mapping(uint256 => Refugee) public refugees;
    mapping(bytes32 => bool) public fuzzyHashes;
    mapping(address => bool) public officers;
    address public admin;
    IVerifier public verifier;
    uint256 public refugeeCount;

    event Registered(uint256 indexed id, bytes32 fuzzyHash, string ipfsCID,uint256 timestamp);
    event RefugeeUpdated(uint256 id, string ipfsCID, bool isSuspect, uint256 timestamp);


    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyOfficer() {
        require(officers[msg.sender], "Not officer");
        _;
    }

    constructor(address _verifier) public {
        require(_verifier != address(0), "Invalid verifier address");
        admin = msg.sender;
        verifier = IVerifier(_verifier);
    }

    function addOfficer(address _officer) external onlyAdmin {
        officers[_officer] = true;
    }

    function register(
        bytes32 _fuzzyHash,
        string calldata _ipfsCID,
        bytes32 _commitment
    ) external onlyOfficer {
        require(!fuzzyHashes[_fuzzyHash], "Duplicate detected");
        refugeeCount++;
        refugees[refugeeCount] = Refugee(
            refugeeCount,
            _fuzzyHash,
            _ipfsCID,
            false,
            _commitment,
            block.timestamp
        );
        fuzzyHashes[_fuzzyHash] = true;
        emit Registered(refugeeCount, _fuzzyHash, _ipfsCID,block.timestamp);
    }

 function markSuspect(uint256 id, string memory newIpfsCID) public {
        require(refugees[id].id != 0, "Refugee does not exist");
        refugees[id].isSuspect = true;
        refugees[id].ipfsCID = newIpfsCID;
        refugees[id].timestamp = block.timestamp; // Update the timestamp
        emit RefugeeUpdated(id, newIpfsCID, true, block.timestamp);
    }

    function verifyProof(
        uint256 _id,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external view returns (bool) {
        require(input[0] == uint256(refugees[_id].zkpCommitment), "Invalid commitment");
        return verifier.verifyProof(a, b, c, input);
    }
}

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
    }

    mapping(uint256 => Refugee) public refugees;
    mapping(bytes32 => bool) public fuzzyHashes;
    mapping(address => bool) public officers;
    address public admin;
    IVerifier public verifier;
    uint256 public refugeeCount;

    event Registered(uint256 indexed id, bytes32 fuzzyHash, string ipfsCID);
    event SuspectMarked(uint256 indexed id, address officer);

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
            _commitment
        );
        fuzzyHashes[_fuzzyHash] = true;
        emit Registered(refugeeCount, _fuzzyHash, _ipfsCID);
    }

    function markSuspect(uint256 _id) external onlyOfficer {
        refugees[_id].isSuspect = true;
        emit SuspectMarked(_id, msg.sender);
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

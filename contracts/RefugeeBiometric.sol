// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract RefugeeBiometric {
    struct BiometricData {
        uint id;
        string name;
        string biometricHash; // Store hashed biometric data (not raw)
    }

    mapping(uint => BiometricData) private refugees;
    uint public refugeeCount;

    event DataAdded(uint id, string name, string biometricHash);

    function addBiometricData(
        string memory _name,
        string memory _biometricHash
    ) public {
        refugeeCount++;
        refugees[refugeeCount] = BiometricData(
            refugeeCount,
            _name,
            _biometricHash
        );
        emit DataAdded(refugeeCount, _name, _biometricHash);
    }

    function getBiometricData(uint _id) public view returns (
        uint,
        string memory,
        string memory
    ) {
        BiometricData memory data = refugees[_id];
        return (data.id, data.name, data.biometricHash);
    }
}
pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom"; // Include comparators for equality check

template SimpleHasher(dimensions) {
    signal input biometric[dimensions];
    signal input salt;
    signal output commitment;

    component hash = Poseidon(dimensions + 1);
    for (var i = 0; i < dimensions; i++) {
        hash.inputs[i] <== biometric[i];
    }
    hash.inputs[dimensions] <== salt;

    commitment <== hash.out;
}

template SimpleVerifier(dimensions) {
    signal input freshBiometric[dimensions];
    signal input salt;
    signal input storedCommitment;
    signal output isValid;

    component hasher = SimpleHasher(dimensions);
    for (var i = 0; i < dimensions; i++) {
        hasher.biometric[i] <== freshBiometric[i];
    }
    hasher.salt <== salt;

    component equalityCheck = IsEqual(); // Use IsEqual comparator
    equalityCheck.in[0] <== hasher.commitment;
    equalityCheck.in[1] <== storedCommitment;

    isValid <== equalityCheck.out; // Assign the result of the equality check
}

component main = SimpleVerifier(5);
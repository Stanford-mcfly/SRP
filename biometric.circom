pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template FuzzyMatcher() {
    // Supported parameters for Poseidon (2-16 inputs)
    var dimensions = 5; // Reduced from 128 to work with Poseidon
    var threshold = 500; // 0.5 * 1000 fixed-point
    
    signal input biometric[dimensions];
    signal input salt;
    signal output commitment;
    
    component comparators[dimensions];
    for (var i=0; i<dimensions; i++) {
        comparators[i] = GreaterEqThan(10); // Reduced from 32-bit
        comparators[i].in[0] <== biometric[i] * 1000;
        comparators[i].in[1] <== threshold;
    }
    
    component hasher = Poseidon(dimensions + 1);
    for (var i=0; i<dimensions; i++) {
        hasher.inputs[i] <== comparators[i].out;
    }
    hasher.inputs[dimensions] <== salt;
    
    commitment <== hasher.out;
}

template RefugeeVerifier() {
    signal input storedCommitment;
    signal input freshBiometric[5]; // Match reduced dimensions
    signal input originalSalt;
    signal output isValid;
    
    component matcher = FuzzyMatcher();
    for (var i=0; i<5; i++) {
        matcher.biometric[i] <== freshBiometric[i];
    }
    matcher.salt <== originalSalt;
    
    component check = IsEqual();
    check.in[0] <== matcher.commitment;
    check.in[1] <== storedCommitment;
    
    isValid <== check.out;
    isValid === 1;
}

component main = RefugeeVerifier();
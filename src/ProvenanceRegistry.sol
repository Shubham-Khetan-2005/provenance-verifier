// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract ProvenanceRegistry {
    struct Provenance {
        address deployer;
        bytes32 artifactHash;
        string rekorRef;
        string signerIdentity;
        uint256 timestamp;
    }

    // Keyed by the TARGET contract's address
    mapping(address => Provenance) public records;

    event Registered(address indexed contractAddress, address indexed deployer);

    function register(
        address deployer,
        bytes32 artifactHash,
        string calldata rekorRef,
        string calldata signerIdentity
    ) external {
        require(records[msg.sender].timestamp == 0, "Already registered");
        
        records[msg.sender] = Provenance({
            deployer: deployer,
            artifactHash: artifactHash,
            rekorRef: rekorRef,
            signerIdentity: signerIdentity,
            timestamp: block.timestamp
        });
        
        emit Registered(msg.sender, deployer);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IProvenanceRegistry {
    function register(
        address deployer,
        bytes32 artifactHash,
        string calldata provenanceURI,
        string calldata signerIdentity
    ) external;
}

contract VendorPayment {
    address public vendor;

    constructor(address registry, bytes32 artifactHash, string memory provenanceURI, string memory signerIdentity) {
        vendor = msg.sender;

        // msg.sender here is guaranteed by EVM to be the deploying EOA
        IProvenanceRegistry(registry).register(msg.sender, artifactHash, provenanceURI, signerIdentity);
    }

    function payVendor() external payable {
        require(msg.value > 0, "Payment required");
        (bool success,) = vendor.call{value: msg.value}("");
        require(success, "Transfer failed");
    }
}

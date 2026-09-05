const fs = require("fs");
const { ethers } = require("ethers");

// Replace this with the wallet address you will use to deploy!
const DEPLOYER_ADDRESS = "0x4Bd0053ab48e56A5f52454b92ca14320167F2af9";

const artifactPath = "./out/VendorPayment.sol/VendorPayment.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const runtimeBytecode = artifact.deployedBytecode.object;
const bytecodeHash = ethers.keccak256(runtimeBytecode);

// Create a binding between the code and your wallet
const payload = {
    bytecodeHash: bytecodeHash,
    deployer: DEPLOYER_ADDRESS
};

console.log("Payload to sign:", payload);

// Save the JSON payload to a file
fs.writeFileSync("payload.json", JSON.stringify(payload, null, 2));
console.log("Saved to payload.json for Cosign signing.");
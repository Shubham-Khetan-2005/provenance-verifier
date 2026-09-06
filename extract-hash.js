const fs = require("fs");
const { ethers } = require("ethers");

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const DEPLOYER_ADDRESS = wallet.address;

console.log("Using deployer address:", DEPLOYER_ADDRESS);

const artifactPath = "./out/VendorPayment.sol/VendorPayment.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const runtimeBytecode = artifact.deployedBytecode.object;
const bytecodeHash = ethers.keccak256(runtimeBytecode);

const payload = {
    bytecodeHash: bytecodeHash,
    deployer: DEPLOYER_ADDRESS,
};

console.log("Payload to sign:", payload);
fs.writeFileSync("payload.json", JSON.stringify(payload, null, 2));
console.log("Saved to payload.json");
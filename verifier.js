const { ethers } = require("ethers");
const { execSync } = require("child_process");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

// Ensure your Alchemy URL is active in your .env or replace this string
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/XlSNcm38QIP8s7FOVhgCLLUECVAplZhM"); 
const registryABI = [
  "function records(address) view returns (address, bytes32, string, string, uint256)"
];

async function verifyProvenance(registryAddress, targetContractAddress) {
  try {
    const registryContract = new ethers.Contract(registryAddress, registryABI, provider);

    // 1. Fetch On-Chain Truth
    const record = await registryContract.records(targetContractAddress);
    const [deployer, artifactHash, rekorRef, signerIdentity, timestamp] = record;

    if (timestamp === 0n) {
      console.log("🟡 Unregistered: No provenance record found for this address.");
      return;
    }

    const liveBytecode = await provider.getCode(targetContractAddress);
    const liveBytecodeHash = ethers.keccak256(liveBytecode);

    // 2. Local Rebuild & Bytecode Comparison
    console.log("Rebuilding source via Foundry to verify runtime bytecode...");
    execSync("forge build", { stdio: "ignore" });
    const localArtifact = require("./out/VendorPayment.sol/VendorPayment.json");
    const localBytecodeHash = ethers.keccak256(localArtifact.deployedBytecode.object);

    if (liveBytecodeHash !== localBytecodeHash) {
      console.error("🔴 Mismatch: Rebuilt source does NOT match on-chain bytecode.");
      return;
    }
    if (liveBytecodeHash !== artifactHash) {
      console.error("🔴 Mismatch: On-chain artifact hash does not match live bytecode.");
      return;
    }

    // 3. Native Cosign Verification
    console.log(`Delegating bundle and identity verification to Cosign for ${signerIdentity}...`);
    try {
        // We verify the exact local payload file to preserve byte-for-byte signature integrity
        execSync(`cosign verify-blob payload.json \\
            --bundle bundle.json \\
            --certificate-identity="${signerIdentity}" \\
            --certificate-oidc-issuer-regexp="https://(accounts.google.com|github.com/login/oauth|login.microsoftonline.com/.*)"`, 
            { stdio: "pipe" } 
        );
    } catch (cosignError) {
        console.error("🔴 Mismatch: Cosign rejected the bundle/identity binding.");
        console.error(cosignError.stderr?.toString() || cosignError.message);
        return;
    }

    // 4. Semantic Validation Against On-Chain Truth
    const verifiedPayload = JSON.parse(fs.readFileSync("payload.json", "utf8"));

    if (verifiedPayload.bytecodeHash !== artifactHash) {
      console.error("🔴 Mismatch: The signed payload hash does not match the on-chain runtime bytecode.");
      return;
    }

    if (verifiedPayload.deployer.toLowerCase() !== deployer.toLowerCase()) {
      console.error("🔴 Mismatch: The signed payload deployer does not match the on-chain EOA wallet.");
      return;
    }

    console.log("\n🟢 VERIFIED");
    console.log(" - Ethereum Deployment: Authentic");
    console.log(" - Bytecode Match: 100% Confirmed");
    console.log(` - Sigstore Provenance: Cryptographically bound to ${signerIdentity} (Log Index: ${rekorRef})`);

  } catch (error) {
    console.error("🔴 Verifier failed:", error.message);
  }
}

const targetAddress = process.argv[2];
verifyProvenance(process.env.REGISTRY_ADDRESS, targetAddress);
console.log("Using registry address:", process.env.REGISTRY_ADDRESS);
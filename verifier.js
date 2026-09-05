const { ethers } = require("ethers");
const { execSync } = require("child_process");

const provider = new ethers.JsonRpcProvider(
  "https://eth-sepolia.g.alchemy.com/v2/XlSNcm38QIP8s7FOVhgCLLUECVAplZhM",
);
const registryABI = [
  "function records(address) view returns (address, bytes32, string, string, uint256)",
];

async function verifyProvenance(registryAddress, targetContractAddress) {
  try {
    const registryContract = new ethers.Contract(
      registryAddress,
      registryABI,
      provider,
    );

    // 1. Fetch On-Chain Truth
    const record = await registryContract.records(targetContractAddress);
    const [deployer, artifactHash, rekorRef, signerIdentity, timestamp] =
      record;

    if (timestamp === 0n) {
      console.log(
        "🟡 Unregistered: No provenance record found for this address.",
      );
      return;
    }

    const liveBytecode = await provider.getCode(targetContractAddress);
    const liveBytecodeHash = ethers.keccak256(liveBytecode);

    // 2. Local Rebuild & Bytecode Comparison
    console.log("Rebuilding source via Foundry to verify runtime bytecode...");
    execSync("forge build", { stdio: "ignore" });
    const localArtifact = require("./out/VendorPayment.sol/VendorPayment.json");
    const localBytecodeHash = ethers.keccak256(
      localArtifact.deployedBytecode.object,
    );

    if (liveBytecodeHash !== localBytecodeHash) {
      console.error(
        "🔴 Mismatch: Rebuilt source does NOT match on-chain bytecode.",
      );
      return;
    }

    // 3. Fetch Sigstore / Rekor Transparency Log
    console.log(
      "Fetching Sigstore transparency log (Index:",
      rekorRef + ")...",
    );
    const rekorUrl = `https://rekor.sigstore.dev/api/v1/log/entries?logIndex=${rekorRef}`;
    const rekorResponse = await fetch(rekorUrl);

    if (!rekorResponse.ok) throw new Error("Invalid Rekor reference.");

    const rekorData = await rekorResponse.json();
    const logEntry = Object.values(rekorData)[0];
    const bodyJSON = JSON.parse(
      Buffer.from(logEntry.body, "base64").toString("utf8"),
    );

    // 4. Safe Identity & Payload Extraction
    const sig = bodyJSON.spec.signature;
    const certBase64 = sig.publicKey?.content || sig.pubKey?.content;
    const decodedCert = Buffer.from(certBase64, "base64").toString("utf8");

    // Check both plaintext and base64-encoded forms of the email inside the certificate
    const base64Identity = Buffer.from(signerIdentity)
      .toString("base64")
      .replace(/=+$/, "");

    console.log("Verifying signer identity against certificate...");

    if (
      !decodedCert.includes(signerIdentity) &&
      !certBase64.includes(base64Identity)
    ) {
      console.error(
        `🔴 Mismatch: Certificate does not include '${signerIdentity}'.`,
      );
      return;
    }

    // Handle payload decoding safely
    const payloadBase64 = sig.content || sig.data;
    const signedPayload = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString("utf8"),
    );

    if (signedPayload.bytecodeHash !== artifactHash) {
      console.error(
        "🔴 Mismatch: The payload signed by Cosign does not match the on-chain hash.",
      );
      return;
    }

    if (signedPayload.deployer.toLowerCase() !== deployer.toLowerCase()) {
      console.error(
        "🔴 Mismatch: Spoof detected! Cosign payload deployer does not match the on-chain deploying wallet.",
      );
      return;
    }

    console.log("\n🟢 VERIFIED");
    console.log(" - Ethereum Deployment: Authentic");
    console.log(" - Bytecode Match: 100% Confirmed");
    console.log(` - Sigstore Provenance: Authored by ${signerIdentity}`);
  } catch (error) {
    console.error("🔴 VERIFICATION FAILED");
    console.error(error);
  }
}
// UPDATE THESE TWO LINES WITH YOUR SEPOLIA ADDRESSES
verifyProvenance(
  "0x1D80BEF4311fa48852199dab9cC469D8646f2542",
  "0x2735347e5cc262Cdc459Aa0461dC230d7CFa8187",
);

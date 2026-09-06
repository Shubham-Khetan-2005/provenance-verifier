const { ethers } = require("ethers");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const abi = ["function records(address) view returns (address, bytes32, string, string, uint256)"];

async function fetchFile(uri, name) {
  const res = await fetch(`${uri}/${name}`);
  if (!res.ok) throw new Error(`fetch ${uri}/${name} failed: ${res.status}`);
  return res.text();
}

async function verify(registryAddr, target) {
  let tmpDir;
  try {
    const registry = new ethers.Contract(registryAddr, abi, provider);
    const [deployer, artifactHash, provenanceURI, signerIdentity, timestamp] =
      await registry.records(target);

    if (timestamp === 0n) {
      console.log("no provenance record for this address");
      return;
    }

    const liveCode = await provider.getCode(target);
    const liveHash = ethers.keccak256(liveCode);

    if (liveHash !== artifactHash) {
      console.error("on-chain hash doesn't match live bytecode");
      return;
    }

    console.log(`fetching provenance from ${provenanceURI}`);
    const payloadText = await fetchFile(provenanceURI, "payload.json");
    const bundleText = await fetchFile(provenanceURI, "bundle.json");

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provenance-"));
    const payloadPath = path.join(tmpDir, "payload.json");
    const bundlePath = path.join(tmpDir, "bundle.json");
    fs.writeFileSync(payloadPath, payloadText);
    fs.writeFileSync(bundlePath, bundleText);

    console.log(`checking signature for ${signerIdentity}`);
    try {
      execSync(
        `cosign verify-blob "${payloadPath}" --bundle "${bundlePath}" ` +
        `--certificate-identity="${signerIdentity}" ` +
        `--certificate-oidc-issuer="https://github.com/login/oauth"`,
        { stdio: "pipe" }
      );
    } catch (e) {
      console.error("cosign rejected the bundle:", e.stderr?.toString() || e.message);
      return;
    }

    const signedPayload = JSON.parse(payloadText);
    if (signedPayload.bytecodeHash !== artifactHash) {
      console.error("signed payload hash doesn't match on-chain bytecode");
      return;
    }
    if (signedPayload.deployer.toLowerCase() !== deployer.toLowerCase()) {
      console.error("signed deployer doesn't match on-chain deployer");
      return;
    }

    console.log("\nVERIFIED");
    console.log(`deployment authentic, bytecode confirmed`);
    console.log(`signed by ${signerIdentity}`);
    console.log(`source: ${provenanceURI}`);
  } catch (err) {
    console.error("verify failed:", err.message);
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const target = process.argv[2];
if (!target) {
  console.error("usage: node verifier.js <contract address>");
  process.exit(1);
}

verify(process.env.REGISTRY_ADDRESS, target);
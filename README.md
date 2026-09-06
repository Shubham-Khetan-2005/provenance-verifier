# Ethereum Contract Provenance Verifier

**Devcon Track 4: Sigstore - Verifiable Supply Chain**

Web3 supply chains are broken. While anyone can inspect deployed bytecode on block explorers, there is no standardized way to mathematically prove *who* deployed it. This project bridges Ethereum's on-chain execution with Sigstore's off-chain identity verification, allowing users to independently verify that a deployed contract's runtime bytecode is cryptographically bound to a specific developer's real-world identity (via GitHub/OIDC).

## System Architecture

The provenance pipeline operates entirely without a centralized backend, relying on three decoupled pillars:

*   **On-Chain Truth (EVM):** A registry smart contract (`ProvenanceRegistry.sol`) acts as the immutable ledger. When a target contract is deployed, its constructor automatically registers the deployment using `msg.sender`, locking the deployer's address, bytecode hash, Rekor log index, and signer identity.
*   **Off-Chain Identity (Sigstore):** A deterministic Foundry build is hashed and bundled into a JSON payload alongside the deployer's wallet address. This payload is signed via the Cosign CLI using keyless OIDC authentication.
*   **Independent Verification Engine:** A Node.js script dynamically fetches the live on-chain registry data, rebuilds the local environment to guarantee bytecode parity, and delegates the validation of the cryptographic bundle to the native Cosign CLI.

## Prerequisites

This pipeline requires a Unix-like environment (Linux, macOS, or Windows WSL). Ensure you have the following installed:
*   **Node.js** (v22+)
*   **Foundry** (`forge`)
*   **Cosign CLI**

## Quickstart

**1. Installation**
```
git clone https://github.com/Shubham-Khetan-2005/sigstore-provenance-verifier.git
cd sigstore-provenance-verifier
npm install
forge install
```

**2. Configuration**
Create a `.env` file in the project root by copying `.env.example`. Populate it with your specific credentials:

```
PRIVATE_KEY=YOUR_TEST_WALLET_PRIVATE_KEY
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
REGISTRY_ADDRESS=0x1D80BEF4311fa48852199dab9cC469D8646f2542
SIGNER_IDENTITY=The email that you use to sign into sigstore
```

*(Ensure each variable is on its own line. Do not wrap values in quotes).*

**3. Deploy and Verify**
Run the automated pipeline script. This master script extracts your public wallet address, generates the deterministic payload, triggers the Cosign OIDC browser login, deploys the contract to Sepolia, and instantly runs the off-chain verifier.

```
chmod +x deploy-and-verify.sh
./deploy-and-verify.sh
```

If successful, the verifier will output:

VERIFIED
 - Ethereum Deployment: Authentic
 - Bytecode Match: 100% Confirmed
 - Sigstore Provenance: 

## Security Model

The verification engine intentionally decouples cryptographic signature verification from semantic data validation. The native `cosign` CLI strictly handles the X.509 certificate parsing, OIDC issuer validation, and Rekor inclusion proofs. Ethers.js and Foundry handle the EVM-specific bytecode parity checks. If an attacker tampers with the deployed bytecode or attempts to spoof the deployment wallet, the Sigstore verification instantly rejects the binding.

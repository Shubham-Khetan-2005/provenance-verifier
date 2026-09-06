# Ethereum Contract Provenance Verifier

**Track Applied For:** Track 4 (Sigstore)\
**Team Name:** WebHeads
**Team Members:** Shubham Khetan, Mohisha Gupta
**GitHub Repository:** https://github.com/Shubham-Khetan-2005/provenance-verifier
**Deployed Contract Address:** 0x09bb3F7339f9617CD601D2EB07106041d3aeCA04
**Demo Video:** [Link]

## 1. Problem Statement & Overview

Anyone can copy a smart contract's code, change it slightly, and deploy it under a different address. If you're given a contract address, there's no easy way to check: "was this really built and deployed by the developer it claims to be from, and is the code actually what they said it is?"

This project solves that by connecting two things that don't normally talk to each other:
- **Ethereum**, which can prove *what code is actually running* at an address, and *which wallet* deployed it.
- **Sigstore**, a tool that lets a real person sign off on something using their GitHub login — no separate password or secret key to manage.

We link the two together: when a contract is deployed, its code gets fingerprinted, a real developer signs that fingerprint with their GitHub identity, and both the fingerprint and the signature get permanently recorded. Later, anyone — using nothing but the contract's address — can check all of this for themselves, without trusting us or any central server.

**Who this helps:** anyone about to interact with a contract (send funds, approve tokens, etc.) who wants proof of who really built it, and developers who want a verifiable trail linking their real identity to what they deployed.

## 2. Architecture & Technical Flow

A few terms, quickly, since they matter for understanding the flow:
- **Bytecode** — the actual low-level code that runs on Ethereum once a contract is deployed.
- **Hash** — a short fingerprint of some data (here, the bytecode). Even a one-character change in the code produces a completely different hash, and you can't reverse a hash back into the original data.
- **Keyless signing (Sigstore/Cosign)** — instead of managing a private signing key yourself, you log in with GitHub, and Sigstore issues you a short-lived certificate + signs your file on the spot. The signature and a public, permanent log entry (via **Rekor**) get bundled together, so anyone can check it later even after the certificate expires.

### Deploy + Attest (done once, per contract)

```
Source code
  → compile with Foundry → get the bytecode
  → hash the bytecode (payload.json: hash + deployer's wallet address)
  → sign payload.json with Cosign (creates bundle.json, using your GitHub login)
  → publish payload.json + bundle.json to a public GitHub repo,
      in a folder named after the bytecode's hash
  → deploy the actual contract, which automatically records on-chain:
      deployer address, bytecode hash, link to the published files, signer identity
```

Publishing by hash means: if you deploy the exact same code twice, both deployments can point to the same already-published evidence — no need to sign and publish twice.

### Verify (anyone can do this, anytime, with just a contract address)

```
Contract address
  → look up its record in our on-chain registry
  → fetch the contract's real, live bytecode from Ethereum, hash it
  → compare that hash to what the registry claims
  → download the published payload.json + bundle.json
  → ask Cosign to check the signature is real and belongs to the claimed identity
  → check the signed file's hash/deployer actually match this contract's on-chain record
  → result: VERIFIED / UNREGISTERED / MISMATCH
```

Note: the actual signature-checking is done by Cosign itself, not by our own code — this way, no bug in our verifier can accidentally accept a fake signature.

**Tools used:** Solidity, Foundry, Ethers.js, Sigstore (Cosign, Fulcio, Rekor), Ethereum Sepolia testnet, GitHub (for publicly hosting the signed evidence files).

## 3. Key Accomplishments (48-Hour Scope)

**Working end-to-end, right now:**
- Compiles the contract and hashes its real bytecode.
- Signs that hash for real, using an actual GitHub login (not a mocked/fake signature).
- Publishes the signed evidence publicly.
- Records deployer, bytecode hash, evidence link, and identity on-chain automatically at deploy time.
- Verifies any deployed contract using only its address — no source code or local setup needed to verify.
- Correctly detects and labels three different failure cases: unregistered address, tampered bytecode, and a rejected/invalid signature.
- Skips re-signing/re-publishing if the exact same code is deployed again.

**Known limitation:** the signed evidence files are currently hosted on GitHub rather than a fully decentralized storage system like IPFS. This was a deliberate time-tradeoff for the hackathon; moving to IPFS is straightforward future work since only the publish/fetch step would need to change.

## 4. Setup & Local Reproduction Instructions

```bash
git clone https://github.com/Shubham-Khetan-2005/provenance-verifier.git
cd provenance-verifier
npm install
forge install
forge build
```

### Setting up your `.env` file

```bash
cp .env.example .env
```

Then open `.env` and fill in each value like this:

| Variable | What to put there |
|---|---|
| `PRIVATE_KEY` | The private key of a Sepolia test wallet you control (get free test ETH from a faucet like sepoliafaucet.com). Never use a real/mainnet wallet's key here. |
| `RPC_URL` | A Sepolia RPC endpoint URL — free from a provider like Alchemy or Infura (sign up, create a Sepolia app, copy the URL they give you). |
| `REGISTRY_ADDRESS` | Leave blank at first. You'll deploy your own registry contract (command below) and paste its address here afterward. |
| `SIGNER_IDENTITY` | The email address you'll use to log into GitHub when Cosign asks you to sign in. |
| `GITHUB_REPO` | The `username/repo-name` of a **public** GitHub repo where the signed evidence files will be published. |
| `GITHUB_BRANCH` | Usually just `main`. |
| `PROVENANCE_REPO_DIR` | The full local file path to where you've cloned that same public repo on your own machine. |

### Deploy your own registry (one-time)

```bash
forge create src/ProvenanceRegistry.sol:ProvenanceRegistry \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```
Copy the address it prints out and paste it into `.env` as `REGISTRY_ADDRESS`.

### Run the full pipeline

```bash
chmod +x deploy-and-verify.sh
./deploy-and-verify.sh
```

This will: build and hash the contract, ask you to sign in and sign it via Cosign, ask you to confirm before publishing (only if this exact build hasn't been published before), deploy the contract, and automatically verify it — all in one run.

### Verify any contract on its own, anytime

```bash
node verifier.js <contract address>
```

## What does "VERIFIED" actually mean?

It means: this contract has an on-chain record, the code currently running at that address matches what was signed, and the signature genuinely belongs to the claimed identity.

It does **not** mean the contract is safe to use, bug-free, or that the signer is officially who they claim to be in real life (e.g. "a real company") — only that whoever holds that GitHub account did sign off on exactly this code.
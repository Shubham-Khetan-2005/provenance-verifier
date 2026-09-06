#!/bin/bash
set -e # STOP immediately if any command fails

# Load environment variables securely
set -o allexport
source .env
set +o allexport

echo "1. Generating Payload..."
# Using PUBLIC_KEY from your .env
node extract-hash.js

echo -e "\n2. Signing Payload..."
COSIGN_EXPERIMENTAL=1 cosign sign-blob payload.json --bundle bundle.json --yes

echo -e "\n3. Extracting Log Index & Hash..."
# CORRECTED: Added .verificationMaterial to the JSON path
LOG_INDEX=$(node -p "require('./bundle.json').verificationMaterial.tlogEntries[0].logIndex")
BYTECODE_HASH=$(node -p "require('./payload.json').bytecodeHash")

echo "Found Log Index: $LOG_INDEX"
echo "Found Bytecode Hash: $BYTECODE_HASH"

if [ -z "$LOG_INDEX" ]; then
    echo "🔴 Error: Failed to extract Log Index from bundle.json"
    exit 1
fi

echo -e "\n4. Deploying Contract..."
DEPLOY_OUTPUT=$(forge create src/VendorPayment.sol:VendorPayment \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args $REGISTRY_ADDRESS $BYTECODE_HASH $LOG_INDEX "$SIGNER_IDENTITY")

echo "$DEPLOY_OUTPUT"

# Safely extract the deployed target address
TARGET_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Deployed to:" | awk '{print $3}')

if [ -z "$TARGET_ADDRESS" ]; then
    echo "🔴 Error: Deployment failed or could not extract contract address."
    exit 1
fi

echo -e "\n5. Running Verifier on $TARGET_ADDRESS..."
node verifier.js $TARGET_ADDRESS
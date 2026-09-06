#!/bin/bash
set -e

set -o allexport
source .env
set +o allexport

GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

node extract-hash.js

COSIGN_EXPERIMENTAL=1 cosign sign-blob payload.json --bundle bundle.json --yes

BYTECODE_HASH=$(node -p "require('./payload.json').bytecodeHash")
[ -z "$BYTECODE_HASH" ] && { echo "couldn't get bytecode hash from payload.json"; exit 1; }

PROV_DIR="provenance/$BYTECODE_HASH"
PROVENANCE_URI="https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${PROV_DIR}"

[ -z "$PROVENANCE_REPO_DIR" ] && { echo "set PROVENANCE_REPO_DIR in .env"; exit 1; }

if [ -f "$PROVENANCE_REPO_DIR/$PROV_DIR/payload.json" ] && [ -f "$PROVENANCE_REPO_DIR/$PROV_DIR/bundle.json" ]; then
    echo "already published, reusing: $PROVENANCE_URI"
else
    echo "new build $BYTECODE_HASH -> publishing to $GITHUB_REPO ($GITHUB_BRANCH)"
    read -p "push provenance files? [y/N] " ok
    [[ "$ok" =~ ^[Yy]$ ]] || { echo "not publishing, aborting"; exit 1; }

    cwd=$(pwd)
    mkdir -p "$PROVENANCE_REPO_DIR/$PROV_DIR"
    cp payload.json bundle.json "$PROVENANCE_REPO_DIR/$PROV_DIR/"

    cd "$PROVENANCE_REPO_DIR"
    git pull origin "$GITHUB_BRANCH"
    git add "$PROV_DIR"
    git commit -m "provenance for $BYTECODE_HASH"
    git push origin "$GITHUB_BRANCH"
    cd "$cwd"

    echo "published: $PROVENANCE_URI"
fi

echo "deploying VendorPayment..."
DEPLOY_OUTPUT=$(forge create src/VendorPayment.sol:VendorPayment \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --constructor-args $REGISTRY_ADDRESS $BYTECODE_HASH "$PROVENANCE_URI" "$SIGNER_IDENTITY")

echo "$DEPLOY_OUTPUT"

TARGET_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
[ -z "$TARGET_ADDRESS" ] && { echo "deploy failed, no address found"; exit 1; }

echo "verifying $TARGET_ADDRESS"
node verifier.js $TARGET_ADDRESS
#!/usr/bin/env sh
# Static-analysis gate for the EVM contracts (Slither + Aderyn), Docker-only.
#
# Runs two static analyzers against chain/evm (Foundry, Solidity 0.8.26) and
# writes their raw reports to the repo root:
#   - slither-report.json  (Slither, JSON)
#   - aderyn-report.md      (Aderyn, Markdown)
#
# This is the automated floor on top of the manual EVM audit
# (audit/audit-evm-2026-06-30.md). The triaged, human-readable verdict lives in
# audit/static-analysis-evm-2026-06-30.md.
#
# Usage (from the repo root):
#   sh chain/docker/analyze-evm.sh
#
# Pinned toolchains (no host Foundry/Rust/Python needed):
#   - Slither 0.11.5 via ghcr.io/trailofbits/eth-security-toolbox:edge (solc 0.8.26)
#   - Aderyn 0.6.8  prebuilt linux-gnu binary run in debian:bookworm-slim
#
# Windows / Git Bash note: MSYS_NO_PATHCONV=1 stops MSYS from rewriting the
# leading-slash container paths, and container working dirs use a leading //.
set -eu

# Resolve the repo root from this script's location (chain/docker/).
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

SOLC_VERSION=0.8.26
TOOLBOX_IMAGE=ghcr.io/trailofbits/eth-security-toolbox:edge
ADERYN_VERSION=aderyn-v0.6.8
ADERYN_BASE_IMAGE=debian:bookworm-slim

export MSYS_NO_PATHCONV=1

echo "==> [1/2] Slither ($TOOLBOX_IMAGE, solc $SOLC_VERSION)"
docker run --rm -v "$REPO_ROOT:/work" -w //work/chain/evm \
  --entrypoint sh "$TOOLBOX_IMAGE" -c '
    set -e
    solc-select install '"$SOLC_VERSION"' >/dev/null 2>&1
    solc-select use '"$SOLC_VERSION"' >/dev/null 2>&1
    forge clean >/dev/null 2>&1 || true
    slither . \
      --compile-force-framework foundry \
      --foundry-out-directory out \
      --checklist \
      --json //work/slither-report.json
  '

echo "==> [2/2] Aderyn ($ADERYN_VERSION, solc $SOLC_VERSION)"
docker run --rm -v "$REPO_ROOT:/work" -w //work/chain/evm \
  "$ADERYN_BASE_IMAGE" sh -c '
    set -e
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y -qq curl xz-utils ca-certificates >/dev/null 2>&1
    curl -sSL -o /tmp/aderyn.tar.xz \
      "https://github.com/Cyfrin/aderyn/releases/download/'"$ADERYN_VERSION"'/aderyn-x86_64-unknown-linux-gnu.tar.xz"
    mkdir -p /opt/aderyn
    tar -xJf /tmp/aderyn.tar.xz -C /opt/aderyn
    BIN=$(find /opt/aderyn -type f -name aderyn | head -1)
    "$BIN" . -o //work/aderyn-report.md
  '

echo ""
echo "==> Done. Raw reports written to the repo root:"
echo "      slither-report.json"
echo "      aderyn-report.md"
echo "    Triaged verdict: audit/static-analysis-evm-2026-06-30.md"

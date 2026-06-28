# Pinned Foundry toolchain for EVM contract build and test (AD-10, NFR5).
FROM ghcr.io/foundry-rs/foundry:stable
WORKDIR /work
# Contracts are mounted at runtime via docker-compose; this image only pins the toolchain.

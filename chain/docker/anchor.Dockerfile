# Not used by default. The compose `anchor` service uses the prebuilt
# image `backpackapp/build:v0.31.0` (Rust + Solana CLI + Anchor + platform-tools),
# which avoids compiling the toolchain from source. This Dockerfile is kept only
# as a fallback if a fully self-built, version-pinned toolchain is ever required.

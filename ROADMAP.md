# Roadmap

Where Aid Protocol is and where it is going. This roadmap is derived from the epic breakdown in [`docs/planning-artifacts/epics.md`](docs/planning-artifacts/epics.md) and reflects the as-built state. Functional and non-functional requirement tags (FR, NFR) refer to that document.

Status legend: `done` shipped on testnet, `in progress` actively being built, `planned` designed but not started, `gate` a hard requirement before mainnet.

## Phase 0: Foundations and money rail (done, testnet)

- `done` Solana program: proof-gated escrow with per-campaign PDAs, multi-asset (SOL + USDC/USDT), refunds (FR3, FR5, FR6, NFR6).
- `done` EVM contracts: `AidEscrowFactory` plus one isolated `CampaignEscrow` per campaign, multi-asset (ETH + USDC/USDT), refunds.
- `done` Real on-chain proof model: `recordProof(tranche, hash, asset, amount)` commits a hash and an approved amount; release is bounded by it (no live-percentage cap).
- `done` Separation of duties: approver records proof, a distinct authority releases (FR12 direction).
- `done` Donor refunds, pull-based and pro-rata, for native and tokens, on fraud.
- `done` Pinned Docker toolchains for both chains; contracts tested in Docker (NFR5).
- `done` Coverage and audit bar met: EVM 100% lines and functions, 95%+ branches, Slither clean; Solana litesvm suite green, cargo-audit clean.
- `done` Deployed to Sepolia, Base Sepolia, and Solana devnet (see [`chain/deployments.json`](chain/deployments.json)).

## Phase 1: App and experience (done, testnet)

- `done` Cloudflare Worker app and JSON API over D1, KV, R2; Vite + React SPA; no Next.js (NFR1, NFR2).
- `done` Blog-style home and feed, campaign pages, live donations ticker, news (FR1, FR2, FR17, FR18).
- `done` Donor profiles at `/u/<handle>` and `/w/<wallet>` with totals, causes, and badge tiers (FR13, FR14, FR15).
- `done` Leaderboards by Most SOL, Most ETH, and Most stable, with a per-cause filter (FR16, FR20).
- `done` EVM donate flow wired to a live escrow from a connected wallet (FR3, FR4).
- `done` Requester intake, diligence, and approval pipeline with a token-gated reviewer console (FR8, FR9, NFR10).
- `done` Campaign lifecycle: active versus past (completed, frozen, refunding).
- `done` Per-active-campaign relief news ingested from ReliefWeb and Google News via a cron, deduped, with admin hide.
- `done` Branded coming-soon on the apex domain; email routing for admin@aidprotocol.org.
- `done` Public repository with README, CONTRIBUTING, SECURITY, AGENTS, and license.

## Phase 2: Close the loop (in progress and next, MVP completion)

- `planned` Off-chain indexer: ingest Solana and EVM events into the canonical model so real donations, totals, and leaderboards reflect chain state; idempotent on chain, tx signature, and log index (FR21, NFR3, NFR7).
- `planned` Solana donate flow in the UI (wallet adapter) to match the EVM path (FR3).
- `planned` Multi-chain campaign publish: on approval, fan out create-campaign across all chains and write the escrow map back automatically.
- `planned` Proof-of-spend media upload to R2 and a proof feed tied to each tranche (FR10).
- `planned` AI proof pipeline on Cloudflare Workers AI with human fallback; only a pass emits the on-chain proof signal that gates release (FR7, FR11, ADR-003).
- `planned` USD normalization at donation time via a price source (FR20, NFR9).
- `planned` Badge card image generation and share to X (FR19).
- `planned` Chain SDKs isolated behind adapters end to end (NFR4).

## Phase 3: Pre-mainnet gates

- `gate` Independent smart contract and program audits before any handling of real funds (NFR12).
- `gate` Legal entity formed (foundation or non-profit) and the placeholders in the legal docs filled (entity, tax status, governing jurisdiction).
- `gate` Authority moved to a multisig: Squads on Solana, Safe on EVM (FR12).
- `gate` Incident and freeze runbook; monitoring and alerting on escrow state.

## Phase 4: Mainnet launch

- `planned` Deploy contracts to Ethereum mainnet, Base, and Solana mainnet (NFR6).
- `planned` Cut the apex domain from coming-soon to the full app.
- `planned` First real disaster campaigns onboarded through diligence.

## Later

- `planned` Additional chains and tokens behind the existing allowlist pattern.
- `planned` Trusted-reviewer program for diligence at scale.
- `planned` Richer donor reputation and recurring giving.

This roadmap will evolve. Proposals are welcome as issues and pull requests; see [`CONTRIBUTING.md`](CONTRIBUTING.md).

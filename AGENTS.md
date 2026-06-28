# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Read this before making changes. It complements [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`README.md`](README.md).

## What Aid Protocol is

A non-profit, open-source platform for disaster relief. Donations are recorded on-chain and released from per-campaign escrow only against proof of spend. Multi-chain (Solana + EVM), multi-asset (native + USDC/USDT), non-custodial, proof-gated, with donor refunds on fraud. No token, no DAO. Currently on testnets.

## Hard rules (do not break these)

1. **No em dashes** in any user-facing copy or content. Use commas, colons, periods, or parentheses.
2. **Smart contracts build and test ONLY in Docker** via `chain/docker/` (pinned: Anchor 1.0.2 / Solana 3.1.10, Foundry stable). Do not assume local toolchains.
3. **Contract coverage stays at 95% minimum, 100% preferred.** New instructions or functions require new tests. EVM also runs Slither; Solana runs cargo-audit. No new findings.
4. **Frontend is Cloudflare-only. Next.js is forbidden.** The app is Vite + React, served by a Cloudflare Worker.
5. **On-chain is the source of truth.** The D1 tables are a rebuildable read model. Never make the database authoritative.
6. **Never commit secrets.** `.env`, `.admin-token`, and `chain/solana/.devnet-deployer.json` are gitignored. Do not hardcode keys, tokens, or private keys anywhere.
7. **EVM funds must stay isolated:** one `CampaignEscrow` per campaign via the factory. Do not commingle.
8. **Separation of duties on release:** the approver key calls `recordProof`; a distinct authority key calls `release`. Never let one key do both.

## Repository map

| Path | What it is |
| --- | --- |
| `app/src/` | React SPA: `pages/`, `components/`, `wallet/` (wagmi), `contracts.ts` (on-chain addresses + ABIs), `legal.ts` |
| `app/worker/index.ts` | The Worker: JSON API, admin/diligence endpoints, news ingestion, cron |
| `app/db/` | D1 `schema.sql` plus incremental migrations `p2.sql`, `p3.sql`, `p4.sql` (apply in order) |
| `app/coming-soon/` | Separate Worker serving the branded apex `aidprotocol.org` |
| `chain/evm/` | Foundry: `src/AidEscrowFactory.sol`, `src/CampaignEscrow.sol`, `test/AidEscrow.t.sol` |
| `chain/solana/` | Anchor: `programs/aid_escrow/src/lib.rs`, in-process tests in `svm-tests/tests/` |
| `chain/deployments.json` | Deployed addresses per network (keep in sync with `app/src/contracts.ts`) |
| `docs/` | Project brief, ADRs (`docs/adr/`), design system, planning artifacts |
| `packages/canonical/` | Shared canonical model types |

## Build and test

```bash
# EVM (from repo root)
docker run --rm -v "$PWD/chain:/work" -w /work/evm --entrypoint sh \
  ghcr.io/foundry-rs/foundry:stable -c "forge test && forge coverage"

# Solana
docker compose -f chain/docker/docker-compose.yml run --rm anchor \
  "anchor build && cd /work/chain/solana/svm-tests && cargo test"

# Web app + Worker
cd app && npm install && npm run build && npx wrangler deploy
```

Windows note: this repo is developed on Windows. Prefer PowerShell or `MSYS_NO_PATHCONV=1` for Docker volume mounts so paths are not mangled.

## Domain model (key concepts)

- **Campaign:** created backend-only by the core team after off-chain diligence (Model A). Has a shared id used across all chains. Lifecycle status: `active` (shown in feed), `completed`, `frozen`, `refunding` (the last three show under Past).
- **Escrow:** EVM = factory + one `CampaignEscrow` per campaign. Solana = one program + per-campaign PDA. Donations are non-custodial.
- **Proof and release:** `recordProof(tranche, hash, asset, amount)` by the approver commits a content hash and an approved amount per tranche per asset. `release` by the authority is bounded by that approved amount (no live-percentage cap).
- **Refunds:** pull-based, pro-rata over remaining (unreleased) funds, for native and tokens, once `refunding` is enabled.
- **Assets:** native (SOL/ETH) plus an allowlist of stablecoins (USDC/USDT) per chain, tracked separately.

## Conventions

- Match surrounding code style, naming, and comment density.
- TypeScript + React for the app. Solidity ^0.8.26 for EVM. Anchor (Rust) for Solana.
- The reviewer console (`/admin`) is gated by an `ADMIN_TOKEN` Worker secret (header `x-admin-token`).
- News is auto-ingested per active campaign from ReliefWeb + Google News via a cron, deduped by link, with an admin hide toggle. Only active campaigns ingest and display news.

## What not to touch without discussion

- Escrow, release, refund, or access-control logic in the contracts (open an issue first).
- Toolchain versions in `chain/docker/`.
- The Cloudflare-only constraint and the no-em-dash rule.

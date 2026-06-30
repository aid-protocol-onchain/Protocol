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

## Development method: BMad

This project uses the **BMad Method** for feature work, current and future. Plan in BMad before you build. Planning artifacts live in `docs/planning-artifacts/` (project brief, architecture spine, epics); implementation artifacts live in the implementation-artifacts folder.

- **Substantial features:** brief or PRD, then an architecture spine (`bmad-architecture`), then epics and stories (`bmad-create-epics-and-stories`, `bmad-create-story`), then implement with `bmad-dev-story`. Any contract, escrow, or release-flow change goes through this.
- **Small, well-scoped changes:** a single story or `bmad-quick-dev` is enough.
- **Trivial fixes** (copy, an obvious bug, docs): just make the change with a Conventional Commit. No ceremony required.
- The BMad agents (Winston the architect, Mary the analyst, the Solana agents Sol, Kit, and Vera, and others) and skills live in `.claude/skills/`. Run `bmad-help` to route to the right one.

Scale the ceremony to the change, but the default for anything non-trivial is: plan in BMad first, then build.

## Repository map

| Path | What it is |
| --- | --- |
| `app/src/` | React SPA: `pages/`, `components/`, `wallet/` (wagmi), `contracts.ts` (on-chain addresses + ABIs), `legal.ts` |
| `app/worker/index.ts` | The Worker: JSON API, admin/diligence endpoints, news ingestion, cron |
| `app/db/` | D1 `schema.sql` plus incremental migrations `p2.sql` through `p6.sql` (apply in order) |
| `app/coming-soon/` | Separate Worker serving the branded apex `aidprotocol.org` |
| `chain/evm/` | Foundry: `src/AidEscrowFactory.sol`, `src/CampaignEscrow.sol`, `test/AidEscrow.t.sol` |
| `chain/solana/` | Anchor: `programs/aid_escrow/src/lib.rs`, in-process tests in `svm-tests/tests/` |
| `chain/deployments.json` | Deployed addresses per network (keep in sync with `app/src/contracts.ts`) |
| `docs/` | Project brief, ADRs (`docs/adr/`), design system, planning artifacts |
| `packages/canonical/` | Shared canonical model types |
| `audit/` | Security audit reports (the Vera agent writes here) |
| `.claude/skills/` | Installed `solana-dev` skill + custom BMad agents Sol, Kit, Vera |

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

This repo is OS-agnostic: all builds, tests, and deploys run in Docker (and Wrangler), so contributors can develop on macOS, Linux, or Windows. Do not assume a host OS.

## Git and commit conventions

- **Conventional Commits.** Format `type(scope): summary`, imperative mood, lowercase, no trailing period. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Scope is a short area such as `wallet`, `auth`, `worker`, `solana`, `telegram`, `brand`, or `contracts`.
- One focused change per commit. Keep the subject under about 72 characters and put the why in the body.
- Add a `Co-Authored-By:` trailer when an AI agent helped author the change.
- Commit and push only when the user asks. Never push without explicit approval, and never force-push shared branches.
- Contributors fork and branch from `main`, then open a pull request (see [`CONTRIBUTING.md`](CONTRIBUTING.md)). Never commit secrets.

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

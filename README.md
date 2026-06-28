<div align="center">

<img src="app/public/og.jpg" alt="Aid Protocol" width="100%" />

# Aid Protocol

### A lifeline for disaster relief, on-chain.

A non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.

[![License: MIT](https://img.shields.io/badge/License-MIT-3fcf8e.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-testnet-1f8bf0.svg)](#live-deployments)
[![Chains](https://img.shields.io/badge/chains-Solana%20%C2%B7%20Ethereum%20%C2%B7%20Base-15bfb4.svg)](#live-deployments)
[![Contract coverage](https://img.shields.io/badge/contract%20coverage-%E2%89%A595%25-3fcf8e.svg)](CONTRIBUTING.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-1268c9.svg)](CONTRIBUTING.md)

[Website](https://aidprotocol.org) · [Live preview](https://dev.aidprotocol.org) · [X / Twitter](https://x.com/aidprotocol_) · admin@aidprotocol.org

</div>

> **Status: pre-launch.** Running on test networks (Sepolia, Base Sepolia, Solana devnet). No real-value funds move during testnet.

---

## Table of contents

- [Why Aid Protocol](#why-aid-protocol)
- [How it works](#how-it-works)
- [Features](#features)
- [Architecture](#architecture)
- [Live deployments](#live-deployments)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Testing and coverage](#testing-and-coverage)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why Aid Protocol

Disaster giving usually asks donors to trust a black box. Money goes in, and a receipt, if it ever arrives, is impossible to verify. Aid Protocol replaces that trust with proof. Every donation is public and on-chain, funds sit in escrow rather than someone's account, and money is released only as proof of spend is verified. The result is a donor-first lifeline where you can watch your impact, tranche by tranche.

There is no token and no DAO. Governance is an open-source repository with community pull requests reviewed and merged by a core team.

## How it works

Aid Protocol rests on three guarantees, enforced by smart contracts rather than promises:

1. **Transparency.** Every donation is written on-chain with amount, asset, campaign, and time. Donors choose to be public (with an X handle) or anonymous. Anonymous gifts are never linked to an identity.
2. **Custody you can audit.** Each campaign gets its own isolated escrow contract. Donations are non-custodial: they move from a donor's wallet into the contract, never into a company account.
3. **Release only on proof.** Funds are released in tranches. An **approver** key commits a proof hash and an approved amount per tranche, and a **separate authority** key releases up to that amount. No single key can both approve and release. If a campaign is found to be fraudulent, refunds open and donors reclaim their pro-rata remaining funds.

Requesters are vetted on **public identity only**: no KYC and no documents. The core team performs off-chain diligence on a requester's public presence, then creates the campaign on-chain.

## Features

- **Multi-chain from day one:** Solana (Anchor) and EVM (Ethereum and Base, via Foundry).
- **Multi-asset:** native SOL and ETH plus an allowlist of stablecoins (USDC, USDT), tracked separately. Leaderboards rank by Most SOL, Most ETH, and Most stable (USDC + USDT).
- **Proof-gated milestone escrow** with separation of duties and donor refunds for native coins and tokens.
- **Donor profiles and leaderboards** by wallet or X handle, with USD-normalized totals and badge tiers.
- **Requester intake, diligence, and approval** pipeline (reviewer console) that publishes a campaign across chains.
- **Per-campaign relief news**, auto-ingested from ReliefWeb and Google News for active campaigns, with editorial controls.
- **Blog-style home, live donations ticker, news, and campaign pages**, all on Cloudflare.

## Architecture

```
 Donor wallet
     │  donate (SOL / ETH / USDC / USDT, public or anonymous)
     ▼
 Per-campaign escrow                         Core team (multisig)
   EVM:    AidEscrowFactory + CampaignEscrow    │  approver key:  recordProof(tranche, hash, asset, amount)
   Solana: aid_escrow program + PDAs            │  authority key: release(tranche, amount)  (bounded by approved)
     │                                          │  enable refunds on fraud (pull, pro-rata)
     ▼
 Indexer (planned) ──▶ Cloudflare D1 (rebuildable read model) ──▶ Worker JSON API ──▶ React SPA
```

- **Smart contracts are the source of truth.** EVM uses a factory plus one isolated `CampaignEscrow` per campaign so funds never commingle. Solana uses a single upgradeable Anchor program with per-campaign PDAs.
- **The web app and API are one Cloudflare Worker** serving a Vite + React single-page app and a JSON API over D1, KV, and R2. Next.js is intentionally not used.
- **The database is a rebuildable projection.** Any displayed total can be reconstructed from chain events.

Deeper detail lives in [`docs/`](docs/) (project brief, ADRs, architecture spine) and [`AGENTS.md`](AGENTS.md).

## Live deployments

| Network | Contract | Address |
| --- | --- | --- |
| Sepolia and Base Sepolia | `AidEscrowFactory` | `0xfBfeA1576980F5E9Fd562cB13621316F0abCC461` |
| Solana devnet | `aid_escrow` program | `AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT` |

Full record in [`chain/deployments.json`](chain/deployments.json).

## Tech stack

| Layer | Technology |
| --- | --- |
| Solana | Anchor 1.0.2, Solana 3.1.10, litesvm tests |
| EVM | Solidity 0.8.26, Foundry, Slither |
| Web app | Vite, React 19, react-router, wagmi, viem |
| Backend | Cloudflare Workers, D1, KV, R2, Cron Triggers |
| Tooling | Docker (pinned toolchains), Wrangler |

## Repository layout

```
app/                 Cloudflare Worker + React SPA (the site and JSON API)
  src/               React app (pages, components, wallet, contracts.ts)
  worker/            Worker entry: API, admin, news ingestion, cron
  db/                D1 schema + incremental migrations
  coming-soon/       Branded apex (aidprotocol.org) worker
chain/
  evm/               Foundry: AidEscrowFactory + CampaignEscrow
  solana/            Anchor: aid_escrow program + litesvm tests
  docker/            Pinned toolchain images (anchor, foundry)
  deployments.json   Deployed addresses per network
docs/                Project brief, ADRs, design system, planning artifacts
packages/canonical/  Shared canonical model types
ROADMAP.md           Where the project is going
AGENTS.md            Orientation for AI agents and new contributors
```

## Getting started

Smart contracts build and test **only in Docker** (pinned toolchains), so you do not need local Rust, Solana, or Foundry.

```bash
# EVM: build, test, coverage (must stay at or above 95%)
docker run --rm -v "$PWD/chain:/work" -w /work/evm --entrypoint sh \
  ghcr.io/foundry-rs/foundry:stable -c "forge test && forge coverage"

# Solana: build + in-process litesvm tests
docker compose -f chain/docker/docker-compose.yml run --rm anchor \
  "anchor build && cd /work/chain/solana/svm-tests && cargo test"
```

```bash
# Web app + API (Cloudflare)
cd app
cp ../.env.example ../.env   # fill in your own values
npm install
npm run build
npx wrangler deploy
```

The app expects a Cloudflare account with a D1 database, KV namespace, and R2 bucket (see [`app/wrangler.toml`](app/wrangler.toml)) and an `ADMIN_TOKEN` Worker secret for the reviewer console.

## Testing and coverage

Smart contracts cannot afford failures, so the bar is strict and enforced in review:

- **Contract coverage: 95% minimum, 100% preferred.** A change that drops contract coverage below 95% will not be merged.
- EVM runs `forge coverage` and Slither. Solana runs the litesvm suite and `cargo audit`. No new findings.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full quality bar.

## Roadmap

The build sequence and what is shipped versus planned live in [`ROADMAP.md`](ROADMAP.md), derived from the epic breakdown in [`docs/planning-artifacts/epics.md`](docs/planning-artifacts/epics.md).

## Documentation

Start with [`docs/README.md`](docs/README.md) for an index. Highlights:

- [Project brief](docs/project-brief.md)
- Architecture decision records: [`docs/adr/`](docs/adr/)
- [Architecture spine](docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md)
- [Epic breakdown](docs/planning-artifacts/epics.md)
- [Design system](docs/design-system.md)
- [AGENTS.md](AGENTS.md) for AI agents and new contributors

## Contributing

Pull requests are how this project grows. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. In short: keep contract coverage at or above 95%, build and test contracts in the provided Docker images, deploy the frontend to Cloudflare (no Next.js), and use no em dashes in user-facing copy.

## Security

Report vulnerabilities privately to admin@aidprotocol.org. Do not open a public issue. See [`SECURITY.md`](SECURITY.md).

## License

Released under the [MIT License](LICENSE).

---

<div align="center">

Built as a public good. Donations are voluntary gifts, currently on testnet only.

</div>

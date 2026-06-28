<div align="center">

# Aid Protocol

**A lifeline for disaster relief, on-chain.**

A non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.

[aidprotocol.org](https://aidprotocol.org) · [dev.aidprotocol.org](https://dev.aidprotocol.org) · [@aidprotocol_](https://x.com/aidprotocol_) · admin@aidprotocol.org

</div>

> Status: pre-launch, running on test networks (Sepolia, Base Sepolia, Solana devnet). No real-value funds move during testnet.

## What this is

Disaster giving usually asks donors to trust a black box. Aid Protocol replaces that trust with proof:

- **Every donation is on-chain.** Anyone can see who gave, how much, and when. Donors choose to be public (with an X handle) or anonymous.
- **Funds sit in escrow, not someone's wallet.** Each campaign gets its own isolated escrow contract. Money is non-custodial: it goes from a donor's wallet into the contract.
- **Money releases only against proof.** Funds are released in tranches. An approver commits a proof hash and an approved amount per tranche, and a separate authority key releases up to that amount. No single key can both approve and release (separation of duties).
- **Fraud has a remedy.** If a campaign is found to be a scam, refunds are enabled and donors claim their pro-rata remaining funds (pull-based, donor pays gas), for native coins and tokens alike.
- **Requesters are vetted on public identity, not paperwork.** No KYC and no documents. The core team does off-chain diligence on a requester's public presence, then creates the campaign.

There is no token and no DAO. Governance is an open-source repository with community pull requests reviewed and merged by a core team.

## Live deployments (testnet)

| Network | Contract | Address |
| --- | --- | --- |
| Sepolia + Base Sepolia | AidEscrowFactory | `0xfBfeA1576980F5E9Fd562cB13621316F0abCC461` |
| Solana devnet | aid_escrow program | `AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT` |

Full record in [`chain/deployments.json`](chain/deployments.json).

## Architecture at a glance

```
Donor wallet ──▶ per-campaign escrow (Solana program / EVM factory + escrow)
                      │  donate (SOL/ETH/USDC/USDT, public or anonymous)
                      │  recordProof(tranche, hash, asset, amount)   [approver key]
                      │  release(tranche, amount)                    [authority key]
                      │  refund (pull, pro-rata) when fraud is found
                      ▼
        Indexer (planned) ──▶ Cloudflare D1 read model ──▶ Web app (Cloudflare Workers)
```

- **Smart contracts** are the source of truth. EVM uses a factory plus one isolated `CampaignEscrow` per campaign (funds never commingle). Solana uses a single upgradeable Anchor program with per-campaign PDAs.
- **Multi-asset:** native SOL and ETH, plus whitelisted stablecoins (USDC, USDT) on each chain, tracked separately. Leaderboards rank by Most SOL, Most ETH, and Most stable (USDC + USDT summed).
- **Frontend and backend** are a single Cloudflare Worker serving a React (Vite) single-page app plus a JSON API over D1, KV, and R2. Next.js is intentionally not used.
- The D1 tables are a rebuildable read model. On-chain is canonical.

See [`docs/`](docs/) for the project brief, ADRs, design system, and the architecture spine. New contributors and AI agents should start with [`AGENTS.md`](AGENTS.md).

## Repository layout

```
app/                 Cloudflare Worker + React SPA (the site and JSON API)
  src/               React app (pages, components, wallet)
  worker/            Worker entry: API, admin, news ingestion, cron
  db/                D1 schema + incremental migrations (schema.sql, p2..p4.sql)
  coming-soon/       Branded apex (aidprotocol.org) worker
chain/
  evm/               Foundry project: AidEscrowFactory + CampaignEscrow (Solidity)
  solana/            Anchor workspace: aid_escrow program + litesvm tests
  docker/            Pinned toolchain images (anchor, foundry)
  deployments.json   Deployed addresses per network
docs/                Project brief, ADRs, design system, planning artifacts
packages/canonical/  Shared canonical model types
```

## Quick start

Smart contracts build and test **only in Docker** (pinned toolchains), so you do not need local Rust, Solana, or Foundry.

```bash
# EVM: build, test, coverage (must stay >= 95%)
cd chain/evm
docker run --rm -v "$PWD/..:/work" -w /work/evm --entrypoint sh \
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

## Contributing

Pull requests are welcome and are how this project grows. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. The short version:

- Smart contract changes must keep coverage at **95% minimum (100% preferred)** and pass Slither (EVM) and cargo-audit (Solana) with no new findings.
- Build and test contracts in the provided Docker images.
- The frontend deploys to Cloudflare. Do not introduce Next.js.
- No em dashes in any user-facing copy.

## Security

Found a vulnerability? Please report it privately. See [`SECURITY.md`](SECURITY.md). Do not open a public issue for security problems.

## License

See [`LICENSE`](LICENSE).

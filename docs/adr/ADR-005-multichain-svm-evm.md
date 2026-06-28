# ADR-005 — Multi-Chain Support: Solana (SVM) + Ethereum (EVM)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Enrique, Mary (Analyst)
- **Related:** [Project Brief](../project-brief.md) (D1, D2, D14), ADR-001 (escrow), ADR-002 (donor identity)

---

## Context

Donors hold assets across different ecosystems. Restricting to one chain leaves capital on the table and excludes whole donor communities. Enrique requires **both Solana (SVM)** and **Ethereum (EVM)** supported from v1, with **smart contracts on both** chains.

The challenge: Solana and EVM have fundamentally different account/storage and programming models (PDAs + Rust/Anchor vs. contract storage + Solidity). The donor-identity, escrow, leaderboard, and proof-of-spend features must present a **unified product** over **heterogeneous chains**.

## Decision

**Replicate the on-chain core per chain; unify off-chain.**

1. **Per-chain contracts, same logical contract:**
   - **Solana:** Anchor program implementing the escrow + proof-gated release (ADR-001) and `DonorProfile` PDAs (ADR-002).
   - **EVM:** Solidity contracts implementing the equivalent escrow + release logic and donor records (contract storage / mappings; emit events for indexing).
   - Each campaign is **anchored to a single chain**; a donation settles natively on that chain (no per-donation bridging — see Out of Scope).

2. **Unified off-chain aggregation layer (Cloudflare Workers + indexer, ADR-006):**
   - Indexes both chains (Solana via RPC/Geyser/Helius-style; EVM via logs/events).
   - Aggregates a donor's contributions **across chains and wallets** into one identity/leaderboard view.
   - Powers public profiles, per-cause leaderboards, and badge computation chain-agnostically.

3. **Chain-aware identity (extends ADR-002):**
   - `DonorProfile` is per-wallet, per-chain (PDA on Solana, mapping entry on EVM).
   - The `TwitterIdentity` aggregation layer links wallets **from either chain** under one handle; badge level reflects **combined cross-chain** giving.

4. **Per-chain token registry:** curated allowlist per chain — SOL + registered SPL tokens (Solana); ETH + registered ERC-20 (EVM). Stablecoins (USDC, available on both) preferred for settlement (brief Q-D).

5. **Campaign creation specifies its chain** (or a campaign may run parallel addresses on both); donor picks the chain matching their wallet.

## Consequences

**Positive**
- Meets donors where their assets are; maximizes addressable capital.
- Per-chain contracts keep each implementation idiomatic and auditable.
- Off-chain unification means one product UX over two chains.

**Negative / costs**
- **Two contract codebases** to build, audit, and maintain (Rust/Anchor + Solidity) — real, ongoing cost.
- Indexer must handle two very different data models and finality characteristics.
- Cross-chain value normalization (USD-equivalent at donation time) needed for fair leaderboards/badges.
- Higher v1 scope; P0 must decide whether to ship **one chain first** then fast-follow the second, or both in parallel.

## Open Questions — RESOLVED 2026-06-27

- **OQ-1:** ✅ P0 ships **both chains in parallel** (not Solana-first).
- **OQ-2:** ✅ EVM target = **Ethereum mainnet + Base (L2)** both; canonical model already handles multiple EVM chainIds.
- **OQ-3:** ✅ Value normalization = **off-chain price feed (Pyth/CoinGecko) stamped at index time**; no on-chain oracle (consistent with AD-2 projection model).

## Alternatives Considered

- **Solana-only** — rejected per D14 (requested multi-chain).
- **Single donation bridged across chains** — rejected: added complexity, bridge risk, and unnecessary; aggregation is an off-chain concern.
- **Chain-abstraction framework hiding the chain entirely** — deferred: premature; explicit per-chain campaigns are simpler and auditable for v1.

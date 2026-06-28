# ADR-002 — Donor Identity, Reputation & Badges

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Enrique, Mary (Analyst)
- **Related:** [Project Brief](../project-brief.md) (D11, D12), ADR-001

---

## Context

The donor side needs a durable identity and reputation layer to power: a **per-cause leaderboard**, a **badge system** that grows with cumulative giving (forever, on-chain), a **Twitter share image generator**, and **public, searchable donor profiles** ("how much, which causes"). Donors may give **anonymously or publicly**.

Open design question raised: store donor data as **NFTs**, as a **PDA in the contract**, keyed by **wallet** or by **Twitter** — or some combination? Can one Twitter map to **multiple wallets**?

## Decision

**Separate the two jobs — record vs. trophy.**

1. **PDA is the source of truth.** A `DonorProfile` PDA, seeded by **wallet pubkey**, stores cumulative donated amount, causes contributed to, timestamps, and derived badge level. PDAs are cheap, **updatable** (totals accumulate forever), and queryable via deterministic seeds + public read methods.

2. **Two-layer identity model:**
   ```
   TwitterIdentity PDA   ← seed: hash(twitter handle)
      • aggregates totals across all linked wallets
      • holds badge level, public profile, vanity URL
           ▲ links (1-to-many)
   DonorProfile PDA      ← seed: wallet pubkey
      • per-wallet: total donated, causes, timestamps
   ```
   - **Wallet is the atomic unit** — a `DonorProfile` always exists, even for anonymous donors who never link Twitter.
   - **Twitter is an optional aggregation layer** — one handle can link **multiple wallets**; their totals + badges combine into one public profile.
   - **Linking proof:** wallet ownership via signature (already present); Twitter ownership proven once via a one-time code / backend oracle attestation.

3. **Badges are derived, not stored as the primary asset.** Badge tier = a function of cumulative donated value, computed from PDA data.

4. **Sharing uses an off-chain image generator** that *reads* the PDA and renders a badge card for Twitter. **No NFT required** for sharing.

5. **Soulbound NFTs are deferred to P4** (D12). If/when minted, they are **non-transferable trophies minted from the PDA truth** — never the data store. Non-transferability is mandatory, else "proof of who they are" could be bought/sold.

6. **Searchability:** deterministic PDA seeds allow direct lookup of any wallet or handle; an **off-chain indexer** powers leaderboards and profile pages while on-chain remains the truth.

## Consequences

**Positive**
- Cheap, mutable, forever-growing donor record without per-update mint costs.
- Anonymous donors fully supported (wallet-only profile, still on the leaderboard).
- Multi-wallet-per-Twitter "just works" via the aggregation PDA.
- NFT delight layer can be added later with zero rework to the data model.

**Negative / costs**
- Leaderboards/profiles need an off-chain indexer (operational component).
- Twitter linking requires a backend oracle / attestation flow.
- Badge-tier thresholds and value normalization across SOL/SPL tokens must be defined.

## Open Questions — RESOLVED 2026-06-27

- **OQ-1:** ✅ Badge tiers = **fixed named USD thresholds** (Supporter $10 / Bronze $100 / Silver $500 / Gold $2.5k / Platinum $10k); donations USD-normalized **off-chain at index time** (Pyth/CoinGecko).
- **OQ-2:** ✅ Indexing = **Helius (Solana) + Alchemy (EVM) webhooks → Cloudflare Queues → Worker → D1**, idempotent.
- **OQ-3:** ✅ Public profiles at **`/u/<twitter-handle>`** (linked) and **`/w/<wallet>`** (unlinked), served from the D1 projection by a Worker.

## Alternatives Considered

- **NFT as source of truth** — rejected: NFTs can't cheaply mutate a running total; soulbound-NFT-per-update is wasteful.
- **Twitter-only identity** — rejected: breaks anonymous giving and wallet-native UX.
- **Wallet-only (no Twitter)** — rejected as the *whole* model: loses multi-wallet aggregation and social/viral reach; retained as the default *base* layer.

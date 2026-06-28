# Project Brief — Aid Protocol

> **BMAD Phase:** Analysis · **Author:** Mary (Business Analyst) · **Prepared for:** Enrique
> **Date:** 2026-06-27 · **Status:** Draft v0.1 (discovery complete, open questions flagged)

---

## 1. Executive Summary

**Aid Protocol** is a transparency-first disaster-relief funding platform built on **Solana**. When a disaster strikes — like the recent Venezuela earthquake — vetted requesters open a relief campaign, and anyone in the world can contribute **SOL or any registered SPL token**. Every contribution is recorded **on-chain by a smart contract**, producing a permanent, public ledger of who gave what and where it went. Donors may give **anonymously or publicly** (e.g. broadcasting their contribution to X/Twitter).

The platform's defining promise is **accountability**: funded parties must continuously prove how the money is spent through **images and videos passed through AI filtering** before publication. Campaigns and proof-of-spend live on a **blog-style landing page** that interleaves active relief efforts with news coverage of the disaster.

Aid Protocol is **not a DAO**. It is governed like an open-source project: a **public repository, human-managed**, with **CI/CD** enabling community contribution via ideas and pull requests that the core team reviews and merges.

---

## 2. Problem Statement

When disasters occur, the gap between *donor generosity* and *verified impact* is enormous:

- **Donors can't see where money goes.** Traditional giving platforms and NGOs offer little to no real-time, itemized proof that funds reached the ground and were used as intended.
- **Needs are broader than "food."** Real disaster response requires fuel/gas for rescue operations, body recovery, equipment, and reconstruction — needs that generic donation drives rarely articulate or track.
- **Trust is fragile and fraud is common.** Fake campaigns, misappropriated funds, and unverifiable "proof" erode donor confidence and suppress giving.
- **Intermediaries are opaque.** Money passes through layers of organizations with no immutable record of the chain of custody.

**Aid Protocol's thesis:** if every dollar (lamport) is recorded immutably on-chain and every expenditure must be *visually proven and AI-screened*, donor trust — and therefore giving — increases.

---

## 3. Vision & Mission

- **Vision:** A world where disaster-relief giving is fully transparent and every contribution's impact is provable.
- **Mission (v1):** Give donors an undeniable, real-time view of how their funds are spent — backed by an immutable on-chain ledger and verified proof-of-spend.

---

## 4. Target Users

> **Primary focus for v1: DONORS.** Their right to know how funds are spent is the product's core. All v1 design decisions optimize the donor experience first.

| Persona | Role | Primary Need | Priority |
|---|---|---|---|
| **Donor** | Gives SOL/SPL tokens to campaigns | See exactly how funds are spent; give anonymously or publicly; trust the campaign is real | **P0 — v1 focus** |
| **Requester (Official source / NGO / Company / Individual)** | Opens and runs a relief campaign | Get verified, receive funds, report spending easily | P1 — required to make donor side meaningful |
| **Verifier / Core team** | Runs diligence + KYC, approves campaigns, reviews PRs | Efficient vetting; fraud prevention; community governance | P1 — operational backbone |
| **Public / News reader** | Browses the landing page | Discover disasters, follow impact, read news | P2 |

---

## 5. Core Capabilities (Scope)

### 5.1 In Scope (v1 direction)

1. **On-chain contribution ledger (Solana smart contract / program)**
   - Accepts **SOL and any registered SPL token**.
   - Records each contribution immutably: amount, token, campaign, timestamp.
   - Routes collected funds to the campaign's final destination wallet.
   - Supports **anonymous** or **public** giving (donor opt-in to attach identity / social broadcast).

2. **Donor experience (P0)**
   - Browse active disasters and campaigns.
   - Contribute via Solana wallet.
   - View **proof-of-spend feed** per campaign (images/videos + on-chain spend records).
   - Optional public broadcast of a contribution (e.g. share to X/Twitter).

3. **Requester onboarding & verification**
   - Application flow to request help for a registered disaster.
   - **Diligence + KYC** gate before a campaign goes live.
   - **Public requester identity** (company or person) displayed on the campaign.

4. **Accountability / proof-of-spend reporting**
   - Funded parties post **images and videos** showing how money was spent.
   - **AI filtering** screens uploads before publication (see Open Question C).
   - Continuous update cadence expected of funded campaigns.

5. **Blog-style landing page**
   - Interleaves relief campaigns with **news coverage** of the disaster.
   - Public, discoverable, content-rich front door to the platform.

6. **Open-source governance & ops**
   - **Public repository**, human-managed (no DAO, no governance token).
   - **CI/CD** pipeline enabling community contributions.
   - Ideas and **PRs reviewed and merged by the core team**.

### 5.2 Explicitly Out of Scope (v1)

- ❌ DAO / on-chain governance / governance token.
- ❌ Fiat on-ramp (crypto-native for v1; revisit later).
- ❌ Chains beyond Solana + EVM/Ethereum (e.g. Bitcoin, Cosmos) — out for v1.
- ❌ Cross-chain *bridging* of a single donation (each donation settles on its own chain; aggregation is off-chain).
- ❌ Automated/algorithmic fund allocation (humans vet and approve).
- ❌ **Next.js** and any framework that can't deploy cleanly to Cloudflare (D13).

---

## 6. Key Decisions Locked

| # | Decision | Rationale |
|---|---|---|
| D1 | **Multi-chain: Solana (SVM) + Ethereum (EVM)** | Both chains supported from v1. Smart contracts on both: a Solana program and EVM/Solidity contracts. Meets donors where their assets already live. → ADR-005 |
| D2 | **Accepts SOL + registered SPL tokens (Solana) and ETH + registered ERC-20 (EVM)** | Flexibility for donors on either chain; platform curates a per-chain token registry. |
| D3 | **Donor-first product** | Donor's right to transparency is the core value proposition. |
| D4 | **No DAO — open-source human governance** | Trust via radical openness + immutable ledger, not token voting. |
| D5 | **CI/CD + community PRs, core-team merge** | Scales contribution while keeping a quality/security gate. |
| D6 | **Mandatory KYC + diligence for requesters** | Fraud prevention; public requester identity. |
| D7 | **AI-filtered proof-of-spend (images/video)** | Continuous, verifiable accountability to donors. |
| D8 | **Blog-style landing page w/ news** | Context + discovery + engagement around each disaster. |
| D9 | **Escrow + proof-gated milestone release** (not direct payout) | Caps a scammer's reach to one small tranche; ties unlocks to proof-of-spend. → ADR-001 |
| D10 | **No KYC in v1 — public-identity tiers (L1/L2)** | Lighter legal load, on-brand transparency, individual-friendly. → ADR-004 |
| D11 | **Donor identity = PDA as source-of-truth; two-layer wallet↔Twitter** | Cheap, updatable, queryable cumulative record; Twitter optionally aggregates multiple wallets. → ADR-002 |
| D12 | **Soulbound badge NFTs deferred to P4** | Cosmetic flex layer; gated on having a proper artist. Must be non-transferable. → ADR-002 |
| D13 | **Frontend deploys to Cloudflare; NO Next.js** | Hard constraint. Client on Cloudflare Pages; backend/oracle/indexer/image-gen on Cloudflare Workers + the CF data stack (D1/KV/R2/Queues/Workers AI). → ADR-006 |
| D14 | **Multi-chain from v1 (SVM + EVM)** | Off-chain indexer + identity layer aggregate across both chains; each chain runs its own escrow + ledger contract. → ADR-005 |

---

## 6b. Technical Constraints (non-negotiable)

| Constraint | Detail | Source |
|---|---|---|
| **Frontend host** | Client **must** deploy to **Cloudflare** (Pages). | D13 |
| **No Next.js** | Explicitly excluded. Use a Cloudflare-native client (e.g. **Vite + React SPA on Pages**; Remix/Astro on Workers acceptable if needed). | D13 |
| **Backend / edge** | **Cloudflare Workers** for API, oracle (Twitter link), indexer endpoints, and the badge **image generator**. CF data stack: **D1** (SQL), **KV**, **R2** (media), **Queues**, **Workers AI** (candidate for AI-filtering, ADR-003). | D13 |
| **Chains** | **Solana program (Rust/Anchor)** + **EVM contracts (Solidity)** for Ethereum. Both first-class. | D1, D14, ADR-005 |
| **Identity is chain-aware** | `DonorProfile` exists per chain (PDA on Solana, contract storage/mapping on EVM); the off-chain identity layer aggregates a donor's wallets **across both chains** and optionally under one Twitter. | ADR-002, ADR-005 |

---

## 7. Open Questions (to resolve in next phase)

> These were not yet decided in discovery. Each carries Mary's **recommended default** so we can move forward without blocking.

| ID | Open Question | Mary's Recommended Default |
|---|---|---|
| **Q-A** | ~~Who **operates KYC + diligence**?~~ | ✅ **RESOLVED (D10 / ADR-004):** No KYC in v1. Public-identity tiers (L1 social / L2 public-entity), human core-team sign-off. KYC kept as optional future "verified" badge for large orgs. |
| **Q-B** | ~~What exactly does **AI filtering** do?~~ | ✅ **RESOLVED (ADR-003):** Both — two stages (moderation + authenticity) on **Cloudflare Workers AI** with human fallback; only a PASS emits the on-chain proof signal that gates release. Live streams moderated with delay; archived recording runs the full pass. |
| **Q-C** | ~~Where do funds ultimately **settle**?~~ | ✅ **RESOLVED (D9 / ADR-001):** Escrow with proof-gated milestone release; tranche size scales to requester identity tier. Pause/clawback authority can freeze + redirect undisbursed funds. |
| **Q-D** | **Token registry governance** — who approves which SPL tokens are accepted, and how is price/volatility handled? | Core-team-curated allowlist; prefer **stablecoins (USDC)** as the default settlement asset to protect victims from volatility. |
| **Q-E** | **Anonymous-but-KYC'd** — donors can be anonymous, but are *requesters* ever anonymous? | **No.** Requester identity always public (per your stated requirement); only donors may be anonymous. |
| **Q-F** | **Regulatory posture** — handling money for disaster relief across borders raises AML/charity-registration questions. | Flag early; may need a foundation/legal entity. Out of v1 build scope but a real risk to track. |

---

## 8. Competitive & Reference Landscape

| Platform | What it does | How Aid Protocol differs |
|---|---|---|
| **The Giving Block** | Crypto donations to nonprofits | Aid Protocol adds **mandatory, AI-verified proof-of-spend** and a public on-chain donor ledger per disaster. |
| **Endaoment** | On-chain DAF / nonprofit giving | Aid Protocol is **disaster-specific**, donor-transparency-first, and **not a DAO**. |
| **GiveDirectly** | Direct cash transfers, strong evidence base | Aid Protocol is **crypto-native + on-chain transparent**, open to vetted requesters beyond a single org. |
| **Gitcoin / Giveth** | Crypto public-goods funding, often DAO/quadratic | Aid Protocol deliberately **avoids DAO mechanics**; human-governed open source. |
| **GoFundMe** | Mainstream fiat crowdfunding | Aid Protocol adds **immutable ledger + enforced proof-of-spend**; no opaque payout. |

**Differentiator in one line:** *The only disaster-relief platform where every contribution is on-chain and every expenditure must be visually proven and AI-screened.*

---

## 9. Success Metrics (early hypotheses)

- **Donor trust:** % of campaigns with up-to-date proof-of-spend; donor repeat-giving rate.
- **Transparency coverage:** % of disbursed funds with linked, AI-passed proof media.
- **Throughput:** time from disaster → live vetted campaign.
- **Integrity:** fraud/chargeback/flagged-campaign rate kept near zero.
- **Community governance health:** PR throughput, contributor count, merge latency.

---

## 10. Risks & Constraints

| Risk | Severity | Note |
|---|---|---|
| **Regulatory / AML / charity law** across jurisdictions | High | Cross-border money movement for "aid" is heavily regulated. Needs legal review (Q-F). |
| **Fraudulent requesters** despite KYC | High | KYC + diligence + escrow + proof-of-spend are layered defenses. |
| **AI-filter false negatives** (deepfaked proof) | Medium-High | Authenticity detection is an arms race; pair with human review. |
| **Token volatility** harming victims | Medium | Prefer stablecoin settlement (Q-D). |
| **Graphic content** harm/liability | Medium | Moderation pipeline mandatory (Q-B). |
| **Key/wallet security** for fund routing | High | Escrow/program audits required. |

---

## 11. Phased Roadmap (build sequence)

> Principle: each phase ships something usable and de-risks the next. We do **not** build it all at once. The money rail comes first because everything else is worthless if funds aren't trustworthy.

| Phase | Ships | Rationale |
|---|---|---|
| **P0 — The money rail** | Solana program: contribution ledger + **escrow with proof-gated milestone release** (ADR-001); SOL + registered SPL support; pause/clawback authority | The core product. If fund flow isn't trustworthy, nothing else matters. |
| **P1 — Requester trust** | Public-identity verification L1/L2 (ADR-004), campaign creation, **AI-filtered proof-of-spend** feed (ADR-003) | Makes campaigns real and safe to fund. |
| **P2 — Donor flywheel** | `DonorProfile` PDAs, cumulative stats, **per-cause leaderboard**, **badge tiers** (derived), **Twitter share image generator** | Viral + retention engine, built on P0 data. |
| **P3 — Identity & profiles** | `TwitterIdentity` PDA, **multi-wallet aggregation**, public searchable profile pages, reputation graduation (better unlocks for proven actors) | Ties social identity to on-chain history. |
| **P4 — Flex layer (optional)** | **Soulbound** badge NFTs (D12), richer profile customization | Pure delight; gated on a proper artist; only after the core loop works. |
| **Cross-cutting** | Blog/news landing page (D8); open-source repo + CI/CD + community-PR governance (D4/D5) | Front door + how the project is run; evolves throughout. |

**Donor-identity data model (P2–P3), settled:**
- **PDA = source of truth** (cumulative donations, causes, badge level) — cheap, updatable, queryable via public methods.
- **Off-chain image generator** renders the shareable badge card (reads the PDA; no NFT required).
- **Two-layer identity:** `DonorProfile` PDA per wallet (atomic, works anonymously) → optional `TwitterIdentity` PDA aggregating many wallets under one handle.
- **Soulbound NFT** is an optional P4 trophy *minted from* the PDA truth — never the data store, never transferable.

---

## 12. Recommended Next BMAD Steps

1. **Architecture Decision Records (ADRs)** — resolve the highest-leverage open questions as durable decisions, especially:
   - **ADR-001:** Direct payout vs. **escrow + milestone proof-gated release** (Q-C).
   - **ADR-002:** Token registry & **stablecoin settlement** policy (Q-D).
   - **ADR-003:** **AI-filtering pipeline** — authenticity + moderation stages (Q-B).
   - **ADR-004:** **KYC/diligence** provider & workflow (Q-A).
2. **PRD / Epics & User Stories** — once core decisions are set, break v1 into epics (Donor flow, Requester onboarding, Smart-contract/program, Proof-of-spend feed, Landing/news CMS, Governance/CI-CD).
3. **Technical research / feasibility** — Solana program design, SPL token registry, on-chain↔off-chain proof linkage, AI-filtering stack.

**Mary's recommendation:** Do the **ADRs next** (specifically ADR-001 escrow and ADR-003 AI filtering) — they unblock everything downstream and define the trust architecture that *is* the product.

---

*Prepared in the BMAD Method · Analysis phase · This brief is a living document; open questions Q-A through Q-F should be closed before PRD.*

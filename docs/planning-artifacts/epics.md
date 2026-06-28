---
stepsCompleted: ["step-01", "step-02", "step-03"]
inputDocuments:
  - docs/project-brief.md
  - docs/adr/ADR-001-escrow-proof-gated-release.md
  - docs/adr/ADR-002-donor-identity-reputation.md
  - docs/adr/ADR-003-ai-proof-filtering-pipeline.md
  - docs/adr/ADR-004-public-identity-verification.md
  - docs/adr/ADR-005-multichain-svm-evm.md
  - docs/adr/ADR-006-frontend-cloudflare-no-nextjs.md
  - docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md
  - docs/design-system.md
---

# Aid Protocol - Epic Breakdown

## Overview

This document decomposes Aid Protocol requirements into implementable epics and stories. There is no standalone PRD; requirements are drawn from the project brief, the six ADRs, the architecture spine, and the design system. Epics are ordered for the P0 build sequence: foundations first, then the on-chain money rail, then the projection layer, then the donor and requester experiences, then accountability, identity, content, and governance.

## Requirements Inventory

### Functional Requirements

FR1: Donors can browse active disasters on a public blog-style home and feed.
FR2: Donors can open a campaign detail page showing progress, the on-chain donation ledger, the requester identity tier, and the proof-of-spend feed.
FR3: Donors can contribute SOL or a registered SPL token on Solana, and ETH or a registered ERC-20 on Ethereum mainnet and Base, from a connected wallet.
FR4: Donors can give publicly (attach a handle or social identity) or anonymously.
FR5: Every contribution is recorded immutably on-chain with amount, token, campaign, and timestamp.
FR6: Funds are held in escrow and released in milestone tranches; the first tranche is sized by requester identity tier (L2 40 percent, L1 15 percent, new or thin tier a small fixed cap near 250 USD).
FR7: A later tranche unlocks only after the prior tranche proof-of-spend passes the AI pipeline.
FR8: Requesters can apply to open a campaign for a registered disaster; requester identity is always public; no KYC in v1.
FR9: Requesters are verified by public-identity tiers (L1 social, L2 public entity) with core-team plus trusted-reviewer sign-off before a campaign goes live.
FR10: Funded parties post proof-of-spend media (images, recorded video, live streams) tied to a tranche.
FR11: Proof media passes AI authenticity and moderation (Cloudflare Workers AI with human fallback) before publish; only a pass emits the on-chain proof signal that gates release.
FR12: A core-team multisig (Squads on Solana, Safe on EVM) can freeze a campaign and redirect undisbursed escrow to another verified campaign for the same disaster.
FR13: Each donor has an on-chain record (PDA on Solana, mapping on EVM); the off-chain layer aggregates a donor wallets across chains, optionally under one Twitter handle.
FR14: Donor badge tiers are derived from cumulative USD-normalized giving using fixed thresholds (Supporter, Bronze, Silver, Gold, Platinum).
FR15: Public donor profiles are served at /u/<twitter-handle> for linked donors and /w/<wallet> for unlinked wallets, showing totals, causes, and badges.
FR16: A donor leaderboard ranks donors by USD-normalized cross-chain giving with a per-cause filter; anonymous gifts are excluded.
FR17: A news surface interleaves relief updates and disaster coverage, with updates linking to their campaign.
FR18: A live donations ticker shows recent contributions across campaigns.
FR19: Donors can share a generated badge card image to Twitter.
FR20: The token registry is core-team curated per chain; USDC is the default settlement asset; donations are normalized to USD at donation time.
FR21: An off-chain indexer ingests Solana and EVM events into the canonical model, and the read API serves only the canonical model.

### NonFunctional Requirements

NFR1: The frontend deploys to Cloudflare; Next.js is forbidden. The app is a Vite plus React SPA; the content surface uses Astro.
NFR2: All server logic runs on Cloudflare Workers; data, media, and AI use D1, KV, R2, Queues, and Workers AI.
NFR3: On-chain is the financial source of truth; D1 is a rebuildable projection, and any displayed total must be reconstructable from chain data.
NFR4: Chain SDKs are isolated behind adapters; no code above the adapter layer imports a chain SDK.
NFR5: Smart contracts build and test only inside pinned Docker images, and CI uses the same images.
NFR6: Multi-chain from v1: Solana via Anchor, EVM via Solidity and Foundry, on Ethereum mainnet and Base.
NFR7: Indexing is idempotent, keyed on chain, transaction signature, and log index.
NFR8: The UI is responsive (mobile-first navigation) and accessible (semantic markup, keyboard support, reduced-motion handling).
NFR9: Stablecoin-preferred settlement protects recipients from volatility.
NFR10: No DAO; an open-source repository with human governance, CI/CD, and community pull requests merged by the core team.
NFR11: Content carries no em dashes and follows the lifeline brand and design tokens.
NFR12: Escrow and program audits are required before any mainnet handling of real funds.

### Additional Requirements

- Monorepo layout per the spine source tree: chain, edge, app, web, packages/canonical, docs.
- Pinned Docker toolchain images for Anchor and Foundry under chain/docker.
- A canonical model package (packages/canonical) holding shared types and id helpers, with no chain SDK imports.
- Indexer Workers wired as webhook to Queues to Worker to D1 (Helius for Solana, Alchemy for EVM).
- A Twitter ownership oracle Worker using a one-time-code attestation.
- A badge image generator Worker that reads the canonical model.
- A price feed integration (Pyth or CoinGecko) that stamps USD value at index time.
- Multisig setup with Squads (Solana) and Safe (EVM) holding the pause and clawback authority.
- Cloudflare bindings and secrets management; token registries stored in KV.

### UX Design Requirements

UX-DR1: Apply the lifeline brand: the logo mark plus the AID PROTOCOL wordmark, with the brand gradient used for progress bars, the hero accent, and key headline text.
UX-DR2: Implement the design tokens (colors, surfaces, radius, type scale) defined in docs/design-system.md.
UX-DR3: Responsive navigation with a hamburger menu below 560px so every page is reachable on mobile.
UX-DR4: The dark signal hero pattern with a gradient underline.
UX-DR5: Campaign detail layout: progress, requester tier badge, proof-of-spend rows with an AI-verified pill, on-chain ledger rows with chain pills and a public or anonymous marker, and a sticky donate panel with chain selector, amount, anonymity toggle, and primary action.
UX-DR6: Leaderboard rows with rank, avatar, badge tier pill, chain mix, causes and gifts counts, and total.
UX-DR7: News list and a home news preview, each card carrying a category tag.
UX-DR8: A live donations ticker as a marquee that pauses on hover, fades at the edges, and respects reduced motion.
UX-DR9: A value pillars strip: Transparent, Secure, Global, Human, Decentralized.
UX-DR10: Swap the placeholder logo for the final brand files once provided.

### FR Coverage Map

| Requirement | Stories |
| --- | --- |
| FR1 | 5.3, 9.1 |
| FR2 | 5.3, 7.5 |
| FR3 | 2.2, 3.1, 5.1, 5.2 |
| FR4 | 2.2, 5.4 |
| FR5 | 2.2, 3.1, 4.2, 4.3 |
| FR6 | 2.4, 3.3, 6.4 |
| FR7 | 2.4, 3.3, 7.3 |
| FR8 | 6.1, 6.2 |
| FR9 | 6.2, 6.3 |
| FR10 | 7.1, 7.4 |
| FR11 | 7.2, 7.3 |
| FR12 | 2.5, 3.4, 10.3 |
| FR13 | 2.3, 8.1, 8.2 |
| FR14 | 8.4 |
| FR15 | 8.3 |
| FR16 | 8.5 |
| FR17 | 9.1, 9.2 |
| FR18 | 9.3 |
| FR19 | 8.6 |
| FR20 | 4.4, 5.5 |
| FR21 | 4.1, 4.2, 4.3, 4.5 |

## Epic List

1. Foundations and Dev Environment
2. Solana Escrow Program
3. EVM Escrow Contracts
4. Canonical Model, Indexer, and Read API
5. Donor Experience and Wallet Connect
6. Requester Onboarding and Verification
7. Proof of Spend and AI Pipeline
8. Donor Identity, Profiles, Badges, and Leaderboard
9. Content Surfaces and Brand
10. Governance, Ops, and Security

## Epic 1: Foundations and Dev Environment

Stand up the monorepo, the shared canonical package, and the Docker contract toolchains so both chains and the edge build reproducibly under CI. This epic unblocks every later epic.

### Story 1.1: Monorepo scaffold

As a developer,
I want a pnpm workspace matching the spine source tree,
So that chain, edge, app, web, and shared packages live in one reproducible repo.

**Acceptance Criteria:**

**Given** a fresh checkout
**When** I install and build the workspace
**Then** chain, edge, app, web, and packages/canonical resolve as workspaces
**And** a single command builds the whole tree without errors.

### Story 1.2: Canonical model package

As a developer,
I want a packages/canonical module with shared types and id helpers,
So that every layer speaks one model and never raw chain shapes.

**Acceptance Criteria:**

**Given** the canonical package
**When** I import it from the edge or app
**Then** Campaign, Donation, DonorProfile, and ProofItem types are available
**And** id helpers produce chain-prefixed ids such as sol and evm by chainId.

### Story 1.3: Docker contract toolchains

As a developer,
I want pinned Docker images for Anchor and Foundry,
So that contracts build and test identically on any machine and in CI (AD-10, NFR5).

**Acceptance Criteria:**

**Given** the chain/docker images
**When** I run the anchor and foundry containers
**Then** anchor and forge report their pinned versions
**And** host installs are not required to build or test.

### Story 1.4: CI pipeline

As a maintainer,
I want CI that builds, lints, and runs contract tests in the pinned images,
So that every pull request is verified the same way.

**Acceptance Criteria:**

**Given** a pull request
**When** CI runs
**Then** it builds the workspace, lints, and runs Anchor and Foundry tests inside the pinned images
**And** a red run blocks merge.

### Story 1.5: Adapter boundary guard

As a maintainer,
I want a lint rule that forbids chain SDK imports above the adapter layer,
So that chain isolation holds over time (AD-1, NFR4).

**Acceptance Criteria:**

**Given** a chain SDK import outside chain or edge/adapters
**When** lint runs
**Then** the build fails with a clear message naming the offending file.

## Epic 2: Solana Escrow Program

Implement custody, escrow, milestone release, the donor record, and clawback on Solana with Anchor.

### Story 2.1: Campaign and escrow accounts

As a requester,
I want a campaign with an escrow account,
So that donations are held until released.

**Acceptance Criteria:**

**Given** an approved campaign request
**When** create_campaign runs
**Then** an escrow account stores goal, chain, requester, tier, and first-tranche config.

### Story 2.2: Donate instruction for SOL and SPL

As a donor,
I want to donate SOL or a registered SPL token,
So that my gift reaches the campaign and is recorded on-chain.

**Acceptance Criteria:**

**Given** a connected wallet and a live campaign
**When** I donate SOL or a registered SPL token
**Then** funds move to escrow and a contribution event records amount, token, timestamp, and an anonymity flag.

### Story 2.3: Donor profile PDA accrual

As a donor,
I want my giving recorded in a profile account,
So that my totals and causes accumulate forever.

**Acceptance Criteria:**

**Given** a donation
**When** it settles
**Then** a DonorProfile PDA seeded by my wallet updates total and the set of causes.

### Story 2.4: Milestone release with proof gate

As the protocol,
I want tranches to release only against proof,
So that funds cannot be drained at once (FR6, FR7).

**Acceptance Criteria:**

**Given** an approved campaign
**When** release_tranche is called
**Then** the first tranche matches the tier size
**And** a later tranche releases only when a valid proof signal exists for the prior tranche.

### Story 2.5: Pause and clawback via Squads

As the core team,
I want a Squads multisig to freeze a campaign and redirect undisbursed escrow,
So that fraud can be contained (FR12).

**Acceptance Criteria:**

**Given** a fraud signal
**When** the Squads authority freezes and redirects
**Then** undisbursed escrow moves to another verified same-disaster campaign
**And** a non-authority caller is rejected.

### Story 2.6: Program tests in Docker

As a maintainer,
I want Anchor tests covering the flows,
So that the program is verified reproducibly.

**Acceptance Criteria:**

**Given** the pinned Anchor image
**When** anchor test runs
**Then** donate, release, freeze, and redirect paths pass.

## Epic 3: EVM Escrow Contracts

Mirror the escrow logic on Ethereum mainnet and Base with Solidity and Foundry, emitting events for indexing.

### Story 3.1: Campaign and escrow contract

As a requester,
I want an EVM escrow contract for ETH and ERC-20,
So that donations on EVM are held until released.

**Acceptance Criteria:**

**Given** a deployed contract
**When** createCampaign and donate run for ETH or a registered ERC-20
**Then** funds are escrowed and a Donation event is emitted with chainId.

### Story 3.2: Donor record mapping

As a donor,
I want my EVM giving recorded,
So that my totals accrue on EVM too.

**Acceptance Criteria:**

**Given** a donation
**When** it settles
**Then** a per-wallet mapping accrues total and causes and is readable via a view.

### Story 3.3: Milestone release with proof gate

As the protocol,
I want tier-based proof-gated release on EVM,
So that EVM matches the Solana release rules (FR6, FR7).

**Acceptance Criteria:**

**Given** an approved campaign
**When** releaseTranche is called
**Then** it reverts unless the prior tranche proof is recorded
**And** the first tranche matches the tier size.

### Story 3.4: Pause and clawback via Safe

As the core team,
I want a Safe multisig to freeze and redirect on EVM,
So that EVM has the same containment as Solana (FR12).

**Acceptance Criteria:**

**Given** a fraud signal
**When** the Safe authority freezes and redirects
**Then** undisbursed funds move to a same-disaster campaign
**And** other callers revert.

### Story 3.5: Multi-network deploy

As a maintainer,
I want deploy scripts for mainnet and Base,
So that EVM runs on both networks (NFR6).

**Acceptance Criteria:**

**Given** the deploy scripts
**When** I deploy
**Then** mainnet and Base each receive the contracts and events carry the correct chainId.

### Story 3.6: Foundry tests in Docker

As a maintainer,
I want Foundry tests covering the flows,
So that EVM contracts are verified reproducibly.

**Acceptance Criteria:**

**Given** the pinned Foundry image
**When** forge test runs
**Then** donate, release, freeze, and redirect paths pass.

## Epic 4: Canonical Model, Indexer, and Read API

Replace mock data with a rebuildable projection fed by both chains.

### Story 4.1: D1 canonical schema

As the platform,
I want a normalized D1 schema,
So that both chains land in one model (FR21, NFR3).

**Acceptance Criteria:**

**Given** the schema
**When** events are ingested
**Then** campaigns, donations, proofs, donor_profiles, and twitter_identities are populated idempotently on chain, txSig, and logIndex.

### Story 4.2: Solana indexer

As the platform,
I want a Helius webhook to Queue to Worker pipeline,
So that Solana events normalize into D1 (FR5, FR21).

**Acceptance Criteria:**

**Given** a Solana donation or release
**When** the webhook fires
**Then** the event normalizes into D1
**And** a replay does not create duplicates.

### Story 4.3: EVM indexer

As the platform,
I want an Alchemy webhook pipeline for mainnet and Base,
So that EVM events normalize into D1 (FR5, FR21).

**Acceptance Criteria:**

**Given** an EVM event on mainnet or Base
**When** the webhook fires
**Then** it normalizes into D1 with the correct chain-prefixed id.

### Story 4.4: USD price stamping

As the platform,
I want USD value stamped at index time,
So that cross-chain totals are comparable (FR20).

**Acceptance Criteria:**

**Given** a donation in any accepted token
**When** it is indexed
**Then** usd_at_donation is stamped from a price feed
**And** stablecoins pass through at face value.

### Story 4.5: Read API over the canonical model

As a client,
I want read endpoints that serve canonical data only,
So that the UI never couples to raw chain shapes (FR21).

**Acceptance Criteria:**

**Given** the read API
**When** I call campaigns, campaign detail, recent donations, leaderboard, news, or profile
**Then** each returns canonical data in the ok, data, error envelope.

### Story 4.6: Backfill and rebuild

As a maintainer,
I want to rebuild D1 from chain history,
So that the projection is provably reconstructable (NFR3).

**Acceptance Criteria:**

**Given** an empty D1
**When** the backfill runs
**Then** totals match on-chain history.

## Epic 5: Donor Experience and Wallet Connect

Wire the real donor flow on both chains to the program and contracts, replacing seed data.

### Story 5.1: Wallet connect for Solana and EVM

As a donor,
I want to connect a Solana or EVM wallet,
So that I can donate from either ecosystem (FR3).

**Acceptance Criteria:**

**Given** the app
**When** I connect
**Then** Solana via the wallet adapter and EVM via wagmi and viem both connect and show address and chain.

### Story 5.2: Donate flow wired to chains

As a donor,
I want my donation to submit a real transaction,
So that funds actually reach escrow (FR3).

**Acceptance Criteria:**

**Given** a chain, token, amount, and anonymity choice
**When** I confirm
**Then** the correct program or contract receives the transaction
**And** the success state links to the transaction.

### Story 5.3: Campaign detail wired to canonical data

As a donor,
I want the campaign page to show real data,
So that progress, ledger, and proofs are trustworthy (FR1, FR2).

**Acceptance Criteria:**

**Given** a campaign
**When** I open it
**Then** progress, the ledger, proofs, and the tier load from the read API, not seed data.

### Story 5.4: Anonymity handling

As a donor,
I want to give anonymously,
So that my identity stays private (FR4).

**Acceptance Criteria:**

**Given** an anonymous donation
**When** it is displayed
**Then** the ledger omits identity
**And** the donor is excluded from the leaderboard.

### Story 5.5: Token registry surfacing

As a donor,
I want to see only accepted tokens,
So that I choose a valid asset (FR20).

**Acceptance Criteria:**

**Given** the curated per-chain registry in KV
**When** I open the donate panel
**Then** the token list reflects the registry
**And** USDC is the default.

## Epic 6: Requester Onboarding and Verification

Public-identity tiered onboarding with human sign-off, no KYC in v1.

### Story 6.1: Campaign application flow

As a requester,
I want to apply for a campaign,
So that I can request help for a disaster (FR8).

**Acceptance Criteria:**

**Given** the application form
**When** I submit disaster, need, wallet, and public identity proof
**Then** a pending campaign is created with a public requester identity.

### Story 6.2: Public-identity tiering

As the protocol,
I want L1 and L2 tiers,
So that identity strength sets release generosity (FR8, FR9).

**Acceptance Criteria:**

**Given** an applicant
**When** they prove an aged Twitter and a public campaign post
**Then** they qualify at L1
**And** entity proof qualifies them at L2 with a larger first tranche.

### Story 6.3: Reviewer console and sign-off

As a reviewer,
I want to approve or reject campaigns,
So that only vetted campaigns go live (FR9).

**Acceptance Criteria:**

**Given** reviewer permissions
**When** core team or a trusted reviewer approves
**Then** the campaign goes live
**And** an unpermissioned user cannot approve.

### Story 6.4: Tier to escrow config

As the protocol,
I want approval to set the on-chain tranche config,
So that release matches the verified tier (FR6).

**Acceptance Criteria:**

**Given** an approval
**When** it is recorded
**Then** the tier-based first-tranche config is written to the campaign on-chain.

## Epic 7: Proof of Spend and AI Pipeline

Verified proof gates fund release.

### Story 7.1: Media upload to R2 and Stream

As a requester,
I want to upload proof media,
So that I can show how funds were spent (FR10).

**Acceptance Criteria:**

**Given** a tranche
**When** I upload images or recorded video
**Then** images go to R2 and video to Stream via Queues with size and type limits enforced.

### Story 7.2: AI moderation and authenticity

As the protocol,
I want media screened before publish,
So that fake or graphic media is caught (FR11).

**Acceptance Criteria:**

**Given** uploaded media
**When** the pipeline runs
**Then** moderation and authenticity checks run on Workers AI
**And** low confidence escalates to a human reviewer with a recorded pass or fail.

### Story 7.3: On-chain proof signal on pass

As the protocol,
I want a pass to gate release,
So that only proven spending unlocks the next tranche (FR7, FR11).

**Acceptance Criteria:**

**Given** a passed proof
**When** it is recorded
**Then** an on-chain proof signal is emitted that the release path consumes
**And** a fail blocks both publish and release.

### Story 7.4: Live stream handling

As a requester,
I want to stream live from the ground,
So that donors can watch in near real time (FR10).

**Acceptance Criteria:**

**Given** a live stream via Stream Live or Realtime
**When** it is broadcast
**Then** it is delayed-moderated while live
**And** the archived recording runs the full pipeline and is what can gate release.

### Story 7.5: Proof feed display

As a donor,
I want to see the proof feed,
So that I can verify impact (FR2).

**Acceptance Criteria:**

**Given** a campaign with proofs
**When** I view it
**Then** each proof shows tranche, amount spent, media, and the AI-verified state.

## Epic 8: Donor Identity, Profiles, Badges, and Leaderboard

Cross-chain donor identity and the donor flywheel.

### Story 8.1: Cross-chain aggregation

As a donor,
I want my wallets aggregated,
So that my giving counts as one (FR13).

**Acceptance Criteria:**

**Given** donations from several of my wallets across chains
**When** my profile is computed
**Then** totals and causes aggregate into one view.

### Story 8.2: Twitter link oracle

As a donor,
I want to link my Twitter,
So that several wallets show as one identity (FR13).

**Acceptance Criteria:**

**Given** a one-time code
**When** I prove Twitter ownership
**Then** my wallets link to the handle
**And** more than one wallet can link to it.

### Story 8.3: Public profiles

As a visitor,
I want to view a donor profile,
So that giving is transparent (FR15).

**Acceptance Criteria:**

**Given** a linked or unlinked donor
**When** I open /u/<handle> or /w/<wallet>
**Then** totals, causes, and badges render from canonical data.

### Story 8.4: Badge tiers

As a donor,
I want a badge for my giving,
So that contribution is recognized (FR14).

**Acceptance Criteria:**

**Given** my cumulative USD total
**When** it crosses a fixed threshold
**Then** my tier updates among Supporter, Bronze, Silver, Gold, and Platinum.

### Story 8.5: Leaderboard with per-cause filter

As a visitor,
I want a ranked leaderboard,
So that top donors are visible (FR16).

**Acceptance Criteria:**

**Given** non-anonymous donations
**When** I open the leaderboard
**Then** donors rank by USD-normalized total
**And** a per-cause filter narrows the list and anonymous gifts are excluded.

### Story 8.6: Badge share image

As a donor,
I want a shareable badge card,
So that I can post my impact (FR19).

**Acceptance Criteria:**

**Given** my profile
**When** I request a share image
**Then** a Worker renders a badge card readable for Twitter sharing.

## Epic 9: Content Surfaces and Brand

The SEO content surface and brand application.

### Story 9.1: Astro blog and news landing

As a visitor,
I want server-rendered content,
So that disasters and news are discoverable (FR1, FR17, NFR1).

**Acceptance Criteria:**

**Given** the content surface
**When** a page is requested
**Then** it renders server-side on Cloudflare with metadata and a sitemap
**And** Next.js is not used.

### Story 9.2: News management

As an editor,
I want to publish updates and coverage,
So that the feed stays current (FR17).

**Acceptance Criteria:**

**Given** a news item
**When** it is published
**Then** it appears on the news surface
**And** a relief update links to its campaign.

### Story 9.3: Live donations ticker

As a visitor,
I want a live ticker,
So that the home feels active (FR18).

**Acceptance Criteria:**

**Given** recent donations
**When** I open the home
**Then** the ticker streams them, pauses on hover, and respects reduced motion.

### Story 9.4: Brand and tokens application

As a visitor,
I want a consistent brand,
So that the product feels trustworthy (UX-DR1, UX-DR2, UX-DR10).

**Acceptance Criteria:**

**Given** the design system
**When** pages render
**Then** the logo, gradient, and tokens are applied
**And** final logo files replace the placeholder when provided.

### Story 9.5: Responsive and accessibility pass

As any user,
I want the site to work on my device,
So that nothing is unreachable (NFR8, UX-DR3).

**Acceptance Criteria:**

**Given** a phone
**When** I navigate
**Then** every page is reachable via the menu
**And** keyboard and contrast checks pass.

## Epic 10: Governance, Ops, and Security

Run the project as open source with safe operations.

### Story 10.1: Open-source repo and CI/CD

As a maintainer,
I want an open repo with community pull requests,
So that the project is community-evolved without a DAO (NFR10).

**Acceptance Criteria:**

**Given** the public repo
**When** a contributor opens a pull request
**Then** PR checks run
**And** only the core team can merge.

### Story 10.2: Secrets and bindings management

As a maintainer,
I want safe secret handling,
So that no secret leaks (NFR2).

**Acceptance Criteria:**

**Given** the deployment
**When** the app runs
**Then** secrets come from Workers secrets, token registries from KV
**And** no secret is in the client bundle or git.

### Story 10.3: Multisig setup

As the core team,
I want Squads and Safe configured,
So that pause and clawback work on both chains (FR12).

**Acceptance Criteria:**

**Given** the multisigs
**When** an authority action is taken
**Then** Squads on Solana and Safe on EVM each execute freeze and redirect.

### Story 10.4: Security audit gate

As the core team,
I want audits before real funds,
So that custody is safe (NFR12).

**Acceptance Criteria:**

**Given** a mainnet deployment that handles real funds
**When** it is proposed
**Then** completed program and contract audits are required and tracked first.

### Story 10.5: Demo data indicator

As a visitor,
I want to know when data is mock,
So that I am not misled during the prototype (NFR3).

**Acceptance Criteria:**

**Given** the indexer is not yet the data source
**When** I view the site
**Then** a visible indicator marks the data as demo or mock.

# ADR-001 — Fund Release: Escrow with Proof-Gated Milestone Release

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Enrique, Mary (Analyst)
- **Related:** [Project Brief](../project-brief.md) (D9, Q-C), ADR-003 (AI filtering), ADR-004 (verification)

---

## Context

Aid Protocol routes donor funds (SOL / registered SPL tokens) to requesters running disaster-relief campaigns. The central risk: a requester takes the money and runs, mismanages it, or scams. Direct payout offers **zero protection** — KYC/identity only helps *find* a bad actor afterward, not *stop* them.

The opposing force is **speed**: real relief (fuel for rescue, body recovery, reconstruction) needs money *now*. Any release model must balance **safety vs. speed**.

## Decision

Funds are held in an **on-chain escrow** in the Solana program and released in **milestones**, where each unlock is **gated on AI-verified proof-of-spend** of the previous tranche.

**Tiered first-tranche sizing** (identity tier from ADR-004 sets generosity):

| Requester tier | First unlock | Subsequent unlocks |
|---|---|---|
| L2 — public company / official org | ~30–40% | larger tranches on proof |
| L1 — established social profile | ~15% | small tranches, each proof-gated |
| L0–L1 — thin/new profile | tiny fixed cap | nothing until first proof clears |

**Universal safety rails:**
1. **Proof-gated unlocks** — no new tranche until the prior tranche's spend is shown *and* passes AI filtering (ADR-003).
2. **Pause / clawback authority** — a core-team-controlled authority (multisig, see Open Questions) can **freeze** a campaign on a fraud signal and **redirect undisbursed funds** to another verified campaign for the *same disaster*. Donors' intent is preserved; funds still help the cause.
3. **On-chain reputation** — requester history (campaigns, proof compliance, flags) is recorded; proven good actors graduate to faster, larger unlocks.

## Consequences

**Positive**
- A scammer can never extract more than **one small tranche** before funds freeze.
- Release is *coupled* to proof-of-spend — the two features reinforce each other and produce a powerful, on-chain donor-trust narrative.
- Brand promise becomes defensible: *"A scammer can never take more than one small tranche — and every donor watches it on-chain."*

**Negative / costs**
- More complex program logic (escrow state, tranche accounting, release approval).
- Requires a release-approval actor and an off-chain proof→on-chain signal path.
- Genuine emergencies may need more than the first tranche before proof exists — mitigated by larger L2 first tranches and an expedited review path (future work).

## Open Questions — RESOLVED 2026-06-27

- **OQ-1:** ✅ Pause/clawback authority = **Squads multisig (Solana) + Safe multisig (EVM)**, core-team-held, no DAO.
- **OQ-2:** ✅ First-tranche sizing = **L2 40% / L1 15% / new-thin ~$250 cap**; remaining unlocks proof-gated. Tunable policy.
- **OQ-3:** ✅ Frozen-campaign undisbursed escrow is **redirected to another verified same-disaster campaign** (not refunded).

## Alternatives Considered

- **Direct transfer** — rejected: zero fraud protection.
- **Reimbursement (spend-first)** — rejected as primary: disaster-zone requesters can't front money; retained as an option for some requester types.
- **Streaming release** — rejected as primary: doesn't fit lumpy real needs ("$5k fuel truck now").
- **Trusted local multisig / NGO only** — rejected as primary: reintroduces the intermediary the platform aims to disrupt; excludes individuals.

# ADR-004 — Requester Verification: Public-Identity Tiers (No KYC in v1)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Enrique, Mary (Analyst)
- **Related:** [Project Brief](../project-brief.md) (D10, Q-A), ADR-001 (fund release)

> Numbered ADR-004 to align with the brief's Q/ADR cross-references; ADR-003 (AI-filtering pipeline) is pending.

---

## Context

Requesters must be vetted before opening a campaign, but full **KYC** (government ID via a provider) carries real costs: regulatory/AML data-controller obligations, high friction, and exclusion of disaster-zone individuals who lack easy access to KYC providers. Enrique proposed a lighter, **public-identity** gate (Twitter profile / public company / "proper diligence").

**Key insight:** the **identity gate and the fund-release gate are the same dial.** Weaker identity verification is acceptable *because* fund release is tightly proof-gated (ADR-001). The two are balanced, not chosen independently.

## Decision

**No mandatory KYC in v1.** Replace it with **tiered public-identity verification**, where identity strength sets fund-release generosity (per ADR-001):

| Tier | Requester proves | Maps to ADR-001 first unlock |
|---|---|---|
| **L2 — public entity** | Company registration, official org domain/email, gov/agency verification, news mentions | ~30–40% |
| **L1 — social identity** | Aged, genuinely-followed X/Twitter (or LinkedIn) profile, publicly tied to the campaign via a one-time post | ~15% |
| **L0–L1 — thin/new** | Minimal/new profile | tiny fixed cap until first proof clears |

**"Proper diligence" checklist (lightweight, human + automated, per campaign):**
- Social profile **age**, follower authenticity, public post linking to the campaign.
- Cross-reference the named disaster against **real news** (reuse the landing-page news feed, D8).
- For orgs: **domain match**, registration lookup, prior public footprint.
- **Core-team human sign-off** before a campaign goes live (consistent with no-DAO, human-managed governance, D4).

Requester identity is **always public** (company or person). KYC (L3) is retained as an **optional future "verified" badge** for large orgs, not a v1 gate.

**Campaign creation is backend-only (Model A, decided 2026-06-27).** `createCampaign` is authority-only on both chains, so a campaign exists only after the backend completes off-chain diligence and human sign-off and then submits the creation transaction itself via the multisig authority. Requesters never call the contract to create campaigns. The alternative (requester self-submits with backend authorization, via a Solana co-signer and an EVM EIP-712 signature verified with `ecrecover`) is deferred unless requester-paid creation is needed later.

## Consequences

**Positive**
- Lighter legal/regulatory surface vs. holding government IDs (mitigates risk Q-F).
- On-brand: public identity *is* the diligence, auditable by every donor.
- Individual-friendly — works for someone with a phone + Twitter in a disaster zone.
- Public social identity acts as **social collateral**; the crowd helps spot fakes.

**Negative / costs**
- Weaker per-requester assurance than KYC — **mitigated by ADR-001** (tiny tranche exposure + proof-gating + freeze authority).
- Manual human sign-off doesn't scale infinitely — may need reviewer tooling / trusted community reviewers later.
- Social-profile checks are heuristic; determined actors can fabricate profiles (again capped by the money gate).

## Open Questions — RESOLVED 2026-06-27

- **OQ-1:** ✅ L1 individual floor = **aged Twitter/X account (age + real-follower threshold) + public post linking to the campaign**.
- **OQ-2:** ✅ Sign-off = **core team + a few trusted community reviewers** (no DAO); requires a reviewer-permission model.
- **OQ-3:** ⏳ *Deferred to P1 build* — concrete anti-bot thresholds for "aged"/"genuinely followed" (tuning, not architecture).

## Alternatives Considered

- **Mandatory KYC (L3) for all** — rejected for v1: regulatory weight, friction, excludes disaster-zone individuals.
- **Wallet-only / no verification (L0)** — rejected: no fraud deterrent at all.
- **Third-party KYC provider on every requester** — deferred: useful as an optional verified-badge upgrade, not a v1 requirement.

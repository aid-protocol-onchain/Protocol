# ADR-003 — AI Proof-Filtering Pipeline (Authenticity + Moderation)

- **Status:** Accepted (direction set; thresholds tuned in P1)
- **Date:** 2026-06-27
- **Deciders:** Enrique, Winston (Architect)
- **Related:** [Project Brief](../project-brief.md) (Q-B), ADR-001 (release gating), ADR-002 (proof feed), ADR-006 (Cloudflare stack), Spine AD-7

---

## Context

Proof-of-spend media is the trust core: it both **gates fund release** (ADR-001) and is **shown to donors** (ADR-002). It must be screened for two distinct failure modes:
1. **Authenticity** — fake or AI-generated "proof" (deepfakes, stock/reused images).
2. **Moderation** — graphic content (bodies, gore) inevitable in disaster contexts.

The web tier is Cloudflare-only (ADR-006), so the pipeline should prefer the Cloudflare stack.

## Decision

**Two-stage AI pipeline on Cloudflare Workers AI, with human fallback.**

1. **Ingest:** media enters via **Queues → R2** (images) / **Cloudflare Stream** (recorded video).
2. **Stage A — Moderation:** Workers AI screens for graphic/NSFW content; flagged media is blurred/withheld and routed to human review.
3. **Stage B — Authenticity:** Workers AI first-pass for AI-generation/manipulation signals; **low-confidence results escalate to a human reviewer** (the trusted-reviewer pool from ADR-004).
4. **Gate:** only a **PASS** emits the on-chain proof signal that unlocks the next tranche (AD-3/AD-7). No pass → no publish, no unlock.
5. **Live streams** (Stream Live / Cloudflare Realtime) cannot be pre-filtered: they run **delayed + human moderation** while live; the **archived recording** then runs the full pipeline, and only the passed recording can gate release.

External best-of-breed deepfake/moderation APIs may be added later behind the same pipeline interface if Workers AI accuracy proves insufficient — the gate contract (PASS-emits-signal) stays stable.

## Consequences

**Positive**
- Stays entirely within the Cloudflare stack; cheap, fast to ship.
- Human fallback covers the long tail and the (unavoidable) live-stream case.
- Pluggable: the gate contract is fixed (AD-7), so the model layer can be swapped without touching release logic.

**Negative / costs**
- Workers AI authenticity detection is a moving target vs. evolving deepfakes — accept an arms-race and lean on human review for low confidence.
- Human review introduces latency and a staffing need (the reviewer pool).
- Live moderation is inherently best-effort until the recording is processed.

## Open Questions

- **OQ-1:** ⏳ Exact model selection and **confidence thresholds** per stage — tuned during P1 build, not an architecture change.
- **OQ-2:** ⏳ Reviewer SLA / on-call model for live streams and escalations.

## Alternatives Considered

- **External best-of-breed APIs only** — deferred: higher accuracy but added cost, vendor lock, and data-egress; kept as a pluggable upgrade.
- **Human-only for v1** — rejected: doesn't scale and slows proof→unlock; humans are the fallback, not the front line.

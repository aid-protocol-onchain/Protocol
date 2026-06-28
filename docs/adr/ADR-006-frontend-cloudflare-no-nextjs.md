# ADR-006 — Frontend & Edge Platform: Cloudflare, No Next.js

- **Status:** Accepted
- **Date:** 2026-06-27
- **Deciders:** Enrique, Mary (Analyst)
- **Related:** [Project Brief](../project-brief.md) (D13, §6b), ADR-002 (image generator, indexer), ADR-005 (multi-chain indexer)

---

## Context

Enrique set two hard constraints: **the client must deploy to Cloudflare**, and **Next.js is explicitly excluded**. The platform also needs edge compute for: a Twitter-ownership **oracle/attestation** flow (ADR-002), **indexer** read endpoints over both chains (ADR-005), the **badge image generator** (ADR-002), and a candidate home for **AI-filtering** of proof media (ADR-003).

## Decision

**Build the entire web tier on the Cloudflare platform.**

1. **Client (frontend):** A **Vite + React SPA** deployed to **Cloudflare Pages**. (Remix or Astro on Workers are acceptable alternatives if SSR is later required — both deploy cleanly to Cloudflare. **Next.js is excluded** regardless.)

2. **Edge backend:** **Cloudflare Workers** host:
   - Public read API for leaderboards, profiles, campaign data (over the indexer).
   - **Twitter-link oracle** — verify a one-time code / attestation, then authorize the on-chain link.
   - **Badge image generator** — render shareable badge cards from PDA/contract data (e.g. Satori/resvg in a Worker).

3. **Data stack (Cloudflare-native):**
   - **D1** (SQLite) — indexed/aggregated chain data, profiles, leaderboards.
   - **KV** — hot config, token registries, caches.
   - **R2** — proof-of-spend media (images/video) and generated badge images.
   - **Queues** — ingest pipeline for indexing + proof processing.
   - **Workers AI** — primary candidate for the AI-filtering pipeline (ADR-003), with external models as fallback.

4. **Indexers** (ADR-005) run as Workers (scheduled/queue-driven) or a small external service feeding D1 — to be finalized in architecture.

5. **Wallet connectivity** is client-side: Solana wallet adapter + EVM (wagmi/viem or similar) inside the SPA. No framework lock-in to Next.js.

## Consequences

**Positive**
- One coherent platform (compute + storage + AI + CDN) at the edge; low ops overhead.
- Static SPA on Pages is cheap, fast, and globally distributed.
- Workers AI + R2 + Queues map cleanly onto the proof-of-spend and image-gen needs.
- Satisfies both hard constraints (Cloudflare host, no Next.js).

**Negative / costs**
- No Next.js means hand-rolling routing/SSR concerns if/when SEO for the blog/news landing page (D8) matters — **mitigate** with Astro or Remix for the *content* surface if needed, keeping the app as an SPA.
- Cloudflare-specific bindings reduce portability (acceptable trade for the constraint).
- D1/Workers have size/runtime limits to design within (esp. video processing — may need R2 + external transcoding).

## Open Questions — RESOLVED 2026-06-27

- **OQ-1:** ✅ Landing/news built in **Astro on Cloudflare** (SSR/SSG for SEO); donor/requester app stays a Vite+React SPA.
- **OQ-2:** ✅ Media = images→R2, recorded video→**Cloudflare Stream**; **live via Stream Live + Cloudflare Realtime** (archived recording runs the AI pass and gates release).
- **OQ-3:** ✅ Indexers run **fully in Cloudflare Workers** (webhook→Queues→Worker→D1); no external indexer service.

## Alternatives Considered

- **Next.js (on Vercel or CF)** — rejected: explicitly excluded by D13.
- **Vercel / Netlify hosting** — rejected: client must be on Cloudflare.
- **Traditional Node server + Postgres** — rejected: contradicts the Cloudflare-edge constraint; reintroduces server ops.

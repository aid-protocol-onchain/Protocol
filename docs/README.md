# Documentation

Planning and design documents for Aid Protocol. These were produced with the BMAD method (analyst, architect, planning) and capture the why behind the build. For a current, practical orientation, also read [`../README.md`](../README.md), [`../ROADMAP.md`](../ROADMAP.md), and [`../AGENTS.md`](../AGENTS.md).

## Start here

- [Project brief](project-brief.md) - the problem, the users, and the product vision.
- [Epic breakdown](planning-artifacts/epics.md) - requirements (FR and NFR) decomposed into epics and stories. This is the backbone of the [roadmap](../ROADMAP.md).
- [Architecture spine](planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md) - the invariants and structural decisions. Note: this is the original plan and may trail the as-built system in places; the README and AGENTS.md are the current source of truth for how the code is organized.

## Architecture decision records

The ADRs record the load-bearing choices and their trade-offs:

- [ADR-001: Escrow with proof-gated release](adr/ADR-001-escrow-proof-gated-release.md)
- [ADR-002: Donor identity and reputation](adr/ADR-002-donor-identity-reputation.md)
- [ADR-003: AI proof-filtering pipeline](adr/ADR-003-ai-proof-filtering-pipeline.md)
- [ADR-004: Public-identity verification (Model A)](adr/ADR-004-public-identity-verification.md)
- [ADR-005: Multi-chain SVM and EVM](adr/ADR-005-multichain-svm-evm.md)
- [ADR-006: Frontend on Cloudflare, no Next.js](adr/ADR-006-frontend-cloudflare-no-nextjs.md)
- [ADR-007: Fiat and walletless donations](adr/ADR-007-fiat-and-walletless-donations.md)

## Design

- [Design system](design-system.md) - the lifeline brand, tokens, and UI conventions.

## How these fit together

The project brief and ADRs set direction. The architecture spine fixes the invariants. The epic breakdown turns all of it into an ordered build plan, which the [roadmap](../ROADMAP.md) tracks against what has actually shipped.

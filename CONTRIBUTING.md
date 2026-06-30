# Contributing to Aid Protocol

Thank you for helping build a transparent lifeline for disaster relief. This is a non-profit, open-source project with no DAO: the codebase is the commons, and a core team reviews and merges community pull requests.

## Ground rules

1. **Donor safety first.** This code moves people's money to people in crisis. Correctness and safety beat cleverness and speed, every time.
2. **No em dashes** in any user-facing copy (UI text, docs, contract comments that surface to users). Use commas, colons, periods, or parentheses. This is a strict brand rule.
3. **Smart contracts build and test only in Docker** using the pinned toolchains in `chain/docker/`. Do not change toolchain versions without a discussion.
4. **The frontend deploys to Cloudflare. Do not add Next.js** or any framework that cannot run on Cloudflare Workers and Pages.
5. **On-chain is the source of truth.** The D1 tables are a rebuildable read model. Never treat the database as authoritative.

## Coverage and quality bar (non-negotiable for contracts)

Smart contracts cannot afford failures, so contract changes must meet all of the following before review:

- **Test coverage at least 95%, with 100% strongly preferred.** A pull request that drops contract coverage below 95% will not be merged.
  - EVM: `forge coverage` on `chain/evm` (lines and functions are held at 100%; branches at 95% or above).
  - Solana: the litesvm suite in `chain/solana/svm-tests` must pass, and new instructions need new tests.
- **Static analysis clean:** Slither (EVM) and `cargo audit` (Solana) introduce no new findings beyond accepted informational notes.
- **No `unsafe`, no unchecked arithmetic** in contracts. Use checked math and follow checks-effects-interactions.

Frontend and Worker changes should include sensible tests where practical and must build cleanly (`npm run build`).

## Pull request process

1. Fork and branch from `main`. Keep each PR focused on one change.
2. Run the relevant Docker test command(s) locally and paste the results in the PR description.
3. For contract changes, include the coverage numbers and the Slither / cargo-audit output.
4. Describe what changed and why. Link any related issue.
5. A core team member reviews. Contract changes get an extra adversarial review pass before merge.

## Local commands

```bash
# EVM tests + coverage
docker run --rm -v "$PWD/chain:/work" -w /work/evm --entrypoint sh \
  ghcr.io/foundry-rs/foundry:stable -c "forge test && forge coverage"

# Solana build + litesvm tests
docker compose -f chain/docker/docker-compose.yml run --rm anchor \
  "anchor build && cd /work/chain/solana/svm-tests && cargo test"

# Web app
cd app && npm install && npm run build
```

## Solana development with BMad agents

This repo ships three custom BMad agents for Solana work, backed by the installed `solana-dev` skill (`.claude/skills/solana-dev`):

- **Sol** (`bmad-agent-solana-program`) builds and tests the on-chain programs in `chain/solana` (Anchor or Pinocchio).
- **Kit** (`bmad-agent-solana-client`) builds the Solana client and wallet flows in `app/src/wallet` (@solana/kit, Codama, framework-kit).
- **Vera** (`bmad-agent-solana-auditor`) runs adversarial security audits and writes reports to `audit/`.

Use Sol for program changes and Kit for client changes. Before a contract change is merged, run a Vera audit and resolve all Critical and High findings; reports live in `audit/` (see [`audit/README.md`](audit/README.md)). An audit reports findings only; fixes land in separate, reviewed pull requests that reference the finding.

## Code style

- Match the surrounding code: naming, comment density, and idiom.
- TypeScript and React for the app. Solidity ^0.8.26 (Foundry) for EVM. Anchor (Rust) for Solana.
- Keep comments useful and short. Explain why, not what.

## Scope of contributions

Great first contributions: tests, documentation, accessibility fixes, indexer work, new chain or token support behind the existing allowlist pattern, and reviewer-console improvements. Larger protocol changes (escrow logic, release flow, refund logic) should start as an issue so the design can be discussed before code.

## Reporting security issues

Do not open a public issue for vulnerabilities. See [`SECURITY.md`](SECURITY.md).

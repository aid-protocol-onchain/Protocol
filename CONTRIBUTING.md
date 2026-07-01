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
- **Agent-led security review.** Every contract change is reviewed by the project's auditor agents before merge: Solana through **Vera** (`bmad-agent-solana-auditor`, on the `solana-dev` security checklist) and EVM through **Mira** (`bmad-agent-evm-auditor`, driving Slither and Aderyn plus the `solidity-auditor` skill). The agent writes a dated report to `audit/`, and all Critical and High findings must be resolved. Clean Slither, Aderyn, and `cargo audit` runs are the automated floor, not the ceiling.
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

# EVM static-analysis gate (Slither + Aderyn, Docker-only)
sh chain/docker/analyze-evm.sh

# Solana build + litesvm tests
docker compose -f chain/docker/docker-compose.yml run --rm anchor \
  "anchor build && cd /work/chain/solana/svm-tests && cargo test"

# Web app
cd app && npm install && npm run build
```

## Development method

This project plans feature work with the **BMad Method** before building. Substantial features go brief or PRD, then architecture, then epics and stories, then implementation; small changes use a single story or quick-dev; trivial fixes can go straight to a commit. See [`AGENTS.md`](AGENTS.md#development-method-bmad) for the full workflow and which skills to use.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

- **Format:** imperative mood, lowercase, no trailing period. Keep the subject under about 72 characters; put detail and rationale in the body.
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Scope:** a short area, for example `wallet`, `auth`, `worker`, `solana`, `telegram`, `brand`, `contracts`.
- One focused change per commit. If an AI agent helped author it, add a `Co-Authored-By:` trailer.

Examples:

    feat(telegram): add bot webhook and 2FA endpoints
    fix(worker): run worker first for /api/* so OAuth redirect works
    docs: document the Solana BMad agents

## Solana development with BMad agents

This repo ships three custom BMad agents for Solana work, backed by the installed `solana-dev` skill (`.claude/skills/solana-dev`):

- **Sol** (`bmad-agent-solana-program`) builds and tests the on-chain programs in `chain/solana` (Anchor or Pinocchio).
- **Kit** (`bmad-agent-solana-client`) builds the Solana client and wallet flows in `app/src/wallet` (@solana/kit, Codama, framework-kit).
- **Vera** (`bmad-agent-solana-auditor`) runs adversarial Solana security audits and writes reports to `audit/`.
- **Mira** (`bmad-agent-evm-auditor`) runs adversarial EVM/Solidity audits (Slither, Aderyn, the `solidity-auditor` skill) and writes reports to `audit/`.

Use Sol for program changes and Kit for client changes. Before a contract change is merged, run a Vera audit and resolve all Critical and High findings; reports live in `audit/` (see [`audit/README.md`](audit/README.md)). An audit reports findings only; fixes land in separate, reviewed pull requests that reference the finding.

For EVM contract changes, also run the automated static-analysis gate (Slither + Aderyn) in Docker and require no unresolved High or Critical findings:

```bash
sh chain/docker/analyze-evm.sh
```

It writes `slither-report.json` and `aderyn-report.md` to the repo root; the triaged verdict is written to `audit/static-analysis-evm-2026-06-30.md`. This gate is the automated floor on top of the manual Mira audit, not a replacement for it.

## Code style

- Match the surrounding code: naming, comment density, and idiom.
- TypeScript and React for the app. Solidity ^0.8.26 (Foundry) for EVM. Anchor (Rust) for Solana.
- Keep comments useful and short. Explain why, not what.

## Scope of contributions

Great first contributions: tests, documentation, accessibility fixes, indexer work, new chain or token support behind the existing allowlist pattern, and reviewer-console improvements. Larger protocol changes (escrow logic, release flow, refund logic) should start as an issue so the design can be discussed before code.

## Reporting security issues

Do not open a public issue for vulnerabilities. See [`SECURITY.md`](SECURITY.md).

# Aid Protocol agent guide

AI agents: read [AGENTS.md](AGENTS.md) before changing anything, and follow [CONTRIBUTING.md](CONTRIBUTING.md). These rules are not optional.

## Always

- **BMad Method for feature work**, current and future. Plan in BMad before building; scale the ceremony to the change. See [AGENTS.md](AGENTS.md#development-method-bmad).
- **Conventional Commits:** `type(scope): summary`, imperative, lowercase. Add a `Co-Authored-By:` trailer when an agent helped. Commit and push only when the user asks.
- **No em dashes** in any content or copy.
- **Contracts build and test only in Docker;** coverage stays at 95 percent or above.
- **Frontend is Cloudflare-only;** Next.js is forbidden.
- **On-chain is the source of truth;** D1 is a rebuildable read model.
- **Never commit secrets.**

## Solana

Use the BMad agents in `.claude/skills/`: **Sol** (programs), **Kit** (client and wallet), **Vera** (security audits, written to `audit/`), backed by the `solana-dev` skill.

The repo is OS-agnostic (Docker for builds, tests, and deploys). Do not assume a host OS.

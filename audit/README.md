# Security audits

This directory holds security audit reports for Aid Protocol's on-chain programs and contracts.

Reports are written here by the Vera security-audit agent (`.claude/skills/bmad-agent-solana-auditor`) and by human reviewers.

## Naming

`audit-<chain>-<topic>-<YYYY-MM-DD>.md`, for example `audit-solana-escrow-2026-06-29.md`.

## What a report contains

- Scope: the files and commit reviewed.
- Severity-ranked findings (Critical, High, Medium, Low, Informational), each with a concrete attack path and a remediation.
- A pass or fail checklist of the standard Solana and EVM checks.
- The status of each finding (open, fixed, accepted).

## Rules

- Reports never contain secrets, private keys, or deployer mnemonics.
- An audit reports findings; it does not modify program code. Fixes land in separate, reviewed pull requests that reference the finding.
- Link material findings from `SECURITY.md`.

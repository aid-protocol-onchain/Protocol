# Aid Protocol - EVM Static-Analysis Gate (Slither + Aderyn)

- **Contracts:** `AidEscrowFactory` (`chain/evm/src/AidEscrowFactory.sol`), `CampaignEscrow` (`chain/evm/src/CampaignEscrow.sol`), `TestToken` (`chain/evm/src/TestToken.sol`)
- **Compiler:** Solidity `0.8.26` (Foundry, `optimizer = true`, `optimizer_runs = 200`)
- **Date:** 2026-06-30
- **Basis:** post-remediation working tree (all findings in `audit/audit-evm-2026-06-30.md` marked Fixed)
- **Runner:** `chain/docker/analyze-evm.sh` (Docker-only, pinned toolchains)

## Verdict: PASS

No unresolved High or Critical findings. Both tools produced only informational
and low-severity, style-level results, plus two Aderyn heuristic "High" flags
that are both false positives (a self-refund send to `msg.sender` and a
checks-effects-interactions call that already precedes its state writes). Every
result was triaged against the manual audit (`audit/audit-evm-2026-06-30.md`),
which already reviewed the same code paths and confirmed correct
checks-effects-interactions ordering and per-campaign isolation.

This automated gate is the floor on top of that manual audit, not a replacement
for it. Contracts in `chain/evm/src` were not modified.

## Tools and versions

| Tool | Version | Image (pinned) | solc |
| --- | --- | --- | --- |
| Slither | 0.11.5 | `ghcr.io/trailofbits/eth-security-toolbox:edge` (digest `sha256:02ba315bc183bd2b018179cf0184d480174afd3826e4baa63225eab423d64b73`) | 0.8.26 (via `solc-select`) |
| Aderyn | 0.6.8 | prebuilt `aderyn-x86_64-unknown-linux-gnu` (release `aderyn-v0.6.8`) run in `debian:bookworm-slim` | 0.8.26 |

There is no official Aderyn Docker image published by Cyfrin (checked Docker Hub
`cyfrin/aderyn`, `cyfrinio/aderyn`, and `ghcr.io/cyfrin/aderyn`; none exist).
Aderyn ships as a Rust binary, so the gate downloads the pinned prebuilt Linux
binary into a minimal `debian:bookworm-slim` container and runs it there. This
keeps the toolchain Docker-only and pinned, per AGENTS.md.

## Exact Docker commands used

Run from the repo root. `MSYS_NO_PATHCONV=1` stops Git Bash / MSYS from
rewriting the leading-slash container paths on Windows; container working dirs
use a leading `//`. The wrapper `chain/docker/analyze-evm.sh` runs exactly these.

Slither:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/work" -w //work/chain/evm \
  --entrypoint sh ghcr.io/trailofbits/eth-security-toolbox:edge -c '
    solc-select install 0.8.26 >/dev/null 2>&1
    solc-select use 0.8.26 >/dev/null 2>&1
    forge clean >/dev/null 2>&1 || true
    slither . \
      --compile-force-framework foundry \
      --foundry-out-directory out \
      --checklist \
      --json //work/slither-report.json
  '
```

Aderyn:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/work" -w //work/chain/evm \
  debian:bookworm-slim sh -c '
    apt-get update -qq >/dev/null 2>&1
    apt-get install -y -qq curl xz-utils ca-certificates >/dev/null 2>&1
    curl -sSL -o /tmp/aderyn.tar.xz \
      "https://github.com/Cyfrin/aderyn/releases/download/aderyn-v0.6.8/aderyn-x86_64-unknown-linux-gnu.tar.xz"
    mkdir -p /opt/aderyn && tar -xJf /tmp/aderyn.tar.xz -C /opt/aderyn
    BIN=$(find /opt/aderyn -type f -name aderyn | head -1)
    "$BIN" . -o //work/aderyn-report.md
  '
```

Raw outputs: `slither-report.json` and `aderyn-report.md` at the repo root.

## Slither results

Slither compiled the Foundry project (solc 0.8.26) and ran its full detector
set. Complete result set (confirmed with `--show-ignored-findings`): 5
detectors, all **Informational** at High confidence. No reentrancy,
arithmetic, access-control, uninitialized-state, or unchecked-return detectors
fired.

| ID | Detector | Impact | Location | Triage |
| --- | --- | --- | --- | --- |
| ID-0 | `low-level-calls` | Informational | `CampaignEscrow._safeTransfer` (L248-251) | Informational / by design. Deliberate low-level `token.call(transfer.selector)` with return-data decoding: this IS the safe-ERC20 wrapper. Return value is checked (`!ok || (data.length != 0 && !decode(bool))`). |
| ID-1 | `low-level-calls` | Informational | `CampaignEscrow._safeTransferFrom` (L253-257) | Informational / by design. Same safe-ERC20 wrapper for `transferFrom`; return value checked. |
| ID-2 | `low-level-calls` | Informational | `CampaignEscrow.refundNative` (L204-212) | Informational / by design. `msg.sender.call{value: owed}` is the recommended ETH-send form. State (`refundedNative[msg.sender] += owed`) is written before the send (checks-effects-interactions), and a failed send reverts via `TransferFailed`. |
| ID-3 | `low-level-calls` | Informational | `CampaignEscrow.releaseNative` (L161-174) | Informational / by design. `to.call{value: amount}` is the recommended ETH-send form. Counters advanced before the send; failed send reverts. |
| ID-4 | `missing-inheritance` | Informational | `TestToken` should inherit `IERC20` (L6-55) | Informational. `TestToken` is a testnet-only faucet mock (open `mint`, "Do not deploy to mainnet"), out of protocol-trust scope per the manual audit. Not inheriting the local `IERC20` interface is cosmetic and does not affect the escrow contracts. |

## Aderyn results

Aderyn ingested 3 files (solc 0.8.26) and ran 88 detectors: 2 High, 6 Low.
Both "High" flags are heuristic false positives; the Lows are style and
gas-level items.

| ID | Issue | Aderyn severity | Location | Triage |
| --- | --- | --- | --- | --- |
| H-1 | ETH transferred without address checks | High | `CampaignEscrow.refundNative` (L204) | **False positive.** The heuristic wants a check on the recipient. `refundNative` sends only to `msg.sender` (the donor refunding themselves), for an amount derived from that caller's own recorded contribution. There is no attacker-chosen recipient and nothing to validate. `releaseNative`, where the recipient IS caller-chosen, already rejects `address(0)` and `address(this)` (manual-audit finding 7, Fixed). |
| H-2 | Reentrancy: state change after external call | High | `CampaignEscrow.donateToken` (L116) | **False positive.** Aderyn treats the `IAidFactory(factory).isAllowed(token)` allowlist check (a `view` staticcall to the trusted factory, no value, no fund movement) as the "external call", then flags the `raisedToken`/`donorToken` writes after it. The only fund-moving call, `_safeTransferFrom`, is the LAST statement (L120), after every state write. This is checks-effects-interactions compliant. The manual audit's reentrancy section reviewed all external-call sites and confirmed effects precede interactions on this path; no exploitable reentrancy exists. |
| L-1 | Missing Inheritance | Low | `AidEscrowFactory` (L21), `TestToken` (L6) | Informational. `AidEscrowFactory` implements the `IAidFactory` surface the escrow reads (`authority`/`approver`/`isAllowed`) via public state and a view function; formal `is IAidFactory` is cosmetic. `TestToken` is the testnet mock (see Slither ID-4). |
| L-2 | Modifier Invoked Only Once | Low | `CampaignEscrow.onlyApprover` (L96) | Informational / by design. `onlyApprover` gates `recordProof`; keeping it as a named modifier documents intent and mirrors `onlyAuthority`. No behavior impact. |
| L-3 | PUSH0 Opcode | Low | all three files (pragma) | Informational. solc 0.8.26 targets Shanghai (PUSH0). Aid Protocol targets Ethereum mainnet and Base (`foundry.toml` `[rpc_endpoints]`), both of which support PUSH0. No action needed for the intended deploy targets. |
| L-4 | State Variable Could Be Immutable | Low | `TestToken.name`, `TestToken.symbol` (L7-8) | Informational (gas). Testnet-only mock; out of protocol-trust scope. No change to production escrow contracts. |
| L-5 | Unsafe ERC20 Operation | Low | `CampaignEscrow._safeTransfer` (L249), `_safeTransferFrom` (L255) | Informational / by design. This is the same code as Slither ID-0/ID-1: a hand-rolled safe-ERC20 wrapper that checks `ok` and decodes the boolean return. It is the mitigation for unsafe ERC20 behavior, not an instance of it. The allowlist is restricted to standard non-fee tokens (manual-audit finding 4, Fixed/documented). |
| L-6 | Unspecific Solidity Pragma | Low | all three files (`^0.8.26`) | Informational. Sources use a caret pragma; the actual build is pinned to exactly `0.8.26` by `foundry.toml` (`solc = "0.8.26"`), and this gate compiles with 0.8.26. Pinning the pragma to `0.8.26` is an optional tightening, not a security issue. Not changed here (this gate does not modify `chain/evm/src`). |

## Cross-reference to the manual audit

Every detector that echoes a manual-audit topic maps to an already-Fixed
finding in `audit/audit-evm-2026-06-30.md`:

- Slither ID-0/1/4 and Aderyn L-5 (low-level ERC20 calls / safe-transfer wrapper)
  and the fee-on-transfer concern are addressed by finding 4 (Fixed, documented:
  allowlist restricted to standard non-fee tokens; wrapper checks return data).
- Slither ID-2/3 and Aderyn H-1/H-2 (ETH sends, ordering) are covered by the
  manual audit's reentrancy / checks-effects-interactions section, which
  confirmed effects precede interactions on every external-call site, and by
  finding 7 (Fixed: `releaseNative`/`releaseToken` reject `address(0)` and
  `address(this)`).
- No Slither or Aderyn detector surfaced a NEW issue beyond the manual audit,
  and none corresponds to an unresolved High/Critical.

## How to re-run

```sh
sh chain/docker/analyze-evm.sh
```

Requires Docker only (no host Foundry, Rust, or Python). Writes
`slither-report.json` and `aderyn-report.md` to the repo root; this file is the
triaged verdict. The gate passes when there are no unresolved High or Critical
findings.

---
name: EVM Audit Remediation
type: feature-spec
altitude: feature
status: implemented
created: '2026-06-30'
inherits: [AD-2, AD-3, AD-4]
spine: docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md
---

# Feature Spec: EVM Audit Remediation

## Goal

Close the exploitable gaps the 2026-06-30 EVM audit found in the three in-scope
contracts (`AidEscrowFactory`, `CampaignEscrow`, `TestToken`) without changing
the on-chain semantics that AD-3 (escrow + proof-gated release) and AD-4 (freeze
/ redirect) already define. The one critical (release not bounded by funds
raised) and the supporting highs (refund-bricking underflow, re-openable
approved ceiling) are the priority. The remediations mirror, one-for-one, the
fixes already shipped on the Solana side (`solana-audit-remediation.md`): release
bounded by raised, write-once / monotonic approvals, `approver != authority`
enforced at every entry point, and a rotatable, Safe-compatible role made safe
via a two-step transfer (the EVM mirror of the Solana `set_admin` question).
This is a spec only; a separate dev-story implements it.

## Inherited invariants (binding, from the spine)

- **AD-2:** on-chain contracts are the source of truth for money; the Worker /
  D1 read model is a rebuildable projection. Every fix here strengthens on-chain
  truth and must not push a role into the read model.
- **AD-3:** escrow holds funds; release is proof-gated, with separation of
  duties: the `approver` records the proof and approved amount, and a distinct
  `authority` releases up to that amount. Never one key for both
  (AGENTS.md rule 8).
- **AD-4:** the `authority` can freeze a campaign and switch it to pro-rata
  refunds (freeze / redirect). The freeze gate and the pro-rata refund math stay
  as designed.

## Triage

Each finding was re-read against the Solidity. Verdicts below; the severity
column is the final (post-triage) severity, which differs from the audit where
noted. Every verdict is anchored to the source as it stands today.

| # | Title | Verdict | Final severity |
| --- | --- | --- | --- |
| 1 | Release not bounded by funds raised; `approved` has no `raised` ceiling | Confirmed | Critical |
| 2 | Over-release bricks refunds via checked-subtraction underflow | Confirmed | High |
| 3 | `approved` ceiling is re-openable; `recordProof` accumulates and overwrites | Confirmed | High |
| 4 | Token accounting trusts the `amount` arg, not the measured delta (fee-on-transfer) | Partially-confirmed | Low |
| 5 | Single key can hold both roles (`approver` defaults to `authority`) | Confirmed | High |
| 6 | No two-step ownership transfer; one bad `setAuthority` bricks the protocol | Confirmed | Medium |
| 7 | Authority-chosen release `to` allows self-/escrow-directed transfers | Confirmed | Low |
| 8 | `recordProof` accepts `amount == 0` and arbitrary unbounded `tranche` | Confirmed | Low |
| 9 | Forced ETH is releasable and not refundable; refund dust stranded | Partially-confirmed | Low |
| 10 | `unregisterToken` does not reject the zero address | Confirmed | Informational |
| 11 | Committed proof hash never bound to amount/recipient or verified | Confirmed (by-design) | Informational |

### Triage notes (exploit path or why it is not exploitable)

- **1 Confirmed (Critical).** `_checkRelease` (`CampaignEscrow.sol:176-179`) gates
  only on `proofHash[tranche] != 0` and
  `releasedForTranche[tranche][asset] + amount <= approved[tranche][asset]`.
  Nothing ties `approved`, `releasedNative`, or `releasedToken[token]` to
  `raisedNative` / `raisedToken[token]`. `recordProof` (line 111) does
  `approved[tranche][asset] += amount` with no `raised` anchor. Exploit: a faulty
  or compromised approver records `approved` across tranches `0,1,2,...` totaling
  more than `raised`; the authority calls `releaseToken` and drains the entire
  per-campaign token balance to an authority-chosen recipient, leaving nothing
  for the pro-rata refund pool `enableRefunds` promises. Per-campaign isolation
  holds (each escrow is its own deployed contract), so this cannot reach other
  campaigns, but within a campaign it is a direct donor-funds drain. Direct EVM
  analogue of Solana finding #2 (Critical). Severity confirmed Critical.
- **2 Confirmed (High).** `_refundable` (`CampaignEscrow.sol:181-185`) computes
  `uint256 remaining = raised - released;` under Solidity 0.8 checked arithmetic.
  If `released > raised` for an asset (reachable via finding 1 for tokens
  directly, or for native when the contract holds forced ETH, finding 9), the
  subtraction reverts. Both `refundNative` (line 155) and `refundToken` (line
  166) route through `_refundable`, so every donor's refund reverts permanently
  with no admin repair path. Exploit: over-release per finding 1 pushes
  `releasedToken[token] > raisedToken[token]`; `enableRefunds` is called; every
  `refundToken(token)` reverts on the underflow. Mirrors Solana finding #2's
  refund-DoS half. Severity confirmed High.
- **3 Confirmed (High).** `recordProof` (`CampaignEscrow.sol:108-113`) overwrites
  `proofHash[tranche]` and does `approved[tranche][asset] += amount` on every
  call, with no write-once guard and no reset against `releasedForTranche`.
  Exploit: approver records `approved[0][NATIVE] = 4 ether`; authority releases
  4; approver calls `recordProof(0, newHash, NATIVE, 4 ether)` again; headroom is
  reopened and the authority releases another 4 with no new donor funds and no
  immutable proof binding. The on-chain "approved per tranche per asset" is not
  an immutable commitment. EVM analogue of Solana findings #5 (`init_if_needed`)
  + #4 (accumulation). Severity confirmed High.
- **4 Partially-confirmed (Low, down from Medium).** `donateToken`
  (`CampaignEscrow.sol:98-101`) credits `raisedToken[token] += amount` and
  `donorToken[...] += amount` from the call argument, then transfers; it does not
  measure the balance delta. For a fee-on-transfer or rebasing token the books
  over-state custody and the last claimants' transfers revert. But the only
  admission path is the `authority`-gated `isAllowed` allowlist
  (`AidEscrowFactory.registerToken`, `onlyAuthority`), and the intended set is
  USDC/USDT (no fee on transfer today). Not reachable on the intended token set;
  it becomes live only if a fee-bearing token is registered. Latent, not live.
  Lowered to Low, matching the Solana finding #6 re-grade.
- **5 Confirmed (High, up from Medium).** `AidEscrowFactory` constructor (line
  33) defaults `approver = _authority`, and `setApprover` (lines 47-51) and
  `setAuthority` (lines 41-45) have no check forbidding the two roles from being
  equal. A freshly deployed factory has `approver == authority`, so every escrow
  it creates lets one key call both `recordProof` and `release` until someone
  calls `setApprover`. Even after separation, `setApprover(authority)` or
  `setAuthority(approver)` re-collapses dual control across all campaigns at will
  (escrows read both roles live from the factory). This is the precondition that
  makes findings 1 and 3 trivially exploitable by a single key. Because it
  defeats the AD-3 core invariant, raised to High to match the Solana finding #10
  re-grade.
- **6 Confirmed (Medium).** `setAuthority` (`AidEscrowFactory.sol:41-45`) is a
  single-step transfer guarded only by `onlyAuthority` and a zero-address check.
  A typo, a lost-key EOA, or a wrong-chain Safe immediately and irrevocably
  transfers the only role that can create campaigns, register tokens, release,
  freeze, enable refunds, and rotate roles. No acceptance handshake exists. The
  role is already a plain `address` (Safe-holdable), so the missing piece is the
  two-step safety, not the rotatability. EVM mirror of the Solana `set_admin`
  hardening. Severity confirmed Medium.
- **7 Confirmed (Low).** `releaseToken` / `releaseNative` check `to` only for the
  zero address (`CampaignEscrow.sol:118, 129`). Setting `to = address(this)` on
  `releaseToken` sends tokens back into the escrow while still advancing
  `releasedForTranche` and `releasedToken[token]`, burning approved headroom and
  inflating the released counters without disbursing. No external theft, but it
  corrupts the released accounting and the refund denominator and can push
  `releasedToken` toward `raisedToken` (feeding finding 2). Parallels Solana
  finding #9. Severity confirmed Low.
- **8 Confirmed (Low).** `recordProof` (`CampaignEscrow.sol:108-113`) validates
  only `hash != 0`. It accepts `amount == 0` (a no-op proof that still overwrites
  `proofHash[tranche]`) and any `uint256 tranche` with no monotonic counter, so
  tranches can be sprayed across the full key space with no aggregate ceiling.
  Combined with finding 1, this is what makes "unbounded approved across
  arbitrary tranches" reachable. Mirrors Solana finding #4 sub-issues. Severity
  confirmed Low.
- **9 Partially-confirmed (Low).** Two related gaps. (a) `CampaignEscrow` has no
  `receive()`/`fallback()`, but ETH can be forced in via `selfdestruct` or a
  pre-deploy pre-deposit; forced ETH is not in `raisedNative`, has no donor, yet
  `releaseNative` (line 124) sends from the raw contract balance, so forced ETH
  is releasable within the approval ceiling and never refundable. It also lets
  `releasedNative` exceed `raisedNative`, feeding findings 1 and 2. (b)
  `_refundable` truncates `(contributed * remaining) / raised` toward zero, so
  the sum of refunds is `<= remaining`, leaving a few wei of dust with no sweep
  path. The forced-ETH half is fully neutralized for release by the finding-1
  `released <= raised` bound (it caps native release at donor funds regardless of
  raw balance); the dust half is informational and matches Solana finding #11.
  Partially-confirmed, Low: the release-side risk is subsumed by finding 1, the
  dust is a recorded decision.
- **10 Confirmed (Informational).** `registerToken` (`AidEscrowFactory.sol:54`)
  rejects `token == address(0)` but `unregisterToken` (lines 60-64) does not. The
  asymmetry is harmless (the zero token is never donatable) but a linter
  (Slither/Aderyn) will flag it. Informational.
- **11 Confirmed (Informational, by-design).** `recordProof` commits `hash`
  (rejecting only the all-zero sentinel) and `_checkRelease` only verifies
  `proofHash[tranche] != 0` (line 177). The content is never verified on-chain
  and the hash is not bound to `amount`, `asset`, or `to`. By design (mirrors
  Solana finding #12); document it so the presence check is not mistaken for
  proof verification.

## Cross-cutting building blocks (define once, reuse everywhere)

These are shared so the per-finding fixes do not duplicate them.

- **CC-A: per-asset raised ceiling.** A single rule applied wherever `approved`
  or `released` changes, per asset (native: `raisedNative`; token:
  `raisedToken[token]`). Two invariants: cumulative `released + amount <= raised`
  at release time, and cumulative `totalApproved[asset] + amount <= raised` at
  record time. To make the approved ceiling cheap to enforce, add per-asset
  cumulative-approved tracking: `totalApprovedNative` (uint256) and
  `totalApprovedToken` (`mapping(address => uint256)`). New error `ExceedsRaised`.
  Used by findings 1, 8.
- **CC-B: saturating refund math.** Make `_refundable` saturating so a corrupted
  `released` counter can never brick the whole refund path:
  `uint256 remaining = released >= raised ? 0 : raised - released;`. Defense in
  depth on top of CC-A (which prevents the corruption at the source). Used by
  findings 2, 9.
- **CC-C: write-once monotonic proof.** Make each `(tranche, asset)` proof
  write-once: revert if `approved[tranche][asset] != 0` on re-record. Add a
  monotonic per-asset next-tranche counter and require `tranche <= nextTranche`
  so tranche indices are sequential, not sprayable. New errors `AlreadyApproved`,
  `BadTranche`, `ZeroAmount`. Used by findings 3, 8.
- **CC-D: distinct-role invariant.** A single rule `approver != authority`
  enforced at the factory constructor, in `setApprover`, and in `setAuthority`.
  New error `RolesMustDiffer`. Used by finding 5.
- **CC-E: two-step role transfer.** An `Ownable2Step`-style propose/accept
  handshake for both `authority` and `approver`: a setter records a
  `pendingAuthority` / `pendingApprover`, and the incoming holder must call
  `acceptAuthority` / `acceptApprover` from the new key to take effect. Events on
  both propose and accept. The accept step re-checks CC-D against the live
  counterpart role. Used by finding 6.

## Remediation (priority order)

### Critical

#### Finding 1 - Bound release by funds raised, per asset (CC-A)

- **Change.** In `CampaignEscrow._checkRelease`, after the existing `approved`
  check, add a per-asset funds-on-hand ceiling. Because `_checkRelease` does not
  know the cumulative `released*` counter for the asset, do the bound in the
  release functions:
  - `releaseNative`: before mutating, require
    `releasedNative + amount <= raisedNative` (`ExceedsRaised`).
  - `releaseToken`: require
    `releasedToken[token] + amount <= raisedToken[token]` (`ExceedsRaised`).
  - In `recordProof` (paired with CC-C): track `totalApprovedNative` /
    `totalApprovedToken[asset]` and require the cumulative approved per asset
    `<= raised(asset)` so the ceiling itself can never exceed raised. Keep the
    existing per-tranche `approved` check as belt-and-suspenders.
- **Acceptance criteria.**
  - `releaseNative` for an `amount` that would push `releasedNative` past
    `raisedNative` reverts with `ExceedsRaised`, even if `approved[tranche]` is
    larger.
  - `releaseToken` cannot push `releasedToken[token]` past `raisedToken[token]`.
  - `recordProof` whose cumulative approved per asset exceeds `raised(asset)`
    reverts with `ExceedsRaised`.
  - After any sequence of releases, `released* <= raised*` holds, so `_refundable`
    never underflows.
- **Foundry tests** (each fails on old code, passes on fixed code).
  - `testReleaseNativeCannotExceedRaised`: approve > raised across tranches,
    release up to `raisedNative` succeeds, the next wei reverts `ExceedsRaised`.
  - `testReleaseTokenCannotExceedRaised`: analogous for `usdc`.
  - `testRecordProofTotalApprovedCannotExceedRaised`: spray two tranches summing
    past raised; the second `recordProof` reverts.
  - `testOverReleaseDoesNotBrickRefunds`: confirm `refundNative` /
    `refundToken` still compute after max release.

### High

#### Finding 2 - Make refund math saturating so it can never brick (CC-B)

- **Change.** In `CampaignEscrow._refundable`, replace
  `uint256 remaining = raised - released;` with
  `uint256 remaining = released >= raised ? 0 : raised - released;`. The root
  cause is fixed by finding 1; this is the defense-in-depth layer so a corrupted
  counter (or forced ETH, finding 9) can never revert every donor's refund.
- **Acceptance criteria.**
  - With `released > raised` for an asset (forced via a test harness that sets
    the counter, or via forced ETH for native), `refundNative` / `refundToken`
    return `0` owed (revert `NothingToRefund`) instead of underflow-reverting.
  - The pro-rata math for the normal `released <= raised` case is byte-for-byte
    unchanged (AD-4 semantics preserved).
- **Foundry tests.**
  - `testRefundableSaturatesWhenOverReleased`: drive `releasedNative >
    raisedNative` via forced ETH (`selfdestruct` helper) + release, enable
    refunds, assert `refundNative` does not revert with an arithmetic panic.
  - `testProRataUnchangedNormalCase`: re-assert the existing pro-rata expectation
    (10 * 12/20 = 6 ether) still holds (regression guard).

#### Finding 3 - Make each proof a one-time, monotonic commitment (CC-C)

- **Change.** In `CampaignEscrow.recordProof`: reject `amount == 0`
  (`ZeroAmount`); make `(tranche, asset)` write-once by reverting if
  `approved[tranche][asset] != 0` (`AlreadyApproved`); bound `tranche` against a
  per-asset monotonic counter (`nextTrancheNative` / `nextTrancheToken[asset]`)
  and require `tranche <= nextTranche` (`BadTranche`), incrementing the counter
  when `tranche == nextTranche`. Combined with CC-A this gives an immutable,
  non-reopenable, raised-bounded ceiling. (If multiple proofs per tranche are
  ever legitimately needed, key them by an explicit proof index, each
  write-once.)
- **Acceptance criteria.**
  - Re-recording the same `(tranche, asset)` after a full release reverts
    `AlreadyApproved`; the ceiling cannot be reopened.
  - A proof with `amount == 0` reverts `ZeroAmount`.
  - A far-future `tranche` index reverts `BadTranche`.
- **Foundry tests.**
  - `testRecordProofIsWriteOnce`: second `recordProof` for the same
    `(tranche, asset)` reverts `AlreadyApproved`.
  - `testCannotReopenCeilingAfterRelease`: record 4 ether, release 4, re-record
    reverts (this is the finding-3 exploit, must fail on old code).
  - `testRecordProofRejectsZeroAmount`.
  - `testTrancheIndexMustBeMonotonic`: a far-future tranche reverts `BadTranche`.

#### Finding 5 - Enforce distinct approver and authority (CC-D)

- **Change.** In `AidEscrowFactory`: take an explicit `_approver` constructor
  argument and require `_approver != _authority` (`RolesMustDiffer`); stop
  defaulting `approver = authority`. In `setApprover`, require
  `newApprover != authority`. In `setAuthority`, require
  `newAuthority != approver`. (With CC-E the checks move to the `accept*` step;
  see finding 6.) Optionally gate `releaseNative` / `releaseToken` on
  `IAidFactory(factory).approver() != IAidFactory(factory).authority()` as a
  belt-and-suspenders runtime guard so a future code path cannot collapse the
  roles.
- **Acceptance criteria.**
  - Constructing `AidEscrowFactory` with `_approver == _authority` reverts
    `RolesMustDiffer`.
  - `setApprover(authority)` reverts; `setAuthority(approver)` reverts.
  - For any successful release, `approver != authority` holds.
- **Foundry tests.**
  - `testFactoryRejectsEqualRoles`: constructor with equal roles reverts.
  - `testSetApproverRejectsAuthority`.
  - `testSetAuthorityRejectsApprover`.
  - `testReleaseRequiresDistinctRoles` (if the optional release gate is added).

  Note: this changes the constructor and `setApprover` signatures/behavior, so
  the existing `testFreshFactoryApproverEqualsAuthority` and
  `testFactoryDefaultsApproverToAuthority` tests must be updated (they assert the
  now-removed default).

### Medium

#### Finding 6 - Two-step, Safe-compatible role transfer (CC-E)

- **Change.** Replace the single-step `setAuthority` / `setApprover` with an
  `Ownable2Step`-style handshake. Add `pendingAuthority` / `pendingApprover`
  storage. `setAuthority(newAuthority)` (still `onlyAuthority`) records
  `pendingAuthority` and emits `AuthorityTransferStarted`; `acceptAuthority()`
  (callable only by `pendingAuthority`) checks `msg.sender != approver`
  (CC-D at accept time), sets `authority`, clears the pending slot, and emits
  `AuthorityChanged`. Same shape for the approver
  (`AuthorityTransferStarted` / `ApproverTransferStarted`, `acceptApprover`,
  `pendingApprover != authority`). Keep zero-address rejection on propose.
  A Gnosis Safe can hold either role and proves control by submitting the
  `accept*` transaction.
- **Acceptance criteria.**
  - `setAuthority(x)` does not change `authority`; only `acceptAuthority()` from
    `x` does.
  - `acceptAuthority()` from any address other than `pendingAuthority` reverts.
  - `acceptAuthority()` reverts if the pending authority equals the current
    `approver` (`RolesMustDiffer`); same for the approver path against
    `authority`.
  - A mistyped or non-controllable proposed address can never take the role
    because it can never call `accept*`.
- **Foundry tests.**
  - `testTwoStepAuthorityTransfer`: propose, assert unchanged, accept from new
    key, assert changed.
  - `testAcceptAuthorityOnlyPending`: non-pending caller reverts.
  - `testTwoStepRejectsRoleCollapse`: propose `approver` as new authority, accept
    reverts `RolesMustDiffer`.
  - `testTwoStepApproverTransfer`: analogous for the approver.

  Note: this replaces the single-step setters, so existing `testSetAuthority`,
  `testSetApprover`, `testSetAuthorityZeroReverts`, and `testSetApproverZeroReverts`
  must be rewritten to the propose/accept flow.

### Low

#### Finding 7 - Forbid self-/escrow-directed release

- **Change.** In `releaseNative` and `releaseToken`, reject
  `to == address(this)` (`InvalidRecipient`) before any state change, so a
  release cannot burn approved headroom into a no-op or inflate the released
  counters without disbursing. (Binding `to` to a value committed in the proof is
  deferred; see finding 11.)
- **Acceptance criteria.**
  - `releaseToken(token, tranche, amount, address(this))` reverts; `releasedToken`
    and `releasedForTranche` do not advance.
  - `releaseNative(tranche, amount, payable(address(this)))` reverts.
- **Foundry tests.**
  - `testReleaseTokenRejectsSelfTransfer`.
  - `testReleaseNativeRejectsSelfTransfer`.

#### Finding 8 - Zero-amount and tranche bounds (folded into CC-C / finding 3)

- **Change.** Covered by CC-C: `amount == 0` reject and the monotonic tranche
  bound are implemented as part of finding 3. No separate change.
- **Acceptance criteria.** Same as finding 3's zero-amount and monotonic-tranche
  criteria.
- **Foundry tests.** `testRecordProofRejectsZeroAmount` and
  `testTrancheIndexMustBeMonotonic` (shared with finding 3).

#### Finding 9 - Neutralize forced ETH on release; record dust decision

- **Change.** The forced-ETH release risk is fully closed by finding 1's
  `releasedNative + amount <= raisedNative` bound (native release is capped at
  donor funds regardless of any forced raw balance) and finding 2's saturating
  refund math. No additional code change for the release path. For the refund
  dust: out of scope for code change this increment; record the decision (an
  authority dust-sweep to a treasury after refunds settle, or allocate the
  remainder to the final claimant). Do not alter `_refundable` pro-rata semantics
  in a way that changes AD-4.
- **Acceptance criteria.**
  - With forced ETH present (via a `selfdestruct` helper), `releaseNative` still
    cannot push `releasedNative` past `raisedNative`.
  - Dust decision recorded; no behavior change shipped here.
- **Foundry tests.**
  - `testForcedEthDoesNotEnableOverRelease`: force ETH in, attempt to release
    beyond `raisedNative`, expect `ExceedsRaised` (shared with finding 1).

#### Finding 4 - Keep the allowlist to non-fee tokens (paired with finding 10)

- **Change.** No accounting rewrite this increment (Low, not reachable on the
  intended USDC/USDT set once the allowlist is the only admission path). Add a
  NatSpec / doc note on `donateToken` and `registerToken` stating the allowlist
  must admit only standard, non-fee-on-transfer ERC-20s, and why
  (`raisedToken` trusts the `amount` argument, not a measured balance delta).
  Record delta-aware accounting (`balanceOf` before/after `_safeTransferFrom`,
  credit the measured delta) as a future hardening item if a fee-bearing token is
  ever needed.
- **Acceptance criteria.**
  - The non-fee-token constraint is documented in the contract source.
  - No behavior change shipped here.
- **Foundry tests.** None required (doc-only); the existing
  `testDonateNoReturnToken` remains the standard-token regression guard.

### Informational

#### Finding 10 - Reject the zero address in `unregisterToken`

- **Change.** Add the same `if (token == address(0)) revert ZeroAddress();`
  guard to `AidEscrowFactory.unregisterToken` for symmetry with `registerToken`.
- **Acceptance criteria.**
  - `unregisterToken(address(0))` reverts `ZeroAddress`.
- **Foundry tests.**
  - `testUnregisterTokenZeroReverts`.

#### Finding 11 - Document the proof hash as an off-chain commitment

- **Change.** Add a NatSpec note on `recordProof` / `_checkRelease` that `hash`
  is an off-chain attestation only and the on-chain check is presence
  (`proofHash[tranche] != 0`), not verification, and is not bound to
  `amount` / `asset` / `to`. If stronger guarantees are wanted later, bind the
  hash to `(amount, asset, tranche, to)` and make it write-once (already
  write-once after finding 3).
- **Acceptance criteria.** The off-chain nature of `hash` is documented in
  source; no semantic change.
- **Foundry tests.** None (doc-only).

## Prioritized fix order

1. **Finding 5 + CC-D** (distinct approver/authority) - smallest change, removes
   the single-key precondition that makes 1 and 3 trivially exploitable. Do
   first.
2. **CC-A + Finding 1** (release bounded by raised, per asset, plus the cumulative
   approved ceiling at record time) - the single most important fix; the
   funds-on-hand invariant. Ship with CC-B.
3. **CC-B + Finding 2** (saturating refund math) - defense in depth so a corrupted
   counter can never brick refunds; ship alongside finding 1.
4. **CC-C + Findings 3 / 8** (write-once `(tranche, asset)`, monotonic tranche,
   zero-amount reject) - depends on the CC-A approved-ceiling tracking.
5. **CC-E + Finding 6** (two-step Safe-compatible role transfer; the EVM mirror of
   the Solana `set_admin` hardening), with CC-D re-checked at accept time.
6. **Finding 7** (self-/escrow-transfer guard), **Finding 9** (forced-ETH release
   subsumed by finding 1; dust decision recorded).
7. **Finding 10** (zero-address guard), **Finding 4 / 11** (doc-only:
   non-fee-token constraint and proof-hash off-chain note).

## Do not modify the on-chain semantics that AD-3 / AD-4 fix

These remediations harden invariants; they must not change the meaning of the
behaviors AD-3 and AD-4 already define:

- **Keep the separation of duties (AD-3):** the approver records the proof and
  the approved amount, a distinct authority releases up to it. The fixes enforce
  distinctness (CC-D) and add a raised ceiling; they do not collapse the two
  roles, add a third money authority, or move release authority off-chain.
- **Keep release proof-gated (AD-3):** release still requires a recorded proof
  and stays bounded by `approved`. The new `released <= raised` bound (CC-A) is an
  additional ceiling, not a replacement for the approval gate; the existing
  `_checkRelease` `approved` check stays.
- **Keep freeze / pro-rata refund semantics (AD-4):** the freeze gate, the
  `refunding` switch, and the `_refundable` pro-rata formula stay as designed.
  The saturating-math fix (CC-B) only prevents an underflow from bricking all
  refunds; for the normal `released <= raised` path the pro-rata share each donor
  receives is byte-for-byte unchanged. It does not change who can freeze, when
  refunds open, or each donor's share.
- **Keep on-chain truth (AD-2):** the new counters (`totalApproved*`,
  `nextTranche*`, `pending*`) live on-chain; no role is moved into the Worker /
  D1 read model.

## Coverage and tooling bar

- Contracts build and test only in Docker (`chain/docker/`, Foundry stable);
  coverage stays at the project's 95 percent floor or above. Each new test above
  must fail on the pre-fix code and pass on the fixed code.
- Run Slither + Aderyn in Docker as a follow-up and require zero new findings
  before any deploy, per the project's hard rules. The manual audit is the
  deliverable; the automated pass is a gate, not part of this spec.

## Out of scope (this increment)

- Delta-aware token accounting and any fee-on-transfer / Token-2022-style support
  (finding 4 future hardening; the allowlist constraint is documented instead).
- A `ReentrancyGuard` on the donate/release/refund paths. The audit confirmed
  checks-effects-interactions is followed at every external-call site and found
  no live reentrancy; a guard is recommended as cheap insurance but is not
  required to close any confirmed finding here. Note it as a follow-up.
- Binding the proof `hash` to `(amount, asset, tranche, to)` (finding 11 future).
- A dust-sweep implementation (finding 9 - decision only).
- `TestToken` hardening: it is explicitly testnet-only (open faucet `mint`) and
  is not a protocol-trust component; left as is.

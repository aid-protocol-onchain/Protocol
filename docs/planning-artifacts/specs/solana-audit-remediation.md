---
name: Solana Audit Remediation
type: feature-spec
altitude: feature
status: implemented
created: '2026-06-30'
inherits: [AD-2, AD-3, AD-4]
spine: docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md
---

# Feature Spec: Solana Audit Remediation

## Goal

Close the exploitable gaps the 2026-06-30 Solana audit found in `aid_escrow`
(`chain/solana/programs/aid_escrow/src/lib.rs`) without changing the on-chain
semantics that AD-3 (escrow + proof-gated release) and AD-4 (freeze / redirect)
already define. The two criticals (unauthenticated mint allowlist, release not
bounded by funds raised) and the supporting highs (rent-floor drain, unbounded
approval accumulation) are the priority. This is a spec only; a separate
dev-story implements it.

## Inherited invariants (binding, from the spine)

- **AD-2:** on-chain accounts are the source of truth for money; the Worker / D1
  read model is a rebuildable projection. Every fix here strengthens on-chain
  truth and must not push an authority into the read model.
- **AD-3:** escrow holds funds; release is proof-gated, with separation of
  duties: the `approver` records the proof and approved amount, and a distinct
  `authority` releases up to that amount. Never one key for both.
- **AD-4:** the `authority` can freeze a campaign and switch it to pro-rata
  refunds (freeze / redirect). The freeze gate and refund math stay as designed.

## Triage

Each finding was re-read against the source. Verdicts below; severity is the
final (post-triage) severity, which differs from the audit where noted.

| # | Title | Verdict | Final severity |
| --- | --- | --- | --- |
| 1 | Unauthenticated token allowlist | Confirmed | Critical |
| 2 | Release not bounded by funds raised | Confirmed | Critical |
| 3 | Campaign PDA drainable below rent-exemption | Confirmed | High |
| 4 | Unbounded `approved` over arbitrary tranches | Confirmed | High |
| 5 | `init_if_needed` on `Approval` reopens the ceiling | Confirmed | Medium |
| 6 | No SPL escrow-balance reconciliation | Partially-confirmed | Low |
| 7 | `Release` / `RefundSol` accept any program-owned `Campaign` | Partially-confirmed | Medium |
| 8 | Token-2022 silently unsupported | Confirmed (doc-only) | Low |
| 9 | Authority-chosen recipient / self-transfer | Confirmed | Low |
| 10 | `set_approver` collapses separation of duties | Confirmed | High |
| 11 | Refund truncation locks dust | Confirmed | Informational |
| 12 | Proof `hash` never bound or verified | Confirmed (by-design) | Informational |

### Triage notes (exploit path or why it is not exploitable)

- **1 Confirmed (Critical).** `RegisterToken` (lib.rs:349-356) types `authority`
  as a bare `Signer` with no `Config`/admin gate and uses `init_if_needed`.
  Exploit: anyone calls `register_token(is_stable = true)` for a worthless mint
  they control, then `donate_token` accepts it (the only gate in `DonateToken`
  is that the `[b"mint", mint]` PDA exists, lib.rs:387). Pollutes escrow
  accounting and the trusted `is_stable` signal.
- **2 Confirmed (Critical).** `release` (lib.rs:133-148) checks only
  `already + amount <= approved`; nothing ties `approved` or `released_sol` to
  `raised_sol`. Exploit: a faulty or over-eager approver records `approved >
  raised`; the authority releases the surplus, draining the rent reserve and the
  lamports earmarked for refunds. Then `released_sol > raised_sol` makes
  `refundable()` underflow (`checked_sub` -> `Overflow`) and honest refunds DoS.
  The token path (`release_token`, lib.rs:150-178) is capped by the escrow ATA
  balance at the CPI, but still inflates `campaign_asset.released` past `raised`,
  breaking refund math the same way.
- **3 Confirmed (High).** `release` (lib.rs:141) and `refund_sol` (lib.rs:202)
  debit `campaign` lamports directly with no rent floor. A data-bearing account
  pushed below the rent-exempt minimum is GC-eligible; losing or reviving this
  stateful PDA corrupts `raised_sol` / `released_sol` / `frozen` / `refunding`.
  Reachable via finding 2 (over-release) or a final full refund.
- **4 Confirmed (High).** `record_proof` ignores `_tranche` in the body
  (lib.rs:112-120) and accumulates `a.approved += amount` with no `raised`
  ceiling, no zero-amount reject, and no tranche bound. Each new `tranche` value
  mints a fresh `Approval` PDA via `init_if_needed`. Exploit: spray `approved`
  across `tranche = 0,1,2,...` to pre-authorize far more than `raised`, then
  release per finding 2. The audit listed this as the engine behind 2; severity
  High is right.
- **5 Confirmed (Medium).** `Approval` uses `init_if_needed` (lib.rs:412, 424).
  After releasing `approved`, the approver can re-record the same
  `(campaign, tranche, asset)` and add to `approved` again, reopening headroom
  while `released` already reflects the prior release. The hash overwrites with
  no history. Not reinit-to-steal (account stays program-owned), but the ceiling
  is mutable rather than a one-time commitment.
- **6 Partially-confirmed (Low, down from Medium).** `donate_token` /
  `release_token` / `refund_token` trust the `amount` argument and use classic
  `token::transfer` (lib.rs:90, 161, 220). On classic SPL Token there is no
  transfer fee, so books and balances cannot desync today; this is latent, not
  live. It only becomes a real loss vector if a fee-bearing mint is admitted,
  which requires finding 1 (or future Token-2022 support). Fixing 1 and keeping
  classic-SPL-only enforcement removes the reachable risk; delta-aware accounting
  is hardening. Lowered to Low.
- **7 Partially-confirmed (Medium).** `Release` (lib.rs:435), `RefundSol`
  (lib.rs:475), `RefundToken` (lib.rs:484), and `Donate` (lib.rs:372) type
  `campaign` as `Account<'info, Campaign>` with no `seeds`/`bump` re-derivation.
  Anchor still enforces owner + discriminator, and the dependent PDAs are seeded
  by `campaign.key()`, so there is no direct theft today. But `release_token` and
  `refund_token` build `invoke_signed` seeds from `campaign.id` and
  `campaign.bump` read out of account data (lib.rs:158-160, 217-219); without
  canonical re-derivation that is a sharp edge if any future path can present a
  `Campaign`-typed account with attacker-chosen `id`/`bump`. Defense-in-depth,
  Medium.
- **8 Confirmed (Low, doc-only).** `anchor_spl::token::{Mint, TokenAccount,
  Token}` pins the classic SPL Token program, so Token-2022 mints are rejected by
  deserialization. Correct but undocumented. Remediation is to assert and
  document classic-SPL-only, not to add Token-2022 support in this increment.
- **9 Confirmed (Low).** In `ReleaseToken` (lib.rs:447-463) `recipient` is
  `UncheckedAccount` and `recipient_ata` is constrained only by
  `associated_token::authority = recipient`. Setting `recipient = campaign` makes
  `recipient_ata == escrow_ata`: a no-op self-transfer that still advances
  `approval.released` and `campaign_asset.released`, burning headroom and
  corrupting the audit trail. No theft.
- **10 Confirmed (High, up from Low).** `initialize_campaign` defaults
  `approver = authority` (lib.rs:33) and `set_approver` (lib.rs:46-50) lets the
  authority set the approver to any pubkey including itself. This directly
  violates the AD-3 hard rule "never one key for both" and is the precondition
  that makes findings 2 and 4 trivially exploitable by a single key. Because it
  defeats the core separation-of-duties invariant, raised to High.
- **11 Confirmed (Informational).** `refundable` (lib.rs:243-249) truncates
  toward zero per donor, stranding a few atoms of dust with no sweep path. Not
  exploitable.
- **12 Confirmed (Informational, by design).** `hash` is an off-chain
  attestation; `release` only checks `hash != NATIVE_ASSET` (lib.rs:138). The
  content is never verified on-chain and is not bound to `amount` / `recipient`.
  By design; document it so the on-chain check is not mistaken for proof
  verification.

## Cross-cutting building blocks (define once, reuse everywhere)

These are shared so the per-finding fixes do not duplicate them.

- **CC-A: `Config` PDA + admin gate.** Add a single program `Config` account
  (`seeds = [b"config"]`) holding `admin: Pubkey` and `bump`, created once by a
  new `initialize_config(admin)` instruction (use `init`, not `init_if_needed`).
  This is privileged state per AD-2: it gates the allowlist, it never touches
  campaign money. Used by finding 1.
- **CC-B: rent-floor helper.** A single internal helper that, given an
  `AccountInfo` and a `space`, computes `available = lamports -
  Rent::get()?.minimum_balance(space)` and rejects any debit that would exceed
  `available` (new `AidError::BelowRentFloor`). Every native lamport debit in
  `release` and `refund_sol` routes through it. Used by findings 2 and 3.
- **CC-C: per-asset raised ceiling.** A single rule applied wherever `approved`
  or `released` changes: cumulative `released <= raised` and cumulative
  `approved <= raised`, per asset (native: `campaign.raised_sol`; token:
  `campaign_asset.raised`). To make the approved ceiling cheap to enforce, track
  `total_approved` per asset (add `approved_sol` to `Campaign` and `approved` ->
  add a `total_approved` field to `CampaignAsset`). Used by findings 2 and 4.
- **CC-D: canonical campaign re-derivation.** A reusable constraint snippet
  `seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump =
  campaign.bump` added to every context that takes `campaign`. Used by finding 7
  and hardens 2 and 4.

## Remediation (priority order)

### Critical

#### Finding 1 - Gate the mint allowlist behind admin (CC-A)

- **Change.** Add the `Config` PDA and `initialize_config` (CC-A). In
  `RegisterToken`: add `#[account(seeds = [b"config"], bump = config.bump,
  has_one = admin)] pub config`, replace the bare `authority: Signer` with
  `admin: Signer`, and change `allowed_mint` from `init_if_needed` to `init` so a
  mint cannot be silently re-registered with a flipped `is_stable`. Keep
  `is_stable` settable only by the admin.
- **Acceptance criteria.**
  - A non-admin signer calling `register_token` fails (constraint error).
  - The admin can register a mint exactly once; a second `register_token` for the
    same mint fails (account already in use).
  - `is_stable` cannot be changed by any non-admin and cannot be flipped by
    re-registration.
- **litesvm tests.**
  - `register_token_rejects_non_admin`: random signer -> expect has_one /
    constraint failure.
  - `register_token_admin_succeeds_once_then_fails`: admin registers, second
    register for same mint reverts.
  - `donate_token_rejects_unregistered_mint`: unchanged behavior, kept as a
    regression guard.

#### Finding 2 - Bound release by funds raised, protect the rent reserve (CC-B, CC-C)

- **Change.** In `release`, before debiting, require
  `campaign.released_sol.checked_add(amount)? <= campaign.raised_sol`
  (`AidError::ExceedsRaised`) in addition to the existing `<= approved` check,
  and route the lamport debit through the CC-B rent-floor helper against
  `Campaign::SPACE`. In `release_token`, require
  `campaign_asset.released.checked_add(amount)? <= campaign_asset.raised` before
  the CPI. Keep the existing `<= approved` checks.
- **Acceptance criteria.**
  - `release` for `amount` that would push `released_sol` past `raised_sol`
    reverts with `ExceedsRaised`, even if `approved` is larger.
  - `release` can never drop `campaign` lamports below the rent-exempt minimum
    for `Campaign::SPACE`.
  - `release_token` cannot push `campaign_asset.released` past
    `campaign_asset.raised`.
  - After any sequence of releases, `released_sol <= raised_sol` holds, so
    `refundable()` never underflows.
- **litesvm tests.**
  - `release_cannot_exceed_raised`: approve > raised, release up to raised
    succeeds, the next lamport reverts `ExceedsRaised`.
  - `release_preserves_rent_floor`: drive releases until the next debit would
    cross the floor; expect `BelowRentFloor`.
  - `release_token_cannot_exceed_raised`: analogous for SPL.
  - `over_release_does_not_brick_refunds`: confirm refunds still compute after
    max release.

### High

#### Finding 3 - Enforce the rent floor on every native debit (CC-B)

- **Change.** Route the `refund_sol` debit (lib.rs:202) through the same CC-B
  helper. The rent reserve stays in `campaign` for its entire lifetime; only an
  explicit, fully-settled close path (out of scope here) may return it.
- **Acceptance criteria.**
  - No `refund_sol` call can drop `campaign` below the rent-exempt minimum.
  - The campaign account remains rent-exempt after the final refund claim.
- **litesvm tests.**
  - `refund_cannot_breach_rent_floor`: last claimant attempt that would cross the
    floor reverts `BelowRentFloor`.
  - `campaign_stays_rent_exempt_through_full_refund`: assert lamports >= minimum
    after all refunds.

#### Finding 4 - Cap accumulated `approved` and bound the tranche (CC-C)

- **Change.** In `record_proof` / `record_proof_token`: reject `amount == 0`
  (`AidError::ZeroAmount`); track per-asset `total_approved` on the campaign /
  campaign_asset and require `total_approved.checked_add(amount)? <= raised`
  (`AidError::ExceedsRaised`). Bound `tranche` against a monotonic counter stored
  on the campaign (per asset) so tranches cannot be sprayed across the `u64`
  space; accept only `tranche == next_tranche` or `tranche <= current_max + 1`.
- **Acceptance criteria.**
  - A proof with `amount == 0` reverts.
  - Recording proofs whose cumulative `approved` exceeds `raised` (across any
    number of tranches) reverts.
  - A `tranche` outside the allowed monotonic range reverts.
- **litesvm tests.**
  - `record_proof_rejects_zero_amount`.
  - `total_approved_cannot_exceed_raised`: spray two tranches summing past
    raised; second reverts.
  - `tranche_index_must_be_monotonic`: a far-future tranche index reverts.

#### Finding 10 - Enforce distinct approver (separation of duties)

- **Change.** In `set_approver`, require `new_approver !=
  campaign.authority` (`AidError::ApproverIsAuthority`). In
  `initialize_campaign`, take an explicit `approver` and require `approver !=
  authority`; stop defaulting `approver = authority`. Optionally gate `release` /
  `release_token` on `campaign.approver != campaign.authority` as a belt-and-
  suspenders check (cheap, and it enforces AD-3 even if a future path sets the
  field directly).
- **Acceptance criteria.**
  - `initialize_campaign` with `approver == authority` reverts.
  - `set_approver(authority)` reverts.
  - A campaign always has `approver != authority` for any successful release.
- **litesvm tests.**
  - `initialize_campaign_rejects_self_approver`.
  - `set_approver_rejects_authority`.
  - `release_requires_distinct_approver` (if the optional release gate is added).

### Medium

#### Finding 5 - Make each approval a one-time commitment

- **Change.** Switch `Approval` from `init_if_needed` to `init` in `RecordProof`
  / `RecordProofToken`, so each `(campaign, tranche, asset)` proof is written
  once. If multiple proofs per tranche are ever intended, key the PDA by an
  explicit proof index and treat each as write-once. With finding 4's monotonic
  tranche rule this gives an immutable, non-reopenable ceiling.
- **Acceptance criteria.**
  - Re-recording the same `(campaign, tranche, asset)` reverts (account already
    in use); the approved ceiling cannot be reopened after release.
- **litesvm tests.**
  - `approval_is_write_once`: second `record_proof` for the same tranche reverts.
  - `cannot_reopen_ceiling_after_release`: record, release fully, re-record
    reverts.

#### Finding 7 - Re-derive the canonical campaign PDA everywhere (CC-D)

- **Change.** Add CC-D (`seeds = [b"campaign", campaign.id.to_le_bytes()...],
  bump = campaign.bump`) to `Donate`, `Release`, `ReleaseToken`, `RefundSol`,
  `RefundToken`, and `AuthorityOnly` campaign constraints, so Anchor re-derives
  and verifies the canonical PDA and the `bump` used for `invoke_signed` is
  validated rather than trusted from account data.
- **Acceptance criteria.**
  - Every instruction that takes `campaign` rejects a non-canonical or
    substituted `Campaign`-typed account.
  - `invoke_signed` in `release_token` / `refund_token` uses the verified
    canonical bump.
- **litesvm tests.**
  - `release_rejects_noncanonical_campaign` (craft an account with a mismatched
    stored bump / id and expect a seeds error).

### Low

#### Finding 9 - Forbid self-transfer in release_token

- **Change.** In `release_token`, reject `recipient_ata.key() ==
  escrow_ata.key()` and `recipient.key() == campaign.key()`
  (`AidError::InvalidRecipient`). Optionally constrain the recipient to a value
  committed in the proof (ties into finding 12).
- **Acceptance criteria.**
  - `release_token` with `recipient = campaign` (or `recipient_ata = escrow_ata`)
    reverts; `released` counters do not advance on a no-op.
- **litesvm tests.**
  - `release_token_rejects_self_transfer`.

#### Finding 6 - Keep classic-SPL-only explicit (paired with 8)

- **Change.** No accounting rewrite this increment (Low, not reachable on classic
  SPL once finding 1 is fixed). Keep the classic `Token` program types, and add
  the explicit assertion/doc from finding 8 so fee-bearing mints cannot enter.
  Note delta-aware accounting as a future hardening item if Token-2022 is ever
  adopted.
- **Acceptance criteria.**
  - The program only accepts classic SPL Token accounts and programs; a
    Token-2022 mint/account is rejected.
- **litesvm tests.**
  - `donate_token_rejects_token_2022_mint` (covered jointly with finding 8).

#### Finding 8 - Document and assert classic-SPL-only

- **Change.** Add a module-level doc comment stating classic-SPL-only support and
  why (no Token-2022 transfer fee / permanent delegate / transfer-hook handling).
  Optionally assert `token_program.key() == spl_token::ID` explicitly for
  clarity, although the `Program<'info, Token>` type already enforces it.
- **Acceptance criteria.**
  - The classic-SPL-only stance is documented in the program source.
  - A Token-2022 mint is rejected (by type today, asserted for clarity).
- **litesvm tests.**
  - `token_2022_mint_is_rejected`.

### Informational

#### Finding 11 - Dust handling

- **Change.** Out of scope for code change this increment. Record the decision:
  either add an authority dust-sweep to a treasury after refunds settle, or
  allocate the remainder to the final claimant. Do not alter `refundable` math
  in a way that changes AD-4 pro-rata semantics.
- **Acceptance criteria.** Decision recorded; no behavior change shipped here.

#### Finding 12 - Document the proof hash as off-chain commitment

- **Change.** Add a doc comment that `hash` is an off-chain attestation only and
  the on-chain check is presence, not verification. If stronger guarantees are
  wanted later, bind `hash` to `(amount, recipient, tranche, asset)` and make it
  write-once (already write-once after finding 5).
- **Acceptance criteria.** The off-chain nature of `hash` is documented in
  source; no semantic change.

## Prioritized fix order

1. **Finding 10** (distinct approver) - smallest change, removes the single-key
   precondition that makes 2 and 4 trivially exploitable. Do first.
2. **Finding 1** (admin-gated allowlist via CC-A) - closes the unauthenticated
   mint critical and the only reachable path for finding 6.
3. **CC-B + Finding 2 + Finding 3** (raised ceiling + rent floor on native debits)
   - the funds-on-hand and rent-exemption invariants; ship together.
4. **CC-C + Finding 4** (per-asset `total_approved <= raised`, monotonic tranche,
   zero-amount reject).
5. **Finding 5** (`init` for `Approval`) - depends on the finding 4 tranche model.
6. **CC-D + Finding 7** (canonical campaign re-derivation across all contexts).
7. **Finding 9** (self-transfer guard), **Finding 8 / 6** (classic-SPL-only
   assert + doc).
8. **Findings 11, 12** (documentation / recorded decisions).

## Do not modify the on-chain semantics that AD-3 / AD-4 fix

These remediations harden invariants; they must not change the meaning of the
behaviors AD-3 and AD-4 already define:

- **Keep the separation of duties (AD-3):** approver records the proof and the
  approved amount, a distinct authority releases up to it. The fixes enforce
  distinctness and a raised ceiling; they do not collapse the two roles, add a
  third money authority, or move release authority off-chain.
- **Keep release proof-gated (AD-3):** release still requires a recorded proof
  and stays bounded by `approved`. The new `<= raised` bound is an additional
  ceiling, not a replacement for the approval gate.
- **Keep freeze / pro-rata refund semantics (AD-4):** the freeze gate, the
  `refunding` switch, and the `refundable()` pro-rata formula stay as designed.
  The rent-floor fix only prevents draining the reserve; it does not change who
  can freeze, when refunds open, or each donor's pro-rata share.
- **Keep on-chain truth (AD-2):** the new `Config`/admin and counters live
  on-chain; no authority is moved into the Worker / D1 read model.

## Out of scope (this increment)

- An explicit campaign close path that returns the rent reserve (referenced by
  finding 3 but not required to close the drain).
- Token-2022 support and delta-aware accounting (findings 6, 8 future hardening).
- Dust-sweep implementation (finding 11 - decision only).
- Binding `hash` to `(amount, recipient, tranche, asset)` (finding 12 - future).

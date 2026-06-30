# Aid Protocol - Solana Program Security Audit

- **Program:** `aid_escrow` (`chain/solana/programs/aid_escrow/src/lib.rs`)
- **Program ID:** `AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT`
- **Framework:** Anchor 1.0.2 (with `init-if-needed`), anchor-spl 1.0.2 (classic SPL Token)
- **Auditor:** Vera (Solana/Anchor security review)
- **Date:** 2026-06-30
- **Commit basis:** working tree at audit time (not a tagged release)

## Scope

Full adversarial review of the single Anchor program `aid_escrow`. Reviewed: every instruction and its account-validation context, PDA and seed safety, CPI safety, integer arithmetic, account init / reinit / close and lamport accounting, rent handling, SPL Token vs Token-2022 assumptions and the mint allowlist, the proof-gated tranche release, pro-rata refunds, freeze / refund authority, and the approver-vs-authority separation of duties. The litesvm suites (`svm-tests/tests/escrow.rs`, `svm-tests/tests/spl.rs`) were read to confirm intended behavior. Program code was not modified.

Out of scope: the EVM contracts, the Worker / D1 read model, the client, and the build toolchain. `cargo-audit` and the litesvm suite are expected to run in `chain/docker/` as a follow-up; this report is a manual review and does not depend on those runs.

## Findings table

Status reflects the remediation shipped in the dev story for spec
`solana-audit-remediation.md`; severity columns are the audit-time severities (the
spec's post-triage re-grades are noted there). Fixes verified by the litesvm suite
in `chain/solana/svm-tests` (Docker `anchor build` + `cargo test`, all green).

| # | Severity | Title | Location | Status |
| --- | --- | --- | --- | --- |
| 1 | Critical | Unauthenticated token allowlist: anyone can register any mint | `register_token` / `RegisterToken` | Fixed |
| 2 | Critical | Release is not bounded by funds actually raised; rent reserve and refund pool drainable | `release`, `release_token` | Fixed |
| 3 | High | Campaign PDA can be drained below rent-exemption, enabling close/revival and griefing | `release`, `refund_sol` | Fixed |
| 4 | High | `record_proof` accepts any `tranche` and unbounded `approved` accumulation with no fund ceiling | `record_proof`, `record_proof_token` | Fixed |
| 5 | Medium | `init_if_needed` on `Approval` allows approved-ceiling reuse across release cycles | `RecordProof`, `RecordProofToken` | Fixed |
| 6 | Medium | No reconciliation between SPL escrow ATA balance and `campaign_asset.raised`; refund/release accounting can desync | `donate_token`, `release_token`, `refund_token` | Mitigated (classic-SPL-only asserted; delta-aware accounting deferred) |
| 7 | Medium | `release`/`refund_sol` accept any program-owned `Campaign` account (no seed binding) | `Release`, `RefundSol` | Fixed |
| 8 | Low | Token-2022 mints silently unsupported; no documented rejection path | `RegisterToken`, `DonateToken` | Fixed (documented + type-enforced) |
| 9 | Low | `recipient`/`recipient_ata` fully authority-chosen; self-transfer and duplicate-account possible | `release_token` | Fixed |
| 10 | Low | `set_approver` allows authority to self-assign approver, collapsing separation of duties | `set_approver` | Fixed |
| 11 | Informational | Refund pro-rata truncation leaves dust permanently locked in the PDA | `refundable` | Acknowledged (decision deferred; no code change) |
| 12 | Informational | Proof `hash` is committed but never bound to the released amount or verified | `record_proof*`, `release*` | Documented (by design) |

## Detailed findings

### 1. Critical - Unauthenticated token allowlist: anyone can register any mint

**Location:** `register_token` and the `RegisterToken` accounts context.

**Description.** The program documents an "authority-whitelisted" set of stablecoins (USDC/USDT). The `RegisterToken` context is:

```rust
#[account(init_if_needed, payer = authority, space = AllowedMint::SPACE,
          seeds = [b"mint", mint.key().as_ref()], bump)]
pub allowed_mint: Account<'info, AllowedMint>,
pub mint: Account<'info, Mint>,
#[account(mut)]
pub authority: Signer<'info>,
```

There is no global config/admin PDA and no constraint tying `authority` to any protocol admin. `authority` is simply "whatever account signed." Any user can register any classic-SPL mint into the allowlist, and the attacker fully controls the `is_stable` flag.

**Exploit path.** An attacker creates a worthless mint they control, calls `register_token` with `is_stable = true`, then uses `donate_token` for that mint (the only allowlist gate `donate_token` enforces is that the `allowed_mint` PDA derived from the mint exists). This injects attacker-chosen assets into per-campaign escrow accounting and pollutes the `is_stable` signal the rest of the stack trusts. The intended access-control invariant ("authority-whitelisted") does not exist on-chain.

**Remediation.** Introduce a single program `Config` PDA holding an `admin: Pubkey`, set once at deploy via an `initialize_config` instruction. Gate `register_token` with `#[account(has_one = admin)]` on the config plus an `admin: Signer`. Drop `init_if_needed` here (use `init`) so a mint cannot be silently re-registered with a flipped `is_stable`.

**Status: Fixed.** Added the `Config` PDA (`seeds = [b"config"]`, `admin` + `bump`) and `initialize_config`. `RegisterToken` now requires `#[account(seeds = [b"config"], bump, has_one = admin)]`, an `admin: Signer`, and `init` (not `init_if_needed`) on `allowed_mint`. Covered by `register_token_rejects_non_admin`, `register_token_admin_succeeds_once_then_fails`, and the `donate_token_rejects_unregistered_mint` regression guard.

### 2. Critical - Release is not bounded by funds actually raised

**Location:** `release` (native) and `release_token` (SPL).

**Description.** Release is bounded only by the approver-committed `approval.approved`:

```rust
require!(already.checked_add(amount)? <= approved, AidError::ExceedsApproved);
**campaign.try_borrow_mut_lamports()? -= amount;
**recipient.try_borrow_mut_lamports()? += amount;
campaign.released_sol = campaign.released_sol.checked_add(amount)?;
```

Nothing constrains `approved` (or cumulative `released`) to `raised_sol`. The approver can record an approved amount larger than what donors actually raised, and the authority can then release it. The native path debits raw lamports from the campaign PDA, which holds `rent_exempt_reserve + (raised - released)`. For SPL, `release_token` is bounded only by the escrow ATA balance (the CPI fails when it runs dry), but `campaign_asset.released` and `approval.released` can still be inflated past `campaign_asset.raised`.

**Exploit path.** Under the documented separation-of-duties trust model the approver and authority are distinct, but the program enforces no on-chain ceiling tying release to raised funds. A faulty or compromised approver who over-approves (or a single party who controls both keys, which the program permits by default and via finding 10) lets `release` pull the rent-exempt reserve the authority deposited at init and any lamports earmarked for pending refunds. `released_sol` can exceed `raised_sol`, after which `refundable()` computes `raised - released` and underflows in `refund_sol` (`checked_sub` returns `Overflow` / DoS) - refunds become impossible for honest donors.

**Remediation.** Bound release by funds on hand, independent of the approval ceiling:
`require!(campaign.released_sol.checked_add(amount)? <= campaign.raised_sol, ...)` for native, and the analogous `campaign_asset.released + amount <= campaign_asset.raised` for tokens. Keep the rent reserve untouchable by computing releasable lamports as `campaign.lamports() - rent.minimum_balance(Campaign::SPACE)` and asserting `amount` does not exceed it.

**Status: Fixed.** `release` now requires `released_sol + amount <= raised_sol` (`ExceedsRaised`) and `release_token` requires `campaign_asset.released + amount <= campaign_asset.raised`, in addition to the existing `<= approved` checks. The native lamport debit routes through a shared `debit_with_rent_floor` helper that refuses any debit crossing `Rent::minimum_balance(Campaign::SPACE)`. A monotonic per-asset `approved` ceiling (finding 4) also blocks over-approval at record time. Covered by `release_cannot_exceed_raised`, `release_preserves_rent_floor`, `release_token_cannot_exceed_raised`, and `over_release_does_not_brick_refunds`.

### 3. High - Campaign PDA can be drained below rent-exemption (close / revival, griefing)

**Location:** `release`, `refund_sol`.

**Description.** Both paths mutate `campaign` lamports directly with no rent-exemption floor:

```rust
**ctx.accounts.campaign.to_account_info().try_borrow_mut_lamports()? -= amount; // / owed
```

A data-bearing account that drops below the rent-exempt minimum is eligible to be reclaimed by the runtime. If `released + refunds` consume the reserve, the `campaign` account can be garbage-collected (data lost) or left as a zombie. Because this is a stateful escrow PDA, losing or reviving it corrupts all downstream accounting (`raised_sol`, `released_sol`, `frozen`, `refunding`).

**Exploit path.** Combine with finding 2: over-release or full-refund flows pull the reserve down to or below the floor. A griefer who is the legitimate last refund claimant can intentionally leave the PDA non-rent-exempt; a subsequent crafted transaction can then re-create or re-fund it to manipulate state, or the campaign simply disappears mid-lifecycle.

**Remediation.** Never let `campaign` lamports fall below `Rent::get()?.minimum_balance(Campaign::SPACE)`. Compute available lamports above the reserve and clamp every debit to it. The rent reserve must remain in the account for its entire lifetime; only an explicit, fully-settled close path should return it.

**Status: Fixed.** Both `release` and `refund_sol` now route every native lamport debit through the shared `debit_with_rent_floor` helper, which computes `available = lamports - Rent::minimum_balance(Campaign::SPACE)` and rejects any debit exceeding it (`BelowRentFloor`). The reserve stays in the PDA for its lifetime (no close path shipped this increment, by design). Covered by `release_preserves_rent_floor`.

### 4. High - Unbounded approved accumulation across arbitrary tranches

**Location:** `record_proof`, `record_proof_token`.

**Description.** `record_proof` accepts an arbitrary `tranche: u64` (used only as a PDA seed; the body ignores it: `_tranche`) and accumulates:

```rust
a.approved = a.approved.checked_add(amount)?;
```

Each distinct `tranche` value derives a fresh `Approval` PDA via `init_if_needed`. There is no cap on the number of tranches, no cap on `approved` relative to `raised`, and no ordering or state machine. The approver can pre-authorize an unbounded total approved amount across `tranche = 0, 1, 2, ...`, each independently releasable.

**Exploit path.** A single approver (or the default authority==approver configuration) records `approved` totals far exceeding `raised`, then the authority releases across tranches until the campaign PDA / escrow ATA is drained (see findings 2 and 3). The "approved amount per tranche" model provides no aggregate ceiling.

**Remediation.** Track a campaign-level `total_approved` and require `total_approved <= raised` (per asset). Validate `tranche` against a monotonic counter stored on the campaign so tranches cannot be sprayed across the `u64` space. Reject `amount == 0` proofs.

**Status: Fixed.** Added per-asset cumulative-approved tracking (`Campaign.approved_sol`, `CampaignAsset.total_approved`) and a monotonic next-tranche counter (`Campaign.next_tranche_sol`, `CampaignAsset.next_tranche`). `record_proof` / `record_proof_token` now reject `amount == 0` (`ZeroAmount`), require cumulative `approved + amount <= raised` (`ExceedsRaised`), and require `tranche <= next_tranche` (`BadTranche`). Covered by `record_proof_rejects_zero_amount`, `total_approved_cannot_exceed_raised`, and `tranche_index_must_be_monotonic`.

### 5. Medium - `init_if_needed` on Approval permits ceiling reuse across release cycles

**Location:** `RecordProof`, `RecordProofToken`.

**Description.** `Approval` is created with `init_if_needed`. The same `(campaign, tranche, asset)` approval can be re-recorded after release: a fresh `record_proof` call adds to `approved` again while `released` already reflects prior releases, raising the headroom (`approved - released`). The hash is overwritten with no history. This is not a classic reinit-to-steal (the account stays program-owned and the discriminator is intact), but it makes the approved ceiling a mutable, re-openable value rather than an immutable commitment.

**Exploit path.** Approver records `approved = X`, authority releases `X`. Approver later records again with a new hash and `amount = Y`; the authority can now release another `Y` against the same tranche, decoupled from any single proof commitment.

**Remediation.** Use `init` (not `init_if_needed`) for `Approval`, making each `(campaign, tranche, asset)` proof a one-time immutable commitment. If multiple proofs per tranche are intended, key the PDA by a proof index and treat each as write-once.

**Status: Fixed.** `Approval` now uses `init` (not `init_if_needed`) in both `RecordProof` and `RecordProofToken`, so each `(campaign, tranche, asset)` proof is write-once and the ceiling cannot be reopened after release. Combined with the monotonic tranche rule (finding 4) this gives an immutable per-tranche commitment. Covered by `approval_is_write_once` and `cannot_reopen_ceiling_after_release`.

### 6. Medium - No escrow-balance reconciliation for SPL paths

**Location:** `donate_token`, `release_token`, `refund_token`.

**Description.** `donate_token` credits `campaign_asset.raised += amount` from the instruction argument, then does the SPL transfer. Release and refund use the recorded `raised`/`released` figures while moving tokens out of the escrow ATA. Because the program uses `token::transfer` (classic SPL `Transfer`) and trusts the `amount` argument rather than measuring the ATA balance delta, any divergence between recorded amounts and actual moved tokens desyncs the books. This is a latent accounting bug today (classic SPL has no transfer fee) and a real loss vector if a fee-bearing or non-standard mint is ever admitted through finding 1.

**Exploit path.** Register a fee-on-transfer-style mint (only reachable today via finding 1, or in future if Token-2022 support is added). Donor sends 100; escrow receives less; `raised` records 100. Refunds/releases then attempt to move the full 100 and the escrow runs short, draining other campaigns' or donors' balances held in the same ATA.

**Remediation.** Even on classic SPL, prefer delta-aware accounting: read the escrow ATA balance before and after the CPI and credit the measured delta. Keep classic-SPL-only enforcement explicit (see finding 8) so fee-bearing mints cannot enter.

**Status: Mitigated (Low).** The reachable path is closed: finding 1 (admin-gated allowlist) prevents an attacker from admitting a fee-bearing mint, and the classic-SPL-only stance is now documented and type-enforced (finding 8). On classic SPL Token there is no transfer fee, so books and balances cannot desync today. Delta-aware accounting (measuring the ATA balance delta) is recorded as a future hardening item for any eventual Token-2022 adoption and is intentionally not implemented this increment.

### 7. Medium - `Release` / `RefundSol` accept any program-owned Campaign account

**Location:** `Release`, `RefundSol` (and `Donate`).

**Description.** These contexts type the campaign as `Account<'info, Campaign>` with no `seeds`/`bump` re-derivation:

```rust
#[account(mut, has_one = authority)]
pub campaign: Account<'info, Campaign>,
```

Anchor enforces owner + discriminator but not that this is the canonical `[b"campaign", id]` PDA. The dependent PDAs (`approval`, `contrib_sol`) are seeded by `campaign.key()`, so they stay internally consistent, which limits the blast radius. However, omitting the seed binding removes a defense-in-depth layer: any future instruction that reasons about `campaign.id` or cross-references another PDA by id (rather than by `campaign.key()`) becomes substitutable, and the stored `bump` used for `invoke_signed` in `release_token`/`refund_token` is trusted from account data rather than re-derived.

**Exploit path.** No direct theft in the current shape, but it is a sharp edge: the signer seeds in `release_token` (`[b"campaign", id.to_le_bytes(), [bump]]`) are built from `campaign.id` and `campaign.bump` read out of the passed account. If an attacker could ever present a program-owned `Campaign`-typed account with chosen `id`/`bump` (e.g. via a future init path or type confusion), the signer derivation follows attacker data.

**Remediation.** Add `seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump` to every `Campaign` account constraint so Anchor re-derives and verifies the canonical PDA on each instruction.

**Status: Fixed.** Added `seeds = [b"campaign", campaign.id.to_le_bytes().as_ref()], bump = campaign.bump` to every context that takes `campaign` (`Donate`, `DonateToken`, `RecordProof`, `RecordProofToken`, `Release`, `ReleaseToken`, `AuthorityOnly`, `RefundSol`, `RefundToken`). Anchor now re-derives and verifies the canonical PDA, so the `bump` used for `invoke_signed` in `release_token` / `refund_token` is validated rather than trusted from account data.

### 8. Low - Token-2022 mints silently unsupported

**Location:** `RegisterToken`, `DonateToken`, all token contexts.

**Description.** The program uses `anchor_spl::token::{Mint, TokenAccount, Token}`, which pin accounts and the token program to the classic SPL Token program. Token-2022 mints/accounts are therefore rejected by deserialization rather than by an explicit, intentional check, and the program offers no Token-2022 path. This is acceptable as a deliberate scope decision but is undocumented, and the security posture around transfer fees, permanent delegate, and `transfer_checked` (security.md items 10-18) is implicitly "not supported" rather than asserted.

**Remediation.** Document classic-SPL-only support explicitly. If Token-2022 is ever desired, migrate to `anchor_spl::token_interface`, switch to `transfer_checked`, validate mint extensions (permanent delegate, transfer fee, mint-close authority), and add delta-aware accounting.

**Status: Fixed (documented + type-enforced).** Added a module-level doc comment in `lib.rs` stating the classic-SPL-only stance and why (no Token-2022 transfer fee / permanent delegate / transfer-hook handling). The `anchor_spl::token::{Mint, TokenAccount, Token}` types already reject Token-2022 mints and accounts by deserialization; the doc makes the deliberate scope decision explicit. The migration path is recorded for any future Token-2022 work.

### 9. Low - Authority-chosen recipient enables self-transfer / duplicate-account in release_token

**Location:** `release_token`, `Release`.

**Description.** `recipient` is an `UncheckedAccount` and `recipient_ata` is constrained only by `associated_token::authority = recipient`. The authority fully chooses both. Setting `recipient = campaign` makes `recipient_ata == escrow_ata`, producing a no-op self-transfer that still advances `approval.released` and `campaign_asset.released`, burning approved headroom without moving funds. No direct theft, but it can corrupt released accounting and the audit trail.

**Remediation.** Reject `recipient_ata.key() == escrow_ata.key()` and `recipient == campaign`. Consider constraining the recipient to a value committed in the proof.

**Status: Fixed.** `release_token` now rejects `recipient_ata.key() == escrow_ata.key()` and `recipient.key() == campaign.key()` (`InvalidRecipient`) before any state change, so a no-op self-transfer cannot advance `released` counters. Covered by `release_token_rejects_self_transfer`.

### 10. Low - `set_approver` can collapse separation of duties

**Location:** `set_approver` (and the `initialize_campaign` default).

**Description.** `initialize_campaign` sets `approver = authority` by default, and `set_approver` lets the authority set the approver to any pubkey including the authority itself. The AGENTS.md hard rule is "never let one key do both," but the program permits and defaults to exactly that. Every separation-of-duties guarantee is therefore opt-in and authority-revocable at will.

**Exploit path.** Authority sets `approver = authority`, then performs `record_proof` and `release` with one key, defeating the dual-control intent and amplifying findings 2 and 4.

**Remediation.** Enforce `new_approver != campaign.authority` in `set_approver`, and require an explicit distinct approver at `initialize_campaign` (do not default to the authority). Optionally gate release on `campaign.approver != campaign.authority`.

**Status: Fixed (re-graded High in the remediation spec).** `initialize_campaign` now takes an explicit `approver: Pubkey` and requires `approver != authority` (`ApproverIsAuthority`); it no longer defaults `approver = authority`. `set_approver` rejects `new_approver == campaign.authority`. `release` and `release_token` additionally gate on `campaign.approver != campaign.authority` as belt-and-suspenders. Covered by `initialize_campaign_rejects_self_approver` and `set_approver_rejects_authority`.

### 11. Informational - Refund truncation locks dust

**Location:** `refundable`.

**Description.** `((contributed * remaining) / raised)` truncates toward zero per donor. The sum of refunds is therefore `<= remaining`, leaving a few lamports/atoms of dust permanently in the campaign PDA / escrow ATA with no sweep path. Not exploitable, but funds are stranded.

**Remediation.** Provide an authority sweep of residual dust to a treasury after refunds settle, or allocate the remainder to the final claimant.

**Status: Acknowledged (no code change this increment).** The pro-rata truncation in `refundable` is unchanged to preserve AD-4 semantics. Decision deferred per the spec: either add an authority dust-sweep to a treasury after refunds settle, or allocate the remainder to the final claimant. Tracked as future work.

### 12. Informational - Committed proof hash is never verified or bound

**Location:** `record_proof*`, `release*`.

**Description.** The approver commits `hash` (rejecting only the all-zero sentinel), but `release` only checks `hash != NATIVE_ASSET`; the content the hash represents is never verified on-chain, and `hash` is not bound to the released `amount` or `recipient`. The hash is a pure off-chain attestation. This is by design, but reviewers should not read the on-chain check as proof verification, and `hash` overwrites on re-record (finding 5).

**Remediation.** Document that the hash is an off-chain commitment only. If stronger guarantees are wanted, bind the hash to `(amount, recipient, tranche, asset)` and make it write-once.

**Status: Documented (by design).** A module-level doc comment in `lib.rs` now states that `hash` is an off-chain attestation only and the on-chain check is presence (`hash != NATIVE_ASSET`), not verification. With finding 5, each proof is already write-once. Binding `hash` to `(amount, recipient, tranche, asset)` remains future work.

## Improvement recommendations

1. Add a program `Config` PDA with an `admin` and gate `register_token` (finding 1). Treat the allowlist as privileged state.
2. Bound every release and the cumulative approved total to funds actually raised, per asset, and protect the rent-exempt reserve on every lamport debit (findings 2, 3).
3. Replace `init_if_needed` with `init` for `Approval` and add a campaign-level tranche counter and `total_approved <= raised` invariant (findings 4, 5).
4. Adopt delta-aware token accounting (measure ATA balance before/after CPI) and keep classic-SPL-only enforcement explicit; document the Token-2022 stance (findings 6, 8).
5. Re-derive and verify the canonical `campaign` PDA (seeds + stored bump) in every context, and forbid `approver == authority` (findings 7, 10).
6. Add negative tests to the litesvm suites for each finding: over-approval beyond raised, release draining the rent reserve, mint registration by a non-admin, approval re-record raising the ceiling, and self-transfer release. Aim to keep coverage at the project's 95% floor.
7. Run `cargo-audit` and the full litesvm suite in `chain/docker/` and require zero new findings before any deploy, per the project's hard rules.

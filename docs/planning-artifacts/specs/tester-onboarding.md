---
name: Tester Onboarding
type: feature-spec
altitude: feature
status: draft
created: '2026-06-30'
inherits: [AD-2, AD-5, AD-11, AD-12, AD-13]
spine: docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md
---

# Feature Spec: Tester Onboarding

## Goal

Gate the 10 mainnet tester spots to real, accountable people; link a verified contact channel (Telegram); and pay the $10 reward only after a completed test run, not on signup.

## Inherited invariants (binding, from the spine)

- **AD-13:** eligibility uses public-identity signals; rewards are capped, manual, out-of-band, and never relax escrow or proof rules.
- **AD-11:** X identity is server-side and is never a money authority; X does not return email, so the user-supplied email is validated separately.
- **AD-12:** Telegram is linked only via a single-use, short-TTL deep-link token; it is never a money authority.
- **AD-2:** the `tester_whitelist` and `telegram_chats` tables are a rebuildable projection, never authoritative over money.

## Eligibility gate (evaluated at claim time, server-side on the apex Worker)

1. **X account quality** (one RapidAPI `/user` call):
   - `followers_count` >= 25
   - account age >= ~2 years, from `result.data.user.result.core.created_at` (Twitter date format)
   - sane ratio: reject when `friends_count` > 20x `followers_count` and `followers_count` < 50
   - not `default_profile_image`; has a non-empty bio; `statuses_count` > 0
2. **Follow @aidprotocol\_:** auto-checked by scanning our own follower list via `/followers` (our follower count is small, so this is cheap and reliable). Required.
3. **Email validity:** format check (already present) plus rejection of disposable/temporary domains via a maintained blocklist.

Each rejection returns a clear, specific reason.

## Verified contact (Telegram)

- Issue a single-use deep-link token (KV, ~15 min TTL) bound to the authenticated X session.
- Present a button: `https://t.me/AidProtocolBot?start=<token>`.
- On `/start <token>`, the webhook links `chat_id` to the `x_id`, deletes the token (single-use), and replies with confirmation.
- The claim screen polls status until Telegram is linked.

## Test and payout

- Collect the payout wallet address and chain.
- The bot sends the test task; the tester completes it on mainnet and submits feedback.
- The $10 USDC reward is paid on completion, recorded against the row, and is manual and out-of-band (never from campaign escrow, AD-13).

## Data

- `tester_whitelist`: add `telegram_chat_id`, `wallet_address`, `wallet_chain`, `followers`, `following`, `account_created`, `status` (`pending` | `verified` | `testing` | `completed` | `paid`), `score`, `reasons`.
- KV: single-use Telegram link tokens.

## Acceptance criteria

- [ ] An account below any quality threshold (followers, age, ratio, no bio, default avatar) is rejected with a specific reason.
- [ ] A disposable email domain is rejected.
- [ ] A non-follower of @aidprotocol\_ is rejected automatically.
- [ ] Telegram linking via the deep-link token succeeds and the token is single-use.
- [ ] A spot is reserved at claim; the $10 is marked paid only after a completed test.
- [ ] No `tester_whitelist` or `telegram_chats` row can authorize money movement; payouts are manual and out-of-band.

## Out of scope (this increment)

- Ambassador program, aid-request trust scoring, and email-channel 2FA (the latter needs a Resend provider key).

## Open items (resolved)

- **Account-age data source: RESOLVED.** The creation date lives at `result.data.user.result.core.created_at` (not `legacy`). The age gate is fully automatable from the single `/user` call.

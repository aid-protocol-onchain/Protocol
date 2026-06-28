# aid_escrow (Solana)

Anchor program for the Solana side of Aid Protocol's escrow and proof-gated
milestone release (ADR-001). Mirrors the EVM `AidEscrow` contract.

## Accounts

- `Campaign` PDA, seeds `[b"campaign", id_le]`: authority (Squads), requester, id, tier, goal, raised, released, first_tranche_bps, frozen.
- `DonorProfile` PDA, seeds `[b"donor", donor]`: total_donated, donation_count (FR13).
- `ProofState` PDA, seeds `[b"proof", campaign, tranche_le]`: proven flag for a tranche (ADR-003 gate).

## Instructions

- `initialize_campaign(id, tier, goal, first_tranche_bps)` authority only.
- `donate(amount, anonymous)` moves SOL into the escrow PDA and accrues the donor profile.
- `record_proof(tranche)` authority only; marks a tranche proven.
- `release_tranche(tranche, amount)` authority only; tranche 0 capped at the tier share, later tranches require the prior proof.
- `freeze()` authority only.
- `redirect()` authority only; moves undisbursed lamports to another campaign and freezes the source (FR12).

## Build and test (Docker only, AD-10)

```
make solana-build
make solana-test
```

## TODO

- SPL token donations (native SOL is implemented first).
- Squads multisig wiring for the authority in deployment.
- Rent-exempt floor handling on escrow withdrawals.

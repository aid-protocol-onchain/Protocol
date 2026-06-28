# Aid Protocol contracts

The on-chain core, replicated per chain behind a shared logical contract (ADR-005).
Both chains build and test only inside Docker (AD-10).

## Layout

- `evm/` Solidity escrow contract (`AidEscrow`) for Ethereum mainnet and Base, with Foundry tests.
- `solana/` Anchor program (`aid_escrow`) for Solana.
- `docker/` pinned toolchain images (Foundry, Anchor) plus a compose file.

## Behavior (both chains)

1. Create a campaign with a tier and a first-tranche cap.
2. Donors fund the escrow; contributions are recorded on-chain.
3. The first tranche releases up to the tier cap; later tranches release only after the prior tranche proof is recorded (ADR-001 / ADR-003).
4. A multisig authority (Safe on EVM, Squads on Solana) can freeze a campaign and redirect undisbursed funds to another campaign for the same disaster (FR12).

## Commands (from repo root)

```
make evm-build      # compile the EVM contract in Docker
make evm-test       # run the Foundry test suite in Docker
make solana-build   # build the Anchor program in Docker
make solana-test    # run the Anchor tests in Docker
```

## Notes

- ETH and the native SOL path are implemented first; ERC-20 and SPL token paths are tracked follow-ups.
- Audits are required before any mainnet deployment that handles real funds (NFR12).

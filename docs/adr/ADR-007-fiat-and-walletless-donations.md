# ADR-007: Fiat and walletless donations

Status: proposed

## Context

Today a donor must connect a browser wallet (MetaMask or Phantom), hold crypto, and pay gas. That excludes most people. We want two things:

1. Walletless giving: no browser extension and no seed phrase.
2. Fiat giving: pay with a card or bank, not crypto the donor already owns.

The hard constraint is our accounting model. Donations are recorded by calling the escrow `donate` / `donate_token` instruction, which credits the donor, updates per-asset totals, and emits events. A fiat on-ramp only sends crypto to an address; it cannot call a contract function. So sending on-ramp output straight to the escrow would bypass donor accounting, proofs, refunds, and leaderboards. The donation has to originate from a wallet the donor controls, which then calls `donate`.

We also must protect the non-custodial property. If the platform ever holds donor fiat or crypto and donates on their behalf, the platform becomes a money handler (custody plus likely money-transmitter obligations). That is a heavy regulatory step and breaks the trust model.

## Decision

Adopt a layered approach, in phases, that preserves non-custodial on-chain accounting:

1. **Walletless via embedded smart wallets.** Let donors sign in with email, social, or passkey. The provider creates a smart account the donor controls (non-custodial), with no extension and no seed phrase. The app calls `donate` from that account.
2. **Gasless via account abstraction.** Sponsor gas with a paymaster (ERC-4337 / ERC-7702) so the donor never needs the native coin for fees. The platform absorbs the (tiny on Base and Solana) gas cost.
3. **Fiat via an integrated on-ramp into that embedded wallet.** The donor pays by card; the on-ramp (a regulated provider that performs its own KYC) delivers USDC into the donor's embedded wallet; the app then calls `donate`. We never touch the fiat, so we stay non-custodial.

Net donor experience: "sign in with email, pay with card, donate," with a real on-chain donation through `donate`, full accounting and events intact.

Provider direction (verify integration specifics at build time):

- Base (primary EVM): Coinbase Smart Wallet plus Coinbase Onramp. Passkey login at no cost, and free USDC purchases on Base. Cheapest and cleanest first integration.
- Multi-chain (Ethereum, Base, and Solana): Privy or Web3Auth or Para for embedded wallets across EVM and Solana, paired with an on-ramp aggregator (Onramper, Transak, or MoonPay) for card to USDC. Privy supports registering a paymaster for gasless flows and supports Solana.

A pure-fiat fallback for donors who refuse any wallet step (Phase 3): route through a regulated intermediary or donor-advised platform (for example Every.org or BitPay) that takes custody and compliance and grants cash to the entity. These donations are pooled and are recorded off-chain, clearly labeled as fiat (pooled), distinct from the on-chain ledger. This path requires the legal entity (already a launch gate, see the non-profit structure decision).

## Alternatives considered

- On-ramp sends crypto straight to the escrow address. Rejected: it cannot call `donate`, so it bypasses accounting, proofs, refunds, and leaderboards.
- Platform-relayed fiat: the platform collects fiat and a platform hot wallet donates on the donor's behalf. Rejected for the core flow: it makes the platform custodial and likely a money transmitter, and breaks the non-custodial trust model.
- Pure web2 card processor (Stripe, PayPal, Donorbox) recording only off-chain donations. Useful as a fallback but not the primary path, because the donation would not be on-chain or per-donor verifiable, which is the product's whole point.

## Consequences

- Donors can give with email login and a card, gas-free, while the donation stays a real, non-custodial, on-chain `donate` call. Accounting, proofs, refunds, and leaderboards all keep working unchanged.
- KYC moves to the on-ramp provider, not us. Fiat donations are therefore not anonymous at the provider level, though they remain pseudonymous on-chain. Native crypto donations from a self-custodied wallet keep the existing public-or-anonymous choice.
- We take on a small gas-sponsorship cost (paymaster) and on-ramp fees apply to the donor (roughly low single-digit percent; Coinbase Onramp on Base is notably cheap for USDC).
- New third-party dependencies (embedded wallet SDK, on-ramp). We isolate them behind the existing wallet adapter boundary so the rest of the app does not import them directly.
- The Phase 3 fiat-pooled fallback depends on forming the legal entity and adds reconciliation between off-chain fiat and the on-chain ledger.

## Phasing

1. Base: Coinbase Smart Wallet plus Coinbase Onramp, gasless `donate` via paymaster.
2. Multi-chain: Privy or equivalent embedded wallets for Ethereum, Base, and Solana, plus an on-ramp aggregator.
3. Optional pure-fiat pooled donations via a regulated intermediary, after the entity exists.

## Sources

- Coinbase Onramp: https://www.coinbase.com/developer-platform/products/onramp
- Top crypto on-ramps 2026: https://cryptonews.com/cryptocurrency/best-crypto-on-ramp/
- Best embedded wallets 2026: https://www.openfort.io/blog/top-10-embedded-wallets
- Privy smart wallets and paymasters: https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/overview
- Nonprofit crypto donations without custody (intermediaries): https://www.councilofnonprofits.org/articles/what-your-nonprofit-needs-know-about-cryptocurrency-donations

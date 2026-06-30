# Aid Protocol: Grants and Sponsorships

A reusable pitch for grant applications plus a target list of foundations, public-goods rounds, impact funders, and infrastructure sponsorships. Aid Protocol is a non-profit, open-source public good, which is exactly what most of these programs exist to fund.

## 1. The pitch (reusable boilerplate)

**One line.** Aid Protocol is a non-profit, open-source, multi-chain platform that routes disaster-relief donations through proof-gated escrow, so every dollar is recorded on-chain and released only against verified proof of spend.

**The problem.** Disaster relief runs on opacity. Donors cannot see where money goes, disbursement is slow, fraud is common, and cross-border transfers are expensive and delayed. Distrust suppresses giving exactly when speed matters most.

**The solution.** Each campaign gets its own non-custodial escrow contract. Donations are recorded on-chain and released in tranches only after proof of spend for the prior tranche passes an AI plus human verification pass. Donors give publicly or anonymously on Solana or Ethereum and Base, build public on-chain reputation, and a core-team multisig can freeze a campaign and redirect undisbursed funds to another verified campaign for the same disaster. No token, no DAO, non-custodial, stablecoin-preferred.

**Why crypto, specifically.** Transparency by construction (on-chain is the source of truth), instant global settlement, stablecoin rails into disaster zones, and programmatic accountability (proof-gated release, freeze and redirect on fraud). None of this is possible with traditional rails.

**Why it is a public good.** MIT-licensed and fully open-source. The proof-gated escrow primitive, the canonical multi-chain donation model, and the donor-reputation layer are reusable by anyone. It serves the commons, not a token economy.

**Traction (honest, pre-launch).** Live on test networks: Solana devnet, Ethereum Sepolia, and Base Sepolia. Working escrow contracts on both stacks (Anchor program plus EVM factory and per-campaign escrow), a live app, a public apex site, a tester whitelist with public-identity gating, a Telegram verification and reminder bot, multi-chain wallet connect (including Coinbase Smart Wallet), automated disaster-news ingestion, and a donor leaderboard. Mainnet is gated on a security audit, which is the primary thing we are raising for.

**Use of funds (fundable milestones).** In priority order:
1. **Smart-contract security audits** on both chains (the gate to mainnet, the single most fundable line item for a money-handling protocol).
2. The **AI proof-of-spend verification pipeline** (authenticity plus moderation, with human escalation).
3. **Gasless donations** (Base and Solana paymaster integration) so small donors and disaster-zone recipients pay no gas.
4. **Indexing and reliability** infrastructure across chains.
5. **Reviewer and ops tooling** for the human verification path.
6. Tester and ambassador program and operating runway.

**The ask.** Tiered per program, typically 30k to 150k USD, tied to the milestones above (audits first).

## 2. Foundation targets

### Solana Foundation
- **Program:** standard grants, convertible grants, and RFPs, applied for at [solana.org/grants-funding](https://solana.org/grants-funding). Reviewed on a rolling basis; public-good projects qualify on open-source plus a free community offering.
- **Why we fit:** open-source public good on Solana with real-world payments utility. Solana's narrative leans hard into real-world use and payments.
- **The hook:** our Anchor escrow program, USDC settlement, and Solana Pay style micro-donations into disaster zones at near-zero fees. Lead with the open-source Solana escrow primitive and the audit milestone.

### Base (Coinbase)
- **Programs:** [Base Builder Grants](https://docs.base.org/get-started/get-funded) (retroactive, roughly 1 to 5 ETH, nomination-based, rewards shipped work) and [CDP Builder Grants](https://www.coinbase.com/developer-platform/discover/launches/builder-grants-round2) (cohort rounds, around 25k USD), plus the Base Ecosystem Fund.
- **Why we fit:** we already deploy on Base Sepolia and already integrate Coinbase Smart Wallet. Base rewards live, shipped onchain apps and payments.
- **The hook:** ship to Base mainnet, wire the CDP paymaster for gasless donations, then get nominated retroactively for a Builder Grant. This is our most natural near-term grant because the work is already mostly built.

### Ethereum Foundation (ESP)
- **Program:** [Ecosystem Support Program](https://esp.ethereum.foundation/) via Wishlist and RFPs. Small grants 5k to 30k, standard 30k to 200k, large 200k+. Funded work must be open-source.
- **Why we fit:** open-source public good with real-world impact, plus a cryptography and verification research angle (proof-of-spend) and a clear security-audit need, all of which map to recent ESP priorities.
- **The hook:** frame the proof-gated escrow and donor-transparency layer as a reusable public good, and the audit and verification pipeline as the funded, open-source deliverables.

## 3. Other grants and public-goods rounds

| Source | Fit for Aid Protocol | Typical size |
| --- | --- | --- |
| [Gitcoin Grants](https://gitcoin.co/) (quadratic-funding and impact rounds) | Strong: non-profit open-source social impact; donor matching amplifies small gifts | Match-dependent |
| [Optimism Retro Funding](https://gitcoin.co/apps/optimism-retropgf) | Deploy on Optimism / the Superchain, then claim retro funding for demonstrated impact | One-time OP grants |
| [Stellar Community Fund](https://communityfund.stellar.org/) | Strong: Stellar has a deep humanitarian and USDC cash-assistance track (UNHCR Ukraine via USDC). A Stellar or Soroban deployment for cash assistance fits well | 15k to 150k+ |
| [UNICEF Venture Fund / Office of Innovation](https://www.unicef.org/innovation/equity-free-funding-blockchain-solutions) | Very strong: equity-free funding for blockchain solutions for social impact, with mentorship; disaster and humanitarian focus aligns directly | ~100k equity-free + support |
| Celo Public Goods / ReFi (Prezenti, Celo grants) | Strong: mobile-first, stablecoin, regenerative and impact focus | Varies |
| Arbitrum, Polygon, and other L2 ecosystem grants | Medium: tied to deploying on that chain | Varies |
| Circle / USDC impact programs | Medium to strong: we use USDC as the settlement default; Circle backs stablecoin-for-good work | Varies |
| Chainlink BUILD, Pyth grants | Medium: oracle and price-feed integration grants (we stamp USD value at donation time) | Credits + tokens |
| Hackathons (Solana, ETHGlobal) | Tactical: non-dilutive prizes plus visibility and judge access to the foundations above | 1k to 50k prizes |

## 4. Infrastructure sponsorships (credits, not cash, but they extend runway)

- **Cloudflare Project Galileo / Cloudflare for Startups.** Project Galileo provides free protection and services to public-interest and humanitarian organizations. We are Cloudflare-only, so this is a direct fit and worth pursuing early.
- **Helius (Solana RPC and webhooks)** and **Alchemy or QuickNode (EVM)** for sponsored infrastructure credits; we use these for indexing.
- **Coinbase Developer Platform** paymaster credits for gasless donations on Base.
- **The Giving Block, Endaoment, Crypto Altruism** for crypto-philanthropy distribution, fiscal-sponsorship, and visibility to crypto-native donors.

## 5. How to apply well

- Lead every application with the **open-source public-good** framing and a concrete, **fundable milestone** (audits first). Vague asks lose; "audit the Solana and EVM escrow contracts" wins.
- Show **shipped work**. Retroactive programs (Base, Optimism) and impact funders reward live products over proposals; point them at the testnet deployments and the live app.
- Tailor the chain-specific angle per funder (Solana program for Solana, Base mainnet plus paymaster for Base, the public-good primitive for the EF).
- Keep the non-profit, no-token, no-DAO posture front and center. It removes the speculation concern that sinks many grant applications and is the reason impact funders like UNICEF can engage.
- Apply in parallel; these are non-exclusive. The audit can be co-funded across several.

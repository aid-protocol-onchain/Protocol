// Legal copy for Aid Protocol (non-profit, open-source). Bracketed placeholders
// like [REGISTERED ENTITY NAME] are intentional and must be filled once the legal
// entity, tax status, and governing jurisdiction are decided.

export const PRIVACY = `# Aid Protocol Privacy Policy

Aid Protocol is a non-profit, open-source platform that records on-chain who donated to registered disaster relief campaigns. This policy explains what data we handle, why, and what you can control. We aim to collect as little as possible.

Effective date: June 28, 2026

## Who we are
Aid Protocol is operated by [REGISTERED ENTITY NAME]. You can reach us at admin@aidprotocol.org or on X at https://x.com/aidprotocol_ for any privacy question.

## Testnet notice
Aid Protocol is currently running on test networks (Sepolia, Base Sepolia, and Solana devnet). During testnet, no real-value funds are involved. Test transactions are still recorded publicly on those test blockchains.

## What data we process and why
- Public wallet addresses. Every donation comes from your own wallet, and the sending address is inherently public on the blockchain. We do not create this data, but it is permanently visible on-chain.
- Optional Twitter/X handle. If you choose to donate publicly, you may attach an X handle so it can be displayed next to your donation. This is entirely optional.
- Anonymous donations. If you donate anonymously, we do not attach or store any personal identity for that donation. We cannot reverse a blockchain address back to a real person, and we do not try to.
- Aid request intake data. Requesters submit details to propose a campaign: an organization or name, a public contact handle, a location, the disaster, a summary, and an optional public evidence URL. This information is intended to be public so donors can assess campaigns.
- Server and edge logs. Our infrastructure provider, Cloudflare, processes standard technical data such as IP address and request metadata. We use this only for security, abuse prevention, and keeping the service running.

We do not run donor accounts, and we do not collect passwords.

## Requester diligence is on public identity only
We vet requesters on public identity only. We do not perform KYC, we do not ask for government IDs, and we do not collect private documents. Our review relies on public presence, for example a public X identity and public evidence links. Campaigns are created on-chain by the core team after off-chain diligence.

## Cookies
We keep cookies and similar technologies to a minimum. Any that we use are essential to operate and secure the site (for example, basic functionality and abuse prevention through Cloudflare). We do not use advertising trackers.

## The public and permanent nature of on-chain data
Donations are recorded directly on public blockchains. On-chain transactions are public, permanent, and irreversible. This means:
- Your wallet address, donation amount, timing, and any handle you chose to attach can be seen by anyone.
- We cannot edit, hide, or delete on-chain records. No one can. This is a property of the blockchain, not a choice we make.

Please only attach an X handle or other identifying detail if you are comfortable with it being public forever.

## We do not sell your data
We do not sell, rent, or trade personal data. We do not share it for advertising. We share data only with infrastructure providers that help us run the service (see below) or where required by law.

## Service providers
We host and run Aid Protocol on Cloudflare (Workers, D1, KV, and R2). Cloudflare processes technical data on our behalf to deliver, secure, and store parts of the service. Public blockchain networks (Solana, Ethereum, and Base) and the wallet software you choose are operated by third parties and are outside our control.

## Data retention
- On-chain data is permanent and cannot be deleted by us or by anyone.
- Off-chain data (such as intake submissions and logs) is kept only as long as needed for the purposes above, then deleted or anonymized. Security logs are typically short-lived.

## International transfers
Aid Protocol is accessible globally, and our providers may process data in countries other than yours. Blockchain data is, by nature, replicated worldwide. By using the service you understand your data may be processed across borders.

## Children's privacy
Aid Protocol is not intended for anyone under 18. We do not knowingly collect data from children. If you believe a child has provided data, contact us and we will address it.

## Your choices and requests
Because we collect very little and store no donor accounts, your main control is choosing to donate publicly or anonymously. For off-chain data we hold, you may contact admin@aidprotocol.org to ask what we have or to request deletion where possible. We cannot alter or remove anything recorded on-chain.

## Changes to this policy
We may update this policy as the platform evolves. We will post the new version with an updated effective date. Material changes will be noted on the site or our X account.

## Contact
Questions about privacy: admin@aidprotocol.org.`;

export const TERMS = `# Aid Protocol Terms of Service

Aid Protocol is a non-profit, open-source platform that lets people donate directly to registered disaster relief campaigns through smart contracts. Please read these terms before using it. They are written plainly because we want you to actually understand them.

Effective date: June 28, 2026

## Who we are
Aid Protocol is operated by [REGISTERED ENTITY NAME] ("Aid Protocol", "we", "us"). Contact: admin@aidprotocol.org or https://x.com/aidprotocol_.

## Testnet disclaimer
Aid Protocol is currently running on test networks (Sepolia, Base Sepolia, and Solana devnet). During testnet, no real-value funds are used. Do not send mainnet assets expecting them to function as donations. Testnet tokens have no monetary value.

## Eligibility
You must be at least 18 years old and legally able to enter these terms. You are responsible for complying with the laws that apply to you, including any local restrictions on cryptocurrency.

## How Aid Protocol works
- Non-custodial. Donations go directly from your own wallet into per-campaign escrow smart contracts. We do not hold donor funds in a bank account. Funds live in the smart contracts.
- Multi-chain. We support Solana (SOL, USDC, USDT) and the EVM chains Ethereum and Base (ETH, USDC, USDT).
- Release in tranches. Funds are released from escrow in tranches only against proof of spend. Proof is filtered by an AI pipeline and approved under separation of duties: one key records the proof, and a separate authority key releases the funds.
- Refunds for fraud. If a campaign is found to be fraudulent or a scam, refunds are enabled on a pull basis. Donors claim their pro-rata share of remaining funds and pay their own gas. Funds already released cannot be recovered.
- Requester vetting. Requesters are vetted on public identity only. There is no KYC and no document collection. Campaigns are created on-chain by the core team after off-chain diligence. We do not guarantee any requester's honesty or any outcome.

## Donations are voluntary gifts
Donations are voluntary gifts. They are likely NOT tax-deductible unless made to a registered charity. Aid Protocol's tax status is [TAX STATUS] and donations are made to or through [REGISTERED ENTITY NAME]. We do not provide tax advice. Please consult your own tax advisor about deductibility in your jurisdiction.

## No token, no profit, no investment
Aid Protocol has no token. There is no expectation of profit, yield, or any financial return. Nothing here is financial, investment, or legal advice. Donating is an act of giving, not an investment.

## Risks you accept
By using Aid Protocol you understand and accept that:
- Smart contracts can contain bugs or vulnerabilities despite our care. Using them carries risk.
- Cryptocurrency prices are volatile. The value of what you donate can change sharply.
- Blockchain transactions are public, permanent, and irreversible. We cannot undo a transaction or recover funds sent in error or to the wrong address.
- We do not guarantee any particular aid outcome. We work to release funds only against proof of spend, but we cannot promise results on the ground.
- Wallets, blockchains, exchanges, and other third-party tools are outside our control. Their failures, fees, or downtime are not our responsibility.

## Governance and open source
There is no DAO. Aid Protocol is open source. Anyone may submit pull requests, which are reviewed and merged by a core team. The code is provided as is, and contributing does not grant any ownership, control, or governance rights over the project.

## Acceptable use
You agree not to:
- Use Aid Protocol for money laundering, terrorist financing, sanctions evasion, fraud, or any illegal purpose.
- Submit false, misleading, or fraudulent campaign requests.
- Attempt to attack, exploit, overload, or interfere with the smart contracts or infrastructure.
- Use the service where doing so would break the laws that apply to you.

We may decline or remove a campaign request at our discretion, but we cannot alter on-chain records once they exist.

## No warranty
Aid Protocol is provided "as is" and "as available", without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the service or smart contracts will be uninterrupted, secure, or error-free.

## Limitation of liability
To the maximum extent permitted by law, Aid Protocol, its operator [REGISTERED ENTITY NAME], its volunteers, contributors, and core team will not be liable for any indirect, incidental, special, consequential, or exemplary damages, or for any loss of funds, profits, or data, arising from your use of the service, smart contract behavior, price volatility, or third-party actions. As a non-profit, open-source project, our total aggregate liability to you is limited to the greater of the amount you paid us directly (which is normally zero) or [LIABILITY CAP AMOUNT].

## Indemnification
You agree to indemnify and hold harmless Aid Protocol, [REGISTERED ENTITY NAME], and its volunteers, contributors, and core team from any claims, losses, or expenses (including reasonable legal fees) arising from your use of the service, your donations or campaign requests, or your breach of these terms.

## Changes to these terms
We may update these terms as the platform evolves. We will post the updated version with a new effective date. Continued use after changes means you accept them.

## Governing law
These terms are governed by the laws of [GOVERNING JURISDICTION], without regard to conflict-of-law rules. Disputes will be handled in the courts of [GOVERNING JURISDICTION], unless applicable law requires otherwise.

## Contact
Questions about these terms: admin@aidprotocol.org.`;

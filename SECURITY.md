# Security Policy

Aid Protocol handles donations meant for people in crisis. We take security seriously and appreciate responsible disclosure.

## Reporting a vulnerability

Please report security issues privately by email to **admin@aidprotocol.org**.

Do **not** open a public GitHub issue, pull request, or social post for a security problem until it has been resolved.

Include, where you can:

- A clear description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- The affected component (EVM contracts, Solana program, Worker API, or web app) and network.

## Scope

In scope:

- The smart contracts in `chain/evm` and `chain/solana` (escrow, release, refund, access control).
- The Cloudflare Worker API and admin endpoints in `app/worker`.
- The web application in `app/src`.

Especially valuable: anything that could let funds be released without valid proof, bypass the approver / authority separation, drain or lock an escrow, break refund accounting, or expose secrets.

## Our commitment

- We will acknowledge your report as quickly as we can.
- We will keep you updated on progress.
- We will credit you once a fix ships, if you would like.

## Testnet notice

The project currently runs on test networks. No real-value funds are at risk during testnet, but we still want to hear about issues so they are fixed before mainnet.

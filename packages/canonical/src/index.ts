// Aid Protocol canonical model.
// Source of truth for the off-chain projection shape (AD-1, AD-2). This package
// must NOT import any chain SDK. Indexers normalize Solana and EVM events into
// these types; the read API and clients consume only this model.

export type Chain = "solana" | "base" | "ethereum";

export type RequesterTier = "L1" | "L2";

export type BadgeTier = "Supporter" | "Bronze" | "Silver" | "Gold" | "Platinum";

export interface Campaign {
  id: string; // canonical id: "<chain>:<nativeId>"
  chain: Chain;
  title: string;
  location: string;
  disaster: string;
  requesterName: string;
  requesterHandle: string;
  requesterTier: RequesterTier;
  firstReleasePct: number;
  raisedUsd: number;
  goalUsd: number;
  donorCount: number;
  status: string;
  icon: string;
}

export interface Donation {
  id: string;
  campaignId: string;
  donorLabel: string;
  isAnonymous: boolean;
  chain: Chain;
  amount: string; // human display, e.g. "250 USDC"
  amountUsd: number; // normalized at donation time
  txUrl: string;
}

export interface ProofItem {
  id: string;
  campaignId: string;
  title: string;
  tranche: number;
  spentUsd: number;
  mediaCount: number;
  aiVerified: boolean;
  icon: string;
  createdAt: string;
}

export interface DonorProfile {
  // aggregated across wallets and chains (optionally under one twitter handle)
  key: string; // "u:<handle>" or "w:<chain>:<address>"
  handle: string | null;
  totalUsd: number;
  causes: number;
  gifts: number;
  chains: Chain[];
  badge: BadgeTier;
}

// canonical id helpers ----------------------------------------------------

export function campaignId(chain: Chain, nativeId: string): string {
  return `${chain}:${nativeId}`;
}

export function evmId(chainId: number, address: string): string {
  return `evm:${chainId}:${address.toLowerCase()}`;
}

export function solId(pubkey: string): string {
  return `sol:${pubkey}`;
}

// badge tiers (fixed USD thresholds, AD-6 / FR14) -------------------------

export function badgeTier(totalUsd: number): BadgeTier {
  if (totalUsd >= 10000) return "Platinum";
  if (totalUsd >= 2500) return "Gold";
  if (totalUsd >= 500) return "Silver";
  if (totalUsd >= 100) return "Bronze";
  return "Supporter";
}

// API envelope ------------------------------------------------------------

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

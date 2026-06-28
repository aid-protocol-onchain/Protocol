import { baseSepolia, sepolia } from "wagmi/chains";

// On-chain deployment addresses (mirror of chain/deployments.json). The factory
// is the same address on both EVM testnets (deterministic CREATE from nonce 0).
export const FACTORY = "0xfBfeA1576980F5E9Fd562cB13621316F0abCC461" as const;

// Per-campaign isolated escrows, keyed by D1 campaign id then EVM chain id.
export const CAMPAIGN_ESCROWS: Record<string, Partial<Record<number, `0x${string}`>>> = {
  "ve-quake-2026": {
    [baseSepolia.id]: "0x27BdE55Cffdd3493E1437cfB9b8986D7C953c822",
  },
};

// UI chain key -> wagmi chain id. "base" maps to Base Sepolia while we are on testnet.
export const EVM_CHAIN_ID: Record<string, number> = {
  base: baseSepolia.id,
  ethereum: sepolia.id,
};

export const EXPLORER_TX: Record<number, string> = {
  [baseSepolia.id]: "https://sepolia.basescan.org/tx/",
  [sepolia.id]: "https://sepolia.etherscan.io/tx/",
};

export function escrowFor(campaignId: string, chainId: number): `0x${string}` | undefined {
  return CAMPAIGN_ESCROWS[campaignId]?.[chainId];
}

// Minimal ABI for the donor-facing escrow entry points.
export const ESCROW_ABI = [
  {
    type: "function",
    name: "donateNative",
    stateMutability: "payable",
    inputs: [{ name: "isAnonymous", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "donateToken",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "isAnonymous", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

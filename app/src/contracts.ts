import { baseSepolia, sepolia } from "wagmi/chains";

// On-chain deployment addresses (mirror of chain/deployments.json). Factory
// addresses differ per chain (CREATE from the deployer nonce on each chain).
export const FACTORIES: Record<number, `0x${string}`> = {
  [baseSepolia.id]: "0x22E9d2ba9580aC72BbDc4A85B4dAd454E5e1d843",
  [sepolia.id]: "0x93f85a3C7DD94B4815c317b341982C82c47755fB",
};

export function factoryFor(chainId: number): `0x${string}` | undefined {
  return FACTORIES[chainId];
}

// Per-campaign isolated escrows, keyed by D1 campaign id then EVM chain id.
export const CAMPAIGN_ESCROWS: Record<string, Partial<Record<number, `0x${string}`>>> = {
  "ve-quake-2026": {
    [baseSepolia.id]: "0x6b3FD9883826031DfEa01926eB0c015bA9165805",
    [sepolia.id]: "0xB02A8820F11dBA74545b5E3b8D27579b96A03331",
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

export const CHAIN_NAME: Record<number, string> = {
  [baseSepolia.id]: "Base Sepolia",
  [sepolia.id]: "Sepolia",
};

export function escrowFor(campaignId: string, chainId: number): `0x${string}` | undefined {
  return CAMPAIGN_ESCROWS[campaignId]?.[chainId];
}

// Whitelisted test stablecoins per EVM chain (6 decimals, open-mint test tokens).
export const TOKEN_DECIMALS = 6;
export const TOKENS: Record<number, { USDC: `0x${string}`; USDT: `0x${string}` }> = {
  [baseSepolia.id]: {
    USDC: "0xbEE095934e857c8661E7906E5178b794AE512E6b",
    USDT: "0x93f85a3C7DD94B4815c317b341982C82c47755fB",
  },
  [sepolia.id]: {
    USDC: "0xFe00F83207d35A1d339A148941445b446B2f46C3",
    USDT: "0x7F52db5e4a91da74745a6030ed4bcDE3e29b40CD",
  },
};

// Chain ids this campaign has a deployed escrow on.
export function campaignChainIds(campaignId: string): number[] {
  return Object.keys(CAMPAIGN_ESCROWS[campaignId] ?? {}).map(Number);
}

// ---- Solana (devnet) ----
export const SOLANA_PROGRAM_ID = "AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT";
export const SOLANA_RPC = "https://api.devnet.solana.com";
export const SOLANA_EXPLORER_TX = "https://explorer.solana.com/tx/"; // append ?cluster=devnet

export interface SolanaCampaign {
  id: number; // u64 campaign id used in the PDA seed
  campaignPda: string;
}

// Per-campaign Solana deployment, keyed by the D1 campaign id.
export const SOLANA_CAMPAIGNS: Record<string, SolanaCampaign> = {
  "ve-quake-2026": { id: 2, campaignPda: "2c4ugT3iEV9uoqmwNxoZ2GDNSPPHm9ZA9qpqtcquCHuY" },
};

// Whitelisted SPL mints on devnet (6 decimals).
export const SOLANA_TOKENS: { USDC: string; USDT: string } = {
  USDC: "4Hpm8L2sUFUWPUbqZjYC6mbVRSV7W32WBMUeY9ndA1Fr",
  USDT: "FH573FJpQi2UdE9Z1hXjWp3D4NJr3euq9LE9NV4GBgTp",
};

export function solanaCampaign(campaignId: string): SolanaCampaign | undefined {
  return SOLANA_CAMPAIGNS[campaignId];
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

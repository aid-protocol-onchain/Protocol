export interface Campaign {
  id: string;
  title: string;
  location: string;
  disaster: string;
  requester_name: string;
  requester_handle: string;
  requester_tier: "L1" | "L2";
  first_release_pct: number;
  raised_usd: number;
  goal_usd: number;
  donor_count: number;
  status: string;
  icon: string;
}

export interface Proof {
  id: string;
  campaign_id: string;
  title: string;
  tranche: number;
  spent_usd: number;
  media_count: number;
  ai_verified: number;
  icon: string;
  created_at: string;
}

export interface Donation {
  id: string;
  campaign_id: string;
  donor_label: string;
  is_anonymous: number;
  chain: "solana" | "base" | "ethereum";
  amount: string;
  amount_usd: number;
  tx_url: string;
}

export interface CampaignDetail {
  campaign: Campaign;
  proofs: Proof[];
  donations: Donation[];
}

export interface RecentDonation {
  id: string;
  donor_label: string;
  is_anonymous: number;
  chain: "solana" | "base" | "ethereum";
  amount: string;
  amount_usd: number;
  campaign_title: string;
  campaign_id: string;
}

export interface LeaderEntry {
  donor_label: string;
  total_usd: number;
  causes: number;
  gifts: number;
  chains: string; // comma-separated
}

export interface AidRequest {
  id: string;
  org_name: string;
  contact_handle: string;
  location: string;
  disaster: string;
  summary: string;
  goal_usd: number;
  evidence_url: string;
  status: "pending" | "approved" | "rejected";
  diligence_notes: string;
  reviewer: string | null;
  campaign_id: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface DonorAssetBreakdown {
  sol: number;
  eth: number;
  usdc: number;
  usdt: number;
  stable: number;
}

export interface DonorProfileData {
  handle: string;
  totalUsd: number;
  causes: number;
  gifts: number;
  chains: string;
  assets: DonorAssetBreakdown;
  donations: {
    amount: string;
    amount_usd: number;
    chain: "solana" | "base" | "ethereum";
    campaign_title: string;
    campaign_id: string;
  }[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: "update" | "news";
  campaign_id: string | null;
  source: string;
  published_at: string;
  icon: string;
  link?: string | null;
  auto?: number;
  hidden?: number;
}

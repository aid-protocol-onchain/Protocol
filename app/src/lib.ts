export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const pct = (raised: number, goal: number) =>
  goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

export const chainPill: Record<string, { cls: string; label: string }> = {
  solana: { cls: "pill-sol", label: "Solana" },
  base: { cls: "pill-eth", label: "Base" },
  ethereum: { cls: "pill-eth", label: "Ethereum" },
};

export interface Tier { name: string; bg: string; fg: string; }
export function badgeTier(totalUsd: number): Tier {
  if (totalUsd >= 10000) return { name: "Platinum", bg: "#eeeafe", fg: "#5b3fd6" };
  if (totalUsd >= 2500) return { name: "Gold", bg: "#fbf0d6", fg: "#9a6a08" };
  if (totalUsd >= 500) return { name: "Silver", bg: "#eef2f6", fg: "#5b6675" };
  if (totalUsd >= 100) return { name: "Bronze", bg: "#fdeee6", fg: "#b4541f" };
  return { name: "Supporter", bg: "#e8f3fe", fg: "#1268c9" };
}

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

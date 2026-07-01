import i18n from "./i18n";

// Map the active app locale (en / es) to a BCP-47 tag for Intl. We use es-US for
// Spanish so donors keep the leading "$" and the grouping/format that
// disaster-relief donors expect, while still localizing separators and words.
// Revisit the exact pattern with the native Spanish reviewer before launch.
const INTL_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es-US",
};

function activeIntlLocale(): string {
  const lng = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  return INTL_LOCALE[lng] || "en-US";
}

export const usd = (n: number, locale?: string) =>
  new Intl.NumberFormat(locale || activeIntlLocale(), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const num = (n: number, locale?: string) =>
  new Intl.NumberFormat(locale || activeIntlLocale()).format(n);

// Locale-aware date formatting. Stored values stay UTC ISO-8601; only display is
// localized. Falls back to the raw string if the value is not a parseable date.
export const formatDate = (value: string | number | Date, locale?: string) => {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale || activeIntlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
};

export const pct = (raised: number, goal: number) =>
  goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

export const chainPill: Record<string, { cls: string; label: string }> = {
  solana: { cls: "pill-sol", label: "Solana" },
  base: { cls: "pill-eth", label: "Base" },
  ethereum: { cls: "pill-eth", label: "Ethereum" },
};

// Badge tier names stay English proper nouns by product decision (see spec 3);
// only the surrounding labels are translated.
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

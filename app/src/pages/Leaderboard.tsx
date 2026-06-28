import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Campaign, LeaderEntry } from "../types";
import { api, usd, badgeTier, chainPill } from "../lib";

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderEntry[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cause, setCause] = useState("");
  const [cat, setCat] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>("/api/campaigns").then((d) => setCampaigns(d.campaigns)).catch(() => {});
  }, []);

  useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams();
    if (cause) qs.set("cause", cause);
    if (cat) qs.set("category", cat);
    const q = qs.toString();
    api<{ leaderboard: LeaderEntry[] }>(`/api/leaderboard${q ? `?${q}` : ""}`)
      .then((d) => setRows(d.leaderboard))
      .catch((e) => setErr(String(e)));
  }, [cause, cat]);

  const cats: [string, string][] = [
    ["", "All"],
    ["sol", "Most SOL"],
    ["eth", "Most ETH"],
    ["stable", "Most stable"],
  ];

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Donor leaderboard</div>
        <h1>The people <span className="grad-text">keeping the lifeline open.</span></h1>
        <p>Ranked by total given, normalized to USD across Solana and Ethereum. Anonymous gifts stay private and aren't listed.</p>
      </section>

      <div className="lbcats">
        {cats.map(([v, label]) => (
          <button key={v} className={`lbcat${cat === v ? " on" : ""}`} onClick={() => setCat(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>{cat === "stable" ? "Most stable (USDC + USDT)" : cat === "sol" ? "Most SOL" : cat === "eth" ? "Most ETH" : "Top donors"}</h2>
        <select className="inp" style={{ width: "auto" }} value={cause} onChange={(e) => setCause(e.target.value)}>
          <option value="">All causes</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {err && <div className="loading">Couldn't load the leaderboard. {err}</div>}
      {!rows && !err && <div className="loading">Loading…</div>}

      {rows && (
        <div className="panel" style={{ padding: 0 }}>
          {rows.map((r, i) => {
            const tier = badgeTier(r.total_usd);
            return (
              <Link className="lb-row" to={`/u/${r.donor_label.replace("@", "")}`} key={r.donor_label}>
                <div className={`lb-rank${i < 3 ? " top" : ""}`}>{i + 1}</div>
                <div className="lb-av">{r.donor_label.replace("@", "").slice(0, 2).toUpperCase()}</div>
                <div className="lb-who">
                  <div className="lb-name">{r.donor_label}</div>
                  <div className="lb-meta">
                    {r.causes} cause{r.causes > 1 ? "s" : ""} · {r.gifts} gift{r.gifts > 1 ? "s" : ""}
                    {(r.chains || "").split(",").map((ch) => {
                      const cp = chainPill[ch.trim()];
                      return cp ? <span key={ch} className={`pill ${cp.cls}`} style={{ marginLeft: 6, fontSize: 11 }}>{cp.label}</span> : null;
                    })}
                  </div>
                </div>
                <span className="pill" style={{ background: tier.bg, color: tier.fg }}>{tier.name}</span>
                <div className="lb-total">{usd(r.total_usd)}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

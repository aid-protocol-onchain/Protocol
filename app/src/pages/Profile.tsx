import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { DonorProfileData } from "../types";
import { api, usd, badgeTier, chainPill } from "../lib";

// Donor profile: /u/:handle (Twitter) or /w/:wallet (on-chain address).
export function Profile({ kind }: { kind: "u" | "w" }) {
  const params = useParams();
  const id = kind === "u" ? params.handle : params.wallet;
  const [data, setData] = useState<DonorProfileData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setErr(null);
    if (!id) return;
    const key = `${kind}:${id}`;
    api<{ donor: DonorProfileData }>(`/api/donor/${encodeURIComponent(key)}`)
      .then((d) => setData(d.donor))
      .catch((e) => setErr(String(e)));
  }, [kind, id]);

  if (err) {
    return (
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Donor profile</div>
        <h1>No public record</h1>
        <p>
          We couldn't find public donations for <strong>{kind === "u" ? `@${id}` : id}</strong>. They may have given
          anonymously, or not yet given to a registered disaster.
        </p>
        <Link className="btn" to="/leaderboard">See the leaderboard</Link>
      </section>
    );
  }

  if (!data) return <div className="loading">Loading…</div>;

  const tier = badgeTier(data.totalUsd);
  const assets: [string, number][] = [
    ["SOL", data.assets.sol],
    ["ETH", data.assets.eth],
    ["Stable (USDC + USDT)", data.assets.stable],
  ];

  return (
    <>
      <section className="profile-head">
        <div className="profile-av">{data.handle.replace("@", "").slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="eyebrow">{kind === "u" ? "Twitter donor" : "Wallet donor"}</div>
          <h1 style={{ margin: "4px 0 8px" }}>{data.handle}</h1>
          <span className="pill" style={{ background: tier.bg, color: tier.fg }}>{tier.name} donor</span>
        </div>
        <div className="profile-total">
          <div className="profile-total-num">{usd(data.totalUsd)}</div>
          <div className="profile-total-lbl">given to date</div>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{data.causes}</div>
          <div className="stat-lbl">cause{data.causes === 1 ? "" : "s"} supported</div>
        </div>
        <div className="stat">
          <div className="stat-num">{data.gifts}</div>
          <div className="stat-lbl">gift{data.gifts === 1 ? "" : "s"}</div>
        </div>
        <div className="stat">
          <div className="stat-chains">
            {(data.chains || "").split(",").map((ch) => {
              const cp = chainPill[ch.trim()];
              return cp ? <span key={ch} className={`pill ${cp.cls}`}>{cp.label}</span> : null;
            })}
          </div>
          <div className="stat-lbl">chains used</div>
        </div>
      </div>

      <div className="section-head"><h2>By asset</h2></div>
      <div className="panel">
        {assets.map(([label, value]) => (
          <div className="asset-row" key={label}>
            <div className="asset-lbl">{label}</div>
            <div className="asset-bar-track">
              <div
                className="asset-bar-fill"
                style={{ width: `${data.totalUsd > 0 ? Math.round((value / data.totalUsd) * 100) : 0}%` }}
              />
            </div>
            <div className="asset-val">{usd(value)}</div>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>Recent gifts</h2></div>
      <div className="panel" style={{ padding: 0 }}>
        {data.donations.map((d, i) => {
          const cp = chainPill[d.chain];
          return (
            <Link className="don-row" to={`/c/${d.campaign_id}`} key={i}>
              <div className="don-amt">{d.amount}</div>
              <div className="don-to">{d.campaign_title}</div>
              {cp && <span className={`pill ${cp.cls}`}>{cp.label}</span>}
              <div className="don-usd">{usd(d.amount_usd)}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

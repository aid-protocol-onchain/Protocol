import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Campaign } from "../types";
import { api, usd, num, pct } from "../lib";

const LABEL: Record<string, { text: string; cls: string }> = {
  completed: { text: "Completed", cls: "pill-trust" },
  frozen: { text: "Frozen", cls: "pill-danger" },
  refunding: { text: "Refunds open", cls: "pill-danger" },
};

export function Past() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>("/api/campaigns?status=past")
      .then((d) => setCampaigns(d.campaigns))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Past campaigns</div>
        <h1>Relief that <span className="grad-text">ran its course.</span></h1>
        <p>Campaigns that have been completed, frozen, or moved into refunds. The on-chain record stays public forever.</p>
      </section>

      {err && <div className="loading">Couldn't load past campaigns. {err}</div>}
      {!campaigns && !err && <div className="loading">Loading…</div>}
      {campaigns && campaigns.length === 0 && (
        <div className="loading">No past campaigns yet. Active ones live on the <Link to="/">home page</Link>.</div>
      )}

      {campaigns && campaigns.length > 0 && (
        <div className="grid" style={{ marginTop: 18 }}>
          {campaigns.map((c) => {
            const lbl = LABEL[c.status] || { text: c.status, cls: "pill-line" };
            return (
              <Link to={`/c/${c.id}`} className="ccard" key={c.id}>
                <div className="band"><i className={`ti ${c.icon}`} aria-hidden="true" /></div>
                <div className="body">
                  <span className={`pill ${lbl.cls}`} style={{ marginBottom: 8 }}>{lbl.text}</span>
                  <h3>{c.title}</h3>
                  <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {c.location}</div>
                  <div className="bar"><span style={{ width: `${pct(c.raised_usd, c.goal_usd)}%` }} /></div>
                  <div className="figs"><span><b>{usd(c.raised_usd)}</b> raised</span><span className="muted">{num(c.donor_count)} donors</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

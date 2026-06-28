import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CampaignDetail } from "../types";
import { api, usd, num, pct, chainPill } from "../lib";
import { DonatePanel } from "../components/DonatePanel";

export function Campaign() {
  const { id } = useParams();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<CampaignDetail>(`/api/campaigns/${id}`)
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="loading">Couldn't load this campaign. {err}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  const { campaign: c, proofs, donations } = data;

  return (
    <>
      <p style={{ margin: "18px 0 0" }}>
        <Link to="/" className="muted"><i className="ti ti-arrow-left" style={{ verticalAlign: -2 }} aria-hidden="true" /> All disasters</Link>
      </p>

      <section className="hero" style={{ marginTop: 12 }}>
        <div className="eyebrow" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="pill pill-danger"><i className="ti ti-alert-triangle" aria-hidden="true" /> Active emergency</span>
          <span style={{ color: "#9fb0c4" }}><i className="ti ti-map-pin" aria-hidden="true" /> {c.location}</span>
        </div>
        <h1 style={{ fontSize: 26 }}>{c.title}</h1>
      </section>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="requester">
          <div className="av"><i className="ti ti-building-community" aria-hidden="true" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {c.requester_name}
              <i className="ti ti-rosette-discount-check" style={{ color: "var(--trust)" }} aria-hidden="true" />
            </div>
            <div className="faint">Verified · tier {c.requester_tier} · {c.requester_handle}</div>
          </div>
          <span className="pill pill-trust">{c.first_release_pct}% first release</span>
        </div>
      </div>

      <div className="metricrow">
        <div className="metric"><div className="k">Raised</div><div className="v">{usd(c.raised_usd)}</div></div>
        <div className="metric"><div className="k">Goal</div><div className="v">{usd(c.goal_usd)}</div></div>
        <div className="metric"><div className="k">Donors</div><div className="v">{num(c.donor_count)}</div></div>
      </div>
      <div className="bar"><span style={{ width: `${pct(c.raised_usd, c.goal_usd)}%` }} /></div>

      <div className="detail">
        <div>
          <div className="panel">
            <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>
              <i className="ti ti-photo-check" style={{ color: "var(--trust)", verticalAlign: -2 }} aria-hidden="true" /> Proof of spend
            </h2>
            {proofs.map((p) => (
              <div className="proof" key={p.id}>
                <div className="thumb"><i className={`ti ${p.icon}`} aria-hidden="true" /></div>
                <div>
                  <h4>
                    {p.title}
                    {p.ai_verified ? (
                      <span className="pill pill-trust"><i className="ti ti-shield-check" aria-hidden="true" /> AI-verified</span>
                    ) : null}
                  </h4>
                  <div className="muted">Tranche {p.tranche} · {usd(p.spent_usd)} spent · {p.media_count} files</div>
                  <div className="faint">{p.created_at}</div>
                </div>
              </div>
            ))}
            <div className="faint" style={{ marginTop: 10, display: "flex", gap: 7, alignItems: "center" }}>
              <i className="ti ti-clock" aria-hidden="true" /> Next tranche unlocks once new proof passes review
            </div>
          </div>

          <div className="panel">
            <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>
              <i className="ti ti-link" style={{ verticalAlign: -2 }} aria-hidden="true" /> On-chain donations
            </h2>
            {donations.map((d) => {
              const cp = chainPill[d.chain];
              return (
                <div className="ledger-row" key={d.id}>
                  <div className={`av${d.is_anonymous ? " anon" : ""}`}>
                    {d.is_anonymous ? <i className="ti ti-eye-off" aria-hidden="true" /> : d.donor_label.replace("@", "").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    {d.is_anonymous ? "Anonymous" : d.donor_label}
                    {!d.is_anonymous && <span className="faint"> · public</span>}
                  </div>
                  <span className={`pill ${cp.cls}`} style={{ marginLeft: 8 }}>{cp.label}</span>
                  <span className="amt">{d.amount}</span>
                  <a href={d.tx_url} className="faint"><i className="ti ti-external-link" aria-hidden="true" /></a>
                </div>
              );
            })}
          </div>
        </div>

        <DonatePanel campaignId={c.id} />
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Campaign, NewsItem, RecentDonation } from "../types";
import { api, usd, num, pct } from "../lib";
import { Ticker } from "../components/Ticker";

export function Feed() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [recent, setRecent] = useState<RecentDonation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ campaigns: Campaign[] }>("/api/campaigns?status=active").then((d) => setCampaigns(d.campaigns)).catch((e) => setErr(String(e)));
    api<{ news: NewsItem[] }>("/api/news").then((d) => setNews(d.news)).catch(() => {});
    api<{ donations: RecentDonation[] }>("/api/donations/recent").then((d) => setRecent(d.donations)).catch(() => {});
  }, []);

  const totalRaised = campaigns ? campaigns.reduce((s, c) => s + c.raised_usd, 0) : 0;
  const totalDonors = campaigns ? campaigns.reduce((s, c) => s + c.donor_count, 0) : 0;
  const featured = campaigns?.[0];
  const rest = campaigns?.slice(1) ?? [];

  return (
    <>
      <Ticker items={recent} />
      <section className="hero">
        <div className="eyebrow">Lifeline for humanity · powered by crypto</div>
        <h1>Every donation on-chain.<br /><span className="grad-text">Every dollar proven.</span></h1>
        <p>Fund verified disaster relief on Solana and Ethereum. Funds are held in escrow and released only against AI-verified proof of how they were spent.</p>
        <div className="cta-row">
          <a href="#disasters" className="btn btn-primary">Explore disasters</a>
          <a href="#how" className="btn btn-onhero">How it works</a>
        </div>
      </section>

      {campaigns && (
        <div className="stats">
          <div className="stat"><div className="v grad-text">{usd(totalRaised)}</div><div className="k">Raised on-chain</div></div>
          <div className="stat"><div className="v">{num(totalDonors)}</div><div className="k">Donors</div></div>
          <div className="stat"><div className="v">{campaigns.length}</div><div className="k">Active disasters</div></div>
          <div className="stat"><div className="v">2</div><div className="k">Chains supported</div></div>
        </div>
      )}

      {err && <div className="loading">Couldn't load campaigns. {err}</div>}
      {!campaigns && !err && <div className="loading">Loading…</div>}

      {featured && (
        <>
          <div className="section-head" id="disasters"><h2>Featured emergency</h2></div>
          <Link to={`/c/${featured.id}`} className="feature">
            <div className="feature-band"><i className={`ti ${featured.icon}`} aria-hidden="true" /></div>
            <div className="feature-body">
              <span className="pill pill-danger" style={{ alignSelf: "flex-start" }}><i className="ti ti-alert-triangle" aria-hidden="true" /> Active emergency</span>
              <h3>{featured.title}</h3>
              <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {featured.location} · {featured.requester_name}</div>
              <div className="bar"><span style={{ width: `${pct(featured.raised_usd, featured.goal_usd)}%` }} /></div>
              <div className="figs"><span><b>{usd(featured.raised_usd)}</b> of {usd(featured.goal_usd)}</span><span className="muted">{num(featured.donor_count)} donors</span></div>
              <span className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}><i className="ti ti-heart" aria-hidden="true" /> Donate now</span>
            </div>
          </Link>
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="section-head"><h2>More active disasters</h2><Link to="/past" className="muted">Past campaigns →</Link></div>
          <div className="grid">
            {rest.map((c) => (
              <Link to={`/c/${c.id}`} className="ccard" key={c.id}>
                <div className="band"><i className={`ti ${c.icon}`} aria-hidden="true" /></div>
                <div className="body">
                  <h3>{c.title}</h3>
                  <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {c.location}</div>
                  <div className="bar"><span style={{ width: `${pct(c.raised_usd, c.goal_usd)}%` }} /></div>
                  <div className="figs"><span><b>{usd(c.raised_usd)}</b> raised</span><span className="muted">{num(c.donor_count)} donors</span></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-head" id="how"><h2>How it works</h2></div>
      <div className="steps">
        <div className="step">
          <div className="step-icon"><i className="ti ti-wallet" aria-hidden="true" /></div>
          <h3>Give on any chain</h3>
          <p>Donate SOL, ETH, or stablecoins from your wallet, publicly or anonymously. Every gift is written to an immutable on-chain ledger.</p>
        </div>
        <div className="step">
          <div className="step-icon"><i className="ti ti-lock" aria-hidden="true" /></div>
          <h3>Funds held in escrow</h3>
          <p>Vetted requesters can't just take the money. Funds sit in a smart contract and release in tranches, never all at once.</p>
        </div>
        <div className="step">
          <div className="step-icon"><i className="ti ti-shield-check" aria-hidden="true" /></div>
          <h3>Released on proof</h3>
          <p>Each tranche unlocks only after AI-verified photos and video prove how the last one was spent. You watch your impact, on-chain.</p>
        </div>
      </div>

      {news.length > 0 && (
        <>
          <div className="section-head"><h2>Latest news</h2><Link to="/news" className="muted">All news →</Link></div>
          <div className="news-preview">
            {news.slice(0, 3).map((n) => (
              <Link to={n.campaign_id ? `/c/${n.campaign_id}` : "/news"} className="news-mini" key={n.id}>
                <div className="news-mini-icon"><i className={`ti ${n.icon}`} aria-hidden="true" /></div>
                <span className={`pill ${n.category === "update" ? "pill-trust" : "pill-line"}`} style={{ alignSelf: "flex-start" }}>{n.category === "update" ? "Relief update" : "News"}</span>
                <h4>{n.title}</h4>
                <span className="faint">{n.source} · {n.published_at}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

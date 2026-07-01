import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import type { Campaign, NewsItem, RecentDonation } from "../types";
import { api, usd, num, pct, formatDate } from "../lib";
import { Ticker } from "../components/Ticker";

export function Feed() {
  const { t } = useTranslation();
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
        <div className="eyebrow">{t("feed.eyebrow")}</div>
        <h1><Trans i18nKey="feed.heroHeading" components={{ br: <br />, grad: <span className="grad-text" /> }} /></h1>
        <p>{t("feed.lead")}</p>
        <div className="cta-row">
          <a href="#disasters" className="btn btn-primary">{t("feed.exploreDisasters")}</a>
          <a href="#how" className="btn btn-onhero">{t("feed.howItWorks")}</a>
        </div>
      </section>

      {campaigns && (
        <div className="stats">
          <div className="stat"><div className="v grad-text">{usd(totalRaised)}</div><div className="k">{t("feed.raisedOnChain")}</div></div>
          <div className="stat"><div className="v">{num(totalDonors)}</div><div className="k">{t("feed.donors")}</div></div>
          <div className="stat"><div className="v">{campaigns.length}</div><div className="k">{t("feed.activeDisasters")}</div></div>
          <div className="stat"><div className="v">2</div><div className="k">{t("feed.chainsSupported")}</div></div>
        </div>
      )}

      {err && <div className="loading">{t("feed.loadError", { error: err })}</div>}
      {!campaigns && !err && <div className="loading">{t("common.loading")}</div>}

      {featured && (
        <>
          <div className="section-head" id="disasters"><h2>{t("feed.featuredEmergency")}</h2></div>
          <Link to={`/c/${featured.id}`} className="feature">
            <div className="feature-band"><i className={`ti ${featured.icon}`} aria-hidden="true" /></div>
            <div className="feature-body">
              <span className="pill pill-danger" style={{ alignSelf: "flex-start" }}><i className="ti ti-alert-triangle" aria-hidden="true" /> {t("feed.activeEmergency")}</span>
              <h3>{featured.title}</h3>
              <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {featured.location} · {featured.requester_name}</div>
              <div className="bar"><span style={{ width: `${pct(featured.raised_usd, featured.goal_usd)}%` }} /></div>
              <div className="figs"><span><b>{usd(featured.raised_usd)}</b> {t("common.ofGoal", { goal: usd(featured.goal_usd) })}</span><span className="muted">{t("common.donors", { count: featured.donor_count })}</span></div>
              <span className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: 4 }}><i className="ti ti-heart" aria-hidden="true" /> {t("common.donateNow")}</span>
            </div>
          </Link>
        </>
      )}

      {rest.length > 0 && (
        <>
          <div className="section-head"><h2>{t("feed.moreActive")}</h2><Link to="/past" className="muted">{t("feed.pastCampaigns")}</Link></div>
          <div className="grid">
            {rest.map((c) => (
              <Link to={`/c/${c.id}`} className="ccard" key={c.id}>
                <div className="band"><i className={`ti ${c.icon}`} aria-hidden="true" /></div>
                <div className="body">
                  <h3>{c.title}</h3>
                  <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {c.location}</div>
                  <div className="bar"><span style={{ width: `${pct(c.raised_usd, c.goal_usd)}%` }} /></div>
                  <div className="figs"><span><b>{usd(c.raised_usd)}</b> {t("common.raisedSuffix")}</span><span className="muted">{t("common.donors", { count: c.donor_count })}</span></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="section-head" id="how"><h2>{t("feed.howItWorks")}</h2></div>
      <div className="steps">
        <div className="step">
          <div className="step-icon"><i className="ti ti-wallet" aria-hidden="true" /></div>
          <h3>{t("feed.step1Title")}</h3>
          <p>{t("feed.step1Body")}</p>
        </div>
        <div className="step">
          <div className="step-icon"><i className="ti ti-lock" aria-hidden="true" /></div>
          <h3>{t("feed.step2Title")}</h3>
          <p>{t("feed.step2Body")}</p>
        </div>
        <div className="step">
          <div className="step-icon"><i className="ti ti-shield-check" aria-hidden="true" /></div>
          <h3>{t("feed.step3Title")}</h3>
          <p>{t("feed.step3Body")}</p>
        </div>
      </div>

      {news.length > 0 && (
        <>
          <div className="section-head"><h2>{t("feed.latestNews")}</h2><Link to="/news" className="muted">{t("feed.allNews")}</Link></div>
          <div className="news-preview">
            {news.slice(0, 3).map((n) => (
              <Link to={n.campaign_id ? `/c/${n.campaign_id}` : "/news"} className="news-mini" key={n.id}>
                <div className="news-mini-icon"><i className={`ti ${n.icon}`} aria-hidden="true" /></div>
                <span className={`pill ${n.category === "update" ? "pill-trust" : "pill-line"}`} style={{ alignSelf: "flex-start" }}>{n.category === "update" ? t("feed.pillReliefUpdate") : t("feed.pillNews")}</span>
                <h4>{n.title}</h4>
                <span className="faint">{n.source} · {formatDate(n.published_at)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

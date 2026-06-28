import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NewsItem } from "../types";
import { api } from "../lib";

export function News() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ news: NewsItem[] }>("/api/news")
      .then((d) => setItems(d.news))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">News &amp; updates</div>
        <h1>What's happening <span className="grad-text">on the ground.</span></h1>
        <p>Verified relief updates from funded campaigns, alongside coverage of the disasters they respond to.</p>
      </section>

      <div className="section-head"><h2>Latest</h2></div>

      {err && <div className="loading">Couldn't load news. {err}</div>}
      {!items && !err && <div className="loading">Loading…</div>}

      {items && (
        <div className="news-list">
          {items.map((n) => (
            <article className="news-item" key={n.id}>
              <div className="news-icon"><i className={`ti ${n.icon}`} aria-hidden="true" /></div>
              <div style={{ flex: 1 }}>
                <div className="news-tags">
                  <span className={`pill ${n.category === "update" ? "pill-trust" : "pill-line"}`}>
                    {n.category === "update" ? "Relief update" : "News"}
                  </span>
                  <span className="faint">{n.source} · {n.published_at}</span>
                </div>
                <h3 className="news-title">
                  {n.link ? (
                    <a href={n.link} target="_blank" rel="noreferrer" className="news-title-link">{n.title}</a>
                  ) : (
                    n.title
                  )}
                </h3>
                {n.summary && <p className="news-summary">{n.summary}</p>}
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  {n.campaign_id && (
                    <Link to={`/c/${n.campaign_id}`} className="news-link">
                      View campaign <i className="ti ti-arrow-right" aria-hidden="true" />
                    </Link>
                  )}
                  {n.link && (
                    <a href={n.link} target="_blank" rel="noreferrer" className="news-link">
                      Read source <i className="ti ti-external-link" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

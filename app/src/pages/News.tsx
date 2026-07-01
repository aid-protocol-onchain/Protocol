import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import type { NewsItem } from "../types";
import { api, formatDate } from "../lib";

export function News() {
  const { t } = useTranslation();
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
        <div className="eyebrow">{t("news.eyebrow")}</div>
        <h1><Trans i18nKey="news.heroHeading" components={{ grad: <span className="grad-text" /> }} /></h1>
        <p>{t("news.lead")}</p>
      </section>

      <div className="section-head"><h2>{t("news.latest")}</h2></div>

      {err && <div className="loading">{t("news.loadError", { error: err })}</div>}
      {!items && !err && <div className="loading">{t("common.loading")}</div>}

      {items && (
        <div className="news-list">
          {items.map((n) => (
            <article className="news-item" key={n.id}>
              <div className="news-icon"><i className={`ti ${n.icon}`} aria-hidden="true" /></div>
              <div style={{ flex: 1 }}>
                <div className="news-tags">
                  <span className={`pill ${n.category === "update" ? "pill-trust" : "pill-line"}`}>
                    {n.category === "update" ? t("news.pillReliefUpdate") : t("news.pillNews")}
                  </span>
                  <span className="faint">{n.source} · {formatDate(n.published_at)}</span>
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
                      {t("news.viewCampaign")} <i className="ti ti-arrow-right" aria-hidden="true" />
                    </Link>
                  )}
                  {n.link && (
                    <a href={n.link} target="_blank" rel="noreferrer" className="news-link">
                      {t("news.readSource")} <i className="ti ti-external-link" aria-hidden="true" />
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

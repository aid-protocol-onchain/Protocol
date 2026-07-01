import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import type { Campaign } from "../types";
import { api, usd, num, pct } from "../lib";

const LABEL: Record<string, { key: string; cls: string }> = {
  completed: { key: "past.statusCompleted", cls: "pill-trust" },
  frozen: { key: "past.statusFrozen", cls: "pill-danger" },
  refunding: { key: "past.statusRefunding", cls: "pill-danger" },
};

export function Past() {
  const { t } = useTranslation();
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
        <div className="eyebrow">{t("past.eyebrow")}</div>
        <h1><Trans i18nKey="past.heroHeading" components={{ grad: <span className="grad-text" /> }} /></h1>
        <p>{t("past.lead")}</p>
      </section>

      {err && <div className="loading">{t("past.loadError", { error: err })}</div>}
      {!campaigns && !err && <div className="loading">{t("common.loading")}</div>}
      {campaigns && campaigns.length === 0 && (
        <div className="loading"><Trans i18nKey="past.empty" components={{ home: <Link to="/" /> }} /></div>
      )}

      {campaigns && campaigns.length > 0 && (
        <div className="grid" style={{ marginTop: 18 }}>
          {campaigns.map((c) => {
            const lbl = LABEL[c.status];
            const lblText = lbl ? t(lbl.key) : c.status;
            const lblCls = lbl ? lbl.cls : "pill-line";
            return (
              <Link to={`/c/${c.id}`} className="ccard" key={c.id}>
                <div className="band"><i className={`ti ${c.icon}`} aria-hidden="true" /></div>
                <div className="body">
                  <span className={`pill ${lblCls}`} style={{ marginBottom: 8 }}>{lblText}</span>
                  <h3>{c.title}</h3>
                  <div className="loc"><i className="ti ti-map-pin" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" /> {c.location}</div>
                  <div className="bar"><span style={{ width: `${pct(c.raised_usd, c.goal_usd)}%` }} /></div>
                  <div className="figs"><span><b>{usd(c.raised_usd)}</b> {t("common.raisedSuffix")}</span><span className="muted">{t("common.donors", { count: c.donor_count })}</span></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

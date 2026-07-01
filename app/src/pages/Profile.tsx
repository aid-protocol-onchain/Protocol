import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import type { DonorProfileData } from "../types";
import { api, usd, badgeTier, chainPill } from "../lib";

// Donor profile: /u/:handle (Twitter) or /w/:wallet (on-chain address).
export function Profile({ kind }: { kind: "u" | "w" }) {
  const { t } = useTranslation();
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
        <div className="eyebrow">{t("profile.eyebrowNoRecord")}</div>
        <h1>{t("profile.noRecordTitle")}</h1>
        <p>
          <Trans i18nKey="profile.noRecordBody" values={{ who: kind === "u" ? `@${id}` : id }} components={{ strong: <strong /> }} />
        </p>
        <Link className="btn" to="/leaderboard">{t("profile.seeLeaderboard")}</Link>
      </section>
    );
  }

  if (!data) return <div className="loading">{t("common.loading")}</div>;

  const tier = badgeTier(data.totalUsd);
  const assets: [string, number][] = [
    ["SOL", data.assets.sol],
    ["ETH", data.assets.eth],
    [t("profile.assetStable"), data.assets.stable],
  ];

  return (
    <>
      <section className="profile-head">
        <div className="profile-av">{data.handle.replace("@", "").slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="eyebrow">{kind === "u" ? t("profile.twitterDonor") : t("profile.walletDonor")}</div>
          <h1 style={{ margin: "4px 0 8px" }}>{data.handle}</h1>
          <span className="pill" style={{ background: tier.bg, color: tier.fg }}>{t("profile.tierDonor", { tier: tier.name })}</span>
        </div>
        <div className="profile-total">
          <div className="profile-total-num">{usd(data.totalUsd)}</div>
          <div className="profile-total-lbl">{t("profile.givenToDate")}</div>
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{data.causes}</div>
          <div className="stat-lbl">{t("profile.causesSupported", { count: data.causes })}</div>
        </div>
        <div className="stat">
          <div className="stat-num">{data.gifts}</div>
          <div className="stat-lbl">{t("profile.giftsLabel", { count: data.gifts })}</div>
        </div>
        <div className="stat">
          <div className="stat-chains">
            {(data.chains || "").split(",").map((ch) => {
              const cp = chainPill[ch.trim()];
              return cp ? <span key={ch} className={`pill ${cp.cls}`}>{cp.label}</span> : null;
            })}
          </div>
          <div className="stat-lbl">{t("profile.chainsUsed")}</div>
        </div>
      </div>

      <div className="section-head"><h2>{t("profile.byAsset")}</h2></div>
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

      <div className="section-head"><h2>{t("profile.recentGifts")}</h2></div>
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

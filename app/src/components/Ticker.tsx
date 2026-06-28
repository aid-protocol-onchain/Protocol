import { Link } from "react-router-dom";
import type { RecentDonation } from "../types";
import { chainPill } from "../lib";

export function Ticker({ items }: { items: RecentDonation[] }) {
  if (!items.length) return null;
  // duplicate the list so the marquee loops seamlessly
  const loop = [...items, ...items];

  return (
    <div className="ticker">
      <div className="ticker-label">
        <span className="ticker-dot" /> Live donations
      </div>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((d, i) => {
            const cp = chainPill[d.chain];
            return (
              <Link to={`/c/${d.campaign_id}`} className="ticker-item" key={`${d.id}-${i}`}>
                <i className="ti ti-heart" aria-hidden="true" />
                <span className="ticker-who">{d.is_anonymous ? "Anonymous" : d.donor_label}</span>
                <span className="ticker-amt">{d.amount}</span>
                <span className="ticker-arrow"><i className="ti ti-arrow-right" aria-hidden="true" /></span>
                <span className="ticker-camp">{d.campaign_title}</span>
                {cp && <span className={`pill ${cp.cls}`} style={{ fontSize: 11 }}>{cp.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

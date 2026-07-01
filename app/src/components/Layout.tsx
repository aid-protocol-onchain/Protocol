import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WalletButton } from "./WalletButton";
import { XSignIn } from "./XSignIn";
import { LangSwitcher } from "./LangSwitcher";
import { useXAuth } from "../wallet/xauth";

export function Mark({ height = 30 }: { height?: number }) {
  return (
    <svg height={height} viewBox="0 0 300 100" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id="aidMark" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          <stop offset="0" stopColor="#0b5cf7" />
          <stop offset="0.5" stopColor="#0298d8" />
          <stop offset="1" stopColor="#19d39f" />
        </linearGradient>
      </defs>
      <path d="M24 80 L118 20 L200 80" stroke="url(#aidMark)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 80 L178 48 L276 80" stroke="url(#aidMark)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="80" r="8" fill="none" stroke="#0b5cf7" strokeWidth="6" />
      <circle cx="284" cy="80" r="8" fill="none" stroke="#19d39f" strokeWidth="6" />
    </svg>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "navlink active" : "navlink");

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user } = useXAuth();
  const { t } = useTranslation();
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <>
      <div className="demo-banner">
        <i className="ti ti-flask" aria-hidden="true" /> {t("banner.demo")}
      </div>
      <header className="nav">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}>
          <Link to="/" className="brand" aria-label={t("nav.home")}>
            <img src="/mark.svg" alt="" className="brand-icon" />
            <span className="wordmark">AID <span className="wordmark-light">PROTOCOL</span></span>
          </Link>
          <nav className="nav-links">
            <div className="nav-mid">
              <NavLink to="/" end className={linkClass}>{t("nav.disasters")}</NavLink>
              <NavLink to="/leaderboard" className={linkClass}>{t("nav.leaderboard")}</NavLink>
              <NavLink to="/news" className={linkClass}>{t("nav.news")}</NavLink>
              {user && <NavLink to="/apply" className={linkClass}>{t("nav.requestAid")}</NavLink>}
            </div>
            <LangSwitcher />
            <XSignIn />
            <WalletButton />
            <button className="nav-burger" aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <i className={`ti ${open ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
            </button>
          </nav>
        </div>
        {open && (
          <div className="mobile-menu wrap">
            <NavLink to="/" end className={linkClass}>{t("nav.disasters")}</NavLink>
            <NavLink to="/leaderboard" className={linkClass}>{t("nav.leaderboard")}</NavLink>
            <NavLink to="/news" className={linkClass}>{t("nav.news")}</NavLink>
            {user && <NavLink to="/apply" className={linkClass}>{t("nav.requestAid")}</NavLink>}
          </div>
        )}
      </header>
      <main className="wrap">
        <Outlet />
        <div className="values">
          <span><i className="ti ti-eye" aria-hidden="true" /> {t("values.transparent")}</span>
          <span><i className="ti ti-lock" aria-hidden="true" /> {t("values.secure")}</span>
          <span><i className="ti ti-world" aria-hidden="true" /> {t("values.global")}</span>
          <span><i className="ti ti-users" aria-hidden="true" /> {t("values.human")}</span>
          <span><i className="ti ti-affiliate" aria-hidden="true" /> {t("values.decentralized")}</span>
        </div>
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">AID <span className="wordmark-light">PROTOCOL</span></div>
              <p className="footer-tag">{t("footer.tagline")}</p>
            </div>
            <div className="footer-links">
              <a href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer"><i className="ti ti-brand-x" aria-hidden="true" /> @aidprotocol_</a>
              <a href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer"><i className="ti ti-brand-github" aria-hidden="true" /> GitHub</a>
              <a href="mailto:admin@aidprotocol.org"><i className="ti ti-mail" aria-hidden="true" /> {t("footer.email")}</a>
              <Link to="/privacy">{t("footer.privacy")}</Link>
              <Link to="/terms">{t("footer.terms")}</Link>
            </div>
          </div>
          <div className="footer-base">
            <span>{t("footer.copyright")}</span>
            <span>{t("footer.onchainLedger")}</span>
          </div>
        </footer>
      </main>
    </>
  );
}

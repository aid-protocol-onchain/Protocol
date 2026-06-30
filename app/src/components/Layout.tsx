import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { WalletButton } from "./WalletButton";
import { XSignIn } from "./XSignIn";
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
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <>
      <div className="demo-banner">
        <i className="ti ti-flask" aria-hidden="true" /> Demo environment. All campaigns, donors, and amounts are mock data. No real funds move.
      </div>
      <header className="nav">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}>
          <Link to="/" className="brand" aria-label="Aid Protocol home">
            <img src="/mark.svg" alt="" className="brand-icon" />
            <span className="wordmark">AID <span className="wordmark-light">PROTOCOL</span></span>
          </Link>
          <nav className="nav-links">
            <div className="nav-mid">
              <NavLink to="/" end className={linkClass}>Disasters</NavLink>
              <NavLink to="/leaderboard" className={linkClass}>Leaderboard</NavLink>
              <NavLink to="/news" className={linkClass}>News</NavLink>
              {user && <NavLink to="/apply" className={linkClass}>Request aid</NavLink>}
            </div>
            <XSignIn />
            <WalletButton />
            <button className="nav-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <i className={`ti ${open ? "ti-x" : "ti-menu-2"}`} aria-hidden="true" />
            </button>
          </nav>
        </div>
        {open && (
          <div className="mobile-menu wrap">
            <NavLink to="/" end className={linkClass}>Disasters</NavLink>
            <NavLink to="/leaderboard" className={linkClass}>Leaderboard</NavLink>
            <NavLink to="/news" className={linkClass}>News</NavLink>
            {user && <NavLink to="/apply" className={linkClass}>Request aid</NavLink>}
          </div>
        )}
      </header>
      <main className="wrap">
        <Outlet />
        <div className="values">
          <span><i className="ti ti-eye" aria-hidden="true" /> Transparent</span>
          <span><i className="ti ti-lock" aria-hidden="true" /> Secure</span>
          <span><i className="ti ti-world" aria-hidden="true" /> Global</span>
          <span><i className="ti ti-users" aria-hidden="true" /> Human</span>
          <span><i className="ti ti-affiliate" aria-hidden="true" /> Decentralized</span>
        </div>
        <footer className="footer">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">AID <span className="wordmark-light">PROTOCOL</span></div>
              <p className="footer-tag">A non-profit, open-source lifeline for disaster relief. Every gift is recorded on-chain and released against verified proof of spend.</p>
            </div>
            <div className="footer-links">
              <a href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer"><i className="ti ti-brand-x" aria-hidden="true" /> @aidprotocol_</a>
              <a href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer"><i className="ti ti-brand-github" aria-hidden="true" /> GitHub</a>
              <a href="mailto:admin@aidprotocol.org"><i className="ti ti-mail" aria-hidden="true" /> admin@aidprotocol.org</a>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
          <div className="footer-base">
            <span>© 2026 Aid Protocol · Non-profit · Open source</span>
            <span>On-chain ledger · proof-gated escrow</span>
          </div>
        </footer>
      </main>
    </>
  );
}

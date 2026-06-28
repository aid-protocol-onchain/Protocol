import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AidRequest, NewsItem } from "../types";
import { usd } from "../lib";

const TOKEN_KEY = "aid_admin_token";

export function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<AidRequest[] | null>(null);
  const [err, setErr] = useState("");

  const authFetch = useCallback(
    (path: string, opts: RequestInit = {}) =>
      fetch(path, {
        ...opts,
        headers: { "content-type": "application/json", "x-admin-token": token, ...(opts.headers || {}) },
      }),
    [token]
  );

  const load = useCallback(() => {
    if (!token) return;
    setErr("");
    authFetch("/api/admin/requests")
      .then(async (r) => {
        if (r.status === 401) {
          setErr("Invalid admin token.");
          setRows(null);
          return;
        }
        const d = (await r.json()) as { requests: AidRequest[] };
        setRows(d.requests);
      })
      .catch((e) => setErr(String(e)));
  }, [token, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token) {
    return (
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Reviewer console</div>
        <h1>Core team only</h1>
        <p>Enter the admin token to review aid requests and run diligence.</p>
        <div className="panel" style={{ maxWidth: 420 }}>
          <div className="field-label">Admin token</div>
          <input className="inp" type="password" value={input} onChange={(e) => setInput(e.target.value)} />
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              localStorage.setItem(TOKEN_KEY, input);
              setToken(input);
            }}
          >
            Unlock
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Reviewer console</div>
        <h1>Aid requests &amp; diligence</h1>
        <p>Verify each requester's public identity, record notes, then approve to publish a campaign.</p>
        <button className="btn" onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); }}>Lock console</button>
      </section>

      {err && <div className="note" style={{ color: "var(--danger)" }}>{err}</div>}
      {!rows && !err && <div className="loading">Loading…</div>}
      {rows && rows.length === 0 && <div className="loading">No requests yet.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows?.map((r) => (
          <ReviewCard key={r.id} r={r} authFetch={authFetch} onChange={load} />
        ))}
      </div>

      <CampaignsAdmin authFetch={authFetch} />
      <NewsAdmin authFetch={authFetch} />
    </>
  );
}

interface AdminCampaign {
  id: string;
  title: string;
  status: string;
  raised_usd: number;
  goal_usd: number;
  chain_status: string;
}

function CampaignsAdmin({ authFetch }: { authFetch: (p: string, o?: RequestInit) => Promise<Response> }) {
  const [rows, setRows] = useState<AdminCampaign[] | null>(null);

  const load = useCallback(() => {
    authFetch("/api/admin/campaigns")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d: { campaigns: AdminCampaign[] }) => setRows(d.campaigns))
      .catch(() => setRows([]));
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    await authFetch(`/api/admin/campaigns/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
    load();
  }

  const pillCls: Record<string, string> = {
    active: "pill-trust",
    completed: "pill-line",
    frozen: "pill-danger",
    refunding: "pill-danger",
  };

  return (
    <>
      <div className="section-head" style={{ marginTop: 32 }}><h2>Campaigns</h2></div>
      {!rows && <div className="loading">Loading…</div>}
      {rows && rows.length === 0 && <div className="loading">No campaigns yet.</div>}
      {rows && rows.length > 0 && (
        <div className="panel" style={{ padding: 0 }}>
          {rows.map((c) => (
            <div className="don-row" key={c.id}>
              <span className={`pill ${pillCls[c.status] || "pill-line"}`} style={{ flexShrink: 0 }}>{c.status}</span>
              <div className="don-to" style={{ flex: 1 }}>
                {c.title}
                <span className="faint"> · {usd(c.raised_usd)} raised · chains {c.chain_status}</span>
              </div>
              {c.status === "active" ? (
                <>
                  <button className="btn" style={{ padding: "5px 10px" }} onClick={() => setStatus(c.id, "completed")}>Mark done</button>
                  <button className="btn" style={{ padding: "5px 10px" }} onClick={() => setStatus(c.id, "frozen")}>Freeze</button>
                </>
              ) : (
                <button className="btn" style={{ padding: "5px 10px" }} onClick={() => setStatus(c.id, "active")}>Reactivate</button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NewsAdmin({ authFetch }: { authFetch: (p: string, o?: RequestInit) => Promise<Response> }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    authFetch("/api/admin/news")
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((d: { news: NewsItem[] }) => setNews(d.news))
      .catch(() => setNews([]));
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setBusy(true);
    setMsg("");
    try {
      const r = await authFetch("/api/admin/news/refresh", { method: "POST" });
      const d = (await r.json()) as { added?: number };
      setMsg(`Ingested ${d.added ?? 0} new item(s).`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string) {
    await authFetch(`/api/admin/news/${id}/toggle`, { method: "POST" });
    load();
  }

  return (
    <>
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>News feeds</h2>
        <button className="btn" disabled={busy} onClick={refresh}>
          <i className="ti ti-refresh" aria-hidden="true" /> {busy ? "Fetching…" : "Refresh feeds"}
        </button>
      </div>
      {msg && <div className="note" style={{ color: "var(--trust)" }}>{msg}</div>}
      {!news && <div className="loading">Loading…</div>}
      {news && news.length === 0 && <div className="loading">No news yet. Click Refresh feeds.</div>}
      {news && news.length > 0 && (
        <div className="panel" style={{ padding: 0 }}>
          {news.map((n) => (
            <div className="don-row" key={n.id} style={{ opacity: n.hidden ? 0.5 : 1 }}>
              <span className="pill pill-line" style={{ flexShrink: 0 }}>{n.auto ? "auto" : "curated"}</span>
              <div className="don-to" style={{ flex: 1 }}>
                {n.link ? (
                  <a href={n.link} target="_blank" rel="noreferrer">{n.title}</a>
                ) : (
                  n.title
                )}
                <span className="faint"> · {n.source}</span>
              </div>
              <button className="btn" style={{ padding: "5px 10px" }} onClick={() => toggle(n.id)}>
                {n.hidden ? "Show" : "Hide"}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ReviewCard({
  r,
  authFetch,
  onChange,
}: {
  r: AidRequest;
  authFetch: (p: string, o?: RequestInit) => Promise<Response>;
  onChange: () => void;
}) {
  const [notes, setNotes] = useState(r.diligence_notes || "");
  const [tier, setTier] = useState<"L1" | "L2">("L2");
  const [pct, setPct] = useState("20");
  const [busy, setBusy] = useState(false);

  const statusPill =
    r.status === "approved"
      ? { bg: "var(--trust-bg)", fg: "var(--trust)" }
      : r.status === "rejected"
        ? { bg: "var(--danger-bg)", fg: "var(--danger)" }
        : { bg: "var(--brand-bg)", fg: "var(--brand-deep)" };

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      await authFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong>{r.org_name}</strong>
        <a className="faint" href={`https://x.com/${r.contact_handle.replace("@", "")}`} target="_blank" rel="noreferrer">
          {r.contact_handle}
        </a>
        <span className="pill" style={{ background: statusPill.bg, color: statusPill.fg }}>{r.status}</span>
        <span className="faint" style={{ marginLeft: "auto" }}>{r.id}</span>
      </div>
      <div className="faint" style={{ margin: "6px 0" }}>
        <i className="ti ti-map-pin" aria-hidden="true" /> {r.location} · {r.disaster} · goal {usd(r.goal_usd)}
      </div>
      <p style={{ margin: "6px 0" }}>{r.summary}</p>
      {r.evidence_url && (
        <a className="faint" href={r.evidence_url} target="_blank" rel="noreferrer">
          <i className="ti ti-external-link" aria-hidden="true" /> public evidence
        </a>
      )}

      <div className="field-label" style={{ marginTop: 10 }}>Diligence notes</div>
      <textarea className="inp" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn" style={{ marginTop: 8 }} disabled={busy} onClick={() => act(`/api/admin/requests/${r.id}/notes`, { notes })}>
        Save notes
      </button>

      {r.status === "pending" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
          <div>
            <div className="field-label">Tier</div>
            <select className="inp" style={{ width: "auto" }} value={tier} onChange={(e) => setTier(e.target.value as "L1" | "L2")}>
              <option value="L2">L2</option>
              <option value="L1">L1</option>
            </select>
          </div>
          <div>
            <div className="field-label">First release %</div>
            <input className="inp" style={{ width: 90 }} value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" />
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(`/api/admin/requests/${r.id}/approve`, { tier, first_release_pct: Number(pct) })}>
            <i className="ti ti-check" aria-hidden="true" /> Approve &amp; publish
          </button>
          <button className="btn" disabled={busy} onClick={() => act(`/api/admin/requests/${r.id}/reject`)}>
            Reject
          </button>
        </div>
      )}

      {r.status === "approved" && r.campaign_id && (
        <div className="note" style={{ color: "var(--trust)" }}>
          <i className="ti ti-circle-check" aria-hidden="true" /> Published as{" "}
          <Link to={`/c/${r.campaign_id}`}>{r.campaign_id}</Link>. On-chain escrows pending authority publish.
        </div>
      )}
    </div>
  );
}

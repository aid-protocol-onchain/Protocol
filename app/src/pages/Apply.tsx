import { useState } from "react";
import { Link } from "react-router-dom";
import { useXAuth } from "../wallet/xauth";

const FIELDS = [
  { k: "org_name", label: "Organization or your name", ph: "Atlas Mutual Aid" },
  { k: "contact_handle", label: "Public identity (Twitter/X handle)", ph: "@atlasmutualaid" },
  { k: "location", label: "Location", ph: "Chefchaouen, Morocco" },
  { k: "disaster", label: "Disaster", ph: "Flash floods" },
  { k: "goal_usd", label: "Funding goal (USD)", ph: "50000" },
  { k: "evidence_url", label: "Public evidence link (optional)", ph: "https://x.com/... or news link" },
] as const;

export function Apply() {
  const { user, loading } = useXAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, summary }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: { message: string } };
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Submission failed");
      setState("done");
      setMsg(data.id || "");
    } catch (e) {
      setState("error");
      setMsg(String(e));
    }
  }

  if (!loading && !user) {
    return (
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Request aid</div>
        <h1>Sign in with X to <span className="grad-text">request aid.</span></h1>
        <p>
          To open a relief campaign, sign in with your public X identity. We verify the public identity of every
          requester before a campaign goes live. No KYC, no documents.
        </p>
        <a className="btn-x" href="/api/auth/x/login" aria-label="Sign in with X" style={{ display: "inline-flex" }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="x-label">Sign in with X</span>
        </a>
      </section>
    );
  }

  if (state === "done") {
    return (
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Request received</div>
        <h1>Thank you. <span className="grad-text">We will review it.</span></h1>
        <p>
          Your request <strong>{msg}</strong> is in the diligence queue. The core team verifies the public identity and
          on-the-ground presence of every requester before a campaign goes live. No KYC, no middlemen.
        </p>
        <Link className="btn" to="/">Back to disasters</Link>
      </section>
    );
  }

  const ready = FIELDS.filter((f) => f.k !== "evidence_url").every((f) => form[f.k]) && summary.trim().length > 10;

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">Request aid</div>
        <h1>Open a <span className="grad-text">lifeline</span> for your community.</h1>
        <p>
          Tell us who you are and what happened. We vet the public identity of every requester, then publish a
          proof-gated campaign across all chains. Funds stay in escrow and release only against verified proof of spend.
        </p>
      </section>

      <div className="panel" style={{ maxWidth: 560 }}>
        {FIELDS.map((f) => (
          <div key={f.k}>
            <div className="field-label">{f.label}</div>
            <input
              className="inp"
              placeholder={f.ph}
              inputMode={f.k === "goal_usd" ? "numeric" : "text"}
              value={form[f.k] || ""}
              onChange={(e) => set(f.k, e.target.value)}
            />
          </div>
        ))}
        <div className="field-label">What happened and what is the money for?</div>
        <textarea
          className="inp"
          rows={4}
          placeholder="Flash floods cut off four villages. We need water, food parcels, and fuel for resupply convoys."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!ready || state === "sending"} onClick={submit}>
          {state === "sending" ? "Submitting…" : "Submit request"}
        </button>
        {state === "error" && (
          <div className="note" style={{ color: "var(--danger)" }}>{msg}</div>
        )}
        <div className="note"><i className="ti ti-shield-check" aria-hidden="true" /> Diligence is on public identity only. We never ask for IDs or documents.</div>
      </div>
    </>
  );
}

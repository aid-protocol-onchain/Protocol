import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useXAuth } from "../wallet/xauth";

const FIELDS = [
  { k: "org_name", labelKey: "apply.fieldOrgNameLabel", phKey: "apply.fieldOrgNamePh" },
  { k: "contact_handle", labelKey: "apply.fieldHandleLabel", phKey: "apply.fieldHandlePh" },
  { k: "location", labelKey: "apply.fieldLocationLabel", phKey: "apply.fieldLocationPh" },
  { k: "disaster", labelKey: "apply.fieldDisasterLabel", phKey: "apply.fieldDisasterPh" },
  { k: "goal_usd", labelKey: "apply.fieldGoalLabel", phKey: "apply.fieldGoalPh" },
  { k: "evidence_url", labelKey: "apply.fieldEvidenceLabel", phKey: "apply.fieldEvidencePh" },
] as const;

export function Apply() {
  const { t } = useTranslation();
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
      if (!res.ok || !data.ok) throw new Error(data.error?.message || t("apply.submissionFailed"));
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
        <div className="eyebrow">{t("apply.eyebrow")}</div>
        <h1><Trans i18nKey="apply.signedOutHeading" components={{ grad: <span className="grad-text" /> }} /></h1>
        <p>{t("apply.signedOutLead")}</p>
        <a className="btn-x" href="/api/auth/x/login" aria-label={t("apply.signIn")} style={{ display: "inline-flex" }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span className="x-label">{t("apply.signIn")}</span>
        </a>
      </section>
    );
  }

  if (state === "done") {
    return (
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">{t("apply.receivedEyebrow")}</div>
        <h1><Trans i18nKey="apply.receivedHeading" components={{ grad: <span className="grad-text" /> }} /></h1>
        <p>
          <Trans i18nKey="apply.receivedBody" values={{ id: msg }} components={{ strong: <strong /> }} />
        </p>
        <Link className="btn" to="/">{t("common.backToDisasters")}</Link>
      </section>
    );
  }

  const ready = FIELDS.filter((f) => f.k !== "evidence_url").every((f) => form[f.k]) && summary.trim().length > 10;

  return (
    <>
      <section className="hero" style={{ marginTop: 26 }}>
        <div className="eyebrow">{t("apply.eyebrow")}</div>
        <h1><Trans i18nKey="apply.heading" components={{ grad: <span className="grad-text" /> }} /></h1>
        <p>{t("apply.lead")}</p>
      </section>

      <div className="panel" style={{ maxWidth: 560 }}>
        {FIELDS.map((f) => (
          <div key={f.k}>
            <div className="field-label">{t(f.labelKey)}</div>
            <input
              className="inp"
              placeholder={t(f.phKey)}
              inputMode={f.k === "goal_usd" ? "numeric" : "text"}
              value={form[f.k] || ""}
              onChange={(e) => set(f.k, e.target.value)}
            />
          </div>
        ))}
        <div className="field-label">{t("apply.summaryLabel")}</div>
        <textarea
          className="inp"
          rows={4}
          placeholder={t("apply.summaryPh")}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={!ready || state === "sending"} onClick={submit}>
          {state === "sending" ? t("apply.submitting") : t("apply.submit")}
        </button>
        {state === "error" && (
          <div className="note" style={{ color: "var(--danger)" }}>{msg}</div>
        )}
        <div className="note"><i className="ti ti-shield-check" aria-hidden="true" /> {t("apply.note")}</div>
      </div>
    </>
  );
}

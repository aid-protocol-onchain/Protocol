import { useTranslation } from "react-i18next";
import { SUPPORTED } from "../i18n";

// Compact EN / ES switcher for the header. Selecting a language calls
// i18n.changeLanguage, which persists the choice to the shared `lang` cookie and
// localStorage via the detector caches and re-renders the tree.
export function LangSwitcher() {
  const { i18n, t } = useTranslation();
  const active = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];

  return (
    <div className="lang-switcher" role="group" aria-label={t("switcher.label")}>
      {SUPPORTED.map((code) => (
        <button
          key={code}
          type="button"
          className={`lang-opt${active === code ? " on" : ""}`}
          aria-pressed={active === code}
          onClick={() => {
            if (active !== code) i18n.changeLanguage(code);
          }}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

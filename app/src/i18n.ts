import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import es from "./locales/es.json";
import * as legalEn from "./locales/legal.en";
import * as legalEs from "./locales/legal.es";

export const SUPPORTED = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED)[number];
export const DEFAULT_LOCALE: Locale = "en";

// The preference cookie is shared with the apex site (aidprotocol.org) via the
// registrable domain, so a language choice made on either surface carries to the
// other. On localhost the Domain attribute is omitted so the cookie still sets.
const isLocalhost =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

const cookieOptions = {
  lookupCookie: "lang",
  cookieMinutes: 60 * 24 * 365, // one year
  cookieDomain: isLocalhost ? undefined : ".aidprotocol.org",
  cookieOptions: {
    path: "/",
    sameSite: "lax" as const,
    secure: !isLocalhost,
  },
};

const legalResource = {
  privacyTitle: legalEn.privacyTitle,
  termsTitle: legalEn.termsTitle,
  privacy: legalEn.privacy,
  terms: legalEn.terms,
};
const legalResourceEs = {
  privacyTitle: legalEs.privacyTitle,
  termsTitle: legalEs.termsTitle,
  privacy: legalEs.privacy,
  terms: legalEs.terms,
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en, legal: legalResource },
      es: { translation: es, legal: legalResourceEs },
    },
    supportedLngs: SUPPORTED as unknown as string[],
    fallbackLng: DEFAULT_LOCALE,
    // Precedence per the spec: explicit `lang` cookie first, then the browser's
    // navigator language, then the <html lang> attribute. Geo is a server-only
    // signal (the apex Worker sets the cookie), so it is not listed here.
    detection: {
      order: ["cookie", "navigator", "htmlTag"],
      caches: ["cookie", "localStorage"],
      ...cookieOptions,
    },
    interpolation: {
      // React already escapes rendered values.
      escapeValue: false,
    },
    returnEmptyString: false,
  });

// Keep <html lang> in sync with the active locale for accessibility and SEO.
function syncHtmlLang(lng: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng.split("-")[0];
  }
}
syncHtmlLang(i18n.language || DEFAULT_LOCALE);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;

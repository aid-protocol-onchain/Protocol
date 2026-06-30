---
name: Internationalization (English + Spanish)
type: feature-spec
altitude: feature
status: draft
created: '2026-06-30'
inherits: [AD-9, AD-11, AD-12, AD-13, AD-14]
spine: docs/planning-artifacts/architecture/architecture-aid-protocol-2026-06-27/ARCHITECTURE-SPINE.md
---

# Feature Spec: Internationalization (i18n) — English + Spanish

## Goal

Make every user-facing surface of Aid Protocol bilingual (English and Spanish to start), with automatic language detection on first access to **both** the apex landing site (`aidprotocol.org`, the apex Worker) and the app (`dev.aidprotocol.org`, the Vite + React SPA served by the app Worker). A first-time visitor whose browser or geo says Spanish should land on Spanish copy without doing anything; everyone else gets English. A visible switcher always lets a user override, and that choice is remembered across both surfaces and across visits. The architecture must make adding a third language a content task, not a code change.

This is a **specification only**. No app code is modified by this document.

## Inherited invariants (binding, from the spine)

- **AD-9 (Cloudflare-only; no Next.js):** the client stays a Vite + React SPA; all server logic stays in Cloudflare Workers. The server-side localization of the apex Worker must work **without a build step and without Next.js i18n routing**. No SSR framework is introduced.
- **AD-14 (two-Worker topology over shared D1/KV):** the apex Worker and the app Worker localize independently but must agree on the user's chosen language. The shared signal is a cookie on the registrable domain, not Worker-to-Worker coupling.
- **AD-11 (X OAuth server-side only):** the language cookie is a non-sensitive preference cookie, never `HttpOnly`, and is fully decoupled from `wl_session`. It carries no identity and is never a money or auth authority.
- **AD-12 (Telegram comms channel):** the Telegram bot copy (welcome, help, linked, 2FA) is localized from the same dictionary approach as the apex Worker. The bot picks a locale per chat from Telegram's `language_code`, persisted on the `telegram_chats` row.
- **AD-13 (growth surface off the money path):** the whitelist UI and eligibility messages are translated as copy only. Translation never changes a gate threshold, a reward, or an eligibility decision.

> No invariant in the spine governs presentation language, so i18n introduces no new AD. It is a presentation-layer feature constrained by the ADs above.

## Non-negotiable copy rule (project-wide)

**Zero em dashes (`—`) in any copy, English or Spanish.** This rule (AGENTS.md hard rule 1) applies to every translation value, every interpolated fragment, and every Telegram message. Use commas, colons, periods, or parentheses. A lint check (see Acceptance Criteria) fails the build if any value in `en.json`, `es.json`, or a Worker dictionary contains `—`. The current English source already follows this (it uses the middot `·` as a separator, which is allowed); Spanish must too.

---

## 1. Architecture

There are two distinct rendering surfaces with different mechanics. They share **one cookie contract** and **one locale set** (`en`, `es`), but they do **not** share a runtime library.

### Surface A — the Vite + React SPA (`app/src`)

The SPA is the HTML surface for the product (the app Worker is JSON-only; see `app/worker/index.ts`, which returns `application/json` and lets the SPA render all chrome). The app entry is `app/src/main.tsx`; chrome is `app/src/components/Layout.tsx`; pages are under `app/src/pages/`. All strings today are hardcoded English JSX literals (for example `app/src/pages/Feed.tsx` line 28: `Lifeline for humanity · powered by crypto`).

**Library: `react-i18next` (with `i18next` core). Recommended.**

Justification versus a lighter alternative:

- **`react-i18next` (chosen).** Mature, framework-correct, tree-shakeable, and a clean fit for the existing provider-stack pattern already in `main.tsx` (Wagmi, React Query, Solana, XAuth providers nest there; the i18n provider joins them). It gives us: a `useTranslation()` hook that matches the existing hook style (`useXAuth`); namespaces for code-splitting per page if the bundle grows; ICU-style interpolation and pluralization via `i18next`'s own format or the `i18next-icu` plug-in; a `language-detector` plug-in we configure to match the precedence in section 2; and `Trans` for strings that wrap JSX (the hero, which interleaves `<br/>` and `<span class="grad-text">`, needs this). The runtime cost is small and lazy-loadable.
- **Lighter alternative considered: a hand-rolled `t()` over a flat JSON + React context** (roughly 40 lines, what the apex Worker will use). Rejected for the SPA because the SPA has real i18n needs the Worker does not: JSX interpolation in headings (`Trans`), plurals (`{count} donors` / `{count} donantes`, `1 spot` / `1 plaza`), number and currency formatting tied to the active locale, and a likely third and fourth language soon. Re-implementing detection precedence, plural rules, and JSX interpolation by hand is exactly the wheel `react-i18next` already ships, and it would drift. We accept the dependency for the SPA and keep the hand-rolled approach only where there is no bundler (the Workers).

**Translation-key structure: `app/src/locales/{en,es}.json`.**

Keys are namespaced by surface area, dot-delimited, value = the natural-language string. Mirror the page/component tree so a translator and a developer find the same key. Sketch:

```jsonc
// app/src/locales/en.json
{
  "nav": {
    "disasters": "Disasters",
    "leaderboard": "Leaderboard",
    "news": "News",
    "requestAid": "Request aid",
    "openMenu": "Open menu",
    "closeMenu": "Close menu"
  },
  "common": {
    "loading": "Loading…",
    "donateNow": "Donate now",
    "back": "Back to disasters",
    "donors": "{{count}} donor",
    "donors_other": "{{count}} donors",
    "spotsClaimed": "{{count}}/{{total}} spots claimed"
  },
  "feed": {
    "eyebrow": "Lifeline for humanity · powered by crypto",
    "h1_line1": "Every donation on-chain.",
    "h1_line2": "Every dollar proven.",
    "lead": "Fund verified disaster relief on Solana and Ethereum. Funds are held in escrow and released only against AI-verified proof of how they were spent.",
    "exploreDisasters": "Explore disasters",
    "howItWorks": "How it works",
    "raisedOnChain": "Raised on-chain",
    "activeDisasters": "Active disasters",
    "chainsSupported": "Chains supported",
    "featuredEmergency": "Featured emergency",
    "loadError": "Couldn't load campaigns. {{error}}",
    "step1Title": "Give on any chain",
    "step1Body": "Donate SOL, ETH, or stablecoins from your wallet, publicly or anonymously. Every gift is written to an immutable on-chain ledger."
    // ... step2, step3, news preview, etc.
  },
  "campaign": { /* ... */ },
  "leaderboard": { /* ... */ },
  "news": { /* ... */ },
  "apply": {
    "eyebrow": "Request aid",
    "signedOutH1_a": "Sign in with X to",
    "signedOutH1_b": "request aid.",
    "fieldOrgName": "Organization or your name",
    "phOrgName": "Atlas Mutual Aid",
    "submit": "Submit request",
    "submitting": "Submitting…",
    "received": "Request received"
    // ... every FIELD label + placeholder, summary prompt, notes
  },
  "legal": { "privacyTitle": "Privacy Policy", "termsTitle": "Terms of Service" },
  "banner": { "demo": "Demo environment. All campaigns, donors, and amounts are mock data. No real funds move." },
  "footer": { "tagline": "A non-profit, open-source lifeline for disaster relief. Every gift is recorded on-chain and released against verified proof of spend.", "onchainLedger": "On-chain ledger · proof-gated escrow" },
  "values": { "transparent": "Transparent", "secure": "Secure", "global": "Global", "human": "Human", "decentralized": "Decentralized" },
  "switcher": { "label": "Language", "en": "English", "es": "Español" }
}
```

`es.json` has the identical key tree with Spanish values. **Keys never carry meaning in any language;** a key is `feed.eyebrow`, not `feed.lifeline_for_humanity`. Long legal text (`app/src/legal.ts` PRIVACY / TERMS) is the exception: rather than one giant value, move it to `app/src/locales/legal.{en,es}.ts` keyed `privacy` / `terms` and load it as its own namespace so the main bundle stays lean.

**Language provider at the app root.**

Create `app/src/i18n.ts` that configures `i18next` with the two resource bundles, `fallbackLng: 'en'`, the custom detection order from section 2, and (if used) `i18next-icu`. Import it once for side-effect in `main.tsx`, and wrap the tree in `<I18nextProvider i18n={i18n}>` as the outermost provider (so every other provider and all routes can translate). Set `<html lang>` reactively to the active locale via a tiny effect (`document.documentElement.lang = i18n.language`).

**`useTranslation()` usage pattern.**

```tsx
// plain string
const { t } = useTranslation();
<div className="eyebrow">{t("feed.eyebrow")}</div>

// interpolation + plural
<span className="muted">{t("common.donors", { count: c.donor_count })}</span>

// JSX-bearing heading (hero with <br/> and a gradient span)
import { Trans } from "react-i18next";
<h1><Trans i18nKey="feed.heroHeading"
  components={{ br: <br />, grad: <span className="grad-text" /> }} /></h1>
// en: "Every donation on-chain.<br/><grad>Every dollar proven.</grad>"
// es: "Cada donación en cadena.<br/><grad>Cada dólar comprobado.</grad>"
```

Switching language calls `i18n.changeLanguage('es')`, which persists per section 2 and re-renders the tree. No route changes, no per-locale URL prefix (keeps the SPA router in `main.tsx` untouched and stays within AD-9).

### Surface B — the Cloudflare Workers that serve HTML (`app/coming-soon`)

The apex Worker (`app/coming-soon/index.js`) is the **only** server-rendered HTML surface. It returns a single template-literal `HTML` constant (line 392) plus the JSON whitelist API and the Telegram webhook. The app Worker (`app/worker/index.ts`) returns JSON only, so it needs **no** HTML localization; it should, however, return localized `error.message` text (see Scope), which it can do with the same dictionary approach.

**Localize without a build step: a per-locale dictionary object chosen per request.** No library, no bundler, no Next.js.

1. Add a `DICT` object near the top of `app/coming-soon/index.js`:

```js
const DICT = {
  en: {
    title: "Aid Protocol · a lifeline for disaster relief, on-chain",
    eyebrow: "Launching soon",
    herotag: 'Lifeline for humanity · Powered by <b>crypto</b>',
    h1a: "A lifeline for disaster relief, ",
    h1grad: "on-chain.",
    lead: "Aid Protocol is a non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.",
    followX: "Follow on X",
    viewGithub: "View on GitHub",
    wlBadge: "🎟️ Tester whitelist · 10 spots",
    wlH2: "Help us test on mainnet. Get $10.",
    wlLead: "We're whitelisting 10 testers to try Aid Protocol on mainnet when it goes live. Each tester who helps gets $10 in USDC. Sign in with X to claim a spot.",
    wlClaim: "Claim a spot with X",
    wlClaimMine: "Claim my spot",
    wlSignedIn: "Signed in as @{handle}",
    wlFull: "Whitelist is full. Follow @aidprotocol_ for the next round.",
    wlDone: "You're in, @{handle}. Your spot is secured, we'll email you when mainnet testing opens.",
    spotsClaimed: "{count}/{total} spots claimed",
    spotsAll: "All {total} spots claimed",
    privacy: "Privacy", terms: "Terms"
    // ... every visible string + the JS-side whitelist strings
  },
  es: { /* identical keys, natural Spanish values */ }
};
const SUPPORTED = ["en", "es"];
const DEFAULT_LOCALE = "en";
function t(locale, key, vars) {
  const d = DICT[locale] || DICT[DEFAULT_LOCALE];
  let s = (d[key] != null ? d[key] : DICT[DEFAULT_LOCALE][key]) || "";
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
```

2. Turn the `HTML` constant into a `renderHTML(locale)` function so the template reads from `t(locale, ...)` and sets `<html lang="${locale}">`. The branch at `index.js` line 384 (`if (path === "/" || path === "")`) computes the locale once per request (section 2) and returns `renderHTML(locale)`. The client-side `loadWL()` script reads its strings from a small `window.__I18N` JSON object that `renderHTML` inlines for the active locale, so the whitelist UI strings (`Signed in as`, `Claim my spot`, error fallbacks) are localized too without a second fetch.

3. Telegram webhook copy (`/start` welcome, the linked confirmation, `/help`, the fallback, and the 2FA message body) reads from the **same `DICT`** via `t(locale, ...)`. The bot's locale is resolved per section 2 (Telegram path).

This keeps the apex Worker self-contained, Cloudflare-only, build-step-free, and trivially extensible: a new language is a new key block in `DICT` and `locales/*.json`.

**Why two mechanisms is correct, not duplication:** the SPA has a bundler and rich i18n needs (JSX, plurals, locale-aware `Intl`), so it earns a library; the Workers have no bundler and a fixed, small string set, so a dictionary object is lighter and avoids shipping a library into a Worker. Both read the **same cookie** and the **same two locale codes**, so the user experiences one language across both. The English and Spanish *values* should be kept consistent between the two stores by review, since a handful of strings (brand tagline, Privacy/Terms labels, the lead paragraph) appear on both surfaces.

---

## 2. Auto-detection and precedence

Default language is **English**. Detection runs once on first access per surface and the result is persisted so subsequent visits skip detection.

### Precedence order (highest wins), identical on both surfaces

1. **Explicit choice** — the `lang` cookie (set by the switcher). If present and in `SUPPORTED`, use it. Full stop.
2. **Browser preference** — server: the first supported tag in the `Accept-Language` header; client (SPA, when no cookie and running before the server set one): `navigator.language` / `navigator.languages`.
3. **Geo fallback** — Cloudflare's `request.cf.country` or the `CF-IPCountry` request header. Spanish-speaking countries map to `es`: `ES, MX, AR, CO, PE, VE, CL, GT, EC, BO, CU, DO, HN, PY, SV, NI, CR, PA, UY, GQ` (plus `US` stays English by default; do not force `es` on US IPs). Geo only breaks a tie when `Accept-Language` is missing or matches nothing supported.
4. **Default** — `en`.

### Server (apex Worker, and the app Worker's error envelopes)

```js
function pickLocale(request) {
  const cookie = cookieVal(request, "lang");           // existing helper in index.js
  if (SUPPORTED.includes(cookie)) return cookie;
  const al = request.headers.get("accept-language") || "";
  for (const part of al.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();      // e.g. "es-mx"
    const base = tag.split("-")[0];
    if (SUPPORTED.includes(base)) return base;
  }
  const country = (request.cf && request.cf.country) ||
                  request.headers.get("cf-ipcountry") || "";
  if (ES_COUNTRIES.has(country.toUpperCase())) return "es";
  return DEFAULT_LOCALE;
}
```

The resolved locale is used to render and is also written back as a cookie when it came from detection (not from an existing cookie), so the SPA and later requests agree without re-detecting. Set:

```
Set-Cookie: lang=<locale>; Path=/; Domain=.aidprotocol.org; Max-Age=31536000; SameSite=Lax; Secure
```

`Domain=.aidprotocol.org` is what makes the apex and the app subdomain share the choice (AD-14: shared state via a cookie on the registrable domain, not Worker-to-Worker coupling). The cookie is **not** `HttpOnly` so the SPA can read and write it (AD-11: it is a non-sensitive preference, fully separate from `wl_session`). On localhost the `Domain` attribute is omitted.

### Client (SPA)

Configure `i18next` detection to mirror the order: `['cookie', 'navigator']` then `htmlTag`, with `fallbackLng: 'en'`, `lookupCookie: 'lang'`, `caches: ['cookie', 'localStorage']`, cookie options matching the server's (`Domain`, `Max-Age`, `SameSite=Lax`, `Secure`). Because the server already set `lang` on the apex visit, a user who arrives at the SPA via the apex inherits their language with no flash. A user who deep-links straight to the SPA with no cookie falls back to `navigator.language`, then default `en` (the SPA cannot read geo headers client-side; geo is a server-only signal, which is acceptable since the cookie path covers the common apex-first journey).

### Switcher (both surfaces)

A visible control in the header (SPA: in `Layout.tsx` near `XSignIn`/`WalletButton`; apex: in the `header`/`footer` of `renderHTML`). Selecting a language:

- SPA: `i18n.changeLanguage(code)` (writes cookie + localStorage via the detector caches) and updates `document.documentElement.lang`.
- Apex: a tiny inline script sets the `lang` cookie (with the shared `Domain`) and reloads, or links to `/?lang=es`; the Worker honors a `?lang=` query param as an explicit choice equal in precedence to the cookie, then 302s to strip the param and set the cookie.

### Telegram (AD-12)

On first message, resolve the chat's locale from Telegram's `from.language_code` (`es*` to `es`, else `en`), store it on the `telegram_chats` row (new nullable `lang` column, a projection field only, AD-2/AD-13), and use it for the welcome/help/2FA copy. A future `/lang es` command can override and update the column.

---

## 3. Scope — surfaces and strings to translate

Enumerated so a translator has a complete checklist. Every item below needs an `en` and an `es` value.

**Apex landing (`app/coming-soon/index.js`):**
- `<title>`, `<meta description>`, OG title/description (translate the human-readable values; keep the brand name "Aid Protocol").
- Hero: eyebrow "Launching soon", herotag "Lifeline for humanity · Powered by crypto", H1 "A lifeline for disaster relief, on-chain.", lead paragraph.
- CTAs: "Follow on X", "View on GitHub".
- Whitelist UI: badge "Tester whitelist · 10 spots", H2 "Help us test on mainnet. Get $10.", lead, "Claim a spot with X", "Signed in as @handle", "Claim my spot", "Claiming…", the done/full/in-progress states, the count strings ("{n}/{total} spots claimed", "All {total} spots claimed"), and every error fallback in `loadWL()` and the `join` handler responses ("Enter a valid email", "Use a permanent email…", "Whitelist is full", the eligibility reasons in `evaluateTester` and the follow-gate messages).
- Footer: copyright line, Privacy, Terms link labels.

**App nav + chrome (`app/src/components/Layout.tsx`):**
- Demo banner, nav links (Disasters, Leaderboard, News, Request aid), burger `aria-label` (Open/Close menu), values strip (Transparent, Secure, Global, Human, Decentralized), footer tagline + base lines.

**App pages (`app/src/pages/`):**
- **Feed** (`Feed.tsx`): hero eyebrow/H1/lead/CTAs, the four stat labels, loading + error text, "Featured emergency", "Active emergency", "Donate now", "More active disasters", "Past campaigns →", "{n} donors", "How it works" + the three step titles/bodies, "Latest news", "All news →", the "Relief update"/"News" pills.
- **Campaign** (`Campaign.tsx`): all labels, tranche/proof status text, donate flow copy, share copy.
- **Leaderboard** (`Leaderboard.tsx`): headings, column labels, badge tier names (Supporter, Bronze, Silver, Gold, Platinum) — decide per-product whether tier names stay English brand terms or translate; recommend keep tier names in English as proper nouns, translate surrounding labels.
- **News** (`News.tsx`): headings, category pills, empty state. (Ingested article titles/sources stay in their source language; only chrome is translated.)
- **Apply** (`Apply.tsx`): eyebrow, signed-out and signed-in H1s + lead, every `FIELDS` label and placeholder, the summary prompt + textarea placeholder, "Submit request"/"Submitting…", the received-state copy, the diligence note.
- **Profile** (`Profile.tsx`), **Past** (`Past.tsx`): headings, labels, empty states.
- **Legal** (`Legal.tsx` + `legal.ts`): the Privacy Policy and Terms of Service titles and full body text (own namespace; needs a careful Spanish legal translation, flagged below).
- **Admin** (`Admin.tsx`): **out of scope.** Internal reviewer console behind `ADMIN_TOKEN`; English-only is acceptable and keeps scope down.

**Error / envelope messages:**
- App Worker (`app/worker/index.ts`) returns `{ ok, error: { code, message } }` (spine convention). The SPA shows `error.message` raw today (e.g. `Apply.tsx` line 35, `Feed.tsx` "Couldn't load campaigns. {error}"). Two options, pick the cleaner one at build: (a) Worker localizes `message` per request locale from its own small dictionary, keyed by the stable `error.code`; or (b) Worker returns the stable `code`, and the SPA maps `code` to a localized string via `errors.<code>` keys. **Recommend (b):** the `code` is already a stable enum (spine "Errors / envelopes"), so the SPA owns presentation and the Worker stays presentation-free. The generic network catch ("Couldn't load…") is localized in the SPA regardless.

**Telegram bot copy (apex Worker, AD-12):**
- `/start` welcome (the `caption`), the linked-account confirmation, `/help`, the "Got it. Nothing to action…" fallback, the `/id` reply, and the 2FA code message body ("Your Aid Protocol verification code is {code}. It expires in 10 minutes.").

### Number / currency / date localization

- **Currency:** keep USD as the settlement and display currency (AD-8). Localize **formatting**, not the currency: `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`. `app/src/lib.ts` currently hardcodes `"en-US"` in `usd` and `num`; change these to take the active locale (en-US gives `$1,234`; es gives `1234 US$` by default, so consider `es-US` or an explicit pattern to keep the leading `$` and grouping that disaster-relief donors expect; decide the exact pattern with the native reviewer).
- **Numbers:** `num` likewise uses the active locale (thousands separator differs: `1,234` vs `1.234`).
- **Dates:** any date rendered in the SPA (news `published_at`, campaign timestamps) uses `Intl.DateTimeFormat(locale, ...)`. Stored values stay UTC ISO-8601 (spine convention); only the display is localized.
- **Plurals:** "donor/donors", "spot/spots", "day/days" use i18next plural keys (`_one`/`_other`); Spanish plural rules differ and i18next handles them.

---

## 4. Constraints

- **Zero em dashes** in every `en` and `es` value, every interpolated fragment, and every Telegram string (AGENTS.md rule 1; lint-enforced, see below).
- **Cloudflare-only / no Next.js** (AD-9): the Workers localize via a plain dictionary object chosen per request, no SSR framework, no per-locale routing, no build step added to the Workers. The SPA stays a Vite + React SPA; `react-i18next` is a client dependency only.
- **Canonical model untouched** (AD-2): translation is presentation only. No D1 schema change except one additive, nullable `telegram_chats.lang` projection column for the bot's locale (a rebuildable projection field, never authoritative). The `lang` cookie carries no identity (AD-11).
- **Natural Spanish, not machine translation.** The first-pass Spanish may be drafted with machine help, but **a native Spanish reviewer must sign off** before launch, especially: the hero and tagline (tone matters for a relief brand), the eligibility/error messages (must not sound accusatory), the legal Privacy/Terms text (precision matters), and the Telegram welcome. Flag `es.json` and the Worker `DICT.es` as "draft, pending native review" in `status` until that review lands. Latin American neutral Spanish is the target register (the geo list skews Latin America); avoid Spain-only idioms.
- The brand name "Aid Protocol", the handle `@aidprotocol_`, chain names (Solana, Ethereum, Base), and asset tickers (USDC, USDT, SOL, ETH) are **not** translated.

---

## 5. Acceptance criteria

1. A first-time visitor with `Accept-Language: es` (and no cookie) hitting `aidprotocol.org/` gets the Spanish landing page, and `<html lang="es">`, with a `lang=es` cookie set on `.aidprotocol.org`.
2. A first-time visitor with no `Accept-Language` match and `CF-IPCountry: MX` gets Spanish; with `CF-IPCountry: US` gets English.
3. A visitor who picks English via the switcher keeps English on the next visit and on the app subdomain (cookie precedence beats `Accept-Language` and geo).
4. The same user, navigating from the apex to `dev.aidprotocol.org`, sees the SPA already in their chosen language with no flash of English (shared cookie inherited by the i18next cookie detector).
5. Every enumerated string in section 3 (excluding Admin and ingested article bodies) renders from a translation key in both `en` and `es`; a grep for the original hardcoded English literals in `app/src/pages` and `app/src/components` and the apex `HTML`/Telegram copy returns nothing outside the locale stores.
6. `usd`, `num`, and any displayed date format by the active locale.
7. **Lint gate:** a CI check fails if any value in `app/src/locales/*.json`, the legal locale files, or the Worker `DICT` contains `—` (em dash), and fails if any key present in `en.json` is missing from `es.json` (and vice versa) so the two stay in lockstep.
8. The Telegram `/start`, `/help`, linked, fallback, and 2FA messages render in the chat's resolved locale.
9. No Next.js, no SSR framework, no per-locale URL prefix introduced; the SPA router and the Worker route table are unchanged in shape.
10. Switching language never changes a whitelist gate, a reward, an eligibility decision, or a stored canonical value (AD-13, AD-2).

## Migration plan (incremental, no big-bang)

The goal is to extract hardcoded strings into keys page by page while the app keeps shipping, never a single sweeping rewrite.

1. **Scaffold (no behavior change).** Add `react-i18next` + `i18next` to `app/`, create `app/src/i18n.ts`, `app/src/locales/en.json` (empty namespaces), `es.json` (clone), wrap `main.tsx` in the provider, mount the switcher. With only `en` populated and `fallbackLng: 'en'`, the app renders identically.
2. **Extract chrome first.** Move `Layout.tsx` strings (nav, banner, footer, values) into `nav`/`banner`/`footer`/`values` namespaces. This is the highest-visibility, lowest-risk surface and validates the pattern (including the `Trans` JSX cases).
3. **Page by page.** One page per PR: `Feed`, then `Apply`, `Campaign`, `Leaderboard`, `News`, `Profile`, `Past`, then `Legal` (its own namespace, larger). Each PR (a) replaces literals with `t()`/`Trans`, (b) adds the `en` values (verbatim from current copy, so English is a pure refactor), (c) adds draft `es` values. A page is "done" when no English literal remains in its JSX.
4. **Locale-ify the formatters.** Switch `lib.ts` `usd`/`num` to take the active locale; add a date helper. Do this once the provider exists so the active locale is available.
5. **Apex Worker.** Introduce `DICT`, `pickLocale`, and `renderHTML(locale)` in `app/coming-soon/index.js`; convert the `HTML` constant and the inline `loadWL()` strings; localize the Telegram and 2FA copy; add the `telegram_chats.lang` migration (`app/db/` next migration in sequence).
6. **Error envelopes.** Adopt approach (b): SPA maps stable `error.code` to `errors.<code>` keys; confirm the Worker returns codes for the user-visible failures (`Apply.tsx`, `Feed.tsx`).
7. **Native review + flip status.** Native Spanish reviewer passes over `es.json`, the legal Spanish, and `DICT.es`; remove the "draft, pending native review" flag. Enable the em-dash and key-parity lint gate in CI.
8. **QA the precedence matrix** against the acceptance criteria (cookie vs `Accept-Language` vs geo; apex-to-app inheritance; switcher persistence).

Each step is independently shippable: until a page is extracted it renders English as before, so the migration can pause or interleave with other work at any point.

## Extensibility to more languages

- **SPA:** add `app/src/locales/<code>.json` with the same key tree, register it in `i18n.ts` resources, add it to the switcher list. The key-parity lint (criterion 7) catches any missing key. No component changes.
- **Workers:** add a `<code>` block to `DICT`, add the code to `SUPPORTED`, and add its countries to the geo map. No structural change.
- **RTL note:** the current two languages are LTR. When a first RTL language (for example Arabic, plausible for disaster-relief reach) is added, the active locale must also drive `dir="rtl"` on `<html>` and a CSS logical-properties pass; that is out of scope here but the locale plumbing built by this spec is the hook for it.
- Keep the English and Spanish *values* that appear on both surfaces (brand tagline, Privacy/Terms labels, the shared lead) reviewed together so the two stores do not drift.

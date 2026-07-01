// Production apex worker for aidprotocol.org: branded coming-soon page + the tester
// whitelist (Sign in with X -> email -> stored, capped at 10 spots).

const SPOTS = 10;
const X_AUTHORIZE = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN = "https://api.twitter.com/2/oauth2/token";
const X_ME = "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name";

// --- Internationalization (i18n): English + Spanish, no build step (AD-9) ---
// One per-request dictionary chosen by pickLocale(); a new language is a new key
// block plus a country list entry, no structural change. Zero em dashes in any
// value (AGENTS.md rule 1); the separator is the middot U+00B7.
const SUPPORTED = ["en", "es"];
const DEFAULT_LOCALE = "en";
// Spanish-speaking countries map to 'es' when Accept-Language does not match.
// US stays English by default (do not force 'es' on US IPs).
const ES_COUNTRIES = new Set([
  "ES", "MX", "AR", "CO", "PE", "VE", "CL", "GT", "EC", "BO",
  "CU", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "GQ",
]);

const DICT = {
  en: {
    // <head>
    title: "Aid Protocol · a lifeline for disaster relief, on-chain",
    metaDesc: "Aid Protocol is a non-profit, open-source platform for disaster relief. Donations are recorded on-chain and released against proof of spend. Launching soon.",
    ogDesc: "A non-profit lifeline for disaster relief. On-chain donations, released against proof. Launching soon.",
    // hero
    eyebrow: "Launching soon",
    herotag: 'Lifeline for humanity · Powered by <b>crypto</b>',
    h1a: "A lifeline for disaster relief, ",
    h1grad: "on-chain.",
    lead: "Aid Protocol is a non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.",
    followX: "Follow on X",
    viewGithub: "View on GitHub",
    // whitelist card
    wlBadge: "🎟️ Tester whitelist · 10 spots",
    wlH2: "Help us test on mainnet. Get $10.",
    wlLead: "We're whitelisting 10 testers to try Aid Protocol on mainnet when it goes live. Each tester who helps gets $10 in USDC. Sign in with X to claim a spot.",
    // footer
    footerCopy: "© 2026 Aid Protocol · Non-profit · Open source",
    privacy: "Privacy",
    terms: "Terms",
    // language switcher
    switchLabel: "Language",
    langEn: "English",
    langEs: "Español",
    // whitelist client strings (inlined for loadWL)
    wlUnavailable: "Whitelist temporarily unavailable.",
    wlAllClaimed: "All {total} spots claimed",
    wlSpotsClaimed: "{count}/{total} spots claimed",
    wlDone: "You're in, @{handle}. Your spot is secured, we'll email you when mainnet testing opens.",
    wlFull: "Whitelist is full. Follow @aidprotocol_ for the next round.",
    wlSignedIn: "Signed in as @{handle}",
    wlEmailPh: "you@email.com",
    wlClaimMine: "Claim my spot",
    wlClaiming: "Claiming…",
    wlClaimFail: "Could not claim a spot.",
    wlClaimX: "Claim a spot with X",
    // whitelist / join API messages
    errSignInFirst: "Sign in with X first",
    errValidEmail: "Enter a valid email",
    errPermanentEmail: "Use a permanent email, not a temporary or disposable one.",
    errFull: "Whitelist is full",
    errTesterReqs: "Your X account does not meet the tester requirements.",
    errFollowFirst: "Follow @aidprotocol_ on X first, then claim your spot.",
    errFollowUnverified: "We could not verify your follow yet. Make sure you follow @aidprotocol_ and try again in a moment.",
    // tester eligibility reasons
    gateFollowers: "Your X account needs at least {min} followers.",
    gateTooNew: "Your X account is too new (it should be about 2 years old).",
    gateNoPhoto: "Add a profile photo to your X account first.",
    gateNoBio: "Add a bio to your X account first.",
    gateNoPosts: "Your X account has no posts.",
    gateRatio: "Your follower-to-following ratio looks automated.",
    gateVerifyUnavailable: "verification unavailable",
    gateNotFound: "X account not found or suspended",
    gateVerifyError: "verification error",
    // 2FA API messages
    errMissingTarget: "Missing target",
    errNotStartedBot: "This Telegram user has not started the bot yet",
    errTgSendFail: "Could not send Telegram message",
    errEmailNotConfigured: "Email sending is not configured yet",
    errEmailSendFail: "Could not send email",
    errMissingTargetCode: "Missing target or code",
    errNoPendingCode: "No pending code",
    errCodeExpired: "Code expired",
    errTooManyAttempts: "Too many attempts",
    errIncorrectCode: "Incorrect code",
    twofaEmailSubject: "Your Aid Protocol verification code",
    // Telegram bot copy
    tgLinked: "Connected{handle}. Your Telegram is now linked to <b>Aid Protocol</b>. We will message you here with test tasks and reminders.",
    tgWelcome: "Welcome to <b>Aid Protocol</b>{name}.\n\nThis is how we reach testers, ambassadors, and campaign organizers: verification codes, test tasks, and proof-of-expense reminders.\n\nYou are connected. We will message you here when there is something to do. Send /help to see commands.",
    tgHelp: "<b>Aid Protocol bot</b>\n\n/start  connect this chat\n/id  show your chat id\n/help  this message\n\nWe send verification codes and reminders here.",
    tgId: "Your chat id is <code>{id}</code>.",
    tgFallback: "Got it. Nothing to action right now. Send /help for what this bot does.",
    twofaBody: "Your Aid Protocol verification code is {code}. It expires in 10 minutes.",
  },
  es: {
    // <head>
    title: "Aid Protocol · una tabla de salvación para desastres, en cadena",
    metaDesc: "Aid Protocol es una plataforma sin fines de lucro y de código abierto para ayuda en desastres. Las donaciones se registran en cadena y se liberan contra pruebas de gasto. Muy pronto.",
    ogDesc: "Una tabla de salvación sin fines de lucro para ayuda en desastres. Donaciones en cadena, liberadas contra pruebas. Muy pronto.",
    // hero
    eyebrow: "Muy pronto",
    herotag: 'Salvación para la humanidad · Impulsada por <b>cripto</b>',
    h1a: "Una tabla de salvación para desastres, ",
    h1grad: "en cadena.",
    lead: "Aid Protocol es una plataforma sin fines de lucro y de código abierto donde las donaciones a desastres verificados se registran en cadena y solo se liberan del depósito en garantía contra pruebas de gasto. Dona de forma pública o anónima, en Solana o Ethereum.",
    followX: "Síguenos en X",
    viewGithub: "Ver en GitHub",
    // whitelist card
    wlBadge: "🎟️ Lista de probadores · 10 lugares",
    wlH2: "Ayúdanos a probar en mainnet. Recibe $10.",
    wlLead: "Estamos seleccionando a 10 probadores para usar Aid Protocol en mainnet cuando esté disponible. Cada probador que ayude recibe $10 en USDC. Inicia sesión con X para reservar tu lugar.",
    // footer
    footerCopy: "© 2026 Aid Protocol · Sin fines de lucro · Código abierto",
    privacy: "Privacidad",
    terms: "Términos",
    // language switcher
    switchLabel: "Idioma",
    langEn: "English",
    langEs: "Español",
    // whitelist client strings (inlined for loadWL)
    wlUnavailable: "Lista de probadores no disponible por el momento.",
    wlAllClaimed: "Los {total} lugares están ocupados",
    wlSpotsClaimed: "{count}/{total} lugares ocupados",
    wlDone: "Ya estás dentro, @{handle}. Tu lugar está reservado, te escribiremos por correo cuando abran las pruebas en mainnet.",
    wlFull: "La lista está llena. Sigue a @aidprotocol_ para la próxima ronda.",
    wlSignedIn: "Sesión iniciada como @{handle}",
    wlEmailPh: "tu@correo.com",
    wlClaimMine: "Reservar mi lugar",
    wlClaiming: "Reservando…",
    wlClaimFail: "No se pudo reservar el lugar.",
    wlClaimX: "Reserva tu lugar con X",
    // whitelist / join API messages
    errSignInFirst: "Primero inicia sesión con X",
    errValidEmail: "Ingresa un correo válido",
    errPermanentEmail: "Usa un correo permanente, no uno temporal o desechable.",
    errFull: "La lista está llena",
    errTesterReqs: "Tu cuenta de X no cumple los requisitos para probadores.",
    errFollowFirst: "Primero sigue a @aidprotocol_ en X y luego reserva tu lugar.",
    errFollowUnverified: "Aún no pudimos verificar que sigues la cuenta. Asegúrate de seguir a @aidprotocol_ e inténtalo de nuevo en un momento.",
    // tester eligibility reasons
    gateFollowers: "Tu cuenta de X necesita al menos {min} seguidores.",
    gateTooNew: "Tu cuenta de X es demasiado nueva (debería tener unos 2 años).",
    gateNoPhoto: "Primero agrega una foto de perfil a tu cuenta de X.",
    gateNoBio: "Primero agrega una biografía a tu cuenta de X.",
    gateNoPosts: "Tu cuenta de X no tiene publicaciones.",
    gateRatio: "Tu proporción de seguidores a seguidos parece automatizada.",
    gateVerifyUnavailable: "verificación no disponible",
    gateNotFound: "Cuenta de X no encontrada o suspendida",
    gateVerifyError: "error de verificación",
    // 2FA API messages
    errMissingTarget: "Falta el destinatario",
    errNotStartedBot: "Este usuario de Telegram aún no ha iniciado el bot",
    errTgSendFail: "No se pudo enviar el mensaje de Telegram",
    errEmailNotConfigured: "El envío de correo aún no está configurado",
    errEmailSendFail: "No se pudo enviar el correo",
    errMissingTargetCode: "Falta el destinatario o el código",
    errNoPendingCode: "No hay ningún código pendiente",
    errCodeExpired: "El código expiró",
    errTooManyAttempts: "Demasiados intentos",
    errIncorrectCode: "Código incorrecto",
    twofaEmailSubject: "Tu código de verificación de Aid Protocol",
    // Telegram bot copy
    tgLinked: "Conectado{handle}. Tu Telegram ya está vinculado a <b>Aid Protocol</b>. Te escribiremos aquí con tareas de prueba y recordatorios.",
    tgWelcome: "Te damos la bienvenida a <b>Aid Protocol</b>{name}.\n\nAsí nos comunicamos con probadores, embajadores y organizadores de campañas: códigos de verificación, tareas de prueba y recordatorios de comprobantes de gasto.\n\nYa estás conectado. Te escribiremos aquí cuando haya algo que hacer. Envía /help para ver los comandos.",
    tgHelp: "<b>Bot de Aid Protocol</b>\n\n/start  conectar este chat\n/id  mostrar tu id de chat\n/help  este mensaje\n\nEnviamos códigos de verificación y recordatorios aquí.",
    tgId: "Tu id de chat es <code>{id}</code>.",
    tgFallback: "Entendido. No hay nada que hacer por ahora. Envía /help para ver qué hace este bot.",
    twofaBody: "Tu código de verificación de Aid Protocol es {code}. Expira en 10 minutos.",
  },
};

function t(locale, key, vars) {
  const d = DICT[locale] || DICT[DEFAULT_LOCALE];
  let s = (d[key] != null ? d[key] : DICT[DEFAULT_LOCALE][key]) || "";
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

// Resolve the chosen locale per request. Precedence (highest wins):
// 1. explicit `lang` cookie (set by the switcher), 2. Accept-Language header,
// 3. Cloudflare geo (request.cf.country or CF-IPCountry), 4. default 'en'.
function pickLocale(request) {
  const cookie = cookieVal(request, "lang");
  if (SUPPORTED.includes(cookie)) return cookie;
  const al = request.headers.get("accept-language") || "";
  for (const part of al.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if (SUPPORTED.includes(base)) return base;
  }
  const country = ((request.cf && request.cf.country) || request.headers.get("cf-ipcountry") || "").toUpperCase();
  if (ES_COUNTRIES.has(country)) return "es";
  return DEFAULT_LOCALE;
}

// Telegram picks its locale from the chat's stored preference (from language_code),
// falling back to language_code on the update, then default 'en'.
function tgLocale(stored, languageCode) {
  if (SUPPORTED.includes(stored)) return stored;
  const base = String(languageCode || "").split("-")[0].toLowerCase();
  return SUPPORTED.includes(base) ? base : DEFAULT_LOCALE;
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function pkceChallenge(verifier) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(d));
}
function cookieVal(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// --- Tester eligibility (AD-13): public-identity quality gate ---
const MIN_FOLLOWERS = 25;
const MIN_ACCOUNT_AGE_DAYS = 730; // about 2 years
const OUR_X_REST_ID = "2071141117664411648"; // @aidprotocol_

// Common disposable / temporary email domains (extend as needed).
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "getnada.com", "trashmail.com", "sharklasers.com",
  "grr.la", "maildrop.cc", "mailnesia.com", "dispostable.com", "fakeinbox.com", "tempinbox.com",
  "mohmal.com", "mintemail.com", "emailondeck.com", "spamgourmet.com", "mytemp.email", "tempr.email",
  "33mail.com", "mailcatch.com", "discard.email", "tmail.io", "moakt.com", "luxusmail.org",
]);
function isDisposableEmail(email) {
  const dom = String(email).split("@")[1];
  return !dom || DISPOSABLE_EMAIL_DOMAINS.has(dom.toLowerCase().trim());
}

// One RapidAPI /user call returns every signal we gate on.
async function fetchXProfile(handle, key, locale) {
  if (!key) return { ok: false, error: t(locale, "gateVerifyUnavailable") };
  try {
    const r = await fetch(`https://twitter241.p.rapidapi.com/user?username=${encodeURIComponent(handle)}`, {
      headers: { "x-rapidapi-host": "twitter241.p.rapidapi.com", "x-rapidapi-key": key },
    });
    const j = await r.json();
    const u = j && j.result && j.result.data && j.result.data.user && j.result.data.user.result;
    if (!u || u.__typename !== "User") return { ok: false, error: t(locale, "gateNotFound") };
    const leg = u.legacy || {};
    const core = u.core || {};
    const createdMs = core.created_at ? Date.parse(core.created_at) : NaN;
    return {
      ok: true,
      restId: u.rest_id || null,
      followers: typeof leg.followers_count === "number" ? leg.followers_count : null,
      following: typeof leg.friends_count === "number" ? leg.friends_count : null,
      statuses: leg.statuses_count || 0,
      defaultImage: !!leg.default_profile_image,
      hasBio: !!(leg.description && String(leg.description).trim()),
      verified: !!u.is_blue_verified,
      createdAt: core.created_at || null,
      ageDays: isNaN(createdMs) ? null : Math.floor((Date.now() - createdMs) / 86400000),
    };
  } catch {
    return { ok: false, error: t(locale, "gateVerifyError") };
  }
}

// Evaluate the quality gate. Returns { pass, reason }.
function evaluateTester(p, locale) {
  if (!p.ok) return { pass: false, reason: p.error };
  if (typeof p.followers === "number" && p.followers < MIN_FOLLOWERS)
    return { pass: false, reason: t(locale, "gateFollowers", { min: MIN_FOLLOWERS }) };
  if (typeof p.ageDays === "number" && p.ageDays < MIN_ACCOUNT_AGE_DAYS)
    return { pass: false, reason: t(locale, "gateTooNew") };
  if (p.defaultImage) return { pass: false, reason: t(locale, "gateNoPhoto") };
  if (!p.hasBio) return { pass: false, reason: t(locale, "gateNoBio") };
  if ((p.statuses || 0) < 1) return { pass: false, reason: t(locale, "gateNoPosts") };
  if (typeof p.followers === "number" && typeof p.following === "number" && p.followers < 50 && p.following > p.followers * 20)
    return { pass: false, reason: t(locale, "gateRatio") };
  return { pass: true, reason: null };
}

// Does this user follow @aidprotocol_? Scans our (small) follower list.
// Returns true / false / null (unknown, e.g. API error).
async function followsUs(restId, handle, key) {
  if (!key) return null;
  const wantId = restId ? String(restId) : null;
  const wantHandle = handle ? String(handle).toLowerCase() : null;
  try {
    let cursor = "";
    for (let page = 0; page < 6; page++) {
      const url = new URL("https://twitter241.p.rapidapi.com/followers");
      url.searchParams.set("user", OUR_X_REST_ID);
      url.searchParams.set("count", "100");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers: { "x-rapidapi-host": "twitter241.p.rapidapi.com", "x-rapidapi-key": key } });
      const j = await r.json();
      const txt = JSON.stringify(j && j.result ? j.result : j);
      if (wantId && txt.includes(`"rest_id":"${wantId}"`)) return true;
      if (wantHandle && txt.toLowerCase().includes(`"screen_name":"${wantHandle}"`)) return true;
      cursor = j && j.cursor && j.cursor.bottom ? String(j.cursor.bottom) : "";
      if (!cursor || cursor.startsWith("0|") || cursor === "0") break;
    }
    return false;
  } catch {
    return null;
  }
}

// --- Telegram bot helpers ---
async function tgCall(token, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
function tgSend(token, chatId, text, extra = {}) {
  return tgCall(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function genCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const redirectUri = `${url.origin}/api/auth/x/callback`;

    // Start the whitelist flow: OAuth redirect to X.
    if (path === "/api/whitelist/start") {
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
      await env.KV.put(`wlauth:${state}`, verifier, { expirationTtl: 600 });
      const a = new URL(X_AUTHORIZE);
      a.searchParams.set("response_type", "code");
      a.searchParams.set("client_id", env.X_CLIENT_ID);
      a.searchParams.set("redirect_uri", redirectUri);
      a.searchParams.set("scope", "users.read tweet.read offline.access");
      a.searchParams.set("state", state);
      a.searchParams.set("code_challenge", await pkceChallenge(verifier));
      a.searchParams.set("code_challenge_method", "S256");
      return Response.redirect(a.toString(), 302);
    }

    if (path === "/api/auth/x/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      const verifier = state ? await env.KV.get(`wlauth:${state}`) : null;
      if (!code || !verifier) return Response.redirect(`${url.origin}/?w=error`, 302);
      await env.KV.delete(`wlauth:${state}`);
      try {
        const tr = await fetch(X_TOKEN, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: "Basic " + btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`),
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
            client_id: env.X_CLIENT_ID,
          }),
        });
        const tok = await tr.json();
        if (!tok.access_token) return Response.redirect(`${url.origin}/?w=error`, 302);
        const me = await (await fetch(X_ME, { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
        if (!me.data) return Response.redirect(`${url.origin}/?w=error`, 302);
        const sess = b64url(crypto.getRandomValues(new Uint8Array(24)));
        await env.KV.put(
          `wlsess:${sess}`,
          JSON.stringify({ id: me.data.id, handle: me.data.username, name: me.data.name, avatar: me.data.profile_image_url || "" }),
          { expirationTtl: 3600 }
        );
        return new Response(null, {
          status: 302,
          headers: {
            location: `${url.origin}/?w=email`,
            "set-cookie": `wl_session=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
          },
        });
      } catch {
        return Response.redirect(`${url.origin}/?w=error`, 302);
      }
    }

    if (path === "/api/whitelist/status") {
      const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM tester_whitelist").first();
      const count = (row && row.c) || 0;
      const sid = cookieVal(request, "wl_session");
      const sess = sid ? await env.KV.get(`wlsess:${sid}`) : null;
      let me = null;
      if (sess) {
        const u = JSON.parse(sess);
        const exists = await env.DB.prepare("SELECT 1 FROM tester_whitelist WHERE x_id=?").bind(u.id).first();
        const tg = await env.DB.prepare("SELECT chat_id FROM telegram_chats WHERE linked_x_id=?").bind(u.id).first();
        me = { handle: u.handle, in: !!exists, telegram: !!tg };
      }
      return json({ count, spots: SPOTS, full: count >= SPOTS, me });
    }

    if (path === "/api/whitelist/join" && request.method === "POST") {
      const locale = pickLocale(request);
      const sid = cookieVal(request, "wl_session");
      const sess = sid ? await env.KV.get(`wlsess:${sid}`) : null;
      if (!sess) return json({ error: { message: t(locale, "errSignInFirst") } }, 401);
      const u = JSON.parse(sess);
      let email = "";
      try {
        email = String((await request.json()).email || "").trim();
      } catch {
        /* ignore */
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: { message: t(locale, "errValidEmail") } }, 400);
      if (isDisposableEmail(email)) return json({ error: { message: t(locale, "errPermanentEmail") } }, 400);
      const existing = await env.DB.prepare("SELECT 1 FROM tester_whitelist WHERE x_id=?").bind(u.id).first();
      if (existing) return json({ ok: true, already: true });
      const cnt = (await env.DB.prepare("SELECT COUNT(*) AS c FROM tester_whitelist").first()).c || 0;
      if (cnt >= SPOTS) return json({ error: { message: t(locale, "errFull") } }, 409);
      const prof = await fetchXProfile(u.handle, env.RAPIDAPI_KEY, locale);
      const gate = evaluateTester(prof, locale);
      if (!gate.pass) return json({ error: { message: gate.reason || t(locale, "errTesterReqs") } }, 400);
      const follows = await followsUs(prof.restId, u.handle, env.RAPIDAPI_KEY);
      if (follows !== true)
        return json({ error: { message: follows === false ? t(locale, "errFollowFirst") : t(locale, "errFollowUnverified") } }, 400);
      await env.DB.prepare(
        "INSERT INTO tester_whitelist (id, x_id, handle, email, name, avatar, followers, following, account_created, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
      )
        .bind("tw-" + crypto.randomUUID().slice(0, 8), u.id, u.handle, email, u.name || "", u.avatar || "", prof.followers, prof.following, prof.createdAt, new Date().toISOString())
        .run();
      return json({ ok: true });
    }

    // --- Telegram account linking: mint a one-time deep-link token bound to the X session (AD-12) ---
    if (path === "/api/telegram/link/start" && request.method === "POST") {
      const locale = pickLocale(request);
      const sid = cookieVal(request, "wl_session");
      const sess = sid ? await env.KV.get(`wlsess:${sid}`) : null;
      if (!sess) return json({ error: { message: t(locale, "errSignInFirst") } }, 401);
      const u = JSON.parse(sess);
      const linkToken = b64url(crypto.getRandomValues(new Uint8Array(18)));
      // Carry the visitor's chosen locale to the bot so the welcome copy matches (AD-12).
      await env.KV.put(`tglink:${linkToken}`, JSON.stringify({ xid: u.id, lang: locale }), { expirationTtl: 900 });
      return json({ ok: true, url: `https://t.me/AidProtocolBot?start=${linkToken}` });
    }

    // --- Telegram bot webhook ---
    if (path === "/api/telegram/webhook" && request.method === "POST") {
      const want = (env.TELEGRAM_WEBHOOK_SECRET || "").trim();
      const got = (request.headers.get("x-telegram-bot-api-secret-token") || "").trim();
      if (!want || got !== want) {
        return new Response("forbidden", { status: 403 });
      }
      const token = env.TELEGRAM_BOT_TOKEN;
      let update;
      try {
        update = await request.json();
      } catch {
        return json({ ok: true });
      }
      const msg = update.message || update.edited_message;
      if (msg && msg.chat && token) {
        const chatId = String(msg.chat.id);
        const from = msg.from || {};
        const now = new Date().toISOString();
        // Resolve the chat locale from Telegram's language_code, keeping any
        // stored preference. Additive projection column (AD-2/AD-13).
        const prior = await env.DB.prepare("SELECT lang FROM telegram_chats WHERE chat_id=?").bind(chatId).first();
        let locale = tgLocale(prior && prior.lang, from.language_code);
        await env.DB.prepare(
          `INSERT INTO telegram_chats (chat_id, username, first_name, last_name, lang, created_at, last_seen)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(chat_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name, lang=excluded.lang, last_seen=excluded.last_seen`
        )
          .bind(chatId, from.username || null, from.first_name || null, from.last_name || null, locale, now, now)
          .run();
        const text = (msg.text || "").trim();
        if (text.startsWith("/start")) {
          const payload = text.split(/\s+/)[1] || "";
          const rawLink = payload ? await env.KV.get(`tglink:${payload}`) : null;
          let linkedXid = null;
          if (rawLink) {
            // Tokens may be legacy (plain x_id) or JSON { xid, lang }.
            try {
              const parsed = JSON.parse(rawLink);
              linkedXid = parsed.xid || null;
              if (SUPPORTED.includes(parsed.lang)) {
                locale = parsed.lang;
                await env.DB.prepare("UPDATE telegram_chats SET lang=? WHERE chat_id=?").bind(locale, chatId).run();
              }
            } catch {
              linkedXid = rawLink;
            }
          }
          if (linkedXid) {
            // Deep-link account linking: the one-time token proves the same person
            // controls this Telegram chat and the authenticated X session (AD-12).
            await env.KV.delete(`tglink:${payload}`);
            await env.DB.prepare("UPDATE telegram_chats SET linked_x_id=? WHERE chat_id=?").bind(linkedXid, chatId).run();
            await env.DB.prepare("UPDATE tester_whitelist SET telegram_chat_id=? WHERE x_id=?").bind(chatId, linkedXid).run();
            const wl = await env.DB.prepare("SELECT handle FROM tester_whitelist WHERE x_id=?").bind(linkedXid).first();
            await tgSend(token, chatId, t(locale, "tgLinked", { handle: wl && wl.handle ? " to @" + wl.handle : "" }));
          } else {
            const name = from.first_name ? " " + from.first_name : "";
            const caption = t(locale, "tgWelcome", { name });
            const photo = await tgCall(token, "sendPhoto", {
              chat_id: chatId,
              photo: `${url.origin}/welcome.png`,
              parse_mode: "HTML",
              caption,
            });
            if (!photo || !photo.ok) await tgSend(token, chatId, caption);
          }
        } else if (text.startsWith("/help")) {
          await tgSend(token, chatId, t(locale, "tgHelp"));
        } else if (text.startsWith("/id")) {
          await tgSend(token, chatId, t(locale, "tgId", { id: chatId }));
        } else if (text) {
          await tgSend(token, chatId, t(locale, "tgFallback"));
        }
      }
      return json({ ok: true });
    }

    // --- 2FA: send a code via Telegram (or email when a provider is configured) ---
    if (path === "/api/2fa/send" && request.method === "POST") {
      const reqLocale = pickLocale(request);
      let b = {};
      try {
        b = await request.json();
      } catch {
        /* ignore */
      }
      const channel = b.channel === "email" ? "email" : "telegram";
      const purpose = String(b.purpose || "aid_request").slice(0, 40);
      const target = String(b.target || "").trim();
      if (!target) return json({ error: { message: t(reqLocale, "errMissingTarget") } }, 400);
      const code = genCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare(
        "INSERT INTO twofa_codes (id, purpose, channel, target, code_hash, expires_at, attempts, used, created_at) VALUES (?,?,?,?,?,?,0,0,?)"
      )
        .bind("2fa-" + crypto.randomUUID().slice(0, 8), purpose, channel, target, await sha256hex(code), expires, new Date().toISOString())
        .run();
      if (channel === "telegram") {
        let chatId = target.replace(/^@/, "");
        let msgLocale = reqLocale;
        if (!/^\d+$/.test(chatId)) {
          const row = await env.DB.prepare("SELECT chat_id, lang FROM telegram_chats WHERE username=?").bind(chatId).first();
          if (!row) return json({ error: { message: t(reqLocale, "errNotStartedBot") } }, 400);
          chatId = row.chat_id;
          if (SUPPORTED.includes(row.lang)) msgLocale = row.lang;
        } else {
          const row = await env.DB.prepare("SELECT lang FROM telegram_chats WHERE chat_id=?").bind(chatId).first();
          if (row && SUPPORTED.includes(row.lang)) msgLocale = row.lang;
        }
        const message = t(msgLocale, "twofaBody", { code });
        const res = await tgSend(env.TELEGRAM_BOT_TOKEN, chatId, message);
        if (!res || !res.ok) return json({ error: { message: t(reqLocale, "errTgSendFail") } }, 400);
        return json({ ok: true, channel: "telegram" });
      }
      const message = t(reqLocale, "twofaBody", { code });
      if (!env.RESEND_API_KEY) return json({ error: { message: t(reqLocale, "errEmailNotConfigured") } }, 501);
      const er = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: "Aid Protocol <admin@aidprotocol.org>", to: [target], subject: t(reqLocale, "twofaEmailSubject"), text: message }),
      });
      if (!er.ok) return json({ error: { message: t(reqLocale, "errEmailSendFail") } }, 400);
      return json({ ok: true, channel: "email" });
    }

    if (path === "/api/2fa/verify" && request.method === "POST") {
      const locale = pickLocale(request);
      let b = {};
      try {
        b = await request.json();
      } catch {
        /* ignore */
      }
      const target = String(b.target || "").trim();
      const code = String(b.code || "").trim();
      const purpose = String(b.purpose || "aid_request").slice(0, 40);
      if (!target || !code) return json({ error: { message: t(locale, "errMissingTargetCode") } }, 400);
      const row = await env.DB.prepare("SELECT * FROM twofa_codes WHERE target=? AND purpose=? AND used=0 ORDER BY created_at DESC LIMIT 1").bind(target, purpose).first();
      if (!row) return json({ error: { message: t(locale, "errNoPendingCode") } }, 400);
      if (new Date(row.expires_at) < new Date()) return json({ error: { message: t(locale, "errCodeExpired") } }, 400);
      if (row.attempts >= 5) return json({ error: { message: t(locale, "errTooManyAttempts") } }, 429);
      const ok = (await sha256hex(code)) === row.code_hash;
      await env.DB.prepare("UPDATE twofa_codes SET attempts=attempts+1, used=? WHERE id=?").bind(ok ? 1 : 0, row.id).run();
      if (!ok) return json({ error: { message: t(locale, "errIncorrectCode") } }, 400);
      return json({ ok: true, verified: true });
    }

    if (path === "/" || path === "") {
      // Honor an explicit ?lang= choice (equal to the cookie in precedence),
      // then 302 to strip the param and persist the cookie on the registrable domain.
      const qLang = url.searchParams.get("lang");
      const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const domainAttr = isLocalhost ? "" : "; Domain=.aidprotocol.org";
      if (SUPPORTED.includes(qLang)) {
        return new Response(null, {
          status: 302,
          headers: {
            location: url.origin + "/",
            "set-cookie": `lang=${qLang}; Path=/${domainAttr}; Max-Age=31536000; SameSite=Lax; Secure`,
          },
        });
      }
      const locale = pickLocale(request);
      const headers = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
      // When the locale came from detection (no existing lang cookie), persist it
      // so the SPA and later requests agree without re-detecting.
      if (cookieVal(request, "lang") !== locale) {
        headers["set-cookie"] = `lang=${locale}; Path=/${domainAttr}; Max-Age=31536000; SameSite=Lax; Secure`;
      }
      return new Response(renderHTML(locale), { headers });
    }

    return env.ASSETS.fetch(request);
  },
};

function renderHTML(locale) {
  // Client-side strings the loadWL() script reads, inlined for the active locale.
  const i18n = {
    unavailable: t(locale, "wlUnavailable"),
    allClaimed: t(locale, "wlAllClaimed"),
    spotsClaimed: t(locale, "wlSpotsClaimed"),
    done: t(locale, "wlDone"),
    full: t(locale, "wlFull"),
    signedIn: t(locale, "wlSignedIn"),
    emailPh: t(locale, "wlEmailPh"),
    claimMine: t(locale, "wlClaimMine"),
    claiming: t(locale, "wlClaiming"),
    claimFail: t(locale, "wlClaimFail"),
    claimX: t(locale, "wlClaimX"),
  };
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t(locale, "title")}</title>
<meta name="description" content="${t(locale, "metaDesc")}" />
<meta property="og:title" content="Aid Protocol" />
<meta property="og:description" content="${t(locale, "ogDesc")}" />
<meta property="og:image" content="https://aidprotocol.org/og.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@aidprotocol_" />
<meta name="theme-color" content="#050b14" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<style>
  :root{--ink:#eaf2ff;--soft:#9fb2cc;--faint:#64748b;--line:rgba(255,255,255,.10);--brand:#19d39f;--grad:linear-gradient(90deg,#3b82f6 0%,#22d3ee 50%,#34d399 100%);--bg:#050b14}
  *{box-sizing:border-box}html,body{margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;overflow-x:hidden}
  .bg{position:fixed;inset:0;z-index:0;overflow:hidden}
  .bg img{width:100%;height:100%;object-fit:cover;object-position:center;animation:kb 28s ease-in-out infinite alternate;opacity:0;transition:opacity 1.2s}
  .bg img.on{opacity:.9}
  .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,11,20,.55),rgba(5,11,20,.4) 35%,rgba(5,11,20,.85) 80%,#050b14)}
  @keyframes kb{from{transform:scale(1)}to{transform:scale(1.1)}}
  .wrap{position:relative;z-index:1;max-width:780px;margin:0 auto;padding:0 24px}
  header{padding:30px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .mark{display:flex;align-items:center;gap:12px;opacity:0;animation:up .7s ease forwards}
  .wm{font-weight:700;letter-spacing:.09em;font-size:23px}.wm span{font-weight:400;color:var(--soft);letter-spacing:.16em}
  .lang{display:inline-flex;align-items:center;gap:2px;opacity:0;animation:up .7s ease .1s forwards}
  .lang a{color:var(--faint);text-decoration:none;font-size:13px;font-weight:600;padding:5px 9px;border-radius:8px;letter-spacing:.03em}
  .lang a.on{color:var(--ink);background:rgba(255,255,255,.08)}
  .lang a:hover{color:var(--ink)}
  .lang .div{color:var(--faint);opacity:.5;font-size:12px}
  .hero{padding:30px 0 24px}
  .herotag{font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:#bdf3e2;font-weight:600;margin:0 0 16px;opacity:0;animation:up .7s ease .15s forwards}
  .herotag b{color:#7fb2ff;font-weight:600}
  .eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:13px;color:#bdf3e2;font-weight:600;background:rgba(25,211,159,.12);border:1px solid rgba(25,211,159,.28);border-radius:99px;padding:7px 14px;margin-bottom:22px;opacity:0;animation:up .7s ease .1s forwards}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--brand);animation:pulse 2s ease-out infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(25,211,159,.55)}70%{box-shadow:0 0 0 10px rgba(25,211,159,0)}100%{box-shadow:0 0 0 0 rgba(25,211,159,0)}}
  h1{font-size:52px;line-height:1.05;margin:0 0 18px;letter-spacing:-.025em;font-weight:700;opacity:0;animation:up .8s ease .18s forwards}
  .grad{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
  p.lead{font-size:18px;line-height:1.6;color:var(--soft);margin:0 0 26px;max-width:560px;opacity:0;animation:up .8s ease .28s forwards}
  .cta{display:flex;flex-wrap:wrap;gap:13px;opacity:0;animation:up .8s ease .48s forwards}
  .btn{display:inline-flex;align-items:center;gap:9px;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px;transition:transform .15s,box-shadow .2s;cursor:pointer;border:none}
  .btn svg{width:18px;height:18px}
  .btn-primary{background:var(--grad);color:#03130e;box-shadow:0 8px 26px rgba(25,211,159,.28)}
  .btn-primary:hover{transform:translateY(-2px)}
  .btn-ghost{border:1px solid var(--line);color:var(--ink);background:rgba(255,255,255,.05)}
  .btn-ghost:hover{transform:translateY(-2px)}
  .btn-x{background:#000;color:#fff}
  /* whitelist */
  .wl{position:relative;z-index:1;max-width:780px;margin:10px auto 0;padding:22px 24px 40px}
  .wl-card{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:16px;padding:24px;backdrop-filter:blur(8px);opacity:0;animation:up .8s ease .6s forwards}
  .wl-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#bdf3e2;background:rgba(25,211,159,.12);border:1px solid rgba(25,211,159,.28);border-radius:99px;padding:5px 12px;margin-bottom:14px}
  .wl-card h2{font-size:26px;margin:0 0 8px;letter-spacing:-.02em}
  .wl-card p{color:var(--soft);margin:0 0 18px;font-size:15px;line-height:1.55;max-width:560px}
  .wl-action{margin-top:4px}
  .wl-count{margin-top:14px;font-size:13px;color:var(--faint)}
  .wl-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:8px;max-width:280px}
  .wl-bar span{display:block;height:100%;background:var(--grad)}
  .wl-form{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .wl-form input{flex:1;min-width:200px;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:#fff;font-size:15px}
  .wl-signed{font-size:13px;color:var(--soft);margin-bottom:10px}
  .wl-done{color:#bdf3e2;font-weight:600;font-size:15px}
  .wl-full{color:var(--soft)}
  .wl-msg{margin-top:8px;font-size:13px;color:#ffb4a3}
  footer{position:relative;z-index:1;border-top:1px solid var(--line);color:var(--faint);font-size:13px}
  .fin{max-width:780px;margin:0 auto;padding:18px 24px 28px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .fin a{color:var(--soft);text-decoration:none;display:inline-flex;align-items:center;gap:7px}
  .fin a:hover{color:var(--brand)}.fin svg{width:15px;height:15px}.sep{display:flex;gap:18px;flex-wrap:wrap}
  @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @media(max-width:560px){h1{font-size:38px}}
</style>
</head>
<body>
  <div class="bg"><img id="hero" src="/hero-5.jpg" alt="" onload="this.classList.add('on')" /></div>
  <div class="wrap">
    <header>
      <div class="mark"><img src="/mark.svg" alt="" style="height:40px;width:auto;display:block" /><span class="wm">AID <span>PROTOCOL</span></span></div>
      <nav class="lang" aria-label="${t(locale, "switchLabel")}">
        <a href="/?lang=en" class="${locale === "en" ? "on" : ""}" hreflang="en">EN</a>
        <span class="div">/</span>
        <a href="/?lang=es" class="${locale === "es" ? "on" : ""}" hreflang="es">ES</a>
      </nav>
    </header>
    <section class="hero">
      <div class="eyebrow"><span class="dot"></span> ${t(locale, "eyebrow")}</div>
      <div class="herotag">${t(locale, "herotag")}</div>
      <h1>${t(locale, "h1a")}<span class="grad">${t(locale, "h1grad")}</span></h1>
      <p class="lead">${t(locale, "lead")}</p>
      <div class="cta">
        <a class="btn btn-primary" href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          ${t(locale, "followX")}
        </a>
        <a class="btn btn-ghost" href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
          ${t(locale, "viewGithub")}
        </a>
      </div>
    </section>
  </div>

  <section class="wl">
    <div class="wl-card">
      <div class="wl-badge">${t(locale, "wlBadge")}</div>
      <h2>${t(locale, "wlH2")}</h2>
      <p>${t(locale, "wlLead")}</p>
      <div class="wl-action" id="wlAction"></div>
      <div class="wl-count" id="wlCount"></div>
      <div class="wl-bar"><span id="wlBar" style="width:0%"></span></div>
    </div>
  </section>

  <footer><div class="fin">
    <span>${t(locale, "footerCopy")}</span>
    <div class="sep">
      <a href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer">GitHub</a>
      <a href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">@aidprotocol_</a>
      <a href="mailto:admin@aidprotocol.org">admin@aidprotocol.org</a>
      <a href="https://dev.aidprotocol.org/privacy" target="_blank" rel="noreferrer">${t(locale, "privacy")}</a>
      <a href="https://dev.aidprotocol.org/terms" target="_blank" rel="noreferrer">${t(locale, "terms")}</a>
    </div>
  </div></footer>

<script>
const I18N = ${JSON.stringify(i18n)};
const X_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
function fmt(s, vars){ for(const k in vars) s=s.split('{'+k+'}').join(vars[k]); return s; }
async function loadWL(){
  const a=document.getElementById('wlAction'),c=document.getElementById('wlCount'),bar=document.getElementById('wlBar');
  let d; try{ d=await (await fetch('/api/whitelist/status')).json(); }catch(e){ a.innerHTML=I18N.unavailable; return; }
  c.textContent = d.full ? fmt(I18N.allClaimed,{total:d.spots}) : fmt(I18N.spotsClaimed,{count:d.count,total:d.spots});
  bar.style.width = Math.min(100, Math.round(100*d.count/d.spots))+'%';
  if(d.me && d.me.in){ a.innerHTML='<div class="wl-done">'+fmt(I18N.done,{handle:d.me.handle})+'</div>'; return; }
  if(d.full){ a.innerHTML='<div class="wl-full">'+I18N.full+'</div>'; return; }
  if(d.me && d.me.handle){
    a.innerHTML='<div class="wl-signed">'+fmt(I18N.signedIn,{handle:d.me.handle})+'</div><form class="wl-form" id="wlForm"><input id="wlEmail" type="email" placeholder="'+I18N.emailPh+'" required /><button class="btn btn-primary" type="submit">'+I18N.claimMine+'</button></form><div class="wl-msg" id="wlMsg"></div>';
    document.getElementById('wlForm').onsubmit=async(e)=>{e.preventDefault();const m=document.getElementById('wlMsg');m.textContent=I18N.claiming;const res=await fetch('/api/whitelist/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('wlEmail').value})});const dd=await res.json();if(dd.ok)loadWL();else m.textContent=(dd.error&&dd.error.message)||I18N.claimFail;};
    return;
  }
  a.innerHTML='<a class="btn btn-x" href="/api/whitelist/start">'+X_SVG+' '+I18N.claimX+'</a>';
}
loadWL();
</script>
</body>
</html>`;
}

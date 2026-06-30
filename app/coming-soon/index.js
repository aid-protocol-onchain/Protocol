// Production apex worker for aidprotocol.org: branded coming-soon page + the tester
// whitelist (Sign in with X -> email -> stored, capped at 10 spots).

const SPOTS = 10;
const X_AUTHORIZE = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN = "https://api.twitter.com/2/oauth2/token";
const X_ME = "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name";

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

// Validate the X account via RapidAPI (twitter241). Returns whether it's a real,
// active account and its follower count. If the key is missing or the call fails,
// we allow the join (X OAuth already proved account ownership).
async function checkTwitter(handle, key) {
  if (!key) return { valid: true, followers: null };
  try {
    const r = await fetch(`https://twitter241.p.rapidapi.com/user?username=${encodeURIComponent(handle)}`, {
      headers: { "x-rapidapi-host": "twitter241.p.rapidapi.com", "x-rapidapi-key": key },
    });
    const j = await r.json();
    const u = j && j.result && j.result.data && j.result.data.user && j.result.data.user.result;
    if (!u || u.__typename !== "User") return { valid: false, followers: null };
    const f = u.legacy && u.legacy.followers_count;
    return { valid: true, followers: typeof f === "number" ? f : null };
  } catch {
    return { valid: true, followers: null };
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
        me = { handle: u.handle, in: !!exists };
      }
      return json({ count, spots: SPOTS, full: count >= SPOTS, me });
    }

    if (path === "/api/whitelist/join" && request.method === "POST") {
      const sid = cookieVal(request, "wl_session");
      const sess = sid ? await env.KV.get(`wlsess:${sid}`) : null;
      if (!sess) return json({ error: { message: "Sign in with X first" } }, 401);
      const u = JSON.parse(sess);
      let email = "";
      try {
        email = String((await request.json()).email || "").trim();
      } catch {
        /* ignore */
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: { message: "Enter a valid email" } }, 400);
      const existing = await env.DB.prepare("SELECT 1 FROM tester_whitelist WHERE x_id=?").bind(u.id).first();
      if (existing) return json({ ok: true, already: true });
      const cnt = (await env.DB.prepare("SELECT COUNT(*) AS c FROM tester_whitelist").first()).c || 0;
      if (cnt >= SPOTS) return json({ error: { message: "Whitelist is full" } }, 409);
      const chk = await checkTwitter(u.handle, env.RAPIDAPI_KEY);
      if (!chk.valid) return json({ error: { message: "We couldn't verify your X account. Make sure it's public and active." } }, 400);
      const followers = chk.followers;
      await env.DB.prepare(
        "INSERT INTO tester_whitelist (id, x_id, handle, email, name, avatar, followers, created_at) VALUES (?,?,?,?,?,?,?,?)"
      )
        .bind("tw-" + crypto.randomUUID().slice(0, 8), u.id, u.handle, email, u.name || "", u.avatar || "", followers, new Date().toISOString())
        .run();
      return json({ ok: true });
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
        await env.DB.prepare(
          `INSERT INTO telegram_chats (chat_id, username, first_name, last_name, created_at, last_seen)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(chat_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, last_name=excluded.last_name, last_seen=excluded.last_seen`
        )
          .bind(chatId, from.username || null, from.first_name || null, from.last_name || null, now, now)
          .run();
        const text = (msg.text || "").trim();
        if (text.startsWith("/start")) {
          const payload = text.split(/\s+/)[1] || "";
          if (payload) await env.DB.prepare("UPDATE telegram_chats SET link_token=? WHERE chat_id=?").bind(payload, chatId).run();
          const name = from.first_name ? " " + from.first_name : "";
          const caption = `Welcome to <b>Aid Protocol</b>${name}.\n\nThis is how we reach testers, ambassadors, and campaign organizers: verification codes, test tasks, and proof-of-expense reminders.\n\nYou are connected. We will message you here when there is something to do. Send /help to see commands.`;
          const photo = await tgCall(token, "sendPhoto", {
            chat_id: chatId,
            photo: `${url.origin}/welcome.png`,
            parse_mode: "HTML",
            caption,
          });
          if (!photo || !photo.ok) await tgSend(token, chatId, caption);
        } else if (text.startsWith("/help")) {
          await tgSend(token, chatId, `<b>Aid Protocol bot</b>\n\n/start  connect this chat\n/id  show your chat id\n/help  this message\n\nWe send verification codes and reminders here.`);
        } else if (text.startsWith("/id")) {
          await tgSend(token, chatId, `Your chat id is <code>${chatId}</code>.`);
        } else if (text) {
          await tgSend(token, chatId, `Got it. Nothing to action right now. Send /help for what this bot does.`);
        }
      }
      return json({ ok: true });
    }

    // --- 2FA: send a code via Telegram (or email when a provider is configured) ---
    if (path === "/api/2fa/send" && request.method === "POST") {
      let b = {};
      try {
        b = await request.json();
      } catch {
        /* ignore */
      }
      const channel = b.channel === "email" ? "email" : "telegram";
      const purpose = String(b.purpose || "aid_request").slice(0, 40);
      const target = String(b.target || "").trim();
      if (!target) return json({ error: { message: "Missing target" } }, 400);
      const code = genCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare(
        "INSERT INTO twofa_codes (id, purpose, channel, target, code_hash, expires_at, attempts, used, created_at) VALUES (?,?,?,?,?,?,0,0,?)"
      )
        .bind("2fa-" + crypto.randomUUID().slice(0, 8), purpose, channel, target, await sha256hex(code), expires, new Date().toISOString())
        .run();
      const message = `Your Aid Protocol verification code is ${code}. It expires in 10 minutes.`;
      if (channel === "telegram") {
        let chatId = target.replace(/^@/, "");
        if (!/^\d+$/.test(chatId)) {
          const row = await env.DB.prepare("SELECT chat_id FROM telegram_chats WHERE username=?").bind(chatId).first();
          if (!row) return json({ error: { message: "This Telegram user has not started the bot yet" } }, 400);
          chatId = row.chat_id;
        }
        const res = await tgSend(env.TELEGRAM_BOT_TOKEN, chatId, message);
        if (!res || !res.ok) return json({ error: { message: "Could not send Telegram message" } }, 400);
        return json({ ok: true, channel: "telegram" });
      }
      if (!env.RESEND_API_KEY) return json({ error: { message: "Email sending is not configured yet" } }, 501);
      const er = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: "Aid Protocol <admin@aidprotocol.org>", to: [target], subject: "Your Aid Protocol verification code", text: message }),
      });
      if (!er.ok) return json({ error: { message: "Could not send email" } }, 400);
      return json({ ok: true, channel: "email" });
    }

    if (path === "/api/2fa/verify" && request.method === "POST") {
      let b = {};
      try {
        b = await request.json();
      } catch {
        /* ignore */
      }
      const target = String(b.target || "").trim();
      const code = String(b.code || "").trim();
      const purpose = String(b.purpose || "aid_request").slice(0, 40);
      if (!target || !code) return json({ error: { message: "Missing target or code" } }, 400);
      const row = await env.DB.prepare("SELECT * FROM twofa_codes WHERE target=? AND purpose=? AND used=0 ORDER BY created_at DESC LIMIT 1").bind(target, purpose).first();
      if (!row) return json({ error: { message: "No pending code" } }, 400);
      if (new Date(row.expires_at) < new Date()) return json({ error: { message: "Code expired" } }, 400);
      if (row.attempts >= 5) return json({ error: { message: "Too many attempts" } }, 429);
      const ok = (await sha256hex(code)) === row.code_hash;
      await env.DB.prepare("UPDATE twofa_codes SET attempts=attempts+1, used=? WHERE id=?").bind(ok ? 1 : 0, row.id).run();
      if (!ok) return json({ error: { message: "Incorrect code" } }, 400);
      return json({ ok: true, verified: true });
    }

    if (path === "/" || path === "") {
      return new Response(HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }

    return env.ASSETS.fetch(request);
  },
};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Aid Protocol — a lifeline for disaster relief, on-chain</title>
<meta name="description" content="Aid Protocol is a non-profit, open-source platform for disaster relief. Donations are recorded on-chain and released against proof of spend. Launching soon." />
<meta property="og:title" content="Aid Protocol" />
<meta property="og:description" content="A non-profit lifeline for disaster relief. On-chain donations, released against proof. Launching soon." />
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
  header{padding:30px 0}
  .mark{display:flex;align-items:center;gap:12px;opacity:0;animation:up .7s ease forwards}
  .wm{font-weight:700;letter-spacing:.09em;font-size:23px}.wm span{font-weight:400;color:var(--soft);letter-spacing:.16em}
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
    </header>
    <section class="hero">
      <div class="eyebrow"><span class="dot"></span> Launching soon</div>
      <div class="herotag">Lifeline for humanity · Powered by <b>crypto</b></div>
      <h1>A lifeline for disaster relief, <span class="grad">on-chain.</span></h1>
      <p class="lead">Aid Protocol is a non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.</p>
      <div class="cta">
        <a class="btn btn-primary" href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Follow on X
        </a>
        <a class="btn btn-ghost" href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
          View on GitHub
        </a>
      </div>
    </section>
  </div>

  <section class="wl">
    <div class="wl-card">
      <div class="wl-badge">🎟️ Tester whitelist · 10 spots</div>
      <h2>Help us test on mainnet. Get $10.</h2>
      <p>We're whitelisting 10 testers to try Aid Protocol on mainnet when it goes live. Each tester who helps gets $10 in USDC. Sign in with X to claim a spot.</p>
      <div class="wl-action" id="wlAction"></div>
      <div class="wl-count" id="wlCount"></div>
      <div class="wl-bar"><span id="wlBar" style="width:0%"></span></div>
    </div>
  </section>

  <footer><div class="fin">
    <span>© 2026 Aid Protocol · Non-profit · Open source</span>
    <div class="sep">
      <a href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">@aidprotocol_</a>
      <a href="mailto:admin@aidprotocol.org">admin@aidprotocol.org</a>
    </div>
  </div></footer>

<script>
const X_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
async function loadWL(){
  const a=document.getElementById('wlAction'),c=document.getElementById('wlCount'),bar=document.getElementById('wlBar');
  let d; try{ d=await (await fetch('/api/whitelist/status')).json(); }catch(e){ a.innerHTML='Whitelist temporarily unavailable.'; return; }
  c.textContent = d.full ? ('All '+d.spots+' spots claimed') : (d.count+'/'+d.spots+' spots claimed');
  bar.style.width = Math.min(100, Math.round(100*d.count/d.spots))+'%';
  if(d.me && d.me.in){ a.innerHTML='<div class="wl-done">You\\'re in, @'+d.me.handle+'. Your spot is secured, we\\'ll email you when mainnet testing opens.</div>'; return; }
  if(d.full){ a.innerHTML='<div class="wl-full">Whitelist is full. Follow @aidprotocol_ for the next round.</div>'; return; }
  if(d.me && d.me.handle){
    a.innerHTML='<div class="wl-signed">Signed in as @'+d.me.handle+'</div><form class="wl-form" id="wlForm"><input id="wlEmail" type="email" placeholder="you@email.com" required /><button class="btn btn-primary" type="submit">Claim my spot</button></form><div class="wl-msg" id="wlMsg"></div>';
    document.getElementById('wlForm').onsubmit=async(e)=>{e.preventDefault();const m=document.getElementById('wlMsg');m.textContent='Claiming…';const res=await fetch('/api/whitelist/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('wlEmail').value})});const dd=await res.json();if(dd.ok)loadWL();else m.textContent=(dd.error&&dd.error.message)||'Could not claim a spot.';};
    return;
  }
  a.innerHTML='<a class="btn btn-x" href="/api/whitelist/start">'+X_SVG+' Claim a spot with X</a>';
}
loadWL();
</script>
</body>
</html>`;

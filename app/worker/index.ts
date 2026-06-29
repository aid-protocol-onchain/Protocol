interface Env {
  DB: D1Database;
  KV: KVNamespace;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_TOKEN: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

function cookieValue(req: Request, name: string): string | null {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

async function insertNews(
  env: Env,
  n: { title: string; link: string; source: string; campaign_id: string; published_at: string }
): Promise<number> {
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO news (id, title, summary, category, campaign_id, source, published_at, icon, sort_order, link, auto) " +
      "VALUES (?,?,?,?,?,?,?,?,?,?,1)"
  )
    .bind(
      "fi-" + crypto.randomUUID().slice(0, 12),
      n.title.slice(0, 180),
      "",
      "news",
      n.campaign_id,
      n.source.slice(0, 60),
      n.published_at || "",
      "ti-rss",
      100,
      n.link
    )
    .run();
  return res.meta?.changes ? 1 : 0;
}

// Pull relief news per active campaign topic from ReliefWeb (JSON) and Google News (RSS).
// Items are deduped by link and auto-published; the core team can hide any item.
async function ingestNews(env: Env): Promise<number> {
  const { results: campaigns } = await env.DB.prepare(
    "SELECT id, disaster, location FROM campaigns WHERE status = 'active'"
  ).all();
  let added = 0;
  for (const c of campaigns as { id: string; disaster: string; location: string }[]) {
    const terms = `${c.disaster} ${c.location}`.trim();
    // ReliefWeb API (structured JSON, disaster-specific)
    try {
      const url =
        "https://api.reliefweb.int/v1/reports?appname=aidprotocol.org" +
        `&query[value]=${encodeURIComponent(terms)}&query[operator]=AND&limit=4&sort[]=date:desc` +
        "&fields[include][]=title&fields[include][]=url&fields[include][]=date.created&fields[include][]=source.name";
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) {
        const data = (await r.json()) as { data?: { fields?: Record<string, unknown> }[] };
        for (const item of data.data || []) {
          const f = item.fields || {};
          const link = f.url as string | undefined;
          const title = f.title as string | undefined;
          if (!link || !title) continue;
          const srcArr = f.source as { name?: string }[] | undefined;
          const source = (srcArr && srcArr[0]?.name) || "ReliefWeb";
          const created = (f.date as { created?: string } | undefined)?.created;
          const published_at = created ? created.slice(0, 10) : "";
          added += await insertNews(env, { title, link, source, campaign_id: c.id, published_at });
        }
      }
    } catch {
      /* feed errors are non-fatal */
    }
    // Google News RSS (broad fallback, light XML parse)
    try {
      const r = await fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(terms)}&hl=en-US&gl=US&ceid=US:en`
      );
      if (r.ok) {
        const xml = await r.text();
        for (const block of xml.split("<item>").slice(1, 4)) {
          const title = (block.match(/<title>(.*?)<\/title>/s) || [])[1];
          const link = (block.match(/<link>(.*?)<\/link>/s) || [])[1];
          const pub = (block.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1];
          if (!title || !link) continue;
          // Google News appends " - Publisher" to titles; keep it readable.
          const clean = decodeXml(title);
          let published_at = "";
          try {
            published_at = pub ? new Date(pub.trim()).toISOString().slice(0, 10) : "";
          } catch {
            published_at = "";
          }
          added += await insertNews(env, {
            title: clean,
            link: link.trim(),
            source: "Google News",
            campaign_id: c.id,
            published_at,
          });
        }
      }
    } catch {
      /* feed errors are non-fatal */
    }
  }
  return added;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health") {
      return json({ ok: true, service: "aid-protocol", env: "dev", time: new Date().toISOString() });
    }

    // ---- Sign in with X (OAuth 2.0 + PKCE, all server-side) ----
    const redirectUri = `${url.origin}/api/auth/x/callback`;

    if (path === "/api/auth/x/login") {
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
      await env.KV.put(`xoauth:${state}`, verifier, { expirationTtl: 600 });
      const auth = new URL("https://twitter.com/i/oauth2/authorize");
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("client_id", env.X_CLIENT_ID);
      auth.searchParams.set("redirect_uri", redirectUri);
      auth.searchParams.set("scope", "users.read tweet.read offline.access");
      auth.searchParams.set("state", state);
      auth.searchParams.set("code_challenge", await pkceChallenge(verifier));
      auth.searchParams.set("code_challenge_method", "S256");
      return Response.redirect(auth.toString(), 302);
    }

    if (path === "/api/auth/x/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      const verifier = state ? await env.KV.get(`xoauth:${state}`) : null;
      if (!code || !verifier) return Response.redirect(`${url.origin}/?x=error`, 302);
      await env.KV.delete(`xoauth:${state}`);
      try {
        const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
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
        const tok = (await tokenRes.json()) as { access_token?: string };
        if (!tok.access_token) return Response.redirect(`${url.origin}/?x=error`, 302);
        const meRes = await fetch(
          "https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name",
          { headers: { authorization: `Bearer ${tok.access_token}` } }
        );
        const me = (await meRes.json()) as { data?: { id: string; username: string; name: string; profile_image_url?: string } };
        if (!me.data) return Response.redirect(`${url.origin}/?x=error`, 302);
        const session = b64url(crypto.getRandomValues(new Uint8Array(24)));
        await env.KV.put(
          `session:${session}`,
          JSON.stringify({ id: me.data.id, handle: me.data.username, name: me.data.name, avatar: me.data.profile_image_url || "" }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
        return new Response(null, {
          status: 302,
          headers: {
            location: `${url.origin}/?x=ok`,
            "set-cookie": `aid_session=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
          },
        });
      } catch {
        return Response.redirect(`${url.origin}/?x=error`, 302);
      }
    }

    if (path === "/api/auth/me") {
      const sid = cookieValue(request, "aid_session");
      const data = sid ? await env.KV.get(`session:${sid}`) : null;
      return json({ user: data ? JSON.parse(data) : null });
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      const sid = cookieValue(request, "aid_session");
      if (sid) await env.KV.delete(`session:${sid}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "aid_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
        },
      });
    }

    if (path === "/api/campaigns") {
      const status = url.searchParams.get("status");
      const where = status === "active" ? "WHERE status = 'active'" : status === "past" ? "WHERE status != 'active'" : "";
      const { results } = await env.DB.prepare(
        `SELECT * FROM campaigns ${where} ORDER BY raised_usd DESC`
      ).all();
      return json({ campaigns: results });
    }

    const detail = path.match(/^\/api\/campaigns\/([\w-]+)$/);
    if (detail) {
      const id = detail[1];
      const campaign = await env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(id).first();
      if (!campaign) return json({ error: { code: "not_found", message: "Campaign not found" } }, 404);
      const proofs = await env.DB.prepare(
        "SELECT * FROM proofs WHERE campaign_id = ? ORDER BY tranche DESC"
      ).bind(id).all();
      const donations = await env.DB.prepare(
        "SELECT * FROM donations WHERE campaign_id = ? ORDER BY rowid DESC LIMIT 25"
      ).bind(id).all();
      return json({ campaign, proofs: proofs.results, donations: donations.results });
    }

    if (path === "/api/leaderboard") {
      const cause = url.searchParams.get("cause");
      // category: sol | eth | stable (most SOL on Solana, most ETH on EVM, most stable = USDC+USDT)
      const category = url.searchParams.get("category");
      const conds = ["is_anonymous = 0"];
      const binds: string[] = [];
      if (cause) {
        conds.push("campaign_id = ?");
        binds.push(cause);
      }
      if (category === "sol") conds.push("amount LIKE '% SOL'");
      else if (category === "eth") conds.push("amount LIKE '% ETH'");
      else if (category === "stable") conds.push("(amount LIKE '%USDC' OR amount LIKE '%USDT')");

      const sql =
        "SELECT donor_label, SUM(amount_usd) AS total_usd, COUNT(DISTINCT campaign_id) AS causes, " +
        "COUNT(*) AS gifts, GROUP_CONCAT(DISTINCT chain) AS chains FROM donations WHERE " +
        conds.join(" AND ") +
        " GROUP BY donor_label ORDER BY total_usd DESC LIMIT 50";
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return json({ leaderboard: results });
    }

    if (path === "/api/donations/recent") {
      const { results } = await env.DB.prepare(
        "SELECT d.id, d.donor_label, d.is_anonymous, d.chain, d.amount, d.amount_usd, c.title AS campaign_title, c.id AS campaign_id " +
          "FROM donations d JOIN campaigns c ON c.id = d.campaign_id ORDER BY d.rowid DESC LIMIT 20"
      ).all();
      return json({ donations: results });
    }

    if (path === "/api/news") {
      // Only show news that is not hidden and (general, or tied to an active campaign).
      const { results } = await env.DB.prepare(
        "SELECT n.* FROM news n LEFT JOIN campaigns c ON c.id = n.campaign_id " +
          "WHERE COALESCE(n.hidden,0) = 0 AND (n.campaign_id IS NULL OR c.status = 'active') " +
          "ORDER BY n.sort_order ASC, n.rowid DESC"
      ).all();
      return json({ news: results });
    }

    // ---- requester intake + admin diligence/approval (Model A, ADR-004) ----
    const isAdmin = () =>
      !!env.ADMIN_TOKEN && (request.headers.get("x-admin-token") || "").trim() === env.ADMIN_TOKEN.trim();
    const readBody = async (): Promise<Record<string, unknown>> => {
      try {
        return (await request.json()) as Record<string, unknown>;
      } catch {
        return {};
      }
    };
    const slug = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const unauthorized = () => json({ error: { code: "unauthorized", message: "Admin token required" } }, 401);

    // Public: submit an aid request.
    if (path === "/api/requests" && request.method === "POST") {
      const b = await readBody();
      const required = ["org_name", "contact_handle", "location", "disaster", "summary", "goal_usd"];
      for (const k of required) if (!b[k]) return json({ error: { code: "bad_request", message: `Missing ${k}` } }, 400);
      const id = "req-" + crypto.randomUUID().slice(0, 8);
      await env.DB.prepare(
        "INSERT INTO requests (id, org_name, contact_handle, location, disaster, summary, goal_usd, evidence_url, created_at) " +
          "VALUES (?,?,?,?,?,?,?,?,?)"
      )
        .bind(
          id,
          String(b.org_name),
          String(b.contact_handle),
          String(b.location),
          String(b.disaster),
          String(b.summary),
          Math.max(0, Math.round(Number(b.goal_usd) || 0)),
          String(b.evidence_url || ""),
          new Date().toISOString()
        )
        .run();
      return json({ ok: true, id });
    }

    // Admin: list requests.
    if (path === "/api/admin/requests" && request.method === "GET") {
      if (!isAdmin()) return unauthorized();
      const { results } = await env.DB.prepare("SELECT * FROM requests ORDER BY created_at DESC").all();
      return json({ requests: results });
    }

    // Admin: record diligence notes.
    const noteM = path.match(/^\/api\/admin\/requests\/([\w-]+)\/notes$/);
    if (noteM && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      const b = await readBody();
      await env.DB.prepare("UPDATE requests SET diligence_notes=?, reviewer=? WHERE id=?")
        .bind(String(b.notes || ""), String(b.reviewer || "core"), noteM[1])
        .run();
      return json({ ok: true });
    }

    // Admin: reject.
    const rejM = path.match(/^\/api\/admin\/requests\/([\w-]+)\/reject$/);
    if (rejM && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      await env.DB.prepare("UPDATE requests SET status='rejected', decided_at=? WHERE id=?")
        .bind(new Date().toISOString(), rejM[1])
        .run();
      return json({ ok: true });
    }

    // Admin: approve -> create campaign (chains published separately by the authority signer).
    const appM = path.match(/^\/api\/admin\/requests\/([\w-]+)\/approve$/);
    if (appM && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      const b = await readBody();
      const r = (await env.DB.prepare("SELECT * FROM requests WHERE id=?").bind(appM[1]).first()) as
        | Record<string, unknown>
        | null;
      if (!r) return json({ error: { code: "not_found", message: "Request not found" } }, 404);
      if (r.status === "approved") return json({ error: { code: "conflict", message: "Already approved" } }, 409);
      const cid = slug(`${r.disaster}-${r.location}`) || "cmp-" + appM[1];
      const tier = b.tier === "L1" ? "L1" : "L2";
      const firstPct = Math.min(100, Math.max(0, Math.round(Number(b.first_release_pct) || 20)));
      await env.DB.prepare(
        "INSERT OR REPLACE INTO campaigns (id, title, location, disaster, requester_name, requester_handle, " +
          "requester_tier, first_release_pct, raised_usd, goal_usd, donor_count, status, icon, request_id, chains, chain_status) " +
          "VALUES (?,?,?,?,?,?,?,?,0,?,0,'active',?,?, '{}', 'pending')"
      )
        .bind(
          cid,
          `${r.disaster}: ${r.location}`,
          String(r.location),
          String(r.disaster),
          String(r.org_name),
          String(r.contact_handle),
          tier,
          firstPct,
          Number(r.goal_usd),
          String(b.icon || "ti-mountain"),
          r.id
        )
        .run();
      await env.DB.prepare("UPDATE requests SET status='approved', campaign_id=?, decided_at=? WHERE id=?")
        .bind(cid, new Date().toISOString(), r.id)
        .run();
      return json({ ok: true, campaign_id: cid });
    }

    // Admin: attach on-chain escrow addresses after the authority signer publishes them.
    const pubM = path.match(/^\/api\/admin\/campaigns\/([\w-]+)\/chains$/);
    if (pubM && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      const b = await readBody();
      await env.DB.prepare("UPDATE campaigns SET chains=?, chain_status='live' WHERE id=?")
        .bind(JSON.stringify(b.chains || {}), pubM[1])
        .run();
      return json({ ok: true });
    }

    // Admin: list campaigns with lifecycle status.
    if (path === "/api/admin/campaigns" && request.method === "GET") {
      if (!isAdmin()) return unauthorized();
      const { results } = await env.DB.prepare(
        "SELECT id, title, status, raised_usd, goal_usd, chain_status FROM campaigns ORDER BY rowid DESC"
      ).all();
      return json({ campaigns: results });
    }

    // Admin: set a campaign's lifecycle status (active is shown in the feed; the rest move to Past).
    const statusM = path.match(/^\/api\/admin\/campaigns\/([\w-]+)\/status$/);
    if (statusM && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      const b = await readBody();
      const allowed = ["active", "completed", "frozen", "refunding"];
      const s = String(b.status);
      if (!allowed.includes(s)) return json({ error: { code: "bad_request", message: "Invalid status" } }, 400);
      await env.DB.prepare("UPDATE campaigns SET status=? WHERE id=?").bind(s, statusM[1]).run();
      return json({ ok: true });
    }

    // Admin: list news (including hidden) for moderation.
    if (path === "/api/admin/news" && request.method === "GET") {
      if (!isAdmin()) return unauthorized();
      const { results } = await env.DB.prepare(
        "SELECT id, title, source, published_at, link, category, hidden, auto, campaign_id FROM news ORDER BY rowid DESC LIMIT 100"
      ).all();
      return json({ news: results });
    }

    // Admin: hide/show a news item.
    const newsToggle = path.match(/^\/api\/admin\/news\/([\w-]+)\/toggle$/);
    if (newsToggle && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      await env.DB.prepare("UPDATE news SET hidden = CASE WHEN COALESCE(hidden,0)=0 THEN 1 ELSE 0 END WHERE id=?")
        .bind(newsToggle[1])
        .run();
      return json({ ok: true });
    }

    // Admin: manually trigger feed ingestion now.
    if (path === "/api/admin/news/refresh" && request.method === "POST") {
      if (!isAdmin()) return unauthorized();
      const added = await ingestNews(env);
      return json({ ok: true, added });
    }

    // Donor profile: /api/donor/<key> where key is "u:<handle>", a bare "@handle", or "w:<wallet>".
    const donor = path.match(/^\/api\/donor\/(.+)$/);
    if (donor) {
      const raw = decodeURIComponent(donor[1]);
      const label = raw.startsWith("u:") ? "@" + raw.slice(2) : raw.startsWith("w:") ? raw.slice(2) : raw;
      const summary = await env.DB.prepare(
        "SELECT donor_label, SUM(amount_usd) AS total_usd, COUNT(DISTINCT campaign_id) AS causes, " +
          "COUNT(*) AS gifts, GROUP_CONCAT(DISTINCT chain) AS chains FROM donations " +
          "WHERE is_anonymous = 0 AND donor_label = ? GROUP BY donor_label"
      ).bind(label).first();
      if (!summary) return json({ error: { code: "not_found", message: "No public donations for this donor" } }, 404);
      const assetRows = await env.DB.prepare(
        "SELECT (CASE WHEN amount LIKE '% SOL' THEN 'sol' WHEN amount LIKE '% ETH' THEN 'eth' " +
          "WHEN amount LIKE '%USDC' THEN 'usdc' WHEN amount LIKE '%USDT' THEN 'usdt' ELSE 'other' END) AS asset, " +
          "SUM(amount_usd) AS usd FROM donations WHERE is_anonymous = 0 AND donor_label = ? GROUP BY asset"
      ).bind(label).all();
      const assets: Record<string, number> = { sol: 0, eth: 0, usdc: 0, usdt: 0 };
      for (const r of assetRows.results as { asset: string; usd: number }[]) {
        if (r.asset in assets) assets[r.asset] = r.usd;
      }
      const recent = await env.DB.prepare(
        "SELECT d.amount, d.amount_usd, d.chain, c.title AS campaign_title, c.id AS campaign_id " +
          "FROM donations d JOIN campaigns c ON c.id = d.campaign_id " +
          "WHERE d.is_anonymous = 0 AND d.donor_label = ? ORDER BY d.rowid DESC LIMIT 10"
      ).bind(label).all();
      return json({
        donor: {
          handle: label,
          totalUsd: summary.total_usd,
          causes: summary.causes,
          gifts: summary.gifts,
          chains: summary.chains,
          assets: { ...assets, stable: assets.usdc + assets.usdt },
          donations: recent.results,
        },
      });
    }

    if (path.startsWith("/api/")) {
      return json({ error: { code: "not_found", message: "Unknown endpoint" } }, 404);
    }

    // Everything else: static assets (SPA fallback handled by assets config).
    return env.ASSETS.fetch(request);
  },

  // Cron: refresh per-campaign relief news feeds.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ingestNews(env));
  },
};

// Branded "coming soon" worker for the production apex domain aidprotocol.org.
// The full app lives at dev.aidprotocol.org until launch.
// hero.jpg is served from ./public via the ASSETS binding.

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Aid Protocol — a lifeline for disaster relief, on-chain</title>
<meta name="description" content="Aid Protocol is a non-profit, open-source platform for disaster relief. Donations are recorded on-chain and released against verified proof of spend. Launching soon." />
<meta property="og:title" content="Aid Protocol" />
<meta property="og:description" content="A non-profit lifeline for disaster relief. On-chain donations, released against proof. Launching soon." />
<meta property="og:image" content="https://aidprotocol.org/og.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@aidprotocol_" />
<meta property="og:type" content="website" />
<meta name="theme-color" content="#050b14" />
<style>
  :root{
    --ink:#eaf2ff; --soft:#9fb2cc; --faint:#64748b; --line:rgba(255,255,255,.10);
    --brand:#19d39f; --blue:#0b5cf7;
    --grad:linear-gradient(90deg,#3b82f6 0%,#22d3ee 50%,#34d399 100%);
    --bg:#050b14;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    background:var(--bg);color:var(--ink);min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;
  }
  .bg{position:fixed;inset:0;z-index:0;overflow:hidden}
  .bg img{width:100%;height:100%;object-fit:cover;object-position:center 38%;
    animation:kenburns 28s ease-in-out infinite alternate;opacity:0;transition:opacity 1.2s ease}
  .bg img.on{opacity:.9}
  .bg::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg, rgba(5,11,20,.55) 0%, rgba(5,11,20,.35) 35%, rgba(5,11,20,.82) 80%, #050b14 100%)}
  @keyframes kenburns{from{transform:scale(1) translateY(0)}to{transform:scale(1.12) translateY(-2%)}}

  .wrap{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:0 24px;width:100%}
  header{padding:30px 0}
  .mark{display:flex;align-items:center;gap:12px;opacity:0;animation:fadeUp .7s ease forwards}
  .wordmark{font-weight:700;letter-spacing:.09em;font-size:18px}
  .wordmark span{font-weight:400;color:var(--soft);letter-spacing:.16em}
  main{flex:1;display:flex;align-items:center;padding:20px 0 40px}
  .hero{width:100%}
  .eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:13px;color:#bdf3e2;font-weight:600;
    background:rgba(25,211,159,.12);border:1px solid rgba(25,211,159,.28);border-radius:99px;padding:7px 14px;
    margin-bottom:22px;opacity:0;animation:fadeUp .7s ease .1s forwards}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 0 rgba(25,211,159,.6);
    animation:pulse 2s ease-out infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(25,211,159,.55)}70%{box-shadow:0 0 0 10px rgba(25,211,159,0)}100%{box-shadow:0 0 0 0 rgba(25,211,159,0)}}
  h1{font-size:54px;line-height:1.04;margin:0 0 18px;letter-spacing:-.025em;font-weight:700;
    opacity:0;animation:fadeUp .8s ease .18s forwards}
  .grad{background:var(--grad);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;
    animation:shift 6s linear infinite}
  @keyframes shift{to{background-position:200% center}}
  p.lead{font-size:18.5px;line-height:1.62;color:var(--soft);margin:0 0 26px;max-width:580px;
    opacity:0;animation:fadeUp .8s ease .28s forwards}
  .pills{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:32px;opacity:0;animation:fadeUp .8s ease .38s forwards}
  .pill{font-size:12.5px;color:#cfe0f5;border:1px solid var(--line);background:rgba(255,255,255,.05);
    border-radius:99px;padding:7px 13px;backdrop-filter:blur(6px)}
  .cta{display:flex;flex-wrap:wrap;gap:13px;align-items:center;opacity:0;animation:fadeUp .8s ease .48s forwards}
  .btn{display:inline-flex;align-items:center;gap:9px;text-decoration:none;font-weight:600;font-size:15px;
    padding:13px 22px;border-radius:12px;transition:transform .15s ease, box-shadow .2s ease, background .2s ease}
  .btn svg{width:18px;height:18px;flex-shrink:0}
  .btn-primary{background:var(--grad);background-size:160% auto;color:#03130e;box-shadow:0 8px 26px rgba(25,211,159,.28)}
  .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(25,211,159,.42)}
  .btn-ghost{border:1px solid var(--line);color:var(--ink);background:rgba(255,255,255,.05);backdrop-filter:blur(6px)}
  .btn-ghost:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.09)}

  footer{position:relative;z-index:1;border-top:1px solid var(--line);color:var(--faint);font-size:13px;
    opacity:0;animation:fadeUp .8s ease .6s forwards}
  .footer-in{max-width:760px;margin:0 auto;padding:18px 24px 28px;display:flex;justify-content:space-between;
    flex-wrap:wrap;gap:10px;align-items:center}
  .footer-in a{color:var(--soft);text-decoration:none;display:inline-flex;align-items:center;gap:7px}
  .footer-in a:hover{color:var(--brand)}
  .footer-in svg{width:15px;height:15px}
  .sep{display:flex;gap:18px;flex-wrap:wrap}

  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @media(max-width:560px){h1{font-size:38px}.wrap{padding:0 20px}p.lead{font-size:17px}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important}.bg img{opacity:.85}}
</style>
</head>
<body>
  <div class="bg"><img id="hero" src="/hero-2.jpg" alt="" onload="this.classList.add('on')" /></div>

  <div class="wrap">
    <header>
      <div class="mark">
        <svg height="30" viewBox="0 0 300 100" fill="none" aria-hidden="true">
          <defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
            <stop offset="0" stop-color="#3b82f6"/><stop offset=".5" stop-color="#22d3ee"/><stop offset="1" stop-color="#34d399"/>
          </linearGradient></defs>
          <path d="M24 80 L118 20 L200 80" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M100 80 L178 48 L276 80" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="16" cy="80" r="8" fill="none" stroke="#3b82f6" stroke-width="6"/>
          <circle cx="284" cy="80" r="8" fill="none" stroke="#34d399" stroke-width="6"/>
        </svg>
        <span class="wordmark">AID <span>PROTOCOL</span></span>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="eyebrow"><span class="dot"></span> Launching soon</div>
        <h1>A lifeline for disaster relief, <span class="grad">on-chain.</span></h1>
        <p class="lead">Aid Protocol is a non-profit, open-source platform where donations to verified disasters are recorded on-chain and released from escrow only against proof of spend. Give publicly or anonymously, on Solana or Ethereum.</p>
        <div class="pills">
          <span class="pill">Proof-gated escrow</span>
          <span class="pill">Multi-chain</span>
          <span class="pill">Donor-first transparency</span>
          <span class="pill">No KYC to give</span>
        </div>
        <div class="cta">
          <a class="btn btn-primary" href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Follow on X
          </a>
          <a class="btn btn-ghost" href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
            View on GitHub
          </a>
          <a class="btn btn-ghost" href="mailto:admin@aidprotocol.org">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
            Email
          </a>
        </div>
      </section>
    </main>
  </div>

  <footer>
    <div class="footer-in">
      <span>© 2026 Aid Protocol · Non-profit · Open source</span>
      <div class="sep">
        <a href="https://x.com/aidprotocol_" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          @aidprotocol_
        </a>
        <a href="https://github.com/aid-protocol-onchain/Protocol" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
          GitHub
        </a>
        <a href="mailto:admin@aidprotocol.org">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
          Email
        </a>
      </div>
    </div>
  </footer>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }
    // hero.jpg and any other static asset
    return env.ASSETS.fetch(request);
  },
};

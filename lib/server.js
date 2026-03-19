const express = require('express');
const { createServer } = require('http');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const packageInfo = require('../package.json');

global.nimaInstance = null;

// ── Menu Card Image Generator & Server ───────────────────────────────────────
const path = require('path');
const fs = require('fs');
const MENU_CARDS_DIR = path.join(__dirname, '../database/menucards');
if (!fs.existsSync(MENU_CARDS_DIR)) fs.mkdirSync(MENU_CARDS_DIR, { recursive: true });

// Generate menu card images on startup
async function generateMenuCards() {
    try {
        const sharp = require('sharp');
        const CATS = [
            { id:'bot',      title:'BOT',       color:'#cc0000', cmds:['alive • ping • speed','runtime • info • owner','vv • jid • github'] },
            { id:'group',    title:'GROUP',     color:'#9900cc', cmds:['tagall • hidetag • add','kick • promote • demote','welcome • setname'] },
            { id:'download', title:'DOWNLOAD',  color:'#0066cc', cmds:['song • mp3 • play','video • mp4 • ytmp3','ytmp4'] },
            { id:'ai',       title:'AI',        color:'#00aa44', cmds:['gpt • gemini • llama3','imagine • flux • sora','chatai'] },
            { id:'sticker',  title:'STICKER',   color:'#cc6600', cmds:['sticker • attp • simage','removebg • blur • ss','tts • trt'] },
            { id:'fun',      title:'FUN',       color:'#cc0066', cmds:['joke • quote • fact','8ball • compliment','hack • ship • flirt'] },
            { id:'games',    title:'GAMES',     color:'#006699', cmds:['tictactoe • suit • chess','akinator • slot • math','blackjack'] },
            { id:'search',   title:'SEARCH',    color:'#449900', cmds:['google • ytsearch','define • weather • news','lyrics • fact'] },
        ];
        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
        for (const cat of CATS) {
            const W=400, H=280;
            let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">';
            svg += '<rect width="' + W + '" height="' + H + '" fill="#070707"/>';
            for(let y=0; y<H; y+=3) svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="#ff000006" stroke-width="1"/>';
            svg += '<rect x="0" y="0" width="' + W + '" height="' + (H*0.45) + '" fill="' + cat.color + '" opacity="0.12"/>';
            svg += '<rect x="0" y="0" width="' + W + '" height="5" fill="' + cat.color + '"/>';
            const b=14,bs=18;
            svg += '<line x1="' + b + '" y1="' + b + '" x2="' + (b+bs) + '" y2="' + b + '" stroke="' + cat.color + '" stroke-width="2"/>';
            svg += '<line x1="' + b + '" y1="' + b + '" x2="' + b + '" y2="' + (b+bs) + '" stroke="' + cat.color + '" stroke-width="2"/>';
            svg += '<line x1="' + (W-b) + '" y1="' + b + '" x2="' + (W-b-bs) + '" y2="' + b + '" stroke="' + cat.color + '" stroke-width="2"/>';
            svg += '<line x1="' + (W-b) + '" y1="' + b + '" x2="' + (W-b) + '" y2="' + (b+bs) + '" stroke="' + cat.color + '" stroke-width="2"/>';
            svg += '<text x="' + (W/2) + '" y="56" text-anchor="middle" font-family="Courier New,monospace" font-size="32" font-weight="700" fill="' + cat.color + '">' + esc(cat.title) + '</text>';
            svg += '<line x1="30" y1="70" x2="' + (W-30) + '" y2="70" stroke="' + cat.color + '" stroke-width="1" opacity="0.5"/>';
            cat.cmds.forEach(function(line, i) {
                svg += '<text x="' + (W/2) + '" y="' + (100 + i*38) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="15" fill="#ffaaaa">' + esc(line) + '</text>';
            });
            svg += '<rect x="0" y="' + (H-4) + '" width="' + W + '" height="4" fill="' + cat.color + '"/>';
            svg += '</svg>';
            const buf = await sharp(Buffer.from(svg)).jpeg({quality: 92}).toBuffer();
            fs.writeFileSync(path.join(MENU_CARDS_DIR, cat.id + '.jpg'), buf);
        }
        console.log('✅ Menu card images generated!');
    } catch(e) {
        console.log('⚠️ Menu card generation skipped:', e.message);
    }
}
generateMenuCards();

// Serve menu card images
app.get('/menucard/:id', (req, res) => {
    const imgPath = path.join(MENU_CARDS_DIR, req.params.id + '.jpg');
    if (fs.existsSync(imgPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.sendFile(imgPath);
    } else {
        res.status(404).send('Not found');
    }
});

// ── Web Dashboard ──────────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
	res.send(`<!DOCTYPE html>
<html lang="si">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${packageInfo.name} · Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #05080f;
    --surface:   #0c1120;
    --border:    rgba(255,255,255,0.06);
    --accent:    #00e5a0;
    --accent2:   #0af;
    --accent3:   #f0c040;
    --text:      #e8edf5;
    --muted:     #5a6a82;
    --danger:    #ff4d6d;
    --radius:    14px;
    --glow:      0 0 32px rgba(0,229,160,0.18);
  }

  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Background mesh ── */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0;
    background:
      radial-gradient(ellipse 60% 50% at 10% 10%, rgba(0,229,160,0.07) 0%, transparent 70%),
      radial-gradient(ellipse 50% 40% at 90% 80%, rgba(0,170,255,0.06) 0%, transparent 70%),
      radial-gradient(ellipse 40% 60% at 50% 50%, rgba(240,192,64,0.03) 0%, transparent 70%);
    pointer-events: none;
  }

  /* ── Noise grain ── */
  body::after {
    content: '';
    position: fixed; inset: 0; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    background-size: 200px;
    pointer-events: none;
    opacity: 0.5;
  }

  .wrap { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }

  /* ── Header ── */
  header {
    display: flex; align-items: center; gap: 1.2rem;
    padding: 2.5rem 0 2rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2.5rem;
    animation: fadeDown 0.6s ease both;
  }

  .logo-ring {
    width: 56px; height: 56px; flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--accent);
    box-shadow: var(--glow), inset 0 0 20px rgba(0,229,160,0.08);
    display: grid; place-items: center;
    font-size: 1.5rem;
    animation: pulse 3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: var(--glow), inset 0 0 20px rgba(0,229,160,0.08); }
    50%       { box-shadow: 0 0 48px rgba(0,229,160,0.35), inset 0 0 20px rgba(0,229,160,0.14); }
  }

  .header-text h1 {
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.4rem, 4vw, 2rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 60%, var(--accent3) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-text p { font-size: 0.75rem; color: var(--muted); margin-top: 0.3rem; letter-spacing: 0.05em; }

  .badge {
    margin-left: auto;
    background: rgba(0,229,160,0.1);
    border: 1px solid rgba(0,229,160,0.3);
    color: var(--accent);
    font-size: 0.65rem;
    font-weight: 500;
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: fadeDown 0.6s 0.2s ease both;
  }

  /* ── Status cards row ── */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.2rem 1.4rem;
    position: relative;
    overflow: hidden;
    animation: fadeUp 0.5s ease both;
    transition: border-color 0.3s, transform 0.2s;
  }
  .stat-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-2px); }
  .stat-card:nth-child(2) { animation-delay: 0.1s; }
  .stat-card:nth-child(3) { animation-delay: 0.2s; }
  .stat-card:nth-child(4) { animation-delay: 0.3s; }

  .stat-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .stat-card.green::before  { background: linear-gradient(90deg, var(--accent), transparent); }
  .stat-card.blue::before   { background: linear-gradient(90deg, var(--accent2), transparent); }
  .stat-card.yellow::before { background: linear-gradient(90deg, var(--accent3), transparent); }
  .stat-card.red::before    { background: linear-gradient(90deg, var(--danger), transparent); }

  .stat-label { font-size: 0.65rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
  .stat-value { font-family: 'Syne', sans-serif; font-size: 1.4rem; font-weight: 700; }
  .stat-value.green  { color: var(--accent); }
  .stat-value.blue   { color: var(--accent2); }
  .stat-value.yellow { color: var(--accent3); }
  .stat-value.red    { color: var(--danger); }
  .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 0.2rem; }

  /* ── Pair section ── */
  .section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2rem;
    margin-bottom: 1.5rem;
    animation: fadeUp 0.5s 0.35s ease both;
  }

  .section-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 1.4rem;
    display: flex; align-items: center; gap: 0.6rem;
  }
  .section-title::after {
    content: '';
    flex: 1; height: 1px;
    background: var(--border);
  }

  /* ── Pair form ── */
  .pair-row { display: flex; gap: 0.8rem; flex-wrap: wrap; }

  .input-wrap { position: relative; flex: 1; min-width: 200px; }

  .input-prefix {
    position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
    font-size: 0.8rem; color: var(--accent); user-select: none;
    pointer-events: none;
  }

  input[type="text"] {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.85rem 1rem 0.85rem 3.2rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.85rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s;
  }
  input[type="text"]:focus {
    border-color: rgba(0,229,160,0.5);
    box-shadow: 0 0 0 3px rgba(0,229,160,0.1);
  }
  input[type="text"]::placeholder { color: var(--muted); }

  button {
    background: var(--accent);
    color: #020c07;
    border: none;
    border-radius: 10px;
    padding: 0.85rem 1.8rem;
    font-family: 'Syne', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: transform 0.15s, box-shadow 0.25s, background 0.2s;
    white-space: nowrap;
  }
  button:hover  { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,229,160,0.3); }
  button:active { transform: translateY(0); }
  button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── Result box ── */
  .result-box {
    margin-top: 1.2rem;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.2rem 1.4rem;
    font-size: 0.82rem;
    line-height: 1.6;
    display: none;
    animation: fadeUp 0.3s ease both;
  }
  .result-box.show { display: block; }
  .result-box.success { border-color: rgba(0,229,160,0.35); }
  .result-box.error   { border-color: rgba(255,77,109,0.35); }

  .code-chip {
    display: inline-block;
    background: rgba(0,229,160,0.12);
    border: 1px solid rgba(0,229,160,0.4);
    color: var(--accent);
    font-family: 'DM Mono', monospace;
    font-size: 1.4rem;
    font-weight: 500;
    letter-spacing: 0.2em;
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    margin: 0.6rem 0;
    user-select: all;
  }

  /* ── Endpoints list ── */
  .endpoint-list { display: flex; flex-direction: column; gap: 0.6rem; }

  .endpoint-row {
    display: flex; align-items: center; gap: 0.8rem;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    transition: background 0.2s, border-color 0.2s;
  }
  .endpoint-row:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.1); }

  .method {
    font-family: 'Syne', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
  .method.get  { background: rgba(0,229,160,0.15); color: var(--accent); }
  .method.post { background: rgba(0,170,255,0.15); color: var(--accent2); }
  .method.all  { background: rgba(240,192,64,0.15); color: var(--accent3); }

  .ep-path { color: var(--text); font-family: 'DM Mono', monospace; flex: 1; }
  .ep-desc { color: var(--muted); font-size: 0.72rem; text-align: right; }

  /* ── Instructions ── */
  .steps { counter-reset: step; display: flex; flex-direction: column; gap: 0.8rem; }

  .step {
    display: flex; gap: 1rem; align-items: flex-start;
    font-size: 0.82rem; color: var(--muted); line-height: 1.5;
  }
  .step-num {
    counter-increment: step;
    flex-shrink: 0;
    width: 24px; height: 24px;
    border-radius: 50%;
    background: rgba(0,229,160,0.1);
    border: 1px solid rgba(0,229,160,0.3);
    display: grid; place-items: center;
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent);
  }

  /* ── Footer ── */
  footer {
    text-align: center;
    font-size: 0.7rem;
    color: var(--muted);
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    letter-spacing: 0.05em;
    animation: fadeUp 0.5s 0.5s ease both;
  }
  footer span { color: var(--accent); }

  /* ── Animations ── */
  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Spinner ── */
  .spinner {
    display: inline-block; width: 14px; height: 14px;
    border: 2px solid rgba(2,12,7,0.3);
    border-top-color: #020c07;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle; margin-right: 6px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Live dot ── */
  .live-dot {
    display: inline-block; width: 8px; height: 8px;
    border-radius: 50%; background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
    animation: blink 1.4s ease-in-out infinite;
    margin-right: 6px;
    vertical-align: middle;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }

  @media (max-width: 560px) {
    .pair-row { flex-direction: column; }
    .ep-desc  { display: none; }
    .badge    { display: none; }
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header>
    <div class="logo-ring">🤖</div>
    <div class="header-text">
      <h1>${packageInfo.name}</h1>
      <p>v${packageInfo.version} · by ${packageInfo.author}</p>
    </div>
    <div class="badge"><span class="live-dot"></span>Online</div>
  </header>

  <!-- Stats row -->
  <div class="stats-row" id="statsRow">
    <div class="stat-card green">
      <div class="stat-label">Bot Name</div>
      <div class="stat-value green" style="font-size:1rem">${packageInfo.name}</div>
      <div class="stat-sub">WhatsApp Bot</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Version</div>
      <div class="stat-value blue">${packageInfo.version}</div>
      <div class="stat-sub">Current Build</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-label">Uptime</div>
      <div class="stat-value yellow" id="uptimeVal">—</div>
      <div class="stat-sub">Live from server</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Status</div>
      <div class="stat-value green">Active</div>
      <div class="stat-sub">Running</div>
    </div>
  </div>

  <!-- Pair Code -->
  <div class="section">
    <div class="section-title">📱 WhatsApp Pair</div>

    <div class="steps" style="margin-bottom:1.4rem">
      <div class="step"><div class="step-num">1</div><div>WhatsApp → Linked Devices → Link with phone number තෝරන්න</div></div>
      <div class="step"><div class="step-num">2</div><div>පහතින් ඔබේ දුරකථන අංකය ඇතුළු කරන්න (country code සහිතව)</div></div>
      <div class="step"><div class="step-num">3</div><div>ලැබෙන Pair Code WhatsApp හි ඇතුළු කරන්න (60 sec ඇතුළත)</div></div>
    </div>

    <div class="pair-row">
      <div class="input-wrap">
        <span class="input-prefix">📞</span>
        <input type="text" id="phoneInput" placeholder="947XXXXXXXX" maxlength="15"/>
      </div>
      <button id="pairBtn" onclick="getPairCode()">Get Pair Code</button>
    </div>

    <div class="result-box" id="resultBox"></div>
  </div>

  <!-- Endpoints -->
  <div class="section" style="animation-delay:0.45s">
    <div class="section-title">🔌 API Endpoints</div>
    <div class="endpoint-list">
      <div class="endpoint-row">
        <span class="method all">ALL</span>
        <span class="ep-path">/</span>
        <span class="ep-desc">Bot info &amp; uptime</span>
      </div>
      <div class="endpoint-row">
        <span class="method get">GET</span>
        <span class="ep-path">/pair?number=94700000000</span>
        <span class="ep-desc">Get pairing code</span>
      </div>
      <div class="endpoint-row">
        <span class="method all">ALL</span>
        <span class="ep-path">/process?send=restart</span>
        <span class="ep-desc">Send process signal</span>
      </div>
      <div class="endpoint-row">
        <span class="method all">ALL</span>
        <span class="ep-path">/chat?message=hi&amp;to=94700000000</span>
        <span class="ep-desc">Send message (WIP)</span>
      </div>
      <div class="endpoint-row">
        <span class="method get">GET</span>
        <span class="ep-path">/dashboard</span>
        <span class="ep-desc">This dashboard</span>
      </div>
    </div>
  </div>

  <footer>
    Built with ❤️ by <span>${packageInfo.author}</span> · ${packageInfo.name} ${packageInfo.version}
  </footer>
</div>

<script>
  // Fetch uptime on load
  async function fetchStatus() {
    try {
      const r = await fetch('/');
      const d = await r.json();
      if (d.uptime) {
        document.getElementById('uptimeVal').textContent = d.uptime;
      }
    } catch {}
  }
  fetchStatus();
  setInterval(fetchStatus, 10000);

  // Pair code
  async function getPairCode() {
    const btn   = document.getElementById('pairBtn');
    const input = document.getElementById('phoneInput');
    const box   = document.getElementById('resultBox');
    const num   = input.value.trim().replace(/[^0-9]/g, '');

    if (!num || num.length < 7) {
      showResult('error', '⚠️ වලංගු දුරකථන අංකයක් ඇතුළු කරන්න.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>ලබා ගැනීම...';
    box.className = 'result-box'; box.style.display = 'none';

    try {
      const r = await fetch('/pair?number=' + num);
      const d = await r.json();
      if (d.status) {
        showResult('success',
          '<div style="color:var(--accent);font-family:Syne,sans-serif;font-size:0.9rem;font-weight:700;margin-bottom:0.5rem">✅ Pair Code ලැබුණා!</div>' +
          '<div class="code-chip">' + d.code + '</div>' +
          '<div style="color:var(--muted);font-size:0.75rem;margin-top:0.5rem">⏱ expires: ' + (d.expires || '60 seconds') + '</div>'
        );
      } else {
        showResult('error', '❌ ' + (d.message || 'Pair code ගැනීමට අසමත් විය.'));
      }
    } catch (e) {
      showResult('error', '❌ සේවාදායකයට සම්බන්ධ නොවිය හැකි විය.');
    }

    btn.disabled = false;
    btn.innerHTML = 'Get Pair Code';
  }

  function showResult(type, html) {
    const box = document.getElementById('resultBox');
    box.className = 'result-box show ' + type;
    box.innerHTML = html;
    box.style.display = 'block';
  }

  // Enter key
  document.getElementById('phoneInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') getPairCode();
  });
</script>
</body>
</html>`);
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.all('/', (req, res) => {
	if (process.send) {
		process.send('uptime');
		process.once('message', (uptime) => {
			res.json({
				bot_name: packageInfo.name,
				version: packageInfo.version,
				author: packageInfo.author,
				description: packageInfo.description,
				uptime: `${Math.floor(uptime)} තත්පර`
			});
		});
	} else res.json({ error: 'ක්‍රියාවලිය (Process) IPC සමඟ ධාවනය නොවේ' });
});

app.all('/process', (req, res) => {
	const { send } = req.query;
	if (!send) return res.status(400).json({ error: 'යොමු කිරීමට අවශ්‍ය විමසුම (query) ඇතුළත් කර නැත' });
	if (process.send) {
		process.send(send)
		res.json({ status: 'යවන ලදී (Sent)', data: send });
	} else res.json({ error: 'ක්‍රියාවලිය (Process) IPC සමඟ ධාවනය නොවේ' });
});

app.all('/chat', (req, res) => {
	const { message, to } = req.query;
	if (!message || !to) return res.status(400).json({ error: 'පණිවිඩය හෝ යොමු කළ යුතු ලිපිනය ඇතුළත් කර නැත' });
	res.json({ status: 200, mess: 'තවමත් ආරම්භ වී නොමැත' })
});

app.get('/pair', async (req, res) => {
	const { number } = req.query;
	if (!number) return res.status(400).json({ status: false, message: 'අංකය (number) ඇතුළත් කර නැත. උදා: /pair?number=947xxxxxxxx' });

	const nima = global.nimaInstance;
	if (!nima) return res.status(503).json({ status: false, message: 'Bot තවම සූදානම් නැත. ටිකක් රැඳෙන්න.' });

	if (nima.authState?.creds?.registered) {
		return res.status(400).json({ status: false, message: 'Bot දැනටමත් registered. Pair code අවශ්‍ය නැත.' });
	}

	try {
		const cleanNumber = number.replace(/[^0-9]/g, '');
		const code = await nima.requestPairingCode(cleanNumber);
		const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
		return res.json({
			status: true,
			message: 'Pair code ලැබුණා! WhatsApp > Linked Devices > Link with phone number හි ඇතුළත් කරන්න.',
			number: cleanNumber,
			code: formatted,
			expires: '60 seconds'
		});
	} catch (e) {
		return res.status(500).json({ status: false, message: 'Pair code ගැනීමට අසමත් විය.', error: e.message });
	}
});

module.exports = { app, server, PORT };

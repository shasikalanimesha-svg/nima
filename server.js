const express = require('express');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
const packageInfo = require('../package.json');

global.nimaInstance = null;

// ── Menu Card Image Generator & Server ───────────────────────────────────────
const MENU_CARDS_DIR = path.join(__dirname, '../database/menucards');
if (!fs.existsSync(MENU_CARDS_DIR)) fs.mkdirSync(MENU_CARDS_DIR, { recursive: true });

async function generateMenuCards(botInfo = {}) {
    try {
        const sharp = require('sharp');
        const moment = require('moment-timezone');
        const now = moment.tz('Asia/Colombo');
        const timeStr = now.format('HH:mm');
        const dateStr = now.format('DD/MM/YYYY');

        const botName   = botInfo.botName   || 'Miss Shasikala';
        const ownerName = botInfo.ownerName || 'Nimesha Madhushan';
        const botNumber = botInfo.botNumber || '94726800969';
        const ownerNum  = botInfo.ownerNum  || '94726800969';
        const prefix    = botInfo.prefix    || '.';

        const CATS = [
            { id:'bot',      title:'බොට් (BOT)',           siTitle:'🤖 බොට් විධාන',       color:'#cc0000', cmds:['.alive','.bot','.ping','.speed','.runtime','.info','.owner','.vv','.jid','.github','.groupinfo','.staff'] },
            { id:'group',    title:'සමූහ (GROUP)',          siTitle:'👥 සමූහ විධාන',        color:'#9900cc', cmds:['.tagall','.hidetag','.totag','.add','.kick','.promote','.demote','.warn','.setname','.setdesc','.welcome','.goodbye'] },
            { id:'download', title:'බාගැනීම (DOWNLOAD)',    siTitle:'⬇️ බාගත කිරීම',        color:'#0066cc', cmds:['.song','.mp3','.play','.ytmp3','.video','.mp4','.ytmp4'] },
            { id:'ai',       title:'AI (කෘතිම බුද්ධිය)',    siTitle:'🤖 AI විධාන',          color:'#00aa44', cmds:['.gpt','.gemini','.llama3','.ai','.chatai','.imagine','.flux','.sora'] },
            { id:'sticker',  title:'ස්ටිකර් (STICKER)',     siTitle:'🎨 ස්ටිකර් සහ රූප',    color:'#cc6600', cmds:['.sticker','.s','.simage','.attp','.removebg','.blur','.ss','.tts','.trt'] },
            { id:'fun',      title:'විනෝදය (FUN)',           siTitle:'😂 විනෝදාත්මක',         color:'#cc0066', cmds:['.joke','.quote','.fact','.8ball','.compliment','.insult','.hack','.ship','.flirt','.shayari'] },
            { id:'games',    title:'ක්‍රීඩා (GAMES)',         siTitle:'🎮 ක්‍රීඩා විධාන',      color:'#006699', cmds:['.tictactoe','.suit','.chess','.akinator','.slot','.math','.blackjack'] },
            { id:'search',   title:'සෙවුම (SEARCH)',         siTitle:'🔍 සෙවුම් විධාන',       color:'#449900', cmds:['.google','.ytsearch','.define','.weather','.news','.lyrics','.fact'] },
            { id:'privacy',  title:'PRIVACY',                siTitle:'🔐 Privacy Manager',     color:'#ff6600', cmds:['.privacy 1-3','.privacy 4-5','.privacy 6-8','.privacy 9-11','.privacy 12-13','.privacy 14-16','.privacy 17-20','.privacy 21'] },
        ];

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

        for (const cat of CATS) {
            const W = 420;
            const CMD_H = 28;
            const INFO_H = 152;
            const TITLE_H = 74;
            const half = Math.ceil(cat.cmds.length / 2);
            const CMDS_H = half * CMD_H + 34;
            const FOOT_H = 46;
            const H = TITLE_H + INFO_H + CMDS_H + FOOT_H;

            let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">';
            svg += '<rect width="' + W + '" height="' + H + '" fill="#060606"/>';
            for(let y=0; y<H; y+=3)
                svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="#ff000005" stroke-width="1"/>';

            svg += '<rect x="0" y="0" width="' + W + '" height="' + TITLE_H + '" fill="' + cat.color + '" opacity="0.18"/>';
            svg += '<rect x="0" y="0" width="' + W + '" height="5" fill="' + cat.color + '"/>';
            const b=12,bs=16;
            [[b,b,1,1],[W-b,b,-1,1],[b,TITLE_H-b,1,-1],[W-b,TITLE_H-b,-1,-1]].forEach(function(p){
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+(p[0]+p[2]*bs)+'" y2="'+p[1]+'" stroke="'+cat.color+'" stroke-width="2"/>';
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[0]+'" y2="'+(p[1]+p[3]*bs)+'" stroke="'+cat.color+'" stroke-width="2"/>';
            });
            svg += '<text x="' + (W/2) + '" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="' + cat.color + '">' + esc(cat.title) + '</text>';
            svg += '<text x="' + (W/2) + '" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#ffaaaa">' + esc(cat.siTitle) + '</text>';

            const infoY = TITLE_H;
            svg += '<rect x="0" y="' + infoY + '" width="' + W + '" height="' + INFO_H + '" fill="#0f0000"/>';
            svg += '<line x1="0" y1="' + infoY + '" x2="' + W + '" y2="' + infoY + '" stroke="' + cat.color + '" stroke-width="1"/>';
            const col1=20, col2=W/2+8, lh=24;
            let iy = infoY + 22;

            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">🤖 බොට් නම</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">👑 හිමිකරු</text>';
            iy += lh-4;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ff9999">' + esc(botName) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ff9999">' + esc(ownerName) + '</text>';
            iy += lh;

            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">📱 බොට් අංකය</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">📱 හිමිකරු අංකය</text>';
            iy += lh-4;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="12" fill="#ffaaaa">+' + esc(botNumber) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="12" fill="#ffaaaa">+' + esc(ownerNum) + '</text>';
            iy += lh;

            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">📅 දිනය</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">🕐 වේලාව</text>';
            iy += lh-4;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="#ffaaaa">' + esc(dateStr) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="#ffaaaa">' + esc(timeStr) + '</text>';
            iy += lh;

            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Arial,sans-serif" font-size="11" fill="#886666">🔧 Prefix</text>';
            iy += lh-4;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="14" font-weight="700" fill="'+cat.color+'">' + esc(prefix) + '</text>';

            const cmdY = infoY + INFO_H;
            svg += '<line x1="0" y1="' + cmdY + '" x2="' + W + '" y2="' + cmdY + '" stroke="' + cat.color + '" stroke-width="1"/>';
            svg += '<text x="' + (W/2) + '" y="' + (cmdY+16) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#884444">▼ විධාන ලැයිස්තුව ▼</text>';

            cat.cmds.forEach(function(cmd, i) {
                const isRight = i >= half;
                const row = isRight ? i - half : i;
                const cx = isRight ? (W/2 + 10) : 16;
                const cy = cmdY + 26 + row * CMD_H;
                svg += '<text x="'+cx+'" y="'+cy+'" font-family="Courier New,monospace" font-size="13" fill="'+cat.color+'">&gt;</text>';
                svg += '<text x="'+(cx+14)+'" y="'+cy+'" font-family="Courier New,monospace" font-size="13" fill="#ffcccc">' + esc(cmd) + '</text>';
            });

            const footY = cmdY + 26 + half * CMD_H + 8;
            svg += '<rect x="0" y="' + footY + '" width="' + W + '" height="' + FOOT_H + '" fill="#0a0000"/>';
            svg += '<line x1="0" y1="' + footY + '" x2="' + W + '" y2="' + footY + '" stroke="' + cat.color + '" stroke-width="1.5"/>';
            svg += '<text x="' + (W/2) + '" y="' + (footY+18) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#663333">🌸 Miss Shasikala Bot | 👑 Nimesha Madhushan</text>';
            svg += '<text x="' + (W/2) + '" y="' + (footY+34) + '" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#441111">tap කරල command run කරන්න</text>';
            svg += '<rect x="0" y="' + (footY+FOOT_H-3) + '" width="' + W + '" height="3" fill="' + cat.color + '"/>';
            svg += '</svg>';

            const buf = await sharp(Buffer.from(svg)).jpeg({quality: 93}).toBuffer();
            fs.writeFileSync(path.join(MENU_CARDS_DIR, cat.id + '.jpg'), buf);
        }
        console.log('✅ Menu card images generated!');
    } catch(e) {
        console.log('⚠️ Menu card generation skipped:', e.message);
    }
}
global.generateMenuCards = generateMenuCards;
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

module.exports = { app, server, PORT };// Generate menu card images on startup
async function generateMenuCards(botInfo = {}) {
    try {
        const sharp = require('sharp');
        const moment = require('moment-timezone');
        const now = moment.tz('Asia/Colombo');
        const timeStr = now.format('HH:mm');
        const dateStr = now.format('DD/MM/YYYY');

        const botName   = botInfo.botName   || 'Miss Shasikala';
        const ownerName = botInfo.ownerName || 'Nimesha Madhushan';
        const botNumber = botInfo.botNumber || '94726800969';
        const ownerNum  = botInfo.ownerNum  || '94726800969';
        const prefix    = botInfo.prefix    || '.';

        // Shuffle a palette each restart — every card gets unique color, never same order
        const PALETTE = [
            '#ff2020', // red
            '#00cc44', // green
            '#2288ff', // blue
            '#ff9900', // orange
            '#cc00ff', // purple
            '#ff0088', // pink
            '#00cccc', // cyan
            '#aacc00', // yellow-green
            '#ff6600', // deep orange
            '#00aaff', // sky blue
            '#ff44aa', // hot pink
            '#44ff88', // mint
            '#ff3366', // crimson
            '#33ffcc', // aqua
            '#ffcc00', // gold
            '#aa44ff', // violet
        ];
        // Fisher-Yates shuffle — enough for 9 cards
        const shuffled = [...PALETTE].sort(() => Math.random() - 0.5);

        const CATS = [
            { id:'bot',      title:'BOT',       sub:'Bot Commands',           color: shuffled[0], cmds:['.alive','.bot','.ping','.speed','.runtime','.info','.owner','.vv','.jid','.github','.groupinfo','.staff'] },
            { id:'group',    title:'GROUP',     sub:'Group Commands',          color: shuffled[1], cmds:['.tagall','.hidetag','.totag','.add','.kick','.promote','.demote','.warn','.setname','.setdesc','.welcome','.goodbye'] },
            { id:'download', title:'DOWNLOAD',  sub:'Download Commands',       color: shuffled[2], cmds:['.song','.mp3','.play','.ytmp3','.video','.mp4','.ytmp4'] },
            { id:'ai',       title:'AI',        sub:'Artificial Intelligence', color: shuffled[3], cmds:['.gpt','.gemini','.llama3','.ai','.chatai','.imagine','.flux','.sora'] },
            { id:'sticker',  title:'STICKER',   sub:'Sticker & Image',         color: shuffled[4], cmds:['.sticker','.s','.simage','.attp','.removebg','.blur','.ss','.tts','.trt'] },
            { id:'fun',      title:'FUN',       sub:'Fun & Entertainment',     color: shuffled[5], cmds:['.joke','.quote','.fact','.8ball','.compliment','.insult','.hack','.ship','.flirt','.shayari'] },
            { id:'games',    title:'GAMES',     sub:'Games Commands',          color: shuffled[6], cmds:['.tictactoe','.suit','.chess','.akinator','.slot','.math','.blackjack'] },
            { id:'search',   title:'SEARCH',    sub:'Search Commands',         color: shuffled[7], cmds:['.google','.ytsearch','.define','.weather','.news','.lyrics','.fact'] },
            { id:'privacy',  title:'PRIVACY',   sub:'Privacy Manager',          color: shuffled[8], cmds:['.privacy 1-3','.privacy 4-5','.privacy 6-8','.privacy 9-11','.privacy 12-13','.privacy 14-16','.privacy 17-20','.privacy 21'] },
        ];

        function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

        // Darken color for bg tint
        function hexToBgTint(hex) {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            return 'rgb('+Math.floor(r*0.08)+','+Math.floor(g*0.08)+','+Math.floor(b*0.08)+')';
        }
        function hexToInfoBg(hex) {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            return 'rgb('+Math.floor(r*0.05)+','+Math.floor(g*0.05)+','+Math.floor(b*0.05)+')';
        }
        function hexToLabelColor(hex) {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            return 'rgb('+Math.floor(r*0.5)+','+Math.floor(g*0.5)+','+Math.floor(b*0.5)+')';
        }
        function hexToTextColor(hex) {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            return 'rgb('+Math.min(255,Math.floor(r*0.8)+140)+','+Math.min(255,Math.floor(g*0.8)+140)+','+Math.min(255,Math.floor(b*0.8)+140)+')';
        }

        for (const cat of CATS) {
            const W       = 620;
            const CMD_H   = 46;
            const INFO_H  = 240;
            const TITLE_H = 120;
            const half    = Math.ceil(cat.cmds.length / 2);
            const CMDS_H  = half * CMD_H + 56;
            const FOOT_H  = 64;
            const H       = TITLE_H + INFO_H + CMDS_H + FOOT_H;

            const bgTint    = hexToBgTint(cat.color);
            const infoBg    = hexToInfoBg(cat.color);
            const labelCol  = hexToLabelColor(cat.color);
            const textCol   = hexToTextColor(cat.color);

            let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">';

            // background
            svg += '<rect width="' + W + '" height="' + H + '" fill="#040404"/>';
            // subtle color tint overlay
            svg += '<rect width="' + W + '" height="' + H + '" fill="' + bgTint + '"/>';
            // scanlines
            for(let y=0; y<H; y+=5)
                svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="' + cat.color + '" stroke-width="0.3" opacity="0.06"/>';

            // ── TITLE PANEL ───────────────────────────────────────
            svg += '<rect x="0" y="0" width="' + W + '" height="' + TITLE_H + '" fill="' + cat.color + '" opacity="0.15"/>';
            svg += '<rect x="0" y="0" width="' + W + '" height="7" fill="' + cat.color + '"/>';
            svg += '<rect x="0" y="7" width="' + W + '" height="3" fill="' + cat.color + '" opacity="0.3"/>';

            // corner brackets
            const b=18, bs=26;
            [[b,b,1,1],[W-b,b,-1,1],[b,TITLE_H-b,1,-1],[W-b,TITLE_H-b,-1,-1]].forEach(function(p){
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+(p[0]+p[2]*bs)+'" y2="'+p[1]+'" stroke="'+cat.color+'" stroke-width="3.5" opacity="0.9"/>';
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[0]+'" y2="'+(p[1]+p[3]*bs)+'" stroke="'+cat.color+'" stroke-width="3.5" opacity="0.9"/>';
            });

            // title text
            svg += '<text x="' + (W/2) + '" y="60" text-anchor="middle" font-family="Courier New,Consolas,monospace" font-size="42" font-weight="700" fill="' + cat.color + '" letter-spacing="8">[ ' + esc(cat.title) + ' ]</text>';
            svg += '<text x="' + (W/2) + '" y="92" text-anchor="middle" font-family="Courier New,monospace" font-size="17" fill="' + labelCol + '" letter-spacing="3">' + esc(cat.sub.toUpperCase()) + '</text>';

            // ── INFO PANEL ────────────────────────────────────────
            const infoY = TITLE_H;
            svg += '<rect x="0" y="' + infoY + '" width="' + W + '" height="' + INFO_H + '" fill="' + infoBg + '"/>';
            svg += '<line x1="0" y1="' + infoY + '" x2="' + W + '" y2="' + infoY + '" stroke="' + cat.color + '" stroke-width="2"/>';

            const col1=32, col2=W/2+16, lh=36;
            let iy = infoY + 34;

            // BOT NAME | OWNER — with large spacing
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">BOT NAME</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">OWNER</text>';
            iy += lh - 2;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="22" font-weight="700" fill="'+textCol+'">' + esc(botName) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="22" font-weight="700" fill="'+textCol+'">' + esc(ownerName) + '</text>';
            iy += lh + 12;

            // BOT NUMBER | OWNER NUMBER
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">BOT NUMBER</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">OWNER NUMBER</text>';
            iy += lh - 2;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="20" fill="'+textCol+'">+' + esc(botNumber) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="20" fill="'+textCol+'">+' + esc(ownerNum) + '</text>';
            iy += lh + 12;

            // DATE | TIME
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">DATE</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">TIME</text>';
            iy += lh - 2;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="22" fill="'+textCol+'">' + esc(dateStr) + '</text>';
            svg += '<text x="'+col2+'" y="'+iy+'" font-family="Courier New,monospace" font-size="22" fill="'+textCol+'">' + esc(timeStr) + '</text>';
            iy += lh + 8;

            // PREFIX
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="13" fill="'+labelCol+'" letter-spacing="3">PREFIX</text>';
            iy += lh - 4;
            svg += '<text x="'+col1+'" y="'+iy+'" font-family="Courier New,monospace" font-size="26" font-weight="700" fill="'+cat.color+'">' + esc(prefix) + '</text>';

            // ── COMMAND LIST ──────────────────────────────────────
            const cmdY = infoY + INFO_H;
            svg += '<line x1="0" y1="' + cmdY + '" x2="' + W + '" y2="' + cmdY + '" stroke="' + cat.color + '" stroke-width="2"/>';

            // section label
            svg += '<text x="' + (W/2) + '" y="' + (cmdY+26) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="13" fill="' + cat.color + '" letter-spacing="6">COMMAND  LIST</text>';
            svg += '<line x1="32" y1="' + (cmdY+32) + '" x2="' + (W-32) + '" y2="' + (cmdY+32) + '" stroke="' + cat.color + '" stroke-width="0.8" opacity="0.4"/>';

            cat.cmds.forEach(function(cmd, i) {
                const isRight = i >= half;
                const row     = isRight ? i - half : i;
                const cx      = isRight ? (W/2 + 16) : 24;
                const cy      = cmdY + 48 + row * CMD_H;
                // row bg alternate
                if (row % 2 === 0) {
                    const rowX = isRight ? W/2 : 0;
                    svg += '<rect x="'+rowX+'" y="'+(cy-28)+'" width="'+(W/2)+'" height="'+(CMD_H-2)+'" fill="'+cat.color+'" opacity="0.05"/>';
                }
                svg += '<text x="'+cx+'" y="'+cy+'" font-family="Courier New,monospace" font-size="18" fill="'+cat.color+'" font-weight="700">&gt;</text>';
                svg += '<text x="'+(cx+22)+'" y="'+cy+'" font-family="Courier New,monospace" font-size="20" fill="'+textCol+'">' + esc(cmd) + '</text>';
            });

            // ── FOOTER ────────────────────────────────────────────
            const footY = cmdY + 48 + half * CMD_H + 12;
            svg += '<rect x="0" y="' + footY + '" width="' + W + '" height="' + FOOT_H + '" fill="' + infoBg + '"/>';
            svg += '<line x1="0" y1="' + footY + '" x2="' + W + '" y2="' + footY + '" stroke="' + cat.color + '" stroke-width="3"/>';
            svg += '<line x1="0" y1="' + (footY+1) + '" x2="' + W + '" y2="' + (footY+1) + '" stroke="' + cat.color + '" stroke-width="1" opacity="0.3"/>';
            svg += '<text x="' + (W/2) + '" y="' + (footY+26) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="15" fill="' + labelCol + '">Miss Shasikala Bot  |  Nimesha Madhushan</text>';
            svg += '<text x="' + (W/2) + '" y="' + (footY+48) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="13" fill="' + cat.color + '" letter-spacing="3">[ TAP TO RUN COMMAND ]</text>';
            svg += '<rect x="0" y="' + (footY+FOOT_H-5) + '" width="' + W + '" height="5" fill="' + cat.color + '"/>';
            svg += '</svg>';

            const buf = await sharp(Buffer.from(svg)).jpeg({quality: 96}).toBuffer();
            fs.writeFileSync(path.join(MENU_CARDS_DIR, cat.id + '.jpg'), buf);
        }
        console.log('Menu cards generated!');
    } catch(e) {
        console.log('Menu card generation skipped:', e.message);
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

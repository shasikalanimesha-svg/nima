/**
 * Miss Shasikala Bot — Menu Image Generator
 * FB-style card grid, large text, hacker red theme
 */

const sharp = require('sharp');

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const SECTIONS = [
    { icon: '🤖', title: 'BOT',
      cmds: ['alive','bot','ping','runtime','speed','info','owner','vv','jid','github','groupinfo','staff'] },
    { icon: '👥', title: 'GROUP',
      cmds: ['tagall','hidetag','totag','add','kick','promote','demote','warn','setname','setdesc','linkgrup','revoke','welcome','goodbye','setwelcome','setleave'] },
    { icon: '⬇️', title: 'DOWNLOAD',
      cmds: ['song','mp3','play','ytmp3','video','mp4','ytmp4'] },
    { icon: '🤖', title: 'AI',
      cmds: ['gpt','gemini','llama3','ai','chatai','imagine','flux','sora'] },
    { icon: '🎨', title: 'STICKER',
      cmds: ['sticker','s','simage','toimg','attp','removebg','blur'] },
    { icon: '🎵', title: 'FUN & TOOLS',
      cmds: ['tts','trt','joke','quote','fact','8ball','weather','define','lyrics','ss','namecard'] },
    { icon: '😂', title: 'ENTERTAINMENT',
      cmds: ['compliment','insult','hack','wasted','ship','simp','flirt','shayari','jail','triggered'] },
    { icon: '⚙️', title: 'SETTINGS',
      cmds: ['welcome','goodbye','setwelcome','setleave','group','bot','prefix','mode'] },
];

const C = {
    bg:      '#060606',
    header:  '#0e0000',
    card:    '#0c0000',
    cardAlt: '#100000',
    border:  '#3d0000',
    borderBright: '#cc0000',
    accent:  '#ff2020',
    accent2: '#cc0000',
    gold:    '#ff6600',
    star:    '#ff3300',
    text:    '#ffdddd',
    muted:   '#aa4444',
    cmd:     '#ffaaaa',
    line:    '#280000',
    green:   '#00ff41',
    dim:     '#0a0000',
    white:   '#ffffff',
    scanline:'#ff000006',
};

function buildCard(section, prefix, W) {
    const PX = 22;
    const PY = 16;
    const CMDH = 34;
    const HDR = 64;
    const H = PY * 2 + HDR + section.cmds.length * CMDH + 10;

    let s = '';

    // card shadow effect
    s += `<rect x="4" y="4" width="${W}" height="${H}" rx="6" fill="#000000" opacity="0.5"/>`;

    // card bg
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="${C.card}" stroke="${C.border}" stroke-width="1.5"/>`;

    // top red bar — thick
    s += `<rect x="0" y="0" width="${W}" height="5" rx="3" fill="${C.accent}"/>`;

    // header bg strip
    s += `<rect x="0" y="0" width="${W}" height="${HDR + PY}" fill="#150000" rx="6"/>`;
    s += `<rect x="0" y="${HDR + PY}" width="${W}" height="2" fill="${C.border}"/>`;

    // section title — big
    s += `<text x="${PX}" y="${PY + 36}" font-family="'Courier New',Consolas,monospace" font-size="22" font-weight="700" fill="${C.accent}">[ ${esc(section.title)} ]</text>`;

    // cmd count badge
    const badge = section.cmds.length + ' cmds';
    s += `<rect x="${W - 85}" y="${PY + 12}" width="72" height="22" rx="11" fill="${C.accent2}" opacity="0.3" stroke="${C.accent2}" stroke-width="1"/>`;
    s += `<text x="${W - 49}" y="${PY + 27}" text-anchor="middle" font-family="'Courier New',monospace" font-size="11" fill="${C.accent}">${esc(badge)}</text>`;

    // commands
    section.cmds.forEach((cmd, i) => {
        const cy = PY + HDR + i * CMDH + 20;
        const rowFill = i % 2 === 0 ? 'transparent' : '#1a0000';
        if (i % 2 !== 0) {
            s += `<rect x="2" y="${cy - 16}" width="${W - 4}" height="${CMDH}" fill="${rowFill}" rx="3"/>`;
        }
        // arrow bullet
        s += `<text x="${PX}" y="${cy}" font-family="'Courier New',monospace" font-size="15" fill="${C.accent2}">&#62;</text>`;
        // command
        s += `<text x="${PX + 18}" y="${cy}" font-family="'Courier New',Consolas,monospace" font-size="16" fill="${C.cmd}">${esc(prefix)}${esc(cmd)}</text>`;
    });

    // bottom border
    s += `<rect x="0" y="${H - 3}" width="${W}" height="3" rx="2" fill="${C.accent2}" opacity="0.4"/>`;

    return { inner: s, height: H };
}

async function generateMenuImage(options = {}) {
    const {
        prefix    = '.',
        botName   = 'Miss Shasikala',
        ownerName = 'Nimesha Madhushan',
        memberName = 'User',
        totalCmds = 150,
        time      = '',
        date      = '',
    } = options;

    const CARD_W = 460;
    const GAP    = 20;
    const COLS   = 2;
    const IMG_W  = COLS * CARD_W + (COLS + 1) * GAP;
    const TOP_H  = 200;
    const FOOT_H = 60;

    const cards  = SECTIONS.map(sec => buildCard(sec, prefix, CARD_W));
    const left   = cards.filter((_, i) => i % 2 === 0);
    const right  = cards.filter((_, i) => i % 2 === 1);
    const colH   = col => col.reduce((s, c) => s + c.height + GAP, 0);
    const BODY_H = Math.max(colH(left), colH(right));
    const IMG_H  = TOP_H + BODY_H + FOOT_H + GAP;
    const CX     = IMG_W / 2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMG_W}" height="${IMG_H}">`;

    // ── background ───────────────────────────────────────────
    svg += `<rect width="${IMG_W}" height="${IMG_H}" fill="${C.bg}"/>`;

    // scanlines
    for (let ly = 0; ly < IMG_H; ly += 3)
        svg += `<line x1="0" y1="${ly}" x2="${IMG_W}" y2="${ly}" stroke="${C.scanline}" stroke-width="1"/>`;

    // ── header ───────────────────────────────────────────────
    svg += `<rect x="0" y="0" width="${IMG_W}" height="${TOP_H}" fill="${C.header}"/>`;

    // header bottom glow lines
    svg += `<rect x="0" y="${TOP_H - 4}" width="${IMG_W}" height="4" fill="${C.accent}"/>`;
    svg += `<rect x="0" y="${TOP_H - 8}" width="${IMG_W}" height="4" fill="${C.accent2}" opacity="0.4"/>`;

    // corner brackets — larger
    const B = [[28, 14], [IMG_W - 28, 14], [28, TOP_H - 14], [IMG_W - 28, TOP_H - 14]];
    const BS = 24;
    [[28,14,1,1],[IMG_W-28,14,-1,1],[28,TOP_H-14,1,-1],[IMG_W-28,TOP_H-14,-1,-1]].forEach(([x,y,dx,dy]) => {
        svg += `<line x1="${x}" y1="${y}" x2="${x + dx*BS}" y2="${y}" stroke="${C.accent}" stroke-width="2.5"/>`;
        svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + dy*BS}" stroke="${C.accent}" stroke-width="2.5"/>`;
    });

    // bot name — very large
    svg += `<text x="${CX}" y="68" text-anchor="middle" font-family="'Courier New',Consolas,monospace" font-size="38" font-weight="700" fill="${C.accent}" letter-spacing="3">[ ${esc(botName)} ]</text>`;

    // tagline
    svg += `<text x="${CX}" y="98" text-anchor="middle" font-family="'Courier New',monospace" font-size="14" fill="${C.muted}" letter-spacing="4">&gt;&gt; SL OFFICIAL BOT 2026 &lt;&lt;</text>`;

    // divider
    svg += `<line x1="60" y1="114" x2="${IMG_W - 60}" y2="114" stroke="${C.border}" stroke-width="1"/>`;

    // info row — large readable text
    svg += `<text x="60" y="144" font-family="'Courier New',monospace" font-size="16" fill="${C.green}">USER: ${esc(memberName)}</text>`;
    svg += `<text x="${CX}" y="144" text-anchor="middle" font-family="'Courier New',monospace" font-size="16" fill="${C.accent}">PREFIX: ${esc(prefix)}</text>`;
    svg += `<text x="${IMG_W - 60}" y="144" text-anchor="end" font-family="'Courier New',monospace" font-size="16" fill="${C.green}">CMDS: ${totalCmds}</text>`;

    svg += `<line x1="60" y1="156" x2="${IMG_W - 60}" y2="156" stroke="${C.border}" stroke-width="1"/>`;

    // owner + time — large
    svg += `<text x="${CX}" y="182" text-anchor="middle" font-family="'Courier New',monospace" font-size="14" fill="${C.muted}">OWNER: ${esc(ownerName)}${time ? `  |  TIME: ${esc(time)}` : ''}${date ? `  |  ${esc(date)}` : ''}</text>`;

    // ── cards ─────────────────────────────────────────────────
    const renderCol = (col, startX) => {
        let y = TOP_H + GAP;
        col.forEach(card => {
            svg += `<g transform="translate(${startX},${y})">${card.inner}</g>`;
            y += card.height + GAP;
        });
    };
    renderCol(left,  GAP);
    renderCol(right, GAP + CARD_W + GAP);

    // ── footer ────────────────────────────────────────────────
    const footY = TOP_H + BODY_H + GAP;
    svg += `<rect x="0" y="${footY}" width="${IMG_W}" height="${FOOT_H}" fill="${C.dim}"/>`;
    svg += `<rect x="0" y="${footY}" width="${IMG_W}" height="2" fill="${C.accent}"/>`;
    svg += `<text x="${CX}" y="${footY + 24}" text-anchor="middle" font-family="'Courier New',monospace" font-size="14" fill="${C.muted}">[ Miss Shasikala Bot  |  Nimesha Madhushan  |  2026 ]</text>`;
    svg += `<text x="${CX}" y="${footY + 46}" text-anchor="middle" font-family="'Courier New',monospace" font-size="12" fill="${C.border}">&gt; Type ${esc(prefix)}help for assistance &lt;</text>`;

    svg += `</svg>`;

    return await sharp(Buffer.from(svg))
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();
}

module.exports = { generateMenuImage };

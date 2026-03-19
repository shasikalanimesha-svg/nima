/**
 * Miss Shasikala Bot — Menu Image Generator
 * Dark hacker red theme
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
    bg:      '#080808',
    header:  '#0f0000',
    card:    '#0d0000',
    border:  '#3a0000',
    accent:  '#ff2222',
    accent2: '#cc0000',
    accent3: '#ff4444',
    gold:    '#ff6600',
    star:    '#ff3300',
    text:    '#ffcccc',
    muted:   '#883333',
    cmd:     '#ff9999',
    line:    '#2a0000',
    green:   '#00ff41',
    dim:     '#1a0000',
};

function buildCard(section, prefix, W) {
    const PX=18, PY=14, CMDH=26, HDR=52;
    const H = PY*2 + HDR + section.cmds.length*CMDH + 8;
    let s = '';

    // card bg
    s += `<rect x="0" y="0" width="${W}" height="${H}" rx="4" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>`;

    // top red bar
    s += `<rect x="0" y="0" width="${W}" height="3" fill="${C.accent}"/>`;

    // left accent line
    s += `<rect x="0" y="3" width="2" height="${H-3}" fill="${C.accent2}"/>`;

    // section title
    const ty = PY+26;
    s += `<text x="${PX+10}" y="${ty}" font-family="Courier New,Consolas,monospace" font-size="15" font-weight="700" fill="${C.accent}">[ ${esc(section.title)} ]</text>`;

    // divider
    s += `<line x1="${PX+10}" y1="${ty+8}" x2="${W-PX}" y2="${ty+8}" stroke="${C.border}" stroke-width="1"/>`;

    // commands
    section.cmds.forEach((cmd, i) => {
        const cy = PY+HDR+i*CMDH+10;
        s += `<text x="${PX+8}" y="${cy}" font-family="Courier New,monospace" font-size="12" fill="${C.accent2}">&gt;</text>`;
        s += `<text x="${PX+22}" y="${cy}" font-family="Courier New,Consolas,monospace" font-size="13" fill="${C.cmd}">${esc(prefix)}${esc(cmd)}</text>`;
    });

    return { inner: s, height: H };
}

async function generateMenuImage(options = {}) {
    const {
        prefix    = '.',
        botName   = 'Miss Shasikala',
        ownerName = 'Nimesha Madhushan',
        memberName= 'User',
        totalCmds = 150,
        time      = '',
        date      = '',
    } = options;

    const CARD_W=390, GAP=14, COLS=2;
    const IMG_W = COLS*CARD_W + (COLS+1)*GAP;
    const TOP_H=148, FOOT_H=48;

    const cards = SECTIONS.map(sec => buildCard(sec, prefix, CARD_W));
    const left  = cards.filter((_,i) => i%2===0);
    const right = cards.filter((_,i) => i%2===1);
    const colH  = col => col.reduce((s,c) => s+c.height+GAP, 0);
    const BODY_H = Math.max(colH(left), colH(right));
    const IMG_H  = TOP_H + BODY_H + FOOT_H + GAP;
    const CX = IMG_W/2;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMG_W}" height="${IMG_H}">`;

    // background
    svg += `<rect width="${IMG_W}" height="${IMG_H}" fill="${C.bg}"/>`;

    // scanline effect (horizontal faint lines)
    for (let ly=0; ly<IMG_H; ly+=4)
        svg += `<line x1="0" y1="${ly}" x2="${IMG_W}" y2="${ly}" stroke="#ff000008" stroke-width="1"/>`;

    // header bg
    svg += `<rect x="0" y="0" width="${IMG_W}" height="${TOP_H}" fill="${C.header}"/>`;

    // header bottom border
    svg += `<rect x="0" y="${TOP_H-2}" width="${IMG_W}" height="2" fill="${C.accent}"/>`;

    // corner brackets
    const bL = 30, bT = 12, bS = 18;
    // top-left
    svg += `<line x1="${bL}" y1="${bT}" x2="${bL+bS}" y2="${bT}" stroke="${C.accent}" stroke-width="2"/>`;
    svg += `<line x1="${bL}" y1="${bT}" x2="${bL}" y2="${bT+bS}" stroke="${C.accent}" stroke-width="2"/>`;
    // top-right
    svg += `<line x1="${IMG_W-bL}" y1="${bT}" x2="${IMG_W-bL-bS}" y2="${bT}" stroke="${C.accent}" stroke-width="2"/>`;
    svg += `<line x1="${IMG_W-bL}" y1="${bT}" x2="${IMG_W-bL}" y2="${bT+bS}" stroke="${C.accent}" stroke-width="2"/>`;
    // bottom-left
    svg += `<line x1="${bL}" y1="${TOP_H-bT}" x2="${bL+bS}" y2="${TOP_H-bT}" stroke="${C.accent}" stroke-width="2"/>`;
    svg += `<line x1="${bL}" y1="${TOP_H-bT}" x2="${bL}" y2="${TOP_H-bT-bS}" stroke="${C.accent}" stroke-width="2"/>`;
    // bottom-right
    svg += `<line x1="${IMG_W-bL}" y1="${TOP_H-bT}" x2="${IMG_W-bL-bS}" y2="${TOP_H-bT}" stroke="${C.accent}" stroke-width="2"/>`;
    svg += `<line x1="${IMG_W-bL}" y1="${TOP_H-bT}" x2="${IMG_W-bL}" y2="${TOP_H-bT-bS}" stroke="${C.accent}" stroke-width="2"/>`;

    // bot name — red hacker style
    svg += `<text x="${CX}" y="46" text-anchor="middle" font-family="Courier New,Consolas,monospace" font-size="26" font-weight="700" fill="${C.accent}">[ ${esc(botName)} ]</text>`;
    svg += `<text x="${CX}" y="68" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="${C.muted}">&gt;&gt; SL OFFICIAL BOT 2026 &lt;&lt;</text>`;

    // divider
    svg += `<line x1="40" y1="80" x2="${IMG_W-40}" y2="80" stroke="${C.border}" stroke-width="1"/>`;

    // info row — green matrix style for data
    svg += `<text x="48" y="102" font-family="Courier New,monospace" font-size="12" fill="${C.green}">USER: ${esc(memberName)}</text>`;
    svg += `<text x="${CX}" y="102" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="${C.accent}">PREFIX: ${esc(prefix)}</text>`;
    svg += `<text x="${IMG_W-48}" y="102" text-anchor="end" font-family="Courier New,monospace" font-size="12" fill="${C.green}">CMDS: ${totalCmds}</text>`;

    svg += `<line x1="40" y1="112" x2="${IMG_W-40}" y2="112" stroke="${C.border}" stroke-width="1"/>`;

    svg += `<text x="${CX}" y="132" text-anchor="middle" font-family="Courier New,monospace" font-size="11" fill="${C.muted}">OWNER: ${esc(ownerName)}${time ? `  |  TIME: ${esc(time)}` : ''}${date ? `  |  ${esc(date)}` : ''}</text>`;

    // cards
    const renderCol = (col, startX) => {
        let y = TOP_H+GAP;
        col.forEach(card => {
            svg += `<g transform="translate(${startX},${y})">${card.inner}</g>`;
            y += card.height+GAP;
        });
    };
    renderCol(left, GAP);
    renderCol(right, GAP+CARD_W+GAP);

    // footer
    const footY = TOP_H+BODY_H+GAP;
    svg += `<rect x="0" y="${footY}" width="${IMG_W}" height="${FOOT_H}" fill="${C.dim}"/>`;
    svg += `<line x1="0" y1="${footY}" x2="${IMG_W}" y2="${footY}" stroke="${C.accent}" stroke-width="1.5"/>`;
    svg += `<text x="${CX}" y="${footY+20}" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="${C.muted}">[ Miss Shasikala Bot | Nimesha Madhushan | 2026 ]</text>`;
    svg += `<text x="${CX}" y="${footY+38}" text-anchor="middle" font-family="Courier New,monospace" font-size="10" fill="${C.border}">&gt; ${esc(prefix)}help for assistance &lt;</text>`;
    svg += `</svg>`;

    return await sharp(Buffer.from(svg))
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();
}

module.exports = { generateMenuImage };

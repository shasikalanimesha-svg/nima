// Generate menu card images on startup
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
            { id:'bot',      title:'බොට් (BOT)',            siTitle:'🤖 බොට් විධාන',          color:'#cc0000',  cmds:['.alive','.bot','.ping','.speed','.runtime','.info','.owner','.vv','.jid','.github','.groupinfo','.staff'] },
            { id:'group',    title:'සමූහ (GROUP)',           siTitle:'👥 සමූහ විධාන',           color:'#9900cc',  cmds:['.tagall','.hidetag','.totag','.add','.kick','.promote','.demote','.warn','.setname','.setdesc','.welcome','.goodbye'] },
            { id:'download', title:'බාගැනීම (DOWNLOAD)',     siTitle:'⬇️ බාගත කිරීම',           color:'#0066cc',  cmds:['.song','.mp3','.play','.ytmp3','.video','.mp4','.ytmp4'] },
            { id:'ai',       title:'AI (කෘතිම බුද්ධිය)',     siTitle:'🤖 AI විධාන',             color:'#00aa44',  cmds:['.gpt','.gemini','.llama3','.ai','.chatai','.imagine','.flux','.sora'] },
            { id:'sticker',  title:'ස්ටිකර් (STICKER)',      siTitle:'🎨 ස්ටිකර් සහ රූප',       color:'#cc6600',  cmds:['.sticker','.s','.simage','.attp','.removebg','.blur','.ss','.tts','.trt'] },
            { id:'fun',      title:'විනෝදය (FUN)',            siTitle:'😂 විනෝදාත්මක',            color:'#cc0066',  cmds:['.joke','.quote','.fact','.8ball','.compliment','.insult','.hack','.ship','.flirt','.shayari'] },
            { id:'games',    title:'ක්‍රීඩා (GAMES)',          siTitle:'🎮 ක්‍රීඩා විධාන',         color:'#006699',  cmds:['.tictactoe','.suit','.chess','.akinator','.slot','.math','.blackjack'] },
            { id:'search',   title:'සෙවුම (SEARCH)',          siTitle:'🔍 සෙවුම් විධාන',          color:'#449900',  cmds:['.google','.ytsearch','.define','.weather','.news','.lyrics','.fact'] },
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

            // ── TITLE ──────────────────────────────────────
            svg += '<rect x="0" y="0" width="' + W + '" height="' + TITLE_H + '" fill="' + cat.color + '" opacity="0.18"/>';
            svg += '<rect x="0" y="0" width="' + W + '" height="5" fill="' + cat.color + '"/>';
            const b=12,bs=16;
            [[b,b,1,1],[W-b,b,-1,1],[b,TITLE_H-b,1,-1],[W-b,TITLE_H-b,-1,-1]].forEach(function(p){
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+(p[0]+p[2]*bs)+'" y2="'+p[1]+'" stroke="'+cat.color+'" stroke-width="2"/>';
                svg += '<line x1="'+p[0]+'" y1="'+p[1]+'" x2="'+p[0]+'" y2="'+(p[1]+p[3]*bs)+'" stroke="'+cat.color+'" stroke-width="2"/>';
            });
            svg += '<text x="' + (W/2) + '" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="' + cat.color + '">' + esc(cat.title) + '</text>';
            svg += '<text x="' + (W/2) + '" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#ffaaaa">' + esc(cat.siTitle) + '</text>';

            // ── BOT INFO ───────────────────────────────────
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

            // ── COMMANDS ───────────────────────────────────
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

            // ── FOOTER ─────────────────────────────────────
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
        console.log('Menu card images generated!');
    } catch(e) {
        console.log('Menu card generation skipped:', e.message);
    }
}
generateMenuCards();
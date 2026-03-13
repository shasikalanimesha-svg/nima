const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec, execSync } = require('child_process');

const statusEmojis = ['❤️', '😍', '🤩', '😘', '🥰', '🤭', '😊', '💕', '✨'];
const messageStore = new Map();
const pendingDownload = new Map();
const TEMP_MEDIA_DIR = path.join(__dirname, './database/temp');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const getRandomEmoji = () => statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
// ══════════════════════════════════════════════════════════════
// 🕐 Auto Delete Helper — text messages විනාඩි 5.5කින් delete
// ══════════════════════════════════════════════════════════════
// countdown seconds
const AUTO_DELETE_SECS = 330;
// countdown edit interval
const COUNTDOWN_INTERVAL = 30;

// seconds → සිංහල කාල text
// format: "⏱️ *මෙම පණිවිඩය මිනිත්තු 5 කින් මැකෙනු ලබයි* (330s)"
function _secsToSinhala(secs) {
    if (secs <= 0) return '🗑️ *මෙම පණිවිඩය මකා දමමින්...*';
    const mins = Math.floor(secs / 60);
    const rem  = secs % 60;
    // human-readable කාල text — minutes only (round)
    let timeStr;
    if (mins > 0 && rem > 0) timeStr = `මිනිත්තු ${mins} යි තත්පර ${rem}`;
    else if (mins > 0)        timeStr = `මිනිත්තු ${mins}`;
    else                      timeStr = `තත්පර ${rem}`;
    return `⏱️ *මෙම පණිවිඩය ${timeStr} කින් මැකෙනු ලබයි* (${secs}s)`;
}

// text message send කර countdown edit + auto delete
async function sendAutoDelete(sock, chat, text, footer, options = {}) {
    try {
        const fullText = `${text}\n${_secsToSinhala(AUTO_DELETE_SECS)}\n${footer}`;
        const sent = await sock.sendMessage(chat, { text: fullText, ...options });
        if (!sent?.key) return sent;

        let remaining = AUTO_DELETE_SECS;

        // countdown interval — 30s වරක් edit
        const interval = setInterval(async () => {
            remaining -= COUNTDOWN_INTERVAL;
            if (remaining <= 0) {
                clearInterval(interval);
                try { await sock.sendMessage(chat, { delete: sent.key }); } catch(e) {}
                return;
            }
            try {
                const updatedText = `${text}\n${_secsToSinhala(remaining)}\n${footer}`;
                await sock.sendMessage(chat, { text: updatedText, edit: sent.key });
            } catch(e) {}
        }, COUNTDOWN_INTERVAL * 1000);

        // safety net — 340s timeout
        setTimeout(async () => {
            clearInterval(interval);
            try { await sock.sendMessage(chat, { delete: sent.key }); } catch(e) {}
        }, (AUTO_DELETE_SECS + 10) * 1000);

        return sent;
    } catch(e) {
        console.log('sendAutoDelete error:', e.message);
    }
}

// edit message countdown update + auto delete (existing key සහිත)
async function editAutoDelete(sock, chat, text, footer, msgKey) {
    try {
        let remaining = AUTO_DELETE_SECS;
        const updatedText = `${text}\n${_secsToSinhala(remaining)}\n${footer}`;
        await sock.sendMessage(chat, { text: updatedText, edit: msgKey });

        const interval = setInterval(async () => {
            remaining -= COUNTDOWN_INTERVAL;
            if (remaining <= 0) {
                clearInterval(interval);
                try { await sock.sendMessage(chat, { delete: msgKey }); } catch(e) {}
                return;
            }
            try {
                const updatedText2 = `${text}\n${_secsToSinhala(remaining)}\n${footer}`;
                await sock.sendMessage(chat, { text: updatedText2, edit: msgKey });
            } catch(e) {}
        }, COUNTDOWN_INTERVAL * 1000);

        setTimeout(async () => {
            clearInterval(interval);
            try { await sock.sendMessage(chat, { delete: msgKey }); } catch(e) {}
        }, (AUTO_DELETE_SECS + 10) * 1000);
    } catch(e) {
        console.log('editAutoDelete error:', e.message);
    }
}
// ══════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════
// Runtime helper
// ════════════════════════════════════════════════
const startTime = Date.now();
function getRuntime() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    return `${h} පැය ${m} මිනිත්තු ${s} තත්පර`;
}

// ════════════════════════════════════════════════
// Multi-method API fetch with fallback
// ════════════════════════════════════════════════
async function tryFetch(methods) {
    for (const method of methods) {
        try {
            const result = await method();
            if (result) return result;
        } catch (e) {
            continue;
        }
    }
    return null;
}

// ════════════════════════════════════════════════
// Translation helper (multi-method)
// ════════════════════════════════════════════════
async function translateText(text, to = 'si', from = 'auto') {
    return await tryFetch([
        // Method 1: MyMemory API
        async () => {
            const r = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`, { timeout: 8000 });
            return r.data?.responseData?.translatedText || null;
        },
        // Method 2: LibreTranslate
        async () => {
            const r = await axios.post('https://libretranslate.com/translate', { q: text, source: from === 'auto' ? 'en' : from, target: to, format: 'text' }, { timeout: 8000 });
            return r.data?.translatedText || null;
        },
        // Method 3: Lingva
        async () => {
            const r = await axios.get(`https://lingva.ml/api/v1/${from === 'auto' ? 'en' : from}/${to}/${encodeURIComponent(text)}`, { timeout: 8000 });
            return r.data?.translation || null;
        }
    ]);
}

// ════════════════════════════════════════════════
// TTS helper (multi-method)
// ════════════════════════════════════════════════
async function ttsGenerate(text, lang = 'si') {
    return await tryFetch([
        // Method 1: Google TTS
        async () => {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
            const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (r.data) return Buffer.from(r.data);
            return null;
        },
        // Method 2: VoiceRSS
        async () => {
            const r = await axios.get(`https://api.voicerss.org/?key=none&hl=${lang}&src=${encodeURIComponent(text)}&f=48khz_16bit_stereo&c=mp3`, { responseType: 'arraybuffer', timeout: 10000 });
            if (r.data) return Buffer.from(r.data);
            return null;
        }
    ]);
}

// ════════════════════════════════════════════════
// Screenshot helper (multi-method)
// ════════════════════════════════════════════════
async function takeScreenshot(url) {
    return await tryFetch([
        async () => {
            const r = await axios.get(`https://api.screenshotmachine.com/?key=demo&url=${encodeURIComponent(url)}&dimension=1024x768&format=jpg`, { responseType: 'arraybuffer', timeout: 20000 });
            return Buffer.from(r.data);
        },
        async () => {
            const r = await axios.get(`https://image.thum.io/get/width/1280/crop/800/${encodeURIComponent(url)}`, { responseType: 'arraybuffer', timeout: 20000 });
            return Buffer.from(r.data);
        },
        async () => {
            const r = await axios.get(`https://api.thumbnail.ws/api/abc123/thumbnail/get?url=${encodeURIComponent(url)}&width=1280`, { responseType: 'arraybuffer', timeout: 20000 });
            return Buffer.from(r.data);
        }
    ]);
}

// ════════════════════════════════════════════════
// Remove BG helper (multi-method)
// ════════════════════════════════════════════════
async function removeBackground(imageBuffer) {
    return await tryFetch([
        async () => {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('image_file', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
            form.append('size', 'auto');
            const r = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
                headers: { ...form.getHeaders(), 'X-Api-Key': 'demo' },
                responseType: 'arraybuffer', timeout: 30000
            });
            return Buffer.from(r.data);
        },
        async () => {
            const base64 = imageBuffer.toString('base64');
            const r = await axios.post('https://www.ailabapi.com/api/cutout/general-cutout', 
                { image: base64 },
                { headers: { 'ailabapi-api-key': 'demo' }, timeout: 20000 });
            if (r.data?.data?.image) return Buffer.from(r.data.data.image, 'base64');
            return null;
        }
    ]);
}

// ════════════════════════════════════════════════
// Text art/image helper (multi-method)
// ════════════════════════════════════════════════
async function textToArt(text, style = 'neon') {
    return await tryFetch([
        async () => {
            const r = await axios.get(`https://api.paxsenix.biz.id/text-effect/${style}?text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(r.data);
        },
        async () => {
            const r = await axios.get(`https://api.lolhuman.xyz/api/teks/${style}?apikey=demo&text=${encodeURIComponent(text)}`, { responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(r.data);
        },
        async () => {
            const r = await axios.get(`https://some-random-api.com/canvas/misc/oogway?quote=${encodeURIComponent(text)}`, { responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(r.data);
        }
    ]);
}

// ════════════════════════════════════════════════
// AI text helper (multi-method)
// ════════════════════════════════════════════════
async function aiQuery(query, model = 'gpt') {
    return await tryFetch([
        // Method 1: OpenAI-compatible free endpoint
        async () => {
            const r = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: query }]
            }, { headers: { Authorization: 'Bearer demo' }, timeout: 15000 });
            return r.data?.choices?.[0]?.message?.content || null;
        },
        // Method 2: Groq API (free)
        async () => {
            const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: model === 'llama3' ? 'llama3-8b-8192' : 'mixtral-8x7b-32768',
                messages: [{ role: 'user', content: query }]
            }, { headers: { Authorization: 'Bearer demo' }, timeout: 15000 });
            return r.data?.choices?.[0]?.message?.content || null;
        },
        // Method 3: Free API scrapers
        async () => {
            const r = await axios.get(`https://api.paxsenix.biz.id/ai/gpt4?text=${encodeURIComponent(query)}`, { timeout: 15000 });
            return r.data?.message || r.data?.result || r.data?.response || null;
        },
        // Method 4: Another free endpoint
        async () => {
            const r = await axios.post('https://api.mandarinhut.com/api/gpt', 
                { message: query }, { timeout: 15000 });
            return r.data?.reply || null;
        }
    ]);
}

// ════════════════════════════════════════════════
// Music Downloader Class (unchanged from before)
// ════════════════════════════════════════════════
class MusicDownloader {
    constructor() {
        this.tempDir = TEMP_MEDIA_DIR;
        this.timeout = 120000;
    }

    async downloadMp3(input, progressCallback = null) {
        const methods = [
            { name: 'yt-dlp (default)', cmd: () => `yt-dlp -x --audio-format mp3 --audio-quality 0 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (android)', cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (web)', cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=web" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (ios)', cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=ios" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (android_music)', cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android_music" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (best)', cmd: () => `yt-dlp -f bestaudio -x --audio-format mp3 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'yt-dlp (m4a->mp3)', cmd: () => `yt-dlp -x --audio-format mp3 --audio-quality 192 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'youtube-dl', cmd: () => `youtube-dl -x --audio-format mp3 --audio-quality 0 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null` },
            { name: 'ytdl-core', cmd: () => this._ytdlCore(input) },
            { name: 'cobalt-api', cmd: () => this._cobaltApi(input) },
            { name: 'invidious-api', cmd: () => this._invidiousApi(input) },
            { name: 'rapidapi-mp36', cmd: () => this._rapidApiMp36(input) },
            { name: 'yt1s', cmd: () => this._yt1s(input) },
            { name: 'loader.to', cmd: () => this._loaderTo(input) },
            { name: 'savefrom', cmd: () => this._savefrom(input) },
            { name: 'cnvmp3', cmd: () => this._cnvMp3(input) },
        ];
        return this._tryMethods(methods, input, progressCallback);
    }

    async _ytdlCore(url) {
        return new Promise((resolve, reject) => {
            try {
                const ytdl = require('@distube/ytdl-core');
                const ffmpeg = require('fluent-ffmpeg');
                ytdl.getInfo(url, { requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } })
                    .then(info => {
                        const stream = ytdl.downloadFromInfo(info, { quality: 'highestaudio' });
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        ffmpeg(stream).audioBitrate(128).format('mp3').save(audioPath)
                            .on('end', () => { if (fs.existsSync(audioPath)) resolve(audioPath); else reject(new Error('File not created')); })
                            .on('error', reject);
                    }).catch(reject);
            } catch (err) { reject(err); }
        });
    }

    async searchAndDownload(query, progressCallback = null) {
        try {
            const YtSearch = require('yt-search');
            const result = await YtSearch(query);
            if (result && result.videos && result.videos.length > 0) {
                const url = `https://www.youtube.com/watch?v=${result.videos[0].videoId}`;
                return this.downloadMp3(url, progressCallback);
            }
            throw new Error('YouTube ප්‍රතිදල හමු නොළිණී');
        } catch (err) { throw err; }
    }

    async downloadByUrl(url, progressCallback = null) {
        return this.downloadMp3(url, progressCallback);
    }

    _getVideoId(url) {
        return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&\n?#]+)/)?.[1] || null;
    }

    async _downloadUrlToFile(dlUrl) {
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const filePath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
        const res = await (await fetch)(dlUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buf);
        return filePath;
    }

    async _cobaltApi(url) {
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const fetchFn = await fetch;
        const allInst = ['https://api.cobalt.tools', 'https://cobalt.oisd.nl'];
        for (const inst of allInst) {
            try {
                const r = await fetchFn(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }), signal: AbortSignal.timeout(12000) });
                const d = await r.json();
                if (d?.url) return await this._downloadUrlToFile(d.url);
            } catch {}
        }
        throw new Error('cobalt: all failed');
    }

    async _invidiousApi(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const instances = ['https://inv.nadeko.net', 'https://invidious.privacyredirect.com'];
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const fetchFn = await fetch;
        for (const inst of instances) {
            try {
                const r = await fetchFn(`${inst}/api/v1/videos/${videoId}?fields=adaptiveFormats`, { signal: AbortSignal.timeout(8000) });
                const d = await r.json();
                const fmt = (d.adaptiveFormats || []).filter(f => f.type?.includes('audio')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                if (fmt?.url) return await this._downloadUrlToFile(fmt.url.replace(/^https:\/\/[^/]+/, inst));
            } catch {}
        }
        throw new Error('invidious: all failed');
    }

    async _rapidApiMp36(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const RAPID_KEY = '3bde5a3ca1msh6a3c2e0e02d1fdap142e7bjsn8f5a2e0e3c4a';
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, { headers: { 'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(30000) });
        const d = await r.json();
        if (!d?.link) throw new Error('no link');
        return await this._downloadUrlToFile(d.link);
    }

    async _yt1s(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const fetchFn = await fetch;
        const r1 = await fetchFn('https://yt1s.com/api/ajaxSearch/index', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ q: `https://www.youtube.com/watch?v=${videoId}`, vt: 'mp3' }), signal: AbortSignal.timeout(15000) });
        const d1 = await r1.json();
        const kId = d1?.links?.mp3?.mp3128?.k;
        if (!kId) throw new Error('no key');
        const r2 = await fetchFn('https://yt1s.com/api/ajaxConvert/convert', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ vid: videoId, k: kId }), signal: AbortSignal.timeout(30000) });
        const d2 = await r2.json();
        if (!d2?.dlink) throw new Error('no link');
        return await this._downloadUrlToFile(d2.dlink);
    }

    async _loaderTo(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const fetchFn = await fetch;
        const r = await fetchFn(`https://loader.to/ajax/download.php?format=mp3&url=https://www.youtube.com/watch?v=${videoId}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
        const d = await r.json();
        if (!d?.success || !d?.id) throw new Error('no id');
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const r2 = await fetchFn(`https://loader.to/ajax/progress.php?id=${d.id}`, { signal: AbortSignal.timeout(10000) });
            const d2 = await r2.json();
            if (d2?.download_url) return await this._downloadUrlToFile(d2.download_url);
        }
        throw new Error('loader.to timeout');
    }

    async _savefrom(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://worker.sf-tools.com/savefrom.php?sf_url=https://www.youtube.com/watch?v=${videoId}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        const link = d?.url?.[0]?.url || d?.url;
        if (!link) throw new Error('no link');
        return await this._downloadUrlToFile(link);
    }

    async _cnvMp3(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://cnvmp3.com/api.php?url=https://www.youtube.com/watch?v=${videoId}&format=mp3&quality=128`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cnvmp3.com/' }, signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        if (!d?.url) throw new Error('no link');
        return await this._downloadUrlToFile(d.url);
    }

    async _tryMethods(methods, input = '', progressCallback = null) {
        const attempts = [];
        const total = methods.length;
        for (let i = 0; i < methods.length; i++) {
            const method = methods[i];
            const num = i + 1;
            try {
                let cmd = typeof method.cmd === 'function' ? await method.cmd() : method.cmd;
                if (typeof cmd === 'string' && cmd.startsWith('/')) {
                    if (fs.existsSync(cmd)) {
                        if (progressCallback) await progressCallback(num, method.name, true, total);
                        return { success: true, method: method.name, filePath: cmd, fileName: path.basename(cmd) };
                    }
                    attempts.push({ method: method.name, success: false });
                    if (progressCallback) await progressCallback(num, method.name, false, total);
                    continue;
                }
                if (typeof cmd === 'string') await this._exec(cmd);
                const files = fs.readdirSync(this.tempDir);
                const audioFile = files.find(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'));
                if (audioFile) {
                    const filePath = path.join(this.tempDir, audioFile);
                    if (progressCallback) await progressCallback(num, method.name, true, total);
                    return { success: true, method: method.name, filePath, fileName: audioFile };
                }
                attempts.push({ method: method.name, success: false });
                if (progressCallback) await progressCallback(num, method.name, false, total);
            } catch (err) {
                attempts.push({ method: method.name, success: false, error: err.message });
                if (progressCallback) await progressCallback(num, method.name, false, total);
            }
        }
        return { success: false, error: 'සියලුම ක්‍රම අසාර්ථකයි', attempts };
    }

    _exec(cmd) {
        return new Promise((resolve, reject) => {
            exec(cmd, { maxBuffer: 1024 * 1024 * 500, timeout: this.timeout, shell: '/bin/bash' }, (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout);
            });
        });
    }

    cleanTemp() {
        try {
            const files = fs.readdirSync(this.tempDir);
            let size = 0;
            for (const file of files) { const stat = fs.statSync(path.join(this.tempDir, file)); size += stat.size; }
            if (size > 100 * 1024 * 1024) { for (const file of files) { fs.unlinkSync(path.join(this.tempDir, file)); } }
        } catch (err) { console.error('Cleanup error:', err); }
    }
}

const musicDownloader = new MusicDownloader();

// ════════════════════════════════════════════════
// Sticker maker helper
// ════════════════════════════════════════════════
async function makeSticker(mediaBuffer, mime = 'image/jpeg', pack = 'SHASIKALA BOT', author = 'Nimesha') {
    const { Sticker, StickerTypes } = require('wa-sticker-formatter');
    const sticker = new Sticker(mediaBuffer, {
        pack, author,
        type: StickerTypes.FULL,
        categories: ['🤩', '🎉'],
        id: '12345',
        quality: 50,
        background: '#00000000'
    });
    return await sticker.toBuffer();
}

// ════════════════════════════════════════════════
// APK downloader (multi-method)
// ════════════════════════════════════════════════
async function downloadApk(appName) {
    return await tryFetch([
        async () => {
            const r = await axios.get(`https://api.paxsenix.biz.id/dl/apk?name=${encodeURIComponent(appName)}`, { timeout: 20000 });
            return r.data?.link || r.data?.url || null;
        },
        async () => {
            const r = await axios.get(`https://apkpure.com/search-page?q=${encodeURIComponent(appName)}&t=app&region=us`, { 
                headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 
            });
            const match = r.data?.match(/href="(\/[^"]+\/download)"/);
            if (match) return `https://apkpure.com${match[1]}`;
            return null;
        }
    ]);
}

// ════════════════════════════════════════════════
// Anime GIF helper (multi-method)
// ════════════════════════════════════════════════
async function getAnimeGif(action) {
    return await tryFetch([
        async () => {
            const r = await axios.get(`https://nekos.best/api/v2/${action}`, { timeout: 8000 });
            return r.data?.results?.[0]?.url || null;
        },
        async () => {
            const r = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${action}`, { timeout: 8000 });
            return r.data?.url || null;
        },
        async () => {
            const r = await axios.get(`https://nekosia.cat/api/v1/images/${action}`, { timeout: 8000 });
            return r.data?.image?.original?.url || null;
        }
    ]);
}

// ════════════════════════════════════════════════
// Misc image generators (multi-method)
// ════════════════════════════════════════════════
async function getMiscImage(type, params = {}) {
    return await tryFetch([
        async () => {
            const base = 'https://api.paxsenix.biz.id';
            const endpoints = {
                tweet: `${base}/tools/tweet?username=${params.username || 'User'}&tweet=${encodeURIComponent(params.text || '')}`,
                ytcomment: `${base}/tools/ytcomment?username=${params.username || 'User'}&comment=${encodeURIComponent(params.text || '')}`,
                jail: `${base}/overlay/jail?image=${params.imageUrl || ''}`,
                triggered: `${base}/overlay/triggered?image=${params.imageUrl || ''}`,
                wasted: `${base}/overlay/wasted?image=${params.imageUrl || ''}`,
                ship: `${base}/tools/ship?user1=${params.user1 || ''}&user2=${params.user2 || ''}`,
                namecard: `${base}/tools/namecard?name=${params.name || ''}&subtitle=${params.subtitle || ''}`,
                oogway: `${base}/canvas/oogway?quote=${encodeURIComponent(params.text || '')}`,
            };
            if (!endpoints[type]) return null;
            const r = await axios.get(endpoints[type], { responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(r.data);
        },
        async () => {
            const base = 'https://some-random-api.com';
            const endpoints = {
                tweet: `${base}/canvas/misc/tweet?username=${params.username || 'User'}&avatar=${params.avatarUrl || ''}&displayname=${params.username || 'User'}&comment=${encodeURIComponent(params.text || '')}`,
                jail: `${base}/canvas/overlay/jail?avatar=${params.imageUrl || ''}`,
                triggered: `${base}/canvas/overlay/triggered?avatar=${params.imageUrl || ''}`,
                wasted: `${base}/canvas/overlay/wasted?avatar=${params.imageUrl || ''}`,
                ship: `${base}/canvas/misc/ship?user1=${params.user1 || ''}&user2=${params.user2 || ''}`,
                oogway: `${base}/canvas/misc/oogway?quote=${encodeURIComponent(params.text || '')}`,
            };
            if (!endpoints[type]) return null;
            const r = await axios.get(endpoints[type], { responseType: 'arraybuffer', timeout: 15000 });
            return Buffer.from(r.data);
        }
    ]);
}

async function storeMessage(message) {
    try {
        if (!message.key?.id) return;
        const messageId = message.key.id;
        let content = '';
        const sender = message.key.participant || message.key.remoteJid;
        if (message.message?.conversation) content = message.message.conversation;
        else if (message.message?.extendedTextMessage?.text) content = message.message.extendedTextMessage.text;
        messageStore.set(messageId, { content, sender, group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null, timestamp: new Date().toISOString() });
    } catch (err) { console.error('Message store error:', err); }
}

// ════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════
module.exports = shasikala = async (nimesha, m, msg, store) => {
    try {
        const botNumber = nimesha.decodeJid(nimesha.user.id);
        const set = global.db?.set?.[botNumber] || {};
        const botFooter = global.db?.set?.[botNumber]?.botname
            ? `> 🌸 *${global.db.set[botNumber].botname}* [MINI BOT]✨`
            : global.mess?.footer || '> 🌸 *MISS SHASIKALA* [MINI BOT]✨ | 👑 _NIMESHA MADHUSHAN_';
        const prefix = m.prefix || '.';

        // ══════════════════════════════════════════════════════════════
        // 🛑 BOT OWN MESSAGES FILTER — edit/protocol messages skip
        // bot ගෙ own edited messages process කළොත් timer loop එකක් හැදෙනවා
        // ══════════════════════════════════════════════════════════════
        const msgType = m.type || '';
        // bot ගෙ edit message, protocol message, status — skip
        if (m.fromMe && /editedMessage|protocolMessage|reactionMessage/i.test(msgType)) return;
        // bot ගෙ own non-command messages — skip (countdown edit messages)
        if (m.fromMe && !m.isGroup) {
            const bodyText = (m.body || m.text || '').trim();
            // prefix නැති bot messages skip (countdown edits, ok sir replies, etc.)
            if (!bodyText.startsWith(prefix)) return;
        }

        // ══════════════════════════════════════════════════════════════
        // 🔒 GROUP ONLY + PRIVATE REDIRECT + USER MSG AUTO DELETE
        // ══════════════════════════════════════════════════════════════

        // group invite link — QR code generate සඳහා
        const GROUP_INVITE_LINK = 'https://chat.whatsapp.com/HLBP338VvUC0ms5NqCkSSO?mode=hq2tcla';

        // command එකක්ද check
        const isCmd = (m.body || m.text || '').trim().startsWith(prefix);

        // owner number check — fromMe නොව explicit owner number compare
        // self-mode හි සෑම message එකම fromMe=true — ඒ නිසා owner number direct compare
        const senderNum = (m.sender || '').split('@')[0].replace(/[^0-9]/g, '');
        const ownerNums = (global.owner || []).map(n => n.replace(/[^0-9]/g, ''));
        const isOwnerMsg = ownerNums.includes(senderNum);

        // "Message yourself" chat detect — bot number = chat number
        const isSelfChat = !m.isGroup && (m.chat === (m.sender || ''));

        if (isCmd && !isOwnerMsg && !isSelfChat) {
            if (!m.isGroup) {
                // ══════════════════════════════════════════
                // Private chat — group redirect message + QR
                // ══════════════════════════════════════════
                // ══════════════════════════════════════════
                // Private redirect — QR image + countdown text
                // image caption edit කරන්නට WA allow නෑ
                // ඒ නිසා image වෙනමයි, countdown text message වෙනමයි
                // ══════════════════════════════════════════

                // seconds → සිංහල කාල text (private redirect සඳහා — 10 min)
                const _privSecs = (secs) => {
                    if (secs <= 0) return '🗑️ *මකා දමමින්...*';
                    const pm = Math.floor(secs / 60), ps = secs % 60;
                    if (pm > 0 && ps > 0) return `⏱️ *මිනිත්තු ${pm}යි තත්පර ${ps}කින් මකා දමනු ලැබේ*`;
                    if (pm > 0) return `⏱️ *මිනිත්තු ${pm}කින් මකා දමනු ලැබේ*`;
                    return `⏱️ *තත්පර ${ps}කින් මකා දමනු ලැබේ*`;
                };

                // redirect message body — countdown line footer ට උඩින්
                const _privMsgBody = (secs) => `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃   🌸 *MISS SHASIKALA BOT* ✨   ┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

සුභ දවසක් 🙏 ආයුබෝවන්!

⚠️ *ඔබ Private Chat හි bot command දෙමින් සිටී*

╔═══════════════════════╗
║  🤖 *Bot ක්‍රියා කරන්නේ*     ║
║  *Group Chat හිදී පමණි!* ║
╚═══════════════════════╝

📱 *අපගේ Official Group එකට සම්බන්ධ වන්න:*
👆 *ඉහළ QR Code Scan කරන්න* නැත්නම්
🔗 ${GROUP_INVITE_LINK}

━━━━━━━━━━━━━━━━━━━━━━
✨ Group එකේදී bot සියලු features
   භාවිත කළ හැකිය!
━━━━━━━━━━━━━━━━━━━━━━
${_privSecs(secs)}
${botFooter}`;

                try {
                    // QR code image generate කරනවා — group link සඳහා
                    const QRCode = require('qrcode');
                    const qrBuffer = await QRCode.toBuffer(GROUP_INVITE_LINK, {
                        type: 'png',
                        width: 512,
                        margin: 2,
                        color: { dark: '#075E54', light: '#FFFFFF' }  // WhatsApp green රඟ
                    });

                    // QR image send — caption නෑ (caption edit කරන්නට WA allow නෑ)
                    await nimesha.sendMessage(m.chat, { image: qrBuffer }, { quoted: m });
                } catch (qrErr) {
                    // QR generate fail — log කරනවා, text message continue
                    console.log('QR generate error:', qrErr.message);
                }

                // countdown text message — edit + delete සඳහා
                const privMsg = await nimesha.sendMessage(m.chat, {
                    text: _privMsgBody(600)
                });

                // 10 min countdown — 60s interval edit
                let privRem = 600;
                const privTimer = setInterval(async () => {
                    privRem -= 60;
                    if (privRem <= 0) {
                        clearInterval(privTimer);
                        try { await nimesha.sendMessage(m.chat, { delete: privMsg.key }); } catch(e) {}
                        return;
                    }
                    try {
                        await nimesha.sendMessage(m.chat, {
                            text: _privMsgBody(privRem),
                            edit: privMsg.key
                        });
                    } catch(e) {}
                }, 60 * 1000);

                // safety timeout — 610s
                setTimeout(async () => {
                    clearInterval(privTimer);
                    try { await nimesha.sendMessage(m.chat, { delete: privMsg.key }); } catch(e) {}
                }, 610 * 1000);
                // private blocked flag — nima.js ද block වෙන්නට
                if (!global._privateBlocked) global._privateBlocked = new Set();
                global._privateBlocked.add(m.key.id);
                return;
            }

            // ══════════════════════════════════════════
            // Group chat — bot admin check
            // (warning දෙන්නෙ නෑ — commands silent ignore)
            // ══════════════════════════════════════════
            if (!m.isBotAdmin) return;

            // bot admin ඇත — user command message 330s පසු silent delete
            const userMsgKey = m.key;
            setTimeout(async () => {
                try { await nimesha.sendMessage(m.chat, { delete: userMsgKey }); } catch(e) {}
            }, AUTO_DELETE_SECS * 1000);

        } else if (isCmd && isOwnerMsg && m.isGroup) {
            // owner group command — user message 330s delete
            const userMsgKey = m.key;
            setTimeout(async () => {
                try { await nimesha.sendMessage(m.chat, { delete: userMsgKey }); } catch(e) {}
            }, AUTO_DELETE_SECS * 1000);
        }
        // ══════════════════════════════════════════════════════════════

        const moment = require('moment-timezone');
        const tanggal = moment.tz('Asia/Colombo').format('DD/MM/YYYY');
        const jam = moment.tz('Asia/Colombo').format('HH:mm:ss');

        // ══════════════════════════════════════════
        // PENDING DOWNLOAD CHOICE HANDLER
        // ══════════════════════════════════════════
        const rawBody = (m.body || m.text || '').trim();
        if (/^[123456]$/.test(rawBody) && pendingDownload.has(m.sender)) {
            const choice = rawBody;
            const pending = pendingDownload.get(m.sender);
            pendingDownload.delete(m.sender);

            if (pending.type === 'song') {
                const formatNames = { '1': 'Audio 🎵', '2': 'හඬ සටහන 🎤', '3': 'ලිපිගොනු 📄' };
                const statusKey = pending.statusKey;  // searching message key
                const buttonKey = pending.buttonKey;  // select button message key

                // Step 2→3: button msg DELETE + searching msg → Downloading edit
                if (buttonKey) { try { await nimesha.sendMessage(m.chat, { delete: buttonKey }); } catch(e) {} }
                await nimesha.sendMessage(m.chat, { text: `⬇️ *බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${pending.displayTitle}\n🎶 *ආකෘතිය:* ${formatNames[choice]}\n⏳ YouTube සම්බන්ධ කරමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: statusKey });
                const statusMsg = { key: statusKey };
                try {
                    let downloadResult;
                    if (pending.url && pending.url.match(/https?:\/\//)) { downloadResult = await musicDownloader.downloadByUrl(pending.url); }
                    else { downloadResult = await musicDownloader.searchAndDownload(pending.input); }
                    if (!downloadResult || !downloadResult.success) {
                        await editAutoDelete(nimesha, m.chat, `❌ *බාගැනීම අසාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 ${pending.displayTitle}\n⚠️ ${downloadResult?.error || 'Error'}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, statusMsg.key);
                        return;
                    }
                    // Step 4: Downloading → Uploading edit
                    await nimesha.sendMessage(m.chat, { text: `📤 *උඩුගත කරමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${pending.displayTitle}\n🎶 *ආකෘතිය:* ${formatNames[choice]}\n⏳ WhatsApp වෙත යවමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: statusMsg.key });
                    // Step 5: Send media
                    const audioBuffer = fs.readFileSync(downloadResult.filePath);
                    const mediaCaption = `🎵 *${pending.displayTitle}*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`;
                    if (choice === '1') {
                        await nimesha.sendMessage(m.chat, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false, fileName: `${pending.displayTitle.substring(0, 40)}.mp3`, contextInfo: { externalAdReply: { title: pending.displayTitle, body: '🎵 Miss Shasikala Bot', renderLargerThumbnail: false } } }, { quoted: m });
                    } else if (choice === '2') {
                        await nimesha.sendMessage(m.chat, { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
                    } else if (choice === '3') {
                        await nimesha.sendMessage(m.chat, { document: audioBuffer, mimetype: 'audio/mpeg', fileName: `${pending.displayTitle.substring(0, 40)}.mp3`, caption: mediaCaption }, { quoted: m });
                    }
                    // Step 6: Uploading → Done edit
                    await editAutoDelete(nimesha, m.chat, `✅ *සාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${pending.displayTitle}\n🎶 *ආකෘතිය:* ${formatNames[choice]}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, statusMsg.key);
                    try { fs.unlinkSync(downloadResult.filePath); } catch (e) {}
                } catch (err) { await editAutoDelete(nimesha, m.chat, `❌ *දෝෂයකි!*\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ ${err.message.substring(0, 150)}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, statusMsg.key); }
            }

            if (pending.type === 'video') {
                const qualityMap = { '1': '144', '2': '360', '3': '720', '4': '144', '5': '360', '6': '720' };
                const isDoc = ['4', '5', '6'].includes(choice);
                const quality = qualityMap[choice];
                const statusKey = pending.statusKey;  // searching message key
                const buttonKey = pending.buttonKey;  // select button message key

                // Step 2→3: button msg DELETE + searching msg → Downloading edit
                if (buttonKey) { try { await nimesha.sendMessage(m.chat, { delete: buttonKey }); } catch(e) {} }
                await nimesha.sendMessage(m.chat, { text: `⬇️ *වීඩියෝ බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *තත්ත්වය:* ${quality}p${isDoc ? ' (Document)' : ''}\n⏳ ගොනුව ලබාගනිමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: statusKey });
                const statusMsg = { key: statusKey };
                try {
                    const outputPath = path.join(TEMP_MEDIA_DIR, `video_${Date.now()}.mp4`);
                    const qualityFilter = quality === '144' ? 'bestvideo[height<=144]+bestaudio/worst' : quality === '360' ? 'bestvideo[height<=360]+bestaudio/best[height<=360]' : 'bestvideo[height<=720]+bestaudio/best[height<=720]';
                    await new Promise((res, rej) => { exec(`yt-dlp -f "${qualityFilter}" --merge-output-format mp4 --no-playlist -o "${outputPath}" "${pending.url}"`, (err, stdout, stderr) => { if (err) return rej(new Error(stderr || err.message)); res(); }); });
                    // Step 4: Downloading → Uploading edit
                    await nimesha.sendMessage(m.chat, { text: `📤 *උඩුගත කරමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *තත්ත්වය:* ${quality}p${isDoc ? ' (Document)' : ''}\n⏳ WhatsApp වෙත යවමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: statusMsg.key });
                    // Step 5: Send media
                    const videoBuffer = fs.readFileSync(outputPath);
                    try { fs.unlinkSync(outputPath); } catch (e) {}
                    const vidCaption = `🎬 *${pending.displayTitle}*\n📺 *Quality:* ${quality}p\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`;
                    const vidDocCaption = `🎬 *${pending.displayTitle}*\n📺 *Quality:* ${quality}p (Document)\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`;
                    if (isDoc) {
                        await nimesha.sendMessage(m.chat, { document: videoBuffer, mimetype: 'video/mp4', fileName: `${pending.displayTitle.substring(0, 40)}.mp4`, caption: vidDocCaption }, { quoted: m });
                    } else {
                        await nimesha.sendMessage(m.chat, { video: videoBuffer, caption: vidCaption }, { quoted: m });
                    }
                    // Step 6: Uploading → Done edit
                    await editAutoDelete(nimesha, m.chat, `✅ *සාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *Quality:* ${quality}p${isDoc ? ' (Document)' : ''}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, statusMsg.key);
                } catch (err) { await editAutoDelete(nimesha, m.chat, `❌ *වීඩියෝ දෝෂයකි!*\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ ${err.message.substring(0, 150)}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, statusMsg.key); }
            }
            return;
        }

        const cmd = m.command;
        const args = m.args || [];
        const text = args.join(' ').trim();
        const q = text;

        // ══════════════════════════════════════════════════════
        // ════════ GENERAL COMMANDS ════════════════════════════
        // ══════════════════════════════════════════════════════

        // .alive / .bot
        if (cmd === 'alive' || cmd === 'bot') {
            const aliveText = `╔══════════════════════╗\n║  🌸 *MISS SHASIKALA BOT* 🌸  ║\n╚══════════════════════╝\n\n✅ *බොට් ක්‍රියාත්මකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n📅 *දිනය:* ${tanggal}\n🕐 *වෙලාව:* ${jam}\n⏱️ *Uptime:* ${getRuntime()}\n🤖 *Bot:* ${set?.botname || 'Miss Shasikala'}\n👑 *Owner:* Nimesha Madhushan\n🔧 *Prefix:* ${prefix}\n📡 *Status:* Online ✅\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`;
            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Menu', id: `${prefix}menu` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ Speed', id: `${prefix}speed` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📊 Runtime', id: `${prefix}runtime` }) }
            ];
            await nimesha.sendListMsg(m.chat, { text: aliveText, footer: `© MISS SHASIKALA MINI BOT`, mentions: [m.sender], buttons }, { quoted: m });
        }

        // .ping
        else if (cmd === 'ping') {
            const start = Date.now();
            const pingMsg = await nimesha.sendMessage(m.chat, { text: '🏓 *Ping...*' }, { quoted: m });
            const pingTime = Date.now() - start;
            await editAutoDelete(nimesha, m.chat, `🏓 *PONG!*\n━━━━━━━━━━━━━━━━━━━━━━\n⚡ *Response:* ${pingTime}ms\n📡 *Status:* ${pingTime < 500 ? '🟢 Excellent' : pingTime < 1000 ? '🟡 Good' : '🔴 Slow'}\n⏱️ *Uptime:* ${getRuntime()}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, pingMsg.key);
        }

        // .runtime / .uptime
        else if (cmd === 'runtime' || cmd === 'uptime') {
            await sendAutoDelete(nimesha, m.chat, `⏱️ *BOT RUNTIME*\n━━━━━━━━━━━━━━━━━━━━━━\n🚀 *ක්‍රියාත්මක වූ කාලය:*\n${getRuntime()}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .info / .owner / .dev
        else if (cmd === 'info' || cmd === 'owner' || cmd === 'dev') {
            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Menu', id: `${prefix}menu` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '✅ Alive', id: `${prefix}alive` }) }
            ];
            await nimesha.sendListMsg(m.chat, {
                text: `╔══════════════════════╗\n║  🌸 *BOT INFORMATION* 🌸  ║\n╚══════════════════════╝\n\n🤖 *Bot Name:* ${set?.botname || 'Miss Shasikala'}\n👑 *Owner:* Nimesha Madhushan\n📱 *Platform:* WhatsApp\n🔧 *Prefix:* ${prefix}\n📅 *Date:* ${tanggal}\n🕐 *Time:* ${jam}\n⏱️ *Uptime:* ${getRuntime()}\n🌐 *GitHub:* https://github.com/nimesha206/nimabw\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                footer: `© MISS SHASIKALA MINI BOT`, mentions: [m.sender], buttons
            }, { quoted: m });
        }

        // .joke
        else if (cmd === 'joke') {
            const jokeMsg = await nimesha.sendMessage(m.chat, { text: `😂 *Joke ගනිමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const joke = await tryFetch([
                async () => { const r = await axios.get('https://v2.jokeapi.dev/joke/Any?type=twopart&blacklistFlags=nsfw,racist,sexist', { timeout: 8000 }); return r.data?.setup ? `😂 *${r.data.setup}*\n\n${r.data.delivery}` : null; },
                async () => { const r = await axios.get('https://official-joke-api.appspot.com/jokes/random', { timeout: 8000 }); return r.data?.setup ? `😂 *${r.data.setup}*\n\n${r.data.punchline}` : null; }
            ]);
            await nimesha.sendMessage(m.chat, { text: joke ? `${joke}\n\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ Joke ලබා ගැනීමට නොහැකිය\n${botFooter}`, edit: jokeMsg.key });
        }

        // .quote
        else if (cmd === 'quote') {
            const quoteMsg = await nimesha.sendMessage(m.chat, { text: `💬 *Quote ගනිමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const quote = await tryFetch([
                async () => { const r = await axios.get('https://api.quotable.io/random', { timeout: 8000 }); return r.data?.content ? `💬 *"${r.data.content}"*\n\n— _${r.data.author}_` : null; },
                async () => { const r = await axios.get('https://zenquotes.io/api/random', { timeout: 8000 }); return r.data?.[0]?.q ? `💬 *"${r.data[0].q}"*\n\n— _${r.data[0].a}_` : null; }
            ]);
            await nimesha.sendMessage(m.chat, { text: quote ? `${quote}\n\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ Quote ලබා ගැනීමට නොහැකිය\n${botFooter}`, edit: quoteMsg.key });
        }

        // .fact
        else if (cmd === 'fact') {
            const factMsg = await nimesha.sendMessage(m.chat, { text: `💡 *Fact ගනිමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const fact = await tryFetch([
                async () => { const r = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 8000 }); return r.data?.text || null; },
                async () => { const r = await axios.get('https://api.api-ninjas.com/v1/facts?limit=1', { headers: { 'X-Api-Key': 'demo' }, timeout: 8000 }); return r.data?.[0]?.fact || null; },
                async () => { const r = await axios.get('https://catfact.ninja/fact', { timeout: 8000 }); return r.data?.fact || null; }
            ]);
            await nimesha.sendMessage(m.chat, { text: fact ? `💡 *Interesting Fact!*\n━━━━━━━━━━━━━━━━━━━━━━\n${fact}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ Fact ලබා ගැනීමට නොහැකිය\n${botFooter}`, edit: factMsg.key });
        }

        // .define <word>
        else if (cmd === 'define') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ වචනයක් ඇතුළත් කරන්න!\nඋදා: ${prefix}define hello`, botFooter, { quoted: m });
            const defineMsg = await nimesha.sendMessage(m.chat, { text: `📖 *"${q}" සොයමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const def = await tryFetch([
                async () => { const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, { timeout: 8000 }); const d = r.data?.[0]; return d ? `📖 *${d.word}*\n\n*Meaning:* ${d.meanings?.[0]?.definitions?.[0]?.definition}\n*Example:* ${d.meanings?.[0]?.definitions?.[0]?.example || 'N/A'}\n*Part of speech:* ${d.meanings?.[0]?.partOfSpeech || 'N/A'}` : null; },
                async () => { const r = await axios.get(`https://api.api-ninjas.com/v1/dictionary?word=${encodeURIComponent(q)}`, { headers: { 'X-Api-Key': 'demo' }, timeout: 8000 }); return r.data?.definition ? `📖 *${q}*\n\n${r.data.definition}` : null; }
            ]);
            await nimesha.sendMessage(m.chat, { text: def ? `${def}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ "${q}" වචනය හමු නොවිණී\n${botFooter}`, edit: defineMsg.key });
        }

        // .weather <city>
        else if (cmd === 'weather') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ නගරයේ නම ඇතුළත් කරන්න!\nඋදා: ${prefix}weather Colombo`, botFooter, { quoted: m });
            const weatherMsg = await nimesha.sendMessage(m.chat, { text: `🌤️ *කාලගුණය සොයමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const weather = await tryFetch([
                async () => {
                    const r = await axios.get(`https://wttr.in/${encodeURIComponent(q)}?format=j1`, { timeout: 10000 });
                    const d = r.data?.current_condition?.[0];
                    if (!d) return null;
                    return `🌤️ *Weather: ${q}*\n━━━━━━━━━━━━━━━━━━━━━━\n🌡️ *Temp:* ${d.temp_C}°C (${d.temp_F}°F)\n💧 *Humidity:* ${d.humidity}%\n🌬️ *Wind:* ${d.windspeedKmph} km/h\n☁️ *Condition:* ${d.weatherDesc?.[0]?.value}\n👁️ *Visibility:* ${d.visibility} km`;
                },
                async () => {
                    const r = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=demo&units=metric`, { timeout: 10000 });
                    return r.data?.main ? `🌤️ *Weather: ${q}*\n━━━━━━━━━━━━━━━━━━━━━━\n🌡️ *Temp:* ${r.data.main.temp}°C\n💧 *Humidity:* ${r.data.main.humidity}%\n☁️ *Condition:* ${r.data.weather?.[0]?.description}` : null;
                }
            ]);
            await nimesha.sendMessage(m.chat, { text: weather ? `${weather}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ "${q}" නගරය හමු නොවිණී\n${botFooter}`, edit: weatherMsg.key });
        }

        // .news
        else if (cmd === 'news') {
            const newsMsg = await nimesha.sendMessage(m.chat, { text: `📰 *News ගනිමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const news = await tryFetch([
                async () => { const r = await axios.get('https://newsapi.org/v2/top-headlines?country=us&apiKey=demo&pageSize=5', { timeout: 10000 }); return r.data?.articles?.slice(0, 5).map((a, i) => `${i + 1}. *${a.title}*\n   ${a.source?.name || ''}`).join('\n\n') || null; },
                async () => { const r = await axios.get('https://api.currentsapi.services/v1/latest-news?apiKey=demo&language=en&page_size=5', { timeout: 10000 }); return r.data?.news?.slice(0, 5).map((a, i) => `${i + 1}. *${a.title}*`).join('\n\n') || null; }
            ]);
            await nimesha.sendMessage(m.chat, { text: news ? `📰 *Latest News (2026/03/11)*\n━━━━━━━━━━━━━━━━━━━━━━\n${news}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ News ලබා ගැනීමට නොහැකිය\n${botFooter}`, edit: newsMsg.key });
        }

        // .lyrics <song>
        else if (cmd === 'lyrics') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ ගීත නාමය ඇතුළත් කරන්න!\nඋදා: ${prefix}lyrics Shape of You`, botFooter, { quoted: m });
            const lyricsMsg = await nimesha.sendMessage(m.chat, { text: `🎵 *Lyrics සොයමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const lyrics = await tryFetch([
                async () => { const r = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(q)}`, { timeout: 10000 }); return r.data?.lyrics ? `🎵 *${r.data.title}* — ${r.data.author}\n━━━━━━━━━━━━━━━━━━━━━━\n${r.data.lyrics.substring(0, 2000)}` : null; },
                async () => {
                    const search = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`, { timeout: 8000 });
                    const song = search.data?.data?.[0];
                    if (!song) return null;
                    const lyr = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`, { timeout: 10000 });
                    return lyr.data?.lyrics ? `🎵 *${song.title}* — ${song.artist.name}\n━━━━━━━━━━━━━━━━━━━━━━\n${lyr.data.lyrics.substring(0, 2000)}` : null;
                }
            ]);
            await nimesha.sendMessage(m.chat, { text: lyrics ? `${lyrics}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ "${q}" ගීතයේ lyrics හමු නොවිණී\n${botFooter}`, edit: lyricsMsg.key });
        }

        // .8ball <question>
        else if (cmd === '8ball') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ ප්‍රශ්නයක් ඇතුළත් කරන්න!\nඋදා: ${prefix}8ball Will I win?`, botFooter, { quoted: m });
            const eightMsg = await nimesha.sendMessage(m.chat, { text: `🎱 *Magic 8-Ball...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const answers = ['✅ Yes', '❌ No', '🤔 Maybe', '💯 Definitely!', '🙅 No way', '⭐ Signs point to yes', '🔮 Concentrate and ask again', '🌟 Without a doubt', '😐 Cannot predict now', '🎯 Outlook good'];
            const answer = answers[Math.floor(Math.random() * answers.length)];
            await editAutoDelete(nimesha, m.chat, `🎱 *Magic 8-Ball*\n━━━━━━━━━━━━━━━━━━━━━━\n❓ *Question:* ${q}\n\n🔮 *Answer:* ${answer}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, eightMsg.key);
        }

        // .tts <text>
        else if (cmd === 'tts') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Text ඇතුළත් කරන්න!\nඋදා: ${prefix}tts hello world`, botFooter, { quoted: m });
            const lang = args[args.length - 1]?.length === 2 ? args.pop() : 'en';
            const ttsText = args.join(' ');
            try {
                const audioBuffer = await ttsGenerate(ttsText, lang);
                if (audioBuffer) {
                    await nimesha.sendMessage(m.chat, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: true }, { quoted: m });
                } else {
                    await sendAutoDelete(nimesha, m.chat, `❌ TTS generate කිරීමට නොහැකිය`, botFooter, { quoted: m });
                }
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ TTS දෝෂය: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .trt <text> <lang>
        else if (cmd === 'trt' || cmd === 'translate') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Text සහ language ඇතුළත් කරන්න!\nඋදා: ${prefix}trt Hello si\nඋදා: ${prefix}trt Ayubowan en`, botFooter, { quoted: m });
            const trtMsg = await nimesha.sendMessage(m.chat, { text: `🌐 *පරිවර්තනය කරමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const parts = args;
            const toLang = parts[parts.length - 1]?.length <= 5 ? parts.pop() : 'en';
            const toTranslate = parts.join(' ');
            const translated = await translateText(toTranslate, toLang);
            await nimesha.sendMessage(m.chat, { text: translated ? `🌐 *Translation*\n━━━━━━━━━━━━━━━━━━━━━━\n📝 *Original:* ${toTranslate}\n🔤 *Translated (${toLang}):* ${translated}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ Translation නොහැකිය\n${botFooter}`, edit: trtMsg.key });
        }

        // .ss <link>
        else if (cmd === 'ss' || cmd === 'screenshot') {
            if (!q || !q.match(/https?:\/\//)) return await sendAutoDelete(nimesha, m.chat, `⚠️ URL ඇතුළත් කරන්න!\nඋදා: ${prefix}ss https://google.com`, botFooter, { quoted: m });
            const waitMsg = await nimesha.sendMessage(m.chat, { text: `📸 *Screenshot ගනිමින්...*\n🔗 ${q}\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const imgBuffer = await takeScreenshot(q);
            if (imgBuffer) {
                await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `📸 *Screenshot*\n🔗 ${q}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
                await editAutoDelete(nimesha, m.chat, `✅ *Screenshot සාර්ථකයි!*\n🔗 ${q}`, botFooter, waitMsg.key);
            } else {
                await nimesha.sendMessage(m.chat, { text: `❌ Screenshot ගැනීමට නොහැකිය\n${botFooter}`, edit: waitMsg.key });
            }
        }

        // .jid
        else if (cmd === 'jid') {
            const jidMsg = await nimesha.sendMessage(m.chat, { text: `📱 *JID ලබා ගනිමින්...*\n${botFooter}` }, { quoted: m });
            await editAutoDelete(nimesha, m.chat, `📱 *JID Info*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 *Your JID:* ${m.sender}\n💬 *Chat JID:* ${m.chat}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, jidMsg.key);
        }

        // .url <text>
        else if (cmd === 'url') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Text ඇතුළත් කරන්න!\nඋදා: ${prefix}url hello world`, botFooter, { quoted: m });
            await editAutoDelete(nimesha, m.chat, `🔗 *URL Encoded*\n━━━━━━━━━━━━━━━━━━━━━━\n📝 *Original:* ${q}\n🔤 *Encoded:* ${encodeURIComponent(q)}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, urlMsg.key);
        }

        // .cinfo <country>
        else if (cmd === 'cinfo') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Country name ඇතුළත් කරන්න!\nඋදා: ${prefix}cinfo Sri Lanka`, botFooter, { quoted: m });
            const cinfoMsg = await nimesha.sendMessage(m.chat, { text: `🌍 *රට සොයමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const info = await tryFetch([
                async () => {
                    const r = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fullText=false`, { timeout: 10000 });
                    const c = r.data?.[0];
                    if (!c) return null;
                    return `🌍 *Country Info: ${c.name?.common}*\n━━━━━━━━━━━━━━━━━━━━━━\n🏳️ *Official:* ${c.name?.official}\n🗺️ *Capital:* ${c.capital?.[0] || 'N/A'}\n🌏 *Region:* ${c.region} - ${c.subregion}\n👥 *Population:* ${c.population?.toLocaleString()}\n💱 *Currency:* ${Object.values(c.currencies || {})[0]?.name || 'N/A'}\n🗣️ *Languages:* ${Object.values(c.languages || {}).join(', ')}\n📞 *Calling Code:* +${c.idd?.root?.replace('+', '')}${c.idd?.suffixes?.[0] || ''}\n🚗 *Driving Side:* ${c.car?.side || 'N/A'}\n🏖️ *Area:* ${c.area?.toLocaleString()} km²`;
                }
            ]);
            await nimesha.sendMessage(m.chat, { text: info ? `${info}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ "${q}" රට හමු නොවිණී\n${botFooter}`, edit: cinfoMsg.key });
        }

        // .groupinfo
        else if (cmd === 'groupinfo') {
            if (!m.isGroup) return await sendAutoDelete(nimesha, m.chat, `❌ Group command පමණයි!`, botFooter, { quoted: m });
            try {
                const metadata = await nimesha.groupMetadata(m.chat);
                const admins = metadata.participants.filter(p => p.admin);
                await nimesha.sendMessage(m.chat, {
                    text: `👥 *Group Info*\n━━━━━━━━━━━━━━━━━━━━━━\n📌 *Name:* ${metadata.subject}\n🆔 *ID:* ${m.chat}\n👥 *Members:* ${metadata.participants.length}\n👮 *Admins:* ${admins.length}\n📝 *Description:*\n${metadata.desc || 'N/A'}\n📅 *Created:* ${new Date(metadata.creation * 1000).toLocaleDateString()}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Group info ගැනීමට නොහැකිය`, botFooter, { quoted: m }); }
        }

        // .staff / .admins
        else if (cmd === 'staff' || cmd === 'admins') {
            if (!m.isGroup) return await sendAutoDelete(nimesha, m.chat, `❌ Group command පමණයි!`, botFooter, { quoted: m });
            try {
                const metadata = await nimesha.groupMetadata(m.chat);
                const admins = metadata.participants.filter(p => p.admin);
                const adminList = admins.map(a => `👮 @${a.id.split('@')[0]}`).join('\n');
                await nimesha.sendMessage(m.chat, {
                    text: `👮 *Group Admins (${admins.length})*\n━━━━━━━━━━━━━━━━━━━━━━\n${adminList}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                    mentions: admins.map(a => a.id)
                }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Admin list ගැනීමට නොහැකිය`, botFooter, { quoted: m }); }
        }

        // .vv / .ok / .wow (view once revealer)
        else if (cmd === 'vv' || cmd === 'ok' || cmd === 'wow') {
            const quoted = m.quoted;
            if (!quoted) return await sendAutoDelete(nimesha, m.chat, `⚠️ View once message reply කරන්න!`, botFooter, { quoted: m });
            try {
                const msg = quoted.message?.viewOnceMessage?.message || quoted.message?.viewOnceMessageV2?.message || quoted.message;
                if (msg?.imageMessage) {
                    const buffer = await nimesha.downloadMediaMessage(quoted);
                    await nimesha.sendMessage(m.chat, { image: buffer, caption: `👁️ *View Once Revealed*\n${botFooter}` }, { quoted: m });
                } else if (msg?.videoMessage) {
                    const buffer = await nimesha.downloadMediaMessage(quoted);
                    await nimesha.sendMessage(m.chat, { video: buffer, caption: `👁️ *View Once Revealed*\n${botFooter}` }, { quoted: m });
                }
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // ══════════════════════════════════════════════════════
        // ════════ AI COMMANDS ═════════════════════════════════
        // ══════════════════════════════════════════════════════

        // .gpt / .gemini / .llama3
        else if (['gpt', 'gemini', 'llama3', 'ai', 'chatai'].includes(cmd)) {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ ප්‍රශ්නයක් ඇතුළත් කරන්න!\nඋදා: ${prefix}${cmd} What is love?`, botFooter, { quoted: m });
            const waitMsg = await nimesha.sendMessage(m.chat, { text: `🤖 *AI සිතමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n❓ *ප්‍රශ්නය:* ${q}\n⏳ රැඳෙන්න...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            const answer = await aiQuery(q, cmd);
            await nimesha.sendMessage(m.chat, {
                text: answer ? `🤖 *AI Answer (${cmd.toUpperCase()})*\n━━━━━━━━━━━━━━━━━━━━━━\n❓ *Q:* ${q}\n\n💡 *A:* ${answer}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` : `❌ AI response ලබා ගැනීමට නොහැකිය\n${botFooter}`,
                edit: waitMsg.key
            });
        }

        // .imagine / .flux / .sora (AI image)
        else if (['imagine', 'flux', 'sora'].includes(cmd)) {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Prompt ඇතුළත් කරන්න!\nඋදා: ${prefix}${cmd} a beautiful sunset`, botFooter, { quoted: m });
            const waitMsg = await nimesha.sendMessage(m.chat, { text: `🎨 *AI Image Generate කරමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n✨ *Prompt:* ${q}\n⏳ රැඳෙන්න...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            const imgBuffer = await tryFetch([
                async () => { const r = await axios.get(`https://api.paxsenix.biz.id/ai/flux?prompt=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 30000 }); return Buffer.from(r.data); },
                async () => { const r = await axios.get(`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}?width=1024&height=1024&nologo=true`, { responseType: 'arraybuffer', timeout: 30000 }); return Buffer.from(r.data); },
                async () => { const r = await axios.get(`https://nexra.aryahcr.cc/api/image/completeai?prompt=${encodeURIComponent(q)}&model=flux`, { responseType: 'arraybuffer', timeout: 30000 }); return Buffer.from(r.data); }
            ]);
            if (imgBuffer) {
                await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🎨 *AI Generated Image*\n✨ *Prompt:* ${q}\n🤖 *Model:* ${cmd}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
                await editAutoDelete(nimesha, m.chat, `✅ *AI Image සාර්ථකයි!*\n✨ *Prompt:* ${q}`, botFooter, waitMsg.key);
            } else {
                await nimesha.sendMessage(m.chat, { text: `❌ Image generate කිරීමට නොහැකිය\n${botFooter}`, edit: waitMsg.key });
            }
        }

        // ══════════════════════════════════════════════════════
        // ════════ IMG/STICKER COMMANDS ════════════════════════
        // ══════════════════════════════════════════════════════

        // .sticker
        else if (cmd === 'sticker' || cmd === 'stickerpack' || cmd === 's') {
            const quoted = m.quoted;
            const msg = m.message;
            let mediaBuffer = null;
            let mimeType = 'image/jpeg';
            try {
                if (quoted?.message?.imageMessage || quoted?.message?.videoMessage || quoted?.message?.stickerMessage) {
                    mediaBuffer = await nimesha.downloadMediaMessage(quoted);
                    mimeType = quoted.message?.imageMessage ? 'image/jpeg' : quoted.message?.videoMessage ? 'video/mp4' : 'image/webp';
                } else if (msg?.imageMessage || msg?.videoMessage) {
                    mediaBuffer = await nimesha.downloadMediaMessage(m);
                    mimeType = msg?.imageMessage ? 'image/jpeg' : 'video/mp4';
                }
                if (!mediaBuffer) return await sendAutoDelete(nimesha, m.chat, `⚠️ Image/Video reply කරන්න!`, botFooter, { quoted: m });
                const packName = args[0] || 'SHASIKALA BOT';
                const stickerBuffer = await makeSticker(mediaBuffer, mimeType, packName, 'Nimesha');
                await nimesha.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Sticker error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .simage (sticker to image)
        else if (cmd === 'simage' || cmd === 'toimg') {
            const quoted = m.quoted;
            if (!quoted?.message?.stickerMessage) return await sendAutoDelete(nimesha, m.chat, `⚠️ Sticker reply කරන්න!`, botFooter, { quoted: m });
            try {
                const buffer = await nimesha.downloadMediaMessage(quoted);
                await nimesha.sendMessage(m.chat, { image: buffer, caption: `🖼️ *Sticker → Image*\n${botFooter}` }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .removebg
        else if (cmd === 'removebg' || cmd === 'rmbg') {
            const quoted = m.quoted;
            const msg = m.message;
            let imageBuffer = null;
            try {
                if (quoted?.message?.imageMessage) imageBuffer = await nimesha.downloadMediaMessage(quoted);
                else if (msg?.imageMessage) imageBuffer = await nimesha.downloadMediaMessage(m);
                if (!imageBuffer) return await sendAutoDelete(nimesha, m.chat, `⚠️ Image reply කරන්න!`, botFooter, { quoted: m });
                const waitMsg = await nimesha.sendMessage(m.chat, { text: `🔧 *Background Remove කරමින්...*\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
                const result = await removeBackground(imageBuffer);
                if (result) {
                    await nimesha.sendMessage(m.chat, { image: result, caption: `✅ *Background Removed!*\n${botFooter}` }, { quoted: m });
                    await editAutoDelete(nimesha, m.chat, `✅ *Background Removed සාර්ථකයි!*`, botFooter, waitMsg.key);
                } else { await nimesha.sendMessage(m.chat, { text: `❌ Background remove කිරීමට නොහැකිය\n${botFooter}`, edit: waitMsg.key }); }
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .blur
        else if (cmd === 'blur') {
            const quoted = m.quoted;
            const msg = m.message;
            let imageBuffer = null;
            try {
                if (quoted?.message?.imageMessage) imageBuffer = await nimesha.downloadMediaMessage(quoted);
                else if (msg?.imageMessage) imageBuffer = await nimesha.downloadMediaMessage(m);
                if (!imageBuffer) return await sendAutoDelete(nimesha, m.chat, `⚠️ Image reply කරන්න!`, botFooter, { quoted: m });
                const sharp = require('sharp');
                const blurred = await sharp(imageBuffer).blur(15).toBuffer();
                await nimesha.sendMessage(m.chat, { image: blurred, caption: `🌫️ *Blurred Image*\n${botFooter}` }, { quoted: m });
            } catch (e) {
                // Fallback: send with API
                const imgBuffer = await tryFetch([
                    async () => { const r = await axios.get(`https://api.paxsenix.biz.id/filter/blur?image=${encodeURIComponent('https://i.imgur.com/test.jpg')}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); }
                ]);
                await sendAutoDelete(nimesha, m.chat, `❌ Blur error: ${e.message}`, botFooter, { quoted: m });
            }
        }

        // .attp (animated text sticker) — ffmpeg directly → webp, API fallback
        else if (cmd === 'attp') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Text ඇතුළත් කරන්න!\nඋදා: ${prefix}attp Hello`, botFooter, { quoted: m });
            const atttpWaitMsg = await nimesha.sendMessage(m.chat, { text: `🎨 *ATTP Sticker Generate කරමින්...*\n📝 *Text:* ${q}\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            try {
                // ffmpeg directly → animated webp (mp4 step නෑ, videoToWebp නෑ)
                const webpBuffer = await new Promise((resolve, reject) => {
                    const { spawn } = require('child_process');
                    const os = require('os'), path = require('path'), fs = require('fs');
                    // font path — server හි dejavu bold
                    const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
                    // ffmpeg drawtext special chars escape
                    const escTxt = (s) => s
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'")
                        .replace(/:/g, '\\:')
                        .replace(/,/g, '\\,')
                        .replace(/\[/g, '\\[')
                        .replace(/\]/g, '\\]')
                        .replace(/%/g, '\\%');
                    const safeText = escTxt(q);
                    // temp output file — webp directly
                    const tmpOut = path.join(os.tmpdir(), `attp_${Date.now()}.webp`);
                    const cycle = 0.3, dur = 1.8;
                    const base = `fontfile='${fontPath}':text='${safeText}':borderw=3:bordercolor=black@0.8:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2`;
                    const drawRed   = `drawtext=${base}:fontcolor=#FF4444:enable='lt(mod(t\\,${cycle})\\,0.1)'`;
                    const drawBlue  = `drawtext=${base}:fontcolor=#4488FF:enable='between(mod(t\\,${cycle})\\,0.1\\,0.2)'`;
                    const drawGreen = `drawtext=${base}:fontcolor=#44FF88:enable='gte(mod(t\\,${cycle})\\,0.2)'`;
                    // ffmpeg → webp directly (libwebp codec)
                    const args = [
                        '-y',
                        '-f', 'lavfi', '-i', `color=c=black:s=512x512:d=${dur}:r=15`,
                        '-vf', `${drawRed},${drawBlue},${drawGreen},scale=512:512`,
                        '-vcodec', 'libwebp',
                        '-lossless', '0',
                        '-compression_level', '4',
                        '-quality', '70',
                        '-loop', '0',
                        '-preset', 'default',
                        '-an', '-vsync', '0',
                        '-t', String(dur),
                        tmpOut
                    ];
                    const ff = spawn('ffmpeg', args);
                    const errors = [];
                    ff.stderr.on('data', e => errors.push(e));
                    ff.on('error', reject);
                    ff.on('close', code => {
                        if (code === 0 && fs.existsSync(tmpOut)) {
                            const buf = fs.readFileSync(tmpOut);
                            try { fs.unlinkSync(tmpOut); } catch(e) {}
                            resolve(buf);
                        } else {
                            try { fs.unlinkSync(tmpOut); } catch(e) {}
                            reject(new Error(Buffer.concat(errors).toString().slice(-300)));
                        }
                    });
                });
                // sticker send + processing msg → done msg (countdown + delete)
                await nimesha.sendMessage(m.chat, { sticker: webpBuffer }, { quoted: m });
                await editAutoDelete(nimesha, m.chat, `✅ *ATTP Sticker සාර්ථකයි!*\n🎨 *Text:* ${q}`, botFooter, atttpWaitMsg.key);
            } catch (ffErr) {
                // ffmpeg fail — API fallback
                console.log('ATTP ffmpeg fail:', ffErr.message.slice(0, 200));
                const imgBuffer = await tryFetch([
                    async () => { const r = await axios.get(`https://api.paxsenix.biz.id/sticker/attp?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); },
                    async () => { const r = await axios.get(`https://api.lolhuman.xyz/api/attp?apikey=demo&text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); }
                ]);
                if (imgBuffer) {
                    await nimesha.sendMessage(m.chat, { sticker: imgBuffer }, { quoted: m });
                    await editAutoDelete(nimesha, m.chat, `✅ *ATTP Sticker සාර්ථකයි!*\n🎨 *Text:* ${q}`, botFooter, atttpWaitMsg.key);
                } else {
                    // සියල්ල fail — error edit + countdown
                    await editAutoDelete(nimesha, m.chat, `❌ ATTP generate කිරීමට නොහැකිය`, botFooter, atttpWaitMsg.key);
                }
            }
        }

        // ══════════════════════════════════════════════════════
        // ════════ TEXT MAKER / ART COMMANDS ══════════════════
        // ══════════════════════════════════════════════════════
        else if (['metallic', 'ice', 'snow', 'impressive', 'matrix', 'light', 'neon', 'devil', 'purple', 'thunder', 'leaves', '1917', 'arena', 'hacker', 'sand', 'blackpink', 'glitch', 'fire'].includes(cmd)) {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Text ඇතුළත් කරන්න!\nඋදා: ${prefix}${cmd} Hello`, botFooter, { quoted: m });
            const waitMsg = await nimesha.sendMessage(m.chat, { text: `🎨 *Text Art Generate කරමින්...*\n✨ *Style:* ${cmd}\n📝 *Text:* ${q}\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const imgBuffer = await tryFetch([
                async () => { const r = await axios.get(`https://api.paxsenix.biz.id/text-effect/${cmd}?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 }); return Buffer.from(r.data); },
                async () => { const r = await axios.get(`https://api.lolhuman.xyz/api/teks/${cmd}?apikey=demo&text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 }); return Buffer.from(r.data); },
                async () => { const r = await axios.get(`https://nekobot.xyz/api/text?type=${cmd}&text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 }); return Buffer.from(r.data); }
            ]);
            if (imgBuffer) {
                await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🎨 *${cmd.toUpperCase()} Text Art*\n📝 *Text:* ${q}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
                await editAutoDelete(nimesha, m.chat, `✅ *Text Art සාර්ථකයි!*\n✨ *Style:* ${cmd}`, botFooter, waitMsg.key);
            } else { await nimesha.sendMessage(m.chat, { text: `❌ Text art generate කිරීමට නොහැකිය\n${botFooter}`, edit: waitMsg.key }); }
        }

        // ══════════════════════════════════════════════════════
        // ════════ FUN COMMANDS ════════════════════════════════
        // ══════════════════════════════════════════════════════

        // .compliment @user
        else if (cmd === 'compliment') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const compliments = ['You are amazing! 🌟', 'You make the world a better place! 🌍', 'You are so talented! 🎉', 'Your smile lights up the room! 😊', 'You are absolutely wonderful! ✨', 'You are one of a kind! 🦋', 'You are inspiring! 💫'];
            const comp = compliments[Math.floor(Math.random() * compliments.length)];
            await nimesha.sendMessage(m.chat, { text: `💖 *Compliment*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${mentioned.split('@')[0]}\n\n💌 ${comp}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // .insult @user
        else if (cmd === 'insult') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const insults = await tryFetch([
                async () => { const r = await axios.get('https://evilinsult.com/generate_insult.php?lang=en&type=json', { timeout: 8000 }); return r.data?.insult || null; }
            ]) || 'You have the personality of a wet sock! 🧦';
            await nimesha.sendMessage(m.chat, { text: `😂 *Insult*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${mentioned.split('@')[0]}\n\n😈 ${insults}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // .flirt
        else if (cmd === 'flirt') {
            const flirts = ['Are you a magician? Every time I look at you, everyone else disappears ✨', 'Do you have a map? I keep getting lost in your eyes 👀', 'Are you a parking ticket? Because you have "fine" written all over you 😍', 'Is your name Google? Because you have everything I\'ve been searching for 🔍'];
            const flirt = flirts[Math.floor(Math.random() * flirts.length)];
            await sendAutoDelete(nimesha, m.chat, `💕 *Flirt Line*\n━━━━━━━━━━━━━━━━━━━━━━\n${flirt}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .hack
        else if (cmd === 'hack') {
            const target = m.mentionedJid?.[0] ? `@${m.mentionedJid[0].split('@')[0]}` : (q || 'Target');
            const stages = [
                `💻 *HACKING INITIATED...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Target: ${target}\n⚡ [▓░░░░░░░░░] 10% — Connecting...`,
                `💻 *HACKING IN PROGRESS...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Target: ${target}\n⚡ [▓▓▓▓░░░░░░] 40% — Bypassing firewall...`,
                `💻 *HACKING IN PROGRESS...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Target: ${target}\n⚡ [▓▓▓▓▓▓▓░░░] 70% — Extracting data...`,
                `✅ *HACK COMPLETE!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎯 Target: ${target}\n⚡ [▓▓▓▓▓▓▓▓▓▓] 100%\n📊 Password: 1234567890\n📧 Email: hacked@fake.com\n💰 Balance: $999,999\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
            ];
            let hackMsg = await nimesha.sendMessage(m.chat, { text: stages[0] });
            for (let i = 1; i < stages.length; i++) {
                await new Promise(r => setTimeout(r, 2000));
                await nimesha.sendMessage(m.chat, { text: stages[i], edit: hackMsg.key });
            }
        }

        // .wasted @user
        else if (cmd === 'wasted') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            try {
                const pp = await nimesha.profilePictureUrl(mentioned, 'image').catch(() => null);
                if (pp) {
                    const imgBuffer = await getMiscImage('wasted', { imageUrl: pp });
                    if (imgBuffer) return await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `💀 *WASTED*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
                }
                await nimesha.sendMessage(m.chat, { text: `💀 *WASTED*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .ship @user
        else if (cmd === 'ship') {
            const user1 = m.mentionedJid?.[0] || m.sender;
            const user2 = m.mentionedJid?.[1] || m.sender;
            const shipPercent = Math.floor(Math.random() * 101);
            const hearts = '❤️'.repeat(Math.floor(shipPercent / 20)) + '🤍'.repeat(5 - Math.floor(shipPercent / 20));
            await nimesha.sendMessage(m.chat, {
                text: `💕 *Ship Meter*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${user1.split('@')[0]}\n💖 + 💖\n👤 @${user2.split('@')[0]}\n\n${hearts}\n💯 *Match:* ${shipPercent}%\n${shipPercent > 70 ? '🔥 Perfect Match!' : shipPercent > 40 ? '💛 Good Match!' : '💔 Maybe next time...'}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                mentions: [user1, user2]
            }, { quoted: m });
        }

        // .simp @user
        else if (cmd === 'simp') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const simpLevel = Math.floor(Math.random() * 101);
            await nimesha.sendMessage(m.chat, { text: `😍 *Simp Meter*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${mentioned.split('@')[0]}\n\n💘 Simp Level: ${simpLevel}%\n${simpLevel > 80 ? '🚨 Ultra Simp!' : simpLevel > 50 ? '😅 Major Simp!' : '😌 Normal person'}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // .character @user
        else if (cmd === 'character') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const traits = ['Smart 🧠', 'Funny 😂', 'Kind ❤️', 'Creative 🎨', 'Brave 💪', 'Loyal 🤝', 'Mysterious 🔮', 'Energetic ⚡'];
            const selected = traits.sort(() => 0.5 - Math.random()).slice(0, 3);
            await nimesha.sendMessage(m.chat, { text: `🎭 *Character Analysis*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${mentioned.split('@')[0]}\n\n✨ *Personality Traits:*\n${selected.map(t => `• ${t}`).join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // .shayari
        else if (cmd === 'shayari') {
            const shayaris = [
                'Mohabbat ek dua hai,\nJo dil se nikalti hai,\nYeh sochke dil bhi muskurata hai,\nKi koi doosra bhi khayalon mein aata hai. 🌹',
                'Zindagi ka safar, ajeeb hai yaro,\nKoi samajh na paya, kya hai raaz yaro,\nKoi rota hai tanha, koi hansta hai,\nPar dil ki baat, dil mein hi rehti hai. 💫',
                'Pyar ko pyar hi rehne do,\nKoi naam na do,\nJo rishta dil se bana hai,\nUse alfazon ki zaroorat kya. 💕'
            ];
            const shayari = shayaris[Math.floor(Math.random() * shayaris.length)];
            await sendAutoDelete(nimesha, m.chat, `🌹 *Shayari*\n━━━━━━━━━━━━━━━━━━━━━━\n${shayari}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .goodnight
        else if (cmd === 'goodnight') {
            const gns = ['🌙 Good night! Sweet dreams! 💭', '🌛 Sleep well! The stars will watch over you! ⭐', '🌜 May your dreams be magical tonight! ✨', '🌚 Rest well, tomorrow is a new day! 🌅'];
            await sendAutoDelete(nimesha, m.chat, `🌙 *Good Night!*\n━━━━━━━━━━━━━━━━━━━━━━\n${gns[Math.floor(Math.random() * gns.length)]}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .roseday
        else if (cmd === 'roseday') {
            await sendAutoDelete(nimesha, m.chat, `🌹 *Happy Rose Day!*\n━━━━━━━━━━━━━━━━━━━━━━\n🌹🌹🌹🌹🌹\n\nRoses are red,\nViolets are blue,\nThis bot is amazing,\nAnd so are you! 💕\n\n🌹🌹🌹🌹🌹\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .stupid @user
        else if (cmd === 'stupid') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const stupidMsg = args.slice(1).join(' ') || 'You did something very stupid! 🤦';
            await nimesha.sendMessage(m.chat, { text: `🤦 *Stupid Alert!*\n━━━━━━━━━━━━━━━━━━━━━━\n👤 @${mentioned.split('@')[0]}\n\n😤 ${stupidMsg}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // ══════════════════════════════════════════════════════
        // ════════ ANIME COMMANDS ══════════════════════════════
        // ══════════════════════════════════════════════════════
        else if (['neko', 'waifu', 'nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink', 'facepalm', 'loli', 'punch', 'slap', 'dance', 'happy', 'blush'].includes(cmd)) {
            const gifUrl = await getAnimeGif(cmd);
            if (gifUrl) {
                const r = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 15000 }).catch(() => null);
                if (r) {
                    const isGif = gifUrl.endsWith('.gif') || r.headers['content-type']?.includes('gif');
                    await nimesha.sendMessage(m.chat, { [isGif ? 'video' : 'image']: Buffer.from(r.data), gifPlayback: isGif, caption: `🌸 *${cmd.toUpperCase()}*\n${botFooter}` }, { quoted: m });
                } else await sendAutoDelete(nimesha, m.chat, `🌸 *${cmd.toUpperCase()}*\n🔗 ${gifUrl}`, botFooter, { quoted: m });
            } else await sendAutoDelete(nimesha, m.chat, `❌ ${cmd} GIF ලබා ගැනීමට නොහැකිය`, botFooter, { quoted: m });
        }

        // ══════════════════════════════════════════════════════
        // ════════ MISC IMAGE COMMANDS ═════════════════════════
        // ══════════════════════════════════════════════════════

        // .oogway <quote>
        else if (cmd === 'oogway') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Quote ඇතුළත් කරන්න!\nඋදා: ${prefix}oogway Yesterday is history`, botFooter, { quoted: m });
            const imgBuffer = await getMiscImage('oogway', { text: q });
            if (imgBuffer) await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🐢 *Oogway says:*\n"${q}"\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            else await sendAutoDelete(nimesha, m.chat, `🐢 *Oogway says:*\n"${q}"\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .tweet <text>
        else if (cmd === 'tweet') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Tweet text ඇතුළත් කරන්න!\nඋදා: ${prefix}tweet Hello World!`, botFooter, { quoted: m });
            const username = m.pushName || 'User';
            const imgBuffer = await getMiscImage('tweet', { text: q, username });
            if (imgBuffer) await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🐦 *Tweet*\n@${username}: ${q}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            else await sendAutoDelete(nimesha, m.chat, `🐦 *@${username}:* ${q}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .ytcomment <text>
        else if (cmd === 'ytcomment') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ Comment text ඇතුළත් කරන්න!\nඋදා: ${prefix}ytcomment This video is amazing!`, botFooter, { quoted: m });
            const username = m.pushName || 'User';
            const imgBuffer = await getMiscImage('ytcomment', { text: q, username });
            if (imgBuffer) await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `💬 *YouTube Comment*\n${username}: ${q}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            else await sendAutoDelete(nimesha, m.chat, `💬 *YouTube Comment*\n👤 ${username}: ${q}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .jail @user
        else if (cmd === 'jail') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            try {
                const pp = await nimesha.profilePictureUrl(mentioned, 'image').catch(() => null);
                if (pp) {
                    const imgBuffer = await getMiscImage('jail', { imageUrl: pp });
                    if (imgBuffer) return await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🚔 *JAILED!*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
                }
                await nimesha.sendMessage(m.chat, { text: `🚔 *@${mentioned.split('@')[0]} is now in JAIL!*\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .triggered @user
        else if (cmd === 'triggered') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            try {
                const pp = await nimesha.profilePictureUrl(mentioned, 'image').catch(() => null);
                if (pp) {
                    const imgBuffer = await getMiscImage('triggered', { imageUrl: pp });
                    if (imgBuffer) return await nimesha.sendMessage(m.chat, { video: imgBuffer, gifPlayback: true, caption: `😤 *TRIGGERED!*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
                }
                await nimesha.sendMessage(m.chat, { text: `😤 *@${mentioned.split('@')[0]} is TRIGGERED!*\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .namecard
        else if (cmd === 'namecard') {
            const name = m.pushName || q || 'User';
            const imgBuffer = await getMiscImage('namecard', { name, subtitle: `WhatsApp: ${m.sender.split('@')[0]}` });
            if (imgBuffer) await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `🪪 *Name Card*\n👤 ${name}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}` }, { quoted: m });
            else await sendAutoDelete(nimesha, m.chat, `🪪 *Name Card*\n👤 *Name:* ${name}\n📱 *Number:* +${m.sender.split('@')[0]}\n━━━━━━━━━━━━━━━━━━━━━━`, botFooter, { quoted: m });
        }

        // .heart / .circle / .lgbt / .horny / .lolice / .gay / .glass / .passed
        else if (['heart', 'circle', 'lgbt', 'horny', 'lolice', 'gay', 'glass', 'passed'].includes(cmd)) {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            try {
                const pp = await nimesha.profilePictureUrl(mentioned, 'image').catch(() => null);
                const emojiMap = { heart: '❤️', circle: '⭕', lgbt: '🏳️‍🌈', horny: '😏', lolice: '👮', gay: '🌈', glass: '👓', passed: '✅' };
                if (pp) {
                    const imgBuffer = await tryFetch([
                        async () => { const r = await axios.get(`https://some-random-api.com/canvas/overlay/${cmd}?avatar=${pp}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); },
                        async () => { const r = await axios.get(`https://api.paxsenix.biz.id/overlay/${cmd}?image=${pp}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); }
                    ]);
                    if (imgBuffer) return await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `${emojiMap[cmd]} *${cmd.toUpperCase()}*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
                }
                await nimesha.sendMessage(m.chat, { text: `${emojiMap[cmd]} *${cmd.toUpperCase()}*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
            } catch (e) { await sendAutoDelete(nimesha, m.chat, `❌ Error: ${e.message}`, botFooter, { quoted: m }); }
        }

        // .its-so-stupid / .comrade
        else if (cmd === 'its-so-stupid' || cmd === 'comrade') {
            const mentioned = m.mentionedJid?.[0] || m.sender;
            const imgBuffer = await tryFetch([
                async () => { const r = await axios.get(`https://api.paxsenix.biz.id/meme/${cmd}?image=${await nimesha.profilePictureUrl(mentioned, 'image').catch(() => '')}`, { responseType: 'arraybuffer', timeout: 15000 }); return Buffer.from(r.data); }
            ]);
            if (imgBuffer) await nimesha.sendMessage(m.chat, { image: imgBuffer, caption: `😂 *${cmd.toUpperCase()}*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
            else await nimesha.sendMessage(m.chat, { text: `😂 *${cmd.toUpperCase()}*\n@${mentioned.split('@')[0]}\n${botFooter}`, mentions: [mentioned] }, { quoted: m });
        }

        // ══════════════════════════════════════════════════════
        // ════════ DOWNLOAD COMMANDS ═══════════════════════════
        // ══════════════════════════════════════════════════════

        // .apk <app name>
        else if (cmd === 'apk') {
            if (!q) return await sendAutoDelete(nimesha, m.chat, `⚠️ App name ඇතුළත් කරන්න!\nඋදා: ${prefix}apk WhatsApp`, botFooter, { quoted: m });
            const waitMsg = await nimesha.sendMessage(m.chat, { text: `🔍 *APK සොයමින්...*\n📱 *App:* ${q}\n⏳ රැඳෙන්න...\n${botFooter}` }, { quoted: m });
            const apkInfo = await tryFetch([
                async () => {
                    const r = await axios.get(`https://api.paxsenix.biz.id/dl/apkpure?q=${encodeURIComponent(q)}`, { timeout: 20000 });
                    return r.data?.title ? { title: r.data.title, url: r.data.url, size: r.data.size, version: r.data.version } : null;
                },
                async () => {
                    const r = await axios.get(`https://apkdl.net/search?q=${encodeURIComponent(q)}`, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    return { title: q, url: `https://apkdl.net/search?q=${encodeURIComponent(q)}`, size: 'N/A', version: 'Latest' };
                }
            ]);
            if (apkInfo) {
                await nimesha.sendMessage(m.chat, { text: `📱 *APK Found!*\n━━━━━━━━━━━━━━━━━━━━━━\n📦 *App:* ${apkInfo.title || q}\n📌 *Version:* ${apkInfo.version || 'Latest'}\n💾 *Size:* ${apkInfo.size || 'N/A'}\n🔗 *Download:* ${apkInfo.url || 'N/A'}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: waitMsg.key });
            } else { await nimesha.sendMessage(m.chat, { text: `❌ "${q}" APK හමු නොවිණී\n🔗 Try: https://apkpure.com/search?q=${encodeURIComponent(q)}\n${botFooter}`, edit: waitMsg.key }); }
        }

        // .song / .mp3 / .play / .ytmp3
        else if (['mp3', 'song', 'play', 'ytmp3'].includes(cmd)) {
            const input = q;
            if (!input) {
                const buttons = [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Menu', id: `${prefix}menu` }) }];
                return await nimesha.sendListMsg(m.chat, { text: `⚠️ ගීත නාමය ඇතුළත් කරන්න!\n*උදාහරණ:*\n${prefix}${cmd} Shape of You\n${prefix}${cmd} https://youtu.be/...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, footer: `© MISS SHASIKALA MINI BOT`, buttons }, { quoted: m });
            }
            try {
                // 1️⃣ Searching message — වෙනම new message
                const searchMsg = await nimesha.sendMessage(m.chat, {
                    text: `🔍 *සොයමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ඉල්ලුම:* ${input}\n⏳ YouTube හි සොයමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                }, { quoted: m });
                const searchKey = searchMsg?.key || null;

                let displayTitle = input;
                let videoUrl = input;
                if (!input.match(/https?:\/\//)) {
                    try {
                        const yts = require('yt-search');
                        const searchRes = await yts(input);
                        const video = searchRes?.videos?.[0] || searchRes?.all?.[0];
                        if (video) {
                            const _vid = video.videoId || video.url?.match(/(?:v=|youtu\.be\/)([^&?#]+)/)?.[1];
                            if (_vid) { videoUrl = `https://www.youtube.com/watch?v=${_vid}`; displayTitle = video.title || input; }
                        }
                    } catch (e) {}
                }

                // 2️⃣ Select button message — වෙනම new message
                const songButtons = [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '1️⃣ Audio (🎵 mp3)', id: '1' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '2️⃣ හඬ සටහන (🎤 voice note)', id: '2' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '3️⃣ ලිපිගොනු (📄 document)', id: '3' }) }
                ];
                const btnMsg = await nimesha.sendListMsg(m.chat, {
                    text: `🎯 *හමු වුණා!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${displayTitle}\n🔗 ${videoUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n🎶 *Download ආකෘතිය තෝරන්න:*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                    footer: `© MISS SHASIKALA MINI BOT | ආකෘතිය තෝරන්න`,
                    mentions: [m.sender],
                    buttons: songButtons
                }, { quoted: m });
                const btnKey = btnMsg?.key || null;

                pendingDownload.set(m.sender, { type: 'song', input, url: videoUrl, displayTitle, statusKey: searchKey, buttonKey: btnKey });

                // 330s තුළ button click නොකළොත් — searching + button messages delete
                setTimeout(async () => {
                    if (pendingDownload.has(m.sender) && pendingDownload.get(m.sender).buttonKey === btnKey) {
                        pendingDownload.delete(m.sender);
                        try { if (btnKey) await nimesha.sendMessage(m.chat, { delete: btnKey }); } catch(e) {}
                        try { if (searchKey) await nimesha.sendMessage(m.chat, { delete: searchKey }); } catch(e) {}
                    }
                }, AUTO_DELETE_SECS * 1000);
            } catch (err) { await sendAutoDelete(nimesha, m.chat, `⚠️ *දෝෂයකි:* ${err.message}`, botFooter, { quoted: m }); }
        }

        // .video / .mp4 / .ytmp4
        else if (['video', 'mp4', 'ytmp4', 'ytvideo'].includes(cmd)) {
            const input = q;
            if (!input) {
                const buttons = [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Menu', id: `${prefix}menu` }) }];
                return await nimesha.sendListMsg(m.chat, { text: `⚠️ වීඩියෝ නාමය ඇතුළත් කරන්න!\n*උදාහරණ:*\n${prefix}${cmd} Avengers\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, footer: `© MISS SHASIKALA MINI BOT`, buttons }, { quoted: m });
            }
            try {
                let videoUrl = input;
                let displayTitle = input;

                // 1️⃣ Searching message — වෙනම new message
                const vidSearchMsg = await nimesha.sendMessage(m.chat, {
                    text: `🔍 *සොයමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *ඉල්ලුම:* ${input}\n⏳ YouTube හි සොයමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                }, { quoted: m });
                const vidSearchKey = vidSearchMsg?.key || null;

                if (!input.match(/https?:\/\//)) {
                    const yts = require('yt-search');
                    const searchRes = await yts(input);
                    const video = searchRes?.videos?.[0] || searchRes?.all?.[0];
                    if (!video) {
                        if (vidSearchKey) { try { await nimesha.sendMessage(m.chat, { text: `❌ *YouTube හි හමු නොවිණී!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *ඉල්ලුම:* ${input}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`, edit: vidSearchKey }); } catch(e) {} }
                        return;
                    }
                    const _vid = video.videoId || video.url?.match(/(?:v=|youtu\.be\/)([^&?#]+)/)?.[1];
                    if (_vid) videoUrl = `https://www.youtube.com/watch?v=${_vid}`;
                    displayTitle = video.title || input;
                }

                // 2️⃣ Select button message — වෙනම new message
                const videoButtons = [
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '1️⃣ 144p (Video)', id: '1' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '2️⃣ 360p (Video)', id: '2' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '3️⃣ 720p (Video)', id: '3' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '4️⃣ 144p (📄 Document)', id: '4' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '5️⃣ 360p (📄 Document)', id: '5' }) },
                    { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '6️⃣ 720p (📄 Document)', id: '6' }) }
                ];
                const vidBtnMsg = await nimesha.sendListMsg(m.chat, {
                    text: `🎯 *හමු වුණා!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${displayTitle}\n🔗 ${videoUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n📺 *Quality තෝරන්න:*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                    footer: `© MISS SHASIKALA MINI BOT | Quality තෝරන්න`,
                    mentions: [m.sender],
                    buttons: videoButtons
                }, { quoted: m });
                const vidBtnKey = vidBtnMsg?.key || null;

                pendingDownload.set(m.sender, { type: 'video', input, url: videoUrl, displayTitle, statusKey: vidSearchKey, buttonKey: vidBtnKey });

                // 330s තුළ button click නොකළොත් — searching + button messages delete
                setTimeout(async () => {
                    if (pendingDownload.has(m.sender) && pendingDownload.get(m.sender).buttonKey === vidBtnKey) {
                        pendingDownload.delete(m.sender);
                        try { if (vidBtnKey) await nimesha.sendMessage(m.chat, { delete: vidBtnKey }); } catch(e) {}
                        try { if (vidSearchKey) await nimesha.sendMessage(m.chat, { delete: vidSearchKey }); } catch(e) {}
                    }
                }, AUTO_DELETE_SECS * 1000);
            } catch (err) { await sendAutoDelete(nimesha, m.chat, `⚠️ *දෝෂයකි:* ${err.message}`, botFooter, { quoted: m }); }
        }

        // ══════════════════════════════════════════════════════
        // ════════ GITHUB / REPO COMMANDS ══════════════════════
        // ══════════════════════════════════════════════════════
        else if (cmd === 'github' || cmd === 'repo' || cmd === 'git' || cmd === 'sc' || cmd === 'script') {
            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⭐ GitHub', id: `${prefix}alive` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Menu', id: `${prefix}menu` }) }
            ];
            await nimesha.sendListMsg(m.chat, {
                text: `💻 *GitHub / Source Code*\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 *GitHub:* https://github.com/nimesha206/nimabw\n👑 *Owner:* Nimesha Madhushan\n⭐ *Star the repo!*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                footer: `© MISS SHASIKALA MINI BOT`, mentions: [m.sender], buttons
            }, { quoted: m });
        }

        // ══════════════════════════════════════════════════════
        // ════════ HELP CENTER ═════════════════════════════════
        // ══════════════════════════════════════════════════════
        else if (cmd === 'help' || cmd === 'helpcenter') {
            const buttons = [
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📋 Main Menu', id: `${prefix}menu` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '✅ Alive Check', id: `${prefix}alive` }) },
                { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⚡ Speed Test', id: `${prefix}speed` }) }
            ];
            await nimesha.sendListMsg(m.chat, {
                text: `📋 *HELP CENTER*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *MUSIC:* ${prefix}song, ${prefix}mp3, ${prefix}play\n🎬 *VIDEO:* ${prefix}video, ${prefix}mp4, ${prefix}ytmp4\n📱 *APK:* ${prefix}apk [app name]\n🤖 *AI:* ${prefix}gpt, ${prefix}gemini, ${prefix}llama3\n🎨 *IMAGE:* ${prefix}imagine, ${prefix}flux, ${prefix}sora\n📸 *STICKER:* ${prefix}sticker, ${prefix}simage, ${prefix}attp\n🌐 *TRANSLATE:* ${prefix}trt [text] [lang]\n🔊 *TTS:* ${prefix}tts [text]\n📸 *SS:* ${prefix}ss [url]\n💡 *FACT:* ${prefix}fact\n😂 *JOKE:* ${prefix}joke\n💬 *QUOTE:* ${prefix}quote\n🎱 *8BALL:* ${prefix}8ball [question]\n🌤️ *WEATHER:* ${prefix}weather [city]\n📰 *NEWS:* ${prefix}news\n🌍 *CINFO:* ${prefix}cinfo [country]\n👥 *GROUP:* ${prefix}groupinfo, ${prefix}staff\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                footer: `© MISS SHASIKALA MINI BOT`, mentions: [m.sender], buttons
            }, { quoted: m });
        }

        // ══════════════════════════════════════════════════════
        // ════════ AUTO STATUS VIEW + REACT ════════════════════
        // ══════════════════════════════════════════════════════
        if (m.messages && Object.values(m.messages).some(msg => msg?.key?.remoteJid === 'status@broadcast')) {
            try {
                if (set.autostatus) {
                    for (const message of Object.values(m.messages)) {
                        if (message?.key?.remoteJid === 'status@broadcast') {
                            try {
                                // Status ස්වයංක්‍රීයව read/view කරනවා
                                await nimesha.readMessages([message.key]);
                                console.log(`👁️ AutoStatus View - @${(message.key.participant || '').split('@')[0]}`);
                                // autoreact enabled නම් react කරනවා
                                if (set.autostatusreact) {
                                    const emoji = getRandomEmoji();
                                    await nimesha.sendMessage(message.key.participant || message.key.remoteJid, { react: { text: emoji, key: message.key } }).catch(() => {});
                                    console.log(`❤️ AutoStatus React - ${emoji}`);
                                }
                            } catch (e) {
                                if (e.message?.includes('rate-overlimit')) {
                                    await new Promise(r => setTimeout(r, 2000));
                                    await nimesha.readMessages([message.key]).catch(() => {});
                                }
                            }
                        }
                    }
                }
            } catch (e) { console.log('AutoStatus handler error:', e.message); }
        }

        if (m.message && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            try { await storeMessage(m); } catch (e) {}
        }

        if (Math.random() < 0.1) { musicDownloader.cleanTemp(); }


        // ══════════════════════════════════════════════════════
        // ════════ AUTO RECORDING PRESENCE ════════════════════
        // ══════════════════════════════════════════════════════
        // user message receive කළාම recording presence show කරනවා
        if (set.autorecording && m.chat && !m.fromMe && m.isChats) {
            try {
                const userText = m.body || m.text || '';
                await nimesha.presenceSubscribe(m.chat);
                await nimesha.sendPresenceUpdate('available', m.chat);
                await new Promise(r => setTimeout(r, 500));
                await nimesha.sendPresenceUpdate('recording', m.chat);
                // message length අනුව recording delay — min 3s, max 8s
                const recDelay = Math.max(3000, Math.min(8000, userText.length * 150));
                await new Promise(r => setTimeout(r, recDelay));
                await nimesha.sendPresenceUpdate('paused', m.chat);
            } catch (e) { console.log('AutoRecording error:', e.message); }
        }

    } catch (e) { console.error('Main error:', e); }
};

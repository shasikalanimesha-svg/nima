const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec, execSync } = require('child_process');

const statusEmojis = ['❤️', '😍', '🤩', '😘', '🥰', '🤭', '😊', '💕', '✨'];
const messageStore = new Map();
const pendingDownload = new Map(); // song/video choice pending
const TEMP_MEDIA_DIR = path.join(__dirname, './database/temp');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

const getRandomEmoji = () => statusEmojis[Math.floor(Math.random() * statusEmojis.length)];

class MusicDownloader {
    constructor() {
        this.tempDir = TEMP_MEDIA_DIR;
        this.timeout = 120000;
    }

    async downloadMp3(input, progressCallback = null) {
        const methods = [
            // yt-dlp Methods (1-8)
            {
                name: 'yt-dlp (default)',
                cmd: () => `yt-dlp -x --audio-format mp3 --audio-quality 0 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (android)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (web)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=web" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (web_creator)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=web_creator" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (mweb)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=mweb" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (tv)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=tv" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (ios)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=ios" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (vr)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=vr" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },

            // youtube-dl Methods (9-14)
            {
                name: 'youtube-dl',
                cmd: () => `youtube-dl -x --audio-format mp3 --audio-quality 0 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'youtube-dl (legacy)',
                cmd: () => `youtube-dl -x --audio-format mp3 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'youtube-dl-nocookie',
                cmd: () => `youtube-dl --no-cookie -x --audio-format mp3 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (best)',
                cmd: () => `yt-dlp -f bestaudio -x --audio-format mp3 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (m4a->mp3)',
                cmd: () => `yt-dlp -x --audio-format mp3 --audio-quality 192 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (opus->mp3)',
                cmd: () => `yt-dlp -x --audio-format mp3 "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null && ffmpeg -i "${this.tempDir}/"*.opus -q:a 0 -map a "${this.tempDir}/%(title)s.mp3" 2>/dev/null`
            },

            // ytdl-core Methods (15-18)
            {
                name: 'ytdl-core',
                cmd: () => this._ytdlCore(input)
            },
            {
                name: 'ytdl-core (low-quality)',
                cmd: () => this._ytdlCoreLQ(input)
            },
            {
                name: 'ytdl-core (high-quality)',
                cmd: () => this._ytdlCoreHQ(input)
            },
            {
                name: 'ytdl-core (opus)',
                cmd: () => this._ytdlCoreOpus(input)
            },

            // play-dl Methods (19-22)
            {
                name: 'play-dl',
                cmd: () => this._playDl(input)
            },
            {
                name: 'play-dl (youtube)',
                cmd: () => this._playDlYouTube(input)
            },
            {
                name: 'play-dl (soundcloud)',
                cmd: () => this._playDlSoundCloud(input)
            },
            {
                name: 'play-dl (spotify)',
                cmd: () => this._playDlSpotify(input)
            },

            // ffmpeg Methods (23-26)
            {
                name: 'ffmpeg (direct)',
                cmd: () => `ffmpeg -i "${input}" -q:a 0 -map a "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },
            {
                name: 'ffmpeg (libmp3lame)',
                cmd: () => `ffmpeg -i "${input}" -codec:a libmp3lame -b:a 192k "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },
            {
                name: 'ffmpeg (aac->mp3)',
                cmd: () => `ffmpeg -i "${input}" -acodec libmp3lame -ab 192k "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },
            {
                name: 'ffmpeg (batch)',
                cmd: () => `ffmpeg -i "${input}" -f mp3 -ab 192000 -ar 44100 -ac 2 "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },

            // curl/wget Methods (27-30)
            {
                name: 'curl (direct)',
                cmd: () => `curl -L "${input}" | ffmpeg -i pipe: -q:a 0 -map a "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },
            {
                name: 'wget (direct)',
                cmd: () => `wget -q -O - "${input}" | ffmpeg -i pipe: -q:a 0 -map a "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },
            {
                name: 'aria2c (direct)',
                cmd: () => `aria2c -d "${this.tempDir}" -o "audio_${Date.now()}.mp3" "${input}" 2>/dev/null`
            },
            {
                name: 'sox (audio convert)',
                cmd: () => `sox "${input}" -c 2 -r 44100 "${this.tempDir}/audio_${Date.now()}.mp3" 2>/dev/null`
            },

            // ── API Methods (31-53) ─────────────────────────────────────
            {
                name: 'cobalt-api',
                cmd: () => this._cobaltApi(input)
            },
            {
                name: 'invidious-api',
                cmd: () => this._invidiousApi(input)
            },
            {
                name: 'rapidapi-mp36',
                cmd: () => this._rapidApiMp36(input)
            },
            {
                name: 'rapidapi-ytstream',
                cmd: () => this._rapidApiYtStream(input)
            },
            {
                name: 'cnvmp3',
                cmd: () => this._cnvMp3(input)
            },
            {
                name: 'ezmp3',
                cmd: () => this._ezMp3(input)
            },
            {
                name: 'yt1s',
                cmd: () => this._yt1s(input)
            },
            {
                name: 'loader.to',
                cmd: () => this._loaderTo(input)
            },
            {
                name: 'tomp3.cc',
                cmd: () => this._toMp3(input)
            },
            {
                name: 'savefrom',
                cmd: () => this._savefrom(input)
            },
            {
                name: 'notube',
                cmd: () => this._notube(input)
            },
            {
                name: 'ymp4',
                cmd: () => this._ymp4(input)
            },
            {
                name: 'converto',
                cmd: () => this._converto(input)
            },
            {
                name: 'mp3clan',
                cmd: () => this._mp3clan(input)
            },
            {
                name: 'ytbsave',
                cmd: () => this._ytbsave(input)
            },
            {
                name: 'ssyoutube',
                cmd: () => this._ssyoutube(input)
            },
            {
                name: 'yt-dlp (android_music)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android_music" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (android_creator)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android_creator" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (tv_embedded)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=tv_embedded" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (mediaconnect)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=mediaconnect" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (android_testsuite)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=android_testsuite" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (web_embedded)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=web_embedded" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            },
            {
                name: 'yt-dlp (ios_music)',
                cmd: () => `yt-dlp -x --audio-format mp3 --extractor-args "youtube:player_client=ios_music" "${input}" -o "${this.tempDir}/%(title)s.%(ext)s" 2>/dev/null`
            }
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
                        
                        ffmpeg(stream)
                            .audioBitrate(128)
                            .format('mp3')
                            .save(audioPath)
                            .on('end', () => {
                                if (fs.existsSync(audioPath)) resolve(audioPath);
                                else reject(new Error('File not created'));
                            })
                            .on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _ytdlCoreLQ(url) {
        return new Promise((resolve, reject) => {
            try {
                const ytdl = require('@distube/ytdl-core');
                const ffmpeg = require('fluent-ffmpeg');
                
                ytdl.getInfo(url, { requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } })
                    .then(info => {
                        const stream = ytdl.downloadFromInfo(info, { quality: 'lowestaudio' });
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        
                        ffmpeg(stream)
                            .audioBitrate(64)
                            .format('mp3')
                            .save(audioPath)
                            .on('end', () => {
                                if (fs.existsSync(audioPath)) resolve(audioPath);
                                else reject(new Error('File not created'));
                            })
                            .on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _ytdlCoreHQ(url) {
        return new Promise((resolve, reject) => {
            try {
                const ytdl = require('@distube/ytdl-core');
                const ffmpeg = require('fluent-ffmpeg');
                
                ytdl.getInfo(url, { requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } })
                    .then(info => {
                        const stream = ytdl.downloadFromInfo(info, { quality: 'highestaudio' });
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        
                        ffmpeg(stream)
                            .audioBitrate(320)
                            .format('mp3')
                            .save(audioPath)
                            .on('end', () => {
                                if (fs.existsSync(audioPath)) resolve(audioPath);
                                else reject(new Error('File not created'));
                            })
                            .on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _ytdlCoreOpus(url) {
        return new Promise((resolve, reject) => {
            try {
                const ytdl = require('@distube/ytdl-core');
                const ffmpeg = require('fluent-ffmpeg');
                
                ytdl.getInfo(url, { requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } })
                    .then(info => {
                        const stream = ytdl.downloadFromInfo(info, { quality: 'highestaudio' });
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        
                        ffmpeg(stream)
                            .audioCodec('libmp3lame')
                            .format('mp3')
                            .save(audioPath)
                            .on('end', () => {
                                if (fs.existsSync(audioPath)) resolve(audioPath);
                                else reject(new Error('File not created'));
                            })
                            .on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _playDl(url) {
        return new Promise((resolve, reject) => {
            try {
                const play = require('play-dl');
                play.stream(url)
                    .then(stream => {
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        const file = fs.createWriteStream(audioPath);
                        
                        stream.pipe(file);
                        file.on('finish', () => {
                            if (fs.existsSync(audioPath)) resolve(audioPath);
                            else reject(new Error('File not created'));
                        });
                        file.on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _playDlYouTube(url) {
        return new Promise((resolve, reject) => {
            try {
                const play = require('play-dl');
                play.stream(url, { discordPlayerCompatibility: true })
                    .then(stream => {
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        const file = fs.createWriteStream(audioPath);
                        
                        stream.pipe(file);
                        file.on('finish', () => {
                            if (fs.existsSync(audioPath)) resolve(audioPath);
                            else reject(new Error('File not created'));
                        });
                        file.on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _playDlSoundCloud(url) {
        return new Promise((resolve, reject) => {
            try {
                const play = require('play-dl');
                play.soundcloud(url)
                    .then(async data => {
                        const stream = await data.stream();
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        const file = fs.createWriteStream(audioPath);
                        
                        stream.pipe(file);
                        file.on('finish', () => {
                            if (fs.existsSync(audioPath)) resolve(audioPath);
                            else reject(new Error('File not created'));
                        });
                        file.on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    }

    async _playDlSpotify(url) {
        return new Promise((resolve, reject) => {
            try {
                const play = require('play-dl');
                play.spotify(url)
                    .then(async data => {
                        const stream = await data.stream();
                        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
                        const file = fs.createWriteStream(audioPath);
                        
                        stream.pipe(file);
                        file.on('finish', () => {
                            if (fs.existsSync(audioPath)) resolve(audioPath);
                            else reject(new Error('File not created'));
                        });
                        file.on('error', reject);
                    })
                    .catch(reject);
            } catch (err) {
                reject(err);
            }
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
        } catch (err) {
            throw err;
        }
    }

    async downloadByUrl(url, progressCallback = null) {
        return this.downloadMp3(url, progressCallback);
    }


    // ════════════════════════════════════════════════════════════════
    //   API HELPER METHODS (31-53)
    // ════════════════════════════════════════════════════════════════

    _getVideoId(url) {
        return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&\n?#]+)/)?.[1] || null;
    }

    async _fetch(url, options = {}) {
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        return (await fetch)(url, { ...options, signal: AbortSignal.timeout(options.timeout || 25000) });
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
        const instanceRes = await fetchFn('https://instances.cobalt.best/api/instances.json', { signal: AbortSignal.timeout(8000) });
        const instances = await instanceRes.json();
        const cobaltList = (instances || []).filter(i => i.online && i.services?.youtube).sort((a,b) => (b.score||0)-(a.score||0)).slice(0,5).map(i => `${i.protocol||'https'}://${i.api}`);
        const allInst = [...cobaltList, 'https://api.cobalt.tools', 'https://cobalt.oisd.nl'];
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
        const instances = ['https://inv.nadeko.net','https://invidious.privacyredirect.com','https://invidious.nerdvpn.de','https://yt.artemislena.eu','https://invidious.lunar.icu','https://iv.datura.network'];
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const fetchFn = await fetch;
        for (const inst of instances) {
            try {
                const r = await fetchFn(`${inst}/api/v1/videos/${videoId}?fields=adaptiveFormats`, { signal: AbortSignal.timeout(8000) });
                const d = await r.json();
                const fmt = (d.adaptiveFormats||[]).filter(f=>f.type?.includes('audio')).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0];
                if (fmt?.url) {
                    const dlUrl = fmt.url.replace(/^https:\/\/[^/]+/, inst);
                    return await this._downloadUrlToFile(dlUrl);
                }
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

    async _rapidApiYtStream(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const RAPID_KEY = '3bde5a3ca1msh6a3c2e0e02d1fdap142e7bjsn8f5a2e0e3c4a';
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${videoId}`, { headers: { 'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(30000) });
        const d = await r.json();
        const link = d?.link || d?.url || d?.formats?.['140']?.url;
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

    async _ezMp3(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)('https://ezmp3.cc/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ id: videoId }), signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        if (!d?.url && !d?.link) throw new Error('no link');
        return await this._downloadUrlToFile(d.url || d.link);
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

    async _toMp3(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://tomp3.cc/api/json?id=${videoId}&format=mp3`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://tomp3.cc/' }, signal: AbortSignal.timeout(25000) });
        const d = await r.json();
        if (!d?.link) throw new Error('no link');
        return await this._downloadUrlToFile(d.link);
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

    async _notube(url) {
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)('https://notube.net/api/button/?api=dfcb6d76f2f6a9894gjkege8a4ab232222', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        if (!d?.url) throw new Error('no link');
        return await this._downloadUrlToFile(d.url);
    }

    async _ymp4(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)('https://ymp4.download/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, format: 'mp3' }), signal: AbortSignal.timeout(25000) });
        const d = await r.json();
        if (!d?.url) throw new Error('no link');
        return await this._downloadUrlToFile(d.url);
    }

    async _converto(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://www.converto.io/download-api/fetch?url=https://www.youtube.com/watch?v=${videoId}&format=mp3&video=false`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.converto.io/' }, signal: AbortSignal.timeout(25000) });
        const d = await r.json();
        const link = d?.link || d?.url;
        if (!link) throw new Error('no link');
        return await this._downloadUrlToFile(link);
    }

    async _mp3clan(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://mp3clan.com/app/mp3Search.php?q=${videoId}&count=1`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        const link = d?.response?.[0]?.url || d?.response?.[0]?.mp3;
        if (!link) throw new Error('no link');
        return await this._downloadUrlToFile(link);
    }

    async _ytbsave(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://ytbsave.com/api/convert?url=https://www.youtube.com/watch?v=${videoId}&format=mp3`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        const d = await r.json();
        if (!d?.url) throw new Error('no link');
        return await this._downloadUrlToFile(d.url);
    }

    async _ssyoutube(url) {
        const videoId = this._getVideoId(url);
        if (!videoId) throw new Error('Invalid YT URL');
        const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
        const r = await (await fetch)(`https://ssyoutube.com/api/convert?id=${videoId}&type=mp3`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
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

                if (typeof cmd === 'string') {
                    await this._exec(cmd);
                }
                
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
            exec(cmd, {
                maxBuffer: 1024 * 1024 * 500,
                timeout: this.timeout,
                shell: '/bin/bash'
            }, (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout);
            });
        });
    }

    cleanTemp() {
        try {
            const files = fs.readdirSync(this.tempDir);
            let size = 0;
            for (const file of files) {
                const stat = fs.statSync(path.join(this.tempDir, file));
                size += stat.size;
            }
            if (size > 100 * 1024 * 1024) {
                for (const file of files) {
                    fs.unlinkSync(path.join(this.tempDir, file));
                }
            }
        } catch (err) {
            console.error('පිරිසිදු කිරීමේ දෝෂය:', err);
        }
    }
}

const musicDownloader = new MusicDownloader();

async function storeMessage(message) {
    try {
        if (!message.key?.id) return;

        const messageId = message.key.id;
        let content = '';
        const sender = message.key.participant || message.key.remoteJid;

        if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        }

        messageStore.set(messageId, {
            content,
            sender,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('පණිවිඩ store දෝෂය:', err);
    }
}

module.exports = shasikala = async (nimesha, m, msg, store) => {
    try {
        // බොට් අංකය සහ සැකසුම් ලබාගැනීම
        const botNumber = nimesha.decodeJid(nimesha.user.id);
        const set = global.db?.set?.[botNumber] || {};
        const botFooter = global.db?.set?.[botNumber]?.botname
            ? `> 🌸 *${global.db.set[botNumber].botname}* [BOT]✨`
            : global.mess?.footer || '> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _නිමේශ මධුශන් විසින් සිතුවම්විය_ _';

        // ══════════════════════════════════════════════════
        // STEP 1: user 1/2/3 reply කළාම handle කිරීම
        // pendingDownload map check — prefix නෑ, body = "1"/"2"/"3"
        // ══════════════════════════════════════════════════
        const rawBody = (m.body || m.text || '').trim();
        if (/^[123456]$/.test(rawBody) && pendingDownload.has(m.sender)) {
            const choice = rawBody;
            const pending = pendingDownload.get(m.sender);
            pendingDownload.delete(m.sender);

            // ══════════════════════
            // ගීතය download කිරීම
            // ══════════════════════
            if (pending.type === 'song') {
                const formatNames = { '1': 'Audio 🎵', '2': 'හඬ සටහන 🎤', '3': 'ලිපිගොනු 📄' };

                // MSG 1 continue — same message edit (searching/select message key)
                const statusKey = pending.statusKey;
                await nimesha.sendMessage(m.chat, {
                    text: `⬇️ *බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${pending.displayTitle}\n🎶 *ආකෘතිය:* ${formatNames[choice]}\n⏳ YouTube සම්බන්ධ කරමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                    edit: statusKey
                });
                const statusMsg = { key: statusKey };

                try {
                    // Download ක්‍රම progress — fail නම් edit, success නම් final line set කිරීම
                    let successLine = '';
                    const progressCallback = async (num, methodName, success, total) => {
                        try {
                            if (success) {
                                // හරිගිය line save කිරීම — uploading message හි use කිරීමට
                                successLine = '✅ *' + num + '/' + total + '* — `' + methodName + '` → සාර්ථකයි';
                                // downloading message හි success line edit
                                await nimesha.sendMessage(m.chat, {
                                    text: '⬇️ *බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ' + pending.displayTitle + '\n🎶 *ආකෘතිය:* ' + formatNames[choice] + '\n━━━━━━━━━━━━━━━━━━━━━━\n' + successLine + '\n━━━━━━━━━━━━━━━━━━━━━━\n' + botFooter
                                , edit: statusMsg.key });
                            } else {
                                // අසාර්ථක නම් — edit කරමින් ඊළඟ try පෙන්වීම
                                await nimesha.sendMessage(m.chat, {
                                    text: '⬇️ *බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ' + pending.displayTitle + '\n🎶 *ආකෘතිය:* ' + formatNames[choice] + '\n━━━━━━━━━━━━━━━━━━━━━━\n🔄 *' + num + '/' + total + '* — `' + methodName + '` → අසාර්ථකයි, ඊළඟ උත්සාහය...\n━━━━━━━━━━━━━━━━━━━━━━\n' + botFooter
                                , edit: statusMsg.key });
                            }
                        } catch (e) {}
                    };

                    // URL නම් directly, නැතිනම් search කළ URL
                    let downloadResult;
                    if (pending.url && pending.url.match(/https?:\/\//)) {
                        downloadResult = await musicDownloader.downloadByUrl(pending.url, progressCallback);
                    } else {
                        downloadResult = await musicDownloader.searchAndDownload(pending.input, progressCallback);
                    }

                    // Download අසාර්ථක නම්
                    if (!downloadResult || !downloadResult.success) {
                        await nimesha.sendMessage(m.chat, {
                            text: `❌ *බාගැනීම අසාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${pending.displayTitle}\n⚠️ *දෝෂය:* ${downloadResult?.error || 'නොදන්නා දෝෂයකි'}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                        , edit: statusMsg.key });
                        return;
                    }

                    const audioBuffer = fs.readFileSync(downloadResult.filePath);

                    // uploading — media යැවීමට කලින් edit
                    await nimesha.sendMessage(m.chat, {
                        text: '📤 *WhatsApp වෙත යවමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ' + pending.displayTitle + '\n🎶 *ආකෘතිය:* ' + formatNames[choice] + '\n━━━━━━━━━━━━━━━━━━━━━━\n' + successLine + '\n━━━━━━━━━━━━━━━━━━━━━━\n⏳ Upload කරමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n' + botFooter
                    , edit: statusMsg.key });

                    // Media send — new message
                    if (choice === '1') {
                        await nimesha.sendMessage(m.chat, {
                            audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false,
                            fileName: `${pending.displayTitle.substring(0, 40)}.mp3`,
                            caption: `> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _`
                        }, { quoted: m });
                    } else if (choice === '2') {
                        await nimesha.sendMessage(m.chat, {
                            audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true,
                            caption: `> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _`
                        }, { quoted: m });
                    } else if (choice === '3') {
                        await nimesha.sendMessage(m.chat, {
                            document: audioBuffer, mimetype: 'audio/mpeg',
                            fileName: `${pending.displayTitle.substring(0, 40)}.mp3`,
                            caption: `> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _`
                        }, { quoted: m });
                    }

                    // Done — media ගිය පසු edit
                    await nimesha.sendMessage(m.chat, {
                        text: '✅ *සාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ' + pending.displayTitle + '\n🎶 *ආකෘතිය:* ' + formatNames[choice] + '\n━━━━━━━━━━━━━━━━━━━━━━\n' + botFooter
                    , edit: statusMsg.key });

                    // තාවකාලික ගොනුව මකාදැමීම
                    try { fs.unlinkSync(downloadResult.filePath); } catch (e) {}

                } catch (err) {
                    await nimesha.sendMessage(m.chat, {
                        text: `❌ *දෝෂයකි!*\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ ${err.message.substring(0, 150)}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });
                }
            }

            // ══════════════════════
            // වීඩියෝ download කිරීම
            // ══════════════════════
            if (pending.type === 'video') {
                const qualityMap = { '1': '144', '2': '360', '3': '720', '4': '144', '5': '360', '6': '720' };
                const isDoc = ['4','5','6'].includes(choice);
                const quality = qualityMap[choice];

                // MSG 1 continue — same message edit (searching/select message key)
                const statusKey = pending.statusKey;
                await nimesha.sendMessage(m.chat, {
                    text: `⬇️ *වීඩියෝ බාගනිමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *තත්ත්වය:* ${quality}p\n⏳ ගොනුව ලබාගනිමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`,
                    edit: statusKey
                });
                const statusMsg = { key: statusKey };

                try {
                    const { exec } = require('child_process');
                    const outputPath = path.join(TEMP_MEDIA_DIR, `video_${Date.now()}.mp4`);

                    // Quality filter
                    const qualityFilter = quality === '144'
                        ? 'bestvideo[height<=144]+bestaudio/worst'
                        : quality === '360'
                        ? 'bestvideo[height<=360]+bestaudio/best[height<=360]'
                        : 'bestvideo[height<=720]+bestaudio/best[height<=720]';

                    await new Promise((res, rej) => {
                        exec(`yt-dlp -f "${qualityFilter}" --merge-output-format mp4 --no-playlist -o "${outputPath}" "${pending.url}"`,
                            (err, stdout, stderr) => {
                                if (err) return rej(new Error(stderr || err.message));
                                res();
                            });
                    });

                    const videoBuffer = fs.readFileSync(outputPath);
                    try { fs.unlinkSync(outputPath); } catch (e) {}

                    // uploading — media යැවීමට කලින් edit
                    await nimesha.sendMessage(m.chat, {
                        text: `📤 *WhatsApp වෙත යවමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *තත්ත්වය:* ${quality}p\n━━━━━━━━━━━━━━━━━━━━━━\n⏳ Upload කරමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });

                    // Video send — new message (video or document)
                    if (isDoc) {
                        await nimesha.sendMessage(m.chat, {
                            document: videoBuffer,
                            mimetype: 'video/mp4',
                            fileName: `${pending.displayTitle.substring(0, 40)}.mp4`,
                            caption: `🎬 *${pending.displayTitle}*\n📺 *තත්ත්වය:* ${quality}p (📄 document)\n> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _`
                        }, { quoted: m });
                    } else {
                        await nimesha.sendMessage(m.chat, {
                            video: videoBuffer,
                            caption: `🎬 *${pending.displayTitle}*\n📺 *තත්ත්වය:* ${quality}p\n> 🌸 *MISS SHASIKALA* [BOT]✨ | 👑 _CREATED BY *NIMESHA MADHUSHAN* _`
                        }, { quoted: m });
                    }

                    // Done — media ගිය පසු edit
                    await nimesha.sendMessage(m.chat, {
                        text: `✅ *සාර්ථකයි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${pending.displayTitle}\n📺 *තත්ත්වය:* ${quality}p\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });

                } catch (err) {
                    await nimesha.sendMessage(m.chat, {
                        text: `❌ *වීඩියෝ දෝෂයකි!*\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ ${err.message.substring(0, 150)}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });
                }
            }
            return;
        }

        // ══════════════════════════════════════
        // STEP 2: .song / .mp3 / .play command
        // ══════════════════════════════════════
        const songCommands = ['mp3', 'song', 'play'];
        for (const cmd of songCommands) {
            if (m.command === cmd) {
                // command ඉවත් කර ගීත නාමය ලබාගැනීම
                const input = m.args && m.args.length > 0 ? m.args.join(' ').trim() : '';
                if (!input) {
                    await nimesha.sendMessage(m.chat, {
                        text: `⚠️ ගීත නාමය ඇතුළත් කරන්න!\nඋදාහරණ: ${m.prefix || '.'}${cmd} Shape of You\n${botFooter}`
                    }, { quoted: m });
                    break;
                }

                try {
                    // පියවර 1: Searching message — user command ට quoted reply
                    let statusMsg = await nimesha.sendMessage(m.chat, {
                        text: `🔍 *සොයමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ඉල්ලුම:* ${input}\n⏳ YouTube හි සොයමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    }, { quoted: m });

                    // YouTube search
                    let displayTitle = input;
                    let videoUrl = input;
                    if (!input.match(/https?:\/\//)) {
                        try {
                            const yts = require('yt-search');
                            const searchRes = await yts(input);
                            const video = searchRes?.videos?.[0] || searchRes?.all?.[0];
                            if (video) {
                                const _vid = video.videoId || video.url?.match(/(?:v=|youtu\.be\/)([^&?#]+)/)?.[1];
                                if (_vid) {
                                    videoUrl = `https://www.youtube.com/watch?v=${_vid}`;
                                    displayTitle = video.title || input;
                                }
                            }
                        } catch (e) {}
                    }

                    // Pending — statusMsg.key ද save (download handler ට same message edit)
                    pendingDownload.set(m.sender, { type: 'song', input, url: videoUrl, displayTitle, statusKey: statusMsg?.key });

                    // පියවර 2: Choice message — searching message edit
                    await nimesha.sendMessage(m.chat, {
                        text: `🎯 *හමු වුණා!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎵 *ගීතය:* ${displayTitle}\n🔗 ${videoUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n\n🎶 *Download ආකෘතිය තෝරන්න:*\n\n1️⃣ Audio (🎵 mp3)\n2️⃣ හඬ සටහන (🎤 voice note)\n3️⃣ ලිපිගොනු (📄 document)\n\n📩 *අංකයක් reply කරන්න (1/2/3)*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });

                } catch (err) {
                    console.error('ගීත සෙවීමේ දෝෂය:', err);
                    await nimesha.sendMessage(m.chat, {
                        text: `⚠️ *දෝෂයකි:* ${err.message}\n${botFooter}`
                    }, { quoted: m });
                }
                break;
            }
        }

        // ══════════════════════════════════════
        // STEP 3: .video / .mp4 / .ytmp4 command
        // ══════════════════════════════════════
        const videoCommands = ['video', 'mp4', 'ytmp4', 'ytvideo', 'ytplayvideo'];
        for (const cmd of videoCommands) {
            if (m.command === cmd) {
                // command ඉවත් කර වීඩියෝ නාමය/URL ලබාගැනීම
                const input = m.args && m.args.length > 0 ? m.args.join(' ').trim() : '';
                if (!input) {
                    await nimesha.sendMessage(m.chat, {
                        text: `⚠️ වීඩියෝ නාමය ඇතුළත් කරන්න!\nඋදාහරණ: ${m.prefix || '.'}${cmd} Avengers\n${botFooter}`
                    }, { quoted: m });
                    break;
                }

                try {
                    let videoUrl = input;
                    let displayTitle = input;

                    // පියවර 1: Searching message — user command ට quoted reply
                    let statusMsg = await nimesha.sendMessage(m.chat, {
                        text: `🔍 *සොයමින්...*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *ඉල්ලුම:* ${input}\n⏳ YouTube හි සොයමින්...\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    }, { quoted: m });

                    // URL නොමැති නම් YouTube search
                    if (!input.match(/https?:\/\//)) {
                        const yts = require('yt-search');
                        const searchRes = await yts(input);
                        const video = searchRes?.videos?.[0] || searchRes?.all?.[0];
                        if (!video) {
                            await nimesha.sendMessage(m.chat, {
                                text: `❌ *YouTube හි හමු නොවිණි!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *ඉල්ලුම:* ${input}\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                            , edit: statusMsg.key });
                            break;
                        }
                        const _vid = video.videoId || video.url?.match(/(?:v=|youtu\.be\/)([^&?#]+)/)?.[1];
                        if (_vid) videoUrl = `https://www.youtube.com/watch?v=${_vid}`;
                        displayTitle = video.title || input;
                    }

                    // Pending — statusMsg.key ද save (download handler ට same message edit)
                    pendingDownload.set(m.sender, { type: 'video', input, url: videoUrl, displayTitle, statusKey: statusMsg?.key });

                    // පියවර 2: Choice message — searching message edit
                    await nimesha.sendMessage(m.chat, {
                        text: `🎯 *හමු වුණා!*\n━━━━━━━━━━━━━━━━━━━━━━\n🎬 *වීඩියෝ:* ${displayTitle}\n🔗 ${videoUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n\n📺 *Video ආකෘතිය තෝරන්න:*\n1️⃣ 144p\n2️⃣ 360p\n3️⃣ 720p\n4️⃣ 144p (📄 document)\n5️⃣ 360p (📄 document)\n6️⃣ 720p (📄 document)\n\n📩 *අංකයක් reply කරන්න (1-6)*\n━━━━━━━━━━━━━━━━━━━━━━\n${botFooter}`
                    , edit: statusMsg.key });

                } catch (err) {
                    await nimesha.sendMessage(m.chat, {
                        text: `⚠️ *දෝෂයකි:* ${err.message}\n${botFooter}`
                    }, { quoted: m });
                }
                break;
            }
        }

        // ══════════════════════════════════════
        // Auto Status react
        // ══════════════════════════════════════
        if (m.messages && Object.values(m.messages).some(msg => msg?.message?.statusMessage)) {
            try {
                if (set.autostatus) {
                    for (const message of Object.values(m.messages)) {
                        if (message?.message?.statusMessage) {
                            const statusSender = message.key.participant || message.key.remoteJid;
                            const emoji = getRandomEmoji();
                            try {
                                await nimesha.sendMessage(statusSender, {
                                    react: { text: emoji, key: message.key }
                                }).catch(() => {});
                                console.log(`❤️ AutoStatus - @${statusSender.split('@')[0]} ට ${emoji}`);
                            } catch (e) {
                                console.log('AutoStatus දෝෂය:', e.message);
                            }
                        }
                    }
                }
            } catch (e) {
                console.log('AutoStatus handler දෝෂය:', e.message);
            }
        }

        // Quoted message store
        if (m.message && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            try {
                await storeMessage(m);
            } catch (e) {
                console.error('Message store දෝෂය:', e);
            }
        }

        // Temp file cleanup (10% chance per message)
        if (Math.random() < 0.1) {
            musicDownloader.cleanTemp();
        }

    } catch (e) {
        console.error('ප්‍රධාන දෝෂය:', e);
    }
};

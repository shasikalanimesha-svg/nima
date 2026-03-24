/**
 * ═══════════════════════════════════════════════════════════════
 *   ULTIMATE Downloader - lib/scraper.js
 *   ── YouTube MP3/MP4 (14 methods)
 *   ── Instagram (photo/video/reels/stories)
 *   ── TikTok (video/audio/slideshow)
 *   ── Facebook (video HD/SD)
 *   ── Twitter/X (video/gif)
 *   ── Pinterest (image/video)
 *   ── Threads (image/video)
 *   ── Snapchat (spotlight)
 *   ── Reddit (video/image/gif)
 *   ── LinkedIn (video)
 *   ── Dailymotion (video)
 *   ── Vimeo (video)
 *   ── SoundCloud (audio)
 *   ── Spotify (audio via spotifydl)
 *   ── MediaFire (file)
 *   ── Google Play APK (via APKPure/APKCombo)
 *   ── General URL downloader (yt-dlp fallback)
 *   ── ATTP animated sticker (multi-API)
 * ═══════════════════════════════════════════════════════════════
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ── Helpers ─────────────────────────────────────────────────────
function getVideoId(url) {
	return url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([^&\n?#]+)/)?.[1] || null;
}

async function bytesToSize(bytes) {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes === 0) return 'n/a';
	const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
	return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

function run(cmd, timeoutMs = 60000) {
	return new Promise((res, rej) => {
		const child = exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, (err, stdout, stderr) => {
			if (err) return rej(new Error((stderr || err.message).substring(0, 400)));
			res(stdout.trim());
		});
		setTimeout(() => { try { child.kill(); } catch {} rej(new Error('timeout')); }, timeoutMs);
	});
}

async function getBuffer(url) {
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
		signal: AbortSignal.timeout(30000)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

// ════════════════════════════════════════════════════════════════
//   YOUTUBE - 14 METHODS
// ════════════════════════════════════════════════════════════════
async function getYtInfo(url) {
	try {
		const videoId = getVideoId(url);
		if (!videoId) return {};
		const res = await fetch(`https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`, {
			signal: AbortSignal.timeout(5000)
		});
		const data = await res.json();
		return {
			title: data.title || 'YouTube',
			channel: data.author_name || '',
			thumb: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
			uploadDate: ''
		};
	} catch { return { title: 'YouTube', channel: '', thumb: '', uploadDate: '' }; }
}

const RAPID_KEY = '3bde5a3ca1msh6a3c2e0e02d1fdap142e7bjsn8f5a2e0e3c4a';
const INVIDIOUS_INSTANCES = [
	'https://inv.nadeko.net', 'https://invidious.privacyredirect.com',
	'https://invidious.nerdvpn.de', 'https://yt.artemislena.eu',
	'https://invidious.lunar.icu', 'https://iv.datura.network',
	'https://invidious.perennialte.ch', 'https://invidious.tiekoetter.com',
];

async function getCobaltInstances() {
	try {
		const res = await fetch('https://instances.cobalt.best/api/instances.json', {
			signal: AbortSignal.timeout(8000)
		});
		const data = await res.json();
		return (data || [])
			.filter(i => i.online && i.services?.youtube === true)
			.sort((a, b) => (b.score || 0) - (a.score || 0))
			.slice(0, 6)
			.map(i => `${i.protocol || 'https'}://${i.api}`);
	} catch {
		return ['https://api.cobalt.tools', 'https://cobalt.oisd.nl'];
	}
}

function ytdlpCmd(url, format, extraArgs = '') {
	return run(`yt-dlp --no-playlist --no-warnings ${extraArgs} ${format} --get-url "${url}"`, 50000);
}

const YT_METHODS_AUDIO = (url, videoId) => [
	{ name: 'yt-dlp mweb', fn: () => ytdlpCmd(url, '-f "bestaudio"', '--extractor-args "youtube:player_client=mweb,web_creator"') },
	{ name: 'yt-dlp android', fn: () => ytdlpCmd(url, '-f "bestaudio[ext=m4a]/bestaudio"', '--extractor-args "youtube:player_client=android"') },
	{ name: 'yt-dlp ios', fn: () => ytdlpCmd(url, '-f "bestaudio"', '--extractor-args "youtube:player_client=ios"') },
	{ name: 'yt-dlp tv_embedded', fn: () => ytdlpCmd(url, '-f "bestaudio"', '--extractor-args "youtube:player_client=tv_embedded"') },
	{ name: 'cobalt', fn: async () => {
		const instances = await getCobaltInstances();
		for (const inst of instances) {
			try {
				const r = await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }), signal: AbortSignal.timeout(12000) });
				const d = await r.json();
				if (d?.url) return d.url;
			} catch {}
		}
		throw new Error('cobalt: all failed');
	}},
	{ name: 'invidious', fn: async () => {
		for (const inst of INVIDIOUS_INSTANCES) {
			try {
				const r = await fetch(`${inst}/api/v1/videos/${videoId}?fields=adaptiveFormats`, { signal: AbortSignal.timeout(8000) });
				const d = await r.json();
				const fmt = (d.adaptiveFormats || []).filter(f => f.type?.includes('audio')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
				if (fmt?.url) return fmt.url.replace(/^https:\/\/[^/]+/, inst);
			} catch {}
		}
		throw new Error('invidious: all failed');
	}},
	{ name: 'rapidapi-mp36', fn: async () => {
		const r = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, { headers: { 'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(30000) });
		const d = await r.json(); if (!d?.link) throw new Error('no link'); return d.link;
	}},
	{ name: 'rapidapi-v1', fn: async () => {
		const r = await fetch(`https://youtube-mp3-download1.p.rapidapi.com/dl?id=${videoId}`, { headers: { 'x-rapidapi-host': 'youtube-mp3-download1.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(30000) });
		const d = await r.json();
		if (d?.status === 'processing') { for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 4000)); const r2 = await fetch(`https://youtube-mp3-download1.p.rapidapi.com/dl?id=${videoId}`, { headers: { 'x-rapidapi-host': 'youtube-mp3-download1.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY } }); const d2 = await r2.json(); if (d2?.link) return d2.link; } }
		if (!d?.link) throw new Error('no link'); return d.link;
	}},
	{ name: 'cnvmp3', fn: async () => {
		const r = await fetch(`https://cnvmp3.com/api.php?url=https://www.youtube.com/watch?v=${videoId}&format=mp3&quality=128`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://cnvmp3.com/' }, signal: AbortSignal.timeout(20000) });
		const d = await r.json(); if (!d?.url) throw new Error('no link'); return d.url;
	}},
	{ name: 'ezmp3', fn: async () => {
		const r = await fetch('https://ezmp3.cc/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://ezmp3.cc/' }, body: new URLSearchParams({ id: videoId }), signal: AbortSignal.timeout(20000) });
		const d = await r.json(); if (!d?.url && !d?.link) throw new Error('no link'); return d.url || d.link;
	}},
	{ name: 'yt-dlp web_creator', fn: () => ytdlpCmd(url, '-f "bestaudio"', '--extractor-args "youtube:player_client=web_creator"') },
	{ name: 'yt-dlp mediaconnect', fn: () => ytdlpCmd(url, '-f "bestaudio"', '--extractor-args "youtube:player_client=mediaconnect"') },
];

const YT_METHODS_VIDEO = (url, videoId) => [
	{ name: 'yt-dlp mweb', fn: () => ytdlpCmd(url, '-f "best[height<=480]"', '--extractor-args "youtube:player_client=mweb,web_creator"') },
	{ name: 'yt-dlp android', fn: () => ytdlpCmd(url, '-f "best[height<=480][ext=mp4]/best[height<=480]"', '--extractor-args "youtube:player_client=android"') },
	{ name: 'yt-dlp ios', fn: () => ytdlpCmd(url, '-f "best[height<=360]"', '--extractor-args "youtube:player_client=ios"') },
	{ name: 'yt-dlp tv_embedded', fn: () => ytdlpCmd(url, '-f "best[height<=480]"', '--extractor-args "youtube:player_client=tv_embedded"') },
	{ name: 'cobalt', fn: async () => {
		const instances = await getCobaltInstances();
		for (const inst of instances) {
			try {
				const r = await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'auto', videoQuality: '720' }), signal: AbortSignal.timeout(12000) });
				const d = await r.json(); if (d?.url) return d.url;
			} catch {}
		}
		throw new Error('cobalt: all failed');
	}},
	{ name: 'invidious', fn: async () => {
		for (const inst of INVIDIOUS_INSTANCES) {
			try {
				const r = await fetch(`${inst}/api/v1/videos/${videoId}?fields=formatStreams`, { signal: AbortSignal.timeout(8000) });
				const d = await r.json();
				const fmt = (d.formatStreams || []).filter(f => f.type?.includes('video/mp4')).sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution))[0];
				if (fmt?.url) return fmt.url.replace(/^https:\/\/[^/]+/, inst);
			} catch {}
		}
		throw new Error('invidious: all failed');
	}},
	{ name: 'yt-dlp web_creator', fn: () => ytdlpCmd(url, '-f "best[height<=480]"', '--extractor-args "youtube:player_client=web_creator"') },
	{ name: 'yt-dlp mediaconnect', fn: () => ytdlpCmd(url, '-f "best[height<=480]"', '--extractor-args "youtube:player_client=mediaconnect"') },
];

async function runMethods(methods, label) {
	for (const m of methods) {
		try {
			console.log(`[${label}] Trying: ${m.name}`);
			const result = await m.fn();
			const url = typeof result === 'string' ? result.split('\n')[0] : result;
			if (url) { console.log(`[${label}] ✅ ${m.name}`); return url; }
		} catch (e) {
			console.log(`[${label}] ❌ ${m.name}: ${e.message}`);
		}
	}
	throw new Error(`සියලු ${label} methods fail වුණා!`);
}

async function ytMp3(url) {
	const videoId = getVideoId(url);
	if (!videoId) throw new Error('Invalid YouTube URL');
	const info = await getYtInfo(url);
	const dlUrl = await runMethods(YT_METHODS_AUDIO(url, videoId), 'ytMp3');
	return { title: info.title || 'YouTube Audio', result: { url: dlUrl }, size: 'Unknown', thumb: info.thumb || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, views: 0, likes: 0, dislike: 0, channel: info.channel || '', uploadDate: '', desc: '' };
}

async function ytMp4(url) {
	const videoId = getVideoId(url);
	if (!videoId) throw new Error('Invalid YouTube URL');
	const info = await getYtInfo(url);
	const dlUrl = await runMethods(YT_METHODS_VIDEO(url, videoId), 'ytMp4');
	return { title: info.title || 'YouTube Video', result: { url: dlUrl }, size: 'Unknown', thumb: info.thumb || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, views: 0, likes: 0, dislike: 0, channel: info.channel || '', uploadDate: '', desc: '' };
}

// ════════════════════════════════════════════════════════════════
//   INSTAGRAM - multi-method
// ════════════════════════════════════════════════════════════════
async function igDownload(url) {
	const methods = [
		// Method 1: yt-dlp
		{ name: 'ytdlp', fn: async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 35000);
			const info = JSON.parse(out);
			if (info.entries) {
				return { type: 'album', items: info.entries.map(e => ({ url: e.url, is_video: e.ext !== 'jpg' && e.ext !== 'jpeg' })), caption: info.title || '' };
			}
			return { type: info.ext === 'mp4' ? 'video' : 'image', url: info.url, caption: info.title || '' };
		}},
		// Method 2: saveig.app
		{ name: 'saveig', fn: async () => {
			const res = await fetch('https://v3.saveig.app/api/ajaxSearch', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ q: url, t: 'media', lang: 'en' }), signal: AbortSignal.timeout(20000) });
			const data = await res.json();
			const html = data?.data || '';
			const links = [...html.matchAll(/href="(https:\/\/[^"]+\.(mp4|jpg|jpeg|png)[^"]*)"/g)].map(m => m[1]);
			if (!links.length) throw new Error('no links');
			return links.length === 1 ? { type: links[0].includes('.mp4') ? 'video' : 'image', url: links[0], caption: '' } : { type: 'album', items: links.map(u => ({ url: u, is_video: u.includes('.mp4') })), caption: '' };
		}},
		// Method 3: snapinsta
		{ name: 'snapinsta', fn: async () => {
			const r1 = await fetch('https://snapinsta.app/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) });
			const html1 = await r1.text();
			const token = html1.match(/name="_token"\s+value="([^"]+)"/)?.[1];
			if (!token) throw new Error('no token');
			const r2 = await fetch('https://snapinsta.app/action.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest' }, body: new URLSearchParams({ url, _token: token }), signal: AbortSignal.timeout(25000) });
			const data = await r2.json();
			const links = [...(data?.data || '').matchAll(/href="(https:\/\/[^"]+\.(mp4|jpg)[^"]*)"/g)].map(m => m[1]);
			if (!links.length) throw new Error('no links');
			return links.length === 1 ? { type: links[0].includes('.mp4') ? 'video' : 'image', url: links[0], caption: '' } : { type: 'album', items: links.map(u => ({ url: u, is_video: u.includes('.mp4') })), caption: '' };
		}},
		// Method 4: instasave API
		{ name: 'instasave', fn: async () => {
			const res = await fetch(`https://instasave.website/api`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) });
			const data = await res.json();
			if (!data?.data?.length) throw new Error('no data');
			const items = data.data.map(d => ({ url: d.url, is_video: d.type === 'video' }));
			return items.length === 1 ? { type: items[0].is_video ? 'video' : 'image', url: items[0].url, caption: '' } : { type: 'album', items, caption: '' };
		}},
		// Method 5: igram.io
		{ name: 'igram', fn: async () => {
			const res = await fetch('https://igram.world/api/convert', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://igram.world/' }, body: new URLSearchParams({ url, lang: 'en' }), signal: AbortSignal.timeout(20000) });
			const data = await res.json();
			const items = (data?.data || []).map(d => ({ url: d.url, is_video: d.type?.includes('video') })).filter(d => d.url);
			if (!items.length) throw new Error('no data');
			return items.length === 1 ? { type: items[0].is_video ? 'video' : 'image', url: items[0].url, caption: '' } : { type: 'album', items, caption: '' };
		}},
		// Method 6: cobalt
		{ name: 'cobalt', fn: async () => {
			const instances = await getCobaltInstances();
			for (const inst of instances) {
				try {
					const r = await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'auto' }), signal: AbortSignal.timeout(15000) });
					const d = await r.json();
					if (d?.url) return { type: 'video', url: d.url, caption: '' };
					if (d?.picker?.length) return { type: 'album', items: d.picker.map(p => ({ url: p.url, is_video: p.type === 'video' })), caption: '' };
				} catch {}
			}
			throw new Error('cobalt: all failed');
		}},
	];

	for (const method of methods) {
		try {
			console.log(`[Instagram] Trying: ${method.name}`);
			const result = await method.fn();
			if (result?.url || result?.items?.length) {
				console.log(`[Instagram] ✅ ${method.name}`);
				return result;
			}
		} catch (e) {
			console.log(`[Instagram] ❌ ${method.name}: ${e.message}`);
		}
	}
	throw new Error('සියලු Instagram methods fail වුණා!');
}

// ════════════════════════════════════════════════════════════════
//   TIKTOK - multi-method (watermark-free)
// ════════════════════════════════════════════════════════════════
async function tiktokDownload(url) {
	// ── URL Resolve (short links: vt.tiktok, vm.tiktok) ──────────
	let resolvedUrl = url;
	let videoId = url.match(/\/video\/(\d+)/)?.[1] || null;

	if (!videoId) {
		for (const ua of [
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
			'TikTok/26.2.0 (iPhone; iOS 17.0; Scale/3.00)',
			'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
		]) {
			try {
				const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': ua } });
				const ru = r.url || '';
				if (ru.includes('/video/')) { resolvedUrl = ru; videoId = ru.match(/\/video\/(\d+)/)?.[1] || null; break; }
			} catch {}
		}
	}

	const _url = resolvedUrl || url;

	const methods = [
		// ── 1: tikwm (original url) ─────────────────────────────────
		{ name: 'tikwm-orig', fn: async () => {
			const r = await fetch('https://tikwm.com/api/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url, count: '12', cursor: '0', web: '1', hd: '1' }), signal: AbortSignal.timeout(25000) });
			const d = (await r.json())?.data; if (!d) throw new Error('no data');
			if (d.images?.length) return { type: 'slideshow', items: d.images, audio: d.music, title: d.title || '', author: d.author?.nickname || '', thumb: d.cover || '' };
			let v = d.hdplay || d.play; if (!v) throw new Error('no url');
			// Fix relative URLs from tikwm
			if (v.startsWith('/')) v = 'https://tikwm.com' + v;
			const audio = d.music || v;
			return { type: 'video', url: v, audio: audio.startsWith('/') ? 'https://tikwm.com' + audio : audio, title: d.title || '', author: d.author?.nickname || '', thumb: d.cover || '' };
		}},
		// ── 2: tikwm (resolved url) ─────────────────────────────────
		{ name: 'tikwm-resolved', fn: async () => {
			if (_url === url) throw new Error('same, skip');
			const r = await fetch('https://tikwm.com/api/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url: _url, count: '12', cursor: '0', web: '1', hd: '1' }), signal: AbortSignal.timeout(25000) });
			const d = (await r.json())?.data; if (!d) throw new Error('no data');
			if (d.images?.length) return { type: 'slideshow', items: d.images, audio: d.music, title: d.title || '', author: d.author?.nickname || '', thumb: d.cover || '' };
			let v = d.hdplay || d.play; if (!v) throw new Error('no url');
			// Fix relative URLs from tikwm
			if (v.startsWith('/')) v = 'https://tikwm.com' + v;
			const audio = d.music || v;
			return { type: 'video', url: v, audio: audio.startsWith('/') ? 'https://tikwm.com' + audio : audio, title: d.title || '', author: d.author?.nickname || '', thumb: d.cover || '' };
		}},
		// ── 3: TikTok API v2 (no watermark) ─────────────────────────
		{ name: 'tiktok-api-v2', fn: async () => {
			if (!videoId) throw new Error('no id');
			const r = await fetch(`https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}&iid=7318518857994389254&device_id=7318517321748022790&channel=googleplay&app_name=musical_ly&version_code=300904&device_platform=android&device_type=Pixel+7`, { headers: { 'User-Agent': 'okhttp/4.9.0' }, signal: AbortSignal.timeout(20000) });
			const data = await r.json(); const v = data?.aweme_list?.[0]; if (!v) throw new Error('no data');
			const pu = v.video?.play_addr_h264?.url_list?.[0] || v.video?.download_addr?.url_list?.[0]; if (!pu) throw new Error('no url');
			return { type: 'video', url: pu, audio: v.music?.play_url?.url_list?.[0] || pu, title: v.desc || '', author: v.author?.nickname || '', thumb: v.video?.cover?.url_list?.[0] || '' };
		}},
		// ── 4: TikTok API alisg ──────────────────────────────────────
		{ name: 'tiktok-api-alisg', fn: async () => {
			if (!videoId) throw new Error('no id');
			const r = await fetch(`https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}&iid=7318518857994389254&device_id=7318517321748022790&channel=googleplay&app_name=musical_ly&version_code=300904&device_platform=android`, { headers: { 'User-Agent': 'okhttp/4.9.0' }, signal: AbortSignal.timeout(20000) });
			const data = await r.json(); const v = data?.aweme_list?.[0]; if (!v) throw new Error('no data');
			const pu = v.video?.play_addr?.url_list?.[0] || v.video?.download_addr?.url_list?.[0]; if (!pu) throw new Error('no url');
			return { type: 'video', url: pu, audio: v.music?.play_url?.url_list?.[0] || pu, title: v.desc || '', author: v.author?.nickname || '', thumb: v.video?.cover?.url_list?.[0] || '' };
		}},
		// ── 5: ssstik ───────────────────────────────────────────────
		{ name: 'ssstik', fn: async () => {
			const h1 = await (await fetch('https://ssstik.io/en', { signal: AbortSignal.timeout(12000) })).text();
			const token = h1.match(/s_tt\s*=\s*"([^"]+)"/)?.[1]; if (!token) throw new Error('no token');
			const h2 = await (await fetch('https://ssstik.io/abc?url=dl', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://ssstik.io/en' }, body: new URLSearchParams({ id: url, locale: 'en', tt: token }), signal: AbortSignal.timeout(30000) })).text();
			const u = h2.match(/href="(https:\/\/tikcdn[^"]+\.mp4[^"]*)"/)?.[1] || h2.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/)?.[1]; if (!u) throw new Error('no link');
			return { type: 'video', url: u, audio: u, title: '', author: '', thumb: '' };
		}},
		// ── 6: snaptik ──────────────────────────────────────────────
		{ name: 'snaptik', fn: async () => {
			const h1 = await (await fetch('https://snaptik.app/en', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })).text();
			const token = h1.match(/name="token"\s+value="([^"]+)"/)?.[1]; if (!token) throw new Error('no token');
			const d = await (await fetch('https://snaptik.app/action_v2.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://snaptik.app/' }, body: new URLSearchParams({ url, token, lang: 'en' }), signal: AbortSignal.timeout(25000) })).json();
			const links = [...(d?.data || '').matchAll(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/g)].map(m => m[1]); if (!links.length) throw new Error('no links');
			return { type: 'video', url: links[0], audio: links[0], title: '', author: '', thumb: '' };
		}},
		// ── 7: musicaldown ──────────────────────────────────────────
		{ name: 'musicaldown', fn: async () => {
			const h1 = await (await fetch('https://musicaldown.com/en', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })).text();
			const inputs = [...h1.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)].reduce((a, m) => ({ ...a, [m[1]]: m[2] }), {}); inputs.link = _url;
			const h2 = await (await fetch('https://musicaldown.com/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://musicaldown.com/en' }, body: new URLSearchParams(inputs), signal: AbortSignal.timeout(25000) })).text();
			const u = h2.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/)?.[1]; if (!u) throw new Error('no link');
			return { type: 'video', url: u, audio: u, title: '', author: '', thumb: '' };
		}},
		// ── 8: tmate ────────────────────────────────────────────────
		{ name: 'tmate', fn: async () => {
			const h1 = await (await fetch('https://tmate.cc/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })).text();
			const token = h1.match(/name="_token"\s+value="([^"]+)"/)?.[1]; if (!token) throw new Error('no token');
			const d = await (await fetch('https://tmate.cc/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://tmate.cc/' }, body: new URLSearchParams({ url, _token: token }), signal: AbortSignal.timeout(25000) })).json();
			const u = d?.url || d?.data?.url; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.title || '', author: '', thumb: '' };
		}},
		// ── 9: tikdownload ──────────────────────────────────────────
		{ name: 'tikdownload', fn: async () => {
			const h1 = await (await fetch('https://tikdownload.io/', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })).text();
			const token = h1.match(/name="_token"\s+value="([^"]+)"/)?.[1]; if (!token) throw new Error('no token');
			const d = await (await fetch('https://tikdownload.io/download', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://tikdownload.io/' }, body: new URLSearchParams({ url, _token: token }), signal: AbortSignal.timeout(25000) })).json();
			const u = d?.data?.video?.noWatermark || d?.data?.video?.watermark; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.data?.title || '', author: '', thumb: '' };
		}},
		// ── 10: tikmate ─────────────────────────────────────────────
		{ name: 'tikmate', fn: async () => {
			const d = await (await fetch('https://api.tikmate.app/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) })).json();
			if (!d?.token || !d?.id) throw new Error('no token');
			const u = `https://api.tikmate.app/api/download?id=${d.id}&token=${d.token}&hd=1`;
			return { type: 'video', url: u, audio: u, title: d.text || '', author: d.authorName || '', thumb: d.cover || '' };
		}},
		// ── 11: savetik ─────────────────────────────────────────────
		{ name: 'savetik', fn: async () => {
			const h1 = await (await fetch('https://savetik.co/en', { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })).text();
			const token = h1.match(/name="token"\s+value="([^"]+)"/)?.[1]; if (!token) throw new Error('no token');
			const d = await (await fetch('https://savetik.co/api/ajaxSearch', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://savetik.co/' }, body: new URLSearchParams({ q: url, t: 'media', lang: 'en', token }), signal: AbortSignal.timeout(25000) })).json();
			const u = d?.data?.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/)?.[1]; if (!u) throw new Error('no link');
			return { type: 'video', url: u, audio: u, title: '', author: '', thumb: '' };
		}},
		// ── 12: tiktokvideo.online ───────────────────────────────────
		{ name: 'tiktokvideo', fn: async () => {
			const d = await (await fetch('https://tiktokvideo.online/api/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) })).json();
			const u = d?.data?.play || d?.data?.hdplay; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: d?.data?.music || u, title: d?.data?.title || '', author: '', thumb: '' };
		}},
		// ── 13: locodownloader ──────────────────────────────────────
		{ name: 'locodownloader', fn: async () => {
			const d = await (await fetch('https://locodownloader.com/api/tiktok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(20000) })).json();
			const u = d?.data?.video?.noWatermark || d?.data?.hdVideo; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.data?.title || '', author: '', thumb: '' };
		}},
		// ── 14: ttdownloader ────────────────────────────────────────
		{ name: 'ttdownloader', fn: async () => {
			const d = await (await fetch('https://ttdownloader.com/req/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://ttdownloader.com/' }, body: new URLSearchParams({ url, format: '', rotate: '' }), signal: AbortSignal.timeout(20000) })).json();
			const u = d?.data; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: '', author: '', thumb: '' };
		}},
		// ── 15: tdownloader ─────────────────────────────────────────
		{ name: 'tdownloader', fn: async () => {
			const d = await (await fetch('https://tdownloader.net/api', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) })).json();
			const u = d?.data?.[0]?.url || d?.url; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.title || '', author: '', thumb: '' };
		}},
		// ── 16: cobalt ──────────────────────────────────────────────
		{ name: 'cobalt', fn: async () => {
			for (const inst of ['https://api.cobalt.tools', 'https://cobalt.oisd.nl', 'https://cobalt-api.hydrax.net']) {
				try {
					const d = await (await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'auto', videoQuality: '720' }), signal: AbortSignal.timeout(15000) })).json();
					if (d?.url) return { type: 'video', url: d.url, audio: d.url, title: '', author: '', thumb: '' };
				} catch {}
			}
			throw new Error('all cobalt failed');
		}},
		// ── 17: rapidapi-tiktok-scraper ──────────────────────────────
		{ name: 'rapidapi-tiktok', fn: async () => {
			const d = await (await fetch(`https://tiktok-scraper7.p.rapidapi.com/video/info?url=${encodeURIComponent(url)}&hd=1`, { headers: { 'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(25000) })).json();
			const u = d?.data?.hdplay || d?.data?.play; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: d?.data?.music || u, title: d?.data?.title || '', author: d?.data?.author?.nickname || '', thumb: d?.data?.cover || '' };
		}},
		// ── 18: rapidapi-all-in-one ──────────────────────────────────
		{ name: 'rapidapi-aio', fn: async () => {
			const d = await (await fetch(`https://all-in-one-social-media-downloader.p.rapidapi.com/v1/download?url=${encodeURIComponent(url)}`, { headers: { 'x-rapidapi-host': 'all-in-one-social-media-downloader.p.rapidapi.com', 'x-rapidapi-key': RAPID_KEY }, signal: AbortSignal.timeout(25000) })).json();
			const u = d?.data?.urls?.[0]?.url || d?.url; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.data?.title || '', author: '', thumb: '' };
		}},
		// ── 19: savefrom ─────────────────────────────────────────────
		{ name: 'savefrom', fn: async () => {
			const d = await (await fetch('https://worker.sf-tools.com/savefrom.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://en.savefrom.net/' }, body: new URLSearchParams({ sf_url: url, lang: 'en' }), signal: AbortSignal.timeout(20000) })).json();
			const u = d?.url?.[0]?.url || d?.url; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: d?.title || '', author: '', thumb: '' };
		}},
		// ── 20: yt-dlp (most universal) ──────────────────────────────
		{ name: 'ytdlp', fn: async () => {
			const out = await run(`yt-dlp --no-warnings --no-playlist -J "${_url}"`, 90000);
			const info = JSON.parse(out);
			if (!info.url && !info.entries?.[0]?.url) throw new Error('no url');
			const u = info.url || info.entries[0].url;
			return { type: 'video', url: u, audio: u, title: info.title || '', author: info.uploader || '', thumb: info.thumbnail || '' };
		}},
		// ── 21: yt-dlp format-specific ───────────────────────────────
		{ name: 'ytdlp-mp4', fn: async () => {
			const out = await run(`yt-dlp --no-warnings -f "best[ext=mp4]/best" --get-url "${_url}"`, 90000);
			const u = out.trim().split('\n')[0]; if (!u) throw new Error('no url');
			return { type: 'video', url: u, audio: u, title: '', author: '', thumb: '' };
		}},
	];

	for (const method of methods) {
		try {
			console.log(`[TikTok] Trying: ${method.name}`);
			const result = await method.fn();
			if (result?.url || result?.items?.length) {
				console.log(`[TikTok] ✅ ${method.name}`);
				return result;
			}
		} catch (e) {
			console.log(`[TikTok] ❌ ${method.name}: ${e.message?.substring(0, 80)}`);
		}
	}
	throw new Error('සියලු TikTok methods (21) fail වුණා!');
}

// ════════════════════════════════════════════════════════════════
//   FACEBOOK - multi-method
// ════════════════════════════════════════════════════════════════
async function fbDownload(url) {
	// share/r/ , share/v/ , share/p/ type URLs → yt-dlp best handles these
	const isShareUrl = /facebook\.com\/share\/[rvp]\//i.test(url);

	const ytdlpMethod = { name: 'ytdlp', fn: async () => {
		const out = await run(`yt-dlp --no-warnings -J "${url}"`, 45000);
		const info = JSON.parse(out);
		if (!info.url && !info.formats) throw new Error('no url');
		let videoUrl = info.url;
		if (!videoUrl && info.formats) {
			const fmt = info.formats.filter(f => f.url && f.vcodec !== 'none').sort((a,b) => (b.height||0)-(a.height||0));
			videoUrl = fmt[0]?.url;
		}
		if (!videoUrl) throw new Error('no url');
		return { hd: videoUrl, sd: videoUrl, title: info.title || '' };
	}};

	const webMethods = [
		// Method 1: getfvid
		{ name: 'getfvid', fn: async () => {
			const res = await fetch('https://getfvid.com/downloader', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const hd = html.match(/href="(https:\/\/video[^"]+)" [^>]*>HD/)?.[1];
			const sd = html.match(/href="(https:\/\/video[^"]+)" [^>]*>SD/)?.[1] || hd;
			if (!hd && !sd) throw new Error('no link');
			return { hd, sd, title: '' };
		}},
		// Method 2: fdown.net
		{ name: 'fdown', fn: async () => {
			const res = await fetch(`https://fdown.net/index.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ URLz: url }), signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const hd = html.match(/a id="hdlink" href="([^"]+)"/)?.[1];
			const sd = html.match(/a id="sdlink" href="([^"]+)"/)?.[1] || hd;
			if (!hd && !sd) throw new Error('no link');
			return { hd, sd, title: '' };
		}},
		// Method 3: fbdown.net
		{ name: 'fbdown', fn: async () => {
			const res = await fetch('https://fbdown.net/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const hd = html.match(/href="(https:\/\/[^"]+video[^"]+mp4[^"]*)"\s*[^>]*>\s*HD/i)?.[1];
			const sd = html.match(/href="(https:\/\/[^"]+video[^"]+mp4[^"]*)"\s*[^>]*>\s*SD/i)?.[1] || hd;
			if (!hd && !sd) throw new Error('no link');
			return { hd, sd, title: '' };
		}},
		// Method 4: cobalt
		{ name: 'cobalt', fn: async () => {
			const instances = await getCobaltInstances();
			for (const inst of instances) {
				try {
					const r = await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'auto' }), signal: AbortSignal.timeout(15000) });
					const d = await r.json();
					if (d?.url) return { hd: d.url, sd: d.url, title: '' };
				} catch {}
			}
			throw new Error('cobalt: all failed');
		}},
		// Method 5: savefrom
		{ name: 'savefrom', fn: async () => {
			const res = await fetch('https://worker.sf-tools.com/savefrom.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://en.savefrom.net/' }, body: new URLSearchParams({ sf_url: url, lang: 'en' }), signal: AbortSignal.timeout(20000) });
			const data = await res.json();
			const link = data?.url?.[0]?.url || data?.url;
			if (!link) throw new Error('no url');
			return { hd: link, sd: link, title: data?.title || '' };
		}},
	];

	// share/r/ share/v/ share/p/ → yt-dlp first, then web methods
	// normal URLs → web methods first, yt-dlp last fallback
	const methods = isShareUrl
		? [ytdlpMethod, ...webMethods]
		: [...webMethods, ytdlpMethod];

	for (const method of methods) {
		try {
			console.log(`[Facebook] Trying: ${method.name}`);
			const result = await method.fn();
			if (result?.hd || result?.sd) {
				console.log(`[Facebook] ✅ ${method.name}`);
				return result;
			}
		} catch (e) {
			console.log(`[Facebook] ❌ ${method.name}: ${e.message}`);
		}
	}
	throw new Error('සියලු Facebook methods fail වුණා!');
}

// ════════════════════════════════════════════════════════════════
//   TWITTER/X - multi-method
// ════════════════════════════════════════════════════════════════
async function twitterDownload(url) {
	const methods = [
		// Method 1: yt-dlp
		async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 30000);
			const info = JSON.parse(out);
			return { url: info.url, title: info.title || '' };
		},
		// Method 2: twitsave
		async () => {
			const res = await fetch(`https://twitsave.com/info?url=${encodeURIComponent(url)}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/video\.twimg\.com[^"]+)"/)?.[1];
			if (!dlUrl) throw new Error('no link');
			return { url: dlUrl, title: '' };
		},
		// Method 3: savetweetvid
		async () => {
			const res = await fetch(`https://savetweetvid.com/v?url=${encodeURIComponent(url)}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const data = await res.json();
			const link = data?.data?.[0]?.link || data?.url;
			if (!link) throw new Error('no link');
			return { url: link, title: data?.caption || '' };
		},
		// Method 4: cobalt
		async () => {
			const instances = await getCobaltInstances();
			for (const inst of instances) {
				try {
					const r = await fetch(`${inst}/`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, downloadMode: 'auto' }), signal: AbortSignal.timeout(12000) });
					const d = await r.json(); if (d?.url) return { url: d.url, title: '' };
				} catch {}
			}
			throw new Error('cobalt: all failed');
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `twitter-method-${i + 1}`, fn })), 'Twitter');
}

// ════════════════════════════════════════════════════════════════
//   PINTEREST - multi-method
// ════════════════════════════════════════════════════════════════
async function pinterestDownload(url) {
	const methods = [
		async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 30000);
			const info = JSON.parse(out);
			return { url: info.url, type: info.ext === 'mp4' ? 'video' : 'image', title: info.title || '' };
		},
		async () => {
			const res = await fetch(`https://pinterestdownloader.io/?url=${encodeURIComponent(url)}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/[^"]+\.(mp4|jpg|jpeg|png)[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no link');
			return { url: dlUrl, type: dlUrl.includes('.mp4') ? 'video' : 'image', title: '' };
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `pinterest-method-${i + 1}`, fn })), 'Pinterest');
}

// ════════════════════════════════════════════════════════════════
//   REDDIT - multi-method
// ════════════════════════════════════════════════════════════════
async function redditDownload(url) {
	const methods = [
		async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 30000);
			const info = JSON.parse(out);
			return { url: info.url, type: 'video', title: info.title || '' };
		},
		async () => {
			const apiUrl = url.replace('www.reddit.com', 'api.reddit.com').replace(/\/?$/, '.json');
			const res = await fetch(apiUrl, { headers: { 'User-Agent': 'nimabw-bot/1.0' }, signal: AbortSignal.timeout(15000) });
			const data = await res.json();
			const post = data?.[0]?.data?.children?.[0]?.data;
			if (!post) throw new Error('no data');
			const videoUrl = post?.media?.reddit_video?.fallback_url || post?.url;
			if (!videoUrl) throw new Error('no video');
			return { url: videoUrl, type: 'video', title: post.title || '' };
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `reddit-method-${i + 1}`, fn })), 'Reddit');
}

// ════════════════════════════════════════════════════════════════
//   SOUNDCLOUD - multi-method
// ════════════════════════════════════════════════════════════════
async function soundcloudDownload(url) {
	const methods = [
		async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 30000);
			const info = JSON.parse(out);
			return { url: info.url, title: info.title || '', artist: info.uploader || '', thumb: info.thumbnail || '' };
		},
		async () => {
			const res = await fetch(`https://soundcloudmp3.org/converter`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no link');
			return { url: dlUrl, title: '', artist: '', thumb: '' };
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `sc-method-${i + 1}`, fn })), 'SoundCloud');
}

// ════════════════════════════════════════════════════════════════
//   THREADS - download
// ════════════════════════════════════════════════════════════════
async function threadsDownload(url) {
	const methods = [
		async () => {
			const out = await run(`yt-dlp --no-warnings -J "${url}"`, 30000);
			const info = JSON.parse(out);
			return { url: info.url, type: info.ext === 'mp4' ? 'video' : 'image', title: info.title || '' };
		},
		async () => {
			const res = await fetch(`https://threadsphotodownloader.com/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ url }), signal: AbortSignal.timeout(15000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/[^"]+\.(mp4|jpg|jpeg)[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no link');
			return { url: dlUrl, type: dlUrl.includes('.mp4') ? 'video' : 'image', title: '' };
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `threads-method-${i + 1}`, fn })), 'Threads');
}

// ════════════════════════════════════════════════════════════════
//   VIMEO / DAILYMOTION - yt-dlp
// ════════════════════════════════════════════════════════════════
async function vimeoDownload(url) {
	const out = await run(`yt-dlp --no-warnings -f "best[height<=720]" --get-url "${url}"`, 30000);
	const dlUrl = out.split('\n')[0];
	if (!dlUrl) throw new Error('Vimeo download failed');
	return { url: dlUrl, title: '' };
}

async function dailymotionDownload(url) {
	const out = await run(`yt-dlp --no-warnings -f "best[height<=720]" --get-url "${url}"`, 30000);
	const dlUrl = out.split('\n')[0];
	if (!dlUrl) throw new Error('Dailymotion download failed');
	return { url: dlUrl, title: '' };
}

// ════════════════════════════════════════════════════════════════
//   MEDIAFIRE - multi-method
// ════════════════════════════════════════════════════════════════
async function mediafireDownload(url) {
	const methods = [
		async () => {
			const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/download[^"]+mediafire[^"]+)"/)?.[1] || html.match(/id="downloadButton"\s+href="([^"]+)"/)?.[1];
			if (!dlUrl) throw new Error('no link');
			const filename = url.split('/').filter(Boolean).pop() || 'file';
			return { url: dlUrl, filename, size: 'Unknown' };
		},
		async () => {
			const res = await fetch(`https://www.mediafire.com/api/file/info.php?quick_key=${url.match(/\/([a-z0-9]+)\//i)?.[1]}&response_format=json`, { signal: AbortSignal.timeout(10000) });
			const data = await res.json();
			const file = data?.response?.file_info;
			if (!file?.links?.normal_download) throw new Error('no link');
			return { url: file.links.normal_download, filename: file.filename || 'file', size: file.size || 'Unknown' };
		},
	];
	return await runMethods(methods.map((fn, i) => ({ name: `mf-method-${i + 1}`, fn })), 'MediaFire');
}

// ════════════════════════════════════════════════════════════════
//   APK DOWNLOAD - Google Play / APKPure / APKCombo / Uptodown
// ════════════════════════════════════════════════════════════════
async function apkDownload(packageOrUrl) {
	// Detect if Google Play URL or package name
	const pkg = packageOrUrl.includes('play.google.com')
		? packageOrUrl.match(/id=([a-z0-9_.]+)/i)?.[1]
		: packageOrUrl.trim();

	if (!pkg) throw new Error('Invalid package name or Google Play URL');

	const methods = [
		// Method 1: APKPure
		{ name: 'APKPure', fn: async () => {
			const res = await fetch(`https://apkpure.com/${pkg.replace(/\./g, '-')}/${pkg}/download`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/[^"]+apk[^"]*)" [^>]*download/i)?.[1] || html.match(/data-dt-url="([^"]+\.apk[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no APK link');
			const appName = html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]?.trim() || pkg;
			const version = html.match(/Version[^>]*>([^<]+)</i)?.[1]?.trim() || '';
			return { url: dlUrl, name: appName, version, pkg };
		}},
		// Method 2: APKCombo
		{ name: 'APKCombo', fn: async () => {
			const res = await fetch(`https://apkcombo.com/apk-downloader/?package=${pkg}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const dlUrl = html.match(/href="(https:\/\/[^"]+\.apk[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no APK link');
			return { url: dlUrl, name: pkg, version: '', pkg };
		}},
		// Method 3: Uptodown
		{ name: 'Uptodown', fn: async () => {
			const appSlug = pkg.replace(/\./g, '-').toLowerCase();
			const res = await fetch(`https://${appSlug}.en.uptodown.com/android/download`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
			const html = await res.text();
			const dlUrl = html.match(/data-url="([^"]+\.apk[^"]*)"/)?.[1];
			if (!dlUrl) throw new Error('no APK link');
			return { url: dlUrl, name: pkg, version: '', pkg };
		}},
		// Method 4: APKMirror info (direct download link)
		{ name: 'APKMirror', fn: async () => {
			const search = await fetch(`https://www.apkmirror.com/?post_type=app_release&searchtype=app&s=${pkg}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const html = await search.text();
			const appUrl = html.match(/href="(\/apk\/[^"]+\/)" class="fontBlack"/)?.[1];
			if (!appUrl) throw new Error('app not found');
			const appPage = await fetch(`https://www.apkmirror.com${appUrl}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
			const html2 = await appPage.text();
			const dlPath = html2.match(/href="(\/apk\/[^"]+\/download\/[^"]*)"/)?.[1];
			if (!dlPath) throw new Error('no download link');
			return { url: `https://www.apkmirror.com${dlPath}`, name: pkg, version: '', pkg };
		}},
	];

	return await runMethods(methods, 'APK');
}

// ════════════════════════════════════════════════════════════════
//   ATTP ANIMATED STICKER - multi-API
// ════════════════════════════════════════════════════════════════
async function atpSticker(text, style = null) {
	const s = style || Math.floor(Math.random() * 10) + 1;
	const methods = [
		// Method 1: bk9 API
		{ name: 'bk9-attp', fn: async () => {
			const res = await fetch(`https://bk9.fun/sticker/attp?text=${encodeURIComponent(text)}&style=${s}`, { signal: AbortSignal.timeout(20000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length < 100) throw new Error('invalid response');
			return buf;
		}},
		// Method 2: attp via canvas (local generation using sharp if available)
		{ name: 'api2-attp', fn: async () => {
			const res = await fetch(`https://api.xteam.xyz/attp?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length < 100) throw new Error('invalid');
			return buf;
		}},
		// Method 3: another public ATTP API
		{ name: 'api3-attp', fn: async () => {
			const res = await fetch(`https://apis.davidcyriltech.my.id/attp?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) });
			const data = await res.json();
			const imgUrl = data?.result || data?.url || data?.image;
			if (!imgUrl) throw new Error('no url');
			return await getBuffer(imgUrl);
		}},
		// Method 4: itzpire
		{ name: 'itzpire-attp', fn: async () => {
			const res = await fetch(`https://api.itzpire.com/sticker/attp?text=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(20000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length < 100) throw new Error('invalid');
			return buf;
		}},
	];
	return await runMethods(methods, 'ATTP');
}

// ════════════════════════════════════════════════════════════════
//   GENERAL URL DOWNLOADER (any site yt-dlp supports)
// ════════════════════════════════════════════════════════════════
async function generalDownload(url, type = 'video') {
	const format = type === 'audio' ? '-f "bestaudio" -x --audio-format mp3' : '-f "best[height<=480]/best"';
	const outPath = path.join('./database/temp', `dl_${Date.now()}.%(ext)s`);
	await run(`yt-dlp --no-warnings ${format} -o "${outPath}" "${url}"`, 120000);
	const files = fs.readdirSync('./database/temp').filter(f => f.startsWith(`dl_${Date.now().toString().substring(0, 8)}`));
	if (!files.length) throw new Error('Download failed');
	const filePath = path.join('./database/temp', files[0]);
	const buffer = fs.readFileSync(filePath);
	fs.unlinkSync(filePath);
	return buffer;
}

module.exports = {
	ytMp3, ytMp4,
	igDownload,
	tiktokDownload,
	fbDownload,
	twitterDownload,
	pinterestDownload,
	redditDownload,
	soundcloudDownload,
	threadsDownload,
	vimeoDownload,
	dailymotionDownload,
	mediafireDownload,
	apkDownload,
	atpSticker,
	generalDownload,
};

// 🔄 Startup Git Pull Check (index.js direct start සඳහා)
// ═══════════════════════════════════════════════════════════
(async () => {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    // ═══════════════════════════════════════════════════════
    // 📦 Auto Dependency Installer
    // ═══════════════════════════════════════════════════════
    function _detectPackageManager() {
        try { execSync('yarn --version', { stdio: 'pipe', timeout: 5000 }); return 'yarn'; } catch {}
        try { execSync('npm --version',  { stdio: 'pipe', timeout: 5000 }); return 'npm';  } catch {}
        try { execSync('pnpm --version', { stdio: 'pipe', timeout: 5000 }); return 'pnpm'; } catch {}
        return 'npm';
    }

    function _needsInstall() {
        const pkgPath = path.join(__dirname, 'package.json');
        if (!fs.existsSync(pkgPath)) return false;
        const nmPath = path.join(__dirname, 'node_modules');
        if (!fs.existsSync(nmPath)) return true;

        // package.json වල dependencies check කරනවා
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
            for (const dep of deps) {
                const depPath = path.join(nmPath, dep);
                if (!fs.existsSync(depPath)) {
                    console.log(`📦 Missing module detected: ${dep}`);
                    return true;
                }
            }
        } catch {}
        return false;
    }

    function _runInstall(pm) {
        const commands = {
            npm:  [
                'npm install --legacy-peer-deps --no-audit --prefer-offline',
                'npm install --force --no-audit',
                'npm install --legacy-peer-deps',
            ],
            yarn: [
                'yarn install --ignore-engines --network-timeout 100000',
                'yarn install --ignore-engines',
                'yarn install',
            ],
            pnpm: [
                'pnpm install --shamefully-hoist',
                'pnpm install',
            ],
        };

        const cmds = commands[pm] || commands['npm'];
        for (const cmd of cmds) {
            try {
                console.log(`📦 Running: ${cmd}`);
                execSync(cmd, { stdio: 'inherit', cwd: __dirname, timeout: 180000, shell: true });
                console.log('✅ Dependencies install සාර්ථකයි!');
                return true;
            } catch (e) {
                console.log(`✗ ${cmd} — ${e.message?.substring(0, 80)}`);
            }
        }
        return false;
    }

    if (_needsInstall()) {
        console.log('\n📦 [Auto-Install] Dependencies install කරමින්...');
        const pm = _detectPackageManager();
        console.log(`📦 Package manager: ${pm}`);
        const ok = _runInstall(pm);
        if (!ok) {
            console.log('⚠️ Auto-install අසාර්ථකයි. Manual install කරන්න:');
            console.log('   npm install --legacy-peer-deps');
        }
        console.log('');
    }
    // ═══════════════════════════════════════════════════════
    // 🐍 Python Packages Auto-Install / Upgrade
    // ═══════════════════════════════════════════════════════
    (function _autoPip() {
        const pipPackages = [
            'speedtest-cli',
            'yt-dlp',
        ];

        function _getPipCmd() {
            const cmds = ['pip3', 'pip'];
            for (const cmd of cmds) {
                try { execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 5000 }); return cmd; } catch {}
            }
            return null;
        }

        function _isPipPkgInstalled(pip, pkg) {
            try {
                execSync(`${pip} show ${pkg}`, { stdio: 'pipe', timeout: 10000 });
                return true;
            } catch { return false; }
        }

        const pip = _getPipCmd();
        if (!pip) { console.log('⚠️ pip හමු නොවිණී — Python packages skip'); return; }

        for (const pkg of pipPackages) {
            try {
                if (_isPipPkgInstalled(pip, pkg)) {
                    console.log(`🔄 [pip] Upgrading: ${pkg}`);
                    execSync(`${pip} install ${pkg} --upgrade --break-system-packages -q`, { stdio: 'pipe', timeout: 120000 });
                    console.log(`✅ [pip] ${pkg} upgraded`);
                } else {
                    console.log(`📦 [pip] Installing: ${pkg}`);
                    execSync(`${pip} install ${pkg} --break-system-packages -q`, { stdio: 'pipe', timeout: 120000 });
                    console.log(`✅ [pip] ${pkg} installed`);
                }
            } catch (e) {
                console.log(`⚠️ [pip] ${pkg} install/upgrade failed: ${e.message?.substring(0, 80)}`);
            }
        }
    })();

    // ═══════════════════════════════════════════════════════
    // 🔧 System Tools Auto-Install (ffmpeg, yt-dlp binary)
    // ═══════════════════════════════════════════════════════
    (function _autoSystemTools() {
        // yt-dlp binary check — pip install කළාට PATH හි නැත්නම් fallback
        function _checkCmd(cmd) {
            try { execSync(`which ${cmd}`, { stdio: 'pipe', timeout: 5000 }); return true; } catch { return false; }
        }

        // ffmpeg check — Termux: pkg install ffmpeg
        if (!_checkCmd('ffmpeg')) {
            console.log('📦 [system] ffmpeg හමු නොවිණී — install try කරමින්...');
            try {
                execSync('pkg install ffmpeg -y', { stdio: 'pipe', timeout: 120000, shell: true });
                console.log('✅ [system] ffmpeg installed');
            } catch {
                try {
                    execSync('apt-get install -y ffmpeg', { stdio: 'pipe', timeout: 120000, shell: true });
                    console.log('✅ [system] ffmpeg installed (apt)');
                } catch (e) {
                    console.log('⚠️ [system] ffmpeg auto-install failed — manual: pkg install ffmpeg');
                }
            }
        } else {
            console.log('✅ [system] ffmpeg OK');
        }

        // yt-dlp binary check
        if (!_checkCmd('yt-dlp')) {
            console.log('📦 [system] yt-dlp binary හමු නොවිණී — install try කරමින්...');
            try {
                execSync('pip3 install yt-dlp --break-system-packages -q', { stdio: 'pipe', timeout: 120000, shell: true });
                console.log('✅ [system] yt-dlp installed via pip3');
            } catch {
                try {
                    // Direct binary download fallback
                    execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp', { stdio: 'pipe', timeout: 120000, shell: true });
                    console.log('✅ [system] yt-dlp installed via binary download');
                } catch (e) {
                    console.log('⚠️ [system] yt-dlp auto-install failed — manual: pip install yt-dlp');
                }
            }
        } else {
            // yt-dlp update කරනවා — outdated නම් YT block කරයි
            console.log('🔄 [system] yt-dlp updating...');
            try {
                execSync('yt-dlp -U --no-color', { stdio: 'pipe', timeout: 60000 });
                console.log('✅ [system] yt-dlp up to date');
            } catch {
                try {
                    execSync('pip3 install yt-dlp --upgrade --break-system-packages -q', { stdio: 'pipe', timeout: 120000, shell: true });
                    console.log('✅ [system] yt-dlp upgraded via pip3');
                } catch (e) {
                    console.log('⚠️ [system] yt-dlp update failed — continuing with current version');
                }
            }
        }
    })();

    const REPO_URL = 'https://github.com/shasikalanimesha-svg/nima.git';

    function _isGitRepo() {
        try { execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe', cwd: __dirname, timeout: 5000 }); return true; } catch { return false; }
    }
    function _getCurrentCommit() {
        try { return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe', cwd: __dirname, timeout: 5000 }).trim(); } catch { return null; }
    }
    function _getRemoteCommit() {
        try {
            execSync('git fetch origin main --quiet', { stdio: 'pipe', cwd: __dirname, timeout: 30000 });
            return execSync('git rev-parse origin/main', { encoding: 'utf8', stdio: 'pipe', cwd: __dirname, timeout: 5000 }).trim();
        } catch { return null; }
    }

    // start.js හරහා run නම් skip (start.js දැනටමත් check කරලා ඇත)
    const calledByStart = process.env._GIT_PULL_DONE === '1';
    if (!calledByStart) {
        console.log('\n🔄 [index.js] Startup git pull check...');
        try {
            if (!_isGitRepo()) {
                execSync(`git init && git remote add origin ${REPO_URL}`, { stdio: 'pipe', cwd: __dirname, timeout: 15000 });
                execSync('git fetch origin main --depth=1', { stdio: 'pipe', cwd: __dirname, timeout: 30000 });
                execSync('git reset --hard origin/main', { stdio: 'pipe', cwd: __dirname, timeout: 15000 });
            }
            execSync('git config pull.rebase false', { stdio: 'pipe', cwd: __dirname, timeout: 5000 });
            execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'pipe', cwd: __dirname, timeout: 5000 });

            const local  = _getCurrentCommit();
            const remote = _getRemoteCommit();

            if (local && remote && local !== remote) {
                console.log(`🔄 නව update හමු වුණා! local=${local.slice(0,7)} → remote=${remote.slice(0,7)}`);
                console.log('🔄 Git pull කරමින්...');

                const pullMethods = [
                    'git pull origin main --rebase',
                    'git pull origin main',
                    'git pull --force origin main',
                    'git fetch origin main && git reset --hard origin/main',
                    'git fetch --all && git reset --hard origin/main',
                ];

                let pulled = false;
                for (const cmd of pullMethods) {
                    try {
                        execSync(cmd, { stdio: 'inherit', cwd: __dirname, timeout: 60000, shell: '/bin/bash' });
                        pulled = true;
                        console.log('✅ Git pull සාර්ථකයි!');
                        break;
                    } catch { console.log(`✗ ${cmd}`); }
                }

                if (pulled) {
                    console.log('📦 Updating dependencies after git pull...');
                    const _pm2 = _detectPackageManager();
                    _runInstall(_pm2);

                    console.log('🔄 Bot auto-restart කරමින් (නව version)...');
                    const { spawn } = require('child_process');
                    process.env._GIT_PULL_DONE = '1';
                    const child = spawn(process.argv[0], process.argv.slice(1), {
                        stdio: 'inherit',
                        detached: false,
                        env: { ...process.env, _GIT_PULL_DONE: '1' }
                    });
                    child.on('exit', (code) => process.exit(code ?? 0));
                    return; // මෙතනදී exit — restart child handle කරයි
                }
            } else {
                console.log('✅ දැනටමත් යාවත්කාලීනයි — bot ආරම්භ කරමින්...');
            }
        } catch (e) {
            console.log('⚠️ Git check දෝෂය:', e.message, '— bot දිගටම...');
        }
    }
})().then(async () => {
// ═══════════════════════════════════════════════════════════

require('./settings');
require('./protection');
const os = require('os');
const pino = require('pino');
const axios = require('axios');
const chalk = require('chalk');
const readline = require('readline');
const { toBuffer } = require('qrcode');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const qrcode = require('qrcode-terminal');
const { exec } = require('child_process');
const { parsePhoneNumber } = require('awesome-phonenumber');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestWaWebVersion, jidNormalizedUser } = await import('baileys');
const WAConnection = makeWASocket;

const { dataBase } = require('./src/database');
const { app, server, PORT } = require('./src/server');
const { assertInstalled, unsafeAgent } = require('./lib/function');
const { GroupParticipantsUpdate, MessagesUpsert, Solving } = require('./src/message');

const nima = require('./nima');
const shasikala = require('./shasikala');

const print = (label, value) => console.log(`${chalk.green.bold('║')} ${chalk.cyan.bold(label.padEnd(16))}${chalk.yellow.bold(':')} ${value}`);
const pairingCode = true;
// ══════════════════════════════════════════════════════
// phoneNumber hardcoded — readline crash නොවෙන සේ safe
// ══════════════════════════════════════════════════════
const _isTTY = process.stdin.isTTY;
const rl = _isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : { question: (t, cb) => {}, close: () => {} };
const question = (text) => new Promise((resolve) => {
    if (!_isTTY) return resolve('');
    rl.question(text, resolve);
});

let pairingStarted = false;
let phoneNumber = process.env.BOT_NUMBER ? process.env.BOT_NUMBER.replace(/[^0-9]/g, '') : '94726800969';

const userInfoSyt = () => {
	try {
		return os.userInfo().username
	} catch (e) {
		return process.env.USER || process.env.USERNAME || 'unknown';
	}
}

global.fetchApi = async (path='/', data={}, options={}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const base = options.name ? (options.name in global.APIs ? global.APIs[options.name] : options.name) : global.APIs.nima
      const apikey = global.APIKeys[base]
      let method = (options.method || 'GET').toUpperCase()
      let url = base + path
      let payload = null
      let headers = options.headers || { 'user-agent': 'Mozilla/5.0 (Linux; Android 15)' }
      const isForm = options.form || data instanceof FormData || (data && typeof data.getHeaders === 'function')
      if (isForm) {
        payload = data
        method = 'POST'
        headers = { ...headers, ...data.getHeaders() }
      } else if (method !== 'GET') {
        payload = { ...data }
        headers['content-type'] = 'application/json'
      } else {
        url += '?' + new URLSearchParams({ ...data }).toString()
      }

      const res = await axios({
        method, url, data: payload,
        headers, httpsAgent: unsafeAgent,
        responseType: options.buffer ? 'arraybuffer'  : options.responseType || options.type || 'json'
      });
      resolve(options.buffer ? Buffer.from(res.data) : res.data);
    } catch (e) {
      reject(e)
    }
  })
}

const storeDB = dataBase(global.tempatStore);
const database = dataBase(global.tempatDB);
const msgRetryCounterCache = new NodeCache();

assertInstalled(process.platform === 'win32' ? 'where ffmpeg' : 'command -v ffmpeg', 'FFmpeg', 0);
console.log(chalk.greenBright('✅ අයිතිකරු නිමේෂගේ දුරකථනය හරහා සම්බන්ධ විය'));
console.log(chalk.green.bold(`╔═════[${`${chalk.cyan(userInfoSyt())}@${chalk.cyan(os.hostname())}`}]═════`));
print('OS', `${os.platform()} ${os.release()} ${os.arch()}`);
print('Uptime', `${Math.floor(os.uptime() / 3600)} පැය ${Math.floor((os.uptime() % 3600) / 60)} විනාඩි`);
print('Shell', process.env.SHELL || process.env.COMSPEC || 'unknown');
print('CPU', os.cpus()[0]?.model.trim() || 'unknown');
print('Memory', `${(os.freemem()/1024/1024).toFixed(0)} MiB / ${(os.totalmem()/1024/1024).toFixed(0)} MiB`);
print('Script version', `v${require('./package.json').version}`);
print('Node.js', process.version);
print('Baileys', `v${require('./package.json').dependencies.baileys}`);
print('Date & Time', new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo', hour12: false }));
console.log(chalk.green.bold('╚' + ('═'.repeat(30))));

server.listen(PORT, () => {
	console.log('🌸 MISS SHASIKALA [MINI BOT] ක්‍රියාකාරී වී ඇත!');
});

async function startnimaBot() {
	pairingStarted = false;
	phoneNumber = global.number_bot || null;

	try {
		const loadData = await database.read()
		const storeLoadData = await storeDB.read()
		if (!loadData || Object.keys(loadData).length === 0) {
			global.db = {
				hit: {},
				set: {},
				cmd: {},
				store: {},
				users: {},
				game: {},
				groups: {},
				database: {},
				premium: [],
				sewa: [],
				...(loadData || {}),
			}
			await database.write(global.db)
		} else {
			global.db = loadData
		}
		if (!storeLoadData || Object.keys(storeLoadData).length === 0) {
			global.store = {
				contacts: {},
				presences: {},
				messages: {},
				groupMetadata: {},
				...(storeLoadData || {}),
			}
			await storeDB.write(global.store)
		} else {
			global.store = storeLoadData
		}
		
		global.loadMessage = function (remoteJid, id) {
			const messages = store.messages?.[remoteJid]?.array;
			if (!messages) return null;
			return messages.find(msg => msg?.key?.id === id) || null;
		}
		
		if (!global._dbInterval) {
			global._dbInterval = setInterval(async () => {
				if (global.db) await database.write(global.db)
				if (global.store) await storeDB.write(global.store)
			}, 30 * 1000)
		}
	} catch (e) {
		console.log(e)
		process.exit(1)
	}
	
	const level = pino({ level: 'silent' });
	const { version } = await fetchLatestWaWebVersion();
	const { state, saveCreds } = await useMultiFileAuthState('nimadev');
	const getMessage = async (key) => {
		if (global.store) {
			const msg = await global.loadMessage(key.remoteJid, key.id);
			return msg?.message || ''
		}
		return {
			conversation: 'Hello nima Bot'
		}
	}
	
	global.nimaInstance = null;
	const nimaBot = WAConnection({
		version,
		logger: level,
		getMessage,
		syncFullHistory: false,
		maxMsgRetryCount: 15,
		msgRetryCounterCache,
		retryRequestDelayMs: 10,
		defaultQueryTimeoutMs: 0,
		connectTimeoutMs: 120000,
		keepAliveIntervalMs: 10000,
		maxRetries: 10,
		GenerateHighQualityLinkPreview: false,
		markOnlineOnConnect: false,
		printQRInTerminal: false,
		transactionOpts: {
			maxCommitRetries: 10,
			delayBetweenTriesMs: 10,
		},
		appStateMacVerification: {
			patch: true,
			snapshot: true,
		},
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, level),
		},
	})
	
	if (pairingCode && !nimaBot.authState.creds.registered) {
		// BOT_NUMBER env var හෝ readline — Railway/cloud හිදී env var use
		if (!phoneNumber) {
			// phoneNumber hardcoded — මෙතැනට නොआना
			if (process.env.BOT_NUMBER) {
				phoneNumber = process.env.BOT_NUMBER.replace(/[^0-9]/g, '');
				exec('rm -rf ./nimadev/*');
				console.log(chalk.cyan('📱 BOT_NUMBER env: ' + phoneNumber + ' | Pair code request...'));
			} else if (_isTTY) {
				// terminal available — readline use
				async function getPhoneNumber() {
					phoneNumber = await question('කරුණාකර ඔබගේ WhatsApp අංකය ඇතුළත් කරන්න (Ex: 947xxxxxxxx): ');
					phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
					if (!parsePhoneNumber('+' + phoneNumber).valid && phoneNumber.length < 6) {
						console.log(chalk.bgBlack(chalk.redBright('ඔබේ රටේ කේතය (Country Code) සමඟ අංකය ආරම්භ කරන්න.') + chalk.whiteBright(',') + chalk.greenBright(' උදාහරණ : 947xxxxxxxx')));
						await getPhoneNumber()
					}
				}
				(async () => {
					await getPhoneNumber();
					exec('rm -rf ./nimadev/*');
					console.log('දුරකතන අංකය ලබා ගත්තා. සම්බන්ධ වන තෙක් රැඳී සිටින්න...\n' + chalk.blueBright('ඇස්තමේන්තුගත කාලය: මිනිත්තු 2 ~ 5 පමණ'))
				})()
			} else {
				// cloud + number නෑ — /pair endpoint
				exec('rm -rf ./nimadev/*');
				console.log(chalk.yellowBright('☁️  BOT_NUMBER නැත — /pair?number=94xxxxxxxxx use කරන්න'));
			}
		} else {
			exec('rm -rf ./nimadev/*');
			console.log(chalk.cyan('📱 Number set: ' + phoneNumber + ' | Pair code request සඳහා සූදානම්...'))
		}
	}
	
	global.nimaInstance = nimaBot;

	await Solving(nimaBot, global.store)
	
	nimaBot.ev.on('creds.update', saveCreds)
	
	nimaBot.ev.on('connection.update', async (update) => {
		const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;
		if ((connection === 'connecting' || !!qr) && pairingCode && phoneNumber && !nimaBot.authState.creds.registered && !pairingStarted) {
			pairingStarted = true;
			const requestCode = async () => {
				if (nimaBot.authState.creds.registered) return;
				try {
					console.log('🔑 Pairing Code ලබා ගනිමින්...')
					let code = await nimaBot.requestPairingCode(phoneNumber);
					console.log(chalk.bgGreen.black(' ════════════════════════════ '));
					console.log(chalk.blue('🔑 *Pairing Code:*'), chalk.bgWhite.black.bold(' ' + code + ' '));
					console.log(chalk.yellow('⏰ _මිනිත්තු 2කින් නව code එකක් ලැබේ_'));
					console.log(chalk.bgGreen.black(' ════════════════════════════ '));
				} catch(e) {
					console.log('⚠️ Pairing code error:', e.message);
				}
			};
			setTimeout(async () => {
				await requestCode();
				const interval = setInterval(async () => {
					if (nimaBot.authState.creds.registered) { clearInterval(interval); return; }
					await requestCode();
				}, 115000);
			}, 3000);
		}
		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output.statusCode
			if (reason === DisconnectReason.connectionLost) {
				console.log('🔄 Server connection lost, reconnect...');
				startnimaBot()
			} else if (reason === DisconnectReason.connectionClosed) {
				console.log('🔄 Connection closed, reconnect...');
				startnimaBot()
			} else if (reason === DisconnectReason.restartRequired) {
				console.log('🔄 Restart required, reconnect...');
				startnimaBot()
			} else if (reason === DisconnectReason.timedOut) {
				console.log('⏰ Connection timeout, reconnect...');
				startnimaBot()
			} else if (reason === DisconnectReason.badSession) {
				console.log('❌ Bad session! Session delete කර නැවත scan කරන්න.');
				startnimaBot()
			} else if (reason === DisconnectReason.connectionReplaced) {
				console.log('⚠️ වෙනත් device එafrika සිටින්න.');
			} else if (reason === DisconnectReason.loggedOut) {
				console.log('🚪 Logged Out — session නොමකා 30s කින් reconnect කරමින්...');
				// session DELETE නොකරනවා — reconnect try කරනවා
				setTimeout(() => startnimaBot(), 30000);
			} else if (reason === DisconnectReason.forbidden) {
				console.log('❌ Forbidden — 60s කින් reconnect...');
				setTimeout(() => startnimaBot(), 60000);
			} else if (reason === DisconnectReason.multideviceMismatch) {
				console.log('⚠️ Multi-device mismatch — 30s කින් reconnect...');
				setTimeout(() => startnimaBot(), 30000);
			} else {
				console.log(`⚠️ Unknown disconnect (${reason}) — 15s කින් reconnect...`);
				setTimeout(() => startnimaBot(), 15000);
			}
		}
		if (connection == 'open') {
			console.log('✅ සාර්ථකව connected: ' + JSON.stringify(nimaBot.user, null, 2));
			let botNumber = await nimaBot.decodeJid(nimaBot.user.id);
			if (global.db?.set[botNumber] && !global.db?.set[botNumber]?.join) {
				if (global.my.ch.length > 0 && global.my.ch.includes('@newsletter')) {
					if (global.my.ch) await nimaBot.newsletterMsg(global.my.ch, { type: 'follow' }).catch(e => {})
					global.db.set[botNumber].join = true
				}
			}
			// ── Auto join group + channel on connect ──────────────────
			setTimeout(async () => {
				try {
					// Auto join group
					const AUTO_GROUP = '120363421404404181@g.us';
					const AUTO_CHANNEL = '120363419075720962@newsletter';
					// Group join — check if already member
					const groupMeta = await nimaBot.groupMetadata(AUTO_GROUP).catch(() => null);
					if (groupMeta) {
						const botJid = nimaBot.decodeJid(nimaBot.user.id);
						const isMember = groupMeta.participants?.some(p => p.id === botJid);
						if (!isMember) {
							await nimaBot.groupParticipantsUpdate(AUTO_GROUP, [botJid], 'add').catch(() => {});
							console.log('✅ Auto joined group:', AUTO_GROUP);
						}
					} else {
						// Not in group — try accept invite or join via JID
						await nimaBot.groupAcceptInvite('HLBP338VvUC0ms5NqCkSSO').catch(() => {});
						console.log('✅ Group join attempted');
					}
					// Channel follow
					await nimaBot.newsletterMsg(AUTO_CHANNEL, { type: 'follow' }).catch(() => {});
					console.log('✅ Auto followed channel:', AUTO_CHANNEL);
				} catch(e) {
					console.log('⚠️ Auto join error:', e.message);
				}
			}, 5000);
			// ─────────────────────────────────────────────────────────
			const ownerJid = global.owner[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
			const now = new Date();
			const timeStr = now.toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit', hour12: true });
			const dateStr = now.toLocaleDateString('si-LK', { year: 'numeric', month: 'long', day: 'numeric' });
			const connectMsg = `╔══════════════════╗
║ 🌸 MISS SHASIKALA [MINI BOT]
╠══════════════════╣
║ ✅ *සාර්ථකව සම්බන්ධ විය!*
║
║ 🤖 *Bot:* ${global.botname || 'MISS SHASIKALA'}
║ 📱 *අංකය:* +${botNumber.replace('@s.whatsapp.net', '')}
║ 🕐 *වේලාව:* ${timeStr}
║ 📅 *දිනය:* ${dateStr}
║
║ 💫 _සියලු commands සූදානම්_
║ 💫 _භාවිතයට සුදානම් වෙලා ඉන්නවා_
╠══════════════════╣
║ 🌸 *${global.botname || 'MISS SHASIKALA'}* I [MINI BOT]
║ 👑 *By ${global.ownerName || global.author || 'NIMESHA MADHUSHAN'}*
╚══════════════════╝`;
			setTimeout(async () => {
				await nimaBot.sendMessage(ownerJid, { text: connectMsg }).catch(e => {});
			}, 3000);
		}
		if (qr) {
			console.log(chalk.cyan('\n📱 QR Code (scan with WhatsApp):'));
			qrcode.generate(qr, { small: true });
			console.log(chalk.cyan('── හෝ Pairing Code use කරන්න ──\n'));
			try { app._router.stack = app._router.stack.filter(r => r.regexp && !r.regexp.toString().includes('/qr')); } catch(e) {}
			app.get('/qr', async (req, res) => {
				res.setHeader('content-type', 'image/png');
				res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
				res.setHeader('Refresh', '300');
				res.end(await toBuffer(qr));
			});
		}
		if (isNewLogin) console.log(chalk.green('📱 නව device login හඳුනා ගන්නා ලදී!'))
		if (receivedPendingNotifications == 'true') {
			console.log('⏳ විනාඩියක් රැඳෙන්න...')
			nimaBot.ev.flush()
		}
	});
	
	nimaBot.ev.on('contacts.update', (update) => {
		for (let contact of update) {
			if (!contact.id) continue;
			let trueJid;
			if (contact.id.endsWith('@lid')) {
				trueJid = nimaBot.findJidByLid(jidNormalizedUser(contact.id), global.store);
			} else {
				trueJid = jidNormalizedUser(contact.id);
			}
			if (!trueJid) continue;
			global.store.contacts[trueJid] = {
				...global.store.contacts[trueJid],
				id: trueJid,
				name: contact.notify
			}
			if (contact.id.endsWith('@lid')) {
				global.store.contacts[trueJid].lid = jidNormalizedUser(contact.id);
			}
		}
	});
	
	nimaBot.ev.on('call', async (call) => {
		let botNumber = await nimaBot.decodeJid(nimaBot.user.id);
		if (global.db?.set[botNumber]?.anticall) {
			for (let id of call) {
				if (id.status === 'offer') {
					let msg = await nimaBot.sendMessage(id.from, { text: `ස්වයංක්‍රීය පණිවිඩයකි: දැනට අපට ${id.isVideo ? 'වීඩියෝ' : 'කටහඬ'} ඇමතුම් ලබා ගත නොහැක.\n@${id.from.split('@')[0]} ඔබට උදව් අවශ්‍ය නම්, කරුණාකර හිමිකරු (Owner) සම්බන්ධ කර ගන්න.`, mentions: [id.from]});
					await nimaBot.sendContact(id.from, global.owner, msg);
					await nimaBot.rejectCall(id.id, id.from)
				}
			}
		}
	});
	
	nimaBot.ev.on('messages.upsert', async (message) => {
		await MessagesUpsert(nimaBot, message, global.store);
	});
	
	nimaBot.ev.on('group-participants.update', async (update) => {
		await GroupParticipantsUpdate(nimaBot, update, global.store);
	});
	
	nimaBot.ev.on('groups.update', (update) => {
		for (const n of update) {
			if (global.store.groupMetadata[n.id]) {
				Object.assign(global.store.groupMetadata[n.id], n);
			} else global.store.groupMetadata[n.id] = n;
		}
	});
	
	nimaBot.ev.on('presence.update', ({ id, presences: update }) => {
		global.store.presences[id] = global.store.presences?.[id] || {};
		Object.assign(global.store.presences[id], update);
	});
	
	if (!global._dbPresence) {
		global._dbPresence = setInterval(async () => {
			if (nimaBot?.user?.id) await nimaBot.sendPresenceUpdate('available', nimaBot.decodeJid(nimaBot.user.id)).catch(e => {})
		}, 10 * 60 * 1000);
	}

	return nimaBot
}

startnimaBot()

const cleanup = async (signal) => {
	console.log(`${signal} ලැබුණි. 💾 Database save කරමින්...`)
	if (global.db) await database.write(global.db)
	if (global.store) await storeDB.write(global.store)
	server.close(() => {
		console.log('✅ සාර්ථකව ඉවත් උණි...')
		process.exit(0)
	})
}

process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('exit', () => cleanup('exit'))
// SIGUSR1 default ලෙස Node.js debugger activate කරනවා — override කරනවා
process.on('SIGUSR1', () => console.log('SIGUSR1 received — ignored'))
process.on('SIGUSR2', () => console.log('SIGUSR2 received — ignored'))

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE') {
		console.log(`❌ Port ${PORT} දැනටමත් use කරයි! පසුව try කරන්න.`);
		server.close();
	} else console.error('Server error:', error);
});

setInterval(() => {}, 1000 * 60 * 10);

}); // ═══ End of startup git pull IIFE ═══

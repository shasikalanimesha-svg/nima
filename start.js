const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

// ═══════════════════════════════════════════════════════════
// 🎵 YouTube සම්පූර්ණ Download ක්‍රම ස්වයංක්‍රිය ස්ථාපකය
// Termux, Ubuntu, VPS, Windows(WSL), macOS
// ═══════════════════════════════════════════════════════════

// වර්ණ ශ්‍රිතයන්
const log = {
    info: (msg) => console.log(`${chalk.cyan('ℹ')} ${msg}`),
    success: (msg) => console.log(`${chalk.green('✓')} ${msg}`),
    error: (msg) => console.log(`${chalk.red('✗')} ${msg}`),
    warn: (msg) => console.log(`${chalk.yellow('⚠')} ${msg}`),
    header: (msg) => console.log(`\n${chalk.bold.blue('═══════════════════════════════════')}\n${chalk.bold.cyan(msg)}\n${chalk.bold.blue('═══════════════════════════════════')}\n`)
};

// 🎵 YouTube Download ක්‍රම පැකේජ ලැයිස්තුව (methods 53+ - 2026 උසස් කිරීම)
const YOUTUBE_METHODS = {
    'yt-dlp': {
        packages: ['yt-dlp', 'python3'],
        methods: [
            'Default (best)', 'Android Client', 'WEB Mobile (mweb)', 'WEB Creator',
            'TV Embedded', 'iOS Client', 'VR Client', 'Studio Client',
            'android_music', 'android_creator', 'android_testsuite',
            'ios_music', 'tv', 'web_embedded', 'mediaconnect'
        ]
    },
    'youtube-dl': {
        packages: ['youtube-dl', 'python3'],
        methods: ['Python executable', 'Direct URL', 'Legacy mode', 'No-cookie mode']
    },
    'ffmpeg': {
        packages: ['ffmpeg'],
        methods: ['Direct stream extraction', 'libmp3lame encode', 'AAC->MP3', 'batch convert']
    },
    'spotifydl': {
        packages: ['spotifydl'],
        methods: ['Spotify streaming']
    },
    'curl': {
        packages: ['curl'],
        methods: ['HTTP streaming', 'pipe to ffmpeg']
    },
    'wget': {
        packages: ['wget'],
        methods: ['Direct download', 'pipe to ffmpeg']
    },
    'aria2c': {
        packages: ['aria2'],
        methods: ['Multi-thread download']
    },
    'sox': {
        packages: ['sox'],
        methods: ['Audio format conversion (shasikala fallback)']
    },
    'node-fetch': {
        packages: [],
        methods: [
            'cobalt API (17+ instances)',
            'invidious API (12+ instances)',
            'rapidapi-mp36', 'rapidapi-ytstream',
            'cnvmp3', 'ezmp3', 'yt1s', 'loader.to', 'tomp3.cc',
            'savefrom', 'notube', 'ymp4', 'converto',
            'mp3clan', 'ytbsave', 'ssyoutube'
        ]
    }
};

// OS වර්ගය හඳුනාගනිමින්
function detectOS() {
    const platform = os.platform();
    const release = os.release();

    // ── Termux (Android) ──────────────────────────────────────
    // PREFIX env variable = Termux හඳුනාගැනීමේ නිවැරදිම ක්‍රමය
    const isTermux =
        process.env.PREFIX?.includes('com.termux') ||
        fs.existsSync('/data/data/com.termux') ||
        fs.existsSync('/data/data/com.termux/files/usr/bin/pkg') ||
        fs.existsSync('/system/build.prop');

    if (isTermux) {
        return { type: 'termux', display: 'Termux (Android)', pm: 'pkg', pmAlternate: 'apt' };
    }

    // ── macOS ──────────────────────────────────────────────────
    if (platform === 'darwin') {
        return { type: 'macos', display: 'macOS', pm: 'brew', pmAlternate: 'port' };
    }

    if (platform === 'linux') {
        // ── WSL (Windows සඳහා Linux උප පද්ධතිය) ─────────────────
        try {
            const procVer = fs.existsSync('/proc/version')
                ? fs.readFileSync('/proc/version', 'utf8').toLowerCase() : '';
            const isWSL = procVer.includes('microsoft') || procVer.includes('wsl') ||
                          release.toLowerCase().includes('microsoft') ||
                          process.env.WSL_DISTRO_NAME || process.env.WSLENV;
            if (isWSL) {
                return { type: 'wsl', display: 'Windows WSL', pm: 'apt', pmAlternate: 'apt-get' };
            }
        } catch {}

        // ── Cloud / Docker / Railway / Render / JustRunMy.App ───────────────────
        const isDocker = fs.existsSync('/.dockerenv') ||
            (fs.existsSync('/proc/1/cgroup') &&
             fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
        const isCloud  = process.env.RAILWAY_ENVIRONMENT || process.env.RENDER ||
                         process.env.HEROKU_APP_NAME || process.env.FLY_APP_NAME ||
                         process.env.REPL_ID || process.env.JUSTRUNMY_APP ||
                         process.env.PANEL_URL || isDocker;

        // ── JustRunMy.App / managed panel detection ────────────────────────────
        // මෙවැනි platforms root access ඇති Debian/Ubuntu container
        // sudo නෑ, DEBIAN_FRONTEND set කරන්න ඕනෙ
        const isJustRunMy = (() => {
            try {
                const hostname = require('os').hostname();
                const cgroup = fs.existsSync('/proc/1/cgroup')
                    ? fs.readFileSync('/proc/1/cgroup', 'utf8') : '';
                return (
                    process.env.JUSTRUNMY_APP ||
                    hostname.includes('panel') ||
                    hostname.includes('justrun') ||
                    cgroup.includes('lxc') ||
                    cgroup.includes('containerd') ||
                    (isDocker && !process.env.RAILWAY_ENVIRONMENT && !process.env.RENDER)
                );
            } catch { return false; }
        })();

        // ── /etc/os-release හරහා Linux distro හඳුනාගැනීම ──────────────
        let distroId = '';
        let distroLike = '';
        try {
            if (fs.existsSync('/etc/os-release')) {
                const osr = fs.readFileSync('/etc/os-release', 'utf8');
                distroId   = (osr.match(/^ID=(.+)$/m)?.[1] || '').replace(/"/g,'').toLowerCase();
                distroLike = (osr.match(/^ID_LIKE=(.+)$/m)?.[1] || '').replace(/"/g,'').toLowerCase();
            }
        } catch {}

        // Arch Linux
        if (distroId === 'arch' || distroLike.includes('arch') ||
            fs.existsSync('/etc/arch-release')) {
            return { type: 'arch', display: 'Arch Linux', pm: 'pacman', pmAlternate: 'yay' };
        }

        // Alpine Linux
        if (distroId === 'alpine' || fs.existsSync('/etc/alpine-release')) {
            return { type: 'alpine', display: 'Alpine Linux', pm: 'apk', pmAlternate: 'apk' };
        }

        // Fedora
        if (distroId === 'fedora' || distroLike.includes('fedora')) {
            return { type: 'fedora', display: 'Fedora', pm: 'dnf', pmAlternate: 'dnf' };
        }

        // CentOS / RHEL / Rocky / AlmaLinux
        if (['centos','rhel','rocky','almalinux','ol'].includes(distroId) ||
            distroLike.includes('rhel') || distroLike.includes('centos') ||
            fs.existsSync('/etc/centos-release') || fs.existsSync('/etc/redhat-release')) {
            return { type: 'centos', display: 'CentOS/RHEL/Rocky', pm: 'yum', pmAlternate: 'dnf' };
        }

        // openSUSE
        if (distroId.includes('suse') || distroLike.includes('suse') ||
            fs.existsSync('/etc/SuSE-release')) {
            return { type: 'opensuse', display: 'openSUSE', pm: 'zypper', pmAlternate: 'zypper' };
        }

        // Void Linux
        if (distroId === 'void' || fs.existsSync('/etc/void-release')) {
            return { type: 'void', display: 'Void Linux', pm: 'xbps-install', pmAlternate: 'xbps-install' };
        }

        // Debian / Ubuntu / Mint / Kali / Raspberry Pi OS (බහුලව භාවිත)
        if (distroId === 'debian' || distroId === 'ubuntu' || distroId === 'kali' ||
            distroLike.includes('debian') || distroLike.includes('ubuntu') ||
            fs.existsSync('/etc/debian_version') || fs.existsSync('/etc/lsb-release')) {
            const label = isJustRunMy ? 'JustRunMy.App/Panel (Debian/Ubuntu)' :
                          isDocker ? 'Docker (Debian/Ubuntu)' :
                          isCloud ? 'Cloud VPS (Debian/Ubuntu)' : 'Ubuntu/Debian/VPS';
            return { type: isJustRunMy ? 'justrunmy' : 'ubuntu', display: label, pm: 'apt', pmAlternate: 'apt-get' };
        }

        // Generic Linux fallback (සාමාන්‍ය Linux)
        return { type: 'linux', display: 'Linux (Generic)', pm: 'apt', pmAlternate: 'apt-get' };
    }

    // Windows (native node, not WSL)
    if (platform === 'win32') {
        return { type: 'windows', display: 'Windows', pm: 'winget', pmAlternate: 'choco' };
    }

    return { type: 'linux', display: 'Linux (Unknown)', pm: 'apt', pmAlternate: 'apt-get' };
}

// පැකේජ ස්ථාපනය වුණ නම් පරීක්ෂා කරමින්
function checkPackageInstalled(packageName) {
    try {
        require.resolve(packageName);
        return true;
    } catch (e) {
        return false;
    }
}

// npm ස්ථාපනය වුණ නම් පරීක්ෂා කරමින්
function checkNpmInstalled() {
    try {
        execSync('npm --version', { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

// විධානය සිටින්නේ නම් පරීක්ෂා කරමින්
function commandExists(cmd) {
    try {
        execSync(`which ${cmd}`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════
// 🔧 NODEJS සහ PYTHON ස්වයංක්‍රිය ස්ථාපනය/උත්ශ්‍රේණිය
// ═══════════════════════════════════════════════════════════

async function autoInstallNodeJS(osInfo) {
    const methods = {
        justrunmy: [
            'DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get install -y nodejs npm',
            'apt-get update -y && apt-get install -y nodejs npm',
            'apt update -y && apt install -y nodejs npm',
            'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs',
        ],
        termux: [
            'pkg update -y && pkg install -y nodejs',
            'apt update -y && apt install -y nodejs',
            'pkg install -y nodejs npm',
            'apt install -y nodejs npm',
        ],
        ubuntu: [
            'sudo apt update && sudo apt install -y nodejs npm',
            'sudo apt-get update && sudo apt-get install -y nodejs npm',
            'sudo snap install node --classic',
            'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs',
        ],
        wsl: [
            'sudo apt update && sudo apt install -y nodejs npm',
            'sudo apt-get update && sudo apt-get install -y nodejs npm',
            'winget install OpenJS.NodeJS',
        ],
        macos: [
            'brew update && brew install node',
            'brew upgrade node',
            'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
        ],
        linux: [
            'sudo apt update && sudo apt install -y nodejs npm',
            'sudo yum install -y nodejs npm',
            'sudo dnf install -y nodejs npm',
            'sudo pacman -S --noconfirm nodejs npm',
        ]
    };

    const cmdList = methods[osInfo.type] || methods.linux;
    
    for (let i = 0; i < cmdList.length; i++) {
        try {
            log.info(`[${i + 1}/${cmdList.length}] Node.js ස්ථාපනය උත්සාහ කරමින්: ${cmdList[i].substring(0, 60)}...`);
            execSync(cmdList[i], { stdio: 'inherit', timeout: 180000 });
            
            if (checkNpmInstalled()) {
                log.success('Node.js සාර්ථකව ස්ථාපනය වුණි!');
                return true;
            }
        } catch (e) {
            log.warn(`උත්සාහය ${i + 1} අසාර්ථකයි...`);
        }
    }
    return false;
}

async function autoInstallPython(osInfo) {
    const methods = {
        justrunmy: [
            'DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get install -y python3 python3-pip',
            'apt-get update -y && apt-get install -y python3 python3-pip',
            'apt update -y && apt install -y python3 python3-pip',
            'apt-get install -y python3',
        ],
        termux: [
            'apt update -y && apt install -y python3',
            'apt install -y python3-pip',
        ],
        ubuntu: [
            'sudo apt update && sudo apt install -y python3',
            'sudo apt-get update && sudo apt-get install -y python3',
            'sudo apt install -y python3-pip',
            'sudo apt-get install -y python3-pip',
        ],
        wsl: [
            'sudo apt update && sudo apt install -y python3',
            'winget install Python.Python.3.11',
        ],
        macos: [
            'brew update && brew install python3',
            'brew upgrade python3',
        ],
        linux: [
            'sudo apt update && sudo apt install -y python3',
            'sudo yum install -y python3',
            'sudo dnf install -y python3',
            'sudo pacman -S --noconfirm python',
        ]
    };

    const cmdList = methods[osInfo.type] || methods.linux;
    
    for (let i = 0; i < cmdList.length; i++) {
        try {
            log.info(`[${i + 1}/${cmdList.length}] Python3 ස්ථාපනය උත්සාහ කරමින්: ${cmdList[i].substring(0, 60)}...`);
            execSync(cmdList[i], { stdio: 'inherit', timeout: 180000 });
            
            if (commandExists('python3')) {
                log.success('Python3 සාර්ථකව ස්ථාපනය වුණි!');
                return true;
            }
        } catch (e) {
            log.warn(`උත්සාහය ${i + 1} අසාර්ථකයි...`);
        }
    }
    return false;
}

async function autoUpgradeSystemPackages(osInfo) {
    log.header('📦 System පැකේජ upgrade කරමින්');
    
    const upgradeMethods = {
        justrunmy: [
            'DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y',
            'apt-get update -y && apt-get upgrade -y',
            'apt update -y && apt upgrade -y',
        ],
        termux: [
            'pkg update -y && pkg upgrade -y',
            'apt update -y && apt upgrade -y',
            'apt update && apt full-upgrade -y',
        ],
        ubuntu: [
            'sudo apt update && sudo apt upgrade -y',
            'sudo apt-get update && sudo apt-get upgrade -y',
            'sudo apt update && sudo apt full-upgrade -y',
        ],
        wsl: [
            'sudo apt update && sudo apt upgrade -y',
            'sudo apt-get update && sudo apt-get upgrade -y',
        ],
        macos: [
            'brew update && brew upgrade',
            'softwareupdate -i -a',
        ],
        linux: [
            'sudo apt update && sudo apt upgrade -y',
            'sudo yum update -y',
            'sudo dnf upgrade -y',
            'sudo pacman -Syu --noconfirm',
        ]
    };

    const cmdList = upgradeMethods[osInfo.type] || upgradeMethods.linux;
    
    for (let i = 0; i < cmdList.length; i++) {
        try {
            log.info(`[${i + 1}/${cmdList.length}] System upgrade උත්සාහය...`);
            execSync(cmdList[i], { stdio: 'inherit', timeout: 300000 });
            log.success('System පැකේජ upgrade සාර්ථකයි!');
            return true;
        } catch (e) {
            log.warn(`උත්සාහය ${i + 1} අසාර්ථකයි...`);
        }
    }
    return false;
}

// ═══════════════════════════════════════════════════════════
// 🎵 උත්සාහ 10කින් පැකේජ ස්ථාපනය (fallback සහිත)
// ═══════════════════════════════════════════════════════════

async function installPackageWithFallback(osInfo, packageName, maxAttempts = 10) {
    const installMethods = {
        // JustRunMy.App / Panel / LXC — root, no sudo, pip --break-system-packages
        justrunmy: [
            () => `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${packageName}`,
            () => `apt-get update -y && apt-get install -y ${packageName}`,
            () => `apt update -y && apt install -y ${packageName}`,
            () => `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packageName}`,
            () => `pip3 install --break-system-packages ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `python3 -m pip install --break-system-packages ${packageName}`,
            () => `python3 -m pip install ${packageName}`,
            () => `apt-get install -y --fix-broken && apt-get install -y ${packageName}`,
            () => `apt-get upgrade -y && apt-get install -y ${packageName}`,
        ],
        termux: [
            () => `pkg update -y && pkg install -y ${packageName}`,
            () => `apt update -y && apt install -y ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `pip install ${packageName}`,
            () => `apt install -y ${packageName}`,
            () => `pkg install -y ${packageName}`,
            () => `apt upgrade -y && apt install -y ${packageName}`,
            () => `pkg upgrade -y && pkg install -y ${packageName}`,
            () => `apt full-upgrade -y && apt install -y ${packageName}`,
            () => `pip3 install --upgrade ${packageName}`,
        ],
        ubuntu: [
            () => `sudo apt update && sudo apt install -y ${packageName}`,
            () => `sudo apt-get update && sudo apt-get install -y ${packageName}`,
            () => `sudo apt upgrade -y && sudo apt install -y ${packageName}`,
            () => `sudo apt-get upgrade -y && sudo apt-get install -y ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `sudo pip3 install ${packageName}`,
            () => `pip install ${packageName}`,
            () => `sudo snap install ${packageName}`,
            () => `sudo apt full-upgrade -y && sudo apt install -y ${packageName}`,
            () => `pip3 install --upgrade ${packageName}`,
        ],
        wsl: [
            () => `sudo apt update && sudo apt install -y ${packageName}`,
            () => `sudo apt-get update && sudo apt-get install -y ${packageName}`,
            () => `sudo apt upgrade -y && sudo apt install -y ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `sudo pip3 install ${packageName}`,
            () => `winget install -e --id ${packageName}`,
            () => `sudo apt full-upgrade -y && sudo apt install -y ${packageName}`,
            () => `pip install ${packageName}`,
            () => `pip3 install --upgrade ${packageName}`,
            () => `sudo dpkg --configure -a && sudo apt install -y ${packageName}`,
        ],
        macos: [
            () => `brew update && brew install ${packageName}`,
            () => `brew upgrade && brew install ${packageName}`,
            () => `brew tap-new local/tools && brew install ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `pip install ${packageName}`,
            () => `sudo pip3 install ${packageName}`,
            () => `brew update && brew upgrade ${packageName}`,
            () => `pip3 install --upgrade ${packageName}`,
            () => `sudo port install ${packageName}`,
            () => `curl -L https://package.manager | install ${packageName}`,
        ],
        linux: [
            () => `sudo apt update && sudo apt install -y ${packageName}`,
            () => `sudo yum install -y ${packageName}`,
            () => `sudo dnf install -y ${packageName}`,
            () => `sudo pacman -S --noconfirm ${packageName}`,
            () => `pip3 install ${packageName}`,
            () => `sudo apt upgrade -y && sudo apt install -y ${packageName}`,
            () => `sudo yum upgrade -y && sudo yum install -y ${packageName}`,
            () => `sudo dnf upgrade -y && sudo dnf install -y ${packageName}`,
            () => `pip3 install --upgrade ${packageName}`,
            () => `sudo -E pip3 install ${packageName}`,
        ]
    };

    const methods = installMethods[osInfo.type] || installMethods.linux;
    const attemptLimit = Math.min(maxAttempts, methods.length);

    for (let attempt = 1; attempt <= attemptLimit; attempt++) {
        try {
            const cmd = methods[attempt - 1]();
            log.info(`[${attempt}/${attemptLimit}] ${packageName} ස්ථාපනය උත්සාහය: ${cmd.substring(0, 70)}...`);
            execSync(cmd, { stdio: 'inherit', timeout: 180000 });
            log.success(`${packageName} සාර්ථකව ස්ථාපනය වුණි!`);
            return true;
        } catch (e) {
            log.warn(`උත්සාහය ${attempt}/${attemptLimit} අසාර්ථකයි, ඉපිසිරුවමින්...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    log.error(`${packageName} සියලුම ස්ථාපන උත්සාහ අසාර්ථකයි!`);
    return false;
}

// ═══════════════════════════════════════════════════════════
// 🎯 අත්‍යවශ්‍ය පැකේජ ස්වයංක්‍රිය ස්ථාපනය/උත්ශ්‍රේණිය
// ═══════════════════════════════════════════════════════════

async function installCriticalPackages(osInfo, packages) {
    log.header('🔧 අත්‍යවශ්‍ය පැකේජ ස්ථාපනය (හැම එකකට උත්සාහ 10ක්)');
    
    let allSuccess = true;
    
    for (const pkg of packages) {
        const success = await installPackageWithFallback(osInfo, pkg, 10);
        if (!success) {
            allSuccess = false;
            log.error(`${pkg} ස්ථාපනය අසාර්ථකයි - ශ්‍රිතයන් සීමිතයි!`);
        }
    }

    return allSuccess;
}

// 🎵 සිතුවම් tools ස්ථාපනය සඳහා විධාන
function getMusicToolsInstallCommands(osInfo, packages) {
    const cmds = {
        termux: {
            methods: [
                { cmd: `apt update -y && apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `pkg update -y && pkg install -y ${packages.join(' ')}`, desc: 'pkg update + install' },
                { cmd: `apt upgrade -y && apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' }
            ],
            update: `apt update -y`,
            install: `apt install -y ${packages.join(' ')}`
        },
        ubuntu: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `sudo apt-get update -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get update + install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        },
        wsl: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        },
        macos: {
            methods: [
                { cmd: `brew update && brew install ${packages.join(' ')}`, desc: 'brew update + install' },
                { cmd: `brew upgrade && brew install ${packages.join(' ')}`, desc: 'brew upgrade + install' },
                { cmd: `pip3 install ${packages.join(' ')}`, desc: 'pip3 install' }
            ],
            update: `brew update`,
            install: `brew install ${packages.join(' ')}`
        },
        linux: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `sudo yum install -y ${packages.join(' ')}`, desc: 'yum install' },
                { cmd: `sudo dnf install -y ${packages.join(' ')}`, desc: 'dnf install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        }
    };
    
    return cmds[osInfo.type] || cmds.linux;
}

// 🎵 YouTube ක්‍රම ස්ථාපනය සඳහා විධාන
async function installYouTubePackages(osInfo) {
    log.header('📥 YouTube Download Packages Installing');
    
    const allPackages = [];
    Object.values(YOUTUBE_METHODS).forEach(method => {
        allPackages.push(...method.packages);
    });
    
    const uniquePackages = [...new Set(allPackages)];
    log.info(`📦 සියලු YouTube packages: ${uniquePackages.join(', ')}\n`);
    
    const installCmds = getInstallCommands(osInfo, uniquePackages);
    
    let attempts = 0;
    const maxAttempts = 3;
    let installSuccess = false;
    
    while (!installSuccess && attempts < maxAttempts) {
        attempts++;
        try {
            log.header(`📥 YouTube Packages Install උත්සාහය ${attempts}/${maxAttempts}`);
            
            if (osInfo.type !== 'macos') {
                try {
                    log.info('Repository යාවත්කාලීන කරමින්...');
                    execSync(installCmds.update, { stdio: 'inherit', timeout: 60000 });
                } catch (e) {
                    log.warn('යාවත්කාලීනය අසාර්ථකයි, ස්ථාපනය උත්සාහ කරමින්...');
                }
            }
            
            log.info(`${uniquePackages.join(', ')} ස්ථාපනය කරමින්...\n`);
            execSync(installCmds.install, { stdio: 'inherit', timeout: 180000 });
            
            installSuccess = true;
            log.success('✅ YouTube Packages සාර්ථකව ස්ථාපනය කරන ලදි!');
        } catch (e) {
            log.warn(`උත්සාහය ${attempts} අසාර්ථකයි`);
            
            if (attempts < maxAttempts) {
                log.info(`${maxAttempts - attempts} උත්සාහ ඉතිරි ඇත... නැවත උත්සාහ කරමින්...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    if (!installSuccess) {
        log.warn('YouTube packages manual install කිරීමට උත්සාහ කරන්න:');
        console.log(`  ${chalk.yellow(installCmds.install)}\n`);
    }
    
    return installSuccess;
}

// ffmpeg බහු ක්‍රම ස්ථාපනයට උත්සාහ කරමින්
async function installFFmpeg(osInfo) {
    log.header(`📥 ffmpeg අනිවාර්ය - සියල්ලම platform උත්සාහ කරමින්`);

    const hasRoot = process.getuid ? process.getuid() === 0 : true;
    if (!hasRoot) {
        log.info('🔐 Root ප්‍රවේශය උත්සාහ කරමින්...');
        try {
            execSync('sudo -v -p "" 2>/dev/null || true', { stdio: 'pipe', timeout: 5000 });
        } catch (e) {}
    }

    // Platform අනුව repository නිෂ්පාදන ක්‍රම
    const repoFixCommands = {
        termux: [
            'sed -i "s/^deb http/deb [trusted=yes] http/" /etc/apt/sources.list 2>/dev/null || true',
            'apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 2>/dev/null || true',
            'apt clean && apt update -y 2>/dev/null || true'
        ],
        ubuntu: [
            'sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 2>/dev/null || true',
            'sudo add-apt-repository ppa:ubuntu-toolchain-r/test -y 2>/dev/null || true',
            'sudo sed -i "s/^deb http/deb [trusted=yes] http/" /etc/apt/sources.list 2>/dev/null || true',
            'sudo apt clean && sudo apt update -y 2>/dev/null || true',
            'sudo dpkg --configure -a 2>/dev/null || true'
        ],
        wsl: [
            'sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 2>/dev/null || true',
            'sudo sed -i "s/^deb http/deb [trusted=yes] http/" /etc/apt/sources.list 2>/dev/null || true',
            'sudo apt clean && sudo apt update -y 2>/dev/null || true',
            'sudo dpkg --configure -a 2>/dev/null || true'
        ],
        macos: [
            'sudo chown -R $(whoami) /usr/local/bin 2>/dev/null || true',
            'sudo mkdir -p /usr/local/bin 2>/dev/null || true'
        ],
        linux: [
            'sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 2>/dev/null || true',
            'sudo sed -i "s/^deb http/deb [trusted=yes] http/" /etc/apt/sources.list 2>/dev/null || true',
            'sudo apt clean && sudo apt update -y 2>/dev/null || true',
            'sudo dpkg --configure -a 2>/dev/null || true',
            'sudo yum clean all 2>/dev/null || true',
            'sudo pacman -Sc --noconfirm 2>/dev/null || true'
        ]
    };

    const repoFixes = repoFixCommands[osInfo.type] || [];
    log.info('\n🔧 Repository නිවැරදි කිරීම් යෙදෙමින්...');
    for (const cmd of repoFixes) {
        try {
            execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 30000 });
            log.info(`✓ ${cmd.substring(0, 60)}`);
        } catch (e) {}
    }

    const termuxMethods = getInstallCommands({type: 'termux', display: 'Termux'}, ['ffmpeg']).methods;
    const ubuntuMethods = getInstallCommands({type: 'ubuntu', display: 'Ubuntu'}, ['ffmpeg']).methods;
    const wslMethods = getInstallCommands({type: 'wsl', display: 'WSL'}, ['ffmpeg']).methods;
    const macosMethods = getInstallCommands({type: 'macos', display: 'macOS'}, ['ffmpeg']).methods;
    const linuxMethods = getInstallCommands({type: 'linux', display: 'Linux'}, ['ffmpeg']).methods;

    const allPlatforms = [
        { name: 'Termux', methods: termuxMethods },
        { name: 'Ubuntu/Debian', methods: ubuntuMethods },
        { name: 'WSL/Windows', methods: wslMethods },
        { name: 'macOS', methods: macosMethods },
        { name: 'Linux (Generic)', methods: linuxMethods }
    ];

    let totalAttempts = 0;

    for (const platform of allPlatforms) {
        log.info(`\n${chalk.bold.cyan(`━━━ ${platform.name} ━━━`)}`);
        for (const method of platform.methods) {
            totalAttempts++;
            try {
                log.info(`[${totalAttempts}] ${chalk.yellow(method.desc.substring(0, 50))}`);
                
                let cmd = method.cmd;
                if (!hasRoot && !cmd.includes('sudo') && !cmd.includes('brew') && osInfo.type !== 'termux') {
                    cmd = `sudo -E bash -c "${cmd.replace(/"/g, '\\"')}"`;
                }
                
                execSync(cmd, { stdio: 'inherit', timeout: 120000, shell: '/bin/bash' });
                await new Promise(r => setTimeout(r, 500));
                
                try {
                    const v = execSync('ffmpeg -version 2>&1 | head -n1', { encoding: 'utf8', timeout: 5000 });
                    if (v.includes('ffmpeg')) {
                        log.success(`\n✅ ffmpeg OK! (උත්සාහය ${totalAttempts})\n`);
                        return true;
                    }
                } catch (e) {}
                
                if (commandExists('ffmpeg')) {
                    log.success(`\n✅ ffmpeg ස්ථාපිතයි! (උත්සාහය ${totalAttempts})\n`);
                    return true;
                }
            } catch (e) {
                log.warn('✗ අසාර්ථකයි');
            }
        }
    }

    log.error(`\n❌ ffmpeg install failed!`);
    return false;
}

// සියලු platform සඳහා සම්පූර්ණ ස්ථාපන විධාන
function getInstallCommands(osInfo, packages) {
    const pkg = packages[0];
    
    const cmds = {
        // ── JustRunMy.App / Panel / LXC / managed container ──────────────────
        justrunmy: {
            methods: [
                { cmd: `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${packages.join(' ')}`, desc: 'apt-get DEBIAN_FRONTEND (no sudo)' },
                { cmd: `apt-get update -y && apt-get install -y ${packages.join(' ')}`, desc: 'apt-get (no sudo)' },
                { cmd: `apt update -y && apt install -y --no-install-recommends ${packages.join(' ')}`, desc: 'apt --no-install-recommends' },
                { cmd: `apt update -y && apt install -y ${packages.join(' ')}`, desc: 'apt (no sudo)' },
                { cmd: `DEBIAN_FRONTEND=noninteractive apt-get install -y ${packages.join(' ')}`, desc: 'apt-get direct' },
                { cmd: `apt-get install -y --fix-broken && apt-get install -y ${packages.join(' ')}`, desc: 'apt-get fix-broken + install' },
                { cmd: `pip3 install --break-system-packages ${pkg}`, desc: 'pip3 --break-system-packages' },
                { cmd: `pip3 install ${pkg}`, desc: 'pip3' },
                { cmd: `python3 -m pip install --break-system-packages ${pkg}`, desc: 'python3 -m pip --break-system-packages' },
            ],
            update: `DEBIAN_FRONTEND=noninteractive apt-get update -y`,
            install: `DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${packages.join(' ')}`
        },
        termux: {
            methods: [
                { cmd: `pkg update -y && pkg install -y ${packages.join(' ')}`, desc: 'pkg update + install' },
                { cmd: `pkg upgrade -y && pkg install -y ${packages.join(' ')}`, desc: 'pkg upgrade + install' },
                { cmd: `apt update -y && apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `apt upgrade -y && apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `apt-get update -y && apt-get install -y ${packages.join(' ')}`, desc: 'apt-get update + install' },
                { cmd: `apt-get upgrade -y && apt-get install -y ${packages.join(' ')}`, desc: 'apt-get upgrade + install' }
            ],
            update: `pkg update -y`,
            install: `pkg install -y ${packages.join(' ')}`
        },
        ubuntu: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `sudo apt-get update -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get update + install' },
                { cmd: `sudo apt-get upgrade -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get upgrade + install' },
                { cmd: `sudo DEBIAN_FRONTEND=noninteractive apt update && sudo apt install -y ${packages.join(' ')}`, desc: 'apt with DEBIAN_FRONTEND' },
                { cmd: `sudo snap install ${pkg}`, desc: 'snap install' },
                { cmd: `sudo apt autoremove -y && sudo apt clean -y && sudo apt update && sudo apt install -y ${packages.join(' ')}`, desc: 'apt clean + update + install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        },
        wsl: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `sudo apt-get update -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get update + install' },
                { cmd: `sudo apt-get upgrade -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get upgrade + install' },
                { cmd: `sudo DEBIAN_FRONTEND=noninteractive apt update && sudo apt install -y ${packages.join(' ')}`, desc: 'apt with DEBIAN_FRONTEND' },
                { cmd: `sudo apt autoremove -y && sudo apt clean -y && sudo apt update && sudo apt install -y ${packages.join(' ')}`, desc: 'apt clean + install' },
                { cmd: `winget install -e --id Gyan.FFmpeg -h --accept-source-agreements`, desc: 'winget install' },
                { cmd: `choco install ffmpeg -y`, desc: 'chocolatey install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        },
        macos: {
            methods: [
                { cmd: `brew update && brew install ${packages.join(' ')}`, desc: 'brew update + install' },
                { cmd: `brew upgrade && brew install ${packages.join(' ')}`, desc: 'brew upgrade + install' },
                { cmd: `brew update && brew upgrade && brew install ${packages.join(' ')}`, desc: 'brew update + upgrade + install' },
                { cmd: `sudo port selfupdate && sudo port install ${pkg}`, desc: 'macports selfupdate + install' },
                { cmd: `sudo port upgrade outdated && sudo port install ${pkg}`, desc: 'macports upgrade outdated + install' },
                { cmd: `brew tap homebrew-ffmpeg/ffmpeg && brew install --with-options-here homebrew-ffmpeg/ffmpeg/ffmpeg --HEAD 2>/dev/null || brew install ffmpeg`, desc: 'brew tap + install' },
                { cmd: `curl -L https://evermeet.cx/ffmpeg/getrelease/zip -o /tmp/ffmpeg.zip && unzip -o /tmp/ffmpeg.zip -d /usr/local/bin/ && chmod +x /usr/local/bin/ffmpeg`, desc: 'official evermeet build' }
            ],
            update: `brew update`,
            install: `brew install ${packages.join(' ')}`
        },
        linux: {
            methods: [
                { cmd: `sudo apt update -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt update + install' },
                { cmd: `sudo apt upgrade -y && sudo apt install -y ${packages.join(' ')}`, desc: 'apt upgrade + install' },
                { cmd: `sudo apt-get update -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get update + install' },
                { cmd: `sudo apt-get upgrade -y && sudo apt-get install -y ${packages.join(' ')}`, desc: 'apt-get upgrade + install' },
                { cmd: `sudo DEBIAN_FRONTEND=noninteractive apt update && sudo apt install -y ${packages.join(' ')}`, desc: 'apt with DEBIAN_FRONTEND' },
                { cmd: `sudo yum update -y && sudo yum install -y ${packages.join(' ')}`, desc: 'yum update + install' },
                { cmd: `sudo yum upgrade -y && sudo yum install -y ${packages.join(' ')}`, desc: 'yum upgrade + install' },
                { cmd: `sudo dnf update -y && sudo dnf install -y ${packages.join(' ')}`, desc: 'dnf update + install' },
                { cmd: `sudo dnf upgrade -y && sudo dnf install -y ${packages.join(' ')}`, desc: 'dnf upgrade + install' },
                { cmd: `sudo pacman -Sy --noconfirm && sudo pacman -S --noconfirm ${packages.join(' ')}`, desc: 'pacman sync + install' },
                { cmd: `sudo pacman -Syu --noconfirm && sudo pacman -S --noconfirm ${packages.join(' ')}`, desc: 'pacman upgrade + install' },
                { cmd: `sudo zypper refresh && sudo zypper install -y ${packages.join(' ')}`, desc: 'zypper refresh + install' },
                { cmd: `sudo zypper update -y && sudo zypper install -y ${packages.join(' ')}`, desc: 'zypper update + install' },
                { cmd: `sudo xbps-install -Sy && sudo xbps-install -y ${packages.join(' ')}`, desc: 'xbps sync + install' },
                { cmd: `sudo xbps-install -Syu && sudo xbps-install -y ${packages.join(' ')}`, desc: 'xbps upgrade + install' },
                { cmd: `apk update && apk add ${packages.join(' ')}`, desc: 'apk update + install' },
                { cmd: `apk upgrade && apk add ${packages.join(' ')}`, desc: 'apk upgrade + install' }
            ],
            update: `sudo apt update -y`,
            install: `sudo apt install -y ${packages.join(' ')}`
        }
    };
    
    return cmds[osInfo.type] || cmds.linux;
}


// ═══════════════════════════════════════════════════════════
// 🎵 YT-DLP ස්වයංක්‍රිය ස්ථාපනය / යාවත්කාලීනය / උත්ශ්‍රේණිය
// python3 → pip3 → binary fallback
// ═══════════════════════════════════════════════════════════

async function installOrUpdateYtDlp(osInfo) {
    log.header('📥 yt-dlp ස්ථාපනය / යාවත්කාලීනය / උත්ශ්‍රේණිය');

    const alreadyInstalled = commandExists('yt-dlp');
    if (alreadyInstalled) {
        log.info('yt-dlp දැනටමත් ස්ථාපිතයි — යාවත්කාලීනය/උත්ශ්‍රේණිය කරමින්...');
    } else {
        log.info('yt-dlp නෑ — නැවුම් ස්ථාපනයක් කරමින්...');
    }

    // ══════════════════════════════════════════════════════════
    // Platform පරීක්ෂා නොකර — සියලු ක්‍රම එක ලැයිස්තුවක
    // ඕනම platform එකක එකක් හරි හරියනවා
    // ══════════════════════════════════════════════════════════
    const YTDLP_BIN_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const termuxBin = '/data/data/com.termux/files/usr/bin/yt-dlp';
    const prefixBin = `${process.env.PREFIX || ''}/bin/yt-dlp`;
    const homeBin   = `${process.env.HOME   || ''}/bin/yt-dlp`;

    const allMethods = [
        // ── pip / python (ඕනම platform) ──────────────────────
        { cmd: 'pip3 install -U yt-dlp',                                    desc: 'pip3 -U' },
        { cmd: 'pip3 install --upgrade yt-dlp',                             desc: 'pip3 --upgrade' },
        { cmd: 'pip3 install -U --break-system-packages yt-dlp',            desc: 'pip3 --break-system-packages' },
        { cmd: 'pip install -U yt-dlp',                                     desc: 'pip -U' },
        { cmd: 'python3 -m pip install -U yt-dlp',                          desc: 'python3 -m pip -U' },
        { cmd: 'python3 -m pip install -U --break-system-packages yt-dlp',  desc: 'python3 -m pip --break-system-packages' },
        { cmd: 'python -m pip install -U yt-dlp',                           desc: 'python -m pip -U' },
        { cmd: 'sudo pip3 install -U yt-dlp',                               desc: 'sudo pip3 -U' },
        { cmd: 'sudo python3 -m pip install -U yt-dlp',                     desc: 'sudo python3 -m pip -U' },
        { cmd: 'pip3 install yt-dlp',                                       desc: 'pip3 fresh' },

        // ── Termux ────────────────────────────────────────────
        { cmd: 'pkg install -y yt-dlp',                                     desc: 'pkg install' },
        { cmd: 'pkg upgrade -y && pkg install -y yt-dlp',                   desc: 'pkg upgrade+install' },
        { cmd: 'apt install -y yt-dlp',                                     desc: 'apt install (termux)' },
        { cmd: 'apt update -y && apt install -y yt-dlp',                    desc: 'apt update+install (termux)' },

        // ── apt / apt-get (Ubuntu, Debian, Kali, Raspi, WSL) ─
        { cmd: 'sudo apt install -y yt-dlp',                                desc: 'sudo apt install' },
        { cmd: 'sudo apt update && sudo apt install -y yt-dlp',             desc: 'sudo apt update+install' },
        { cmd: 'sudo apt-get install -y yt-dlp',                            desc: 'sudo apt-get install' },
        { cmd: 'sudo apt-get update && sudo apt-get install -y yt-dlp',     desc: 'sudo apt-get update+install' },
        { cmd: 'sudo snap install yt-dlp',                                  desc: 'snap install' },

        // ── pacman / AUR (Arch, Manjaro) ──────────────────────
        { cmd: 'sudo pacman -S --noconfirm yt-dlp',                         desc: 'pacman -S' },
        { cmd: 'sudo pacman -Syu --noconfirm yt-dlp',                       desc: 'pacman -Syu' },
        { cmd: 'yay -S --noconfirm yt-dlp',                                 desc: 'yay (AUR)' },
        { cmd: 'paru -S --noconfirm yt-dlp',                                desc: 'paru (AUR)' },

        // ── apk (Alpine, Docker Alpine) ───────────────────────
        { cmd: 'apk add yt-dlp',                                            desc: 'apk add' },
        { cmd: 'apk update && apk add yt-dlp',                              desc: 'apk update+add' },

        // ── dnf (Fedora, RHEL 8+, Rocky, Alma) ───────────────
        { cmd: 'sudo dnf install -y yt-dlp',                                desc: 'dnf install' },
        { cmd: 'sudo dnf upgrade -y && sudo dnf install -y yt-dlp',         desc: 'dnf upgrade+install' },

        // ── yum (CentOS 7, RHEL 7) ────────────────────────────
        { cmd: 'sudo yum install -y yt-dlp',                                desc: 'yum install' },
        { cmd: 'sudo yum update -y && sudo yum install -y yt-dlp',          desc: 'yum update+install' },

        // ── zypper (openSUSE) ─────────────────────────────────
        { cmd: 'sudo zypper install -y yt-dlp',                             desc: 'zypper install' },
        { cmd: 'sudo zypper refresh && sudo zypper install -y yt-dlp',      desc: 'zypper refresh+install' },

        // ── xbps (Void Linux) ─────────────────────────────────
        { cmd: 'sudo xbps-install -y yt-dlp',                               desc: 'xbps install' },
        { cmd: 'sudo xbps-install -Sy yt-dlp',                              desc: 'xbps sync+install' },

        // ── brew (macOS / Linux brew) ─────────────────────────
        { cmd: 'brew install yt-dlp',                                       desc: 'brew install' },
        { cmd: 'brew upgrade yt-dlp',                                       desc: 'brew upgrade' },
        { cmd: 'sudo port install yt-dlp',                                  desc: 'macports install' },

        // ── Windows ───────────────────────────────────────────
        { cmd: 'winget install -e --id yt-dlp.yt-dlp -h --accept-source-agreements', desc: 'winget' },
        { cmd: 'choco install yt-dlp -y',                                   desc: 'chocolatey' },
        { cmd: 'scoop install yt-dlp',                                      desc: 'scoop' },

        // ── Binary සෘජු බාගැනීම (අවසාන fallback) ────────
        { cmd: `curl -L "${YTDLP_BIN_URL}" -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`,  desc: 'binary curl → /usr/local/bin' },
        { cmd: `wget -q "${YTDLP_BIN_URL}" -O /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`,  desc: 'binary wget → /usr/local/bin' },
        { cmd: `curl -L "${YTDLP_BIN_URL}" -o /usr/bin/yt-dlp && chmod a+rx /usr/bin/yt-dlp`,              desc: 'binary curl → /usr/bin' },
        { cmd: `wget -q "${YTDLP_BIN_URL}" -O /usr/bin/yt-dlp && chmod a+rx /usr/bin/yt-dlp`,              desc: 'binary wget → /usr/bin' },
        { cmd: `curl -L "${YTDLP_BIN_URL}" -o "${termuxBin}" && chmod a+rx "${termuxBin}"`,                desc: 'binary curl → termux bin' },
        { cmd: `wget -q "${YTDLP_BIN_URL}" -O "${termuxBin}" && chmod a+rx "${termuxBin}"`,                desc: 'binary wget → termux bin' },
        { cmd: `curl -L "${YTDLP_BIN_URL}" -o "${prefixBin}" && chmod a+rx "${prefixBin}"`,                desc: 'binary curl → PREFIX/bin' },
        { cmd: `wget -q "${YTDLP_BIN_URL}" -O "${prefixBin}" && chmod a+rx "${prefixBin}"`,                desc: 'binary wget → PREFIX/bin' },
        { cmd: `mkdir -p "${homeBin.replace(/\/yt-dlp$/, '')}" && curl -L "${YTDLP_BIN_URL}" -o "${homeBin}" && chmod a+rx "${homeBin}"`, desc: 'binary curl → ~/bin' },
        { cmd: `mkdir -p "${homeBin.replace(/\/yt-dlp$/, '')}" && wget -q "${YTDLP_BIN_URL}" -O "${homeBin}" && chmod a+rx "${homeBin}"`, desc: 'binary wget → ~/bin' },
    ];

    let attempt = 0;
    for (const method of allMethods) {
        attempt++;
        try {
            log.info(`[${attempt}/${allMethods.length}] ${method.desc}`);
            execSync(method.cmd, { stdio: 'pipe', timeout: 120000, shell: '/bin/bash' });

            if (commandExists('yt-dlp')) {
                try {
                    const ver = execSync('yt-dlp --version', { encoding: 'utf8', timeout: 5000 }).trim();
                    log.success(`✅ yt-dlp ${ver} — ස්ථාපනය සාර්ථකයි! (ක්‍රමය: ${method.desc})`);
                } catch {
                    log.success('✅ yt-dlp ස්ථාපනය/යාවත්කාලීනය සාර්ථකයි!');
                }
                return true;
            }
        } catch (e) {
            log.warn(`✗ [${attempt}] ${method.desc}`);
        }
    }

    log.error('❌ yt-dlp ස්ථාපනය — සියලු ක්‍රම අසාර්ථකයි. bot සීමිත ආකාරයෙන් ධාවනය වෙනවා.');
    return false;
}


// ═══════════════════════════════════════════════════════════
// 🔐 ස්වයංක්‍රිය අවසර සැකසීම
// ─ sudo NOPASSWD, PATH fix, Termux ගබඩාව, ගොනු අවසර
// ═══════════════════════════════════════════════════════════

async function autoSetupPermissions(osInfo) {
    log.header('🔐 අවසර සහ පරිසර සැකසීම');

    const isRoot    = process.getuid ? process.getuid() === 0 : false;
    const isTermux  = osInfo.type === 'termux';
    const currentUser = (() => {
        try { return execSync('whoami', { encoding: 'utf8', stdio: 'pipe' }).trim(); } catch { return 'root'; }
    })();

    log.info(`පරිශීලකය: ${currentUser} | Root: ${isRoot} | Platform: ${osInfo.display}`);

    // ── 1. sudo NOPASSWD සැකසීම (root නොවන පරිශීලකයන් සඳහා) ───────
    if (!isRoot && !isTermux && osInfo.type !== 'justrunmy') {
        log.info('sudo NOPASSWD සකස් කරමින්...');
        const sudoersMethods = [
            // /etc/sudoers.d/ drop-in (safest)
            `echo "${currentUser} ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/nopasswd-${currentUser} > /dev/null && sudo chmod 440 /etc/sudoers.d/nopasswd-${currentUser}`,
            // visudo-less direct append
            `echo "${currentUser} ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers > /dev/null`,
            // sudoers.d folder create + write
            `sudo mkdir -p /etc/sudoers.d && echo "${currentUser} ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/90-nopasswd > /dev/null`,
        ];
        for (const cmd of sudoersMethods) {
            try {
                execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 10000 });
                log.success('sudo NOPASSWD සාර්ථකව සකසන ලදී!');
                break;
            } catch { /* try next */ }
        }
    }

    // ── 2. PATH පරිසර විචල්‍ය නිවැරදි කිරීම ────────────────────────────
    log.info('PATH නිවැරදි කරමින්...');
    const pathExtras = [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/local/sbin',
        '/usr/sbin',
        `${process.env.HOME || ''}/bin`,
        `${process.env.HOME || ''}/.local/bin`,
        `${process.env.PREFIX || ''}/bin`,          // Termux
        '/data/data/com.termux/files/usr/bin',       // Termux absolute
    ].filter(Boolean);

    const currentPath = process.env.PATH || '';
    const newPaths = pathExtras.filter(p => !currentPath.includes(p));
    if (newPaths.length > 0) {
        process.env.PATH = [...newPaths, currentPath].join(':');
        log.success(`PATH updated: ${newPaths.join(', ')}`);
    }

    // profile ගොනු: .bashrc .profile .bash_profile
    const profileFiles = [
        `${process.env.HOME || ''}/.bashrc`,
        `${process.env.HOME || ''}/.bash_profile`,
        `${process.env.HOME || ''}/.profile`,
        `${process.env.PREFIX || ''}/etc/bash.bashrc`,  // Termux
    ].filter(p => p && !p.startsWith('/etc'));

    const pathLine = `export PATH="${pathExtras.join(':')}:$PATH"`;
    for (const profile of profileFiles) {
        try {
            if (fs.existsSync(profile)) {
                const existing = fs.readFileSync(profile, 'utf8');
                if (!existing.includes('yt-dlp') && !existing.includes(pathExtras[0])) {
                    fs.appendFileSync(profile, `\n# nimabw bot PATH\n${pathLine}\n`);
                }
            }
        } catch { /* skip */ }
    }

    // ── 3. Termux විශේෂ අවසර ────────────────────────────────────
    if (isTermux) {
        log.info('Termux permissions setup...');
        const termuxCmds = [
            // storage access
            'termux-setup-storage 2>/dev/null || true',
            // allow external apps
            'am broadcast -a android.intent.action.BOOT_COMPLETED 2>/dev/null || true',
            // fix pkg permissions
            'chmod -R 755 /data/data/com.termux/files/usr/bin 2>/dev/null || true',
            // allow background
            'termux-wake-lock 2>/dev/null || true',
        ];
        for (const cmd of termuxCmds) {
            try { execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 8000 }); } catch { /* skip */ }
        }
        log.success('Termux අවසර සාර්ථකව සකසන ලදී!');
    }

    // ── 4. apt/pkg යාවත්කාලීනය + උත්ශ්‍රේණිය (repo refresh) ────────
    log.info('Package repository යාවත්කාලීනය/උත්ශ්‍රේණිය කරමින්...');
    const updateMethods = [
        // Termux
        'pkg update -y 2>/dev/null || true',
        'apt update -y 2>/dev/null || true',
        // Ubuntu/Debian/WSL
        'sudo apt update -y 2>/dev/null || true',
        'sudo apt-get update -y 2>/dev/null || true',
        // others
        'sudo pacman -Sy --noconfirm 2>/dev/null || true',
        'apk update 2>/dev/null || true',
        'sudo dnf check-update 2>/dev/null || true',
        'sudo yum check-update 2>/dev/null || true',
        'sudo zypper refresh 2>/dev/null || true',
        'sudo xbps-install -S 2>/dev/null || true',
        'brew update 2>/dev/null || true',
    ];
    for (const cmd of updateMethods) {
        try { execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 60000 }); } catch { /* skip */ }
    }
    log.success('Repository යාවත්කාලීනය සාර්ථකයි!');

    // ── 5. pip / python අවසර නිවැරදි කිරීම ───────────────────────
    log.info('pip අවසර නිවැරදි කරමින්...');
    const pipPermCmds = [
        // JustRunMy.App / panel / root container — no sudo needed
        'rm -f /usr/lib/python3*/EXTERNALLY-MANAGED 2>/dev/null || true',
        'find /usr/lib/python3* -name EXTERNALLY-MANAGED -delete 2>/dev/null || true',
        // modern distros: allow pip system-wide
        'sudo rm -f /usr/lib/python3*/EXTERNALLY-MANAGED 2>/dev/null || true',
        'rm -f /usr/lib/python3*/EXTERNALLY-MANAGED 2>/dev/null || true',
        // Termux
        `rm -f ${process.env.PREFIX || ''}/lib/python3*/EXTERNALLY-MANAGED 2>/dev/null || true`,
        // ensure pip is latest
        'pip3 install --upgrade pip --break-system-packages 2>/dev/null || true',
        'python3 -m pip install --upgrade pip --break-system-packages 2>/dev/null || true',
        'pip3 install --upgrade pip 2>/dev/null || true',
    ];
    for (const cmd of pipPermCmds) {
        try { execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 30000 }); } catch { /* skip */ }
    }
    log.success('pip අවසර සාර්ථකව නිවැරදි කරන ලදී!');

    // ── 6. /usr/local/bin ලිවීමේ අවසර ────────────────────────────
    log.info('/usr/local/bin ලිවීමේ අවසර නිවැරදි කරමින්...');
    const binPermCmds = [
        'sudo chmod 777 /usr/local/bin 2>/dev/null || true',
        'sudo chown -R $(whoami) /usr/local/bin 2>/dev/null || true',
        `sudo mkdir -p /usr/local/bin && sudo chmod 755 /usr/local/bin 2>/dev/null || true`,
    ];
    for (const cmd of binPermCmds) {
        try { execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 10000 }); } catch { /* skip */ }
    }

    // ── 7. node_modules අවසර ────────────────────────────────────
    log.info('node_modules අවසර නිවැරදි කරමින්...');
    try {
        execSync(`chmod -R 755 "${path.join(__dirname, 'node_modules')}" 2>/dev/null || true`, { stdio: 'pipe', timeout: 15000 });
    } catch { /* skip */ }

    log.success('✅ අවසර සහ පරිසර සැකසීම සම්පූර්ණයි!\n');
}


// ═══════════════════════════════════════════════════════════
// 🔄 ස්වයංක්‍රිය GIT PULL — GitHub repo යාවත්කාලීන පරීක්ෂකය
// හැම මිනිත්තු 5කට GitHub පරීක්ෂා කරනවා
// නව commits ඇත්නම් git pull කරලා bot නැවත ආරම්භ කරනවා
// ═══════════════════════════════════════════════════════════

const REPO_URL    = 'https://github.com/nimesha206/nima.git';
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // මිනිත්තු 5
let gitPullProcess = null; // current bot child process reference

function isGitRepo() {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe', cwd: __dirname, timeout: 5000 });
        return true;
    } catch { return false; }
}

function ensureGitSetup() {
    if (isGitRepo()) return;
    log.info('Git repository සූදානම් කරමින්...');
    try {
        execSync(`git init && git remote add origin ${REPO_URL}`, { stdio: 'pipe', cwd: __dirname, timeout: 15000 });
        execSync(`git fetch origin main --depth=1`, { stdio: 'pipe', cwd: __dirname, timeout: 30000 });
        execSync(`git reset --hard origin/main`, { stdio: 'pipe', cwd: __dirname, timeout: 15000 });
        log.success('Git repository සාර්ථකව සූදානම් කරන ලදී!');
    } catch (e) {
        log.warn('Git සූදානම අසාර්ථකයි: ' + e.message);
    }
}

function getCurrentCommit() {
    try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe', cwd: __dirname, timeout: 5000 }).trim();
    } catch { return null; }
}

function getRemoteCommit() {
    try {
        execSync('git fetch origin main --quiet', { stdio: 'pipe', cwd: __dirname, timeout: 30000 });
        return execSync('git rev-parse origin/main', { encoding: 'utf8', stdio: 'pipe', cwd: __dirname, timeout: 5000 }).trim();
    } catch { return null; }
}

async function doGitPull(childProcess) {
    log.header('🔄 GitHub යාවත්කාලීනය — git pull කරමින්');

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
            log.info(`උත්සාහ කරමින්: ${cmd}`);
            execSync(cmd, { stdio: 'pipe', cwd: __dirname, timeout: 60000, shell: '/bin/bash' });
            pulled = true;
            log.success('✅ git pull සාර්ථකව සිදු කරන ලදී!');
            break;
        } catch (e) {
            log.warn(`✗ ${cmd}`);
        }
    }

    if (!pulled) {
        log.warn('git pull ක්‍රම සියල්ල අසාර්ථකයි — නැවත ආරම්භ නොකර මඟ හරිනවා');
        return;
    }

    // npm install — package.json change වෙලා ඇත්නම්
    try {
        log.info('npm install කරමින් (නව dependencies පරීක්ෂාව)...');
        execSync('npm install --prefer-offline --no-audit --legacy-peer-deps', {
            stdio: 'pipe', cwd: __dirname, timeout: 120000
        });
        log.success('npm install සාර්ථකව සිදු කරන ලදී!');
    } catch (e) {
        log.warn('npm install අවවාදය: ' + e.message);
    }

    // child process kill කරලා restart
    log.info('Bot නැවත ආරම්භ කරමින් (නව version)...');
    if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
    }
}

function startAutoGitPull(getChildProcess) {
    // git setup
    try { ensureGitSetup(); } catch { /* skip */ }

    // git config — credentials cache + pull strategy
    try {
        execSync('git config pull.rebase false', { stdio: 'pipe', cwd: __dirname, timeout: 5000 });
        execSync('git config credential.helper store', { stdio: 'pipe', cwd: __dirname, timeout: 5000 });
        execSync(`git remote set-url origin ${REPO_URL}`, { stdio: 'pipe', cwd: __dirname, timeout: 5000 });
    } catch { /* skip */ }

    log.success(`🔄 ස්වයංක්‍රිය git pull ආරම්භ වුණා — හැම මිනිත්තු ${CHECK_INTERVAL_MS / 60000}කට GitHub පරීක්ෂා කෙරේ`);

    const checker = setInterval(async () => {
        try {
            const local  = getCurrentCommit();
            const remote = getRemoteCommit();

            if (!local || !remote) {
                log.warn('Git commit සංසන්දනය අසාර්ථකයි — මඟ හරිනවා');
                return;
            }

            if (local === remote) {
                log.info(`🔄 යාවත්කාලීනයි (${local.slice(0,7)}) — වෙනසක් නෑ`);
                return;
            }

            log.warn(`🔄 නව යාවත්කාලීනයක් හමු වුණා! local=${local.slice(0,7)} → remote=${remote.slice(0,7)}`);
            await doGitPull(getChildProcess());
        } catch (e) {
            log.warn('ස්වයංක්‍රිය git pull දෝෂය: ' + e.message);
        }
    }, CHECK_INTERVAL_MS);

    // unref — bot අවසන් වෙනකොට interval block නොකරේ
    checker.unref();
    return checker;
}

async function autoInstallDependencies() {
    const osInfo = detectOS();
    
    log.header(`🤖 🌸MISS SHASIKALA START කරමින්\n${chalk.yellow(`Platform: ${osInfo.display}`)}`);

    // 🔐 STEP 1: Permissions & Environment (first!)
    try {
        await autoSetupPermissions(osInfo);
    } catch (e) {
        log.warn('අවසර සැකසීම අසාර්ථකයි, ඉදිරියට යමින්...');
    }

    // 🔧 STEP 2: System upgrade + Node.js + Python
    log.header('🔧 System Package Upgrade & Node.js/Python Installation');
    
    try {
        await autoUpgradeSystemPackages(osInfo);
        await autoInstallNodeJS(osInfo);
        await autoInstallPython(osInfo);
    } catch (e) {
        log.warn('System upgrade/install අසාර්ථකයි, ඉදිරියට යමින්...');
    }

    // 📥 STEP 3: yt-dlp — bot start වෙන හැම විටම install / update / upgrade
    try {
        await installOrUpdateYtDlp(osInfo);
    } catch (e) {
        log.warn('yt-dlp install/update අසාර්ථකයි: ' + e.message);
    }

    // Check npm
    if (!checkNpmInstalled()) {
        log.error('npm හමු නොවුණි!');
        log.info(`Node.js නැවත ස්ථාපනය කරමින්...\n`);
        
        const nodeMethods = {
            termux: [
                'pkg update -y && pkg install -y nodejs',
                'apt update -y && apt install -y nodejs'
            ],
            ubuntu: [
                'sudo apt update && sudo apt install -y nodejs npm',
                'sudo apt-get update && sudo apt-get install -y nodejs npm',
                'sudo snap install node --classic'
            ],
            wsl: [
                'sudo apt update && sudo apt install -y nodejs npm',
                'winget install OpenJS.NodeJS'
            ],
            macos: [
                'brew update && brew install node',
                'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
            ],
            linux: [
                'sudo apt update && sudo apt install -y nodejs npm',
                'sudo yum install -y nodejs npm',
                'sudo dnf install -y nodejs npm',
                'sudo pacman -S --noconfirm nodejs npm'
            ]
        };

        const methods = nodeMethods[osInfo.type] || nodeMethods.linux;
        
        let npmInstalled = false;
        for (const method of methods) {
            try {
                log.info(`Node.js ස්ථාපනය උත්සාහ කරමින்...`);
                execSync(method, { stdio: 'inherit', timeout: 180000 });
                
                if (checkNpmInstalled()) {
                    log.success('Node.js සාර්ථකව ස්ථාපනය කරන ලදී!');
                    npmInstalled = true;
                    break;
                }
            } catch (e) {
                log.warn('උත්සාහය අසාර්ථකයි');
            }
        }

        if (!npmInstalled) {
            log.error('npm install කිරීමට අසාර්ථකයි!');
            process.exit(1);
        }
    }

    log.success('npm හමු විය!');

    // package.json පරීක්ෂා කරමින්
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        log.error(`package.json හමු නොවුණි! (${packageJsonPath})`);
        process.exit(1);
    }

    // package.json ලබාගනිමින්
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (e) {
        log.error('package.json ලබාගැනීම කිරීමට අසාර්ථයි: ' + e.message);
        process.exit(1);
    }

    const dependencies = packageJson.dependencies || {};
    const dependencyNames = Object.keys(dependencies);

    log.info(`සියලුම npm පැකේජ ඉල්ලමින්: ${chalk.yellow(dependencyNames.length)}`);

    // එක එක dependency පරීක්ෂා කරමින්
    let missingPackages = [];
    let installedCount = 0;

    console.log('\n📦 npm පැකේජ සොයමින්...\n');

    for (const pkg of dependencyNames) {
        if (checkPackageInstalled(pkg)) {
            console.log(`  ${chalk.green('✓')} ${pkg}`);
            installedCount++;
        } else {
            console.log(`  ${chalk.red('✗')} ${pkg}`);
            missingPackages.push(pkg);
        }
    }

    console.log(`\n${chalk.cyan('Installed:')} ${installedCount}/${dependencyNames.length}`);

    // නැතිවූ පැකේජ්ය හමු වුණු විට බහු නැවත උත්සාහ ක්‍රම සඳහා ස්ථාපනය කරමින්
    if (missingPackages.length > 0) {
        log.warn(`${missingPackages.length} නැතිවූ NPM පැකේජ හමු උණි!`);
        console.log(`\nMissing:\n${missingPackages.map(p => `  • ${chalk.yellow(p)}`).join('\n')}\n`);

        log.info('ලබාගැනීම ආරම්භ කරයි...\n');

        let installSuccess = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        const npmMethods = [
            'npm install --prefer-offline --no-audit --legacy-peer-deps --force',
            'npm install --legacy-peer-deps',
            'npm install --force',
            'npm ci --legacy-peer-deps',
            'rm -rf node_modules package-lock.json && npm install'
        ];

        while (!installSuccess && attempts < maxAttempts) {
            attempts++;
            try {
                log.header(`📥 npm install උත්සාහය ${attempts}/${maxAttempts}`);
                
                if (attempts > 1) {
                    try {
                        execSync('npm cache clean --force', {
                            stdio: 'pipe',
                            cwd: __dirname
                        });
                        log.info('npm කෑෂ් ඉවත් කරන ලදී');
                    } catch (e) {}
                }
                
                const method = npmMethods[attempts - 1] || npmMethods[npmMethods.length - 1];
                log.info(`ක්‍රම: ${chalk.cyan(method)}`);
                
                execSync(method, {
                    stdio: 'inherit',
                    cwd: __dirname
                });

                installSuccess = true;
                log.success('සියළුම NPM පැකේජ ලබාගන්නා ලදි!');
            } catch (e) {
                log.error(`උත්සාහය ${attempts} අසාර්ථකයි`);
                
                if (attempts < maxAttempts) {
                    log.info(`${maxAttempts - attempts} උත්සාහ ඉතිරි ඇත... නැවත උත්සාහ කරමින්...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    log.error('උපරිම ස්ථාපන උත්සාහ ඉවසා ගිහින්!');
                    log.error('npm packages install කිරීමට අසාර්ථකයි!');
                    process.exit(1);
                }
            }
        }
    } else {
        log.success('දැනටමත් සියලුම npm ලබාගෙන ඇත!');
    }

    // පද්ධති බිමට අවශ්‍යතා පරීක්ෂා කරමින් සහ නැතිවූ විට ස්වයංක්‍රියව ස්ථාපනය
    log.header('🔧 system පරීක්ෂා කරමින්');
    
    // ════════════════════════════════════════════════════════════
    // 🔧 SYSTEM DEPENDENCIES (2026 - YT ක්‍රම 50+ සඳහා යාවත්කාලීන)
    //
    // අනිවාර්ය (මේවා නැතිව bot ධාවනය නොවේ):
    //   ffmpeg    - audio/video encode, shasikala ක්‍රම 23-26
    //   python3   - yt-dlp + youtube-dl runtime
    //   yt-dlp    - shasikala.js ක්‍රම 1-16 (client variants 15)
    //
    // විකල්ප (නැතිනම් fallback ක්‍රම use කෙරේ):
    //   youtube-dl  - shasikala ක්‍රම 9-14 fallback
    //   curl/wget   - shasikala ක්‍රම 27-28, API download
    //   aria2c      - shasikala ක්‍රම 29 multi-thread
    //   sox         - shasikala ක්‍රම 30 audio convert
    //   node-fetch  - (npm) API ක්‍රම 17-53 (cobalt, invidious ආදිය)
    // ════════════════════════════════════════════════════════════
    // yt-dlp සහ python3 mandatory ලිස්ට් එකෙන් ඉවත් කරලා
    // වෙනම dedicated function එකෙන් handle කරනවා (pip3 / binary)
    const mandatorySysDeps = ['ffmpeg'];
    const optionalSysDeps = {
        'curl':        'HTTP streaming + API calls (shasikala & lib/scraper 50+ methods)',
        'wget':        'direct file download fallback (shasikala method 29)',
        'git':         'version control',
        'spotifydl':   'Spotify track download (shasikala .spotify command)',
        'imagemagick': 'image processing / sticker creation',
        'ghostscript': 'PDF/document processing',
        'youtube-dl':  'YT download fallback (shasikala methods 9-14)',
        'aria2c':      'multi-thread download (shasikala method 29)',
        'sox':         'audio format conversion (shasikala method 30 fallback)',
        'ffprobe':     'media info detection (usually bundled with ffmpeg)'
    };

    let missingMandatory = [];
    let missingOptional = [];

    // අනිවාර්ය බිමට අවශ්‍යතා පරීක්ෂා කරමින්
    for (const cmd of mandatorySysDeps) {
        if (commandExists(cmd)) {
            console.log(`  ${chalk.green('✓')} ${cmd.padEnd(12)} - අනිවාර්ය`);
        } else {
            console.log(`  ${chalk.red('✗')} ${cmd.padEnd(12)} - අනිවාර්ය`);
            missingMandatory.push(cmd);
        }
    }

    // විකල්ප බිමට අවශ්‍යතා පරීක්ෂා කරමින්
    for (const [cmd, desc] of Object.entries(optionalSysDeps)) {
        if (commandExists(cmd)) {
            console.log(`  ${chalk.green('✓')} ${cmd.padEnd(12)} - ${desc}`);
        } else {
            console.log(`  ${chalk.red('✗')} ${cmd.padEnd(12)} - ${desc}`);
            missingOptional.push(cmd);
        }
    }

    // නැතිවූ අනිවාර්ය බිමට අවශ්‍යතා හසුරුවමින්
    if (missingMandatory.length > 0) {
        log.error(`\n❌ අනිවාර්ය දෙයක් නැතිවුණි: ${missingMandatory.join(', ')}`);
        
        const installCmds = getInstallCommands(osInfo, missingMandatory);
        
        const isRoot = process.getuid && process.getuid() === 0;
        
        if (osInfo.type === 'termux' && isRoot) {
            log.warn('⚠️  Termux root user detected - trying alternate methods...');
            log.info('සියලු ස්ථාපන ක්‍රම උත්සාහ කරමින්...\n');
            
            const rootMethods = [
                'apt update -y && apt install -y ffmpeg',
                'apt-get update -y && apt-get install -y ffmpeg',
                'apt upgrade -y && apt install -y ffmpeg',
                'apt full-upgrade -y && apt install -y ffmpeg',
                'apt-get upgrade -y && apt-get install -y ffmpeg',
                'apk update && apk add ffmpeg',
                'apt clean && apt autoclean && apt update && apt install -y ffmpeg',
                'sed -i "s/^deb http/deb [trusted=yes] http/" /etc/apt/sources.list && apt update && apt install -y ffmpeg 2>/dev/null || apt install -y ffmpeg'
            ];
            
            for (let i = 0; i < rootMethods.length; i++) {
                const cmd = rootMethods[i];
                try {
                    log.info(`[${i + 1}/${rootMethods.length}] ${chalk.cyan(cmd.substring(0, 80))}`);
                    execSync(cmd, { 
                        stdio: 'inherit',
                        shell: '/bin/bash',
                        timeout: 60000
                    });
                    
                    if (commandExists('ffmpeg')) {
                        log.success('\n✅ ffmpeg installed successfully (root user)!\n');
                        return;
                    }
                } catch (e) {
                    log.warn('අසාර්ථකයි, ඊළඟ ක්‍රමය උත්සාහ කරමින්...');
                }
            }
            
            log.info('\nTrying standard ffmpeg installation function...\n');
        }
            console.log(`\n${chalk.cyan(`${osInfo.display} - අනිවාර්ය dependencies ස්ථාපනය කරමින්:`)}`);
            console.log(`  ${chalk.yellow(installCmds.update)}`);
            console.log(`  ${chalk.yellow(installCmds.install)}\n`);
            
            let mandatoryInstallSuccess = false;
            
            if (missingMandatory.includes('ffmpeg')) {
                log.header('📥 ffmpeg ස්ථාපනය - සියලුම ක්‍රම උත්සාහ කරමින්');
                mandatoryInstallSuccess = await installFFmpeg(osInfo);
            } else {
                let mandAttempts = 0;
                const maxMandAttempts = 3;
                
                while (!mandatoryInstallSuccess && mandAttempts < maxMandAttempts) {
                    mandAttempts++;
                    try {
                        if (osInfo.type !== 'macos') {
                            try {
                                log.info(`උත්සාහය ${mandAttempts}: පැකේජ update කරමින්...`);
                                execSync(installCmds.update, { stdio: 'inherit' });
                            } catch (e) {
                                log.warn('පැකේජ සඳහා update අසාර්ථකයි, ස්ථාපනය උත්සාහ කරමින්...');
                            }
                        }
                        
                        log.info(`උත්සාහය ${mandAttempts}: ${missingMandatory.join(', ')} ස්ථාපනය කරමින්...`);
                        execSync(installCmds.install, { stdio: 'inherit' });
                        
                        mandatoryInstallSuccess = true;
                        log.success('අනිවාර්ය dependencies සාර්ථකව ස්ථාපනය කරන ලදී!');
                    } catch (e) {
                        if (mandAttempts < maxMandAttempts) {
                            log.warn(`උත්සාහය ${mandAttempts} අසාර්ථකයි, නැවත උත්සාහ කරමින්...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }
                }
            }
            
            if (!mandatoryInstallSuccess) {
                log.error('\n❌ ffmpeg අනිවාර්යයි - install කරන්න බැ!');
                log.warn('සියලු ස්වයංක්‍රිය ක්‍රම ඉවරයි!');
                process.exit(1);
            }
    }

    // 🎵 optional tools — platform check නොකර flat method list
    const optionalToolsList = missingOptional.filter(tool =>
        ['yt-dlp', 'youtube-dl', 'spotifydl', 'wget', 'aria2c', 'sox'].includes(tool)
    );

    if (optionalToolsList.length > 0) {
        log.warn(`\n🎵 optional tools නැතිවුණි: ${optionalToolsList.join(', ')}`);

        for (const tool of optionalToolsList) {
            log.header(`📥 ${tool} ස්ථාපනය කරමින්`);

            // correct package name mapping
            // 'aria2c' command → 'aria2' package name
            const pkgName = tool === 'aria2c' ? 'aria2' : tool;

            const YTDLP_BIN_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
            const termuxBin = '/data/data/com.termux/files/usr/bin/yt-dlp';
            const prefixBin = `${process.env.PREFIX || ''}/bin/yt-dlp`;

            // build flat method list per tool
            const toolMethods = [];

            // pip / python (python-based tools)
            if (['yt-dlp', 'youtube-dl', 'spotifydl'].includes(tool)) {
                toolMethods.push(
                    { cmd: `pip3 install -U --break-system-packages ${tool}`,           desc: `pip3 --break-system-packages` },
                    { cmd: `pip3 install -U ${tool}`,                                   desc: `pip3 -U` },
                    { cmd: `pip3 install ${tool}`,                                      desc: `pip3 fresh` },
                    { cmd: `pip install -U --break-system-packages ${tool}`,            desc: `pip --break-system-packages` },
                    { cmd: `pip install -U ${tool}`,                                    desc: `pip -U` },
                    { cmd: `python3 -m pip install -U --break-system-packages ${tool}`, desc: `python3 -m pip --break-system-packages` },
                    { cmd: `python3 -m pip install -U ${tool}`,                         desc: `python3 -m pip -U` },
                    { cmd: `sudo pip3 install -U --break-system-packages ${tool}`,      desc: `sudo pip3 --break-system-packages` },
                    { cmd: `sudo pip3 install -U ${tool}`,                              desc: `sudo pip3 -U` },
                );
                // yt-dlp binary fallback
                if (tool === 'yt-dlp') {
                    toolMethods.push(
                        { cmd: `curl -L "${YTDLP_BIN_URL}" -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`, desc: 'binary curl → /usr/local/bin' },
                        { cmd: `wget -q "${YTDLP_BIN_URL}" -O /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`, desc: 'binary wget → /usr/local/bin' },
                        { cmd: `curl -L "${YTDLP_BIN_URL}" -o "${termuxBin}" && chmod a+rx "${termuxBin}"`,               desc: 'binary curl → termux' },
                        { cmd: `wget -q "${YTDLP_BIN_URL}" -O "${termuxBin}" && chmod a+rx "${termuxBin}"`,               desc: 'binary wget → termux' },
                        { cmd: `curl -L "${YTDLP_BIN_URL}" -o "${prefixBin}" && chmod a+rx "${prefixBin}"`,               desc: 'binary curl → PREFIX/bin' },
                    );
                }
            }

            // system package managers — platform check නෑ, all try කරනවා
            toolMethods.push(
                { cmd: `pkg install -y ${pkgName}`,                              desc: `pkg (termux)` },
                { cmd: `apt install -y ${pkgName}`,                              desc: `apt (termux)` },
                { cmd: `apt update -y && apt install -y ${pkgName}`,             desc: `apt update+install (termux)` },
                { cmd: `sudo apt install -y ${pkgName}`,                         desc: `sudo apt` },
                { cmd: `sudo apt update && sudo apt install -y ${pkgName}`,      desc: `sudo apt update+install` },
                { cmd: `sudo apt-get install -y ${pkgName}`,                     desc: `sudo apt-get` },
                { cmd: `sudo pacman -S --noconfirm ${pkgName}`,                  desc: `pacman` },
                { cmd: `apk add ${pkgName}`,                                     desc: `apk` },
                { cmd: `sudo dnf install -y ${pkgName}`,                         desc: `dnf` },
                { cmd: `sudo yum install -y ${pkgName}`,                         desc: `yum` },
                { cmd: `sudo zypper install -y ${pkgName}`,                      desc: `zypper` },
                { cmd: `sudo xbps-install -y ${pkgName}`,                        desc: `xbps` },
                { cmd: `brew install ${pkgName}`,                                desc: `brew` },
            );

            let toolInstalled = false;
            for (let i = 0; i < toolMethods.length; i++) {
                const m = toolMethods[i];
                try {
                    log.info(`[${i+1}/${toolMethods.length}] ${m.desc}`);
                    execSync(m.cmd, { stdio: 'pipe', timeout: 120000, shell: '/bin/bash' });
                    if (commandExists(tool)) {
                        log.success(`✅ ${tool} install සාර්ථකයි! (${m.desc})`);
                        toolInstalled = true;
                        break;
                    }
                } catch (e) {
                    log.warn(`✗ ${m.desc}`);
                }
            }

            if (!toolInstalled) {
                log.warn(`⚠️ ${tool} ස්ථාපනය අසාර්ථකයි — bot සීමිත ආකාරයෙන් දිගටම ධාවනය වෙනවා`);
            }
        }
    }

    // වෙනත් විකල්ප tools
    const otherOptionalTools = missingOptional.filter(tool => !['yt-dlp', 'youtube-dl', 'spotifydl', 'wget', 'aria2c', 'sox'].includes(tool));
    if (otherOptionalTools.length > 0) {
        log.warn(`\nවෙනත් විකල්ප tools නැතිවුණි: ${otherOptionalTools.join(', ')}`);

        log.info('✅ ස්වයංක්‍රිය ස්ථාපනය උත්සාහ කරමින්...\n');
        
        let optionalInstallSuccess = false;
        let optionalAttempts = 0;
        const maxOptionalAttempts = 3;
        
        while (!optionalInstallSuccess && optionalAttempts < maxOptionalAttempts) {
            optionalAttempts++;
            try {
                const optionalCmds = getInstallCommands(osInfo, missingOptional);
                log.info(`[උත්සාහය ${optionalAttempts}/${maxOptionalAttempts}] විකල්ප dependencies ස්ථාපනය කරමින්...`);
                console.log(`  ${chalk.cyan(optionalCmds.install)}\n`);
                
                execSync(optionalCmds.install, { 
                    stdio: 'inherit',
                    timeout: 180000,
                    shell: '/bin/bash'
                });
                
                optionalInstallSuccess = true;
                log.success('✅ විකල්ප dependencies ස්ථාපනය සාර්ථකයි!');
            } catch (e) {
                log.warn(`උත්සාහය ${optionalAttempts} අසාර්ථකයි — විකල්ප dependencies නොමැතිව දිගටම...`);
            }
        }
        
        if (!optionalInstallSuccess) {
            log.info('\n⚠️  මෙම විකල්ප dependencies නොමැතිව දිගටම:', missingOptional.join(', '));
            log.info('උසස් features සීමිතයි (spotify, advanced tools ආදිය)');
        }
    }

    log.success('✅ Setup සත්‍යාපනය සම්පූර්ණයි!');
}

// ප්‍රධාන ක්‍රියාවලිය
async function start() {
    try {
        // බිමට අවශ්‍යතා පරීක්ෂා කරමින් සහ ස්ථාපනය කරමින්
        await autoInstallDependencies();

        const osInfo = detectOS();
        log.header(`🚀 MISS SHASIKALA ආරම්භ වෙමින්\n${chalk.yellow(`Platform: ${osInfo.display}`)}`);

        // ප්‍රධාන යෙදුම ආරම්භ කරමින්
        let args = [path.join(__dirname, 'index.js'), ...process.argv.slice(2)];
        let p = spawn(process.argv[0], args, {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        }).on('message', data => {
            if (data === 'reset') {
                console.log(chalk.yellow.bold('[BOT] නැවත පණ ගන්වමින් පවතී...'));
                p.kill();
                start();
            } else if (data === 'uptime') {
                p.send(process.uptime());
            }
        }).on('exit', code => {
            if (code !== 0) {
                console.error(chalk.red.bold(`[BOT] දෝෂ කේතය ${code} සමඟ ක්‍රියාවලිය නැවතුණි. නැවත ආරම්භ කරමින්...`));
                setTimeout(() => start(), 3000);
            } else {
                console.log(chalk.green.bold('[BOT] ක්‍රියාවලිය සාර්ථකව අවසන් විය. සමුගනිමු!'));
                process.exit(0);
            }
        });

        // 🔄 Auto git pull — GitHub update checker start
        startAutoGitPull(() => p);
    } catch (e) {
        log.error('ආරම්භ කිරීම අසාර්ථකයි: ' + e.message);
        console.error(e);
        process.exit(1);
    }
}

// ධාවනය කරමින්
start();

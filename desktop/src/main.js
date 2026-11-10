const { app, BrowserWindow, ipcMain, session, nativeImage, webContents, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const AdBlockEngine = require('./adblock');
const newsService = require('./news');
const { VpnEngine } = require('./vpn_engine');

// Universal Stealth & Anti-Automation Flags (matching Brave / Un-automated Chromium)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-features', 'ThirdPartyStoragePartitioning');
app.commandLine.appendSwitch('no-sandbox');

// Zero-Leak Network & IP Protection (Blocks QUIC & WebRTC from bypassing SOCKS proxy)
app.commandLine.appendSwitch('disable-quic');
app.commandLine.appendSwitch('disable-webrtc-multiple-routes');
app.commandLine.appendSwitch('enforce-webrtc-ip-permission-check');

// Paths
const devAssetsDir = path.resolve(__dirname, '..', '..', 'app', 'src', 'main', 'assets');
const packagedAssetsDir = path.join(process.resourcesPath || '', 'assets');
const ASSETS_DIR = fs.existsSync(packagedAssetsDir) ? packagedAssetsDir : devAssetsDir;
const START_PAGE_URL = `file://${path.join(__dirname, 'ui', 'start.html')}`;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const ICON_PATH = fs.existsSync(path.join(__dirname, 'ui', 'icon.png'))
    ? path.join(__dirname, 'ui', 'icon.png')
    : path.join(__dirname, '..', 'assets', 'icon.png');

let mainWindow = null;
let shieldEnabled = true;
const adblock = new AdBlockEngine(ASSETS_DIR);
let vpnEngine = null;
try {
    vpnEngine = new VpnEngine(app.getPath('userData'));
    vpnEngine.on('status-changed', (status) => {
        webContents.getAllWebContents().forEach(wc => {
            try { wc.send('fokk-vpn-status-changed', status); } catch (_) {}
        });
    });
} catch (_) {}

// Authentic DNS-over-HTTPS providers matching com.adshield.app.model.DnsOverHttpsEngine
const DOH_PROVIDERS = {
    adguard: 'https://dns.adguard-dns.com/dns-query',
    nextdns: 'https://dns.nextdns.io/dns-query',
    controld: 'https://freedns.controld.com/p0',
    mullvad: 'https://adblock.doh.mullvad.net/dns-query',
    cloudflare: 'https://cloudflare-dns.com/dns-query',
    quad9: 'https://dns.quad9.net/dns-query',
    google: 'https://dns.google/dns-query'
};

const CHROME_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

let statsUpdateTimer = null;
function broadcastStatsThrottled() {
    if (statsUpdateTimer) return;
    statsUpdateTimer = setTimeout(() => {
        statsUpdateTimer = null;
        const stats = adblock.getStats();
        webContents.getAllWebContents().forEach(wc => {
            try { wc.send('fokk-stats-updated', stats); } catch (_) {}
        });
    }, 250);
}

const downloadItems = [];

function broadcastDownloadUpdate(dl) {
    webContents.getAllWebContents().forEach(wc => {
        try { wc.send('fokk-download-update', dl); } catch (_) {}
    });
}

function setupAdblockingForSession(sess) {
    if (!sess || sess.__fokk_configured) return;
    sess.__fokk_configured = true;

    if (vpnEngine) {
        vpnEngine.registerSession(sess);
    }

    try {
        sess.setUserAgent(CHROME_USER_AGENT);
    } catch (_) {}

    sess.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = { ...details.requestHeaders };
        // Ensure clean Google Chrome User-Agent is presented (fixes WhatsApp Web device linking)
        headers['User-Agent'] = CHROME_USER_AGENT;
        if (!headers['sec-ch-ua'] || details.url.includes('whatsapp.com')) {
            headers['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = '"Linux"';
        }
        callback({ requestHeaders: headers });
    });

    sess.webRequest.onBeforeRequest((details, callback) => {
        if (shieldEnabled && adblock.shouldBlock(details.url, details.resourceType)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                try {
                    mainWindow.webContents.send('fokk-blocked-item', {
                        webContentsId: details.webContentsId,
                        url: details.url
                    });
                } catch (_) {}
            }
            broadcastStatsThrottled();
            callback({ cancel: true });
        } else {
            callback({ cancel: false });
        }
    });

    sess.on('will-download', (event, item) => {
        const id = 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const fileName = item.getFilename();
        const totalBytes = item.getTotalBytes();
        const record = {
            id,
            fileName,
            totalBytes,
            receivedBytes: 0,
            savePath: item.getSavePath(),
            state: 'progressing',
            startTime: Date.now()
        };
        downloadItems.unshift(record);
        if (downloadItems.length > 50) downloadItems.pop();
        broadcastDownloadUpdate(record);

        item.on('updated', (e, state) => {
            record.receivedBytes = item.getReceivedBytes();
            record.totalBytes = item.getTotalBytes();
            record.savePath = item.getSavePath();
            record.state = state;
            broadcastDownloadUpdate(record);
        });

        item.on('done', (e, state) => {
            record.receivedBytes = item.getReceivedBytes();
            record.savePath = item.getSavePath();
            record.state = state;
            record.endTime = Date.now();
            broadcastDownloadUpdate(record);
        });
    });
}

function broadcastLiveNews(category, region, items) {
    const jsonStr = JSON.stringify(items);
    webContents.getAllWebContents().forEach(wc => {
        try {
            wc.send('fokk-live-news-pushed', { category, region, jsonStr });
        } catch (_) {}
    });
}

function createWindow() {
    const appIcon = nativeImage.createFromPath(ICON_PATH);
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#090A0C',
        icon: appIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'ui', 'browser.html'));

    if (process.argv.includes('--open-vpn')) {
        mainWindow.webContents.once('did-finish-load', () => {
            setTimeout(() => {
                mainWindow.webContents.executeJavaScript(`
                    const b = document.getElementById('btnVpnToggle');
                    if (b) b.click();
                `);
            }, 700);
        });
    }

    // Setup network adblocker and VPN engine on default and persistent sessions
    setupAdblockingForSession(session.defaultSession);
    try {
        setupAdblockingForSession(session.fromPartition('persist:fokk_default_session'));
    } catch (_) {}

    // Inject cosmetic ad defusers and configure universal popup/OAuth handling
    app.on('web-contents-created', (event, contents) => {
        const type = contents.getType();

        if (type === 'webview') {
            setupAdblockingForSession(contents.session);
            contents.on('dom-ready', () => {
                if (shieldEnabled) {
                    adblock.injectCosmeticFilters(contents);
                }
            });
            contents.on('did-navigate-in-page', () => {
                if (shieldEnabled) {
                    adblock.injectCosmeticFilters(contents);
                }
            });

            // Universal Window Open & OAuth Popup Handler matching Brave / Firefox
            contents.setWindowOpenHandler((details) => {
                const hasDimensions = details.features && (details.features.includes('width=') || details.features.includes('height='));
                const isPopup = details.disposition === 'new-window' || hasDimensions;

                if (isPopup) {
                    return {
                        action: 'allow',
                        overrideBrowserWindowOptions: {
                            width: 600,
                            height: 720,
                            autoHideMenuBar: true,
                            backgroundColor: '#090A0C',
                            webPreferences: {
                                contextIsolation: true,
                                nodeIntegration: false,
                                sandbox: true
                            }
                        }
                    };
                }

                // Standard link navigations (target="_blank") open as a new tab
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(${JSON.stringify(details.url)});`);
                }
                return { action: 'deny' };
            });
        }

        // Child popup windows (OAuth dialogs, payment gateways, popups)
        if (type === 'window' && mainWindow && contents !== mainWindow.webContents) {
            setupAdblockingForSession(contents.session);
            try { contents.session.setUserAgent(CHROME_USER_AGENT); } catch (_) {}
            contents.on('dom-ready', () => {
                if (shieldEnabled) {
                    adblock.injectCosmeticFilters(contents);
                }
            });
            contents.on('did-navigate-in-page', () => {
                if (shieldEnabled) {
                    adblock.injectCosmeticFilters(contents);
                }
            });
            contents.setWindowOpenHandler(() => {
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        width: 600,
                        height: 720,
                        autoHideMenuBar: true,
                        backgroundColor: '#090A0C'
                    }
                };
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 1. IPC Handlers for Shell & Navigation
ipcMain.on('fokk-get-start-page-url', (event) => {
    event.returnValue = START_PAGE_URL;
});

ipcMain.on('fokk-get-preload-path', (event) => {
    event.returnValue = PRELOAD_PATH;
});

ipcMain.on('fokk-win-min', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('fokk-win-max', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        else mainWindow.maximize();
    }
});

ipcMain.on('fokk-win-close', () => {
    if (mainWindow) mainWindow.close();
});

// 2. Tab Navigation & Bridge Handlers
ipcMain.on('fokk-open-url', (event, url) => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(${JSON.stringify(url)});`);
    }
});

ipcMain.on('fokk-open-new-tab', () => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(START_PAGE_URL);`);
    }
});

ipcMain.on('fokk-new-private-tab', () => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(START_PAGE_URL, true);`);
    }
});

ipcMain.on('fokk-open-private-tabs', () => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(START_PAGE_URL, true);`);
    }
});

ipcMain.on('fokk-open-menu', () => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
            if (desktopBrowserMenu) {
                desktopBrowserMenu.classList.toggle('hidden');
            }
        `);
    }
});

ipcMain.on('fokk-open-hub', (event, hubId) => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof openFeatureHub === 'function') openFeatureHub(${JSON.stringify(hubId)});`);
    }
});

ipcMain.on('fokk-get-tab-count', (event) => {
    event.returnValue = mainWindow ? 1 : 0;
});

// 2b. Native Theme Synchronization (Controls prefers-color-scheme across all websites)
ipcMain.on('fokk-set-theme', (event, theme) => {
    const themeSource = (theme === 'light') ? 'light' : 'dark';
    nativeTheme.themeSource = themeSource;
    webContents.getAllWebContents().forEach(wc => {
        try { wc.send('fokk-theme-changed', themeSource); } catch (_) {}
    });
});

ipcMain.on('fokk-get-theme', (event) => {
    event.returnValue = nativeTheme.themeSource;
});

// 2c. Global Search Engine Synchronization & Persistence
let activeSearchEngine = 'bing';
function getEngineConfigFile() {
    try {
        return path.join(app.getPath('userData'), 'fokk_engine.json');
    } catch (_) {
        return null;
    }
}

function loadSavedSearchEngine() {
    try {
        const file = getEngineConfigFile();
        if (file && fs.existsSync(file)) {
            const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (saved && saved.engine && typeof saved.engine === 'string') {
                activeSearchEngine = saved.engine.toLowerCase();
            }
        }
    } catch (_) {}
}

ipcMain.on('fokk-set-search-engine', (event, engineId) => {
    if (engineId && typeof engineId === 'string') {
        activeSearchEngine = engineId.toLowerCase();
        try {
            const file = getEngineConfigFile();
            if (file) {
                fs.writeFileSync(file, JSON.stringify({ engine: activeSearchEngine }), 'utf8');
            }
        } catch (_) {}
        webContents.getAllWebContents().forEach(wc => {
            try { wc.send('fokk-search-engine-updated', activeSearchEngine); } catch (_) {}
        });
    }
});

ipcMain.on('fokk-get-search-engine', (event) => {
    loadSavedSearchEngine();
    event.returnValue = activeSearchEngine;
});

// 3. Live News Feeds
ipcMain.on('fokk-get-news-sync', (event, category, region) => {
    const cat = category || 'all';
    const reg = region || 'global';
    const cached = newsService.cache.get(`${reg.toLowerCase()}_${cat.toLowerCase()}`);
    if (cached) {
        event.returnValue = JSON.stringify(cached.data);
    } else {
        newsService.getLiveNews(cat, reg).then(items => {
            broadcastLiveNews(cat, reg, items);
        }).catch(() => {});
        event.returnValue = JSON.stringify([]);
    }
});

ipcMain.on('fokk-refresh-news-sync', (event, category, region) => {
    const cat = category || 'all';
    const reg = region || 'global';
    newsService.getLiveNews(cat, reg, true).then(items => {
        broadcastLiveNews(cat, reg, items);
    }).catch(() => {});
    event.returnValue = JSON.stringify([]);
});

// 4. Adblock Defense & Stats
ipcMain.on('fokk-get-stats', (event) => {
    event.returnValue = JSON.stringify(adblock.getStats());
});

ipcMain.on('fokk-toggle-shield', (event, val) => {
    if (typeof val === 'boolean') {
        shieldEnabled = val;
    } else {
        shieldEnabled = !shieldEnabled;
    }
    event.returnValue = shieldEnabled;
});

ipcMain.on('fokk-get-shield-status', (event) => {
    event.returnValue = shieldEnabled;
});

ipcMain.on('fokk-sync-whitelist', (event, domains) => {
    adblock.setWhitelist(domains);
});

ipcMain.on('fokk-sync-blacklist', (event, domains) => {
    adblock.setCustomBlocked(domains);
});

// 5. DoH Resolver Configuration
ipcMain.on('fokk-set-doh', (event, providerKey) => {
    try {
        const endpoint = DOH_PROVIDERS[providerKey];
        if (endpoint && app.configureHostResolver) {
            app.configureHostResolver({
                secureDnsMode: 'secure',
                secureDnsServers: [endpoint]
            });
            console.log(`[DoH] Configured DoH Resolver: ${providerKey} (${endpoint})`);
        } else if (app.configureHostResolver) {
            app.configureHostResolver({
                secureDnsMode: 'off'
            });
            console.log('[DoH] DoH disabled, using system default resolver');
        }
    } catch (e) {
        console.error('[DoH] Failed to configure host resolver:', e);
    }
});

// 5b. Fokk Shield Tunnel (Privacy VPN & Relay)
ipcMain.on('fokk-vpn-get-status', (event) => {
    event.returnValue = vpnEngine ? vpnEngine.getStatus() : { state: 'disconnected' };
});

ipcMain.on('fokk-vpn-get-locations', (event) => {
    event.returnValue = vpnEngine ? vpnEngine.getLocations() : [];
});

ipcMain.handle('fokk-vpn-toggle', async () => {
    if (!vpnEngine) return { success: false, error: 'VPN Engine not initialized' };
    return await vpnEngine.toggle();
});

ipcMain.handle('fokk-vpn-set-mode', async (event, modeId) => {
    if (!vpnEngine) return false;
    return await vpnEngine.setMode(modeId);
});

ipcMain.handle('fokk-vpn-set-killswitch', (event, enabled) => {
    if (vpnEngine) vpnEngine.setKillSwitch(enabled);
    return true;
});

ipcMain.handle('fokk-vpn-set-custom', (event, config) => {
    if (vpnEngine) vpnEngine.setCustomConfig(config);
    return true;
});

// 6. Scripts Serving (Reader Mode & Smart AI Summarizer from APK assets)
ipcMain.handle('fokk-get-reader-script', () => {
    return adblock.readerJs || '';
});

ipcMain.handle('fokk-get-summarizer-script', () => {
    return adblock.summarizerJs || '';
});

ipcMain.handle('fokk-get-torrent-url', () => {
    const torrentPath = path.join(ASSETS_DIR, 'fokk_webtorrent.html');
    if (fs.existsSync(torrentPath)) return `file://${torrentPath}`;
    return null;
});

// 7. Session Burn & Clear Browsing Data
ipcMain.handle('fokk-burn-session', async () => {
    try {
        const defaultSess = session.defaultSession;
        const persistSess = session.fromPartition('persist:fokk_default_session');
        const clearOpts = {
            storages: ['cookies', 'localstorage', 'cache', 'shadercache', 'websql', 'indexdb', 'serviceworkers', 'cachestorage']
        };
        await Promise.all([
            defaultSess.clearStorageData(clearOpts).catch(() => {}),
            defaultSess.clearCache().catch(() => {}),
            persistSess.clearStorageData(clearOpts).catch(() => {}),
            persistSess.clearCache().catch(() => {})
        ]);
        downloadItems.length = 0;
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('fokk-clear-data', async (event, options) => {
    try {
        await session.defaultSession.clearStorageData(options || {});
        try {
            await session.fromPartition('persist:fokk_default_session').clearStorageData(options || {});
        } catch (_) {}
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// 7a. Google & YouTube Session Security Guard (prevents foreign cookie jar corruption)
ipcMain.handle('fokk-sync-google-session', async () => {
    return { success: false, error: 'Foreign session import disabled to maintain cookie integrity' };
});

// 7b. Downloads Manager Handlers
ipcMain.handle('fokk-get-downloads', () => {
    return downloadItems;
});

ipcMain.handle('fokk-open-download-file', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'File not found on disk' };
    const err = await shell.openPath(filePath);
    return { success: !err, error: err };
});

ipcMain.handle('fokk-show-in-folder', async (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return { success: true };
    }
    const dlFolder = app.getPath('downloads');
    shell.openPath(dlFolder);
    return { success: true };
});

ipcMain.handle('fokk-open-downloads-folder', async () => {
    const dlFolder = app.getPath('downloads');
    await shell.openPath(dlFolder);
    return { success: true };
});

ipcMain.handle('fokk-clear-downloads', () => {
    downloadItems.length = 0;
    return { success: true };
});

// 8. Custom Wallpaper & Avatar Pickers
let customWallpaperBase64 = '';
ipcMain.on('fokk-get-wallpaper-data', (event) => {
    event.returnValue = customWallpaperBase64;
});

ipcMain.handle('fokk-pick-avatar', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose Profile Avatar',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'] }],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const filePath = result.filePaths[0];
            const ext = path.extname(filePath).replace('.', '') || 'png';
            const data = fs.readFileSync(filePath).toString('base64');
            return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${data}`;
        } catch (e) {
            console.error('[Avatar] Error reading file:', e);
        }
    }
    return null;
});

ipcMain.handle('fokk-pick-wallpaper', async () => {
    if (!mainWindow) return null;
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Custom Wallpaper',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        try {
            const filePath = result.filePaths[0];
            const ext = path.extname(filePath).replace('.', '') || 'jpeg';
            const data = fs.readFileSync(filePath).toString('base64');
            customWallpaperBase64 = `data:image/${ext};base64,${data}`;
            return customWallpaperBase64;
        } catch (e) {
            console.error('[Wallpaper] Error reading file:', e);
        }
    }
    return null;
});

// 9. In-App Single-Click Auto-Updater (electron-updater + GitHub Releases API)
let autoUpdater = null;
try {
    const eu = require('electron-updater');
    autoUpdater = eu.autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('download-progress', (p) => {
        webContents.getAllWebContents().forEach(wc => {
            try { wc.send('fokk-update-progress', { percent: Math.round(p.percent), transferred: p.transferred, total: p.total }); } catch(_) {}
        });
    });
    autoUpdater.on('update-downloaded', () => {
        webContents.getAllWebContents().forEach(wc => {
            try { wc.send('fokk-update-downloaded'); } catch(_) {}
        });
    });
} catch (_) {}

function compareVersions(v1, v2) {
    const p1 = (v1 || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    const p2 = (v2 || '0').replace(/^v/i, '').split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0;
        const b = p2[i] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'FokkBrowser-Updater', 'Accept': 'application/vnd.github.v3+json' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchJson(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

ipcMain.handle('fokk-check-update', async () => {
    const currentVersion = app.getVersion() || '1.0.0';
    try {
        let releases = [];
        try {
            const list = await fetchJson('https://api.github.com/repos/Kimmojiraja/fokk-project/releases?per_page=15');
            if (Array.isArray(list)) releases = list;
        } catch (_) {}

        // Fallback to latest single release if list fails
        if (releases.length === 0) {
            try {
                const single = await fetchJson('https://api.github.com/repos/Kimmojiraja/fokk-project/releases/latest');
                if (single && single.tag_name) releases = [single];
            } catch (_) {}
        }

        if (releases.length === 0) {
            return { available: false, currentVersion, error: 'No releases found' };
        }

        // Helper to check if asset matches current platform
        const findPlatformAsset = (assets) => {
            if (!Array.isArray(assets)) return null;
            if (process.platform === 'linux') {
                return assets.find(a => a.name.endsWith('.AppImage')) || assets.find(a => a.name.endsWith('.deb'));
            } else if (process.platform === 'win32') {
                return assets.find(a => a.name.endsWith('-win.zip') || a.name.endsWith('.zip') || a.name.endsWith('.exe'));
            } else if (process.platform === 'darwin') {
                return assets.find(a => a.name.endsWith('-mac.zip') || a.name.endsWith('.dmg') || a.name.endsWith('.zip'));
            }
            return null;
        };

        // Filter releases: specifically prioritize desktop releases or releases with desktop assets
        let targetRelease = null;
        let matchedAsset = null;

        for (const rel of releases) {
            const tag = (rel.tag_name || '').toLowerCase();
            const asset = findPlatformAsset(rel.assets || []);
            // Matches if tag indicates desktop or it contains desktop assets
            if (tag.startsWith('desktop-') || asset) {
                targetRelease = rel;
                matchedAsset = asset;
                break;
            }
        }

        // If no specifically desktop-tagged release found, fall back to first release
        if (!targetRelease) {
            targetRelease = releases[0];
            matchedAsset = findPlatformAsset(targetRelease.assets || []);
        }

        const rawTag = targetRelease.tag_name || '';
        // Extract clean semantic version, removing 'desktop-v', 'desktop-', 'v'
        const latestVersion = rawTag.replace(/^desktop-v?/i, '').replace(/^v/i, '') || '1.0.0';
        const isNewer = compareVersions(latestVersion, currentVersion) > 0;

        return {
            available: isNewer,
            currentVersion,
            latestVersion,
            releaseName: targetRelease.name || rawTag,
            releaseNotes: targetRelease.body || '',
            publishedAt: targetRelease.published_at || '',
            downloadUrl: matchedAsset ? matchedAsset.browser_download_url : (targetRelease.html_url || 'https://github.com/Kimmojiraja/fokk-project/releases'),
            fileName: matchedAsset ? matchedAsset.name : `fokk-browser-${latestVersion}`,
            fileSize: matchedAsset ? matchedAsset.size : 0
        };
    } catch (err) {
        return {
            available: false,
            currentVersion,
            error: err.message
        };
    }
});

ipcMain.handle('fokk-start-update', async (event, { downloadUrl, fileName }) => {
    return new Promise((resolve, reject) => {
        try {
            const updatesDir = path.join(app.getPath('userData'), 'updates');
            if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
            const targetPath = path.join(updatesDir, fileName || 'FokkBrowser-Update');

            function download(url) {
                https.get(url, { headers: { 'User-Agent': 'FokkBrowser-Updater' } }, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return download(res.headers.location);
                    }
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
                    }
                    const total = parseInt(res.headers['content-length'] || '0', 10);
                    let transferred = 0;
                    const fileStream = fs.createWriteStream(targetPath);

                    res.on('data', (chunk) => {
                        transferred += chunk.length;
                        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;
                        try {
                            event.sender.send('fokk-update-progress', { percent, transferred, total });
                        } catch (_) {}
                    });

                    fileStream.on('finish', () => {
                        fileStream.close(() => {
                            if (process.platform === 'linux') {
                                try { fs.chmodSync(targetPath, 0o755); } catch (_) {}
                            }
                            resolve({ success: true, filePath: targetPath });
                        });
                    });

                    res.pipe(fileStream);
                }).on('error', (err) => {
                    reject(err);
                });
            }

            download(downloadUrl);
        } catch (e) {
            reject(e);
        }
    });
});

ipcMain.handle('fokk-install-update', async (event, { filePath }) => {
    if (autoUpdater && autoUpdater.quitAndInstall) {
        try {
            autoUpdater.quitAndInstall();
            return { success: true };
        } catch (_) {}
    }

    if (filePath && fs.existsSync(filePath)) {
        if (process.platform === 'linux' && filePath.endsWith('.AppImage')) {
            const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
            child.unref();
            app.quit();
            return { success: true };
        } else {
            shell.openPath(filePath);
            return { success: true };
        }
    }
    return { success: false };
});

// Application Lifecycle
app.whenReady().then(() => {
    app.userAgentFallback = CHROME_USER_AGENT;
    createWindow();

    // Configure AdGuard DoH default out-of-the-box (matching mobile Android DnsOverHttpsEngine)
    try {
        if (app.configureHostResolver) {
            app.configureHostResolver({
                secureDnsMode: 'secure',
                secureDnsServers: [DOH_PROVIDERS.adguard]
            });
        }
    } catch (_) {}

    // Pre-warm real live RSS news in background for immediate render
    ['global', 'in', 'uk', 'ca', 'de', 'au'].forEach(reg => {
        newsService.getLiveNews('all', reg).catch(() => {});
    });

    // Ensure any previously corrupted foreign Google session cookies are cleared
    try {
        const persistSess = session.fromPartition('persist:fokk_default_session');
        const googleHosts = ['google.com', 'google.co.uk', 'accounts.google.com', 'youtube.com', 'google.co.in'];
        googleHosts.forEach(host => {
            persistSess.cookies.get({ domain: host }).then(cookies => {
                if (cookies && cookies.length > 0) {
                    cookies.forEach(c => {
                        // Purge corrupted Firefox tokens (AEC, NID, __Host-GAPS, LSID, etc.)
                        const u = 'https://' + (c.domain.startsWith('.') ? c.domain.slice(1) : c.domain) + c.path;
                        persistSess.cookies.remove(u, c.name).catch(() => {});
                    });
                }
            }).catch(() => {});
        });
    } catch (_) {}

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const { contextBridge, ipcRenderer, webFrame } = require('electron');

const isInternalPage = window.location.protocol === 'file:' || 
                       window.location.protocol === 'fokk:' ||
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

if (isInternalPage) {
    // Expose FokkShieldBridge to webviews matching the mobile Android JavaScriptInterface
    contextBridge.exposeInMainWorld('FokkShieldBridge', {
    isAndroidNative: () => false,
    isDesktopNative: () => true,

    // Navigation & Windowing
    openUrl: (url) => {
        ipcRenderer.send('fokk-open-url', url);
    },
    openMenu: () => {
        ipcRenderer.send('fokk-open-menu');
    },
    openNewTab: () => {
        ipcRenderer.send('fokk-open-new-tab');
    },
    newPrivateTab: () => {
        ipcRenderer.send('fokk-new-private-tab');
    },
    openPrivateTabs: () => {
        ipcRenderer.send('fokk-open-private-tabs');
    },
    openTabs: () => {
        ipcRenderer.send('fokk-open-tabs');
    },
    getTabCount: () => {
        return ipcRenderer.sendSync('fokk-get-tab-count');
    },

    // Search Engine & Omnibox Sync
    getSearchEngine: () => {
        try {
            return ipcRenderer.sendSync('fokk-get-search-engine') || localStorage.getItem('fokk_search_engine') || 'bing';
        } catch (_) {
            return localStorage.getItem('fokk_search_engine') || 'bing';
        }
    },
    setSearchEngine: (engKey) => {
        const val = (engKey || 'bing').toLowerCase();
        try { localStorage.setItem('fokk_search_engine', val); } catch (_) {}
        ipcRenderer.send('fokk-set-search-engine', val);
    },
    openSearchEngineDialog: () => {
        ipcRenderer.send('fokk-open-engine-dialog');
    },
    getSearchSuggestions: async (query) => {
        try {
            return await ipcRenderer.invoke('fokk-get-search-suggestions', query);
        } catch (_) {
            return [];
        }
    },
    fetchSearchSuggestions: async (query) => {
        try {
            return await ipcRenderer.invoke('fokk-get-search-suggestions', query);
        } catch (_) {
            return [];
        }
    },

    // Browser Feature Hubs
    openBookmarks: () => {
        ipcRenderer.send('fokk-open-hub', 'bookmarks');
    },
    openHistory: () => {
        ipcRenderer.send('fokk-open-hub', 'history');
    },
    openDownloads: () => {
        ipcRenderer.send('fokk-open-hub', 'downloads');
    },
    openShieldDashboard: () => {
        ipcRenderer.send('fokk-open-hub', 'shield');
    },
    openSettings: () => {
        ipcRenderer.send('fokk-open-hub', 'general');
    },
    openReaderMode: () => {
        ipcRenderer.send('fokk-toggle-reader');
    },
    saveCurrentPage: () => {
        ipcRenderer.send('fokk-save-offline-page');
    },
    burnSession: () => {
        ipcRenderer.invoke('fokk-burn-session');
    },

    // Live Multi-Source News
    getLiveNews: (category, region) => {
        return ipcRenderer.sendSync('fokk-get-news-sync', category || 'all', region || 'global');
    },
    getLiveNewsForRegion: (category, region) => {
        return ipcRenderer.sendSync('fokk-get-news-sync', category || 'all', region || 'global');
    },
    refreshLiveNews: (category, region) => {
        return ipcRenderer.sendSync('fokk-refresh-news-sync', category || 'all', region || 'global');
    },
    refreshLiveNewsForRegion: (category, region) => {
        return ipcRenderer.sendSync('fokk-refresh-news-sync', category || 'all', region || 'global');
    },

    // Adblock Defense Stats & Whitelist
    getStats: () => {
        return ipcRenderer.sendSync('fokk-get-stats');
    },

    // Themes & 4K Wallpapers
    getGlobalTheme: () => {
        return localStorage.getItem('fokk_global_theme') || 'default';
    },
    setGlobalTheme: (theme) => {
        localStorage.setItem('fokk_global_theme', theme);
        ipcRenderer.send('fokk-set-theme', theme);
    },
    getCustomWallpaperData: () => {
        return ipcRenderer.sendSync('fokk-get-wallpaper-data');
    },
    triggerWallpaperPicker: async () => {
        const fileData = await ipcRenderer.invoke('fokk-pick-wallpaper');
        if (fileData) {
            try {
                localStorage.setItem('fokk_custom_wallpaper', fileData);
                localStorage.setItem('fokk_global_theme', 'custom');
            } catch (e) {}
            if (typeof window.applyThemeFromNative === 'function') {
                window.applyThemeFromNative('custom', fileData);
            }
            if (typeof window.setWallpaper === 'function') {
                window.setWallpaper(fileData);
            }
        }
        return fileData;
    },
    triggerAvatarPicker: async () => {
        return await ipcRenderer.invoke('fokk-pick-avatar');
    },

    // Custom Shortcuts Management
    getCustomShortcuts: () => {
        return localStorage.getItem('fokk_custom_shortcuts') || '[]';
    },
    saveCustomShortcut: (title, url) => {
        try {
            const id = 'c_' + Date.now();
            let domain = '';
            try { domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname; } catch (_) {}
            const item = { id, name: title, title, url, sub: domain };
            const list = JSON.parse(localStorage.getItem('fokk_custom_shortcuts') || '[]');
            list.push(item);
            localStorage.setItem('fokk_custom_shortcuts', JSON.stringify(list));

            const desktopList = JSON.parse(localStorage.getItem('fokk_desktop_shortcuts') || '[]');
            desktopList.push(item);
            localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(desktopList));
        } catch (_) {}
    },

    // In-App 1-Click Auto-Updates
    checkForUpdates: async () => {
        return await ipcRenderer.invoke('fokk-check-update');
    },
    startUpdateDownload: async (info) => {
        return await ipcRenderer.invoke('fokk-start-update', info);
    },
    installUpdate: async (filePath) => {
        return await ipcRenderer.invoke('fokk-install-update', { filePath });
    },
    onUpdateProgress: (cb) => {
        ipcRenderer.on('fokk-update-progress', (event, data) => cb(data));
    },

    // Google Session Sync Stub (foreign cookie import disabled)
    syncGoogleSession: async () => {
        return { success: false, error: 'Session sync disabled to maintain cookie integrity' };
    },

    // Fokk Shield Tunnel (Privacy VPN & Relay)
    getVpnStatus: () => {
        try {
            return ipcRenderer.sendSync('fokk-vpn-get-status');
        } catch (_) {
            return { state: 'disconnected' };
        }
    },
    getVpnLocations: () => {
        try {
            return ipcRenderer.sendSync('fokk-vpn-get-locations');
        } catch (_) {
            return [];
        }
    },
    toggleVpn: async () => {
        return await ipcRenderer.invoke('fokk-vpn-toggle');
    },
    setVpnMode: async (modeId) => {
        return await ipcRenderer.invoke('fokk-vpn-set-mode', modeId);
    },
    setVpnKillSwitch: async (enabled) => {
        return await ipcRenderer.invoke('fokk-vpn-set-killswitch', enabled);
    },
    setVpnCustomConfig: async (config) => {
        return await ipcRenderer.invoke('fokk-vpn-set-custom', config);
    },
    onVpnStatusChanged: (cb) => {
        ipcRenderer.on('fokk-vpn-status-changed', (event, data) => cb(data));
    },

    // Utilities
    vibrate: () => {},
    toast: (msg) => {
        console.log('[Fokk Toast]', msg);
    }
});

// Forward push events from main process to internal webview pages
ipcRenderer.on('fokk-live-news-pushed', (event, { category, region, jsonStr }) => {
    try {
        const parsed = JSON.parse(jsonStr);
        window.dispatchEvent(new CustomEvent('fokk-live-news-updated', { detail: { stories: parsed, category, region } }));
        window.dispatchEvent(new CustomEvent('fokk-news-received', { detail: parsed }));
    } catch (_) {}

    if (typeof window.onLiveNewsReceived === 'function') {
        window.onLiveNewsReceived(category, region, jsonStr);
    }
});

ipcRenderer.on('fokk-search-engine-updated', (event, engineId) => {
    try {
        localStorage.setItem('fokk_search_engine', engineId);
    } catch (_) {}
    try {
        window.dispatchEvent(new CustomEvent('fokk-search-engine-change', { detail: { engineId } }));
    } catch (_) {}
    try {
        if (typeof window.updateSearchEngineUI === 'function') {
            window.updateSearchEngineUI(engineId);
        }
    } catch (_) {}
});
} else {
    // Universal Standard Chromium Runtime Environment for all external websites
    try {
        webFrame.executeJavaScriptInIsolatedWorld(0, [
            {
                code: `
                    // Authentic window.chrome object matching real Google Chrome / Brave
                    if (!window.chrome) {
                        window.chrome = {};
                    }
                    if (!window.chrome.app) {
                        window.chrome.app = {
                            isInstalled: false,
                            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
                            getIsInstalled: function() { return false; },
                            getDetails: function() { return null; },
                            runningState: function() { return 'cannot_run'; }
                        };
                    }
                    if (!window.chrome.csi) {
                        window.chrome.csi = function() {
                            return {
                                startE: Date.now(),
                                onloadT: Date.now(),
                                pageT: (performance && performance.now) ? performance.now() : 0,
                                tran: 15
                            };
                        };
                    }
                    if (!window.chrome.loadTimes) {
                        window.chrome.loadTimes = function() {
                            var nowSec = Date.now() / 1000;
                            return {
                                requestTime: nowSec,
                                startLoadTime: nowSec,
                                commitLoadTime: nowSec,
                                finishDocumentLoadTime: nowSec,
                                finishLoadTime: nowSec,
                                firstPaintTime: nowSec,
                                firstPaintAfterLoadTime: 0,
                                navigationType: 'Other',
                                wasFetchedViaSpdy: true,
                                wasNpnNegotiated: true,
                                npnNegotiatedProtocol: 'h2',
                                wasAlternateProtocolAvailable: false,
                                connectionInfo: 'h2'
                            };
                        };
                    }

                    // Clean navigator.webdriver fallback
                    try {
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined,
                            configurable: true
                        });
                    } catch (_) {}

                    // Helper to preserve [native code] signature on proxy functions
                    function makeNative(fn, name, orig) {
                        try {
                            const nativeStr = orig ? Function.prototype.toString.call(orig) : ('function ' + (name || '') + '() { [native code] }');
                            Object.defineProperty(fn, 'toString', {
                                value: function() { return nativeStr; },
                                writable: false,
                                configurable: true
                            });
                            Object.defineProperty(fn, 'name', {
                                value: name || (orig ? orig.name : ''),
                                configurable: true
                            });
                        } catch (_) {}
                        return fn;
                    }

                    // =========================================================================
                    // Fokk Pro Advanced Privacy Cloaker (Canvas, WebGL, AudioContext & Hardware)
                    // =========================================================================
                    (function() {
                        'use strict';
                        const seed = Math.floor(Math.random() * 10) + 1;

                        // 1. WebGL Hardware & Shader Masking with Native Signature Preservation
                        try {
                            const maskParam = function(origFn) {
                                const proxy = function(param) {
                                    if (param === 37445) return 'Google Inc. (NVIDIA)';
                                    if (param === 37446) return 'ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)';
                                    if (param === 7936) return 'WebKit';
                                    if (param === 7937) return 'WebKit WebGL';
                                    return origFn.call(this, param);
                                };
                                return makeNative(proxy, 'getParameter', origFn);
                            };

                            if (window.WebGLRenderingContext) {
                                WebGLRenderingContext.prototype.getParameter = maskParam(WebGLRenderingContext.prototype.getParameter);
                            }
                            if (window.WebGL2RenderingContext) {
                                WebGL2RenderingContext.prototype.getParameter = maskParam(WebGL2RenderingContext.prototype.getParameter);
                            }
                        } catch (_) {}

                        // 2. AudioContext Oscillator Fingerprint Guard
                        try {
                            if (window.AudioBuffer) {
                                const origGetChannelData = AudioBuffer.prototype.getChannelData;
                                const proxyAudio = function(channel) {
                                    const data = origGetChannelData.call(this, channel);
                                    try {
                                        for (let i = 0; i < Math.min(data.length, 64); i += 4) {
                                            data[i] += (seed * 0.000000001);
                                        }
                                    } catch (_) {}
                                    return data;
                                };
                                AudioBuffer.prototype.getChannelData = makeNative(proxyAudio, 'getChannelData', origGetChannelData);
                            }
                        } catch (_) {}

                        // 3. Standardize Concurrency & Device Memory
                        try {
                            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
                            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
                        } catch (_) {}

                        // 4. Battery API Protection
                        try {
                            if (navigator.getBattery) {
                                const fakeBattery = () => Promise.resolve({
                                    charging: true,
                                    chargingTime: 0,
                                    dischargingTime: Infinity,
                                    level: 1.0,
                                    addEventListener: () => {},
                                    removeEventListener: () => {}
                                });
                                navigator.getBattery = makeNative(fakeBattery, 'getBattery', navigator.getBattery);
                            }
                        } catch (_) {}

                        // 5. Universal CMP / Cookie Overlay Scroll Guard (The Guardian, Sky News, etc.)
                        try {
                            const unlockScroll = () => {
                                const html = document.documentElement;
                                const body = document.body;
                                if (!html || !body) return;
                                const htmlOverflow = window.getComputedStyle(html).overflowY;
                                const bodyOverflow = window.getComputedStyle(body).overflowY;
                                const bodyPos = window.getComputedStyle(body).position;
                                if (htmlOverflow === 'hidden' || bodyOverflow === 'hidden' || bodyPos === 'fixed' ||
                                    html.classList.contains('gu-consent-active') || body.classList.contains('gu-consent-active')) {
                                    html.style.setProperty('overflow', 'auto', 'important');
                                    html.style.setProperty('overflow-y', 'auto', 'important');
                                    body.style.setProperty('overflow', 'auto', 'important');
                                    body.style.setProperty('overflow-y', 'auto', 'important');
                                    body.style.setProperty('position', 'static', 'important');
                                    document.querySelectorAll('div[id^="sp_message_container"], div[class*="sp_message"], .gu-cmp-banner, .tp-backdrop').forEach(el => el.remove());
                                }
                            };
                            window.addEventListener('load', unlockScroll);
                            setTimeout(unlockScroll, 800);
                            setTimeout(unlockScroll, 2000);
                        } catch (_) {}
                    })();
                `
            }
        ]);
    } catch (_) {}
}


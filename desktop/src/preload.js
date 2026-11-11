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

                    // Clean navigator.userAgentData to completely eliminate Electron brand traces for Akamai / Cloudflare
                    try {
                        const fakeBrands = [
                            { brand: 'Chromium', version: '124' },
                            { brand: 'Google Chrome', version: '124' },
                            { brand: 'Not-A.Brand', version: '99' }
                        ];
                        const fakeFullBrands = [
                            { brand: 'Chromium', version: '124.0.6367.243' },
                            { brand: 'Google Chrome', version: '124.0.6367.243' },
                            { brand: 'Not-A.Brand', version: '99.0.0.0' }
                        ];
                        const fakeUAD = {
                            brands: fakeBrands,
                            mobile: false,
                            platform: 'Windows',
                            getHighEntropyValues: function(hints) {
                                return Promise.resolve({
                                    brands: fakeBrands,
                                    mobile: false,
                                    platform: 'Windows',
                                    platformVersion: '15.0.0',
                                    architecture: 'x86',
                                    bitness: '64',
                                    model: '',
                                    fullVersionList: fakeFullBrands
                                });
                            },
                            toJSON: function() {
                                return {
                                    brands: fakeBrands,
                                    mobile: false,
                                    platform: 'Windows'
                                };
                            }
                        };
                        Object.defineProperty(navigator, 'userAgentData', {
                            get: () => fakeUAD,
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
                            const unlockScroll = function() {
                                const html = document.documentElement;
                                const body = document.body;
                                if (!html) return;
                                if (html.classList && html.classList.contains('gu-consent-active')) html.classList.remove('gu-consent-active');
                                if (body && body.classList && body.classList.contains('gu-consent-active')) body.classList.remove('gu-consent-active');
                                const htmlOverflow = window.getComputedStyle(html).overflowY;
                                const bodyOverflow = body ? window.getComputedStyle(body).overflowY : '';
                                const bodyPos = body ? window.getComputedStyle(body).position : '';
                                if (htmlOverflow === 'hidden') {
                                    html.style.setProperty('overflow', 'auto', 'important');
                                    html.style.setProperty('overflow-y', 'auto', 'important');
                                }
                                if (body && (bodyOverflow === 'hidden' || bodyPos === 'fixed')) {
                                    body.style.setProperty('overflow', 'auto', 'important');
                                    body.style.setProperty('overflow-y', 'auto', 'important');
                                    body.style.setProperty('position', 'static', 'important');
                                }
                                document.querySelectorAll('div[id^="sp_message_container"], div[class*="sp_message"], .gu-cmp-banner, .tp-backdrop, iframe[id^="sp_message_iframe"]').forEach(function(el) { el.remove(); });
                            };
                            window.addEventListener('load', unlockScroll);
                            window.addEventListener('DOMContentLoaded', unlockScroll);
                            if (window.MutationObserver && document.documentElement) {
                                const cmpObs = new MutationObserver(unlockScroll);
                                cmpObs.observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['class', 'style'] });
                            }
                            let cmpCount = 0;
                            const cmpTimer = setInterval(function() {
                                unlockScroll();
                                if (++cmpCount > 15) clearInterval(cmpTimer);
                            }, 500);
                        } catch (_) {}

                        // 6. Access Denied / Akamai Block Instant Auto-Defuser In-Page Banner
                        try {
                            const detectAndInjectDefuserBar = function() {
                                const title = (document.title || '').toLowerCase();
                                const bodyText = document.body ? document.body.innerText.substring(0, 600).toLowerCase() : '';
                                const isBlocked = title.includes('access denied') || bodyText.includes('access denied') || bodyText.includes("you don't have permission") || bodyText.includes('errors.edgesuite.net') || title.includes('403 forbidden');
                                if (isBlocked && !document.getElementById('fokk-defuser-bar')) {
                                    const bar = document.createElement('div');
                                    bar.id = 'fokk-defuser-bar';
                                    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#0a192f,#1e293b);border-bottom:2px solid #00E5FF;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:12px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,0.8);';
                                    bar.innerHTML = '<span style="font-weight:700;color:#00E5FF;display:inline-flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Fokk AI Defuser:</span><span>Publisher CDN access block detected.</span><button id="fokk-btn-cache" style="background:#00E5FF;color:#0a192f;border:none;padding:5px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Google Cache Bypass</button><button id="fokk-btn-archive" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;padding:5px 12px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;">Archive Bypass</button><button id="fokk-btn-search" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;padding:5px 12px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;">Find Story</button><button id="fokk-btn-dismiss" style="background:transparent;border:1px solid #64748b;color:#cbd5e1;padding:4px 8px;border-radius:5px;font-size:11px;cursor:pointer;margin-left:auto;">Dismiss</button>';
                                    if (document.body) {
                                        document.body.prepend(bar);
                                        const btnCache = document.getElementById('fokk-btn-cache');
                                        if (btnCache) {
                                            btnCache.onclick = function() {
                                                window.location.href = 'https://webcache.googleusercontent.com/search?q=cache:' + encodeURIComponent(window.location.href);
                                            };
                                        }
                                        const btnArchive = document.getElementById('fokk-btn-archive');
                                        if (btnArchive) {
                                            btnArchive.onclick = function() {
                                                window.location.href = 'https://web.archive.org/web/' + encodeURIComponent(window.location.href);
                                            };
                                        }
                                        const btnSearch = document.getElementById('fokk-btn-search');
                                        if (btnSearch) {
                                            btnSearch.onclick = function() {
                                                let q = window.location.pathname.split('/').pop().replace(/-\d+$/, '').replace(/-/g, ' ');
                                                window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(q);
                                            };
                                        }
                                        const btnDismiss = document.getElementById('fokk-btn-dismiss');
                                        if (btnDismiss) {
                                            btnDismiss.onclick = function() {
                                                bar.remove();
                                            };
                                        }
                                    }
                                }
                            };
                            window.addEventListener('load', detectAndInjectDefuserBar);
                            setTimeout(detectAndInjectDefuserBar, 600);
                            setTimeout(detectAndInjectDefuserBar, 1500);
                        } catch (_) {}
                    })();
                `
            }
        ]);
    } catch (_) {}
}


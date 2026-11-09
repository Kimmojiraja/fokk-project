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
    getSearchSuggestions: (query) => {
        return ipcRenderer.sendSync('fokk-get-search-suggestions', query);
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
                        if (navigator.webdriver) {
                            delete Object.getPrototypeOf(navigator).webdriver;
                        }
                    } catch (_) {}
                `
            }
        ]);
    } catch (_) {}
}


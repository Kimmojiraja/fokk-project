const { contextBridge, ipcRenderer } = require('electron');

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
        return localStorage.getItem('fokk_search_engine') || 'bing';
    },
    setSearchEngine: (engKey) => {
        localStorage.setItem('fokk_search_engine', (engKey || 'bing').toLowerCase());
        ipcRenderer.send('fokk-set-search-engine', engKey);
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
            const list = JSON.parse(localStorage.getItem('fokk_custom_shortcuts') || '[]');
            list.push({ title, url, id: 'c_' + Date.now() });
            localStorage.setItem('fokk_custom_shortcuts', JSON.stringify(list));
        } catch (_) {}
    },

    // In-App 1-Click Auto-Updates
    checkForUpdates: async () => {
        return await ipcRenderer.invoke('fokk-check-update');
    },
    startUpdateDownload: async (info) => {
        return await ipcRenderer.invoke('fokk-download-update', info);
    },
    installUpdate: async (filePath) => {
        return await ipcRenderer.invoke('fokk-install-update', { filePath });
    },
    onUpdateProgress: (cb) => {
        ipcRenderer.on('fokk-update-progress', (event, data) => cb(data));
    },

    // Utilities
    vibrate: () => {},
    toast: (msg) => {
        console.log('[Fokk Toast]', msg);
    }
});

// Forward push events from main process to webview pages
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

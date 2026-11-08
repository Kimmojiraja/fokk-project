const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AdBlockEngine = require('./adblock');
const newsService = require('./news');

// Paths
const devAssetsDir = path.resolve(__dirname, '..', '..', 'app', 'src', 'main', 'assets');
const packagedAssetsDir = path.join(process.resourcesPath || '', 'assets');
const ASSETS_DIR = fs.existsSync(packagedAssetsDir) ? packagedAssetsDir : devAssetsDir;
const START_PAGE_URL = `file://${path.join(ASSETS_DIR, 'fokk_start.html')}`;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

let mainWindow = null;
const adblock = new AdBlockEngine(ASSETS_DIR);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0B0F19',
        icon: ICON_PATH,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'ui', 'browser.html'));

    // Adblocker Network Interceptor
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        if (adblock.shouldBlock(details.url, details.resourceType)) {
            // Send live stats update to UI
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('fokk-stats-updated', adblock.getStats());
            }
            callback({ cancel: true });
        } else {
            callback({ cancel: false });
        }
    });

    // Injected cosmetic ad defusers on every frame
    app.on('web-contents-created', (event, contents) => {
        if (contents.getType() === 'webview') {
            contents.on('dom-ready', () => {
                adblock.injectCosmeticFilters(contents);
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 1. IPC Handlers for Shell
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

// 2. IPC Handlers for FokkShieldBridge inside webviews
ipcMain.on('fokk-get-stats', (event) => {
    event.returnValue = JSON.stringify(adblock.getStats());
});

ipcMain.on('fokk-get-news-sync', (event, category, region) => {
    const cached = newsService.cache.get(`${(region||'global').toLowerCase()}_${(category||'all').toLowerCase()}`);
    if (cached) {
        event.returnValue = JSON.stringify(cached.data);
    } else {
        // Trigger background fetch and return immediate empty or cached
        newsService.getLiveNews(category, region).then(items => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('fokk-live-news-pushed', {
                    category,
                    region,
                    jsonStr: JSON.stringify(items)
                });
            }
        }).catch(() => {});
        event.returnValue = JSON.stringify([]);
    }
});

ipcMain.on('fokk-refresh-news-sync', (event, category, region) => {
    newsService.getLiveNews(category, region, true).then(items => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('fokk-live-news-pushed', {
                category,
                region,
                jsonStr: JSON.stringify(items)
            });
        }
    }).catch(() => {});
    event.returnValue = JSON.stringify([]);
});

let customWallpaperBase64 = '';
ipcMain.on('fokk-set-theme', (event, theme) => {
    console.log('[Theme] Changed to:', theme);
});

ipcMain.on('fokk-get-wallpaper-data', (event) => {
    event.returnValue = customWallpaperBase64;
});

ipcMain.handle('fokk-pick-wallpaper', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Custom Wallpaper',
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
        ]
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

ipcMain.on('fokk-open-url', (event, url) => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`if (typeof createTab === 'function') createTab(${JSON.stringify(url)});`);
    }
});

ipcMain.on('fokk-open-menu', () => {
    console.log('[Menu] Native menu opened');
});

// Application Lifecycle
app.whenReady().then(() => {
    createWindow();

    // Preload news in background
    newsService.getLiveNews('all', 'global').catch(() => {});

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

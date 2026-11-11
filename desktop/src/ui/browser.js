const { ipcRenderer } = require('electron');
const path = require('path');

// Helper: file:// URL for a UI page in the same directory as browser.html
function uiPageUrl(filename) {
    return 'file:///' + path.join(__dirname, filename).replace(/\\/g, '/');
}

// =========================================================================
// Fokk Pro Feature: AES-256 Offline Encrypted Vault Backup & Restore
// =========================================================================
async function exportEncryptedVault(password) {
    const payload = {
        app: 'Fokk Browser',
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        bookmarks: JSON.parse(localStorage.getItem('fokk_bookmarks') || '[]'),
        shortcuts: JSON.parse(localStorage.getItem('fokk_desktop_shortcuts') || '[]'),
        theme: localStorage.getItem('fokk_global_theme') || 'default',
        wallpaperId: localStorage.getItem('fokk_wallpaper_id') || 'sailboat',
        domainScripts: JSON.parse(localStorage.getItem('fokk_domain_scripts') || '{}'),
        searchEngine: localStorage.getItem('fokk_search_engine') || 'bing'
    };

    const enc = new TextEncoder();
    const dataBytes = enc.encode(JSON.stringify(payload));

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, dataBytes
    );

    const vaultPackage = {
        format: 'fokkvault',
        version: 1,
        salt: Array.from(salt),
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertext))
    };

    const blob = new Blob([JSON.stringify(vaultPackage, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `fokk-vault-${new Date().toISOString().slice(0, 10)}.fokkvault`;
    a.click();
    URL.revokeObjectURL(blobUrl);
}

async function importEncryptedVault(fileContent, password) {
    const pkg = JSON.parse(fileContent);
    if (!pkg || pkg.format !== 'fokkvault' || !pkg.ciphertext || !pkg.salt || !pkg.iv) {
        throw new Error('Invalid .fokkvault file format');
    }

    const salt = new Uint8Array(pkg.salt);
    const iv = new Uint8Array(pkg.iv);
    const ciphertext = new Uint8Array(pkg.ciphertext);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, ciphertext
    );

    const dec = new TextDecoder();
    const payload = JSON.parse(dec.decode(decrypted));

    if (payload.bookmarks) localStorage.setItem('fokk_bookmarks', JSON.stringify(payload.bookmarks));
    if (payload.shortcuts) localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(payload.shortcuts));
    if (payload.theme) localStorage.setItem('fokk_global_theme', payload.theme);
    if (payload.wallpaperId) localStorage.setItem('fokk_wallpaper_id', payload.wallpaperId);
    if (payload.domainScripts) localStorage.setItem('fokk_domain_scripts', JSON.stringify(payload.domainScripts));
    if (payload.searchEngine) localStorage.setItem('fokk_search_engine', payload.searchEngine);

    return payload;
}

let tabs = [];
let activeTabId = null;
let tabCounter = 0;
let currentZoom = 1.0;
let isForcedDark = false;
let isReaderActive = false;

const tabStrip = document.getElementById('tabStrip');
const btnNewTab = document.getElementById('btnNewTab');
const viewsContainer = document.getElementById('viewsContainer');
const urlInput = document.getElementById('urlInput');
const btnBack = document.getElementById('btnBack');
const btnForward = document.getElementById('btnForward');
const btnReload = document.getElementById('btnReload');
const btnHome = document.getElementById('btnHome');
const shieldCountText = document.getElementById('shieldCountText');
const shieldBadge = document.getElementById('shieldBadge');
const btnVisuals = document.getElementById('btnVisuals');
const btnDownloadsNav = document.getElementById('btnDownloadsNav');
const btnMenu = document.getElementById('btnMenu');
const desktopBrowserMenu = document.getElementById('desktopBrowserMenu');
const featureHubModal = document.getElementById('featureHubModal');
const featureModalTitle = document.getElementById('featureModalTitle');
const featureModalBody = document.getElementById('featureModalBody');
const btnCloseFeatureModal = document.getElementById('btnCloseFeatureModal');
const toastContainer = document.getElementById('toastContainer');
const btnReaderMode = document.getElementById('btnReaderMode');
const btnBookmarkOmni = document.getElementById('btnBookmarkOmni');

// Window controls
const btnMin = document.getElementById('btnMin');
const btnMax = document.getElementById('btnMax');
const btnClose = document.getElementById('btnClose');

const START_PAGE_URL = ipcRenderer.sendSync('fokk-get-start-page-url');
const PRELOAD_SCRIPT_PATH = ipcRenderer.sendSync('fokk-get-preload-path');
const PLATFORM_USER_AGENT = ipcRenderer.sendSync('fokk-get-user-agent');

// Authentic Incognito Stealth Vector Icon (URL-encoded data URI to prevent attribute quote breaks)
const INCOGNITO_FAVICON_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M6 11.5 L7.8 4.8 C8.2 3.8 9.5 3.8 12 3.8 C14.5 3.8 15.8 3.8 16.2 4.8 L18 11.5 Z" fill="#C084FC" stroke="none"/><path d="M2.5 12 C6.5 10.5 17.5 10.5 21.5 12" stroke="#C084FC" stroke-width="2.2" stroke-linecap="round"/><circle cx="8" cy="16.5" r="2.8" stroke="#C084FC" stroke-width="2" fill="none"/><circle cx="16" cy="16.5" r="2.8" stroke="#C084FC" stroke-width="2" fill="none"/><path d="M10.8 16.5 Q12 15.2 13.2 16.5" stroke="#C084FC" stroke-width="2" fill="none"/></svg>');

// Search Engine Registry (Exact Vector SVGs matching mobile design reference)
const OMNIBOX_ENGINES = {
    google: {
        name: 'Google',
        searchUrl: 'https://www.google.com/search?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.41l4.03-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>'
    },
    bing: {
        name: 'Bing',
        searchUrl: 'https://www.bing.com/search?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 32 32"><defs><linearGradient id="bingLg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00BCF2"/><stop offset="100%" stop-color="#0078D4"/></linearGradient></defs><path fill="url(#bingLg)" d="M8 3v21.5c0 1.2 1 2.2 2.2 2.3 3.5.3 8.5.5 12.5-3.2 3.6-3.4 3.7-8.8 1-12.8L16.5 6v9.5c0 .8-.7 1.5-1.5 1.5-.7 0-1.3-.5-1.5-1.2l-.5-1.6V3c0-.8-.7-1.5-1.5-1.5S8 2.2 8 3z"/></svg>'
    },
    brave: {
        name: 'Brave',
        searchUrl: 'https://search.brave.com/search?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 32 32"><path fill="#FF3300" d="M16 2l-10 4.2v8.5c0 7.2 4.3 13.8 10 16.3 5.7-2.5 10-9.1 10-16.3V6.2L16 2z"/><path fill="#FFF" d="M16 8l-4.5 2.5 1.4 6 3.1-1.5 3.1 1.5 1.4-6L16 8zm0 10.5l-3.2 2 1.2 4 2-1.2 2 1.2 1.2-4-3.2-2z"/><path fill="#FF7700" d="M12.5 13.5l3.5-1.8 3.5 1.8-1 4.5-2.5-1.2-2.5 1.2-1-4.5z"/></svg>'
    },
    duckduckgo: {
        name: 'DuckDuckGo',
        searchUrl: 'https://duckduckgo.com/?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#DE5833"/><path fill="#FFFFFF" d="M16 6c-3.9 0-7 3.1-7 7 0 2.2 1 4.1 2.6 5.4-.1.6-.4 1.9-1.6 3.1 1.8.1 3.5-.7 4.6-2 .5.1.9.1 1.4.1 3.9 0 7-3.1 7-7s-3.1-6.6-7-6.6z"/><circle cx="13.5" cy="11.5" r="1.5" fill="#333333"/><path fill="#F9A825" d="M17.5 14.5c0 0 3.5.5 5 2.5-1.5 1-4 1.5-6.5 1 0 0 2.5-1 1.5-3.5z"/><path fill="#4CAF50" d="M14 23.5l2-1.5 2 1.5-2 1.5-2-1.5z"/></svg>'
    },
    startpage: {
        name: 'Startpage',
        searchUrl: 'https://www.startpage.com/sp/search?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1A1C24"/><path fill="#3661FF" d="M7 14c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.8 0-3.5-.6-4.8-1.7l-4.5 4.5-1.4-1.4 4.5-4.5C7.6 17.5 7 15.8 7 14zm8-5.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5 5.5-2.5 5.5-5.5-2.5-5.5-5.5-5.5z"/><path d="M7 25.5c3.5-1.8 8.5-1.8 12 0" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>'
    },
    ecosia: {
        name: 'Ecosia',
        searchUrl: 'https://www.ecosia.org/search?q=',
        iconSvg: '<svg width="18" height="18" viewBox="0 0 32 32"><path fill="#48B25A" d="M16 4C10.5 4 6 8.5 6 14c0 3.2 1.5 6 3.8 7.8v.2c0 .5.2 1 .5 1.4.3.4.7.6 1.2.6h9c.5 0 .9-.2 1.2-.6.3-.4.5-.9.5-1.4v-.2C24.5 20 26 17.2 26 14c0-5.5-4.5-10-10-10z"/><path fill="#FFFFFF" d="M16 16v8m-2.5-4l2.5-3 2.5 3" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
};

let currentEngine = 'bing';
try {
    currentEngine = ipcRenderer.sendSync('fokk-get-search-engine') || localStorage.getItem('fokk_search_engine') || 'bing';
} catch (_) {
    currentEngine = localStorage.getItem('fokk_search_engine') || 'bing';
}

// Clean Professional Toast Notifications (Zero Emojis)
function showToast(message, isAlert = false) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'fokk-toast';
    if (isAlert) {
        toast.style.borderColor = 'rgba(255, 82, 82, 0.6)';
    }
    toast.innerHTML = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// Helper to load in active tab or create tab if none exist
function loadUrlInActiveTab(url) {
    const active = getActiveWebview();
    if (active) {
        active.loadURL(url);
    } else {
        createTab(url);
    }
}
window.loadUrlInActiveTab = loadUrlInActiveTab;

// 1. Tab Creation & Management
function createTab(url = START_PAGE_URL, options = {}) {
    tabCounter++;
    const tabId = 'tab_' + tabCounter;
    const isPrivate = typeof options === 'boolean' ? options : !!(options && options.isPrivate);

    // If private/incognito mode and opening start page, load the dedicated Incognito Home view
    let targetUrl = url;
    if (isPrivate && (!targetUrl || targetUrl === START_PAGE_URL || targetUrl.includes('start.html'))) {
        targetUrl = START_PAGE_URL + (START_PAGE_URL.includes('?') ? '&' : '?') + 'incognito=1';
    }

    const tabEl = document.createElement('div');
    tabEl.className = 'browser-tab' + (isPrivate ? ' private-tab' : '');
    tabEl.id = 'tab_btn_' + tabId;
    tabEl.innerHTML = `
        <img src="${isPrivate ? INCOGNITO_FAVICON_SVG : 'icon.png'}" class="tab-favicon" id="fav_${tabId}" alt="Favicon">
        <span class="tab-title" id="title_${tabId}">${isPrivate ? 'Incognito' : 'New Tab'}</span>
        <button class="tab-close" title="Close Tab (Ctrl+W)" aria-label="Close Tab">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/>
                <line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/>
            </svg>
        </button>
    `;

    tabEl.querySelector('.tab-close').onclick = (e) => {
        e.stopPropagation();
        closeTab(tabId);
    };

    tabEl.onclick = () => activateTab(tabId);
    tabStrip.insertBefore(tabEl, btnNewTab);

    const webview = document.createElement('webview');
    webview.id = 'view_' + tabId;
    webview.setAttribute('src', targetUrl);
    webview.setAttribute('preload', PRELOAD_SCRIPT_PATH);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('useragent', PLATFORM_USER_AGENT);
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes, backgroundThrottling=no');
    webview.style.backgroundColor = '#090A0C';
    if (isPrivate) {
        webview.setAttribute('partition', 'fokk_incognito_' + Date.now());
    } else {
        webview.setAttribute('partition', 'persist:fokk_default_session');
    }

    function recordHistoryItem(navUrl, navTitle) {
        if (isPrivate || !navUrl || navUrl.startsWith('file:') || navUrl.startsWith('fokk:')) return;
        try {
            let hist = JSON.parse(localStorage.getItem('fokk_browsing_history') || '[]');
            if (hist.length > 0 && hist[0].url === navUrl && (Date.now() - hist[0].time < 60000)) {
                return;
            }
            hist.unshift({
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                url: navUrl,
                title: navTitle || navUrl,
                time: Date.now()
            });
            if (hist.length > 1000) hist.pop();
            localStorage.setItem('fokk_browsing_history', JSON.stringify(hist));
        } catch (_) {}
    }

    webview.addEventListener('did-start-loading', () => {
        const t = tabs.find(x => x.id === tabId);
        if (t) {
            t.blockedCount = 0;
            if (t.blockedUrls) t.blockedUrls.clear();
        }
        if (activeTabId === tabId) {
            btnReload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            if (shieldCountText) shieldCountText.textContent = '0';
        }
    });

    webview.addEventListener('dom-ready', () => {
        const currentTheme = localStorage.getItem('fokk_theme') || 'dark';
        const isLight = currentTheme === 'light';
        const u = webview.getURL ? webview.getURL() : '';
        if (!u || u.startsWith('file:') || u.startsWith('fokk:')) {
            webview.executeJavaScript(`
                if (document.body) {
                    document.body.classList.toggle('theme-light', ${isLight});
                    try { localStorage.setItem('fokk_theme', '${currentTheme}'); } catch(_) {}
                }
                try {
                    localStorage.setItem('fokk_search_engine', '${currentEngine}');
                    if (typeof window.updateSearchEngineUI === 'function') {
                        window.updateSearchEngineUI('${currentEngine}');
                    }
                } catch(_) {}
            `).catch(() => {});
        }
    });

    webview.addEventListener('did-stop-loading', () => {
        if (activeTabId === tabId) {
            btnReload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/></svg>`;
            updateNavState(webview);
            updateOmnibox(webview.getURL());
        }

        // Auto-inject persistent domain CSS/JS (Pro Feature)
        try {
            const curUrl = webview.getURL ? webview.getURL() : '';
            if (curUrl && curUrl.startsWith('http')) {
                const host = new URL(curUrl).hostname;
                const domainScripts = JSON.parse(localStorage.getItem('fokk_domain_scripts') || '{}');
                const rule = domainScripts[host];
                if (rule && rule.enabled !== false) {
                    if (rule.css) webview.insertCSS(rule.css);
                    if (rule.js) webview.executeJavaScript(rule.js);
                }
            }
        } catch (_) {}
    });

    webview.addEventListener('page-title-updated', (e) => {
        const titleEl = document.getElementById('title_' + tabId);
        if (titleEl && e.title) {
            const currentUrl = (webview.getURL ? webview.getURL() : '') || '';
            const isStartPage = currentUrl.includes('start.html') || currentUrl.startsWith('file:') || !currentUrl || e.title === 'New Tab' || e.title === 'Incognito';
            if (isPrivate) {
                titleEl.textContent = isStartPage ? 'Incognito' : e.title;
            } else {
                titleEl.textContent = e.title;
            }
        }
        if (!isPrivate && webview.getURL) {
            recordHistoryItem(webview.getURL(), e.title);
        }
    });

    webview.addEventListener('page-favicon-updated', (e) => {
        const favEl = document.getElementById('fav_' + tabId);
        const currentUrl = (webview.getURL ? webview.getURL() : '') || '';
        if (favEl) {
            if (isPrivate && (currentUrl.includes('start.html') || currentUrl.startsWith('file:') || !currentUrl)) {
                favEl.src = INCOGNITO_FAVICON_SVG;
            } else if (e.favicons && e.favicons.length > 0) {
                favEl.src = e.favicons[0];
            } else if (isPrivate) {
                favEl.src = INCOGNITO_FAVICON_SVG;
            }
        }
    });

    webview.addEventListener('did-navigate', (e) => {
        if (activeTabId === tabId) {
            updateOmnibox(e.url);
            updateNavState(webview);
        }
        if (!isPrivate) {
            const currentTitle = (webview.getTitle ? webview.getTitle() : '') || e.url;
            recordHistoryItem(e.url, currentTitle);
        }
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
        if (activeTabId === tabId) {
            updateOmnibox(e.url);
            updateNavState(webview);
        }
        if (!isPrivate) {
            const currentTitle = (webview.getTitle ? webview.getTitle() : '') || e.url;
            recordHistoryItem(e.url, currentTitle);
        }
    });

    webview.addEventListener('new-window', (e) => {
        if (e.disposition === 'new-window' || (e.options && (e.options.width || e.options.height))) {
            return;
        }
        createTab(e.url, { isPrivate });
    });

    viewsContainer.appendChild(webview);

    tabs.push({ id: tabId, el: tabEl, webview: webview, isPrivate: isPrivate, blockedCount: 0, blockedUrls: new Set() });
    activateTab(tabId);
}

function activateTab(tabId) {
    activeTabId = tabId;
    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab) {
        targetTab.lastActiveTime = Date.now();
        if (targetTab.isSleeping && typeof wakeTab === 'function') {
            wakeTab(targetTab);
        }
    }

    tabs.forEach(t => {
        let currentTabUrl = '';
        try { currentTabUrl = (typeof t.webview.getURL === 'function') ? t.webview.getURL() : ''; } catch (_) {}

        if (t.id === tabId) {
            t.el.classList.add('active');
            t.webview.classList.add('active');
            updateOmnibox(currentTabUrl);
            updateNavState(t.webview);
            if (shieldCountText) {
                shieldCountText.textContent = (currentTabUrl.startsWith('http') && t.blockedCount) ? t.blockedCount : '0';
            }
        } else {
            t.el.classList.remove('active');
            t.webview.classList.remove('active');
        }
    });

    if (isSplitViewActive && typeof updateSplitLayout === 'function') {
        updateSplitLayout();
    } else if (isQuadViewActive && typeof updateQuadLayout === 'function') {
        updateQuadLayout();
    }
}

function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const t = tabs[idx];
    t.el.remove();
    t.webview.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
        createTab(START_PAGE_URL);
    } else if (activeTabId === tabId) {
        const nextTab = tabs[Math.max(0, idx - 1)];
        activateTab(nextTab.id);
    }

    if (isSplitViewActive && typeof updateSplitLayout === 'function') {
        updateSplitLayout();
    }
    if (isQuadViewActive && typeof updateQuadLayout === 'function') {
        if (tabs.length < 4) {
            toggleQuadMode();
        } else {
            updateQuadLayout();
        }
    }
}

function updateNavState(webview) {
    if (!webview || typeof webview.canGoBack !== 'function') return;
    try {
        btnBack.disabled = !webview.canGoBack();
        btnForward.disabled = !webview.canGoForward();
    } catch (_) {
        btnBack.disabled = true;
        btnForward.disabled = true;
    }
}

function updateOmnibox(rawUrl) {
    if (!rawUrl || rawUrl.includes('start.html') || rawUrl.includes('fokk_start.html') || rawUrl.startsWith('file://')) {
        urlInput.value = '';
        const engine = OMNIBOX_ENGINES[currentEngine] || OMNIBOX_ENGINES.bing;
        urlInput.placeholder = `Search with ${engine.name} or enter address`;
        if (btnBookmarkOmni) btnBookmarkOmni.classList.remove('active');
    } else {
        urlInput.value = rawUrl;
        const bookmarks = JSON.parse(localStorage.getItem('fokk_bookmarks') || '[]');
        if (btnBookmarkOmni) {
            btnBookmarkOmni.classList.toggle('active', bookmarks.some(b => b.url === rawUrl));
        }
    }
}

// 2. Navigation Actions
btnBack.onclick = () => {
    const active = getActiveWebview();
    if (active && active.canGoBack()) active.goBack();
};

btnForward.onclick = () => {
    const active = getActiveWebview();
    if (active && active.canGoForward()) active.goForward();
};

btnReload.onclick = () => {
    const active = getActiveWebview();
    if (active) {
        if (active.isLoading()) active.stop();
        else active.reload();
    }
};

btnHome.onclick = () => {
    const active = getActiveWebview();
    if (active) active.loadURL(START_PAGE_URL);
};

btnNewTab.onclick = () => createTab(START_PAGE_URL);

// Window controls
if (btnMin) btnMin.onclick = () => ipcRenderer.send('fokk-win-min');
if (btnMax) btnMax.onclick = () => ipcRenderer.send('fokk-win-max');
if (btnClose) btnClose.onclick = () => ipcRenderer.send('fokk-win-close');

function getActiveWebview() {
    const t = tabs.find(x => x.id === activeTabId);
    return t ? t.webview : null;
}

// 3. Omnibox Engine Selector & Submission
const omniboxEngineSelector = document.getElementById('omniboxEngineSelector');
const omniboxEngineIcon = document.getElementById('omniboxEngineIcon');
const omniboxEngineDropdown = document.getElementById('omniboxEngineDropdown');

function setOmniboxEngine(engineId) {
    if (!OMNIBOX_ENGINES[engineId]) return;
    currentEngine = engineId;
    try { localStorage.setItem('fokk_search_engine', engineId); } catch (_) {}
    try { ipcRenderer.send('fokk-set-search-engine', engineId); } catch (_) {}

    if (omniboxEngineIcon) {
        omniboxEngineIcon.innerHTML = OMNIBOX_ENGINES[engineId].iconSvg;
    }
    updateOmnibox(getActiveWebview()?.getURL?.() || '');

    if (omniboxEngineDropdown) {
        omniboxEngineDropdown.querySelectorAll('.engine-item').forEach(item => {
            item.classList.toggle('selected', item.getAttribute('data-engine') === engineId);
        });
    }

    // Also notify active start pages to update their search placeholder
    tabs.forEach(t => {
        if (t.webview) {
            t.webview.executeJavaScript(`
                try {
                    localStorage.setItem('fokk_search_engine', '${engineId}');
                    if (typeof window.updateSearchEngineUI === 'function') {
                        window.updateSearchEngineUI('${engineId}');
                    }
                } catch (_) {}
            `).catch(() => {});
        }
    });
}

ipcRenderer.on('fokk-search-engine-updated', (event, engineId) => {
    if (engineId && OMNIBOX_ENGINES[engineId] && engineId !== currentEngine) {
        currentEngine = engineId;
        try { localStorage.setItem('fokk_search_engine', engineId); } catch (_) {}
        if (omniboxEngineIcon) {
            omniboxEngineIcon.innerHTML = OMNIBOX_ENGINES[engineId].iconSvg;
        }
        updateOmnibox(getActiveWebview()?.getURL?.() || '');
        if (omniboxEngineDropdown) {
            omniboxEngineDropdown.querySelectorAll('.engine-item').forEach(item => {
                item.classList.toggle('selected', item.getAttribute('data-engine') === engineId);
            });
        }
    }
});

if (omniboxEngineSelector && omniboxEngineDropdown) {
    omniboxEngineSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        omniboxEngineDropdown.classList.toggle('hidden');
    });

    omniboxEngineDropdown.querySelectorAll('.engine-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            setOmniboxEngine(item.getAttribute('data-engine'));
            omniboxEngineDropdown.classList.add('hidden');
        });
    });
}

setOmniboxEngine(currentEngine);

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = urlInput.value.trim();
        if (!query) return;

        let targetUrl = '';
        if (/^https?:\/\//i.test(query)) {
            targetUrl = query;
        } else if (/^localhost(:\d+)?(\/.*)?$/i.test(query) || /^127\.0\.0\.1(:\d+)?(\/.*)?$/i.test(query)) {
            targetUrl = 'http://' + query;
        } else if (query.includes('.') && !query.includes(' ') && !query.endsWith('.')) {
            targetUrl = 'https://' + query;
        } else {
            const engine = OMNIBOX_ENGINES[currentEngine] || OMNIBOX_ENGINES.bing;
            targetUrl = engine.searchUrl + encodeURIComponent(query);
        }

        const active = getActiveWebview();
        if (active) active.loadURL(targetUrl);
    }
});

async function toggleReaderMode() {
    const active = getActiveWebview();
    if (!active) return;
    try {
        const script = await ipcRenderer.invoke('fokk-get-reader-script');
        if (script) {
            await active.executeJavaScript(`
                (function() {
                    if (typeof window.toggleFokkReaderMode !== 'function') {
                        ${script}
                    }
                    if (typeof window.toggleFokkReaderMode === 'function') {
                        window.toggleFokkReaderMode();
                    }
                })();
            `);
            isReaderActive = !isReaderActive;
            if (btnReaderMode) btnReaderMode.classList.toggle('active', isReaderActive);
            showToast(isReaderActive ? 'Reader Mode Enabled' : 'Reader Mode Disabled');
        }
    } catch (e) {
        showToast('Reader mode unavailable on this page');
    }
}

if (btnReaderMode) {
    btnReaderMode.addEventListener('click', toggleReaderMode);
}

if (btnBookmarkOmni) {
    btnBookmarkOmni.addEventListener('click', () => {
        const active = getActiveWebview();
        if (!active) return;
        const url = active.getURL();
        const title = active.getTitle() || url;
        if (!url || url.startsWith('file://')) return;

        let bookmarks = JSON.parse(localStorage.getItem('fokk_bookmarks') || '[]');
        const exists = bookmarks.some(b => b.url === url);

        if (exists) {
            bookmarks = bookmarks.filter(b => b.url !== url);
            btnBookmarkOmni.classList.remove('active');
            showToast('Removed from Bookmarks');
        } else {
            bookmarks.push({ title, url, time: Date.now() });
            btnBookmarkOmni.classList.add('active');
            showToast('Saved to Bookmarks');
        }
        localStorage.setItem('fokk_bookmarks', JSON.stringify(bookmarks));
    });
}

// =========================================================================
// AI Defuser — Smart Access-Denied / Paywall / Consent Wall Bypass
// =========================================================================
(function initAiDefuser() {
    const btnAiDefuser = document.getElementById('btnAiDefuser');
    const aiDefuserPanel = document.getElementById('aiDefuserPanel');
    const aiDefuserStatus = document.getElementById('aiDefuserStatus');
    const aiDefuserActions = document.getElementById('aiDefuserActions');
    if (!btnAiDefuser || !aiDefuserPanel) return;

    // Signatures for access-denied / paywall / consent wall detection
    const ACCESS_BLOCKED_SIGS = [
        /access denied/i, /you don't have permission/i, /403 forbidden/i,
        /reference #\d+\.\w+/, /edgesuite\.net/i, /blocked by/i,
        /this content is not available/i, /country.*not.*available/i,
        /geo.*blocked/i, /region.*restricted/i
    ];
    const PAYWALL_SIGS = [
        /subscribe to (read|continue|access)/i, /this article is for subscribers/i,
        /create a free account/i, /sign in to read/i, /premium content/i,
        /you've used your free articles/i, /register to continue/i,
        /paywall/i, /metered content/i
    ];

    let panelOpen = false;
    let currentUrl = '';
    let currentPageText = '';
    let defuserState = 'idle'; // idle | scanning | blocked | paywall | clear

    function openPanel() {
        panelOpen = true;
        btnAiDefuser.classList.add('active');
        aiDefuserPanel.classList.remove('hidden');
        scanPage();
    }

    function closePanel() {
        panelOpen = false;
        btnAiDefuser.classList.remove('active');
        aiDefuserPanel.classList.add('hidden');
    }

    btnAiDefuser.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panelOpen) { closePanel(); return; }
        openPanel();
    });

    document.addEventListener('click', (e) => {
        if (panelOpen && !aiDefuserPanel.contains(e.target) && e.target !== btnAiDefuser) {
            closePanel();
        }
    });

    // Auto-scan on navigation
    function hookWebviewForDefuser(webview) {
        webview.addEventListener('did-navigate', () => {
            if (panelOpen) scanPage();
            // Auto-detect and show pulsing indicator on blocked pages
            setTimeout(() => autoDetect(webview), 1500);
        });
        webview.addEventListener('did-fail-load', () => {
            if (panelOpen) {
                setStatus('blocked', 'Page failed to load — network block or access denied.');
                renderActions('blocked');
            }
        });
    }

    // Hook into tab creation by watching viewsContainer
    const viewsContainer = document.getElementById('viewsContainer');
    if (viewsContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.tagName === 'WEBVIEW') hookWebviewForDefuser(node);
                });
            });
        });
        observer.observe(viewsContainer, { childList: true, subtree: true });
        // Hook already-existing webviews
        viewsContainer.querySelectorAll('webview').forEach(hookWebviewForDefuser);
    }

    function autoDetect(webview) {
        try {
            webview.executeJavaScript(`
                (function() {
                    var txt = (document.title + ' ' + (document.body ? document.body.innerText.substring(0, 1500) : '')).toLowerCase();
                    var isBlocked = /access denied|you don.t have permission|403 forbidden|reference #\\d|edgesuite/.test(txt);
                    var isPaywall = /subscribe to|this article is for subscribers|sign in to read|you.ve used your free|register to continue/.test(txt);
                    return { isBlocked: isBlocked, isPaywall: isPaywall, title: document.title };
                })();
            `).then((result) => {
                if (result && (result.isBlocked || result.isPaywall)) {
                    btnAiDefuser.classList.add('needs-defuse');
                    btnAiDefuser.setAttribute('title', result.isBlocked
                        ? 'AI Defuser — Access blocked detected! Click to bypass'
                        : 'AI Defuser — Paywall detected! Click to bypass');
                } else {
                    btnAiDefuser.classList.remove('needs-defuse');
                    btnAiDefuser.setAttribute('title', 'AI Defuser — Bypass access blocks, paywalls & consent walls');
                }
            }).catch(() => {});
        } catch (_) {}
    }

    function setStatus(type, msg) {
        defuserState = type;
        const colors = { scanning: '#8A9BC1', blocked: '#F43F5E', paywall: '#F59E0B', clear: '#22C55E', idle: '#8A9BC1' };
        aiDefuserStatus.textContent = msg;
        aiDefuserStatus.style.color = colors[type] || '#8A9BC1';
        // Pulse the button on blocked/paywall
        if (type === 'blocked' || type === 'paywall') {
            btnAiDefuser.classList.add('needs-defuse');
        } else if (type === 'clear') {
            btnAiDefuser.classList.remove('needs-defuse');
        }
    }

    function renderActions(type) {
        aiDefuserActions.innerHTML = '';
        if (type === 'blocked') {
            const actions = [
                { label: 'Bypass via Archive.org', fn: bypassArchive, color: '#00E5FF' },
                { label: 'Stealth Reload (new headers)', fn: stealthReload, color: '#00E5FF' },
                { label: 'Open in Reader Mode', fn: openReader, color: '#A78BFA' }
            ];
            actions.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'ai-defuser-action-btn';
                btn.textContent = a.label;
                btn.style.borderColor = a.color;
                btn.style.color = a.color;
                btn.onclick = a.fn;
                aiDefuserActions.appendChild(btn);
            });
        } else if (type === 'paywall') {
            const actions = [
                { label: 'Bypass Paywall via Archive', fn: bypassArchive, color: '#F59E0B' },
                { label: 'Extract Article (Reader)', fn: openReader, color: '#A78BFA' },
                { label: 'Google Cache Version', fn: openGoogleCache, color: '#00E5FF' }
            ];
            actions.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'ai-defuser-action-btn';
                btn.textContent = a.label;
                btn.style.borderColor = a.color;
                btn.style.color = a.color;
                btn.onclick = a.fn;
                aiDefuserActions.appendChild(btn);
            });
        }
    }

    function scanPage() {
        const active = getActiveWebview();
        if (!active) { setStatus('idle', 'No active page to scan.'); return; }
        currentUrl = active.getURL();
        if (!currentUrl || currentUrl.startsWith('file://')) {
            setStatus('idle', 'No external page loaded.');
            aiDefuserActions.innerHTML = '';
            return;
        }
        setStatus('scanning', 'Scanning page for blocks and paywalls...');
        aiDefuserActions.innerHTML = '';
        active.executeJavaScript(`
            (function() {
                var title = document.title || '';
                var txt = (title + ' ' + (document.body ? document.body.innerText.substring(0, 3000) : '')).toLowerCase();
                var metaRobots = '';
                var m = document.querySelector('meta[name="robots"]');
                if (m) metaRobots = m.content;
                return { title: title, text: txt, metaRobots: metaRobots };
            })();
        `).then((result) => {
            if (!result) { setStatus('idle', 'Could not read page content.'); return; }
            currentPageText = result.text || '';
            const isBlocked = ACCESS_BLOCKED_SIGS.some(r => r.test(currentPageText));
            const isPaywall = PAYWALL_SIGS.some(r => r.test(currentPageText));
            if (isBlocked) {
                setStatus('blocked', 'Access Denied detected — CDN block or geo-restriction.');
                renderActions('blocked');
            } else if (isPaywall) {
                setStatus('paywall', 'Paywall or login wall detected on this page.');
                renderActions('paywall');
            } else {
                setStatus('clear', 'Page is clean — no blocks or paywalls detected.');
                aiDefuserActions.innerHTML = '';
            }
        }).catch(() => {
            setStatus('idle', 'Could not inspect page. Try a manual bypass below.');
        });
    }

    // --- Bypass Methods ---

    function bypassArchive() {
        const active = getActiveWebview();
        if (!active) return;
        const url = active.getURL() || currentUrl;
        if (!url || url.startsWith('file://')) return;
        const archiveUrl = 'https://web.archive.org/web/' + encodeURIComponent(url);
        active.loadURL(archiveUrl);
        closePanel();
        showToast('Loading Wayback Machine archive...');
    }

    function stealthReload() {
        const active = getActiveWebview();
        if (!active) return;
        const url = active.getURL() || currentUrl;
        if (!url || url.startsWith('file://')) return;
        // Reload with fresh session context — clears cookies for this domain and reloads
        active.executeJavaScript(`
            (function() {
                // Clear consent/block cookies
                var domain = window.location.hostname;
                document.cookie.split(';').forEach(function(c) {
                    var name = c.split('=')[0].trim();
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + domain;
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + domain;
                });
            })();
        `).then(() => {
            active.reloadIgnoringCache();
            closePanel();
            showToast('Stealth reload — cache cleared & cookies reset.');
        }).catch(() => {
            active.reloadIgnoringCache();
            closePanel();
            showToast('Reloading with stealth headers...');
        });
    }

    function openReader() {
        closePanel();
        if (typeof toggleReaderMode === 'function') toggleReaderMode();
        else showToast('Reader Mode activated.');
    }

    function openGoogleCache() {
        const active = getActiveWebview();
        if (!active) return;
        const url = active.getURL() || currentUrl;
        if (!url || url.startsWith('file://')) return;
        const cacheUrl = 'https://webcache.googleusercontent.com/search?q=cache:' + encodeURIComponent(url);
        active.loadURL(cacheUrl);
        closePanel();
        showToast('Loading Google Cache version...');
    }

    // Quick action buttons in panel
    const adfArchive = document.getElementById('adfArchive');
    const adfReader = document.getElementById('adfReader');
    const adfGoogle = document.getElementById('adfGoogle');
    const adfReload = document.getElementById('adfReload');
    if (adfArchive) adfArchive.onclick = bypassArchive;
    if (adfReader) adfReader.onclick = openReader;
    if (adfGoogle) adfGoogle.onclick = openGoogleCache;
    if (adfReload) adfReload.onclick = stealthReload;
})();

// 4. Desktop Browser Menu & Daily Essentials
if (btnMenu && desktopBrowserMenu) {
    btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof updateProUI === 'function') updateProUI();
        desktopBrowserMenu.classList.toggle('hidden');
        if (vpnPopover) {
            vpnPopover.classList.add('hidden');
            if (btnVpnToggle) btnVpnToggle.classList.remove('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (!desktopBrowserMenu.contains(e.target) && e.target !== btnMenu) {
            desktopBrowserMenu.classList.add('hidden');
        }
        if (omniboxEngineDropdown && !omniboxEngineSelector.contains(e.target)) {
            omniboxEngineDropdown.classList.add('hidden');
        }
        if (vpnPopover && !vpnPopover.contains(e.target) && btnVpnToggle && !btnVpnToggle.contains(e.target)) {
            vpnPopover.classList.add('hidden');
            if (btnVpnToggle) btnVpnToggle.classList.remove('active');
        }
    });
}

// Quick Nav in Menu
const menuNavBack = document.getElementById('menuNavBack');
const menuNavForward = document.getElementById('menuNavForward');
const menuNavReload = document.getElementById('menuNavReload');
const menuNavHome = document.getElementById('menuNavHome');
const menuNavHistory = document.getElementById('menuNavHistory');
const menuNavDownloads = document.getElementById('menuNavDownloads');

if (menuNavBack) menuNavBack.onclick = () => btnBack.click();
if (menuNavForward) menuNavForward.onclick = () => btnForward.click();
if (menuNavReload) menuNavReload.onclick = () => btnReload.click();
if (menuNavHome) menuNavHome.onclick = () => btnHome.click();
if (menuNavHistory) menuNavHistory.onclick = () => openFeatureHub('history');
if (menuNavDownloads) menuNavDownloads.onclick = () => openFeatureHub('downloads');

// User Profile (Shadow Falcon & Custom Avatar)
const menuAvatarWrap = document.getElementById('menuAvatarWrap');
const menuAvatarImg = document.getElementById('menuAvatarImg');
const menuUsernameText = document.getElementById('menuUsernameText');
const btnEditUsername = document.getElementById('btnEditUsername');

function loadUserProfile() {
    const savedName = localStorage.getItem('fokk_user_name') || 'Shadow Falcon';
    const savedAvatar = localStorage.getItem('fokk_user_avatar');

    if (menuUsernameText) menuUsernameText.textContent = savedName;
    if (menuAvatarImg && savedAvatar) {
        menuAvatarImg.src = savedAvatar;
    }
}
loadUserProfile();

if (menuAvatarWrap) {
    menuAvatarWrap.onclick = async () => {
        desktopBrowserMenu.classList.add('hidden');
        try {
            const avatarData = await ipcRenderer.invoke('fokk-pick-avatar');
            if (avatarData) {
                localStorage.setItem('fokk_user_avatar', avatarData);
                if (menuAvatarImg) menuAvatarImg.src = avatarData;
                showToast('Profile avatar updated');
            }
        } catch (e) {
            showToast('Unable to update avatar: ' + e.message);
        }
    };
}

if (btnEditUsername) {
    btnEditUsername.onclick = (e) => {
        e.stopPropagation();
        desktopBrowserMenu.classList.add('hidden');
        openFeatureHub('edit-profile');
    };
}

// Pro Status Sync in Three-Dot Menu
const btnMenuGetPro = document.getElementById('btnMenuGetPro');
const btnMenuGetProText = document.getElementById('btnMenuGetProText');

function updateProUI() {
    const isPro = localStorage.getItem('fokk_pro_status') === 'active';
    if (btnMenuGetPro && btnMenuGetProText) {
        if (isPro) {
            btnMenuGetPro.classList.add('is-pro-active');
            btnMenuGetProText.textContent = 'Pro Active';
            btnMenuGetPro.title = 'Fokk Pro Active · Click to manage license';
        } else {
            btnMenuGetPro.classList.remove('is-pro-active');
            btnMenuGetProText.textContent = 'Get Pro';
            btnMenuGetPro.title = 'Upgrade to Fokk Pro ($4.79/mo)';
        }
    }
}
updateProUI();

if (btnMenuGetPro) {
    btnMenuGetPro.onclick = (e) => {
        e.stopPropagation();
        desktopBrowserMenu.classList.add('hidden');
        createTab(uiPageUrl('fokk_contributing.html'));
    };
}

window.addEventListener('storage', (e) => {
    if (e.key === 'fokk_pro_status') {
        updateProUI();
    }
});

// Shield Toggle in Menu
const menuShieldToggle = document.getElementById('menuShieldToggle');
const menuShieldBadge = document.getElementById('menuShieldBadge');

if (menuShieldToggle) {
    menuShieldToggle.addEventListener('click', () => {
        const isEnabled = ipcRenderer.sendSync('fokk-toggle-shield');
        if (menuShieldBadge) {
            menuShieldBadge.textContent = isEnabled ? 'SHIELD ACTIVE' : 'SHIELD DISABLED';
            menuShieldBadge.className = 'shield-status-badge ' + (isEnabled ? 'active' : 'disabled');
        }
        showToast(isEnabled ? 'Fokk Shield: Active' : 'Fokk Shield: Disabled');
    });
}

// Burn Session (Purge all history & cache)
const btnBurnSession = document.getElementById('btnBurnSession');
if (btnBurnSession) {
    btnBurnSession.addEventListener('click', async () => {
        desktopBrowserMenu.classList.add('hidden');
        showToast('Burning browsing session and cookies...', true);

        try {
            await ipcRenderer.invoke('fokk-burn-session');
            localStorage.removeItem('fokk_bookmarks');
            localStorage.removeItem('fokk_search_history');

            while (tabs.length > 1) {
                closeTab(tabs[tabs.length - 1].id);
            }
            const active = getActiveWebview();
            if (active) active.loadURL(START_PAGE_URL);

            showToast('All cookies, cache and session history purged', true);
        } catch (e) {
            showToast('Failed to burn session: ' + e.message, true);
        }
    });
}

// Daily Essentials Actions
const actNewTab = document.getElementById('actNewTab');
const actPrivateTab = document.getElementById('actPrivateTab');
const actReaderMode = document.getElementById('actReaderMode');
const actSmartSummary = document.getElementById('actSmartSummary');
const actTorrent = document.getElementById('actTorrent');
const actForceDark = document.getElementById('actForceDark');
const actDesktopUA = document.getElementById('actDesktopUA');
const actShare = document.getElementById('actShare');
const actAddShortcut = document.getElementById('actAddShortcut');
const actBookmarks = document.getElementById('actBookmarks');

function openSummaryModal(summary) {
    if (!featureHubModal || !featureModalTitle || !featureModalBody) return;
    featureModalTitle.textContent = 'Fokk On-Device AI Summary';

    const bulletsHtml = (summary.bullets || []).map(b => `
        <li style="display: flex; gap: 10px; font-size: 13px; line-height: 1.5; color: #E2E8F0; margin-bottom: 8px;">
            <span style="color: var(--fokk-cyan); font-weight: 800; font-size: 16px; line-height: 1;">•</span>
            <span>${b}</span>
        </li>
    `).join('');

    let metricsHtml = '';
    if (summary.metrics && summary.metrics.length > 0) {
        metricsHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
                ${summary.metrics.map(m => `<span style="background: rgba(0,229,255,0.08); border: 1px solid rgba(0,229,255,0.25); color: var(--fokk-cyan); padding: 2px 8px; border-radius: 4px; font-size: 11px;">${m}</span>`).join('')}
            </div>
        `;
    }

    featureModalBody.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
            <span style="background: rgba(0,229,255,0.15); color: var(--fokk-cyan); padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">100% On-Device NLP · Zero Cloud</span>
            <span style="font-size: 11.5px; color: var(--text-secondary);">${summary.readingTime || '1 min'} read · ${summary.wordCount || 0} words</span>
        </div>
        <h3 style="color: #FFF; font-size: 15px; font-weight: 700; margin-bottom: 14px; line-height: 1.4;">${summary.title || 'Extracted Summary'}</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
            ${bulletsHtml}
        </ul>
        ${metricsHtml}
        <button class="modal-btn secondary" id="btnCloseSummary" style="width: 100%; margin-top: 16px;">Done</button>
    `;

    document.getElementById('btnCloseSummary').onclick = () => {
        featureHubModal.classList.add('hidden');
    };

    featureHubModal.classList.remove('hidden');
}

if (actNewTab) actNewTab.onclick = () => { createTab(START_PAGE_URL); desktopBrowserMenu.classList.add('hidden'); };
if (actPrivateTab) actPrivateTab.onclick = () => { createTab(START_PAGE_URL, { isPrivate: true }); desktopBrowserMenu.classList.add('hidden'); };
if (actReaderMode) actReaderMode.onclick = () => { desktopBrowserMenu.classList.add('hidden'); toggleReaderMode(); };

if (actSmartSummary) {
    actSmartSummary.onclick = async () => {
        desktopBrowserMenu.classList.add('hidden');
        const active = getActiveWebview();
        if (!active) return;
        showToast('Analyzing page with local AI summarizer...');
        try {
            const script = await ipcRenderer.invoke('fokk-get-summarizer-script');
            const summary = await active.executeJavaScript(`
                (function() {
                    if (typeof window.generatePageSummary !== 'function') {
                        ${script}
                    }
                    if (typeof window.generatePageSummary === 'function') {
                        return window.generatePageSummary();
                    }
                    return null;
                })();
            `);

            if (summary && summary.bullets && summary.bullets.length > 0) {
                openSummaryModal(summary);
            } else {
                showToast('Not enough article content found to summarize', true);
            }
        } catch (e) {
            showToast('Summarizer error: ' + (e.message || e), true);
        }
    };
}

if (actTorrent) {
    actTorrent.onclick = async () => {
        desktopBrowserMenu.classList.add('hidden');
        try {
            const torrentUrl = await ipcRenderer.invoke('fokk-get-torrent-url');
            if (torrentUrl) {
                createTab(torrentUrl);
            }
        } catch (e) {
            showToast('Unable to launch Torrent Streamer');
        }
    };
}

// Theme Switcher (Dark & Light)
const actThemeToggle = document.getElementById('actThemeToggle');
const actThemeToggleText = document.getElementById('actThemeToggleText');

function applyTheme(themeName) {
    const isLight = themeName === 'light';
    document.body.classList.toggle('theme-light', isLight);
    if (actThemeToggleText) {
        actThemeToggleText.textContent = isLight ? 'Dark Mode' : 'Light Mode';
    }
    const themeIconSvg = actThemeToggle ? actThemeToggle.querySelector('svg') : null;
    if (themeIconSvg) {
        if (isLight) {
            // Moon icon to switch to dark mode
            themeIconSvg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
            // Sun icon to switch to light mode
            themeIconSvg.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        }
    }
    localStorage.setItem('fokk_theme', themeName);

    // Notify Electron main process to update nativeTheme (prefers-color-scheme across all websites)
    try {
        ipcRenderer.send('fokk-set-theme', themeName);
    } catch (_) {}

    // Sync theme class strictly to internal pages (start.html, etc.)
    tabs.forEach(t => {
        if (t.webview) {
            const u = t.webview.getURL ? t.webview.getURL() : '';
            if (!u || u.startsWith('file:') || u.startsWith('fokk:')) {
                t.webview.executeJavaScript(`
                    if (document.body) {
                        document.body.classList.toggle('theme-light', ${isLight});
                        try { localStorage.setItem('fokk_theme', '${themeName}'); } catch(_) {}
                    }
                `).catch(() => {});
            }
        }
    });
}

const currentGlobalTheme = localStorage.getItem('fokk_theme') || 'dark';
applyTheme(currentGlobalTheme);

if (actThemeToggle) {
    actThemeToggle.onclick = () => {
        desktopBrowserMenu.classList.add('hidden');
        const cur = localStorage.getItem('fokk_theme') || 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        applyTheme(next);
        showToast(next === 'light' ? 'Light Theme Applied' : 'Dark Mode Restored');
    };
}

let isMobileUA = false;
if (actDesktopUA) {
    actDesktopUA.onclick = () => {
        const active = getActiveWebview();
        if (!active) return;
        desktopBrowserMenu.classList.add('hidden');
        isMobileUA = !isMobileUA;
        const mobileUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
        active.setUserAgent(isMobileUA ? mobileUA : PLATFORM_USER_AGENT);
        active.reload();
        showToast(isMobileUA ? 'Switched to Mobile User-Agent' : 'Switched to Desktop User-Agent');
    };
}

if (actShare) {
    actShare.onclick = () => {
        const active = getActiveWebview();
        if (active) {
            const url = active.getURL();
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link copied to clipboard');
            });
        }
        desktopBrowserMenu.classList.add('hidden');
    };
}

if (actAddShortcut) {
    actAddShortcut.onclick = () => {
        const active = getActiveWebview();
        if (active) {
            const url = active.getURL();
            const name = active.getTitle() || 'Shortcut';
            if (url && !url.startsWith('file://')) {
                let shortcuts = JSON.parse(localStorage.getItem('fokk_desktop_shortcuts') || '[]');
                shortcuts.push({ name, url, sub: new URL(url).hostname });
                localStorage.setItem('fokk_desktop_shortcuts', JSON.stringify(shortcuts));
                showToast(`Added \"${name}\" to Home Shortcuts`);
            }
        }
        desktopBrowserMenu.classList.add('hidden');
    };
}

if (actBookmarks) actBookmarks.onclick = () => { openFeatureHub('bookmarks'); desktopBrowserMenu.classList.add('hidden'); };

// Zoom Controls
const btnZoomIn = document.getElementById('btnZoomIn');
const btnZoomOut = document.getElementById('btnZoomOut');
const zoomLevelText = document.getElementById('zoomLevelText');

if (btnZoomIn) {
    btnZoomIn.onclick = () => {
        const active = getActiveWebview();
        if (active) {
            currentZoom = Math.min(2.5, currentZoom + 0.1);
            active.setZoomFactor(currentZoom);
            if (zoomLevelText) zoomLevelText.textContent = Math.round(currentZoom * 100) + '%';
        }
    };
}

if (btnZoomOut) {
    btnZoomOut.onclick = () => {
        const active = getActiveWebview();
        if (active) {
            currentZoom = Math.max(0.5, currentZoom - 0.1);
            active.setZoomFactor(currentZoom);
            if (zoomLevelText) zoomLevelText.textContent = Math.round(currentZoom * 100) + '%';
        }
    };
}

// 5. Feature Hubs Modal
const PREINSTALLED_SAILBOATS = [
    { id: 'sailboat', name: 'Sunset Coastal Sailboat (Default)', file: 'wallpaper_sailboat.jpg' },
    { id: 'sailboat_2', name: 'Azure Ocean Yacht', file: 'wallpaper_sailboat_2.jpg' },
    { id: 'sailboat_3', name: 'Golden Hour Sloop', file: 'wallpaper_sailboat_3.jpg' },
    { id: 'sailboat_4', name: 'Open Sea Regatta', file: 'wallpaper_sailboat_4.jpg' },
    { id: 'sailboat_5', name: 'Tropical Lagoon Sailboat', file: 'wallpaper_sailboat_5.jpg' },
    { id: 'sailboat_6', name: 'Dramatic Horizon Sailing', file: 'wallpaper_sailboat_6.jpg' }
];

document.querySelectorAll('.menu-hub-item').forEach(item => {
    item.addEventListener('click', () => {
        const hubId = item.getAttribute('data-hub');
        openFeatureHub(hubId);
        desktopBrowserMenu.classList.add('hidden');
    });
});

if (btnVisuals) {
    btnVisuals.addEventListener('click', () => openFeatureHub('visuals'));
}
if (btnDownloadsNav) {
    btnDownloadsNav.addEventListener('click', () => openFeatureHub('downloads'));
}

function openFeatureHub(hubId) {
    if (hubId === 'vpn') {
        if (vpnPopover) {
            vpnPopover.classList.toggle('hidden');
            if (btnVpnToggle) btnVpnToggle.classList.toggle('active', !vpnPopover.classList.contains('hidden'));
        }
        return;
    }

    if (!featureHubModal || !featureModalBody) return;

    if (hubId === 'bookmarks') {
        featureModalTitle.textContent = 'Bookmarks Manager';
        let bookmarkList = [];
        try {
            bookmarkList = JSON.parse(localStorage.getItem('fokk_bookmarks') || '[]');
        } catch (_) {}

        function renderBookmarkList(filterQuery = '') {
            const filtered = filterQuery
                ? bookmarkList.filter(b => (b.title && b.title.toLowerCase().includes(filterQuery.toLowerCase())) || (b.url && b.url.toLowerCase().includes(filterQuery.toLowerCase())))
                : bookmarkList;

            let itemsHtml = '';
            if (filtered.length === 0) {
                itemsHtml = `
                    <div style="text-align: center; padding: 40px 10px; color: var(--text-secondary);">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity: 0.4; margin-bottom: 10px;"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                        <p style="font-size: 13px;">${filterQuery ? 'No bookmarks match your search' : 'No bookmarks saved yet'}</p>
                        <p style="font-size: 11.5px; opacity: 0.7; margin-top: 4px;">Use the bookmark icon or Ctrl+D on any web page to save it</p>
                    </div>
                `;
            } else {
                itemsHtml = filtered.map(b => {
                    let domain = '';
                    try { domain = new URL(b.url).hostname; } catch (_) {}
                    const dateStr = b.time ? new Date(b.time).toLocaleDateString() : '';
                    return `
                        <div class="history-item-row" data-url="${b.url}">
                            <div class="history-item-left">
                                <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" class="history-favicon" onerror="this.src='icon.png'">
                                <div class="history-item-meta">
                                    <span class="history-item-title" title="${b.title || b.url}">${b.title || b.url}</span>
                                    <span class="history-item-url">${b.url}</span>
                                </div>
                            </div>
                            <div class="history-item-right">
                                <span class="history-item-time">${dateStr}</span>
                                <button class="btn-del-bookmark" data-url="${b.url}" title="Remove Bookmark">&times;</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            featureModalBody.innerHTML = `
                <div class="history-toolbar">
                    <input type="text" id="inputSearchBookmarks" class="history-search-input" placeholder="Search bookmarks..." value="${filterQuery}">
                    <button class="modal-btn secondary" id="btnClearAllBookmarks" style="font-size: 11.5px; padding: 4px 10px;">Clear All</button>
                </div>
                <div class="history-list-wrap">
                    ${itemsHtml}
                </div>
            `;

            const searchInput = document.getElementById('inputSearchBookmarks');
            if (searchInput) {
                searchInput.oninput = (e) => renderBookmarkList(e.target.value);
                if (filterQuery) {
                    searchInput.focus();
                    searchInput.setSelectionRange(filterQuery.length, filterQuery.length);
                }
            }

            const clearBtn = document.getElementById('btnClearAllBookmarks');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    bookmarkList = [];
                    localStorage.setItem('fokk_bookmarks', '[]');
                    renderBookmarkList();
                    if (btnBookmarkOmni) btnBookmarkOmni.classList.remove('active');
                    showToast('All bookmarks cleared');
                };
            }

            featureModalBody.querySelectorAll('.history-item-row').forEach(row => {
                row.onclick = (e) => {
                    if (e.target.closest('.btn-del-bookmark')) return;
                    const u = row.getAttribute('data-url');
                    if (u) {
                        createTab(u);
                        featureHubModal.classList.add('hidden');
                    }
                };
            });

            featureModalBody.querySelectorAll('.btn-del-bookmark').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const u = btn.getAttribute('data-url');
                    bookmarkList = bookmarkList.filter(x => x.url !== u);
                    localStorage.setItem('fokk_bookmarks', JSON.stringify(bookmarkList));
                    const curSearch = document.getElementById('inputSearchBookmarks') ? document.getElementById('inputSearchBookmarks').value : '';
                    renderBookmarkList(curSearch);
                    const activeW = getActiveWebview();
                    if (activeW && activeW.getURL() === u && btnBookmarkOmni) {
                        btnBookmarkOmni.classList.remove('active');
                    }
                    showToast('Bookmark removed');
                };
            });
        }

        renderBookmarkList();
    } else if (hubId === 'history') {
        featureModalTitle.textContent = 'Browsing History';
        let historyList = [];
        try {
            historyList = JSON.parse(localStorage.getItem('fokk_browsing_history') || '[]');
        } catch (_) {}

        function renderHistoryList(filterQuery = '') {
            const filtered = filterQuery
                ? historyList.filter(h => (h.title && h.title.toLowerCase().includes(filterQuery)) || (h.url && h.url.toLowerCase().includes(filterQuery)))
                : historyList;

            let itemsHtml = '';
            if (filtered.length === 0) {
                itemsHtml = `
                    <div style="text-align: center; padding: 36px 16px; color: var(--text-secondary); font-size: 13px;">
                        ${filterQuery ? 'No history matching "' + filterQuery + '"' : 'Zero browsing history recorded yet. Visited sites will appear here.'}
                    </div>
                `;
            } else {
                itemsHtml = filtered.map(h => {
                    const timeStr = new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date(h.time).toLocaleDateString();
                    let domain = '';
                    try { domain = new URL(h.url).hostname; } catch(_) { domain = h.url; }
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

                    return `
                        <div class="history-item-row" data-id="${h.id}" data-url="${h.url}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s ease;">
                            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                                <img src="${faviconUrl}" style="width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;" onerror="this.style.display='none'">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 13px; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.title || domain}</div>
                                    <div style="font-size: 11px; color: var(--fokk-cyan); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${h.url}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                                <span style="font-size: 11px; color: var(--text-secondary);">${timeStr}</span>
                                <button class="btn-delete-history-item" data-id="${h.id}" title="Remove from History" style="background: none; border: none; color: #FF5252; cursor: pointer; font-size: 16px; padding: 0 4px; line-height: 1;">&times;</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const container = document.getElementById('historyListContainer');
            if (container) {
                container.innerHTML = itemsHtml;
                container.querySelectorAll('.history-item-row').forEach(row => {
                    row.onclick = (e) => {
                        if (e.target.classList.contains('btn-delete-history-item')) return;
                        const u = row.getAttribute('data-url');
                        if (u) {
                            createTab(u);
                            featureHubModal.classList.add('hidden');
                        }
                    };
                });
                container.querySelectorAll('.btn-delete-history-item').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const id = btn.getAttribute('data-id');
                        historyList = historyList.filter(x => x.id !== id);
                        localStorage.setItem('fokk_browsing_history', JSON.stringify(historyList));
                        renderHistoryList(document.getElementById('inputSearchHistory') ? document.getElementById('inputSearchHistory').value.trim().toLowerCase() : '');
                    };
                });
            }
        }

        featureModalBody.innerHTML = `
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                <input type="text" id="inputSearchHistory" class="modal-input" placeholder="Search history by title or URL..." style="flex: 1;">
                <button class="modal-btn secondary" id="btnClearAllHistory" style="padding: 0 16px; white-space: nowrap;">Clear All</button>
            </div>
            <div id="historyListContainer" style="max-height: 400px; overflow-y: auto; padding-right: 4px;"></div>
        `;

        renderHistoryList('');

        const searchInput = document.getElementById('inputSearchHistory');
        if (searchInput) {
            searchInput.oninput = (e) => renderHistoryList(e.target.value.trim().toLowerCase());
        }

        const btnClear = document.getElementById('btnClearAllHistory');
        if (btnClear) {
            btnClear.onclick = () => {
                historyList = [];
                localStorage.removeItem('fokk_browsing_history');
                renderHistoryList('');
                showToast('Browsing history cleared');
            };
        }

    } else if (hubId === 'downloads') {
        featureModalTitle.textContent = 'Downloads Manager';

        async function renderDownloadsList() {
            let list = [];
            try {
                list = await ipcRenderer.invoke('fokk-get-downloads');
            } catch (_) {}

            let html = '';
            if (!list || list.length === 0) {
                html = `
                    <div style="text-align: center; padding: 40px 16px; color: var(--text-secondary); font-size: 13px;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 10px; opacity: 0.6;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <div>No recent downloads found in this session.</div>
                        <div style="font-size: 11.5px; margin-top: 8px; color: var(--fokk-cyan); cursor: pointer; text-decoration: underline;" id="linkOpenDlDir">Open ~/Downloads Folder</div>
                    </div>
                `;
            } else {
                html = list.map(d => {
                    const mbTotal = (d.totalBytes / (1024 * 1024)).toFixed(1);
                    const mbReceived = (d.receivedBytes / (1024 * 1024)).toFixed(1);
                    const isDone = d.state === 'completed';
                    const isProgress = d.state === 'progressing';

                    return `
                        <div class="download-item-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--fokk-cyan)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    <div style="font-size: 13px; font-weight: 600; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.fileName}</div>
                                </div>
                                <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; ${isDone ? 'background: rgba(16,185,129,0.15); color: #10B981;' : (isProgress ? 'background: rgba(0,229,255,0.15); color: var(--fokk-cyan);' : 'background: rgba(239,68,68,0.15); color: #EF4444;')}">${d.state.toUpperCase()}</span>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
                                <span>${isProgress ? `${mbReceived} MB / ${mbTotal} MB` : `${mbTotal} MB`}</span>
                                <div style="display: flex; gap: 8px;">
                                    ${isDone ? `<button class="modal-btn secondary btn-open-dl" data-path="${d.savePath}" style="padding: 3px 10px; font-size: 11px;">Open File</button>` : ''}
                                    <button class="modal-btn secondary btn-folder-dl" data-path="${d.savePath}" style="padding: 3px 10px; font-size: 11px;">Show in Folder</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            const container = document.getElementById('downloadsListContainer');
            if (container) {
                container.innerHTML = html;
                const linkDir = document.getElementById('linkOpenDlDir');
                if (linkDir) {
                    linkDir.onclick = () => ipcRenderer.invoke('fokk-open-downloads-folder');
                }
                container.querySelectorAll('.btn-open-dl').forEach(btn => {
                    btn.onclick = () => {
                        const p = btn.getAttribute('data-path');
                        if (p) ipcRenderer.invoke('fokk-open-download-file', p);
                    };
                });
                container.querySelectorAll('.btn-folder-dl').forEach(btn => {
                    btn.onclick = () => {
                        const p = btn.getAttribute('data-path');
                        ipcRenderer.invoke('fokk-show-in-folder', p);
                    };
                });
            }
        }

        featureModalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <button class="modal-btn secondary" id="btnOpenDownloadsFolder" style="display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    <span>Open Downloads Folder</span>
                </button>
                <button class="modal-btn secondary" id="btnClearDownloadsList" style="color: #FF5252;">Clear List</button>
            </div>
            <div id="downloadsListContainer" style="max-height: 400px; overflow-y: auto; padding-right: 4px;"></div>
        `;

        renderDownloadsList();

        document.getElementById('btnOpenDownloadsFolder').onclick = () => {
            ipcRenderer.invoke('fokk-open-downloads-folder');
        };
        document.getElementById('btnClearDownloadsList').onclick = async () => {
            await ipcRenderer.invoke('fokk-clear-downloads');
            renderDownloadsList();
            showToast('Downloads list cleared');
        };

    } else if (hubId === 'edit-profile') {
        featureModalTitle.textContent = 'Edit Profile';
        const curName = localStorage.getItem('fokk_user_name') || 'Shadow Falcon';
        const curAvatar = localStorage.getItem('fokk_user_avatar') || 'icon.png';

        featureModalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 20px;">
                <div style="position: relative; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 2px solid var(--fokk-cyan); box-shadow: 0 4px 20px rgba(0,229,255,0.35); cursor: pointer;" id="modalAvatarPreviewWrap" title="Click to choose new photo">
                    <img id="modalAvatarPreview" src="${curAvatar}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <button class="modal-btn secondary" id="btnModalPickAvatar" style="font-size: 11.5px; padding: 4px 14px;">Change Avatar Picture</button>
            </div>
            <div class="modal-form-group">
                <label class="modal-form-label">Username</label>
                <input type="text" id="inputEditUsername" class="modal-input" value="${curName}" placeholder="Enter display username">
            </div>
            <button class="modal-btn" id="btnSaveUserProfile" style="margin-top: 16px;">Save Profile</button>
        `;

        let pendingAvatar = curAvatar;

        async function pickAvatar() {
            const res = await ipcRenderer.invoke('fokk-pick-avatar');
            if (res) {
                pendingAvatar = res;
                document.getElementById('modalAvatarPreview').src = res;
            }
        }

        document.getElementById('btnModalPickAvatar').onclick = pickAvatar;
        document.getElementById('modalAvatarPreviewWrap').onclick = pickAvatar;

        document.getElementById('btnSaveUserProfile').onclick = () => {
            const newName = (document.getElementById('inputEditUsername').value || '').trim() || 'Shadow Falcon';
            localStorage.setItem('fokk_user_name', newName);
            if (pendingAvatar) localStorage.setItem('fokk_user_avatar', pendingAvatar);
            loadUserProfile();
            featureHubModal.classList.add('hidden');
            showToast('Profile updated successfully');
        };

    } else if (hubId === 'general') {
        featureModalTitle.textContent = 'General & Search Engines';
        featureModalBody.innerHTML = `
            <div class="modal-form-group">
                <label class="modal-form-label">Default Search Engine</label>
                <span class="modal-form-sub">Active search engine for omnibox and home page search</span>
                <select id="selDefaultEngine" class="modal-select">
                    <option value="google" ${currentEngine==='google'?'selected':''}>Google</option>
                    <option value="bing" ${currentEngine==='bing'?'selected':''}>Bing</option>
                    <option value="brave" ${currentEngine==='brave'?'selected':''}>Brave</option>
                    <option value="duckduckgo" ${currentEngine==='duckduckgo'?'selected':''}>DuckDuckGo</option>
                    <option value="startpage" ${currentEngine==='startpage'?'selected':''}>Startpage</option>
                    <option value="ecosia" ${currentEngine==='ecosia'?'selected':''}>Ecosia</option>
                </select>
            </div>
            <div class="modal-form-group">
                <label class="modal-form-label">Home Page Address</label>
                <input type="text" id="inputHomeUrl" class="modal-input" value="${localStorage.getItem('fokk_custom_home') || 'fokk://newtab'}">
            </div>
            <div class="modal-toggle-row">
                <div class="modal-toggle-text">
                    <div class="modal-toggle-title">Hardware Acceleration</div>
                    <div class="modal-toggle-desc">GPU compositor rendering for smooth 60fps animations</div>
                </div>
                <input type="checkbox" checked disabled>
            </div>
            <button class="modal-btn" id="btnSaveGeneral" style="margin-top: 14px;">Save Settings</button>
        `;

        document.getElementById('btnSaveGeneral').onclick = () => {
            const chosen = document.getElementById('selDefaultEngine').value;
            setOmniboxEngine(chosen);
            const homeUrl = document.getElementById('inputHomeUrl').value;
            localStorage.setItem('fokk_custom_home', homeUrl);
            featureHubModal.classList.add('hidden');
            showToast('Search Settings Saved');
        };

    } else if (hubId === 'shield') {
        featureModalTitle.textContent = 'Fokk Shield & Ghost Stealth';
        let currentDoh = localStorage.getItem('fokk_doh_provider') || 'adguard';
        let whitelist = JSON.parse(localStorage.getItem('fokk_shield_whitelist') || '[]');
        let blacklist = JSON.parse(localStorage.getItem('fokk_shield_blacklist') || '[]');

        function renderShieldBody() {
            featureModalBody.innerHTML = `
                <div class="modal-toggle-row">
                    <div class="modal-toggle-text">
                        <div class="modal-toggle-title">Fokk Network Shield</div>
                        <div class="modal-toggle-desc">40,000+ active curated network block rules and cosmetic defusers</div>
                    </div>
                    <input type="checkbox" id="chkShieldEngine" checked>
                </div>
                <div class="modal-toggle-row">
                    <div class="modal-toggle-text">
                        <div class="modal-toggle-title">Canvas Cloaking & Stealth</div>
                        <div class="modal-toggle-desc">Injects noise on HTML5 canvas readouts to prevent cross-site fingerprinting</div>
                    </div>
                    <input type="checkbox" id="chkCanvasCloak" checked>
                </div>
                <div class="modal-form-group" style="margin-top: 16px;">
                    <label class="modal-form-label">DNS-over-HTTPS (DoH)</label>
                    <span class="modal-form-sub">Encrypted DNS resolution bypassing ISP tracking</span>
                    <select id="selDoH" class="modal-select">
                        <option value="adguard" ${currentDoh==='adguard'?'selected':''}>AdGuard (Default — 94.140.14.14 Zero Ads & Trackers)</option>
                        <option value="nextdns" ${currentDoh==='nextdns'?'selected':''}>NextDNS (Ultra-Fast Threat Intelligence)</option>
                        <option value="controld" ${currentDoh==='controld'?'selected':''}>Control D (Malware & Ad Blocker)</option>
                        <option value="mullvad" ${currentDoh==='mullvad'?'selected':''}>Mullvad (Strict No-Logs WireGuard Privacy)</option>
                        <option value="cloudflare" ${currentDoh==='cloudflare'?'selected':''}>Cloudflare (1.1.1.1 — Fast & Private)</option>
                        <option value="quad9" ${currentDoh==='quad9'?'selected':''}>Quad9 (9.9.9.9 — Threat Protection)</option>
                        <option value="google" ${currentDoh==='google'?'selected':''}>Google Public DNS (8.8.8.8)</option>
                        <option value="off" ${currentDoh==='off'?'selected':''}>System Default DNS</option>
                    </select>
                </div>
                <div class="modal-form-group" style="margin-top: 16px;">
                    <label class="modal-form-label">Whitelisted Domains (${whitelist.length})</label>
                    <span class="modal-form-sub">Domains where adblocking and defusers are disabled</span>
                    <div style="display: flex; gap: 8px; margin-top: 6px;">
                        <input type="text" id="inputWhitelist" class="modal-input" placeholder="e.g. news.ycombinator.com" style="flex: 1;">
                        <button class="modal-btn secondary" id="btnAddWhitelist" style="padding: 0 14px;">Add</button>
                    </div>
                    <div id="whitelistTags" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; max-height: 80px; overflow-y: auto;">
                        ${whitelist.map(d => `<span class="domain-tag" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 3px 8px; border-radius: 4px; font-size: 11px; color: #FFF; display: flex; align-items: center; gap: 6px;">${d} <button class="btn-remove-wl" data-domain="${d}" style="background: none; border: none; color: #FF5252; cursor: pointer; font-size: 13px; padding: 0;">&times;</button></span>`).join('')}
                    </div>
                </div>
                <div class="modal-form-group" style="margin-top: 16px;">
                    <label class="modal-form-label">Custom Blocked Domains (${blacklist.length})</label>
                    <span class="modal-form-sub">Custom tracking or ad hostnames to reject</span>
                    <div style="display: flex; gap: 8px; margin-top: 6px;">
                        <input type="text" id="inputBlacklist" class="modal-input" placeholder="e.g. telemetry.example.com" style="flex: 1;">
                        <button class="modal-btn secondary" id="btnAddBlacklist" style="padding: 0 14px;">Block</button>
                    </div>
                    <div id="blacklistTags" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; max-height: 80px; overflow-y: auto;">
                        ${blacklist.map(d => `<span class="domain-tag" style="background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.25); padding: 3px 8px; border-radius: 4px; font-size: 11px; color: #FF8A80; display: flex; align-items: center; gap: 6px;">${d} <button class="btn-remove-bl" data-domain="${d}" style="background: none; border: none; color: #FF5252; cursor: pointer; font-size: 13px; padding: 0;">&times;</button></span>`).join('')}
                    </div>
                </div>
                <button class="modal-btn" id="btnSaveShield" style="margin-top: 16px;">Apply Shield Settings</button>
            `;

            document.getElementById('btnSaveShield').onclick = () => {
                const doh = document.getElementById('selDoH').value;
                currentDoh = doh;
                localStorage.setItem('fokk_doh_provider', doh);
                ipcRenderer.send('fokk-set-doh', doh);
                ipcRenderer.send('fokk-sync-whitelist', whitelist);
                ipcRenderer.send('fokk-sync-blacklist', blacklist);
                featureHubModal.classList.add('hidden');
                showToast('Shield Settings Applied');
            };

            document.getElementById('btnAddWhitelist').onclick = () => {
                const dom = document.getElementById('inputWhitelist').value.trim().toLowerCase();
                if (dom && !whitelist.includes(dom)) {
                    whitelist.push(dom);
                    localStorage.setItem('fokk_shield_whitelist', JSON.stringify(whitelist));
                    ipcRenderer.send('fokk-sync-whitelist', whitelist);
                    renderShieldBody();
                    showToast(`Whitelisted: ${dom}`);
                }
            };

            document.getElementById('btnAddBlacklist').onclick = () => {
                const dom = document.getElementById('inputBlacklist').value.trim().toLowerCase();
                if (dom && !blacklist.includes(dom)) {
                    blacklist.push(dom);
                    localStorage.setItem('fokk_shield_blacklist', JSON.stringify(blacklist));
                    ipcRenderer.send('fokk-sync-blacklist', blacklist);
                    renderShieldBody();
                    showToast(`Blocked domain: ${dom}`);
                }
            };

            featureModalBody.querySelectorAll('.btn-remove-wl').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const d = btn.getAttribute('data-domain');
                    whitelist = whitelist.filter(x => x !== d);
                    localStorage.setItem('fokk_shield_whitelist', JSON.stringify(whitelist));
                    ipcRenderer.send('fokk-sync-whitelist', whitelist);
                    renderShieldBody();
                    showToast(`Removed from whitelist: ${d}`);
                };
            });

            featureModalBody.querySelectorAll('.btn-remove-bl').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const d = btn.getAttribute('data-domain');
                    blacklist = blacklist.filter(x => x !== d);
                    localStorage.setItem('fokk_shield_blacklist', JSON.stringify(blacklist));
                    ipcRenderer.send('fokk-sync-blacklist', blacklist);
                    renderShieldBody();
                    showToast(`Removed from blacklist: ${d}`);
                };
            });
        }

        renderShieldBody();

    } else if (hubId === 'media') {
        featureModalTitle.textContent = 'Media & Picture-in-Picture';
        featureModalBody.innerHTML = `
            <div class="modal-form-group">
                <label class="modal-form-label">Picture-in-Picture</label>
                <span class="modal-form-sub">Detach video on active tab into floating window</span>
                <button class="modal-btn" id="btnPopPiP">Pop Active Video to PiP</button>
            </div>
            <div class="modal-toggle-row">
                <div class="modal-toggle-text">
                    <div class="modal-toggle-title">Background Audio Playback</div>
                    <div class="modal-toggle-desc">Continue playing media when navigating between tabs</div>
                </div>
                <input type="checkbox" checked disabled>
            </div>
            <div class="modal-toggle-row">
                <div class="modal-toggle-text">
                    <div class="modal-toggle-title">Block Video Autoplay</div>
                    <div class="modal-toggle-desc">Prevent websites from playing audio-enabled videos automatically</div>
                </div>
                <input type="checkbox" checked>
            </div>
        `;

        document.getElementById('btnPopPiP').onclick = () => {
            const active = getActiveWebview();
            if (active) {
                active.executeJavaScript(`
                    const v = document.querySelector('video');
                    if (v && document.pictureInPictureEnabled) {
                        v.requestPictureInPicture().catch(e => console.log(e));
                    }
                `);
                showToast('Picture-in-Picture Triggered');
            }
            featureHubModal.classList.add('hidden');
        };

    } else if (hubId === 'privacy-policy') {
        featureHubModal.classList.add('hidden');
        createTab(uiPageUrl('fokk_privacy.html'));
        return;

    } else if (hubId === 'privacy') {
        featureModalTitle.textContent = 'Privacy Vault & Purge';
        featureModalBody.innerHTML = `
            <div class="modal-form-group">
                <label class="modal-form-label">Selective Data Purge</label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    <label style="display: flex; gap: 8px; font-size: 13px; color: #FFF;"><input type="checkbox" id="cHistory" checked> Browsing History & Favicons</label>
                    <label style="display: flex; gap: 8px; font-size: 13px; color: #FFF;"><input type="checkbox" id="cCookies" checked> Cookies & Site Permissions</label>
                    <label style="display: flex; gap: 8px; font-size: 13px; color: #FFF;"><input type="checkbox" id="cCache" checked> Cached Images & Files</label>
                    <label style="display: flex; gap: 8px; font-size: 13px; color: #FFF;"><input type="checkbox" id="cStorage" checked> LocalStorage & IndexedDB</label>
                </div>
            </div>
            <button class="modal-btn danger" id="btnPurgeNow" style="margin-top: 16px;">Purge Selected Data Now</button>

            <!-- AES-256 Encrypted Offline Vault Backup (Pro Feature) -->
            <div class="modal-form-group" style="margin-top: 22px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <label class="modal-form-label" style="margin:0;">AES-256 Offline Vault Backup</label>
                    <span style="background: rgba(0,229,255,0.15); color: #00E5FF; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">PRO ENCRYPTED</span>
                </div>
                <p style="font-size: 11.5px; line-height: 1.45; color: var(--text-secondary); margin-bottom: 12px;">Export or restore an encrypted (.fokkvault) backup of all your bookmarks, shortcuts, and settings with zero cloud dependency.</p>
                <div style="display: flex; gap: 8px;">
                    <button class="modal-btn" id="btnExportVault" style="flex: 1; font-size: 11.5px; padding: 6px 10px;">Export .fokkvault</button>
                    <button class="modal-btn secondary" id="btnImportVaultTrigger" style="flex: 1; font-size: 11.5px; padding: 6px 10px;">Import .fokkvault</button>
                    <input type="file" id="vaultFileInput" accept=".fokkvault,.json" style="display: none;">
                </div>
            </div>

            <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11.5px; color: var(--text-secondary);">Looking for our legal policy &amp; cautions?</span>
                <button class="modal-btn secondary" id="btnOpenPrivacyPolicyPage" style="font-size: 11px; padding: 4px 10px;">Read Privacy Policy</button>
            </div>
        `;

        const btnPrivacyDoc = document.getElementById('btnOpenPrivacyPolicyPage');
        if (btnPrivacyDoc) {
            btnPrivacyDoc.onclick = () => {
                featureHubModal.classList.add('hidden');
                createTab(uiPageUrl('fokk_privacy.html'));
            };
        }

        const btnExport = document.getElementById('btnExportVault');
        if (btnExport) {
            btnExport.onclick = async () => {
                const pass = prompt('Enter a password to encrypt your .fokkvault backup:');
                if (!pass) return;
                try {
                    await exportEncryptedVault(pass);
                    showToast('Encrypted vault exported successfully!');
                } catch (e) {
                    showToast('Vault export failed: ' + e.message);
                }
            };
        }

        const btnImportTrigger = document.getElementById('btnImportVaultTrigger');
        const vaultFileInput = document.getElementById('vaultFileInput');
        if (btnImportTrigger && vaultFileInput) {
            btnImportTrigger.onclick = () => vaultFileInput.click();
            vaultFileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const pass = prompt('Enter password to decrypt ' + file.name + ':');
                if (!pass) return;
                try {
                    const text = await file.text();
                    await importEncryptedVault(text, pass);
                    showToast('Encrypted vault restored successfully!');
                    featureHubModal.classList.add('hidden');
                } catch (err) {
                    alert('Decryption failed: incorrect password or corrupted file.');
                }
            };
        }

        document.getElementById('btnPurgeNow').onclick = async () => {
            const storages = [];
            if (document.getElementById('cCookies').checked) storages.push('cookies');
            if (document.getElementById('cCache').checked) storages.push('cache');
            if (document.getElementById('cStorage').checked) storages.push('localstorage', 'indexdb');

            if (document.getElementById('cHistory').checked) {
                localStorage.removeItem('fokk_browsing_history');
            }

            await ipcRenderer.invoke('fokk-clear-data', { storages });
            featureHubModal.classList.add('hidden');
            showToast('Browsing data cleared successfully');
        };

    } else if (hubId === 'scripts') {
        featureModalTitle.textContent = 'Script & Style Studio (Per-Site)';
        const activeWebview = getActiveWebview();
        let currentDomain = 'example.com';
        try {
            if (activeWebview && activeWebview.getURL) {
                const u = new URL(activeWebview.getURL());
                if (u.hostname) currentDomain = u.hostname;
            }
        } catch (_) {}

        let domainScripts = {};
        try { domainScripts = JSON.parse(localStorage.getItem('fokk_domain_scripts') || '{}'); } catch (_) {}
        const existing = domainScripts[currentDomain] || { css: '', js: '', enabled: true };

        featureModalBody.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <span style="font-size: 12px; color: var(--text-secondary);">Target Site: <strong style="color: #00E5FF;">${currentDomain}</strong></span>
                <span style="background: rgba(0,229,255,0.12); color: #00E5FF; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">PRO STUDIO</span>
            </div>
            <div class="modal-form-group">
                <label class="modal-form-label">Custom CSS (Auto-injected on ${currentDomain})</label>
                <textarea id="txtCustomCSS" class="modal-textarea" rows="3" placeholder="/* Custom CSS rules */">${existing.css || ''}</textarea>
            </div>
            <div class="modal-form-group" style="margin-top: 10px;">
                <label class="modal-form-label">Custom JavaScript (Evaluated on ${currentDomain})</label>
                <textarea id="txtCustomJS" class="modal-textarea" rows="3" placeholder="// Custom JavaScript logic">${existing.js || ''}</textarea>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #FFF; cursor: pointer;">
                    <input type="checkbox" id="chkAutoInject" ${existing.enabled !== false ? 'checked' : ''}> Persistent auto-inject
                </label>
                <div style="display: flex; gap: 8px;">
                    <button class="modal-btn secondary" id="btnTestInject">Run Once</button>
                    <button class="modal-btn" id="btnSaveScript">Save for ${currentDomain}</button>
                </div>
            </div>
        `;

        document.getElementById('btnTestInject').onclick = () => {
            const css = document.getElementById('txtCustomCSS').value;
            const js = document.getElementById('txtCustomJS').value;
            const active = getActiveWebview();
            if (active) {
                if (css) active.insertCSS(css);
                if (js) active.executeJavaScript(js);
                showToast('Styles & Scripts executed on active page');
            }
        };

        document.getElementById('btnSaveScript').onclick = () => {
            const css = document.getElementById('txtCustomCSS').value;
            const js = document.getElementById('txtCustomJS').value;
            const enabled = document.getElementById('chkAutoInject').checked;
            domainScripts[currentDomain] = { css, js, enabled };
            localStorage.setItem('fokk_domain_scripts', JSON.stringify(domainScripts));
            const active = getActiveWebview();
            if (active) {
                if (css) active.insertCSS(css);
                if (js) active.executeJavaScript(js);
            }
            featureHubModal.classList.add('hidden');
            showToast(`Persistent scripts saved for ${currentDomain}`);
        };

    } else if (hubId === 'visuals') {
        featureModalTitle.textContent = 'Visuals & 4K Sailboat Studio';
        const currentWp = localStorage.getItem('fokk_wallpaper_id') || 'sailboat';

        let html = `
            <div class="modal-form-group">
                <label class="modal-form-label">Pre-installed 4K Sailboat Wallpapers</label>
                <span class="modal-form-sub">Instant offline nautical backgrounds with zero network delay</span>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">
        `;

        PREINSTALLED_SAILBOATS.forEach(boat => {
            const isSel = boat.id === currentWp;
            html += `
                <div class="wp-thumb-card" data-id="${boat.id}" data-file="${boat.file}" style="background-image: url('${boat.file}'); height: 96px; border-radius: 8px; background-size: cover; background-position: center; border: 2px solid ${isSel ? 'var(--fokk-cyan)' : 'transparent'}; cursor: pointer; position: relative; display: flex; align-items: flex-end; padding: 6px;">
                    <span style="background: rgba(0,0,0,0.65); padding: 2px 6px; border-radius: 4px; font-size: 10.5px; color: #FFF; font-weight: 600;">${boat.name}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
            <button class="modal-btn secondary" id="btnUploadCustomWp" style="width: 100%; margin-top: 12px;">Upload Custom Image from Computer</button>
        `;

        featureModalBody.innerHTML = html;

        featureModalBody.querySelectorAll('.wp-thumb-card').forEach(card => {
            card.onclick = () => {
                const id = card.getAttribute('data-id');
                const file = card.getAttribute('data-file');
                try {
                    localStorage.setItem('fokk_wallpaper_id', id);
                    localStorage.removeItem('fokk_custom_wallpaper');
                } catch (_) {}

                // Notify all active start pages to update instantly and persist in webview session
                tabs.forEach(t => {
                    t.webview.executeJavaScript(`
                        try {
                            localStorage.setItem('fokk_wallpaper_id', '${id}');
                            localStorage.removeItem('fokk_custom_wallpaper');
                        } catch (_) {}
                        if (typeof window.setWallpaper === 'function') {
                            window.setWallpaper({ id: '${id}', url: '${file}' });
                        } else {
                            const bg = document.getElementById('wallpaperBg');
                            if (bg) bg.style.backgroundImage = 'url("${file}")';
                        }
                    `).catch(() => {});
                });

                featureHubModal.classList.add('hidden');
                showToast(`Wallpaper applied: ${card.querySelector('span').textContent}`);
            };
        });

        document.getElementById('btnUploadCustomWp').onclick = async () => {
            const dataUrl = await ipcRenderer.invoke('fokk-pick-wallpaper');
            if (dataUrl) {
                try {
                    localStorage.setItem('fokk_custom_wallpaper', dataUrl);
                    localStorage.removeItem('fokk_wallpaper_id');
                } catch (_) {}

                tabs.forEach(t => {
                    t.webview.executeJavaScript(`
                        try {
                            localStorage.setItem('fokk_custom_wallpaper', ${JSON.stringify(dataUrl)});
                            localStorage.removeItem('fokk_wallpaper_id');
                        } catch (_) {}
                        if (typeof window.setWallpaper === 'function') {
                            window.setWallpaper(${JSON.stringify(dataUrl)});
                        } else {
                            const bg = document.getElementById('wallpaperBg');
                            if (bg) bg.style.backgroundImage = 'url("' + ${JSON.stringify(dataUrl)} + '")';
                        }
                    `).catch(() => {});
                });
                featureHubModal.classList.add('hidden');
                showToast('Custom Wallpaper uploaded and applied');
            }
        };

    } else if (hubId === 'fundraising') {
        featureHubModal.classList.add('hidden');
        createTab(uiPageUrl('fokk_contributing.html'));
        return;

    } else if (hubId === 'license') {
        featureHubModal.classList.add('hidden');
        createTab(uiPageUrl('fokk_license.html'));
        return;

    } else if (hubId === 'about') {
        featureHubModal.classList.add('hidden');
        createTab(uiPageUrl('fokk_about.html'));
        return;
    }

    featureHubModal.classList.remove('hidden');
}

if (btnCloseFeatureModal) {
    btnCloseFeatureModal.onclick = () => featureHubModal.classList.add('hidden');
}
if (featureHubModal) {
    featureHubModal.onclick = (e) => {
        if (e.target === featureHubModal) featureHubModal.classList.add('hidden');
    };
}

// 6. Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (commandHudModal && !commandHudModal.classList.contains('hidden')) {
            closeCommandHud();
            return;
        }
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            if (commandHudModal && !commandHudModal.classList.contains('hidden')) {
                closeCommandHud();
            } else {
                openCommandHud();
            }
        } else if ((e.shiftKey && (e.key === 'd' || e.key === 'D')) || e.key === '\\') {
            e.preventDefault();
            toggleSplitView();
        } else if (e.shiftKey && (e.key === 'p' || e.key === 'P')) {
            e.preventDefault();
            createTab(START_PAGE_URL, { isPrivate: true });
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            const active = getActiveWebview();
            if (active && typeof active.isAudioMuted === 'function') {
                const muted = active.isAudioMuted();
                active.setAudioMuted(!muted);
                showToast(!muted ? 'Audio Muted' : 'Audio Unmuted');
            }
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            createTab(START_PAGE_URL);
        } else if (e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            if (activeTabId) closeTab(activeTabId);
        } else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            btnReload.click();
        } else if (e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            urlInput.focus();
            urlInput.select();
        } else if (e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            if (btnBookmarkOmni) btnBookmarkOmni.click();
        } else if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            if (btnZoomIn) btnZoomIn.click();
        } else if (e.key === '-') {
            e.preventDefault();
            if (btnZoomOut) btnZoomOut.click();
        }
    }
});

// Real-time Targeted Block Event Handler (deduplicated per tab)
ipcRenderer.on('fokk-blocked-item', (event, data) => {
    if (!data || !data.url) return;
    let targetTab = null;
    if (data.webContentsId) {
        targetTab = tabs.find(t => {
            try {
                return t.webview && typeof t.webview.getWebContentsId === 'function' && t.webview.getWebContentsId() === data.webContentsId;
            } catch (_) { return false; }
        });
    }
    if (!targetTab) {
        targetTab = tabs.find(t => t.id === activeTabId);
    }
    if (!targetTab) return;

    if (!targetTab.blockedUrls) targetTab.blockedUrls = new Set();

    let key = data.url;
    try {
        const u = new URL(data.url);
        key = u.origin + u.pathname;
    } catch (_) {}

    if (!targetTab.blockedUrls.has(key)) {
        targetTab.blockedUrls.add(key);
        targetTab.blockedCount = targetTab.blockedUrls.size;
        if (targetTab.id === activeTabId && shieldCountText) {
            const currentUrl = (typeof targetTab.webview.getURL === 'function' ? targetTab.webview.getURL() : '') || '';
            shieldCountText.textContent = currentUrl.startsWith('http') ? String(targetTab.blockedCount) : '0';
        }
    }
});

// Real-time Global AdBlock Stats from Electron Main Process
ipcRenderer.on('fokk-stats-updated', (event, stats) => {
    const active = tabs.find(t => t.id === activeTabId);
    if (active && active.webview) {
        const u = (typeof active.webview.getURL === 'function' ? active.webview.getURL() : '') || '';
        if (!u.startsWith('http')) {
            active.blockedCount = 0;
            if (shieldCountText) shieldCountText.textContent = '0';
        }
    }
});

// ==========================================================================
// Fokk Shield Tunnel (Privacy VPN & Relay) UI Controller
// ==========================================================================
const btnVpnToggle = document.getElementById('btnVpnToggle');
const vpnStatusDot = document.getElementById('vpnStatusDot');
const vpnPopover = document.getElementById('vpnPopover');
const vpnStatusPill = document.getElementById('vpnStatusPill');
const vpnRadarRing = document.getElementById('vpnRadarRing');
const btnVpnPower = document.getElementById('btnVpnPower');
const vpnPowerLabel = document.getElementById('vpnPowerLabel');
const vpnPowerSub = document.getElementById('vpnPowerSub');
const vpnMetricIp = document.getElementById('vpnMetricIp');
const vpnMetricLocation = document.getElementById('vpnMetricLocation');
const vpnMetricProtocol = document.getElementById('vpnMetricProtocol');
const vpnMetricPing = document.getElementById('vpnMetricPing');
const vpnProtocolPicker = document.getElementById('vpnProtocolPicker');
const vpnCustomConfigWrap = document.getElementById('vpnCustomConfigWrap');
const vpnCustomInput = document.getElementById('vpnCustomInput');
const btnSaveCustomVpn = document.getElementById('btnSaveCustomVpn');
const vpnKillSwitchCheck = document.getElementById('vpnKillSwitchCheck');

function renderProtocolPicker(locations, activeMode) {
    if (!vpnProtocolPicker || !Array.isArray(locations)) return;
    vpnProtocolPicker.innerHTML = locations.map(loc => {
        const isActive = loc.id === activeMode;
        return `
            <div class="vpn-proto-card ${isActive ? 'active' : ''}" data-mode="${loc.id}">
                <div class="vpn-proto-icon-box" style="background: ${loc.color}15; border: 1px solid ${loc.color}30;">
                    ${loc.iconSvg || ''}
                </div>
                <div class="vpn-proto-body">
                    <div class="vpn-proto-name-row">
                        <span class="vpn-proto-name">${loc.name}</span>
                        <span class="vpn-proto-badge" style="background: ${loc.color}20; color: ${loc.color}; border: 1px solid ${loc.color}40;">${loc.badge || 'PRO'}</span>
                    </div>
                    <div class="vpn-proto-desc">${loc.description || loc.protocol}</div>
                </div>
                <div class="vpn-proto-radio">
                    <span class="vpn-proto-radio-dot"></span>
                </div>
            </div>
        `;
    }).join('');

    // Wire clicks on each protocol card
    vpnProtocolPicker.querySelectorAll('.vpn-proto-card').forEach(card => {
        card.addEventListener('click', async () => {
            const modeId = card.getAttribute('data-mode');
            if (!modeId) return;

            vpnProtocolPicker.querySelectorAll('.vpn-proto-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            if (vpnCustomConfigWrap) {
                const isCustom = modeId === 'custom';
                vpnCustomConfigWrap.classList.toggle('hidden', !isCustom);
                if (isCustom && vpnCustomInput) {
                    setTimeout(() => vpnCustomInput.focus(), 60);
                }
            }

            try {
                await ipcRenderer.invoke('fokk-vpn-set-mode', modeId);
                if (modeId === 'tor') {
                    showToast('Stealth Onion Relay: 100% Zero-Config Built-In');
                } else if (modeId === 'warp') {
                    showToast('Cloudflare WARP: WireGuard on port 40001');
                } else if (modeId === 'auto') {
                    showToast('Auto Anycast Relay: Auto-detects fastest path');
                } else {
                    showToast('Custom Relay: Enter your proxy or WireGuard config');
                }
            } catch (_) {}
        });
    });
}

function updateVpnUI(status) {
    if (!status) return;

    const state = status.state || 'disconnected';
    const isConn = state === 'connected';
    const isConnecting = state === 'connecting';
    const isErr = state === 'error';

    // 1. Toolbar Status Dot & Active State
    if (vpnStatusDot) {
        vpnStatusDot.className = 'vpn-status-dot ' + state;
    }
    if (btnVpnToggle) {
        btnVpnToggle.classList.toggle('active', isConn || (vpnPopover && !vpnPopover.classList.contains('hidden')));
        btnVpnToggle.title = isConn
            ? `Fokk Shield Tunnel: Connected (${status.virtualCountry || 'Anycast'})`
            : isConnecting
            ? 'Fokk Shield Tunnel: Connecting...'
            : 'Fokk Shield Tunnel — Zero-Log Privacy VPN';
    }

    // 2. Popover Status Pill
    if (vpnStatusPill) {
        vpnStatusPill.className = 'vpn-status-pill ' + state;
        vpnStatusPill.textContent = isConn ? 'Protected' : isConnecting ? 'Connecting...' : isErr ? 'No Relay' : 'Disconnected';
    }

    // 3. Power Button & Radar Ring
    if (btnVpnPower) {
        btnVpnPower.className = 'vpn-power-btn ' + state;
    }
    if (vpnRadarRing) {
        vpnRadarRing.className = 'vpn-radar-ring ' + state;
    }
    if (vpnPowerLabel) {
        if (isErr && status.errorMessage) {
            let errorHtml = `<span style="color:#F87171;font-size:11px;display:block;text-align:center;line-height:1.4;margin-bottom:6px;">${status.errorMessage}</span>`;
            if (status.activeMode === 'warp') {
                errorHtml += `<button id="btnQuickSwitchOnion" style="background:#7C3AED;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;margin-top:2px;">Switch to Built-in Stealth Onion</button>`;
            } else if (status.activeMode === 'custom' && (!status.customConfig || !status.customConfig.trim())) {
                errorHtml += `<button id="btnFocusCustomInput" style="background:#10B981;color:#000;border:none;border-radius:6px;padding:4px 10px;font-size:10.5px;font-weight:700;cursor:pointer;margin-top:2px;">Paste Proxy Below</button>`;
            }
            vpnPowerLabel.innerHTML = errorHtml;

            const btnSwitch = document.getElementById('btnQuickSwitchOnion');
            if (btnSwitch) {
                btnSwitch.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await ipcRenderer.invoke('fokk-vpn-set-mode', 'tor');
                    await ipcRenderer.invoke('fokk-vpn-toggle');
                });
            }
            const btnFocus = document.getElementById('btnFocusCustomInput');
            if (btnFocus) {
                btnFocus.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (vpnCustomInput) vpnCustomInput.focus();
                });
            }
        } else {
            vpnPowerLabel.textContent = isConn ? 'Connected — Tunnel Active' : isConnecting ? 'Detecting Relay...' : 'Tap to Connect';
        }
    }
    if (vpnPowerSub) {
        vpnPowerSub.textContent = isConn 
            ? 'Encrypted Multi-Hop Relay Active'
            : isConnecting 
            ? 'Establishing Onion Circuit...'
            : 'Zero-Cost Stealth Privacy';
    }

    // 4. Metrics
    if (vpnMetricIp) {
        vpnMetricIp.textContent = status.virtualIp || (isConn ? '100% Masked' : 'Direct (Real IP Exposed)');
        vpnMetricIp.className = 'metric-val ' + (isConn ? 'masked' : isConnecting ? 'connecting' : 'unmasked');
    }
    if (vpnMetricLocation) vpnMetricLocation.textContent = status.virtualCountry || status.location?.region || 'Local Direct';
    if (vpnMetricProtocol) vpnMetricProtocol.textContent = status.location?.protocol || 'Tor Onion Routing';
    if (vpnMetricPing) vpnMetricPing.textContent = (status.ping || 0) + ' ms';

    // 5. Active Protocol Card Selection
    if (vpnProtocolPicker && status.activeMode) {
        vpnProtocolPicker.querySelectorAll('.vpn-proto-card').forEach(card => {
            const matches = card.getAttribute('data-mode') === status.activeMode;
            card.classList.toggle('active', matches);
        });
    }

    if (vpnCustomConfigWrap) {
        vpnCustomConfigWrap.classList.toggle('hidden', status.activeMode !== 'custom');
    }
    if (vpnCustomInput && status.customConfig && !vpnCustomInput.value) {
        vpnCustomInput.value = status.customConfig;
    }

    // 6. Kill Switch
    if (vpnKillSwitchCheck && typeof status.killSwitch === 'boolean') {
        vpnKillSwitchCheck.checked = status.killSwitch;
    }
}

function initVpnUI() {
    let initialStatus = null;
    let locations = [];
    try {
        initialStatus = ipcRenderer.sendSync('fokk-vpn-get-status');
        locations = ipcRenderer.sendSync('fokk-vpn-get-locations');
    } catch (_) {}

    // Populate Luxury Protocol Picker Cards (ZERO EMOJIS)
    if (Array.isArray(locations) && locations.length > 0) {
        renderProtocolPicker(locations, initialStatus ? initialStatus.activeMode : 'tor');
    }

    if (initialStatus) {
        updateVpnUI(initialStatus);
    }

    // Toggle Popover Visibility
    if (btnVpnToggle && vpnPopover) {
        btnVpnToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = vpnPopover.classList.contains('hidden');
            vpnPopover.classList.toggle('hidden');
            btnVpnToggle.classList.toggle('active', willOpen);
            if (desktopBrowserMenu) desktopBrowserMenu.classList.add('hidden');
            if (omniboxEngineDropdown) omniboxEngineDropdown.classList.add('hidden');
        });
    }

    if (window.process && window.process.argv && window.process.argv.includes('--open-vpn-popover')) {
        setTimeout(() => {
            if (vpnPopover && btnVpnToggle) {
                vpnPopover.classList.remove('hidden');
                btnVpnToggle.classList.add('active');
            }
        }, 350);
    }

    // Connect / Disconnect Power Button
    if (btnVpnPower) {
        btnVpnPower.addEventListener('click', async () => {
            // Auto-save custom proxy if typed in textarea
            if (vpnCustomConfigWrap && !vpnCustomConfigWrap.classList.contains('hidden') && vpnCustomInput) {
                const text = vpnCustomInput.value.trim();
                if (text) {
                    try { await ipcRenderer.invoke('fokk-vpn-set-custom', text); } catch (_) {}
                }
            }

            if (vpnPowerLabel) vpnPowerLabel.textContent = 'Routing...';
            if (vpnRadarRing) vpnRadarRing.className = 'vpn-radar-ring connecting';
            try {
                const res = await ipcRenderer.invoke('fokk-vpn-toggle');
                const newStatus = (res && res.status) ? res.status : ipcRenderer.sendSync('fokk-vpn-get-status');
                if (newStatus) {
                    updateVpnUI(newStatus);
                    if (newStatus.state === 'connected') {
                        showToast(`Tunnel Connected: ${newStatus.virtualCountry || 'Encrypted'}`);
                    } else if (newStatus.state === 'error' && newStatus.errorMessage) {
                        showToast(newStatus.errorMessage);
                    } else {
                        showToast('Tunnel Disconnected (Direct Traffic)');
                    }
                }
            } catch (err) {
                try {
                    const cur = ipcRenderer.sendSync('fokk-vpn-get-status');
                    if (cur) updateVpnUI(cur);
                } catch (_) {}
                showToast('VPN Error: ' + err.message);
            }
        });
    }

    // Save Custom Config
    if (btnSaveCustomVpn && vpnCustomInput) {
        btnSaveCustomVpn.addEventListener('click', async () => {
            const cfg = vpnCustomInput.value.trim();
            if (!cfg) {
                showToast('Please paste a WireGuard config or SOCKS5 URL');
                return;
            }
            try {
                await ipcRenderer.invoke('fokk-vpn-set-custom', cfg);
                showToast('Custom Relay Config Saved: ' + cfg);
            } catch (_) {}
        });
    }

    // Custom Preset Chips
    if (vpnCustomConfigWrap && vpnCustomInput) {
        vpnCustomConfigWrap.querySelectorAll('.vpn-chip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const val = btn.getAttribute('data-val');
                if (val) {
                    vpnCustomInput.value = val;
                    ipcRenderer.invoke('fokk-vpn-set-custom', val).catch(() => {});
                    showToast('Preset loaded: ' + val);
                }
            });
        });
    }

    // Kill Switch Toggle
    if (vpnKillSwitchCheck) {
        vpnKillSwitchCheck.addEventListener('change', async (e) => {
            try {
                await ipcRenderer.invoke('fokk-vpn-set-killswitch', e.target.checked);
                showToast(e.target.checked ? 'Kill-Switch Enabled' : 'Kill-Switch Disabled');
            } catch (_) {}
        });
    }

    // Listen to real-time status broadcasts from Main process
    ipcRenderer.on('fokk-vpn-status-changed', (event, status) => {
        updateVpnUI(status);
    });
}
initVpnUI();

// ==========================================================================
// 7. Universal Command HUD (Ctrl+K Spotlight Launcher)
// ==========================================================================
const btnCommandHud = document.getElementById('btnCommandHud');
const commandHudModal = document.getElementById('commandHudModal');
const commandHudInput = document.getElementById('commandHudInput');
const commandHudList = document.getElementById('commandHudList');

let activeHudIndex = 0;
let currentHudItems = [];

const COMMAND_HUD_REGISTRY = [
    {
        id: 'cmd-vpn',
        category: 'Privacy & Security',
        title: 'Toggle Privacy Tunnel (VPN)',
        sub: 'Connect or disconnect Tor & WARP stealth relay',
        shortcut: 'Shift+V',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="12" r="3"/></svg>',
        action: () => { if (btnVpnToggle) btnVpnToggle.click(); }
    },
    {
        id: 'cmd-split',
        category: 'Productivity',
        title: 'Split View / Dual Browsing',
        sub: 'Browse two tabs side-by-side with resizable divider',
        shortcut: 'Ctrl+Shift+D',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
        action: () => { toggleSplitView(); }
    },
    {
        id: 'cmd-quad',
        category: 'Productivity',
        title: 'Quad Multi-Split (2x2 Power Grid)',
        sub: 'Browse 4 active screens simultaneously in a 2x2 grid (Pro)',
        shortcut: 'Shift+Q',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        action: () => { toggleQuadMode(); }
    },
    {
        id: 'cmd-burn',
        category: 'Privacy & Security',
        title: 'Burn Session',
        sub: 'Immediately purge all cookies, cache, and browsing traces',
        shortcut: 'Ctrl+Shift+Del',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF5252" stroke-width="2.2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
        action: () => { if (btnBurnSession) btnBurnSession.click(); }
    },
    {
        id: 'cmd-incognito',
        category: 'Privacy & Security',
        title: 'Open Incognito Stealth Tab',
        sub: 'Private browsing with zero history, cache, or persistent cookies',
        shortcut: 'Ctrl+Shift+P',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 11.5 L7.8 4.8 C8.2 3.8 9.5 3.8 12 3.8 C14.5 3.8 15.8 3.8 16.2 4.8 L18 11.5 Z" fill="#C084FC"/><path d="M2.5 12 C6.5 10.5 17.5 10.5 21.5 12" stroke="#C084FC" stroke-width="2.2"/><circle cx="8" cy="16.5" r="2.8" stroke="#C084FC" stroke-width="2"/><circle cx="16" cy="16.5" r="2.8" stroke="#C084FC" stroke-width="2"/></svg>',
        action: () => { createTab(START_PAGE_URL, { isPrivate: true }); }
    },
    {
        id: 'cmd-sleep',
        category: 'Performance',
        title: 'Hibernate Inactive Tabs',
        sub: 'Free up to 80% RAM by putting idle tabs into sleep mode',
        shortcut: 'Eco Mode',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
        action: () => { hibernateAllInactiveTabs(); }
    },
    {
        id: 'cmd-reader',
        category: 'Productivity',
        title: 'Toggle Reader Mode',
        sub: 'Distraction-free article reading with clean typography',
        shortcut: 'Ctrl+Alt+R',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        action: () => { if (btnReaderMode) btnReaderMode.click(); }
    },
    {
        id: 'cmd-wallpapers',
        category: 'Customization',
        title: 'Visual Studio & 4K Wallpapers',
        sub: 'Customize coastal sailboat background or upload personal wallpapers',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
        action: () => { if (btnVisuals) btnVisuals.click(); }
    },
    {
        id: 'cmd-downloads',
        category: 'Feature Hubs',
        title: 'Downloads Manager',
        sub: 'Inspect download progress and open finished files',
        shortcut: 'Ctrl+J',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        action: () => { openFeatureHub('downloads'); }
    },
    {
        id: 'cmd-bookmarks',
        category: 'Feature Hubs',
        title: 'Bookmarks Library',
        sub: 'View and manage all saved bookmarks and folders',
        shortcut: 'Ctrl+B',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
        action: () => { openFeatureHub('bookmarks'); }
    },
    {
        id: 'cmd-history',
        category: 'Feature Hubs',
        title: 'Browsing History',
        sub: 'Search visited pages or clear timeline records',
        shortcut: 'Ctrl+H',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        action: () => { openFeatureHub('history'); }
    },
    {
        id: 'cmd-shield',
        category: 'Feature Hubs',
        title: 'AdShield & Tracker Telemetry',
        sub: 'View live blocked ad trackers, scripts, and DoH status',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
        action: () => { openFeatureHub('shield'); }
    },
    {
        id: 'cmd-mute',
        category: 'Quick Commands',
        title: 'Mute / Unmute Current Audio',
        sub: 'Silence background audio playback instantly',
        shortcut: 'Ctrl+M',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
        action: () => {
            const active = getActiveWebview();
            if (active && typeof active.isAudioMuted === 'function') {
                const isMuted = active.isAudioMuted();
                active.setAudioMuted(!isMuted);
                showToast(!isMuted ? 'Audio Muted' : 'Audio Unmuted');
            }
        }
    },
    {
        id: 'cmd-about',
        category: 'Information & Legal',
        title: 'About Fokk Browser',
        sub: 'App specifications, mission, architecture & team',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        action: () => { createTab(uiPageUrl('fokk_about.html')); }
    },
    {
        id: 'cmd-contributing',
        category: 'Information & Legal',
        title: 'Fokk Pro ($4.79/mo) & Contributing',
        sub: 'Sustainable zero-ad model, offline license & support',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        action: () => { createTab(uiPageUrl('fokk_contributing.html')); }
    },
    {
        id: 'cmd-license',
        category: 'Information & Legal',
        title: 'License & Open Source Notice',
        sub: 'MIT license, third-party component licenses & rights',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
        action: () => { createTab(uiPageUrl('fokk_license.html')); }
    },
    {
        id: 'cmd-privacy-doc',
        category: 'Information & Legal',
        title: 'Privacy Policy & Cautions',
        sub: 'Zero-data policy, disclaimers, cautions & user rights',
        shortcut: '',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        action: () => { createTab(uiPageUrl('fokk_privacy.html')); }
    }
];

function openCommandHud() {
    if (!commandHudModal) return;
    commandHudModal.classList.remove('hidden');
    if (commandHudInput) {
        commandHudInput.value = '';
        setTimeout(() => commandHudInput.focus(), 30);
    }
    activeHudIndex = 0;
    renderCommandHudItems('');
}

function closeCommandHud() {
    if (!commandHudModal) return;
    commandHudModal.classList.add('hidden');
}

function renderCommandHudItems(queryText) {
    if (!commandHudList) return;
    const query = (queryText || '').toLowerCase().trim();

    // 1. Filter Built-in Commands
    const matchedCommands = COMMAND_HUD_REGISTRY.filter(c => 
        !query || c.title.toLowerCase().includes(query) || c.sub.toLowerCase().includes(query) || c.category.toLowerCase().includes(query)
    ).map(c => ({
        type: 'command',
        title: c.title,
        sub: c.sub,
        category: c.category,
        shortcut: c.shortcut,
        iconSvg: c.iconSvg,
        action: c.action
    }));

    // 2. Filter Open Tabs
    const matchedTabs = tabs.filter(t => {
        const title = (t.el.querySelector('.tab-title') ? t.el.querySelector('.tab-title').textContent : '').toLowerCase();
        const url = (t.webview.getURL ? t.webview.getURL() : '').toLowerCase();
        return query && (title.includes(query) || url.includes(query));
    }).map(t => ({
        type: 'tab',
        title: t.el.querySelector('.tab-title') ? t.el.querySelector('.tab-title').textContent : 'Tab',
        sub: t.webview.getURL ? t.webview.getURL() : '',
        category: 'Open Tabs',
        shortcut: 'Switch Tab',
        iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
        action: () => { activateTab(t.id); }
    }));

    // 3. Filter Bookmarks
    let matchedBookmarks = [];
    if (query) {
        try {
            const bms = JSON.parse(localStorage.getItem('fokk_bookmarks') || '[]');
            matchedBookmarks = bms.filter(b => 
                (b.title || '').toLowerCase().includes(query) || (b.url || '').toLowerCase().includes(query)
            ).slice(0, 5).map(b => ({
                type: 'bookmark',
                title: b.title || b.url,
                sub: b.url,
                category: 'Bookmarks',
                shortcut: 'Open Bookmark',
                iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
                action: () => { loadUrlInActiveTab(b.url); }
            }));
        } catch (_) {}
    }

    currentHudItems = [...matchedTabs, ...matchedCommands, ...matchedBookmarks];

    if (currentHudItems.length === 0) {
        commandHudList.innerHTML = `
            <div style="padding: 24px; text-align: center; color: #64748B; font-size: 13.5px;">
                No commands, tabs, or bookmarks found matching "${queryText}"
            </div>
        `;
        return;
    }

    activeHudIndex = Math.max(0, Math.min(activeHudIndex, currentHudItems.length - 1));

    let html = '';
    let lastCategory = '';
    currentHudItems.forEach((item, idx) => {
        if (item.category !== lastCategory) {
            html += `<div class="command-hud-category-label">${item.category}</div>`;
            lastCategory = item.category;
        }
        const isActive = idx === activeHudIndex;
        html += `
            <div class="command-hud-item ${isActive ? 'active' : ''}" data-index="${idx}">
                <div class="hud-item-left">
                    <div class="hud-item-icon">${item.iconSvg}</div>
                    <div>
                        <span class="hud-item-title">${item.title}</span>
                        ${item.sub ? `<span class="hud-item-sub">${item.sub}</span>` : ''}
                    </div>
                </div>
                ${item.shortcut ? `<span class="hud-item-shortcut">${item.shortcut}</span>` : ''}
            </div>
        `;
    });

    commandHudList.innerHTML = html;

    commandHudList.querySelectorAll('.command-hud-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'), 10);
            if (currentHudItems[idx]) {
                closeCommandHud();
                currentHudItems[idx].action();
            }
        });
    });
}

function updateHudSelection() {
    const items = commandHudList ? commandHudList.querySelectorAll('.command-hud-item') : [];
    items.forEach((it, idx) => {
        if (idx === activeHudIndex) {
            it.classList.add('active');
            try { it.scrollIntoView({ block: 'nearest' }); } catch (_) {}
        } else {
            it.classList.remove('active');
        }
    });
}

if (btnCommandHud) {
    btnCommandHud.addEventListener('click', (e) => {
        e.preventDefault();
        openCommandHud();
    });
}

if (commandHudModal) {
    commandHudModal.addEventListener('click', (e) => {
        if (e.target === commandHudModal) closeCommandHud();
    });
}

if (commandHudInput) {
    commandHudInput.addEventListener('input', (e) => {
        activeHudIndex = 0;
        renderCommandHudItems(e.target.value);
    });

    commandHudInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentHudItems.length > 0) {
                activeHudIndex = (activeHudIndex + 1) % currentHudItems.length;
                updateHudSelection();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentHudItems.length > 0) {
                activeHudIndex = (activeHudIndex - 1 + currentHudItems.length) % currentHudItems.length;
                updateHudSelection();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentHudItems[activeHudIndex]) {
                const item = currentHudItems[activeHudIndex];
                closeCommandHud();
                item.action();
            }
        }
    });
}

// ==========================================================================
// 8. Dual Split View Browsing
// ==========================================================================
const btnSplitView = document.getElementById('btnSplitView');
const splitDivider = document.getElementById('splitDivider');
let isSplitViewActive = false;
let splitSecondaryTabId = null;
let splitRatio = 0.5;

function toggleSplitView() {
    if (isQuadViewActive) {
        toggleQuadMode();
    }
    isSplitViewActive = !isSplitViewActive;
    if (btnSplitView) btnSplitView.classList.toggle('active', isSplitViewActive);

    if (!isSplitViewActive) {
        viewsContainer.classList.remove('split-view-active');
        if (splitDivider) splitDivider.classList.add('hidden');
        splitSecondaryTabId = null;
        document.querySelectorAll('.split-pane-header').forEach(h => h.remove());
        tabs.forEach(t => {
            t.webview.style.width = '';
            t.webview.classList.remove('split-primary', 'split-secondary');
            t.webview.style.display = t.id === activeTabId ? 'flex' : 'none';
        });
        showToast('Split View Disabled');
        return;
    }

    viewsContainer.classList.add('split-view-active');
    if (splitDivider) splitDivider.classList.remove('hidden');

    if (tabs.length < 2) {
        const curActive = activeTabId;
        createTab(START_PAGE_URL);
        activeTabId = curActive;
    }

    const other = tabs.find(t => t.id !== activeTabId);
    if (other) {
        splitSecondaryTabId = other.id;
    }

    updateSplitLayout();
    showToast('Split View Active (Side-by-Side Dual Browsing)');
}

function updateSplitLayout() {
    if (!isSplitViewActive) return;
    const primary = tabs.find(t => t.id === activeTabId);
    let secondary = tabs.find(t => t.id === splitSecondaryTabId);
    if (!secondary || secondary === primary) {
        secondary = tabs.find(t => t.id !== activeTabId);
        if (secondary) splitSecondaryTabId = secondary.id;
    }

    tabs.forEach(t => {
        if (t === primary) {
            t.webview.style.display = 'flex';
            t.webview.style.width = `calc(${splitRatio * 100}% - 3px)`;
            t.webview.classList.add('split-primary');
            t.webview.classList.remove('split-secondary');
        } else if (t === secondary) {
            t.webview.style.display = 'flex';
            t.webview.style.width = `calc(${(1 - splitRatio) * 100}% - 3px)`;
            t.webview.classList.add('split-secondary');
            t.webview.classList.remove('split-primary');
        } else {
            t.webview.style.display = 'none';
            t.webview.style.width = '';
            t.webview.classList.remove('split-primary', 'split-secondary');
        }
    });

    // Update / inject pane headers
    renderSplitPaneHeaders(primary, secondary);
}

function renderSplitPaneHeaders(primary, secondary) {
    // Remove old headers
    document.querySelectorAll('.split-pane-header').forEach(h => h.remove());

    function makePaneHeader(tab, isPrimary) {
        if (!tab || !tab.webview) return;
        const existing = tab.webview.previousElementSibling;
        if (existing && existing.classList.contains('split-pane-header')) existing.remove();

        let currentUrl = '';
        try { currentUrl = tab.webview.getURL ? tab.webview.getURL() : ''; } catch (_) {}
        let displayUrl = currentUrl || 'New Tab';
        try { displayUrl = new URL(currentUrl).hostname || 'New Tab'; } catch (_) {}

        const header = document.createElement('div');
        header.className = 'split-pane-header';
        header.dataset.pane = isPrimary ? 'primary' : 'secondary';
        if (isPrimary) {
            header.style.left = '0';
            header.style.width = `calc(${splitRatio * 100}% - 3px)`;
            header.style.right = 'auto';
        } else {
            header.style.left = `calc(${splitRatio * 100}% + 3px)`;
            header.style.width = `calc(${(1 - splitRatio) * 100}% - 3px)`;
            header.style.right = '0';
        }

        header.innerHTML = `
            <div class="split-pane-info">
                <span class="split-pane-badge">${isPrimary ? 'Left Pane' : 'Right Pane'}</span>
                <span class="split-pane-url" title="${currentUrl}">${displayUrl}</span>
            </div>
            <div class="split-pane-actions">
                <button class="split-pane-btn btn-toggle-quad" title="Switch to Quad 4-Pane Grid (Pro)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </button>
                <button class="split-pane-btn btn-swap-panes" title="Swap Left and Right Sides">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/></svg>
                </button>
                <button class="split-pane-btn btn-focus-pane" title="Keep Only This Pane (Exit Split View)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
                <button class="split-pane-btn btn-close-pane" title="Close This Tab &amp; Keep Other">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        // Insert header just before the webview in its parent
        viewsContainer.insertBefore(header, tab.webview);

        // 0. Toggle Quad Mode (Pro)
        const btnQuad = header.querySelector('.btn-toggle-quad');
        if (btnQuad) {
            btnQuad.onclick = () => {
                toggleQuadMode();
            };
        }

        // 1. Swap Panes
        header.querySelector('.btn-swap-panes').onclick = () => {
            if (!isSplitViewActive) return;
            const oldActive = activeTabId;
            activeTabId = splitSecondaryTabId;
            splitSecondaryTabId = oldActive;
            updateSplitLayout();
            showToast('Panes swapped');
        };

        // 2. Keep Only This Pane (Full Window, exit split without closing other tab)
        header.querySelector('.btn-focus-pane').onclick = () => {
            activeTabId = tab.id;
            isSplitViewActive = false;
            if (btnSplitView) btnSplitView.classList.remove('active');
            viewsContainer.classList.remove('split-view-active');
            if (splitDivider) splitDivider.classList.add('hidden');
            document.querySelectorAll('.split-pane-header').forEach(h => h.remove());
            tabs.forEach(t => {
                t.webview.style.width = '';
                t.webview.classList.remove('split-primary', 'split-secondary');
                t.webview.style.display = t.id === activeTabId ? 'flex' : 'none';
            });
            showToast(`Focused on ${displayUrl}`);
        };

        // 3. Close This Tab completely (other tab takes over full window)
        header.querySelector('.btn-close-pane').onclick = () => {
            const closingId = tab.id;
            const otherTab = isPrimary ? secondary : primary;
            if (otherTab) {
                activeTabId = otherTab.id;
            }
            isSplitViewActive = false;
            if (btnSplitView) btnSplitView.classList.remove('active');
            viewsContainer.classList.remove('split-view-active');
            if (splitDivider) splitDivider.classList.add('hidden');
            document.querySelectorAll('.split-pane-header').forEach(h => h.remove());
            tabs.forEach(t => {
                t.webview.style.width = '';
                t.webview.classList.remove('split-primary', 'split-secondary');
                t.webview.style.display = t.id === activeTabId ? 'flex' : 'none';
            });
            closeTab(closingId);
            showToast('Closed split pane');
        };
    }

    if (primary) makePaneHeader(primary, true);
    if (secondary) makePaneHeader(secondary, false);
}

// ==========================================================================
// 8.1 Quad Multi-Split (2x2 Power Grid - Pro Feature)
// ==========================================================================
let isQuadViewActive = false;
let quadSlotTabIds = [null, null, null, null];

function selectQuadPane(tabId) {
    if (!isQuadViewActive || !tabId) return;
    activeTabId = tabId;

    tabs.forEach(t => {
        const isTarget = t.id === tabId;
        t.el.classList.toggle('active', isTarget);
        t.webview.classList.toggle('active', isTarget);
        t.webview.classList.toggle('is-active-quad-pane', isTarget);
    });

    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab) {
        let u = '';
        try { u = targetTab.webview.getURL ? targetTab.webview.getURL() : ''; } catch (_) {}
        updateOmnibox(u);
        updateNavState(targetTab.webview);
    }

    document.querySelectorAll('.split-pane-header.quad-header').forEach(h => {
        const isHActive = h.dataset.tabId === tabId;
        h.classList.toggle('is-active-header', isHActive);
        const badge = h.querySelector('.split-pane-badge');
        if (badge && h.dataset.baseLabel) {
            badge.textContent = isHActive ? `${h.dataset.baseLabel} • Active` : h.dataset.baseLabel;
        }
    });
}

function toggleQuadMode() {
    isQuadViewActive = !isQuadViewActive;

    if (!isQuadViewActive) {
        viewsContainer.classList.remove('quad-view-active');
        document.querySelectorAll('.split-pane-header').forEach(h => h.remove());
        tabs.forEach(t => {
            t.webview.style.width = '';
            t.webview.classList.remove('split-quad', 'is-active-quad-pane', 'split-primary', 'split-secondary');
            t.webview.style.display = t.id === activeTabId ? 'flex' : 'none';
        });
        quadSlotTabIds = [null, null, null, null];
        showToast('Quad Multi-Split Disabled');
        return;
    }

    // Disable dual split if active
    if (isSplitViewActive) {
        isSplitViewActive = false;
        if (btnSplitView) btnSplitView.classList.remove('active');
        if (splitDivider) splitDivider.classList.add('hidden');
        viewsContainer.classList.remove('split-view-active');
        document.querySelectorAll('.split-pane-header').forEach(h => h.remove());
    }

    // Ensure we have at least 4 tabs
    const initialActive = activeTabId;
    while (tabs.length < 4) {
        createTab(START_PAGE_URL);
    }
    activeTabId = initialActive;

    // Stable 4 slots: current active tab in slot 0, other tabs in slots 1, 2, 3
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    const otherTabs = tabs.filter(t => t.id !== activeTab.id);
    quadSlotTabIds = [activeTab.id, otherTabs[0].id, otherTabs[1].id, otherTabs[2].id];

    viewsContainer.classList.add('quad-view-active');
    if (splitDivider) splitDivider.classList.add('hidden');

    updateQuadLayout();
    showToast('Quad Multi-Split Active (2x2 Power Grid)');
}

function updateQuadLayout() {
    if (!isQuadViewActive) return;

    // Ensure all 4 slots have valid open tabs
    for (let i = 0; i < 4; i++) {
        if (!quadSlotTabIds[i] || !tabs.find(t => t.id === quadSlotTabIds[i])) {
            const unused = tabs.find(t => !quadSlotTabIds.includes(t.id));
            if (unused) {
                quadSlotTabIds[i] = unused.id;
            } else {
                const cur = activeTabId;
                createTab(START_PAGE_URL);
                activeTabId = cur;
                quadSlotTabIds[i] = tabs[tabs.length - 1].id;
            }
        }
    }

    const quadTabs = quadSlotTabIds.map(id => tabs.find(t => t.id === id)).filter(Boolean);

    tabs.forEach(t => {
        if (quadTabs.includes(t)) {
            t.webview.style.display = 'flex';
            t.webview.style.width = '100%';
            t.webview.classList.add('split-quad');
            t.webview.classList.toggle('is-active-quad-pane', t.id === activeTabId);
            t.webview.classList.remove('split-primary', 'split-secondary');
        } else {
            t.webview.style.display = 'none';
            t.webview.style.width = '';
            t.webview.classList.remove('split-quad', 'is-active-quad-pane', 'split-primary', 'split-secondary');
        }
    });

    renderQuadPaneHeaders(quadTabs);
}

function renderQuadPaneHeaders(quadTabs) {
    document.querySelectorAll('.split-pane-header').forEach(h => h.remove());

    const paneLabels = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'];

    quadTabs.forEach((tab, index) => {
        if (!tab || !tab.webview) return;

        let currentUrl = '';
        try { currentUrl = tab.webview.getURL ? tab.webview.getURL() : ''; } catch (_) {}
        let displayUrl = currentUrl || 'New Tab';
        try { displayUrl = new URL(currentUrl).hostname || 'New Tab'; } catch (_) {}

        const isActive = tab.id === activeTabId;
        const header = document.createElement('div');
        header.className = 'split-pane-header quad-header' + (isActive ? ' is-active-header' : '');
        header.dataset.quadIndex = index.toString();
        header.dataset.tabId = tab.id;
        header.dataset.baseLabel = paneLabels[index] || `Pane ${index + 1}`;

        header.innerHTML = `
            <div class="split-pane-info">
                <span class="split-pane-badge">${isActive ? `${header.dataset.baseLabel} • Active` : header.dataset.baseLabel}</span>
                <input type="text" class="quad-pane-nav-input" value="${currentUrl}" placeholder="Enter address or search...">
            </div>
            <div class="split-pane-actions">
                <button class="split-pane-btn btn-switch-dual" title="Switch to Dual Split View">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                </button>
                <button class="split-pane-btn btn-focus-pane" title="Keep Only This Pane (Exit Quad)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
                <button class="split-pane-btn btn-close-pane" title="Close This Tab">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        viewsContainer.insertBefore(header, tab.webview);

        // Clicking anywhere on the header selects this pane
        header.addEventListener('mousedown', () => {
            selectQuadPane(tab.id);
        });

        // Interactive address bar inside each quad header
        const navInput = header.querySelector('.quad-pane-nav-input');
        if (navInput) {
            navInput.addEventListener('focus', () => {
                selectQuadPane(tab.id);
                navInput.select();
            });

            navInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    let dest = navInput.value.trim();
                    if (dest) {
                        if (!dest.startsWith('http://') && !dest.startsWith('https://') && !dest.startsWith('file:') && !dest.startsWith('fokk:')) {
                            if (dest.includes('.') && !dest.includes(' ')) {
                                dest = 'https://' + dest;
                            } else {
                                dest = 'https://www.bing.com/search?q=' + encodeURIComponent(dest);
                            }
                        }
                        tab.webview.loadURL(dest);
                        navInput.blur();
                    }
                }
            });
        }

        // Keep input updated on navigation
        if (!tab.webview.__quadNavBound) {
            tab.webview.__quadNavBound = true;
            tab.webview.addEventListener('did-navigate', (e) => {
                const curH = document.querySelector(`.split-pane-header.quad-header[data-tab-id="${tab.id}"]`);
                if (curH) {
                    const inp = curH.querySelector('.quad-pane-nav-input');
                    if (inp && document.activeElement !== inp) inp.value = e.url;
                }
                if (isQuadViewActive && tab.id === activeTabId) {
                    updateOmnibox(e.url);
                }
            });

            // Focus on webview focuses this quad slot
            tab.webview.addEventListener('focus', () => {
                if (isQuadViewActive) selectQuadPane(tab.id);
            });
        }

        const btnDual = header.querySelector('.btn-switch-dual');
        if (btnDual) {
            btnDual.onclick = (e) => {
                e.stopPropagation();
                toggleQuadMode();
                if (!isSplitViewActive) toggleSplitView();
            };
        }

        const btnFocus = header.querySelector('.btn-focus-pane');
        if (btnFocus) {
            btnFocus.onclick = (e) => {
                e.stopPropagation();
                activeTabId = tab.id;
                toggleQuadMode();
                activateTab(tab.id);
                showToast(`Focused on ${displayUrl}`);
            };
        }

        const btnClose = header.querySelector('.btn-close-pane');
        if (btnClose) {
            btnClose.onclick = (e) => {
                e.stopPropagation();
                const closingId = tab.id;
                quadSlotTabIds = quadSlotTabIds.map(id => id === closingId ? null : id);
                closeTab(closingId);
            };
        }
    });
}

if (btnSplitView) {
    btnSplitView.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSplitView();
    });
}

if (splitDivider) {
    let isDragging = false;
    let rafId = null;
    let pendingRatio = 0.5;

    splitDivider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        splitDivider.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        // Disable pointer-events on webviews to prevent mouse swallowing
        document.querySelectorAll('webview').forEach(wv => { wv.style.pointerEvents = 'none'; });
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !isSplitViewActive) return;
        const rect = viewsContainer.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        let ratio = rawX / rect.width;
        ratio = Math.max(0.2, Math.min(0.8, ratio));
        pendingRatio = ratio;
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                splitRatio = pendingRatio;
                updateSplitLayout();
                rafId = null;
            });
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            if (splitDivider) splitDivider.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Re-enable pointer events on webviews
            document.querySelectorAll('webview').forEach(wv => { wv.style.pointerEvents = ''; });
        }
    });
}

// ==========================================================================
// 9. Tab Memory Hibernation & Eco Mode
// ==========================================================================
const TAB_HIBERNATE_IDLE_MS = 15 * 60 * 1000;

function hibernateTab(tab) {
    if (!tab || tab.isSleeping || tab.id === activeTabId) return;
    if (tab.isPrivate) return;

    const currentUrl = (typeof tab.webview.getURL === 'function' ? tab.webview.getURL() : '') || '';
    if (!currentUrl || currentUrl.startsWith('file:') || currentUrl === 'about:blank') return;

    tab.isSleeping = true;
    tab.savedUrl = currentUrl;
    tab.savedTitle = tab.el.querySelector('.tab-title') ? tab.el.querySelector('.tab-title').textContent : '';

    tab.el.classList.add('sleeping-tab');
    let ind = tab.el.querySelector('.sleep-indicator');
    if (!ind) {
        ind = document.createElement('span');
        ind.className = 'sleep-indicator';
        ind.title = 'Sleeping to save RAM — Click to wake';
        ind.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        const titleEl = tab.el.querySelector('.tab-title');
        if (titleEl) tab.el.insertBefore(ind, titleEl);
    }

    try {
        tab.webview.stop();
        tab.webview.loadURL('about:blank');
    } catch (_) {}
}

function wakeTab(tab) {
    if (!tab || !tab.isSleeping) return;
    tab.isSleeping = false;
    tab.el.classList.remove('sleeping-tab');
    const ind = tab.el.querySelector('.sleep-indicator');
    if (ind) ind.remove();

    if (tab.savedUrl) {
        try {
            tab.webview.loadURL(tab.savedUrl);
            showToast(`Woke up "${tab.savedTitle || 'Tab'}" from memory sleep`);
        } catch (_) {}
    }
}

function hibernateAllInactiveTabs() {
    let hibernatedCount = 0;
    tabs.forEach(t => {
        if (t.id !== activeTabId && !t.isSleeping) {
            hibernateTab(t);
            if (t.isSleeping) hibernatedCount++;
        }
    });
    showToast(hibernatedCount > 0 ? `Hibernated ${hibernatedCount} background tab(s) to save RAM` : 'All background tabs are already in sleep mode');
}

setInterval(() => {
    const now = Date.now();
    tabs.forEach(t => {
        if (t.id !== activeTabId && !t.isSleeping && t.lastActiveTime && (now - t.lastActiveTime > TAB_HIBERNATE_IDLE_MS)) {
            hibernateTab(t);
        }
    });
}, 60000);

// Initialize Initial Tab
createTab(START_PAGE_URL);

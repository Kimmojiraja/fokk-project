const { ipcRenderer } = require('electron');

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
    const isPrivate = !!options.isPrivate;

    const tabEl = document.createElement('div');
    tabEl.className = 'browser-tab' + (isPrivate ? ' private-tab' : '');
    tabEl.id = 'tab_btn_' + tabId;
    tabEl.innerHTML = `
        <img src="icon.png" class="tab-favicon" id="fav_${tabId}">
        <span class="tab-title" id="title_${tabId}">${isPrivate ? 'Private Tab' : 'New Tab'}</span>
        <button class="tab-close" title="Close Tab (Ctrl+W)">&times;</button>
    `;

    tabEl.querySelector('.tab-close').onclick = (e) => {
        e.stopPropagation();
        closeTab(tabId);
    };

    tabEl.onclick = () => activateTab(tabId);
    tabStrip.insertBefore(tabEl, btnNewTab);

    const webview = document.createElement('webview');
    webview.id = 'view_' + tabId;
    webview.setAttribute('src', url);
    webview.setAttribute('preload', PRELOAD_SCRIPT_PATH);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('useragent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes');
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
    });

    webview.addEventListener('page-title-updated', (e) => {
        const titleEl = document.getElementById('title_' + tabId);
        if (titleEl && e.title) {
            titleEl.textContent = (isPrivate ? '[Private] ' : '') + e.title;
        }
        if (!isPrivate && webview.getURL) {
            recordHistoryItem(webview.getURL(), e.title);
        }
    });

    webview.addEventListener('page-favicon-updated', (e) => {
        const favEl = document.getElementById('fav_' + tabId);
        if (favEl && e.favicons && e.favicons.length > 0) {
            favEl.src = e.favicons[0];
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
    tabs.forEach(t => {
        if (t.id === tabId) {
            t.el.classList.add('active');
            t.webview.classList.add('active');
            updateOmnibox(t.webview.getURL ? t.webview.getURL() : '');
            updateNavState(t.webview);
            if (shieldCountText) {
                const u = t.webview.getURL ? t.webview.getURL() : '';
                shieldCountText.textContent = (u.startsWith('http') && t.blockedCount) ? t.blockedCount : '0';
            }
        } else {
            t.el.classList.remove('active');
            t.webview.classList.remove('active');
        }
    });
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
}

function updateNavState(webview) {
    if (!webview || typeof webview.canGoBack !== 'function') return;
    btnBack.disabled = !webview.canGoBack();
    btnForward.disabled = !webview.canGoForward();
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

// 4. Desktop Browser Menu & Daily Essentials
if (btnMenu && desktopBrowserMenu) {
    btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        desktopBrowserMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!desktopBrowserMenu.contains(e.target) && e.target !== btnMenu) {
            desktopBrowserMenu.classList.add('hidden');
        }
        if (omniboxEngineDropdown && !omniboxEngineSelector.contains(e.target)) {
            omniboxEngineDropdown.classList.add('hidden');
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
        const desktopUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        active.setUserAgent(isMobileUA ? mobileUA : desktopUA);
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
        `;

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
        featureModalTitle.textContent = 'Extensions & User Scripts';
        featureModalBody.innerHTML = `
            <div class="modal-form-group">
                <label class="modal-form-label">Custom CSS Injector</label>
                <textarea id="txtCustomCSS" class="modal-textarea" rows="4" placeholder="/* CSS to inject on active page */"></textarea>
                <button class="modal-btn secondary" id="btnInjectCSS" style="margin-top: 6px;">Inject CSS</button>
            </div>
            <div class="modal-form-group" style="margin-top: 16px;">
                <label class="modal-form-label">Custom JavaScript Injector</label>
                <textarea id="txtCustomJS" class="modal-textarea" rows="4" placeholder="// JS to evaluate on active page"></textarea>
                <button class="modal-btn" id="btnInjectJS" style="margin-top: 6px;">Execute JavaScript</button>
            </div>
        `;

        document.getElementById('btnInjectCSS').onclick = () => {
            const css = document.getElementById('txtCustomCSS').value;
            const active = getActiveWebview();
            if (active && css) {
                active.insertCSS(css);
                showToast('CSS Injected into page');
            }
        };

        document.getElementById('btnInjectJS').onclick = () => {
            const js = document.getElementById('txtCustomJS').value;
            const active = getActiveWebview();
            if (active && js) {
                active.executeJavaScript(js);
                showToast('JavaScript Executed');
            }
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
                localStorage.setItem('fokk_wallpaper_id', id);
                localStorage.removeItem('fokk_custom_wallpaper');

                // Notify all active start pages to update instantly
                tabs.forEach(t => {
                    t.webview.executeJavaScript(`
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
                localStorage.setItem('fokk_custom_wallpaper', dataUrl);
                tabs.forEach(t => {
                    t.webview.executeJavaScript(`
                        const bg = document.getElementById('wallpaperBg');
                        if (bg) bg.style.backgroundImage = 'url("${dataUrl}")';
                    `).catch(() => {});
                });
                featureHubModal.classList.add('hidden');
                showToast('Custom Wallpaper uploaded and applied');
            }
        };

    } else if (hubId === 'fundraising') {
        featureModalTitle.textContent = 'Fundraising & Contributing';
        featureModalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h4 style="color: #FFF; font-size: 14px; margin-bottom: 6px;">Support Independent Privacy</h4>
                <p style="font-size: 12px; line-height: 1.6; color: var(--text-secondary);">
                    Fokk Browser has zero ads, zero trackers, and zero telemetry. It is built and maintained by privacy advocates funded solely by community sponsors.
                </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 13px; font-weight: 700; color: #FFF;">GitHub Sponsors</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Monthly recurring developer sponsorship</div>
                    </div>
                    <button class="modal-btn secondary" id="btnOpenGhSponsors">Sponsor on GitHub</button>
                </div>
                <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 13px; font-weight: 700; color: #FFF;">Buy Me a Coffee</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">One-time community contribution</div>
                    </div>
                    <button class="modal-btn secondary" id="btnOpenCoffee">Buy Coffee</button>
                </div>
                <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 13px; font-weight: 700; color: #FFF;">Open to Code Contributors</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Star, fork, and contribute to Fokk Project</div>
                    </div>
                    <button class="modal-btn secondary" id="btnOpenRepo">View GitHub Repo</button>
                </div>
                <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px;">
                    <div style="font-size: 13px; font-weight: 700; color: #FFF; margin-bottom: 2px;">Crypto Privacy Vault</div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 10px;">Direct, anonymous decentralized support:</div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: #F7931A; margin-right: 6px;">BTC (Bitcoin):</span>
                                <code style="font-size: 10.5px; color: #E2E8F0;">bc1qwxnv6uphj0ke8q50gdx6ew8j3lgvwhk6k2kaet</code>
                            </div>
                            <button class="modal-btn secondary btn-copy-crypto" data-crypto="bc1qwxnv6uphj0ke8q50gdx6ew8j3lgvwhk6k2kaet" data-name="BTC" style="padding: 2px 10px; font-size: 11px;">Copy</button>
                        </div>

                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: #627EEA; margin-right: 6px;">ETH (Ethereum):</span>
                                <code style="font-size: 10.5px; color: #E2E8F0;">0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525</code>
                            </div>
                            <button class="modal-btn secondary btn-copy-crypto" data-crypto="0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525" data-name="ETH" style="padding: 2px 10px; font-size: 11px;">Copy</button>
                        </div>

                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: #F3BA2F; margin-right: 6px;">BNB (Smart Chain):</span>
                                <code style="font-size: 10.5px; color: #E2E8F0;">0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525</code>
                            </div>
                            <button class="modal-btn secondary btn-copy-crypto" data-crypto="0x54BB111a33Cae41F63Bad6E9D1Eb65341f561525" data-name="BNB" style="padding: 2px 10px; font-size: 11px;">Copy</button>
                        </div>

                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: #14F195; margin-right: 6px;">SOL (Solana):</span>
                                <code style="font-size: 10.5px; color: #E2E8F0;">DqgAgDj4PjvR4K1wtYfpaZuYNeNZgj2fQoKnXApWKuTj</code>
                            </div>
                            <button class="modal-btn secondary btn-copy-crypto" data-crypto="DqgAgDj4PjvR4K1wtYfpaZuYNeNZgj2fQoKnXApWKuTj" data-name="SOL" style="padding: 2px 10px; font-size: 11px;">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnOpenGhSponsors').onclick = () => {
            createTab('https://github.com/sponsors/Kimmojiraja');
            featureHubModal.classList.add('hidden');
        };
        document.getElementById('btnOpenCoffee').onclick = () => {
            createTab('https://www.buymeacoffee.com/k_raja');
            featureHubModal.classList.add('hidden');
        };
        document.getElementById('btnOpenRepo').onclick = () => {
            createTab('https://github.com/Kimmojiraja/fokk-project');
            featureHubModal.classList.add('hidden');
        };
        featureModalBody.querySelectorAll('.btn-copy-crypto').forEach(btn => {
            btn.onclick = () => {
                const addr = btn.getAttribute('data-crypto');
                const name = btn.getAttribute('data-name');
                navigator.clipboard.writeText(addr).then(() => {
                    showToast(`${name} address copied to clipboard`);
                });
            };
        });

    } else if (hubId === 'license') {
        featureModalTitle.textContent = 'License & Legal Notice';
        featureModalBody.innerHTML = `
            <div style="margin-bottom: 14px;">
                <h4 style="color: #FFF; font-size: 14px; margin-bottom: 6px;">Fokk Shield Browser — MIT License</h4>
                <div style="background: #090A0C; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; line-height: 1.5; color: var(--text-secondary); max-height: 150px; overflow-y: auto;">
                    Copyright (c) 2026 Fokk Shield Team<br><br>
                    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.<br><br>
                    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
                </div>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #FFF; margin-bottom: 4px;">Open Source Acknowledgments</div>
                <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
                    Built with Electron 30, Chromium 124, and curated adblock rule sets inspired by EasyList, Peter Lowe, and uBlock Origin community filters.
                </div>
            </div>
            <div style="background: rgba(0,229,255,0.06); border: 1px solid rgba(0,229,255,0.2); border-radius: 8px; padding: 10px;">
                <div style="font-size: 11.5px; font-weight: 700; color: var(--fokk-cyan);">Zero Data Collection Guarantee</div>
                <div style="font-size: 10.5px; color: var(--text-secondary); margin-top: 2px;">
                    This software never tracks, logs, stores, or transmits your search history, URLs, or personal data to any external server.
                </div>
            </div>
        `;

    } else if (hubId === 'about') {
        featureModalTitle.textContent = 'About Fokk Browser';
        featureModalBody.innerHTML = `
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
                <img src="icon.png" style="width: 52px; height: 52px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,229,255,0.4);">
                <div>
                    <h3 style="color: #FFF; font-size: 18px;">Fokk Browser Desktop</h3>
                    <div style="color: var(--fokk-cyan); font-size: 12px; font-weight: 700;">Version 1.0.0 · Rust Shield Edition</div>
                    <div style="color: var(--text-secondary); font-size: 11px;">Chromium 124 / Electron 30 · Multi-Platform</div>
                </div>
            </div>

            <!-- In-App 1-Click Update Center -->
            <div class="update-center-card">
                <div class="update-card-header">
                    <div class="update-status-wrap">
                        <span class="update-dot" id="updateDot"></span>
                        <div>
                            <div class="update-main-title" id="updateMainTitle">Fokk Browser is up to date</div>
                            <div class="update-sub-title" id="updateSubTitle">Current version 1.0.0 is the official release</div>
                        </div>
                    </div>
                    <button id="btnCheckUpdate" class="btn-update-action" title="Check for latest releases from GitHub">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/></svg>
                        <span>Check for Updates</span>
                    </button>
                </div>

                <div id="updateDownloadBox" class="update-download-box hidden">
                    <div class="update-progress-info">
                        <span id="updateProgressText">Downloading update...</span>
                        <span id="updateProgressPercent">0%</span>
                    </div>
                    <div class="update-progress-track">
                        <div class="update-progress-bar" id="updateProgressBar"></div>
                    </div>
                </div>

                <div id="updateActionBox" class="update-action-box hidden">
                    <div class="update-notes-preview" id="updateNotesPreview"></div>
                    <button id="btnApplyUpdate" class="btn-install-update">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        <span id="btnApplyUpdateText">Update Now (1-Click)</span>
                    </button>
                </div>
            </div>

            <p style="font-size: 12.5px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 14px;">
                Fokk Browser is an ultra-fast, zero-compromise desktop web browser engineered with built-in network adblocking, canvas cloaking, DNS privacy, and distraction-free tools.
            </p>
            <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 12px; font-weight: 700; color: #FFF; margin-bottom: 2px;">Official Repository</div>
                    <div style="font-size: 11.5px; color: var(--fokk-cyan); cursor: pointer;" id="linkRepo">github.com/Kimmojiraja/fokk-project</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary);"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `;

        document.getElementById('linkRepo').onclick = () => {
            createTab('https://github.com/Kimmojiraja/fokk-project');
            featureHubModal.classList.add('hidden');
        };

        // Wire 1-Click Update Controls
        let updateTargetInfo = null;
        let downloadedFilePath = null;

        const btnCheckUpdate = document.getElementById('btnCheckUpdate');
        const updateDot = document.getElementById('updateDot');
        const updateMainTitle = document.getElementById('updateMainTitle');
        const updateSubTitle = document.getElementById('updateSubTitle');
        const updateDownloadBox = document.getElementById('updateDownloadBox');
        const updateProgressBar = document.getElementById('updateProgressBar');
        const updateProgressText = document.getElementById('updateProgressText');
        const updateProgressPercent = document.getElementById('updateProgressPercent');
        const updateActionBox = document.getElementById('updateActionBox');
        const updateNotesPreview = document.getElementById('updateNotesPreview');
        const btnApplyUpdate = document.getElementById('btnApplyUpdate');
        const btnApplyUpdateText = document.getElementById('btnApplyUpdateText');

        btnCheckUpdate.onclick = async () => {
            btnCheckUpdate.disabled = true;
            updateDot.className = 'update-dot checking';
            updateMainTitle.textContent = 'Checking for updates...';
            updateSubTitle.textContent = 'Connecting to GitHub Releases...';

            try {
                const res = await ipcRenderer.invoke('fokk-check-update');
                btnCheckUpdate.disabled = false;

                if (res && res.available) {
                    updateTargetInfo = res;
                    updateDot.className = 'update-dot available';
                    updateMainTitle.textContent = `New Update Available: v${res.latestVersion}`;
                    updateSubTitle.textContent = `Current v${res.currentVersion} · Click below to update`;

                    updateActionBox.classList.remove('hidden');
                    if (res.releaseNotes) {
                        updateNotesPreview.textContent = res.releaseNotes.substring(0, 180) + '...';
                        updateNotesPreview.style.display = 'block';
                    }
                    btnApplyUpdateText.textContent = `Update to v${res.latestVersion} (1-Click)`;
                } else {
                    updateDot.className = 'update-dot';
                    updateMainTitle.textContent = 'You are on the latest version';
                    updateSubTitle.textContent = `Version ${res.currentVersion || '1.0.0'} is up to date`;
                    updateActionBox.classList.add('hidden');
                    showToast('Fokk Browser is fully up to date!');
                }
            } catch (e) {
                btnCheckUpdate.disabled = false;
                updateDot.className = 'update-dot';
                updateMainTitle.textContent = 'Could not check for updates';
                updateSubTitle.textContent = e.message || 'Network error';
            }
        };

        btnApplyUpdate.onclick = async () => {
            if (downloadedFilePath) {
                btnApplyUpdate.disabled = true;
                btnApplyUpdateText.textContent = 'Restarting and installing update...';
                await ipcRenderer.invoke('fokk-install-update', { filePath: downloadedFilePath });
                return;
            }

            if (!updateTargetInfo || !updateTargetInfo.downloadUrl) return;

            btnApplyUpdate.disabled = true;
            updateDownloadBox.classList.remove('hidden');
            updateProgressText.textContent = `Downloading v${updateTargetInfo.latestVersion}...`;

            try {
                const downloadRes = await ipcRenderer.invoke('fokk-start-update', {
                    downloadUrl: updateTargetInfo.downloadUrl,
                    fileName: updateTargetInfo.fileName
                });

                if (downloadRes && downloadRes.success) {
                    downloadedFilePath = downloadRes.filePath;
                    updateDownloadBox.classList.add('hidden');
                    updateDot.className = 'update-dot ready';
                    updateMainTitle.textContent = `v${updateTargetInfo.latestVersion} Downloaded!`;
                    updateSubTitle.textContent = 'Ready to apply. Click below to restart.';
                    btnApplyUpdate.disabled = false;
                    btnApplyUpdateText.textContent = 'Restart & Install Update (1-Click)';
                    btnApplyUpdate.classList.add('btn-restart-ready');
                    showToast('Update downloaded! Ready to install.');
                }
            } catch (err) {
                btnApplyUpdate.disabled = false;
                updateDownloadBox.classList.add('hidden');
                showToast(`Update download failed: ${err.message}`);
            }
        };

        // Track live download progress
        ipcRenderer.on('fokk-update-progress', (event, p) => {
            if (updateProgressBar && updateProgressPercent) {
                updateProgressBar.style.width = `${p.percent}%`;
                updateProgressPercent.textContent = `${p.percent}%`;
                const mbTrans = (p.transferred / (1024 * 1024)).toFixed(1);
                const mbTot = (p.total / (1024 * 1024)).toFixed(1);
                updateProgressText.textContent = `Downloading update: ${mbTrans} MB / ${mbTot} MB`;
            }
        });
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
    if (e.ctrlKey) {
        if (e.key === 't' || e.key === 'T') {
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

// Initialize Initial Tab
createTab(START_PAGE_URL);

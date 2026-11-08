const { ipcRenderer } = require('electron');

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

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
const btnMenu = document.getElementById('btnMenu');

const START_PAGE_URL = ipcRenderer.sendSync('fokk-get-start-page-url');
const PRELOAD_SCRIPT_PATH = ipcRenderer.sendSync('fokk-get-preload-path');

// 1. Tab Creation & Switching
function createTab(url = START_PAGE_URL, makeActive = true) {
    tabCounter++;
    const tabId = 'tab_' + tabCounter;

    // Create tab button
    const tabEl = document.createElement('div');
    tabEl.className = 'browser-tab';
    tabEl.id = 'tab_btn_' + tabId;
    tabEl.innerHTML = `
        <img src="../../build/icon.png" class="tab-favicon" id="fav_${tabId}">
        <span class="tab-title" id="title_${tabId}">New Tab</span>
        <button class="tab-close" title="Close Tab (Ctrl+W)">&times;</button>
    `;

    // Tab close click
    tabEl.querySelector('.tab-close').onclick = (e) => {
        e.stopPropagation();
        closeTab(tabId);
    };

    // Tab activate click
    tabEl.onclick = () => activateTab(tabId);

    // Insert before the new tab button
    tabStrip.insertBefore(tabEl, btnNewTab);

    // Create webview element
    const webview = document.createElement('webview');
    webview.id = 'view_' + tabId;
    webview.setAttribute('src', url);
    webview.setAttribute('preload', PRELOAD_SCRIPT_PATH);
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('webpreferences', 'contextIsolation=yes, javascript=yes');

    // Webview event listeners
    webview.addEventListener('did-start-loading', () => {
        if (activeTabId === tabId) {
            btnReload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        }
    });

    webview.addEventListener('did-stop-loading', () => {
        if (activeTabId === tabId) {
            btnReload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19"/></svg>`;
            updateNavState(webview);
        }
    });

    webview.addEventListener('page-title-updated', (e) => {
        const titleEl = document.getElementById('title_' + tabId);
        if (titleEl) titleEl.textContent = e.title || 'Fokk Browser';
    });

    webview.addEventListener('page-favicon-updated', (e) => {
        if (e.favicons && e.favicons.length > 0) {
            const favEl = document.getElementById('fav_' + tabId);
            if (favEl) favEl.src = e.favicons[0];
        }
    });

    webview.addEventListener('did-navigate', (e) => {
        if (activeTabId === tabId) {
            updateOmnibox(e.url);
            updateNavState(webview);
        }
    });

    webview.addEventListener('did-navigate-in-page', (e) => {
        if (activeTabId === tabId) {
            updateOmnibox(e.url);
            updateNavState(webview);
        }
    });

    viewsContainer.appendChild(webview);

    tabs.push({ id: tabId, element: tabEl, webview: webview });

    if (makeActive) {
        activateTab(tabId);
    }
    return tabId;
}

function activateTab(tabId) {
    activeTabId = tabId;
    tabs.forEach(t => {
        const isCurrent = t.id === tabId;
        t.element.classList.toggle('active', isCurrent);
        t.webview.classList.toggle('active', isCurrent);
        if (isCurrent) {
            updateOmnibox(t.webview.getURL ? t.webview.getURL() : '');
            updateNavState(t.webview);
        }
    });
}

function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const tab = tabs[idx];
    tab.element.remove();
    tab.webview.remove();
    tabs.splice(idx, 1);

    if (tabs.length === 0) {
        createTab(START_PAGE_URL);
    } else if (activeTabId === tabId) {
        const nextTab = tabs[Math.max(0, idx - 1)];
        activateTab(nextTab.id);
    }
}

function updateOmnibox(url) {
    if (!url || url.includes('fokk_start.html')) {
        urlInput.value = '';
        urlInput.placeholder = 'Search with Google or enter web address...';
    } else {
        urlInput.value = url;
    }
}

function updateNavState(webview) {
    try {
        btnBack.disabled = !webview.canGoBack();
        btnForward.disabled = !webview.canGoForward();
    } catch (_) {}
}

function getActiveWebview() {
    const tab = tabs.find(t => t.id === activeTabId);
    return tab ? tab.webview : null;
}

// 2. Navigation Controls
btnBack.onclick = () => {
    const wv = getActiveWebview();
    if (wv && wv.canGoBack()) wv.goBack();
};

btnForward.onclick = () => {
    const wv = getActiveWebview();
    if (wv && wv.canGoForward()) wv.goForward();
};

btnReload.onclick = () => {
    const wv = getActiveWebview();
    if (wv) {
        if (wv.isLoading()) wv.stop();
        else wv.reload();
    }
};

btnHome.onclick = () => {
    const wv = getActiveWebview();
    if (wv) wv.loadURL(START_PAGE_URL);
};

btnVisuals.onclick = () => {
    const wv = getActiveWebview();
    if (wv) {
        wv.loadURL(START_PAGE_URL + '?action=visuals');
    }
};

btnMenu.onclick = () => {
    const wv = getActiveWebview();
    if (wv) {
        wv.executeJavaScript("if (typeof openNativeMenuAction === 'function') openNativeMenuAction();");
    }
};

// 3. Omnibox Submit Handling
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let input = urlInput.value.trim();
        if (!input) return;

        let targetUrl = input;
        const hasProtocol = /^https?:\/\//i.test(input);
        const hasTld = /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(input);

        if (hasProtocol) {
            targetUrl = input;
        } else if (hasTld && !input.includes(' ')) {
            targetUrl = 'https://' + input;
        } else {
            targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(input);
        }

        const wv = getActiveWebview();
        if (wv) {
            wv.loadURL(targetUrl);
            wv.focus();
        }
    }
});

btnNewTab.onclick = () => createTab(START_PAGE_URL);

// 4. Window Controls
document.getElementById('btnMin').onclick = () => ipcRenderer.send('fokk-win-min');
document.getElementById('btnMax').onclick = () => ipcRenderer.send('fokk-win-max');
document.getElementById('btnClose').onclick = () => ipcRenderer.send('fokk-win-close');

// 5. Adblock Stats Sync
ipcRenderer.on('fokk-stats-updated', (event, stats) => {
    if (stats && typeof stats.blocked === 'number') {
        shieldCountText.textContent = stats.blocked.toLocaleString();
    }
});

// Keyboard Shortcuts (Ctrl+T, Ctrl+W, Ctrl+R, F5)
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        createTab(START_PAGE_URL);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
    } else if ((e.ctrlKey && e.key.toLowerCase() === 'r') || e.key === 'F5') {
        e.preventDefault();
        btnReload.click();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        urlInput.select();
        urlInput.focus();
    }
});

// Start initial tab
createTab(START_PAGE_URL);

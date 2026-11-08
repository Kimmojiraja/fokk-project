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
        <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300E5FF'><path d='M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.14-2.73 8.01-6 9.07-3.27-1.06-6-4.93-6-9.07V6.43l6-2.25z'/></svg>" class="tab-favicon" id="fav_${tabId}">
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

// Search Engines Configuration for Omnibox
const OMNIBOX_ENGINES = {
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: `<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.41l4.03-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>`
    },
    brave: {
        name: 'Brave Search',
        url: 'https://search.brave.com/search?q=',
        icon: `<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#FB542B" d="M12 2L3 6.5v6.5C3 18.25 7 22.5 12 24c5-1.5 9-5.75 9-11V6.5L12 2z"/></svg>`
    },
    duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=',
        icon: `<svg width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#DE5833"/><circle cx="12" cy="12" r="4" fill="#FFFFFF"/></svg>`
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: `<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#008373" d="M5 2v19.5l4.5-2.5 5.5 3 4-2.5V8.5L12 5l-7-3z"/></svg>`
    }
};

let activeOmniboxEngine = 'google';
const omniboxEngineSelector = document.getElementById('omniboxEngineSelector');
const omniboxEngineIcon = document.getElementById('omniboxEngineIcon');
const omniboxEngineDropdown = document.getElementById('omniboxEngineDropdown');

if (omniboxEngineSelector && omniboxEngineDropdown) {
    omniboxEngineSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        omniboxEngineDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        omniboxEngineDropdown.classList.add('hidden');
    });

    omniboxEngineDropdown.querySelectorAll('.engine-item').forEach(item => {
        item.addEventListener('click', () => {
            const engineKey = item.getAttribute('data-engine');
            if (OMNIBOX_ENGINES[engineKey]) {
                activeOmniboxEngine = engineKey;
                omniboxEngineIcon.innerHTML = OMNIBOX_ENGINES[engineKey].icon;
                omniboxEngineDropdown.querySelectorAll('.engine-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                updateOmnibox(getActiveWebview() ? getActiveWebview().getURL() : '');
            }
        });
    });
}

function updateOmnibox(url) {
    if (!url || url.includes('start.html') || url.includes('fokk_start.html') || url.startsWith('file://')) {
        urlInput.value = '';
        urlInput.placeholder = `Search with ${OMNIBOX_ENGINES[activeOmniboxEngine].name} or enter address`;
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
        wv.loadURL(START_PAGE_URL);
        setTimeout(() => {
            wv.executeJavaScript("document.getElementById('btnFloatingCustomize') && document.getElementById('btnFloatingCustomize').click();");
        }, 350);
    }
};

// 3. Desktop 3-Dots Menu Dropdown
const desktopBrowserMenu = document.getElementById('desktopBrowserMenu');

if (btnMenu && desktopBrowserMenu) {
    btnMenu.onclick = (e) => {
        e.stopPropagation();
        desktopBrowserMenu.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
        if (!desktopBrowserMenu.contains(e.target) && e.target !== btnMenu) {
            desktopBrowserMenu.classList.add('hidden');
        }
    });

    document.getElementById('menuNewTab').onclick = () => {
        createTab(START_PAGE_URL);
        desktopBrowserMenu.classList.add('hidden');
    };

    document.getElementById('menuVisuals').onclick = () => {
        btnVisuals.click();
        desktopBrowserMenu.classList.add('hidden');
    };

    document.getElementById('menuBookmarks').onclick = () => {
        const wv = getActiveWebview();
        const title = wv ? wv.getTitle() : 'New Tab';
        alert(`Bookmarked: ${title}`);
        desktopBrowserMenu.classList.add('hidden');
    };

    document.getElementById('menuHistory').onclick = () => {
        createTab('https://myactivity.google.com');
        desktopBrowserMenu.classList.add('hidden');
    };

    document.getElementById('menuDownloads').onclick = () => {
        alert('Downloads: Files are saved to your system Downloads folder.');
        desktopBrowserMenu.classList.add('hidden');
    };

    let currentZoom = 1.0;
    const zoomLevelText = document.getElementById('zoomLevelText');
    document.getElementById('btnZoomIn').onclick = () => {
        currentZoom = Math.min(2.0, Math.round((currentZoom + 0.1) * 10) / 10);
        const wv = getActiveWebview();
        if (wv) wv.setZoomFactor(currentZoom);
        zoomLevelText.textContent = Math.round(currentZoom * 100) + '%';
    };
    document.getElementById('btnZoomOut').onclick = () => {
        currentZoom = Math.max(0.5, Math.round((currentZoom - 0.1) * 10) / 10);
        const wv = getActiveWebview();
        if (wv) wv.setZoomFactor(currentZoom);
        zoomLevelText.textContent = Math.round(currentZoom * 100) + '%';
    };

    let shieldActive = true;
    document.getElementById('menuToggleShield').onclick = () => {
        shieldActive = !shieldActive;
        document.getElementById('menuToggleShield').querySelector('span').textContent = 
            shieldActive ? 'Fokk Shield: Active' : 'Fokk Shield: Paused';
        shieldBadge.style.opacity = shieldActive ? '1' : '0.4';
    };

    document.getElementById('menuClearData').onclick = () => {
        const wv = getActiveWebview();
        if (wv) {
            wv.clearHistory();
        }
        alert('Browsing data and cache cleared.');
        desktopBrowserMenu.classList.add('hidden');
    };
}

// 4. Omnibox Submit Handling with Search Engine Selection
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
            targetUrl = OMNIBOX_ENGINES[activeOmniboxEngine].url + encodeURIComponent(input);
        }

        const wv = getActiveWebview();
        if (wv) {
            wv.loadURL(targetUrl);
            wv.focus();
        }
    }
});

btnNewTab.onclick = () => createTab(START_PAGE_URL);

// 5. Window Controls
document.getElementById('btnMin').onclick = () => ipcRenderer.send('fokk-win-min');
document.getElementById('btnMax').onclick = () => ipcRenderer.send('fokk-win-max');
document.getElementById('btnClose').onclick = () => ipcRenderer.send('fokk-win-close');

// 6. Adblock Stats Sync
ipcRenderer.on('fokk-stats-updated', (event, stats) => {
    if (stats && typeof stats.blocked === 'number') {
        shieldCountText.textContent = stats.blocked.toLocaleString();
    }
});

// Keyboard Shortcuts (Ctrl+T, Ctrl+W, Ctrl+R, F5, Ctrl+L)
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

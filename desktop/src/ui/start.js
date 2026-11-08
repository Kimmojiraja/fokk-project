// Fokk Desktop Start Page Logic

(function() {
    'use strict';

    // 1. Curated 4K Wallpapers (Sailboats, Alpine, Horizons, Cyberpunk, Nature)
    const CURATED_WALLPAPERS = [
        {
            id: 'sailboats',
            name: 'Sailboats at Dusk',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2560&q=85'
        },
        {
            id: 'alpine',
            name: 'Alpine Serenity',
            url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2560&q=85'
        },
        {
            id: 'horizon',
            name: 'Golden Horizon',
            url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=2560&q=85'
        },
        {
            id: 'cyberpunk',
            name: 'Neon Metropolis',
            url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=2560&q=85'
        },
        {
            id: 'space',
            name: 'Cosmic Nebula',
            url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=2560&q=85'
        },
        {
            id: 'obsidian',
            name: 'Minimalist Charcoal',
            url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="%230a0e17"/></svg>'
        }
    ];

    // 2. Desktop Top Shortcuts (Firefox style)
    const DEFAULT_SHORTCUTS = [
        {
            name: 'Google',
            url: 'https://www.google.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.41l4.03-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>`
        },
        {
            name: 'YouTube',
            url: 'https://www.youtube.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
        },
        {
            name: 'Reddit',
            url: 'https://www.reddit.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FF4500" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm5.5 0c-.688 0-1.25.56-1.25 1.25 0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.096.327.327 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.096z"/></svg>`
        },
        {
            name: 'GitHub',
            url: 'https://www.github.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
        },
        {
            name: 'Wikipedia',
            url: 'https://www.wikipedia.org',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12.09 13.124l2.766-7.854h2.247l-4.237 11.23h-1.554L7.546 5.27h2.259l2.285 7.854zm7.397-7.854l2.193 11.23h-1.92l-1.307-7.143-2.022 7.143h-1.636l3.187-11.23h1.505zm-14.733 0l3.187 11.23H6.305L4.283 9.357 2.976 16.5H1.056l2.193-11.23h1.505z"/></svg>`
        },
        {
            name: 'X (Twitter)',
            url: 'https://www.x.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
        },
        {
            name: 'ChatGPT',
            url: 'https://chatgpt.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#10A37F" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.07-9.52a4.475 4.475 0 0 1 2.34-1.974V12.35l5.843 3.37v2.332a.08.08 0 0 1-.033.062L5.84 21.2a4.5 4.5 0 0 1-3.31-12.416z"/></svg>`
        },
        {
            name: 'Amazon',
            url: 'https://www.amazon.com',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FF9900" d="M13.957 10.52c0-1.64-.176-2.898-1.748-2.898-1.077 0-1.666.82-1.91 1.543l3.658 1.355zm1.88-5.074h2.247v8.948c0 1.25.105 2.197.808 2.871l-2.197 1.055c-.562-.644-.738-1.5-.82-2.148-.75.984-1.91 1.77-3.48 1.77-2.602 0-4.3-1.898-4.3-4.523 0-2.87 2.133-4.477 4.57-4.477 1.29 0 2.227.422 2.774.96v-4.456h.398zM2.032 17.514C6.544 20.887 13.066 22.5 19.1 20.086c.645-.258.62-1.031-.035-1.125-3.809-.54-7.512-1.992-10.746-4.3-.41-.293-.89.164-.527.539.06.06.12.12.18.176l-5.94 2.138z"/></svg>`
        }
    ];

    // 3. Fallback High-Quality Editorial Stories
    const FALLBACK_STORIES = [
        {
            title: "Next-Generation Quantum Chips Achieve Sub-Millisecond Superposition",
            source: "Wired",
            time: "25m ago",
            url: "https://www.wired.com",
            image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Web Standards Body Adopts Strict Local Privacy Interceptors for Zero-Tracker Browsing",
            source: "The Verge",
            time: "1h ago",
            url: "https://www.theverge.com",
            image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Deep-Sea Research Vessel Captures Rare Bioluminescent Formations off Mariana Ridge",
            source: "National Geographic",
            time: "2h ago",
            url: "https://www.nationalgeographic.com",
            image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Global Clean Energy Grid Expands with Ultra-Efficient Solar Storage Solutions",
            source: "Reuters",
            time: "3h ago",
            url: "https://www.reuters.com",
            image: "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Revolutionary Solid-State Batteries Enter Mass Production Phase",
            source: "Bloomberg",
            time: "4h ago",
            url: "https://www.bloomberg.com",
            image: "https://images.unsplash.com/photo-1558441719-8b4e0c8b871c?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "James Webb Space Telescope Maps Earliest Known Spiral Galaxies in Deep Cosmos",
            source: "NASA",
            time: "5h ago",
            url: "https://www.nasa.gov",
            image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Open Source AI Architecture Outperforms Proprietary Models on Efficiency Benchmarks",
            source: "Ars Technica",
            time: "6h ago",
            url: "https://arstechnica.com",
            image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "New Architectural Wonder Unveiled: Sustainable Timber Skyscrapers Transforming Skylines",
            source: "Architectural Digest",
            time: "7h ago",
            url: "https://www.architecturaldigest.com",
            image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"
        }
    ];

    // State
    let activeEngine = 'google';
    let currentCategory = 'all';
    let currentRegion = 'global';

    // DOM Elements
    const wallpaperBg = document.getElementById('wallpaperBg');
    const liveClock = document.getElementById('liveClock');
    const liveGreeting = document.getElementById('liveGreeting');
    const searchForm = document.getElementById('desktopSearchForm');
    const searchInput = document.getElementById('desktopSearchInput');
    const engineSelector = document.getElementById('searchEngineSelector');
    const engineDropdown = document.getElementById('engineDropdown');
    const currentEngineIcon = document.getElementById('currentEngineIcon');
    const shortcutsContainer = document.getElementById('shortcutsContainer');
    const storiesGrid = document.getElementById('storiesGrid');
    const storiesRegionSelect = document.getElementById('storiesRegionSelect');
    const storiesCategoryList = document.getElementById('storiesCategoryList');
    const statAdsBlocked = document.getElementById('statAdsBlocked');
    const statBandwidth = document.getElementById('statBandwidth');
    const statTimeSaved = document.getElementById('statTimeSaved');
    const btnOpenVisuals = document.getElementById('btnOpenVisuals');
    const wallpaperModal = document.getElementById('wallpaperModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const wallpapersGrid = document.getElementById('wallpapersGrid');
    const btnUploadDeviceImage = document.getElementById('btnUploadDeviceImage');
    const deviceFileInput = document.getElementById('deviceFileInput');

    // 1. Clock & Dynamic Greeting
    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if (liveClock) liveClock.textContent = `${hours}:${minutes}`;

        let greeting = 'Good morning';
        if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
        else if (hours >= 17) greeting = 'Good evening';
        if (liveGreeting) liveGreeting.textContent = greeting;
    }
    updateClock();
    setInterval(updateClock, 30000);

    // 2. Wallpaper Management
    function loadWallpaper() {
        const savedCustom = localStorage.getItem('fokk_custom_wallpaper');
        const savedId = localStorage.getItem('fokk_wallpaper_id') || 'sailboats';

        if (savedCustom) {
            wallpaperBg.style.backgroundImage = `url("${savedCustom}")`;
            return;
        }

        const match = CURATED_WALLPAPERS.find(w => w.id === savedId) || CURATED_WALLPAPERS[0];
        wallpaperBg.style.backgroundImage = `url("${match.url}")`;
    }

    function setWallpaper(item) {
        localStorage.removeItem('fokk_custom_wallpaper');
        localStorage.setItem('fokk_wallpaper_id', item.id);
        wallpaperBg.style.backgroundImage = `url("${item.url}")`;
        renderWallpaperGrid();
    }

    function renderWallpaperGrid() {
        if (!wallpapersGrid) return;
        const currentId = localStorage.getItem('fokk_wallpaper_id') || 'sailboats';
        const hasCustom = !!localStorage.getItem('fokk_custom_wallpaper');

        wallpapersGrid.innerHTML = CURATED_WALLPAPERS.map(w => `
            <div class="wallpaper-tile ${(!hasCustom && w.id === currentId) ? 'active' : ''}" style="background-image: url('${w.url}')" data-id="${w.id}">
                <div class="wallpaper-tile-label">${w.name}</div>
            </div>
        `).join('');

        wallpapersGrid.querySelectorAll('.wallpaper-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const id = tile.getAttribute('data-id');
                const match = CURATED_WALLPAPERS.find(w => w.id === id);
                if (match) setWallpaper(match);
            });
        });
    }

    // Modal Events
    if (btnOpenVisuals) {
        btnOpenVisuals.addEventListener('click', () => {
            renderWallpaperGrid();
            wallpaperModal.classList.remove('hidden');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            wallpaperModal.classList.add('hidden');
        });
    }

    if (wallpaperModal) {
        wallpaperModal.addEventListener('click', (e) => {
            if (e.target === wallpaperModal) wallpaperModal.classList.add('hidden');
        });
    }

    // Device Wallpaper Upload
    if (btnUploadDeviceImage) {
        btnUploadDeviceImage.addEventListener('click', () => {
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.triggerWallpaperPicker === 'function') {
                window.FokkShieldBridge.triggerWallpaperPicker().then(dataUrl => {
                    if (dataUrl) {
                        localStorage.setItem('fokk_custom_wallpaper', dataUrl);
                        wallpaperBg.style.backgroundImage = `url("${dataUrl}")`;
                        wallpaperModal.classList.add('hidden');
                    }
                }).catch(() => {
                    if (deviceFileInput) deviceFileInput.click();
                });
            } else if (deviceFileInput) {
                deviceFileInput.click();
            }
        });
    }

    if (deviceFileInput) {
        deviceFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = event.target.result;
                    localStorage.setItem('fokk_custom_wallpaper', result);
                    wallpaperBg.style.backgroundImage = `url("${result}")`;
                    wallpaperModal.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 3. Search Engine Handling
    const ENGINES = {
        google: {
            url: 'https://www.google.com/search?q=',
            name: 'Google',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.35 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.41l4.03-3.13z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"/></svg>`
        },
        brave: {
            url: 'https://search.brave.com/search?q=',
            name: 'Brave',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#FB542B" d="M12 2L3 6.5v6.5C3 18.25 7 22.5 12 24c5-1.5 9-5.75 9-11V6.5L12 2z"/></svg>`
        },
        duckduckgo: {
            url: 'https://duckduckgo.com/?q=',
            name: 'DuckDuckGo',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#DE5833"/><circle cx="12" cy="12" r="4" fill="#FFFFFF"/></svg>`
        },
        bing: {
            url: 'https://www.bing.com/search?q=',
            name: 'Bing',
            icon: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#008373" d="M5 2v19.5l4.5-2.5 5.5 3 4-2.5V8.5L12 5l-7-3z"/></svg>`
        }
    };

    if (engineSelector && engineDropdown) {
        engineSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            engineDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            engineDropdown.classList.add('hidden');
        });

        engineDropdown.querySelectorAll('.engine-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const engineKey = opt.getAttribute('data-engine');
                if (ENGINES[engineKey]) {
                    activeEngine = engineKey;
                    currentEngineIcon.innerHTML = ENGINES[engineKey].icon;
                    engineDropdown.querySelectorAll('.engine-opt').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                }
            });
        });
    }

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;

            let targetUrl = '';
            if (/^https?:\/\//i.test(query)) {
                targetUrl = query;
            } else if (query.includes('.') && !query.includes(' ')) {
                targetUrl = 'https://' + query;
            } else {
                targetUrl = ENGINES[activeEngine].url + encodeURIComponent(query);
            }

            navigateTo(targetUrl);
        });
    }

    function navigateTo(url) {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.openUrl === 'function') {
            window.FokkShieldBridge.openUrl(url);
        } else {
            window.location.href = url;
        }
    }

    // 4. Render Top Shortcuts
    function renderShortcuts() {
        if (!shortcutsContainer) return;
        shortcutsContainer.innerHTML = DEFAULT_SHORTCUTS.map(s => `
            <div class="shortcut-item" data-url="${s.url}" title="${s.name}">
                <div class="shortcut-icon-box">
                    ${s.iconSvg}
                </div>
                <span class="shortcut-title">${s.name}</span>
            </div>
        `).join('');

        shortcutsContainer.querySelectorAll('.shortcut-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });
    }

    // 5. Live Protection Stats
    function updateStats() {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getStats === 'function') {
            try {
                const stats = JSON.parse(window.FokkShieldBridge.getStats());
                if (statAdsBlocked && stats.totalBlocked !== undefined) {
                    statAdsBlocked.textContent = stats.totalBlocked.toLocaleString();
                }
                if (statBandwidth && stats.bandwidthSaved !== undefined) {
                    statBandwidth.textContent = stats.bandwidthSaved;
                }
                if (statTimeSaved && stats.timeSaved !== undefined) {
                    statTimeSaved.textContent = stats.timeSaved;
                }
            } catch (e) {}
        }
    }

    // 6. Editorial Stories (Firefox style 4x2 grid)
    function renderStories(items) {
        if (!storiesGrid) return;
        const list = (items && items.length >= 4) ? items.slice(0, 8) : FALLBACK_STORIES;

        storiesGrid.innerHTML = list.map(story => `
            <div class="story-card" data-url="${story.url}">
                <div class="story-thumbnail-wrap">
                    <img class="story-thumbnail" src="${story.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80'}" alt="Story" loading="lazy">
                </div>
                <div class="story-content">
                    <h3 class="story-headline">${story.title}</h3>
                    <div class="story-meta">
                        <span class="story-source">${story.source || 'News'}</span>
                        <span class="story-time">${story.time || 'Live'}</span>
                    </div>
                </div>
            </div>
        `).join('');

        storiesGrid.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });
    }

    function fetchStories() {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getLiveNews === 'function') {
            try {
                const raw = window.FokkShieldBridge.getLiveNews(currentCategory, currentRegion);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        renderStories(parsed);
                        return;
                    }
                }
            } catch (e) {}
        }
        renderStories(FALLBACK_STORIES);
    }

    // Listen for live news push from preload
    window.addEventListener('fokk-live-news-updated', (event) => {
        if (event.detail && Array.isArray(event.detail)) {
            renderStories(event.detail);
        }
    });

    // Stories Controls
    if (storiesCategoryList) {
        storiesCategoryList.querySelectorAll('.cat-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                storiesCategoryList.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCategory = btn.getAttribute('data-cat') || 'all';
                fetchStories();
            });
        });
    }

    if (storiesRegionSelect) {
        storiesRegionSelect.addEventListener('change', (e) => {
            currentRegion = e.target.value;
            fetchStories();
        });
    }

    // Initialize Page
    loadWallpaper();
    renderShortcuts();
    updateStats();
    fetchStories();

    // Periodic stats refresh
    setInterval(updateStats, 5000);
})();

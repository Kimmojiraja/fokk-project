// Fokk Desktop Start Page Logic (Firefox Desktop Layout)

(function() {
    'use strict';

    // 1. Curated 4K Wallpapers (Sailboats Default)
    const CURATED_WALLPAPERS = [
        {
            id: 'sailboat',
            name: 'Sailboats at Dusk (Default)',
            url: 'wallpaper_sailboat.jpg'
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
            id: 'obsidian',
            name: 'Minimalist Charcoal',
            url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="%231c1b22"/></svg>'
        }
    ];

    // 2. Firefox-Style 8 Shortcuts (matching reference Image 2)
    const DEFAULT_SHORTCUTS = [
        {
            name: 'Amazon',
            sub: 'Sponsored',
            url: 'https://www.amazon.com',
            iconBg: '#232f3e',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FF9900" d="M13.957 10.52c0-1.64-.176-2.898-1.748-2.898-1.077 0-1.666.82-1.91 1.543l3.658 1.355zm1.88-5.074h2.247v8.948c0 1.25.105 2.197.808 2.871l-2.197 1.055c-.562-.644-.738-1.5-.82-2.148-.75.984-1.91 1.77-3.48 1.77-2.602 0-4.3-1.898-4.3-4.523 0-2.87 2.133-4.477 4.57-4.477 1.29 0 2.227.422 2.774.96v-4.456h.398zM2.032 17.514C6.544 20.887 13.066 22.5 19.1 20.086c.645-.258.62-1.031-.035-1.125-3.809-.54-7.512-1.992-10.746-4.3-.41-.293-.89.164-.527.539.06.06.12.12.18.176l-5.94 2.138z"/></svg>`
        },
        {
            name: 'Trip.com',
            sub: 'Sponsored',
            url: 'https://www.trip.com',
            iconBg: '#2577e3',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M4 16l4-8 4 8H4zm8 0l4-8 4 8h-8z"/></svg>`
        },
        {
            name: 'Skyscanner',
            sub: 'Sponsored',
            url: 'https://www.skyscanner.com',
            iconBg: '#0770e3',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z"/></svg>`
        },
        {
            name: 'YouTube',
            sub: 'm.youtube.com',
            url: 'https://www.youtube.com',
            iconBg: '#CC0000',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
        },
        {
            name: 'ChatGPT',
            sub: 'chatgpt.com',
            url: 'https://chatgpt.com',
            iconBg: '#10A37F',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zm-1.07-9.52a4.475 4.475 0 0 1 2.34-1.974V12.35l5.843 3.37v2.332a.08.08 0 0 1-.033.062L5.84 21.2a4.5 4.5 0 0 1-3.31-12.416z"/></svg>`
        },
        {
            name: 'GitHub',
            sub: 'github.com',
            url: 'https://www.github.com',
            iconBg: '#24292e',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
        },
        {
            name: 'WhatsApp',
            sub: 'web.whatsapp.com',
            url: 'https://web.whatsapp.com',
            iconBg: '#25D366',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.06c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.084 8.084 0 0 1-1.24-4.29c0-4.47 3.64-8.11 8.11-8.11 2.17 0 4.2 1.2 5.73 2.73 1.53 1.54 2.37 3.57 2.37 5.73 0 4.47-3.64 8.1-8.11 8.1z"/></svg>`
        },
        {
            name: 'Reddit',
            sub: 'reddit.com',
            url: 'https://www.reddit.com',
            iconBg: '#FF4500',
            iconSvg: `<svg viewBox="0 0 24 24"><path fill="#FFFFFF" d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm5.5 0c-.688 0-1.25.56-1.25 1.25 0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.688-.56-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.096.327.327 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.096z"/></svg>`
        }
    ];

    // 3. Firefox-Style 8 Rich Editorial Stories (matching reference Image 2)
    const DEFAULT_STORIES = [
        {
            title: "After accusing Govinda of infidelity, Sunita Ahuja confident about their reunion: '40-year-old marriage'",
            source: "The Indian Express",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23EA580C'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>IE</text></svg>",
            url: "https://indianexpress.com",
            image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "'Hollywood Se Bhi Better Hai...': Sunny Deol Urges Every Indian To Watch Ramayana, Praises Film's VFX",
            source: "Free Press Journal",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23DC2626'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>F</text></svg>",
            url: "https://freepressjournal.in",
            image: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "NSE EGR trading hits record 2.27 lakh units on Dhanteras festival surge",
            source: "Business Line",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563EB'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>bl.</text></svg>",
            url: "https://thehindubusinessline.com",
            image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Ramayana: Kajal Aggarwal on playing Mandodari, says, 'Some roles are bigger than screen time'",
            source: "Mid-Day",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284C7'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>MD</text></svg>",
            url: "https://mid-day.com",
            image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "Chemicals to capital goods: What is driving India's push to indigenise 100 critical industrial components",
            source: "The Indian Express",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23EA580C'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>IE</text></svg>",
            url: "https://indianexpress.com",
            image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "No 'Patiala Peg' for fans: Four Diljit Dosanjh songs barred from upcoming concert tour",
            source: "The Telegraph",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>T</text></svg>",
            url: "https://telegraphindia.com",
            image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "iPhone 18 Pro and iPhone 17 Pro: 5 camera tips for stunning low-light festival photography and cinematic video",
            source: "Wion News",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23059669'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='13' font-weight='bold' fill='white' text-anchor='middle'>WN</text></svg>",
            url: "https://wionews.com",
            image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80"
        },
        {
            title: "UK plans facial recognition surveillance network to track visa overstayers and border compliance",
            source: "Firstpost",
            sourceIcon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23D97706'><rect width='24' height='24' rx='4'/><text x='12' y='17' font-size='14' font-weight='bold' fill='white' text-anchor='middle'>FP</text></svg>",
            url: "https://firstpost.com",
            image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80"
        }
    ];

    // DOM Elements
    const wallpaperBg = document.getElementById('wallpaperBg');
    const searchForm = document.getElementById('desktopSearchForm');
    const searchInput = document.getElementById('desktopSearchInput');
    const shortcutsContainer = document.getElementById('shortcutsContainer');
    const storiesGrid = document.getElementById('storiesGrid');
    const storiesRegionSelect = document.getElementById('storiesRegionSelect');
    const btnFloatingCustomize = document.getElementById('btnFloatingCustomize');
    const wallpaperModal = document.getElementById('wallpaperModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const wallpapersGrid = document.getElementById('wallpapersGrid');
    const btnUploadDeviceImage = document.getElementById('btnUploadDeviceImage');
    const deviceFileInput = document.getElementById('deviceFileInput');

    // 1. Wallpaper Management
    function loadWallpaper() {
        const savedCustom = localStorage.getItem('fokk_custom_wallpaper');
        const savedId = localStorage.getItem('fokk_wallpaper_id');

        if (savedCustom) {
            wallpaperBg.style.backgroundImage = `url("${savedCustom}")`;
            return;
        }

        if (savedId) {
            const match = CURATED_WALLPAPERS.find(w => w.id === savedId);
            if (match) {
                wallpaperBg.style.backgroundImage = `url("${match.url}")`;
                return;
            }
        }

        // Default Sailboat wallpaper
        wallpaperBg.style.backgroundImage = `url("wallpaper_sailboat.jpg")`;
    }

    function setWallpaper(item) {
        localStorage.removeItem('fokk_custom_wallpaper');
        localStorage.setItem('fokk_wallpaper_id', item.id);
        wallpaperBg.style.backgroundImage = `url("${item.url}")`;
        renderWallpaperGrid();
    }

    function renderWallpaperGrid() {
        if (!wallpapersGrid) return;
        const currentId = localStorage.getItem('fokk_wallpaper_id') || 'sailboat';
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
    if (btnFloatingCustomize) {
        btnFloatingCustomize.addEventListener('click', () => {
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

    // Device Upload
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

    // 2. Navigation Handler
    function navigateTo(url) {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.openUrl === 'function') {
            window.FokkShieldBridge.openUrl(url);
        } else {
            window.location.href = url;
        }
    }

    // 3. Search Bar Handling
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
                targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
            }

            navigateTo(targetUrl);
        });
    }

    // 4. Render 8 Shortcuts (Firefox Style)
    function renderShortcuts() {
        if (!shortcutsContainer) return;
        shortcutsContainer.innerHTML = DEFAULT_SHORTCUTS.map(s => `
            <div class="shortcut-tile" data-url="${s.url}" title="${s.name}">
                <div class="shortcut-icon-card" style="background-color: ${s.iconBg}">
                    ${s.iconSvg}
                </div>
                <span class="shortcut-label">${s.name}</span>
                ${s.sub ? `<span class="shortcut-sub">${s.sub}</span>` : ''}
            </div>
        `).join('');

        shortcutsContainer.querySelectorAll('.shortcut-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const url = tile.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });
    }

    // 5. Render 8 Stories (Firefox Style 4x2 Grid)
    function renderStories(items) {
        if (!storiesGrid) return;
        const list = (items && items.length >= 4) ? items.slice(0, 8) : DEFAULT_STORIES;

        storiesGrid.innerHTML = list.map(story => `
            <div class="firefox-card" data-url="${story.url}">
                <div class="card-img-wrap">
                    <img class="card-img" src="${story.image || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80'}" alt="News thumbnail" loading="lazy">
                </div>
                <div class="card-body">
                    <h3 class="card-headline">${story.title}</h3>
                    <div class="card-source-bar">
                        ${story.sourceIcon ? `<img class="source-icon" src="${story.sourceIcon}" alt="">` : ''}
                        <span class="source-name">${story.source || 'News'}</span>
                    </div>
                </div>
            </div>
        `).join('');

        storiesGrid.querySelectorAll('.firefox-card').forEach(card => {
            card.addEventListener('click', () => {
                const url = card.getAttribute('data-url');
                if (url) navigateTo(url);
            });
        });
    }

    function fetchStories(region = 'global') {
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.getLiveNews === 'function') {
            try {
                const raw = window.FokkShieldBridge.getLiveNews('all', region);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        renderStories(parsed);
                        return;
                    }
                }
            } catch (e) {}
        }
        renderStories(DEFAULT_STORIES);
    }

    if (storiesRegionSelect) {
        storiesRegionSelect.addEventListener('change', (e) => {
            fetchStories(e.target.value);
        });
    }

    window.addEventListener('fokk-live-news-updated', (event) => {
        if (event.detail && Array.isArray(event.detail)) {
            renderStories(event.detail);
        }
    });

    // Initialize Page
    loadWallpaper();
    renderShortcuts();
    fetchStories('global');
})();

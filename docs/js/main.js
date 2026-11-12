/**
 * Fokk Browser Official Website — Client Logic
 * Modern, interactive script handling:
 * - Light / Dark Theme switching with localStorage persistence
 * - OS detection for dynamic hero download CTA
 * - Hero Bento Search Engine switcher & privacy search trigger
 * - Hero Bento Video Shield interactive Before / After simulation
 * - Interactive Browser Mockup viewport switcher (Dual / Quad / 4K Sailboat)
 * - FAQ Accordion, Navbar Scroll, and Checksum clipboard copy
 */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Theme Switcher (Dark / Light)
    initThemeToggle();

    // 1. Dynamic Platform Detection
    detectUserPlatform();

    // 2. Bento Card 1: Multi-Engine Search
    initBentoSearch();

    // 3. Bento Card 2: Interactive Shield Demo
    initShieldDemo();

    // 4. Interactive Browser Mockup View Switcher
    initMockupSwitcher();

    // 5. FAQ Accordion
    initFaqAccordion();

    // 6. Navbar Scroll Shadow
    initNavbarScroll();

    // 7. Checksum Copy to Clipboard
    initCopyChecksum();

    // 8. Mobile Navigation Drawer
    initMobileMenu();
});

/**
 * Handles Dark / Light Theme Toggle & Persistence
 */
function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('fokk_web_theme') || 'dark';

    if (savedTheme === 'light') {
        document.documentElement.classList.add('theme-light');
        document.body.classList.add('theme-light');
    } else {
        document.documentElement.classList.remove('theme-light');
        document.body.classList.remove('theme-light');
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('theme-light');
            const isLight = document.body.classList.toggle('theme-light');
            localStorage.setItem('fokk_web_theme', isLight ? 'light' : 'dark');
        });
    }
}

/**
 * Detects visitor's Operating System and dynamically personalizes Hero CTA and Download Card
 */
function detectUserPlatform() {
    const ua = navigator.userAgent || '';
    let os = 'windows';
    let osLabel = 'Windows';
    let fileFormat = '.exe / .zip';
    let downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.2.0/Fokk.Browser.1.2.0.exe';

    if (/android/i.test(ua)) {
        os = 'android';
        osLabel = 'Android';
        fileFormat = '.apk';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/v2.3.6/app-debug.apk';
    } else if (/macintosh|mac os x/i.test(ua)) {
        os = 'mac';
        osLabel = 'macOS';
        fileFormat = '.zip';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.2.0/Fokk.Browser-1.2.0-arm64-mac.zip';
    } else if (/linux/i.test(ua)) {
        os = 'linux';
        osLabel = 'Linux';
        fileFormat = '.AppImage / .deb';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.2.0/Fokk.Browser-1.2.0.AppImage';
    } else if (/windows/i.test(ua)) {
        os = 'windows';
        osLabel = 'Windows';
        fileFormat = '.exe / .zip';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.2.0/Fokk.Browser.1.2.0.exe';
    }

    // Update Hero Dynamic Button
    const heroBtn = document.getElementById('heroDynamicDownloadBtn');
    const heroOsLabel = document.getElementById('heroOsLabel');
    const heroOsSub = document.getElementById('heroOsSub');

    if (heroBtn && heroOsLabel && heroOsSub) {
        heroBtn.href = downloadUrl;
        heroOsLabel.textContent = `Download for ${osLabel}`;
        heroOsSub.textContent = `v1.2.0 • 64-bit (${fileFormat}) • Free`;
    }

    // Highlight Detected Card in Download Grid
    const matchingCard = document.querySelector(`.download-card[data-os="${os}"]`);
    if (matchingCard) {
        matchingCard.classList.add('active-os');
        if (!matchingCard.querySelector('.os-detected-badge')) {
            const badge = document.createElement('div');
            badge.className = 'os-detected-badge';
            badge.textContent = 'Detected OS';
            matchingCard.appendChild(badge);
        }
    }
}

/**
 * Bento Search Box: Multi-Engine switcher and private query dispatcher
 */
function initBentoSearch() {
    const engineBtns = document.querySelectorAll('.engine-pill');
    const searchInput = document.getElementById('bentoSearchInput');
    const searchForm = document.getElementById('bentoSearchForm');

    let activeEngine = 'duckduckgo';

    const placeholders = {
        'duckduckgo': 'Search with DuckDuckGo (zero trackers)...',
        'google': 'Search with Google (unprofiled)...',
        'bing': 'Search with Bing (clean)...',
        'brave': 'Search with Brave Search (independent index)...'
    };

    engineBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            engineBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeEngine = btn.dataset.engine || 'duckduckgo';
            if (searchInput && placeholders[activeEngine]) {
                searchInput.placeholder = placeholders[activeEngine];
                searchInput.focus();
            }
        });
    });

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (!query) return;

            let targetUrl = '';
            switch (activeEngine) {
                case 'google':
                    targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    break;
                case 'bing':
                    targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                    break;
                case 'brave':
                    targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
                    break;
                case 'duckduckgo':
                default:
                    targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                    break;
            }

            window.open(targetUrl, '_blank', 'noopener,noreferrer');
        });
    }
}

/**
 * Bento Shield: Interactive Before/After Toggle
 */
function initShieldDemo() {
    const btnClean = document.getElementById('btnShieldOn');
    const btnAds = document.getElementById('btnShieldOff');
    const demoBadge = document.getElementById('shieldDemoBadge');
    const demoStatus = document.getElementById('shieldDemoStatus');
    const videoTime = document.getElementById('shieldVideoTime');
    const demoScreen = document.getElementById('shieldDemoScreen');

    if (!btnClean || !btnAds) return;

    btnClean.addEventListener('click', () => {
        btnClean.classList.add('active');
        btnAds.classList.remove('ad-active');
        if (demoBadge) {
            demoBadge.className = 'shield-demo-badge';
            demoBadge.innerHTML = '<span class="badge-dot" style="background:#10B981"></span><span>Clean 1.0x Realtime • 0 Ads</span>';
        }
        if (videoTime) {
            videoTime.textContent = '1080p 60fps • 0s delay • 1.0x native';
            videoTime.style.color = '#94A3B8';
        }
        if (demoScreen) {
            demoScreen.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        }
    });

    btnAds.addEventListener('click', () => {
        btnAds.classList.add('ad-active');
        btnClean.classList.remove('active');
        if (demoBadge) {
            demoBadge.className = 'shield-demo-badge warning';
            demoBadge.innerHTML = '<span class="badge-dot" style="background:#F43F5E"></span><span>⚠ Ad 1 of 2 (0:30) • Playback Throttled</span>';
        }
        if (videoTime) {
            videoTime.textContent = 'Playback paused by 30s unskippable ad • Warning detected';
            videoTime.style.color = '#F43F5E';
        }
        if (demoScreen) {
            demoScreen.style.borderColor = 'rgba(244, 63, 94, 0.5)';
        }
    });
}

/**
 * Handles switching between Dual Split, Quad 4-Pane, and Start Page views in the hero mockup
 */
function initMockupSwitcher() {
    const switchBtns = document.querySelectorAll('.view-switch-btn');
    const mockupSlides = document.querySelectorAll('.mockup-view-slide');
    const omniboxUrl = document.getElementById('mockupOmniboxUrl');

    const urls = {
        'dual': 'fokk://split-view/left-right',
        'quad': 'fokk://quad-grid/2x2-power',
        'start': 'fokk://newtab (4K Sailboat & News)'
    };

    switchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;

            switchBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            mockupSlides.forEach(slide => {
                slide.classList.toggle('active', slide.dataset.view === targetView);
            });

            if (omniboxUrl && urls[targetView]) {
                omniboxUrl.textContent = urls[targetView];
            }
        });
    });
}

/**
 * FAQ Accordion Expand/Collapse
 */
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (!question) return;
        question.addEventListener('click', () => {
            const isOpen = item.classList.contains('open');

            // Close all
            faqItems.forEach(i => i.classList.remove('open'));

            // Toggle clicked
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });
}

/**
 * Sticky Navbar Elevation on Scroll
 */
function initNavbarScroll() {
    const nav = document.getElementById('siteNav');
    if (!nav) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

/**
 * Copy Checksum or Git Clone command
 */
function initCopyChecksum() {
    const copyBtns = document.querySelectorAll('[data-copy]');

    copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const textToCopy = btn.getAttribute('data-copy');
            if (!textToCopy) return;

            try {
                await navigator.clipboard.writeText(textToCopy);
                const originalText = btn.innerHTML;
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
                btn.style.borderColor = 'var(--primary)';
                btn.style.color = 'var(--primary)';

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }, 2000);
            } catch (_) {}
        });
    });
}

/**
 * Mobile Navigation Drawer & Hamburger Toggle
 */
function initMobileMenu() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const drawer = document.getElementById('mobileNavDrawer');
    if (!toggleBtn || !drawer) return;

    const toggle = (force) => {
        const isOpen = force !== undefined ? force : !drawer.classList.contains('is-open');
        drawer.classList.toggle('is-open', isOpen);
        toggleBtn.classList.toggle('is-active', isOpen);
        toggleBtn.setAttribute('aria-expanded', isOpen);
        drawer.setAttribute('aria-hidden', !isOpen);
        document.body.classList.toggle('mobile-menu-open', isOpen);
    };

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });

    // Close when tapping any navigation link inside drawer
    drawer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggle(false);
        });
    });

    // Close when clicking outside drawer
    document.addEventListener('click', (e) => {
        if (drawer.classList.contains('is-open') && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
            toggle(false);
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
            toggle(false);
        }
    });
}

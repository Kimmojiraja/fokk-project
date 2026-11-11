/**
 * Fokk Browser Official Website — Client Logic
 * Auto-detects user platform, handles interactive mockup toggling, FAQs, and checksum copies.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Dynamic Platform Detection
    detectUserPlatform();

    // 2. Interactive Browser Mockup View Switcher
    initMockupSwitcher();

    // 3. FAQ Accordion
    initFaqAccordion();

    // 4. Navbar Scroll Shadow
    initNavbarScroll();

    // 5. Checksum Copy to Clipboard
    initCopyChecksum();
});

/**
 * Detects visitor's Operating System and dynamically personalizes Hero CTA and Download Card
 */
function detectUserPlatform() {
    const ua = navigator.userAgent || '';
    let os = 'windows';
    let osLabel = 'Windows';
    let fileFormat = '.exe';
    let downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0-win.zip';

    if (/android/i.test(ua)) {
        os = 'android';
        osLabel = 'Android';
        fileFormat = '.apk';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/latest/download/Fokk.apk';
    } else if (/macintosh|mac os x/i.test(ua)) {
        os = 'mac';
        osLabel = 'macOS';
        fileFormat = '.zip';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0-mac.zip';
    } else if (/linux/i.test(ua)) {
        os = 'linux';
        osLabel = 'Linux';
        fileFormat = '.AppImage / .deb';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0.AppImage';
    } else if (/windows/i.test(ua)) {
        os = 'windows';
        osLabel = 'Windows';
        fileFormat = '.exe / .zip';
        downloadUrl = 'https://github.com/Kimmojiraja/fokk-project/releases/download/desktop-v1.0.0/Fokk%20Browser-1.0.0-win.zip';
    }

    // Update Hero Dynamic Button
    const heroBtn = document.getElementById('heroDynamicDownloadBtn');
    const heroOsLabel = document.getElementById('heroOsLabel');
    const heroOsSub = document.getElementById('heroOsSub');

    if (heroBtn && heroOsLabel && heroOsSub) {
        heroBtn.href = downloadUrl;
        heroOsLabel.textContent = `Download for ${osLabel}`;
        heroOsSub.textContent = `v1.1.0 • 64-bit (${fileFormat}) • Free`;
    }

    // Highlight Detected Card in Download Grid
    const matchingCard = document.querySelector(`.download-card[data-os="${os}"]`);
    if (matchingCard) {
        matchingCard.classList.add('active-os');
        const badge = document.createElement('div');
        badge.className = 'os-detected-badge';
        badge.textContent = 'Detected OS';
        matchingCard.appendChild(badge);
    }
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
                btn.style.borderColor = 'var(--primary-cyan)';
                btn.style.color = 'var(--primary-cyan)';

                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.borderColor = '';
                    btn.style.color = '';
                }, 2000);
            } catch (_) {}
        });
    });
}

const fs = require('fs');
const path = require('path');

class AdBlockEngine {
    constructor(assetsDir) {
        this.assetsDir = assetsDir;
        this.blockedDomains = new Set();
        this.whitelistedDomains = new Set();
        this.customBlockedDomains = new Set();
        this.genericCosmeticRules = [];
        this.domainCosmeticRules = new Map();
        this.blockedKeywords = [
            '/pagead/',
            '/api/stats/ads',
            'ad_break',
            'doubleclick.net',
            'googlesyndication.com',
            'googleadservices.com',
            'taboola.com',
            'outbrain.com',
            'criteo.com',
            'amazon-adsystem.com',
            'exoclick.com',
            'trafficjunky.com',
            'juicyads.com',
            'popcash.net',
            'popads.net',
            'adsterra.com',
            'rubiconproject.com',
            'adnxs.com',
            'smartadserver.com',
            'scorecardresearch.com',
            'yandex.ru/ads',
            'adroll.com',
            'advertising.com'
        ];
        this.blockedCount = 0;
        this.recentBlockedUrls = new Map();
        this.init();
    }

    init() {
        // 1. Curated Adblock Rules (Network domains + Cosmetic rules)
        const rulesPath = path.join(this.assetsDir, 'adblock_rules_curated.txt');
        if (fs.existsSync(rulesPath)) {
            try {
                const lines = fs.readFileSync(rulesPath, 'utf8').split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const trimmed = lines[i].trim();
                    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('@@')) continue;

                    if (trimmed.startsWith('||') && trimmed.includes('^')) {
                        const domain = trimmed.substring(2, trimmed.indexOf('^')).toLowerCase();
                        if (domain && domain.length > 3 && !domain.includes('/')) {
                            this.blockedDomains.add(domain);
                        }
                    } else if (trimmed.startsWith('##')) {
                        const sel = trimmed.substring(2).trim();
                        if (sel && !sel.includes(':has-text') && !sel.includes(':xpath')) {
                            this.genericCosmeticRules.push(sel);
                        }
                    } else if (trimmed.includes('##') && !trimmed.startsWith('#')) {
                        const parts = trimmed.split('##');
                        const domains = parts[0].split(',');
                        const sel = parts[1].trim();
                        if (sel && !sel.includes(':has-text') && !sel.includes(':xpath')) {
                            for (let j = 0; j < domains.length; j++) {
                                const d = domains[j].trim().toLowerCase();
                                if (d) {
                                    let arr = this.domainCosmeticRules.get(d);
                                    if (!arr) {
                                        arr = [];
                                        this.domainCosmeticRules.set(d, arr);
                                    }
                                    arr.push(sel);
                                }
                            }
                        }
                    }
                }
                console.log(`[AdBlock] Loaded ${this.blockedDomains.size} domains, ${this.genericCosmeticRules.length} generic cosmetic rules, and ${this.domainCosmeticRules.size} domain-specific rules.`);
            } catch (err) {
                console.error('[AdBlock] Error reading curated rules:', err);
            }
        }

        // 2. Core Blocklist (AdShield core hostnames)
        const corePath = path.join(this.assetsDir, 'blocklist_core.txt');
        if (fs.existsSync(corePath)) {
            try {
                const coreLines = fs.readFileSync(corePath, 'utf8').split('\n');
                for (const line of coreLines) {
                    const trimmed = line.trim().toLowerCase();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
                        const host = trimmed.replace(/^0\.0\.0\.0\s+/, '').replace(/^127\.0\.0\.1\s+/, '').trim();
                        if (host && host.length > 3 && !host.includes('/')) {
                            this.blockedDomains.add(host);
                        }
                    }
                }
                console.log(`[AdBlock] Total active block rules: ${this.blockedDomains.size}`);
            } catch (err) {
                console.error('[AdBlock] Error reading core blocklist:', err);
            }
        }

        // 3. Cache injection scripts
        this.injectJs = '';
        this.defusersJs = '';
        this.readerJs = '';
        this.summarizerJs = '';

        try {
            const injectPath = path.join(this.assetsDir, 'inject_adshield.js');
            if (fs.existsSync(injectPath)) this.injectJs = fs.readFileSync(injectPath, 'utf8');

            const defusersPath = path.join(this.assetsDir, 'adblock_defusers.js');
            if (fs.existsSync(defusersPath)) this.defusersJs = fs.readFileSync(defusersPath, 'utf8');

            const readerPath = path.join(this.assetsDir, 'fokk_reader.js');
            if (fs.existsSync(readerPath)) this.readerJs = fs.readFileSync(readerPath, 'utf8');

            const summarizerPath = path.join(this.assetsDir, 'fokk_summarizer.js');
            if (fs.existsSync(summarizerPath)) this.summarizerJs = fs.readFileSync(summarizerPath, 'utf8');
        } catch (e) {
            console.error('[AdBlock] Error loading injection scripts:', e);
        }
    }

    setWhitelist(domains) {
        this.whitelistedDomains = new Set((domains || []).map(d => d.toLowerCase().trim()));
    }

    setCustomBlocked(domains) {
        this.customBlockedDomains = new Set((domains || []).map(d => d.toLowerCase().trim()));
    }

    recordBlock(url) {
        const now = Date.now();
        let key = url;
        try {
            const u = new URL(url);
            key = u.origin + u.pathname;
        } catch (_) {}

        const last = this.recentBlockedUrls.get(key);
        // Deduplicate and suppress repeated retry loops of the same endpoint within 30 seconds
        if (!last || (now - last) > 30000) {
            this.blockedCount++;
            this.recentBlockedUrls.set(key, now);
            if (this.recentBlockedUrls.size > 500) {
                for (const [k, v] of this.recentBlockedUrls) {
                    if (now - v > 60000) this.recentBlockedUrls.delete(k);
                }
            }
        }
        return true;
    }

    shouldBlock(url, resourceType) {
        if (!url || typeof url !== 'string') return false;
        const lowerUrl = url.toLowerCase();

        // Never block internal app resources
        if (lowerUrl.startsWith('file:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('devtools:') || lowerUrl.startsWith('chrome:')) {
            return false;
        }

        // Allow core media stream chunks (HLS, DASH, audio/video)
        const isMedia = resourceType === 'media' ||
            lowerUrl.includes('.m3u8') ||
            lowerUrl.includes('.mpd') ||
            lowerUrl.includes('.ts') ||
            lowerUrl.includes('.m4s') ||
            lowerUrl.includes('googlevideo.com/videoplayback');

        // Check Whitelist first
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            if (this.whitelistedDomains.has(host)) return false;
            const parts = host.split('.');
            if (parts.length > 2) {
                const parentDomain = parts.slice(1).join('.');
                if (this.whitelistedDomains.has(parentDomain)) return false;
            }

            // Check Custom Blacklisted domains
            if (this.customBlockedDomains.has(host)) {
                return this.recordBlock(url);
            }
        } catch (_) {}

        // YouTube ad endpoints isolation
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
            const isYtAd = lowerUrl.includes('/pagead/') ||
                lowerUrl.includes('/api/stats/ads') ||
                lowerUrl.includes('ad_break') ||
                lowerUrl.includes('get_midroll_info') ||
                lowerUrl.includes('doubleclick.net') ||
                lowerUrl.includes('googleads.g.doubleclick.net') ||
                lowerUrl.includes('googlesyndication.com') ||
                lowerUrl.includes('static.doubleclick.net') ||
                lowerUrl.includes('adservice.google.com');
            if (isYtAd && !isMedia) {
                return this.recordBlock(url);
            }
            return false;
        }

        // Twitter / X ad endpoints
        if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
            const isXAd = lowerUrl.includes('ads-api.twitter.com') ||
                lowerUrl.includes('analytics.twitter.com') ||
                lowerUrl.includes('ads-twitter.com') ||
                lowerUrl.includes('static.ads-twitter.com') ||
                lowerUrl.includes('/i/api/1.1/promoted_trend');
            if (isXAd) return this.recordBlock(url);
        }

        // Instagram / Meta ad endpoints
        if (lowerUrl.includes('instagram.com') || lowerUrl.includes('facebook.com')) {
            const isMetaAd = lowerUrl.includes('logging_client_events') ||
                lowerUrl.includes('connect.facebook.net') ||
                lowerUrl.includes('pixel.facebook.com') ||
                lowerUrl.includes('an.facebook.com');
            if (isMetaAd) return this.recordBlock(url);
        }

        if (isMedia) return false;

        // Extract hostname and full subdomain walk
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            let current = host;
            while (current.includes('.')) {
                if (this.blockedDomains.has(current)) {
                    return this.recordBlock(url);
                }
                const dotIdx = current.indexOf('.');
                current = current.substring(dotIdx + 1);
                if (!current.includes('.')) break;
            }
        } catch (_) {}

        // Check keyword patterns
        for (const kw of this.blockedKeywords) {
            if (lowerUrl.includes(kw)) {
                return this.recordBlock(url);
            }
        }

        return false;
    }

    getStats() {
        return {
            blocked: this.blockedCount,
            blockedCount: this.blockedCount,
            activeRules: this.blockedDomains.size + this.customBlockedDomains.size + this.genericCosmeticRules.length + this.domainCosmeticRules.size,
            defusersEnabled: true
        };
    }

    getCosmeticCSS(hostname) {
        const selectors = [];
        if (hostname) {
            let cur = hostname.toLowerCase();
            while (cur.includes('.')) {
                const rules = this.domainCosmeticRules.get(cur);
                if (rules && rules.length > 0) selectors.push(...rules);
                const dotIdx = cur.indexOf('.');
                cur = cur.substring(dotIdx + 1);
                if (!cur.includes('.')) break;
            }
        }

        // Dedicated first-class sponsored & ad rules for major platforms
        if (hostname.includes('google.')) {
            selectors.push(
                '#tads', '#tadsb', '#bottomads', '.uEierd', '[data-text-ad]',
                'div[aria-label="Ads"]', 'div[aria-label="Sponsored"]', 'div:has(> [data-text-ad])',
                'div:has(> div > [data-text-ad])', '.commercial-unit-mobile-bottom', '.commercial-unit-desktop-top'
            );
        } else if (hostname.includes('bing.')) {
            selectors.push(
                '.b_ad', '.b_adSlug', '.b_adBottom', '.text-ads-container', 'a[href*="/aclick?ld="]',
                'li:has(.b_ad)', 'li:has(.b_adSlug)', 'div[aria-label="Sponsored"]', 'cs-native-ad-card'
            );
        } else if (hostname.includes('youtube.') || hostname.includes('youtu.be')) {
            selectors.push(
                '#masthead-ad', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer',
                'ytd-banner-promo-renderer', 'ytd-promoted-video-renderer', 'ytd-display-ad-renderer',
                'ytd-statement-banner-renderer', '.ytd-action-companion-ad-renderer', 'ytd-mealbar-promo-renderer',
                'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-sparkles-text-search-renderer',
                'ytd-compact-promoted-video-renderer', 'ytd-compact-promoted-item-renderer', 'ytd-search-pyv-renderer',
                'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
                'ytd-rich-item-renderer:has(ytd-ad-slot-renderer)', 'ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)',
                'ytd-rich-item-renderer:has(#ad-badge)', 'ytd-rich-item-renderer:has(.badge-shape-wiz--thumbnail-badge)',
                'ytd-rich-item-renderer:has([aria-label*="Sponsored" i])', 'ytd-rich-item-renderer:has(.badge-style-type-ad)',
                'ytd-video-renderer:has(ytd-ad-slot-renderer)', 'ytd-video-renderer:has([aria-label*="Sponsored" i])',
                'ytd-video-renderer:has(.badge-style-type-ad)', 'ytd-reel-video-renderer:has(ytd-ad-slot-renderer)',
                'ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)', '.ytp-ad-overlay-container',
                '.ytp-ad-message-container', '.ytp-ad-text', '.ytp-ad-preview-text', '.ytp-ad-progress-list',
                'div[class*="ad-showing"] .ytp-ad-text', '#shopping-timely-shelf',
                '#shorts-inner-container > .ytd-shorts:has(> .ytd-reel-video-renderer > ytd-ad-slot-renderer)',
                '#contents > ytd-rich-item-renderer:has(> ytd-ad-slot-renderer)',
                'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
                '.ytd-rich-grid-renderer:has(ytd-ad-slot-renderer)'
            );
        } else if (hostname.includes('amazon.')) {
            selectors.push(
                '.a-cardui[class*="_new-detail-faceout-box_"]:has(.dynamicSponsoredLabelClass)',
                'div[class*="SponsoredProducts"]', 'div[data-a-carousel-options*="isSponsoredProduct"]',
                'div[data-component-type="sp-sponsored-result"]', 'div[class*="sp-result-item"]'
            );
        }

        // Global curated generic ad selectors
        if (this.genericCosmeticRules && this.genericCosmeticRules.length > 0) {
            selectors.push(...this.genericCosmeticRules);
        }

        if (selectors.length === 0) return '';
        const unique = Array.from(new Set(selectors));
        return unique.join(',\n') + ' { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; }';
    }

    injectCosmeticFilters(webContents) {
        if (!webContents || webContents.isDestroyed()) return;
        const currentUrl = (webContents.getURL ? webContents.getURL() : '').toLowerCase();
        let hostname = '';
        try { hostname = new URL(currentUrl).hostname.toLowerCase(); } catch(_) {}

        // 1. Instant Native Chromium CSS Injection (applies across initial load and dynamic elements)
        const cosmeticCss = this.getCosmeticCSS(hostname);
        if (cosmeticCss) {
            webContents.insertCSS(cosmeticCss).catch(() => {});
        }

        const isYouTube = hostname.includes('youtube.com') || hostname.includes('youtu.be');
        const isTwitter = hostname.includes('twitter.com') || hostname.includes('x.com');
        const isInstagram = hostname.includes('instagram.com');

        if (isYouTube) {
            // Targeted YouTube Ultra-Shield Adblock (uBlock Origin Architecture):
            // 1. CSS Ad Cleanup (Already injected natively via insertCSS above)
            // 2. Initial + In-Flight SPA Player Response Sanitizer (strips adPlacements, playerAds, and adSlots)
            //    Safely targets player responses only, NEVER touching /youtubei/v1/guide (preserves sidebar & logos)
            // 3. Instant Video Ad Skip Trigger (0ms ad jump & auto skip button click)
            // 4. Procedural Sponsored Card Scrubber (cleans home feed, search, and shorts)
            const ytCleanScript = `
                try {
                    if (!window.__fokk_yt_cleaned) {
                        window.__fokk_yt_cleaned = true;

                        const sanitizeYtObject = (obj) => {
                            if (!obj || typeof obj !== 'object') return obj;
                            if (obj.adPlacements) delete obj.adPlacements;
                            if (obj.playerAds) delete obj.playerAds;
                            if (obj.adSlots) delete obj.adSlots;
                            if (obj.adBreaks) delete obj.adBreaks;
                            if (obj.adPlacementConfig) delete obj.adPlacementConfig;
                            if (obj.playerConfig && obj.playerConfig.adConfig) delete obj.playerConfig.adConfig;
                            if (obj.playerResponse && typeof obj.playerResponse === 'object') {
                                sanitizeYtObject(obj.playerResponse);
                            }
                            return obj;
                        };

                        // 1. Initial Page Load
                        if (window.ytInitialPlayerResponse) {
                            sanitizeYtObject(window.ytInitialPlayerResponse);
                        }
                        try {
                            let _ytInitialPlayerResponse = window.ytInitialPlayerResponse;
                            Object.defineProperty(window, 'ytInitialPlayerResponse', {
                                get: () => _ytInitialPlayerResponse,
                                set: (val) => {
                                    _ytInitialPlayerResponse = sanitizeYtObject(val);
                                },
                                configurable: true
                            });
                        } catch(_) {}

                        // 2. SPA Navigations: Intercept Response.prototype.json strictly for player responses
                        // Does NOT intercept /youtubei/v1/guide, leaving YouTube sidebar & drawer 100% untouched!
                        try {
                            if (window.Response && Response.prototype && Response.prototype.json) {
                                const origJson = Response.prototype.json;
                                Response.prototype.json = async function() {
                                    const data = await origJson.apply(this, arguments);
                                    try {
                                        if (data && typeof data === 'object') {
                                            if (data.adPlacements || data.playerAds || data.adSlots || data.adBreaks || (data.playerConfig && data.playerConfig.adConfig)) {
                                                sanitizeYtObject(data);
                                            }
                                            if (data.playerResponse && typeof data.playerResponse === 'object') {
                                                sanitizeYtObject(data.playerResponse);
                                            }
                                        }
                                    } catch(_) {}
                                    return data;
                                };
                            }
                        } catch(_) {}

                        // 3. Instant Video Ad Skip Trigger
                        function defuseVideoAd() {
                            const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
                            const isAd = document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay') ||
                                         document.querySelector('.video-ads:not(:empty)');
                            if (isAd && video) {
                                const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                                if (player && typeof player.skipAd === 'function') {
                                    try { player.skipAd(); } catch (_) {}
                                }
                                if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
                                    try { video.currentTime = video.duration; } catch (_) {}
                                }
                                const skipBtns = document.querySelectorAll(
                                    '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button, .ytp-ad-skip-button-container button'
                                );
                                skipBtns.forEach(btn => {
                                    try { btn.click(); } catch (_) {}
                                });
                            }
                        }

                        setInterval(defuseVideoAd, 150);
                        document.addEventListener('play', () => defuseVideoAd(), true);
                        document.addEventListener('timeupdate', () => defuseVideoAd(), true);

                        // 4. Procedural Sponsored Card Scrubber (Home, Search Results, Up Next, & Shorts)
                        function scrubSponsoredCards() {
                            const candidates = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-reel-video-renderer, ytd-compact-video-renderer');
                            for (let i = 0; i < candidates.length; i++) {
                                const el = candidates[i];
                                if (el.style.display === 'none') continue;
                                if (el.querySelector('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, .badge-style-type-ad, #ad-badge, [aria-label*="Sponsored" i]')) {
                                    el.style.setProperty('display', 'none', 'important');
                                    continue;
                                }
                                const badges = el.querySelectorAll('badge-shape-wiz, .ytd-badge-supported-renderer, span');
                                for (let b = 0; b < badges.length; b++) {
                                    const txt = (badges[b].textContent || '').trim().toLowerCase();
                                    if (txt === 'sponsored' || txt === 'ad' || txt === 'promoted') {
                                        el.style.setProperty('display', 'none', 'important');
                                        break;
                                    }
                                }
                            }
                        }

                        setInterval(scrubSponsoredCards, 350);
                    }
                } catch (e) {}
            `;
            webContents.executeJavaScript(ytCleanScript).catch(() => {});
            return;
        }

        if (isTwitter) {
            // Twitter / X Sponsored & Promoted Tweet Defusers
            const xCleanScript = `
                try {
                    if (!window.__fokk_x_cleaned) {
                        window.__fokk_x_cleaned = true;
                        const style = document.createElement('style');
                        style.textContent = \`
                            [data-testid="placementTracking"],
                            article:has([data-testid="placementTracking"]),
                            div[data-testid="trend"]:has([data-testid="promotedIndicator"]),
                            div:has(> a[href*="quick_promote"]),
                            aside[aria-label*="Subscribe" i] {
                                display: none !important;
                            }
                        \`;
                        (document.head || document.documentElement).appendChild(style);
                    }
                } catch(e) {}
            `;
            webContents.executeJavaScript(xCleanScript).catch(() => {});
            return;
        }

        if (isInstagram) {
            // Instagram Sponsored Post & Stories Defusers
            const igCleanScript = `
                try {
                    if (!window.__fokk_ig_cleaned) {
                        window.__fokk_ig_cleaned = true;
                        const style = document.createElement('style');
                        style.textContent = \`
                            article:has(a[href*="/about/ads/"]),
                            div:has(> a[href*="/ads/"]),
                            div:has(> div > a[href*="/about/ads/"]) {
                                display: none !important;
                            }
                        \`;
                        (document.head || document.documentElement).appendChild(style);
                    }
                } catch(e) {}
            `;
            webContents.executeJavaScript(igCleanScript).catch(() => {});
            return;
        }

        const combined = `
            try {
                if (!window.__fokk_injected) {
                    window.__fokk_injected = true;
                    ${this.injectJs}
                    ${this.defusersJs}
                }
            } catch(e) {}
        `;
        webContents.executeJavaScript(combined).catch(() => {});
    }
}

module.exports = AdBlockEngine;

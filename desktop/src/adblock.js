const fs = require('fs');
const path = require('path');

function isValidSelector(sel) {
    if (!sel || typeof sel !== 'string') return false;
    const s = sel.trim();
    if (s.length < 2) return false;
    // Discard uBlock scriptlet rules, procedural filters, and invalid CSS syntax
    if (s.startsWith('+') || s.startsWith('^') || s.startsWith('@') || s.startsWith('!')) return false;
    if (s.includes('+js(')) return false;
    if (s.includes(':upward(')) return false;
    if (s.includes(':has-text(')) return false;
    if (s.includes(':xpath(')) return false;
    if (s.includes(':matches-')) return false;
    if (s.includes(':watch-attr(')) return false;
    if (s.includes(':min-text-length(')) return false;
    if (s.includes('[-ext-')) return false;
    // Check balanced brackets and parens
    const openBrackets = (s.match(/\[/g) || []).length;
    const closeBrackets = (s.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) return false;
    const openParens = (s.match(/\(/g) || []).length;
    const closeParens = (s.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;
    return true;
}

class AdBlockEngine {
    constructor(assetsDir) {
        this.assetsDir = assetsDir;
        this.blockedDomains = new Set();
        this.whitelistedDomains = new Set();
        this.customBlockedDomains = new Set();
        this.blockedPaths = new Map(); // Map<domain, string[]>
        this.genericCosmeticRules = [];
        this.domainCosmeticRules = new Map();
        this.blockedKeywords = [
            // Major ad networks & ad servers
            'doubleclick.net',
            'googlesyndication.com',
            'googleadservices.com',
            'google-analytics.com',
            'googletagmanager.com',
            'googletagservices.com',
            'partner.googleadservices.com',
            'taboola.com',
            'taboolasyndication.com',
            'outbrain.com',
            'outbrainimg.com',
            'criteo.com',
            'criteo.net',
            'amazon-adsystem.com',
            'adnxs.com',
            'ib.adnxs.com',
            'rubiconproject.com',
            'pubmatic.com',
            'openx.net',
            'smartadserver.com',
            'casalemedia.com',
            'yieldmo.com',
            'revcontent.com',
            'mgid.com',
            'media.net',
            'ezoic.net',
            'ezoic.com',
            'mediavine.com',
            'adthrive.com',
            'scorecardresearch.com',
            'quantserve.com',
            'inmobi.com',
            'moatads.com',
            'adsafeprotected.com',
            'sharethrough.com',
            'triplelift.com',
            '33across.com',
            'sovrn.com',
            'indexexchange.com',
            'lijit.com',
            'bidswitch.net',
            'contextweb.com',
            'emxdgt.com',
            'rhythmone.com',
            'spotxchange.com',
            'undertone.com',
            'rlcdn.com',
            'demdex.net',
            'bluekai.com',
            'krxd.net',
            'omtrdc.net',
            'adsrvr.org',
            'mxpnl.com',
            'mixpanel.com',
            'segment.io',
            'segment.com',
            'amplitude.com',
            'hotjar.com',
            'fullstory.com',
            'mouseflow.com',
            'logrocket.com',
            'clarity.ms',
            'chartbeat.com',
            'carbonads.net',
            'carbonads.com',
            'buysellads.com',
            'buysellads.net',
            'adcolony.com',
            'ironsrc.com',
            'admob.com',
            'adlightning.com',
            'adsymptotic.com',
            'agkn.com',
            'adblade.com',
            'adkernel.com',
            'adtechus.com',
            'smartclip.net',
            'teads.tv',
            'connatix.com',
            'anyclip.com',
            'exco.com',
            'exponential.com',
            'adition.com',
            'adsupply.com',
            'admanmedia.com',
            'zergnet.com',
            'postrelease.com',
            'nativeads.com',
            'exoclick.com',
            'trafficjunky.com',
            'trafficjunky.net',
            'juicyads.com',
            'popcash.net',
            'popads.net',
            'adsterra.com',
            'monetag.com',
            'propellerads.com',
            'clickadu.com',
            'hilltopads.com',
            'admaven.com',
            'twinred.com',
            'trafficstars.com',
            'trafficfactory.com',
            'ero-advertising.com',
            'livejasmin.com',
            'doublepimp.com',
            'ad-score.com',
            'adglare.com',
            'adbutler.com',
            'adcovery.com',
            'adextent.com',
            'adfactor.nl',
            'adfalcon.com',
            'adflex.co.uk',
            'adfrontiers.com',
            'adgear.com',
            'adhigh.net',
            'adhost.com',
            'adknife.com',
            'admagnet.net',
            'admixer.net',
            'adoperator.com',
            'adoptim.com',
            'adotmob.com',
            'adperium.com',
            'adpushup.com',
            'adrevolver.com',
            'adriver.ru',
            'adrta.com',
            'ads-twitter.com',
            'adskeeper.co.uk',
            'adserver01.de',
            'adside.com',
            'adsnative.com',
            'adspeed.com',
            'adspirit.de',
            'adtile.me',
            'adup-tech.com',
            'advangelists.com',
            'adventori.com',
            'adverline.com',
            'adzerk.net',
            'bat.bing.com',
            // Ad script & request paths
            '/pagead/',
            '/pagead2/',
            '/api/stats/ads',
            '/gampad/',
            '/adsbygoogle',
            'adsbygoogle.js',
            '/adservice.',
            '/adservices.',
            '/adserver.',
            '/adserver/',
            '/adclick.',
            '/adbanner.',
            '/advertisement.',
            '/advertisements/',
            '/sponsor_ads/',
            '/sponsored_post',
            '/wp-content/plugins/ad-',
            '/wp-content/plugins/adsense-',
            '/wp-content/plugins/adrotate',
            '/wp-content/plugins/advanced-ads',
            'prebid.js',
            'prebid.org',
            // AMP ads
            '/v0/amp-ad',
            'amp-ad-0.1.js',
            'amp-sticky-ad',
            // Additional trackers
            'google-analytics.com/analytics.js',
            'google-analytics.com/ga.js',
            'google-analytics.com/collect',
            'googletagmanager.com/gtag',
            '/ptracking',
            '/ad_break',
            'ad_type=instream'
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
                    if (!trimmed) continue;

                    // Handle whitelist (@@) rules - parse into whitelistedDomains
                    if (trimmed.startsWith('@@||') && trimmed.includes('^')) {
                        // Extract whitelisted domain (between @@|| and first ^ or $ or /)
                        let wRule = trimmed.substring(4);
                        let wDelim = wRule.search(/[\^\$\/]/);
                        const wDom = (wDelim !== -1 ? wRule.substring(0, wDelim) : wRule).toLowerCase().trim();
                        if (wDom && wDom.length > 2 && !wDom.includes('*') && wDom.includes('.')) {
                            this.whitelistedDomains.add(wDom);
                        }
                        continue;
                    }
                    if (trimmed.startsWith('!') || trimmed.startsWith('@@')) continue;

                    if (trimmed.startsWith('||')) {
                        let rule = trimmed.substring(2);
                        let delimIdx = -1;
                        for (let j = 0; j < rule.length; j++) {
                            const c = rule[j];
                            if (c === '^' || c === '/' || c === '$') {
                                delimIdx = j;
                                break;
                            }
                        }
                        if (delimIdx === -1) continue;
                        const dom = rule.substring(0, delimIdx).toLowerCase().trim();
                        // FIX: Only add to blockedDomains when delimiter is '^' (pure domain block)
                        // Path-based rules (delimiter='/') must NOT pollute blockedDomains with legitimate roots like google.com
                        if (rule[delimIdx] === '^') {
                            if (dom && dom.length > 3 && !dom.includes('*') && dom.includes('.')) {
                                this.blockedDomains.add(dom);
                            }
                        } else if (rule[delimIdx] === '/') {
                            // Store path paired with its domain to avoid false positives on generic paths
                            const pathPart = rule.substring(delimIdx).replace(/[\^\$].*$/, '').toLowerCase().trim();
                            if (pathPart.length > 2 && !pathPart.includes('*') && dom && dom.includes('.')) {
                                let paths = this.blockedPaths.get(dom);
                                if (!paths) { paths = []; this.blockedPaths.set(dom, paths); }
                                paths.push(pathPart);
                            }
                        }
                    } else if (trimmed.startsWith('##')) {
                        const sel = trimmed.substring(2).trim();
                        if (isValidSelector(sel)) {
                            this.genericCosmeticRules.push(sel);
                        }
                    } else if (trimmed.includes('##') && !trimmed.startsWith('#')) {
                        const parts = trimmed.split('##');
                        const sel = parts[1].trim();
                        if (isValidSelector(sel)) {
                            const domains = parts[0].split(',');
                            for (let j = 0; j < domains.length; j++) {
                                const d = domains[j].replace(/#.*$/, '').trim().toLowerCase();
                                if (d && d.includes('.')) {
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

        let host = '';
        try {
            const parsed = new URL(url);
            host = parsed.hostname.toLowerCase();
        } catch (_) {}

        // YouTube internal requests isolation - MUST run before whitelist walk
        // youtube.com is in the curated whitelist (for video content), but its ad endpoints must still be blocked.
        const isYtHost = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host.endsWith('.youtu.be');
        if (isYtHost) {
            const isYtAd = lowerUrl.includes('/pagead/') ||
                lowerUrl.includes('/api/stats/ads') ||
                lowerUrl.includes('/api/stats/qoe') ||
                lowerUrl.includes('/api/stats/atr') ||
                lowerUrl.includes('/ptracking') ||
                lowerUrl.includes('ad_break') ||
                lowerUrl.includes('get_midroll_info') ||
                lowerUrl.includes('doubleclick.net') ||
                lowerUrl.includes('googleads.g.doubleclick.net') ||
                lowerUrl.includes('googlesyndication.com') ||
                lowerUrl.includes('static.doubleclick.net') ||
                lowerUrl.includes('adservice.google.com') ||
                lowerUrl.includes('/youtubei/v1/player/ad_break');
            if (isYtAd && !isMedia) {
                return this.recordBlock(url);
            }
            return false; // All other youtube.com requests (video, thumbnails, guide) are allowed
        }

        // Critical-safe domains: exact hostname AND parent domain walk (payments, auth, CDNs)
        // These are small, well-known and don't have tracking subdomains that need blocking.
        const CRITICAL_SAFE_PARENTS = new Set([
            'paypal.com', 'paypalobjects.com', 'stripe.com', 'stripe.network',
            'razorpay.com', 'visa.com', 'mastercard.com', 'americanexpress.com', 'plaid.com',
            'gstatic.com', 'googleapis.com', 'googlevideo.com', 'ytimg.com', 'ggpht.com',
            'googleusercontent.com', 'accounts.google.com', 'pay.google.com',
            'whatsapp.com', 'whatsapp.net', 'web.whatsapp.com',
            'wikipedia.org', 'wikimedia.org',
            'github.com', 'githubusercontent.com',
            'apple.com', 'icloud.com',
            'microsoft.com', 'azure.com', 'windows.com', 'live.com', 'outlook.com',
            'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in', 'amazon.ca',
            'amazonaws.com', 'cloudfront.net',
            'recaptcha.net', 'hcaptcha.com'
        ]);
        if (host) {
            let curSafe = host;
            while (curSafe) {
                if (CRITICAL_SAFE_PARENTS.has(curSafe)) return false;
                const dot = curSafe.indexOf('.');
                if (dot === -1) break;
                curSafe = curSafe.substring(dot + 1);
            }
        }

        // Curated @@ whitelist: EXACT hostname match only (no parent walk)
        // Prevents tracking subdomains like bat.bing.com from inheriting bing.com's whitelist status.
        if (host && this.whitelistedDomains.has(host)) return false;

        // Check Custom Blacklisted domains (user-defined) across parent domains
        if (host) {
            let curC = host;
            while (curC) {
                if (this.customBlockedDomains.has(curC)) return this.recordBlock(url);
                const dot = curC.indexOf('.');
                if (dot === -1) break;
                curC = curC.substring(dot + 1);
            }
        }

        // Twitter / X ad endpoints
        if (host.includes('twitter.com') || host.includes('x.com')) {
            const isXAd = lowerUrl.includes('ads-api.twitter.com') ||
                lowerUrl.includes('analytics.twitter.com') ||
                lowerUrl.includes('ads-twitter.com') ||
                lowerUrl.includes('static.ads-twitter.com') ||
                lowerUrl.includes('/i/api/1.1/promoted_trend') ||
                lowerUrl.includes('/i/api/2/promoted_trend');
            if (isXAd) return this.recordBlock(url);
        }

        // Instagram / Meta ad endpoints
        if (host.includes('instagram.com') || host.includes('facebook.com')) {
            const isMetaAd = lowerUrl.includes('logging_client_events') ||
                lowerUrl.includes('connect.facebook.net') ||
                lowerUrl.includes('pixel.facebook.com') ||
                lowerUrl.includes('an.facebook.com') ||
                lowerUrl.includes('ads.facebook.com');
            if (isMetaAd) return this.recordBlock(url);
        }

        if (isMedia) return false;

        // Subdomain walk against full blocklist (checks exact host and all suffixes)
        if (host) {
            let current = host;
            while (current) {
                if (this.blockedDomains.has(current)) {
                    return this.recordBlock(url);
                }
                const dotIdx = current.indexOf('.');
                if (dotIdx === -1) break;
                current = current.substring(dotIdx + 1);
            }
        }

        // Check curated ad path patterns (domain + path pairing to avoid false positives)
        if (host && this.blockedPaths.size > 0) {
            let pathHost = host;
            while (pathHost) {
                const paths = this.blockedPaths.get(pathHost);
                if (paths) {
                    for (let i = 0; i < paths.length; i++) {
                        if (lowerUrl.includes(paths[i])) {
                            return this.recordBlock(url);
                        }
                    }
                }
                const dotIdx2 = pathHost.indexOf('.');
                if (dotIdx2 === -1) break;
                pathHost = pathHost.substring(dotIdx2 + 1);
            }
        }

        // Check ad keyword patterns
        for (let i = 0; i < this.blockedKeywords.length; i++) {
            if (lowerUrl.includes(this.blockedKeywords[i])) {
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
            while (cur) {
                const rules = this.domainCosmeticRules.get(cur);
                if (rules && rules.length > 0) selectors.push(...rules);
                const dotIdx = cur.indexOf('.');
                if (dotIdx === -1) break;
                cur = cur.substring(dotIdx + 1);
            }
        }

        const isYouTube = hostname.includes('youtube.') || hostname.includes('youtu.be');

        if (isYouTube) {
            // Highly targeted YouTube ad selectors only.
            // NEVER inject generic ad selectors (div[class*="ad-"], .ad-module, etc.) on YouTube:
            // they collide with YouTube's WebComponents/Polymer masthead, search box, and feed containers.
            selectors.push(
                '#masthead-ad',
                'ytd-ad-slot-renderer',
                'ytd-in-feed-ad-layout-renderer',
                'ytd-banner-promo-renderer',
                'ytd-brand-video-singleton-renderer',
                'ytd-primetime-promo-renderer',
                'ytd-promoted-video-renderer',
                'ytd-display-ad-renderer',
                'ytd-statement-banner-renderer',
                '.ytd-action-companion-ad-renderer',
                'ytd-companion-slot-renderer',
                'ytd-mealbar-promo-renderer',
                'ytd-promoted-sparkles-web-renderer',
                'ytd-promoted-sparkles-text-search-renderer',
                'ytd-compact-promoted-video-renderer',
                'ytd-compact-promoted-item-renderer',
                'ytd-search-pyv-renderer',
                'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
                '#panels:has(ytd-ads-engagement-panel-content-renderer)',
                'ytd-ads-engagement-panel-content-renderer',
                'ytd-player-legacy-desktop-watch-ads-renderer',
                'ytd-rich-section-renderer:has(ytd-statement-banner-renderer)',
                'ytd-rich-section-renderer:has(ytd-brand-video-singleton-renderer)',
                'ytd-rich-section-renderer:has(ytd-ad-slot-renderer)',
                'ytd-rich-section-renderer:has(ytd-in-feed-ad-layout-renderer)',
                'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)',
                'ytd-rich-item-renderer:has(> ytd-ad-slot-renderer)',
                '#contents > ytd-rich-item-renderer:has(> ytd-ad-slot-renderer)',
                '#contents > ytd-rich-item-renderer:has(.ytd-ad-slot-renderer)',
                'ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)',
                'ytd-rich-item-renderer:has(#ad-badge)',
                'ytd-rich-item-renderer:has(.badge-style-type-ad)',
                'ytd-rich-item-renderer:has([aria-label*="Sponsored" i])',
                'ytd-video-renderer:has(ytd-ad-slot-renderer)',
                'ytd-video-renderer:has([aria-label*="Sponsored" i])',
                'ytd-video-renderer:has(.badge-style-type-ad)',
                'ytd-reel-video-renderer:has(ytd-ad-slot-renderer)',
                'ytd-reel-video-renderer:has(.ytd-ad-slot-renderer)',
                '#shorts-inner-container > .ytd-shorts:has(> .ytd-reel-video-renderer > ytd-ad-slot-renderer)',
                '.ytp-ad-module',
                '.ytp-ad-overlay-container',
                '.ytp-ad-message-container',
                '.ytp-ad-text',
                '.ytp-ad-preview-text',
                '.ytp-ad-progress-list',
                '#player-ads',
                'div[class*="ad-showing"] .ytp-ad-text',
                '#shopping-timely-shelf',
                'ytd-merch-shelf-renderer',
                'tp-yt-paper-dialog:has(#feedback)',
                '#fulfillment-element.ytd-ad-slot-renderer',
                'ytd-watch-next-secondary-results-renderer:has(ytd-compact-promoted-item-renderer)'
            );
        } else {
            // First-class cosmetic selectors for other major platforms
            if (hostname.includes('google.')) {
                selectors.push(
                    '#tads', '#tadsb', '#bottomads', '.uEierd', '[data-text-ad]',
                    'div[aria-label="Ads"]', 'div[aria-label="Sponsored"]',
                    'div:has(> [data-text-ad])', 'div:has(> div > [data-text-ad])',
                    'div:has(> div > div > [data-text-ad])',
                    '.commercial-unit-desktop-top', '.commercial-unit-desktop-rhs',
                    '.commercial-unit-mobile-top', '.commercial-unit-mobile-bottom',
                    '.pla-unit', '.pla-unit-container', '.cu-container',
                    'div[data-rw] > div:has([data-text-ad])', 'div[data-hveid]:has([data-text-ad])',
                    '.ads-ad', '.ads-fr', '.ads-visurl', '.shopping-carousel-container',
                    'div[data-pla="1"]', 'div[aria-label="Shopping results"]',
                    '.commercial-unit', '#tvcap', 'div[data-attrid="wa:/description"]:has([data-text-ad])',
                    '.mnr-c.pla-unit'
                );
            } else if (hostname.includes('bing.')) {
                selectors.push(
                    'li.b_ad', '.b_ad', '.b_adSlug', '.b_adBottom', '.b_adTop', '.b_adLastChild',
                    '.ads-container', '[data-tag="adSlot"]', '.text-ads-container', 'a[href*="/aclick?ld="]',
                    'li:has(.b_ad)', 'li:has(.b_adSlug)', 'div[aria-label="Sponsored"]',
                    'cs-native-ad-card', '.pa_carousel', 'li.b_algo:has(.b_adSlug)',
                    'li.b_algo:has(a[href*="/aclick?"])'
                );
            } else if (hostname.includes('amazon.')) {
                selectors.push(
                    'div[data-component-type="s-impression-logger"]', '.AdHolder', '.adsWrapper',
                    'div[cel_widget_id*="SP-"]', 'div[cel_widget_id*="SEARCH_RESULTS_SPONSORED_PRODUCTS"]',
                    'div[data-component-type*="sponsored"]',
                    '.s-result-item[data-asin]:has(span.puis-sponsored-label-text)',
                    'div[data-asin]:has(span.puis-sponsored-label-text)',
                    'div[data-asin]:has(span[aria-label*="Sponsored" i])',
                    'div:has(> span.puis-sponsored-label-text)', '.puis-sponsored-label-text',
                    'div[data-component-type="sp-sponsored-result"]',
                    '.a-cardui[class*="_new-detail-faceout-box_"]:has(.dynamicSponsoredLabelClass)',
                    'div[class*="SponsoredProducts"]', 'div[data-a-carousel-options*="isSponsoredProduct"]',
                    'div[class*="sp-result-item"]', '#ad', '#ad-desktop-atf', '#ad-desktop-btf',
                    '#sponsoredProducts2_feature_div', '#sponsoredProducts_feature_div', '#sp_detail', '#sp_detail2',
                    '#hsaSponsoredProducts', '#ape_Detail_hero-quick-promo_Desktop_placement',
                    '#ape_Detail_auto-load-middle-1_Desktop_placement'
                );
            } else if (hostname.includes('reddit.')) {
                selectors.push(
                    'shreddit-comment-ad', 'shreddit-ad-post', '[data-promoted=true]',
                    '.promoted-custom-collection-item', '[promoted=true]', '.PromotedLink',
                    'shreddit-async-loader[bundlename="feed_ads"]', 'div[data-adclicklocation]'
                );
            } else if (hostname.includes('linkedin.')) {
                selectors.push(
                    '.feed-shared-update-v2:has(.update-components-promo__label)',
                    'div[data-feed-type="SPONSORED"]', '.ad-banner-container', '.sponsored-content'
                );
            }

            // Global generic ad & banner selectors (for all non-YouTube websites)
            selectors.push(
                'ins.adsbygoogle', '.adsbygoogle', '[id^="div-gpt-ad"]', '[id^="google_ads_iframe"]', '[data-google-query-id]',
                'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]', 'iframe[src*="adnxs.com"]',
                'iframe[src*="rubiconproject.com"]', 'iframe[src*="pubmatic.com"]', 'iframe[src*="openx.net"]',
                'iframe[src*="smartadserver.com"]', 'iframe[src*="criteo.com"]', 'iframe[src*="outbrain.com"]',
                'iframe[src*="taboola.com"]', 'iframe[src*="revcontent.com"]', 'iframe[src*="amazon-adsystem.com"]',
                'iframe[src*="exoclick.com"]', 'iframe[src*="trafficjunky.net"]', 'iframe[src*="juicyads.com"]',
                'iframe[src*="popads.net"]', 'iframe[src*="adsterra.com"]', 'iframe[src*="monetag.com"]', 'iframe[id*="google_ads"]',
                'div[id^="ad-"]', 'div[id^="ad_"]', 'div[id^="google_ads_"]', 'div[id^="dfp-ad-"]', 'div[id*="advertisement"]',
                'div[id^="adslot"]', 'div[id*="ad-slot"]', 'div[id*="ad-container"]', 'div[id*="ad-wrapper"]', 'div[id*="ad-banner"]',
                'div[class*="native-ad"]', 'div[class*="taboola"]', 'div[class*="outbrain"]', 'div[class*="mgid"]',
                'div[class*="revcontent"]', 'div[class*="sponsored-post"]', 'div[class*="sponsored-content"]',
                'div[class*="ad-container"]', 'div[class*="ad-wrapper"]', 'div[class*="ad-box"]', 'div[class*="ad-slot"]',
                'div[class*="ad-unit"]', 'div[class*="ad-banner"]', 'div[class*="ad_banner"]', 'div[class*="ad-placement"]',
                'div[class*="ad_placement"]', 'div[class*="ad-placeholder"]',
                '.ad-banner', '.ad-container', '.ad-box', '.ad-wrapper', '.ad-slot', '.ad-holder', '.ad-unit', '.ad-frame',
                '.ad-layer', '.ad-leaderboard', '.ad-sidebar', '.ad-placeholder', '.ad-module', '.ad-notice', '.ad-sponsor',
                '.ad-spot', '.banner-ad', '.banner_ad', '.banner-ads', '.sponsor-banner', '.sponsored-post', '.sponsored-content',
                '.sponsored-link', '.sponsored-item', '.sponsored-feed', '.exo-native-widget', '.tj_ads', '.juicy-ad',
                '.popunder-overlay', '.click-trap', '.anti-adblock', '.adblock-overlay', '.adblock-modal', '.adblock-backdrop',
                'div[data-ad-unit]', 'div[data-dfp-ad]', 'div[data-ad-slot]', 'div[data-ad-unit-id]', 'div[data-native-ad]',
                '.smartbanner', '.app-banner', '[class*="smartbanner"]', '[class*="open-in-app"]', '[class*="openInApp"]',
                '[id*="open-in-app"]', 'div[data-testid="upsell-banner"]', 'xpromo-app-selector',
                'shreddit-async-loader[bundlename="bottom_sheet"]'
            );

            if (this.genericCosmeticRules && this.genericCosmeticRules.length > 0) {
                selectors.push(...this.genericCosmeticRules);
            }
        }

        const validSelectors = selectors.filter(isValidSelector);
        if (validSelectors.length === 0) return '';
        const unique = Array.from(new Set(validSelectors));

        // Group selectors into batches of 30 to guarantee resilient parsing across all Chromium environments
        const chunks = [];
        for (let i = 0; i < unique.length; i += 30) {
            const batch = unique.slice(i, i + 30);
            chunks.push(batch.join(',\n') + ' { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; pointer-events: none !important; }');
        }


        return chunks.join('\n\n');
    }

    injectCosmeticFilters(webContents) {
        if (!webContents || webContents.isDestroyed()) return;
        const currentUrl = (webContents.getURL ? webContents.getURL() : '').toLowerCase();
        // Never run adblock cosmetic filters or anti-adblock defusers on internal browser UI pages
        if (!currentUrl || currentUrl.startsWith('file:') || currentUrl.startsWith('fokk:') || currentUrl === 'about:blank') {
            return;
        }
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

                        const sanitizeYtObject = (obj, depth) => {
                            if (!obj || typeof obj !== 'object') return obj;
                            if (!depth) depth = 0;
                            if (depth > 8) return obj;
                            if (Array.isArray(obj)) {
                                for (let i = 0; i < obj.length; i++) sanitizeYtObject(obj[i], depth + 1);
                                return obj;
                            }
                            if (obj.adPlacements) delete obj.adPlacements;
                            if (obj.playerAds) delete obj.playerAds;
                            if (obj.adSlots) delete obj.adSlots;
                            if (obj.adBreaks) delete obj.adBreaks;
                            if (obj.adPlacementConfig) delete obj.adPlacementConfig;
                            if (obj.adBreakHeartbeatParams) delete obj.adBreakHeartbeatParams;
                            if (obj.playerConfig && obj.playerConfig.adConfig) delete obj.playerConfig.adConfig;
                            if (obj.playerConfig && obj.playerConfig.adBreakHeartbeatParams) delete obj.playerConfig.adBreakHeartbeatParams;
                            if (obj.playbackTracking) {
                                if (obj.playbackTracking.videostatsPlaybackUrl) delete obj.playbackTracking.videostatsPlaybackUrl;
                                if (obj.playbackTracking.videostatsDelayplayUrl) delete obj.playbackTracking.videostatsDelayplayUrl;
                                if (obj.playbackTracking.qoeUrl) delete obj.playbackTracking.qoeUrl;
                            }
                            if (obj.playerResponse && typeof obj.playerResponse === 'object') {
                                sanitizeYtObject(obj.playerResponse, depth + 1);
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

                        // 3. Instant Video Ad Skip & Defuser (Zero Glitch uBlock Origin Compatible)
                        function defuseVideoAd() {
                            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                            const isAdActive = !!document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting, .ad-showing video, .ad-interrupting video');
                            const video = (player && player.querySelector('video')) || document.querySelector('video.html5-main-video') || document.querySelector('video');

                            if (isAdActive && video) {
                                try {
                                    video.muted = true;
                                    video.playbackRate = 16.0;
                                    if (video.duration && isFinite(video.duration) && video.duration > 0.5) {
                                        if (video.currentTime < video.duration - 0.2) {
                                            video.currentTime = video.duration - 0.1;
                                        }
                                    }
                                } catch (_) {}
                                if (player && typeof player.skipAd === 'function') {
                                    try { player.skipAd(); } catch (_) {}
                                }
                            } else if (video && video.playbackRate > 2.0 && !isAdActive) {
                                try {
                                    video.playbackRate = 1.0;
                                    video.muted = false;
                                } catch (_) {}
                            }

                            const skipBtns = document.querySelectorAll(
                                '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button, .ytp-ad-skip-button-container button, .ytp-ad-skip-button-slot button, .ytp-ad-overlay-close-button'
                            );
                            skipBtns.forEach(btn => {
                                try { btn.click(); } catch (_) {}
                            });
                        }

                        setInterval(defuseVideoAd, 150);
                        document.addEventListener('play', () => defuseVideoAd(), true);
                        document.addEventListener('timeupdate', () => defuseVideoAd(), true);

                        // 4. Procedural Sponsored Card Scrubber (Home, Search Results, Up Next, & Shorts)
                        function scrubSponsoredCards() {
                            const candidates = document.querySelectorAll('ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-video-renderer, ytd-reel-video-renderer, ytd-compact-video-renderer');
                            for (let i = 0; i < candidates.length; i++) {
                                const el = candidates[i];
                                if (el.style.display === 'none') continue;
                                if (el.querySelector('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-statement-banner-renderer, ytd-brand-video-singleton-renderer, .badge-style-type-ad, #ad-badge, [aria-label*="Sponsored" i], [aria-label*="Promoted" i]')) {
                                    el.style.setProperty('display', 'none', 'important');
                                    continue;
                                }
                                const badges = el.querySelectorAll('.badge-style-type-ad, .ytd-badge-supported-renderer');
                                for (let b = 0; b < badges.length; b++) {
                                    const txt = (badges[b].textContent || '').trim().toLowerCase();
                                    if (txt === 'sponsored' || txt === 'promoted') {
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

        // Universal Procedural Ad Observer & Empty Placeholder Scrubber (all pages)
        const universalObserverScript = `
            try {
                if (!window.__fokk_observer_installed) {
                    window.__fokk_observer_installed = true;

                    function cleanAdNodes() {
                        // 1. Collapse empty or blocked ad containers & iframes
                        const adContainers = document.querySelectorAll(
                            'ins.adsbygoogle, [id^="div-gpt-ad"], [id^="google_ads_iframe"], [data-ad-slot], [data-ad-unit], [data-dfp-ad], div[class*="ad-container"], div[class*="ad-wrapper"], div[class*="ad-slot"], div[class*="ad-banner"], div[class*="sponsored-post"]'
                        );
                        for (let i = 0; i < adContainers.length; i++) {
                            const node = adContainers[i];
                            if (node.style.display !== 'none') {
                                node.style.setProperty('display', 'none', 'important');
                                node.style.setProperty('height', '0px', 'important');
                                node.style.setProperty('min-height', '0px', 'important');
                                node.style.setProperty('max-height', '0px', 'important');
                                node.style.setProperty('margin', '0px', 'important');
                                node.style.setProperty('padding', '0px', 'important');
                            }
                        }

                        // 2. Hide Google Search and Bing sponsored result cards
                        const searchAds = document.querySelectorAll(
                            '#tads, #tadsb, #bottomads, .uEierd, [data-text-ad], li.b_ad, .b_ad, [data-tag="adSlot"], cs-native-ad-card'
                        );
                        for (let i = 0; i < searchAds.length; i++) {
                            const sNode = searchAds[i];
                            if (sNode.style.display !== 'none') {
                                sNode.style.setProperty('display', 'none', 'important');
                            }
                        }

                        // 3. Amazon Sponsored Results Scrubber
                        const amazonSponsored = document.querySelectorAll(
                            '.s-result-item[data-asin]:has(span.puis-sponsored-label-text), div[data-asin]:has(span.puis-sponsored-label-text), div[data-component-type="sp-sponsored-result"]'
                        );
                        for (let i = 0; i < amazonSponsored.length; i++) {
                            const aNode = amazonSponsored[i];
                            if (aNode.style.display !== 'none') {
                                aNode.style.setProperty('display', 'none', 'important');
                            }
                        }

                        // 4. Defuse Anti-Adblock & CMP consent modal traps & restore scrolling (The Guardian, Sky, etc.)
                        const h = document.documentElement;
                        const b = document.body;
                        if (h && b) {
                            const isLocked = h.style.overflow === 'hidden' || b.style.overflow === 'hidden' ||
                                             h.classList.contains('gu-consent-active') || b.classList.contains('gu-consent-active');
                            if (isLocked) {
                                h.style.setProperty('overflow', 'auto', 'important');
                                h.style.setProperty('overflow-y', 'auto', 'important');
                                b.style.setProperty('overflow', 'auto', 'important');
                                b.style.setProperty('overflow-y', 'auto', 'important');
                                b.style.setProperty('position', 'static', 'important');
                                document.querySelectorAll('.adblock-overlay, .tp-backdrop, .fc-dialog-container, div[class*="adblock-modal"], div[id^="sp_message_container"], .gu-cmp-banner').forEach(el => el.remove());
                            }
                        }
                    }

                    // Initial run
                    cleanAdNodes();

                    // Throttled MutationObserver
                    let cleanTimer = null;
                    const observer = new MutationObserver(() => {
                        if (cleanTimer) return;
                        cleanTimer = requestAnimationFrame(() => {
                            cleanTimer = null;
                            cleanAdNodes();
                        });
                    });

                    const target = document.body || document.documentElement;
                    if (target) {
                        observer.observe(target, { childList: true, subtree: true });
                    }
                }
            } catch(e) {}
        `;
        webContents.executeJavaScript(universalObserverScript).catch(() => {});

        // Inject deep AdShield engine scripts (with built-in domain safety guards)
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

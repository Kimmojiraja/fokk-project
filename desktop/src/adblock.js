const fs = require('fs');
const path = require('path');

class AdBlockEngine {
    constructor(assetsDir) {
        this.assetsDir = assetsDir;
        this.blockedDomains = new Set();
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
        this.init();
    }

    init() {
        const rulesPath = path.join(this.assetsDir, 'adblock_rules_curated.txt');
        if (fs.existsSync(rulesPath)) {
            try {
                const lines = fs.readFileSync(rulesPath, 'utf8').split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('||') && trimmed.includes('^')) {
                        const domain = trimmed.substring(2, trimmed.indexOf('^')).toLowerCase();
                        if (domain && domain.length > 3 && !domain.includes('/')) {
                            this.blockedDomains.add(domain);
                        }
                    }
                }
                console.log(`[AdBlock] Loaded ${this.blockedDomains.size} curated domain block rules.`);
            } catch (err) {
                console.error('[AdBlock] Error reading curated rules:', err);
            }
        }

        // Cache injection scripts
        this.injectJs = '';
        this.defusersJs = '';
        try {
            const injectPath = path.join(this.assetsDir, 'inject_adshield.js');
            if (fs.existsSync(injectPath)) this.injectJs = fs.readFileSync(injectPath, 'utf8');

            const defusersPath = path.join(this.assetsDir, 'adblock_defusers.js');
            if (fs.existsSync(defusersPath)) this.defusersJs = fs.readFileSync(defusersPath, 'utf8');
        } catch (e) {
            console.error('[AdBlock] Error loading injection scripts:', e);
        }
    }

    shouldBlock(url, resourceType) {
        if (!url || typeof url !== 'string') return false;
        const lowerUrl = url.toLowerCase();

        // Never block internal app resources
        if (lowerUrl.startsWith('file:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('devtools:')) {
            return false;
        }

        // Allow core media stream chunks (HLS, DASH, audio/video)
        const isMedia = resourceType === 'media' ||
            lowerUrl.includes('.m3u8') ||
            lowerUrl.includes('.mpd') ||
            lowerUrl.includes('.ts') ||
            lowerUrl.includes('.m4s') ||
            lowerUrl.includes('googlevideo.com/videoplayback');

        // YouTube ad endpoints isolation
        if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
            const isYtAd = lowerUrl.includes('/pagead/') ||
                lowerUrl.includes('/api/stats/ads') ||
                lowerUrl.includes('ad_break') ||
                lowerUrl.includes('get_midroll_info') ||
                lowerUrl.includes('doubleclick.net');
            if (isYtAd && !isMedia) {
                this.blockedCount++;
                return true;
            }
            return false;
        }

        if (isMedia) return false;

        // Extract hostname
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();

            // Check Set of curated domains
            if (this.blockedDomains.has(host)) {
                this.blockedCount++;
                return true;
            }

            // Check parent domain
            const parts = host.split('.');
            if (parts.length > 2) {
                const parentDomain = parts.slice(1).join('.');
                if (this.blockedDomains.has(parentDomain)) {
                    this.blockedCount++;
                    return true;
                }
            }
        } catch (_) {}

        // Check keyword patterns
        for (const kw of this.blockedKeywords) {
            if (lowerUrl.includes(kw)) {
                this.blockedCount++;
                return true;
            }
        }

        return false;
    }

    getStats() {
        return {
            blocked: this.blockedCount,
            activeRules: this.blockedDomains.size + this.blockedKeywords.length,
            defusersEnabled: true
        };
    }

    injectCosmeticFilters(webContents) {
        if (!webContents || webContents.isDestroyed()) return;
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

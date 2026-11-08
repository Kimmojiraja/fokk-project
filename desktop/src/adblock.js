const fs = require('fs');
const path = require('path');

class AdBlockEngine {
    constructor(assetsDir) {
        this.assetsDir = assetsDir;
        this.blockedDomains = new Set();
        this.whitelistedDomains = new Set();
        this.customBlockedDomains = new Set();
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
        // 1. Curated Adblock Rules
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
        const last = this.recentBlockedUrls.get(url);
        // Only increment count if not repeatedly spammed within last 500ms
        if (!last || (now - last) > 500) {
            this.blockedCount++;
            this.recentBlockedUrls.set(url, now);
            if (this.recentBlockedUrls.size > 300) {
                for (const [k, v] of this.recentBlockedUrls) {
                    if (now - v > 5000) this.recentBlockedUrls.delete(k);
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
                lowerUrl.includes('doubleclick.net');
            if (isYtAd && !isMedia) {
                return this.recordBlock(url);
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
                return this.recordBlock(url);
            }

            // Check parent domain
            const parts = host.split('.');
            if (parts.length > 2) {
                const parentDomain = parts.slice(1).join('.');
                if (this.blockedDomains.has(parentDomain)) {
                    return this.recordBlock(url);
                }
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
            activeRules: this.blockedDomains.size + this.customBlockedDomains.size + this.blockedKeywords.length,
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

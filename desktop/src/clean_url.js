/**
 * Fokk Shield - Clean URL & Anti-Tracking Trampoline Engine
 * Strips tracking query parameters (utm_*, fbclid, gclid, etc.) and resolves trampoline redirectors.
 */

const TRACKING_PARAMS = new Set([
    // Google & Analytics
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'utm_reader', 'utm_place', 'utm_userid', 'gclid', 'gclsrc', 'dclid', '_ga', '_gl',
    // Facebook / Meta / Instagram
    'fbclid', 'igshid', 'si',
    // Microsoft / Bing
    'msclkid',
    // Twitter / X
    'twclid',
    // Yandex
    'yclid', '_openstat',
    // Marketing & CRM trampolines
    'mc_eid', 'mc_cid', '_hsenc', '_hsmi', 'mkt_tok', 'trk', 'sc_campaign', 'sc_channel',
    'vero_id', 'wickedid', 'wt_mc', 'ref_src', 'ref_url', 'action_object_map',
    'action_type_map', 'action_ref_map'
]);

function cleanTrackingUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;

    try {
        const parsed = new URL(trimmed);

        // Auto-upgrade insecure http:// to https:// for modern web and CDN-protected sites
        if (parsed.protocol === 'http:' && !parsed.hostname.startsWith('localhost') && !parsed.hostname.startsWith('127.0.0.1')) {
            parsed.protocol = 'https:';
            stripped = true;
        }

        // 1. Resolve redirect trampoline wrappers (Facebook, Google, Reddit trampolines)
        if (parsed.hostname.includes('facebook.com') && parsed.pathname === '/l.php' && parsed.searchParams.has('u')) {
            const target = parsed.searchParams.get('u');
            return cleanTrackingUrl(target) || target;
        }
        if (parsed.hostname.includes('google.') && parsed.pathname === '/url' && parsed.searchParams.has('url')) {
            const target = parsed.searchParams.get('url');
            return cleanTrackingUrl(target) || target;
        }
        if (parsed.hostname.includes('reddit.com') && parsed.pathname.includes('/out') && parsed.searchParams.has('url')) {
            const target = parsed.searchParams.get('url');
            return cleanTrackingUrl(target) || target;
        }

        // 2. Strip tracking query parameters
        let stripped = false;
        for (const key of Array.from(parsed.searchParams.keys())) {
            const lowerKey = key.toLowerCase();
            if (TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_') || lowerKey.startsWith('fb_')) {
                parsed.searchParams.delete(key);
                stripped = true;
            }
        }

        if (stripped) {
            return parsed.toString();
        }
    } catch (_) {}

    return null;
}

module.exports = {
    cleanTrackingUrl,
    TRACKING_PARAMS
};

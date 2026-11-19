const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Fokk AI Engine & Multi-Source Web Aggregator for Fokk Browser Desktop.
 * Full feature parity with Android v2.8.6:
 * - Fast verified OpenRouter failover + Google Gemini direct API
 * - Multi-turn conversation history & page metadata grounding
 * - Live Google News / DuckDuckGo / Wikipedia / Wikidata corroboration with spam filtering
 * - Contextual Key Numbers extraction & 3-layer Truth & Bias Audit
 * - Strictly zero emojis
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BUILTIN_FALLBACK_OR_KEY = 'c2stb3ItdjEtM2U1M2U2YmViZTc2M2ZiOGZjYzE3M2NmMjg0NzFjNjM5MDJjZGZjZWEyMGNlMjhmYmY1ODdiZWRiNDgzM2YwMw==';

const FAILOVER_MODELS = [
    'nvidia/nemotron-3.5-lightning:free',
    'particle-ai/particle-1:free',
    'inclusionai/ling-3.2-flash:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'openrouter/free'
];

const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash'
];

const BLOCKED_DOMAINS = new Set([
    'wn.com', 'article.wn.com', 'powerpopradio.com', 'whopostedwhat.com',
    'pressreader.com', 'pinterest.com', 'quora.com', 'brainly.com',
    'brainly.in', 'chegg.com', 'scribd.com', 'slideshare.net',
    'ebay.com', 'amazon.com', 'aliexpress.com', 'walmart.com',
    'etsy.com', 'tiktok.com', 'facebook.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'youtu.be', 'fixthecourt.com',
    'duckduckgo.com', 'bing.com', 'google.com', 'msn.com'
]);

const REPUTABLE_DOMAINS = new Set([
    'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
    'nytimes.com', 'washingtonpost.com', 'ft.com', 'economist.com',
    'bloomberg.com', 'wsj.com', 'sky.com', 'news.sky.com', 'skysports.com',
    'thetimes.com', 'thetimes.co.uk', 'independent.co.uk', 'telegraph.co.uk',
    'npr.org', 'pbs.org', 'cnn.com', 'abcnews.go.com', 'cbsnews.com',
    'nbcnews.com', 'politico.com', 'politico.eu', 'axios.com', 'forbes.com',
    'theverge.com', 'techcrunch.com', 'arstechnica.com', 'wired.com',
    'nature.com', 'science.org', 'thelancet.com', 'who.int', 'un.org',
    'theathletic.com', 'espn.com', 'aljazeera.com', 'dw.com', 'france24.com',
    'thestandard.co.uk', 'lbc.co.uk', 'thehindu.com', 'indianexpress.com',
    'ndtv.com', 'en.wikipedia.org'
]);

const KNOWN_OUTLETS = [
    'The Guardian', 'BBC News', 'BBC', 'Reuters', 'Associated Press', 'AP News',
    'Sky News', 'Sky Sports', 'The Times', 'The Sunday Times', 'Financial Times',
    'The New York Times', 'Washington Post', 'Wall Street Journal', 'Bloomberg',
    'The Independent', 'The Telegraph', 'The Standard', 'The Athletic', 'CNN',
    'NPR', 'Politico', 'Axios', 'The Economist', 'The Verge', 'TechCrunch',
    'Ars Technica', 'Al Jazeera', 'LBC', 'ESPN', 'Forbes', 'Wired'
];

const FUNCTIONAL_STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't",
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do', 'does', "doesn't", 'doing',
    "don't", 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', "hadn't", 'has', "hasn't",
    'have', "haven't", 'having', 'he', "he'd", "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself',
    'him', 'himself', 'his', 'how', "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is',
    "isn't", 'it', "it's", 'its', 'itself', "let's", 'me', 'more', 'most', "mustn't", 'my', 'myself', 'no',
    'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
    'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll", "she's", 'should', "shouldn't", 'so',
    'some', 'such', 'than', 'that', "that's", 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
    "there's", 'these', 'they', "they'd", "they'll", "they're", "they've", 'this', 'those', 'through', 'to',
    'too', 'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd", "we'll", "we're", "we've", 'were',
    "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which', 'while', 'who', "who's", 'whom',
    'why', "why's", 'with', "won't", 'would', "wouldn't", 'you', "you'd", "you'll", "you're", "you've", 'your',
    'yours', 'yourself', 'yourselves', 'tell', 'explain', 'summarize', 'page', 'article', 'post', 'posted',
    'brief', 'give', 'just', 'make', 'made', 'said', 'says', 'like'
]);

function isFunctionalStopWord(word) {
    return FUNCTIONAL_STOP_WORDS.has(String(word || '').toLowerCase());
}

function stripEmojis(text) {
    if (!text) return '';
    return String(text)
        .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{200D}]/gu, '')
        .trim();
}

function cleanDropCaps(text) {
    if (!text) return '';
    return String(text).replace(/\b([B-HJ-Z])\s+([a-z]{2,})\b/g, '$1$2');
}

function sanitizeLlmOutput(raw) {
    if (!raw) return '';
    let s = String(raw)
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^(\*\*)?thinking process:?(\*\*)?[\s\S]*?\n\n/i, '')
        .replace(/^(\*\*)?here('s| is) a thinking process:?(\*\*)?[\s\S]*?\n\n/i, '')
        .replace(/^we need (to )?answer as fokk ai[\s\S]*?(\n\n|$)/i, '')
        .replace(/^okay, let('s| us) analyze[\s\S]*?(\n\n|$)/i, '')
        .replace(/^let's think step by step[\s\S]*?(\n\n|$)/i, '');
    return stripEmojis(cleanDropCaps(s)).trim();
}

function cleanHtmlText(raw) {
    if (!raw) return '';
    return String(raw)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+?>/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&#x27;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isBlockedDomain(domain) {
    const d = String(domain || '').toLowerCase().replace(/^www\./, '').trim();
    if (!d) return true;
    for (const blocked of BLOCKED_DOMAINS) {
        if (d === blocked || d.endsWith('.' + blocked)) return true;
    }
    return false;
}

function isReputableDomain(domain) {
    const d = String(domain || '').toLowerCase().replace(/^www\./, '').trim();
    if (!d) return false;
    if (d.endsWith('.gov') || d.endsWith('.gov.uk') || d.endsWith('.edu') || d.endsWith('.ac.uk')) return true;
    for (const rep of REPUTABLE_DOMAINS) {
        if (d === rep || d.endsWith('.' + rep)) return true;
    }
    return false;
}

function cleanPublisherName(domain) {
    const d = String(domain || '').toLowerCase().replace(/^www\./, '').trim();
    if (!d) return 'Web';
    if (d.includes('independent.co.uk')) return 'The Independent';
    if (d.includes('thetimes.com') || d.includes('thetimes.co.uk')) return 'The Times';
    if (d.includes('thestandard.co.uk')) return 'The Standard';
    if (d.includes('theguardian.com')) return 'The Guardian';
    if (d.includes('skysports.com')) return 'Sky Sports';
    if (d.includes('sky.com')) return 'Sky News';
    if (d.includes('bbc.com') || d.includes('bbc.co.uk')) return 'BBC News';
    if (d.includes('nytimes.com')) return 'NY Times';
    if (d.includes('washingtonpost.com')) return 'Washington Post';
    if (d.includes('reuters.com')) return 'Reuters';
    if (d.includes('apnews.com')) return 'AP News';
    if (d.includes('bloomberg.com')) return 'Bloomberg';
    if (d.includes('ft.com')) return 'Financial Times';
    if (d.includes('economist.com')) return 'The Economist';
    if (d.includes('wsj.com')) return 'Wall Street Journal';
    if (d.includes('theathletic.com')) return 'The Athletic';
    if (d.includes('telegraph.co.uk')) return 'The Telegraph';
    if (d.includes('lbc.co.uk')) return 'LBC';
    if (d.includes('npr.org')) return 'NPR';
    if (d.includes('cnn.com')) return 'CNN';
    if (d.includes('politico.')) return 'Politico';
    if (d.includes('theverge.com')) return 'The Verge';
    if (d.includes('techcrunch.com')) return 'TechCrunch';
    if (d.includes('arstechnica.com')) return 'Ars Technica';
    if (d.includes('wikipedia.org')) return 'Wikipedia';
    if (d.includes('wikidata.org')) return 'Wikidata';
    if (d.includes('yahoo.com')) return 'Yahoo News';
    const parts = d.split('.');
    const secondLevel = new Set(['co', 'com', 'org', 'gov', 'net', 'ac', 'edu']);
    let root = d;
    if (parts.length >= 3 && secondLevel.has(parts[parts.length - 2])) {
        root = parts[parts.length - 3];
    } else if (parts.length >= 2) {
        root = parts[parts.length - 2];
    }
    return root ? root.charAt(0).toUpperCase() + root.slice(1) : d;
}

function httpsRequest(urlStr, options = {}, body = null, timeoutMs = 12000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(urlStr);
            const req = https.request({
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': USER_AGENT,
                    ...(options.headers || {})
                },
                timeout: timeoutMs
            }, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => {
                    data += chunk;
                    if (data.length > 500000) res.destroy();
                });
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
            req.on('error', () => resolve({ status: 0, body: '' }));
            if (body) req.write(body);
            req.end();
        } catch (_) {
            resolve({ status: 0, body: '' });
        }
    });
}

async function fetchGoogleNews(query, max = 5) {
    const results = [];
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await httpsRequest(rssUrl, {}, null, 4500);
    if (res.status !== 200 || !res.body) return results;

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(res.body)) !== null && results.length < max) {
        const block = m[1];
        const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
        const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
        const srcMatch = block.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);

        let domain = '';
        try { domain = new URL(srcMatch ? srcMatch[1] : rawLink).hostname.replace(/^www\./, ''); } catch (_) {}
        if (!domain || isBlockedDomain(domain)) continue;

        const cleanTitle = cleanHtmlText(rawTitle);
        const sourceName = cleanHtmlText(srcMatch ? srcMatch[2] : '') || cleanPublisherName(domain);
        const formattedDate = pubDate.slice(0, 16).trim();
        if (cleanTitle && rawLink) {
            results.push({
                title: cleanTitle,
                url: rawLink.trim(),
                domain,
                snippet: formattedDate ? `${sourceName} (${formattedDate})` : sourceName,
                sourceType: 'NEWS',
                timestamp: formattedDate
            });
        }
    }
    return results;
}

async function fetchBingNews(query, max = 5) {
    const results = [];
    const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
    const res = await httpsRequest(rssUrl, {
        headers: { 'Accept': 'application/rss+xml, text/xml, */*' }
    }, null, 4500);
    if (res.status !== 200 || !res.body) return results;

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(res.body)) !== null && results.length < max) {
        const block = m[1];
        const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
        const rawDesc = (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '';
        const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
        const srcMatch = block.match(/<News:Source>([\s\S]*?)<\/News:Source>/i);

        let domain = '';
        try { domain = new URL(rawLink).hostname.replace(/^www\./, ''); } catch (_) {}
        if (!domain || isBlockedDomain(domain)) continue;

        const cleanTitle = cleanHtmlText(rawTitle);
        const cleanDesc = cleanHtmlText(rawDesc);
        const sourceName = cleanHtmlText(srcMatch ? srcMatch[1] : '') || cleanPublisherName(domain);
        const formattedDate = pubDate.slice(0, 16).trim();
        const snippet = cleanDesc || (formattedDate ? `${sourceName} (${formattedDate})` : sourceName);

        if (cleanTitle && rawLink) {
            results.push({
                title: cleanTitle,
                url: rawLink.trim(),
                domain,
                snippet,
                sourceType: 'NEWS',
                timestamp: formattedDate
            });
        }
    }
    return results;
}

async function fetchDuckDuckGoInstant(query) {
    const results = [];
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await httpsRequest(url, { headers: { 'Accept': 'application/json' } }, null, 3500);
    if (res.status !== 200 || !res.body) return results;
    try {
        const data = JSON.parse(res.body);
        const heading = (data.Heading || '').trim();
        const abstract = (data.AbstractText || '').trim();
        const abstractUrl = (data.AbstractURL || '').trim();
        const source = (data.AbstractSource || 'DuckDuckGo').trim();
        if (abstract && abstractUrl) {
            let domain = 'duckduckgo.com';
            try { domain = new URL(abstractUrl).hostname.replace(/^www\./, ''); } catch (_) {}
            results.push({
                title: heading ? `${heading} (${source})` : source,
                url: abstractUrl,
                domain,
                snippet: abstract.slice(0, 300),
                sourceType: 'WIKI',
                timestamp: ''
            });
        }
    } catch (_) {}
    return results;
}

function extractSearchQueries(rawQuery) {
    const q = String(rawQuery || '').trim();
    if (!q) return [];

    const conversationalPrefix = /^(?:(?:please\s+)?(?:can\s+you\s+)?(?:tell\s+me|show\s+me|explain|what\s+about|do\s+you\s+know\s+about)|(?:i\s+(?:want\s+to\s+know|saw|heard|read)\s+(?:that\s+)?)|(?:is\s+it\s+true\s+that))\s+/i;
    const cleaned = q.replace(conversationalPrefix, '').trim();

    const variants = [];
    const cleanOneLine = cleaned.replace(/\s+/g, ' ').trim();
    if (cleanOneLine) variants.push(cleanOneLine.slice(0, 100));

    const keywords = cleanOneLine.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !isFunctionalStopWord(w));
    if (keywords.length > 0) {
        const distilled = keywords.slice(0, 8).join(' ');
        if (!variants.includes(distilled)) variants.push(distilled);

        const isStatusInquiry = /^(?:who|what|where|when|which|latest|current|who's|whats|how)\b/i.test(q);
        if (isStatusInquiry && keywords.length >= 2) {
            const modernQuery = `current ${distilled}`;
            if (!variants.includes(modernQuery)) variants.push(modernQuery);
        }
    }

    return Array.from(new Set(variants)).slice(0, 3);
}

async function fetchDuckDuckGoHtml(query, max = 6) {
    const results = [];
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await httpsRequest(url, {
        headers: { 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }
    }, null, 4500);
    if (res.status !== 200 || !res.body) return results;

    const blockRegex = /<div[^>]*class="[^"]*web-result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let m;
    while ((m = blockRegex.exec(res.body)) !== null && results.length < max) {
        const block = m[1];
        const titleLink = block.match(/<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!titleLink) continue;
        const rawHref = titleLink[1];
        const cleanTitle = cleanHtmlText(titleLink[2]);
        const snipMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        const cleanSnippet = cleanHtmlText(snipMatch ? snipMatch[1] : '');

        let targetUrl = rawHref;
        try {
            if (rawHref.includes('uddg=')) {
                const u = new URL(rawHref.startsWith('http') ? rawHref : 'https:' + rawHref);
                targetUrl = u.searchParams.get('uddg') || rawHref;
            } else if (rawHref.startsWith('//')) {
                targetUrl = 'https:' + rawHref;
            }
        } catch (_) {}

        let domain = '';
        try { domain = new URL(targetUrl).hostname.replace(/^www\./, ''); } catch (_) {}
        if (!cleanTitle || !targetUrl.startsWith('http') || !domain || isBlockedDomain(domain)) continue;

        results.push({
            title: cleanTitle,
            url: targetUrl,
            domain,
            snippet: cleanSnippet,
            sourceType: isReputableDomain(domain) && !domain.includes('wikipedia') ? 'NEWS' : 'WEB',
            timestamp: ''
        });
    }
    return results;
}

async function fetchWikipedia(query, max = 2) {
    const results = [];
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=&srlimit=${max}`;
    const res = await httpsRequest(url, { headers: { 'User-Agent': 'FokkBrowser/1.3 (Desktop)' } }, null, 4000);
    if (res.status !== 200 || !res.body) return results;
    try {
        const json = JSON.parse(res.body);
        const items = json?.query?.search || [];
        for (const item of items) {
            const title = (item.title || '').trim();
            if (!title) continue;
            results.push({
                title: `${title} - Wikipedia`,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
                domain: 'en.wikipedia.org',
                snippet: cleanHtmlText(item.snippet || ''),
                sourceType: 'ENCYCLOPEDIA',
                timestamp: ''
            });
        }
    } catch (_) {}
    return results;
}

async function aggregateSources(query, pageTitle = '', pageHost = '', maxResults = 6) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) return [];

    const isIndependentQuery = !pageTitle || pageTitle.trim().length === 0;
    const anchorText = isIndependentQuery ? cleanQuery : `${pageTitle} ${cleanQuery}`;
    const topicKeywords = Array.from(new Set(
        anchorText.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !isFunctionalStopWord(w))
    )).slice(0, 14);

    const searchVariants = extractSearchQueries(cleanQuery);
    const primaryQuery = searchVariants[0] || cleanQuery;

    const [newsRes, bingRes, ddgInstant, ddgRes, wikiRes] = await Promise.all([
        fetchGoogleNews(primaryQuery, 5).catch(() => []),
        fetchBingNews(primaryQuery, 5).catch(() => []),
        fetchDuckDuckGoInstant(cleanQuery).catch(() => []),
        fetchDuckDuckGoHtml(primaryQuery, 5).catch(() => []),
        fetchWikipedia(cleanQuery, 2).catch(() => [])
    ]);

    const candidates = [];
    const seenUrls = new Set();
    const seenDomainCounts = {};
    const normPageHost = String(pageHost || '').toLowerCase().replace(/^www\./, '');

    function evaluateAndAdd(src, baseScore, strictRelevance) {
        const normUrl = (src.url || '').trim().toLowerCase();
        const normDomain = (src.domain || '').trim().toLowerCase().replace(/^www\./, '');
        if (!normUrl || seenUrls.has(normUrl)) return;
        if (normPageHost && normDomain === normPageHost) return;
        if (isBlockedDomain(normDomain)) return;
        if ((seenDomainCounts[normDomain] || 0) >= 2) return;

        const haystack = `${src.title} ${src.snippet}`.toLowerCase();
        const hits = topicKeywords.filter(kw => haystack.includes(kw)).length;
        if (strictRelevance && topicKeywords.length > 0) {
            const minHits = topicKeywords.length >= 4 ? 1 : 1;
            if (hits < minHits) return;
        }

        let score = baseScore + hits * 12;
        if (isReputableDomain(normDomain)) score += 35;
        if (src.sourceType === 'NEWS') score += 25;

        // Dynamic recency bonus for live/current facts (adapts dynamically to any future year)
        const tsLower = (src.timestamp || '').toLowerCase();
        const snipLower = (src.snippet || '').toLowerCase();
        const currentYear = new Date().getFullYear();
        const prevYear = currentYear - 1;
        if (tsLower.includes(String(currentYear)) || snipLower.includes(String(currentYear)) || tsLower.includes('ago') || tsLower.includes('hour') || tsLower.includes('minute')) {
            score += 25;
        } else if (tsLower.includes(String(prevYear)) || snipLower.includes(String(prevYear))) {
            score += 10;
        }

        seenUrls.add(normUrl);
        seenDomainCounts[normDomain] = (seenDomainCounts[normDomain] || 0) + 1;
        candidates.push({ src, score });
    }

    newsRes.forEach(s => evaluateAndAdd(s, 45, true));
    bingRes.forEach(s => evaluateAndAdd(s, 45, true));
    ddgInstant.forEach(s => evaluateAndAdd(s, 30, false));
    ddgRes.forEach(s => evaluateAndAdd(s, 20, true));
    wikiRes.forEach(w => {
        const titleLower = (w.title || '').toLowerCase();
        if (topicKeywords.some(kw => titleLower.includes(kw))) {
            evaluateAndAdd(w, 15, false);
        }
    });

    return candidates
        .sort((a, b) => b.score - a.score)
        .map(c => c.src)
        .slice(0, maxResults);
}

function classifyBullet(text) {
    const t = String(text || '').toLowerCase();
    const hasFactual = /\b(?:jailed|sentenced|arrested|convicted|pleaded|announced|confirmed|published|appointed|died|founded|ruled|voted|signed|acquired|passed|established|found|showed|data|research|budget|[£$€]\d+|\d+%|\d+\s*(?:million|billion|thousand|years?|months?|days?))\b/.test(t);
    const hasOpinion = /\b(?:impressive|masterclass|disaster|amazing|incredible|appalling|shocking|disgraceful|outrageous|arguably|perhaps|believe|pundit|opinion|feels|seems|awful|terrible|criticised|criticized)\b/.test(t);
    const hasClaim = /\b(?:claims?|claimed|alleged|allegations?|promised|rumored|sources say|according to|set to|disputed|unconfirmed|proposed)\b/.test(t);
    if (hasOpinion && !hasFactual) return 'OPINION';
    if (hasFactual && !hasClaim) return 'FACT';
    if (hasClaim) return 'CLAIM';
    if (hasFactual) return 'FACT';
    return 'CLAIM';
}

function extractContextualMetrics(text, max = 4) {
    if (!text) return [];
    const clean = cleanDropCaps(text);
    const results = [];
    const seen = new Set();
    const regex = /([£$€]\s?\d+(?:[.,]\d+)?\s?(?:billion|million|trillion|bn|mn|m|k|b)?|\d+(?:\.\d+)?%|\b\d+(?:,\d{3})+\b)\s+([a-zA-Z][a-zA-Z\s\-]{3,36})/g;
    let m;
    while ((m = regex.exec(clean)) !== null && results.length < max) {
        const val = m[1].trim();
        const key = val.toLowerCase();
        if (seen.has(key)) continue;
        const phrase = m[2].split(/[,.;:()—–]|\b(?:and|but|which|that|while|from|in)\b/i)[0].trim();
        const words = phrase.split(/\s+/).filter(Boolean).slice(0, 4);
        if (words.length >= 2) {
            const label = words.join(' ');
            seen.add(key);
            results.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
    }
    return results;
}

function evaluateCredibility(host, title, context, sources = [], tagScore = null, tagVerdict = '') {
    const normHost = String(host || '').toLowerCase().replace(/^www\./, '');
    const publisherLabel = normHost ? cleanPublisherName(normHost) : 'this site';
    const isSocialAggregator = ['x.com', 'twitter.com', 'reddit.com', 'threads.net', 'bsky.app'].some(d => normHost.includes(d));
    const isReputableHost = isReputableDomain(normHost);
    const combinedText = `${title} ${context}`.toLowerCase();

    let detectedOriginalSource = '';
    if (isSocialAggregator) {
        detectedOriginalSource = KNOWN_OUTLETS.find(o => combinedText.includes(o.toLowerCase())) || '';
    } else {
        const attrMatch = `${title} ${context}`.match(/(?:first reported by|citing|originally published by|reported by)\s+(The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
        const candidate = attrMatch ? attrMatch[1].trim() : '';
        if (candidate) {
            detectedOriginalSource = KNOWN_OUTLETS.find(o => o.toLowerCase() === candidate.toLowerCase() && o.toLowerCase() !== publisherLabel.toLowerCase()) || '';
        }
    }

    const aggregatorSource = normHost.includes('x.com') || normHost.includes('twitter.com') ? 'X (Twitter)'
        : normHost.includes('reddit.com') ? 'Reddit'
        : normHost.includes('youtube.com') || normHost === 'youtu.be' ? 'YouTube'
        : isSocialAggregator ? 'Social Platform' : '';

    const isOfficial = ['official statement', 'press release', 'sec filing', 'court ruling', 'official announcement', 'ministry of justice'].some(k => combinedText.includes(k));
    const reputableSourcesCount = sources.filter(s => s.sourceType === 'NEWS' || isReputableDomain(s.domain)).length;

    let computed;
    if (isOfficial && (isReputableHost || reputableSourcesCount >= 1)) {
        computed = { score: 94, verdict: 'Officially Confirmed', reason: 'Backed by an official announcement, institutional record, or court ruling.' };
    } else if (reputableSourcesCount >= 3 || (isReputableHost && sources.length >= 2)) {
        computed = { score: Math.min(92, 82 + Math.min(reputableSourcesCount * 3, 10)), verdict: 'Verified Multi-Source Reporting', reason: `Corroborated across independent newsrooms alongside ${publisherLabel}.` };
    } else if (isReputableHost) {
        computed = { score: 82, verdict: 'Established Editorial Source', reason: `Published directly by ${publisherLabel}, a recognized newsroom with editorial oversight.` };
    } else if (sources.length >= 1 && sources.length <= 2) {
        computed = { score: 74, verdict: 'Limited Corroboration', reason: `Matched by ${sources.length} external source${sources.length > 1 ? 's' : ''}; broader verification is still developing.` };
    } else if (isSocialAggregator) {
        computed = { score: 45, verdict: 'Social Post · Unverified', reason: `Shared on ${aggregatorSource}; check primary reporting before treating claims as confirmed.` };
    } else {
        computed = { score: 68, verdict: 'Direct Web Source', reason: `Published directly by ${publisherLabel}; independent cross-checks are limited.` };
    }

    const score = (typeof tagScore === 'number' && !Number.isNaN(tagScore)) ? Math.max(15, Math.min(98, tagScore)) : computed.score;
    const verdict = (tagVerdict && tagVerdict.length <= 42) ? tagVerdict : computed.verdict;

    const layer1 = isSocialAggregator
        ? `Hosted on ${aggregatorSource} (${normHost}) — a social platform rather than a primary newsroom${detectedOriginalSource ? ' referencing ' + detectedOriginalSource : ''}.`
        : isReputableHost
        ? `Published directly on ${publisherLabel} (${normHost}), an established publication over verified HTTPS.`
        : `Published directly on ${publisherLabel} (${normHost}) over HTTPS; verify author and primary citations independently.`;

    const loadedWords = ['bombshell', 'shock move', 'masterclass', 'disaster', 'embarrassing', 'furious', 'unbelievable', 'crisis', 'slams', 'humiliating', 'outrage', 'appalling'];
    const foundLoaded = loadedWords.filter(w => combinedText.includes(w));
    const layer2 = foundLoaded.length > 0
        ? `Uses emphatic or emotionally charged terms (${foundLoaded.slice(0, 3).map(w => `'${w}'`).join(', ')}). Separate core facts from editorial framing.`
        : isSocialAggregator
        ? 'Short-form social framing optimized for engagement; often omits full context and nuance.'
        : 'Structured informational reporting with measured language and clear attribution.';

    const topNames = Array.from(new Set(sources.slice(0, 3).map(s => cleanPublisherName(s.domain)))).join(', ');
    const layer3 = sources.length > 0
        ? `Cross-checked against ${sources.length} external source${sources.length > 1 ? 's' : ''} including ${topNames}.`
        : 'Analyzed from the active page text; no additional external newsroom matches were returned.';

    const whatsMissing = isOfficial || sources.length >= 3 ? ''
        : isReputableHost && sources.length === 0 ? 'Independent follow-up coverage from additional newsrooms has not been linked yet.'
        : isSocialAggregator ? 'Original primary documentation or a full newsroom report is not attached directly to this post.'
        : sources.length === 0 ? 'Broader independent confirmation from other outlets is currently limited.'
        : '';

    return {
        score,
        verdict,
        reason: computed.reason,
        isAggregator: isSocialAggregator,
        originalSource: detectedOriginalSource,
        aggregatorSource,
        layer1,
        layer2,
        layer3,
        whatsMissing
    };
}

class FokkAiService {
    constructor(userDataPath) {
        this.userDataPath = userDataPath || process.cwd();
        this.configFile = path.join(this.userDataPath, 'fokk_ai_config.json');
        this.customApiKey = '';
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                if (typeof data.apiKey === 'string') this.customApiKey = data.apiKey.trim();
            }
        } catch (_) {}
    }

    setApiKey(key) {
        this.customApiKey = String(key || '').trim();
        try {
            if (!fs.existsSync(this.userDataPath)) fs.mkdirSync(this.userDataPath, { recursive: true });
            fs.writeFileSync(this.configFile, JSON.stringify({ apiKey: this.customApiKey }, null, 2), 'utf8');
        } catch (_) {}
        return true;
    }

    getApiKey() {
        return this.customApiKey;
    }

    resolveApiKey() {
        if (this.customApiKey) return this.customApiKey;
        if (process.env.FOKK_AI_KEY && process.env.FOKK_AI_KEY.trim()) return process.env.FOKK_AI_KEY.trim();
        try {
            return Buffer.from(BUILTIN_FALLBACK_OR_KEY, 'base64').toString('utf8').trim();
        } catch (_) {
            return '';
        }
    }

    async callGeminiDirect(apiKey, systemPrompt, userQuery, history, model) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const contents = [];
        for (const [q, a] of (history || []).slice(-6)) {
            contents.push({ role: 'user', parts: [{ text: q }] });
            contents.push({ role: 'model', parts: [{ text: String(a || '').slice(0, 1200) }] });
        }
        contents.push({ role: 'user', parts: [{ text: userQuery }] });

        const payload = JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.35, maxOutputTokens: 1400 }
        });

        const res = await httpsRequest(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, payload, 15000);

        if (res.status !== 200 || !res.body) return '';
        try {
            const root = JSON.parse(res.body);
            const text = root?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return sanitizeLlmOutput(text);
        } catch (_) {
            return '';
        }
    }

    async callOpenRouter(apiKey, systemPrompt, userQuery, model, history, disableReasoning) {
        const messages = [{ role: 'system', content: systemPrompt }];
        for (const [q, a] of (history || []).slice(-6)) {
            messages.push({ role: 'user', content: q });
            messages.push({ role: 'assistant', content: String(a || '').slice(0, 1200) });
        }
        messages.push({ role: 'user', content: userQuery });

        const bodyObj = {
            model,
            max_tokens: 1400,
            temperature: 0.35,
            messages
        };
        if (disableReasoning) bodyObj.reasoning = { enabled: false };

        const headers = {
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://fokk.app',
            'X-Title': 'Fokk Browser AI'
        };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await httpsRequest('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers
        }, JSON.stringify(bodyObj), 16000);

        if (res.status !== 200 || !res.body) return '';
        try {
            const json = JSON.parse(res.body);
            const text = (json?.choices?.[0]?.message?.content || '').trim();
            if (!text || text === 'null') return '';
            return sanitizeLlmOutput(text);
        } catch (_) {
            return '';
        }
    }

    async queryInferencePipeline(systemPrompt, userQuery, history = []) {
        const apiKey = this.resolveApiKey();
        if (!apiKey) return '';

        if (/^AIza/i.test(apiKey)) {
            for (const m of GEMINI_MODELS) {
                const resp = await this.callGeminiDirect(apiKey, systemPrompt, userQuery, history, m);
                if (resp) return resp;
            }
        }

        for (const model of FAILOVER_MODELS) {
            const disableReasoning = model !== 'openrouter/free' && !model.startsWith('google/gemma');
            const resp = await this.callOpenRouter(apiKey, systemPrompt, userQuery, model, history, disableReasoning);
            if (resp) return resp;
        }

        return '';
    }

    async analyzeWebpage(params) {
        const {
            pageTitle = '',
            pageHost = '',
            pageUrl = '',
            pageContext = '',
            pageAuthor = '',
            pagePublished = ''
        } = params || {};

        const cleanContext = cleanDropCaps(pageContext);
        const anchoredQuery = pageTitle && pageTitle.toLowerCase() !== 'fokk ai' ? pageTitle.slice(0, 120) : '';
        const sources = anchoredQuery ? await aggregateSources(anchoredQuery, pageTitle, pageHost, 6) : [];

        const systemPrompt = [
            'You are Fokk AI, a premium reading and verification assistant inside Fokk Browser.',
            'Write like a top-tier editor: crisp, insightful, natural English — NEVER copy-paste raw sentences verbatim from the article.',
            '',
            'PAGE METADATA:',
            `Publisher/Domain: ${pageHost}`,
            `Title: ${pageTitle}`,
            pageAuthor ? `Author: ${pageAuthor}` : '',
            pagePublished ? `Published: ${pagePublished}` : '',
            `URL: ${pageUrl}`,
            '',
            sources.length > 0 ? 'EXTERNAL CORROBORATING SOURCES:\n' + sources.map((s, i) => `[${i + 1}] ${s.title} (${s.domain})${s.snippet ? ' — ' + s.snippet : ''}`).join('\n') + '\n' : '',
            'STRICT OUTPUT FORMAT (follow these exact section labels, no preamble, no internal thinking):',
            '',
            'EXECUTIVE_BRIEF:',
            '[2-3 crisp, synthesized sentences explaining the core story, why it matters, and the main conclusion in fresh, plain English.]',
            '',
            'KEY_EVIDENCE:',
            '- **[Short bold topic]:** [1 concise, rewritten takeaway sentence with specific facts/names/figures.]',
            '- **[Short bold topic]:** [1 concise, rewritten takeaway sentence.]',
            '- **[Short bold topic]:** [1 concise, rewritten takeaway sentence.]',
            '- **[Short bold topic]:** [1 concise, rewritten takeaway sentence.]',
            '',
            'KEY_METRICS:',
            '[Up to 4 concrete numbers/stats from the article, each on its own line as: VALUE :: 2-5 word label. Example: £254m :: Claimed budget savings. NEVER output standalone years like 2025 or 2026 without context. Write NONE if the page has no meaningful figures.]',
            '',
            'TRUTH_AUDIT:',
            'SCORE: [Integer 0-100]',
            'VERDICT: [Short clear verdict, e.g. Verified Reporting / Credible Editorial / Single-Source Report / Opinion & Commentary / Unverified Claim]',
            'BIAS: [2-3 words, e.g. Objective Reporting / Analytical / Left-Leaning Editorial / Opinionated / Promotional]',
            'LAYER1_DOMAIN: [1-2 concise sentences assessing the publisher/platform authenticity and whether it is original reporting or an aggregator.]',
            'LAYER2_STANCE: [1-2 concise sentences assessing tone, framing, loaded language, or balance.]',
            'LAYER3_EVIDENCE: [1-2 concise sentences assessing data, named sources, research, and external corroboration.]',
            'WHATS_MISSING: [1 concise sentence noting any missing perspective, official response, or pending data — or NONE if thorough.]',
            '',
            'SUGGESTED_FOLLOWUPS:',
            '[Specific curious question 1] | [Specific curious question 2] | [Specific curious question 3]',
            '',
            'Strictly ZERO emojis anywhere in your response.'
        ].filter(Boolean).join('\n');

        const userQuery = cleanContext
            ? `Synthesize and audit this article:\n\n${cleanContext.slice(0, 9000)}`
            : `Summarize and audit this page: '${pageTitle}' on ${pageHost}.`;

        const raw = await this.queryInferencePipeline(systemPrompt, userQuery);
        if (raw) {
            return this.parseAnalysisOutput(raw, sources, pageTitle, pageHost, cleanContext);
        }
        return this.synthesizeOfflineAnalysis(pageTitle, pageHost, cleanContext, sources);
    }

    parseAnalysisOutput(rawOutput, sources, title, host, pageContext) {
        const sanitized = sanitizeLlmOutput(rawOutput);
        const splitFollowups = sanitized.split(/SUGGESTED_FOLLOWUPS:/i);
        const mainBody = splitFollowups[0].trim();
        let followUps = [];
        if (splitFollowups.length > 1) {
            followUps = splitFollowups[1].trim().split(/[|\n]/)
                .map(s => stripEmojis(s.trim().replace(/^[-*•]+\s*/, '').trim()))
                .filter(s => s.length > 8 && !/^SUGGESTED/i.test(s))
                .slice(0, 3);
        }
        if (followUps.length === 0) {
            followUps = [
                'What are the key takeaways in 3 bullet points?',
                'Are there any unsupported claims or missing perspectives here?',
                'What happens next or why does this matter?'
            ];
        }

        const extractTag = (tag) => {
            const re = new RegExp(`(?:\\*\\*)?${tag}(?:\\*\\*)?\\s*:\\s*([\\s\\S]*?)(?=(?:\\*\\*)?(?:SCORE|VERDICT|BIAS|LAYER1_DOMAIN|LAYER2_STANCE|LAYER3_EVIDENCE|WHATS_MISSING|KEY_EVIDENCE|KEY_METRICS|EXECUTIVE_BRIEF|TRUTH_AUDIT|SUGGESTED_FOLLOWUPS)(?:\\*\\*)?:|$)`, 'i');
            const m = mainBody.match(re);
            return m ? m[1].trim() : '';
        };

        const tagExec = extractTag('EXECUTIVE_BRIEF');
        const tagKeyEvidence = extractTag('KEY_EVIDENCE');
        const tagKeyMetrics = extractTag('KEY_METRICS');
        const tagScoreStr = extractTag('SCORE').replace(/\D/g, '');
        const tagScore = tagScoreStr ? parseInt(tagScoreStr, 10) : null;
        const tagVerdict = (extractTag('VERDICT').split('\n')[0] || '').trim();
        const tagBias = (extractTag('BIAS').split('\n')[0] || '').trim();
        const tagL1 = extractTag('LAYER1_DOMAIN');
        const tagL2 = extractTag('LAYER2_STANCE');
        const tagL3 = extractTag('LAYER3_EVIDENCE');
        const tagMissing = extractTag('WHATS_MISSING');

        const bulletSource = tagKeyEvidence || mainBody;
        const bullets = bulletSource.split('\n')
            .map(l => l.trim())
            .filter(l => (/^[-*•]|^\d+\./.test(l)) && !/SUGGESTED_FOLLOWUPS/i.test(l) && !l.includes('::'))
            .map(l => l.replace(/^[-•\d.\s]+/, '').replace(/^\*\s+/, '').trim())
            .filter(l => l.length > 15 && !/^(SCORE|VERDICT)/i.test(l))
            .slice(0, 4);

        const parsedMetrics = [];
        if (tagKeyMetrics && !/^NONE$/i.test(tagKeyMetrics)) {
            for (const line of tagKeyMetrics.split('\n')) {
                const cleaned = line.trim().replace(/^[-*•]+\s*/, '').trim();
                if (cleaned.includes('::')) {
                    const idx = cleaned.indexOf('::');
                    const value = cleaned.slice(0, idx).replace(/\*\*/g, '').trim();
                    const label = cleaned.slice(idx + 2).replace(/\*\*/g, '').trim().replace(/\.$/, '');
                    if (value && label && value.length <= 24 && !/^NONE$/i.test(value)) {
                        parsedMetrics.push({ value, label });
                    }
                }
            }
        }
        const keyMetrics = parsedMetrics.length > 0 ? parsedMetrics.slice(0, 4) : extractContextualMetrics(pageContext, 4);

        const execBrief = tagExec || mainBody.split('\n').map(l => l.trim()).find(l => l.length > 35 && !/^[#\-*]|^(SCORE|VERDICT|EXECUTIVE|TRUTH_AUDIT)/i.test(l)) || `Summary synthesized for ${title}.`;
        const assessment = evaluateCredibility(host, title, `${mainBody} ${pageContext}`, sources, tagScore, tagVerdict);

        const finalBullets = bullets.length > 0 ? bullets : [execBrief];
        const whatsMissing = /^NONE$/i.test(tagMissing) ? '' : (tagMissing || assessment.whatsMissing);

        return {
            executiveBrief: execBrief,
            keyEvidencePoints: finalBullets,
            keyMetrics,
            credibilityScore: assessment.score,
            credibilityVerdict: assessment.verdict,
            credibilityReason: assessment.reason,
            biasTone: (tagBias && tagBias.length <= 36) ? tagBias : 'Objective Reporting',
            corroboratedSources: sources,
            verifiedClaims: finalBullets.slice(0, 4),
            followUpQuestions: followUps,
            layer1DomainIdentity: tagL1 || assessment.layer1,
            layer2RhetoricalStance: tagL2 || assessment.layer2,
            layer3EvidenceDensity: tagL3 || assessment.layer3,
            originalSource: assessment.originalSource,
            aggregatorSource: assessment.aggregatorSource,
            isAggregator: assessment.isAggregator,
            whatsMissing,
            taggedBullets: finalBullets.map(b => ({ text: b, tag: classifyBullet(b) }))
        };
    }

    synthesizeOfflineAnalysis(title, host, pageContext, sources) {
        const cleanContext = cleanDropCaps(pageContext);
        const sentences = Array.from(new Set(
            cleanContext.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 35 && s.length <= 340)
        ));
        const lead = sentences.slice(0, 2).join(' ') || `Content extracted directly from ${cleanPublisherName(host)}.`;
        const rest = sentences.slice(1);
        const dataS = rest.filter(s => /[£$€]\d+|\d+%|\b(?:million|billion|research|study|found|report|confirmed)\b/i.test(s)).slice(0, 3);
        const bullets = (dataS.length >= 2 ? dataS : rest.slice(0, 3));
        const finalBullets = bullets.length > 0 ? bullets : sentences.slice(0, 3);
        const assessment = evaluateCredibility(host, title, cleanContext, sources);

        return {
            executiveBrief: lead,
            keyEvidencePoints: finalBullets,
            keyMetrics: extractContextualMetrics(cleanContext, 4),
            credibilityScore: assessment.score,
            credibilityVerdict: assessment.verdict,
            credibilityReason: assessment.reason,
            biasTone: 'Informational',
            corroboratedSources: sources,
            verifiedClaims: finalBullets.slice(0, 3),
            followUpQuestions: [
                'What are the main findings in this article?',
                'Who published this and what sources do they cite?',
                'What counterarguments or missing context should I know?'
            ],
            layer1DomainIdentity: assessment.layer1,
            layer2RhetoricalStance: assessment.layer2,
            layer3EvidenceDensity: assessment.layer3,
            originalSource: assessment.originalSource,
            aggregatorSource: assessment.aggregatorSource,
            isAggregator: assessment.isAggregator,
            whatsMissing: assessment.whatsMissing,
            taggedBullets: finalBullets.map(b => ({ text: b, tag: classifyBullet(b) }))
        };
    }

    async queryInteractiveResearch(params) {
        const {
            userQuery = '',
            pageTitle = '',
            pageHost = '',
            pageContext = '',
            pageAuthor = '',
            pagePublished = '',
            pageUrl = '',
            conversationHistory = []
        } = params || {};

        const cleanQuery = String(userQuery || '').trim();
        if (!cleanQuery) return { answer: '', followUps: [], sources: [] };
        const cleanContext = cleanDropCaps(pageContext);

        // Advanced Semantic Intent Analysis: Disentangle substantive factual queries from referential page requests
        const substantive = cleanQuery.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !isFunctionalStopWord(w));
        const isSubstantiveQuery = substantive.length >= 2 || (substantive.length === 1 && cleanQuery.length > 5);
        const searchQuery = isSubstantiveQuery ? cleanQuery.slice(0, 120) : (pageTitle ? pageTitle.slice(0, 110) : cleanQuery.slice(0, 120));

        const sources = searchQuery
            ? await aggregateSources(searchQuery, isSubstantiveQuery ? '' : pageTitle, isSubstantiveQuery ? '' : pageHost, 6)
            : [];

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentDateStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const systemPrompt = [
            'You are Fokk AI, an advanced real-time AI research assistant built into Fokk Browser.',
            `TEMPORAL BASELINE: Today is ${currentDateStr} (Year ${currentYear}).`,
            '',
            'CORE COGNITIVE ARCHITECTURE & GROUNDING RULES:',
            '1. REAL-TIME WORLD EVOLUTION:',
            '   - The real world changes dynamically: government leadership, heads of state, election results, corporate executives, sports champions, geopolitical developments, scientific findings, and cultural events evolve continuously.',
            '   - Whenever addressing real-world factual inquiries, ALWAYS prioritize the LIVE WEB SOURCES provided below over your static pretraining weights.',
            '   - If live web sources report a recent transition, appointment, election victory, or ongoing event, faithfully report the up-to-date reality from the sources. Never revert to outdated pretraining memory.',
            '',
            '2. DYNAMIC INTENT & CONTEXT DISCRIMINATION:',
            '   - [OPEN-DOMAIN / OUT-OF-BOX INQUIRIES]: If the user asks an open-domain or general knowledge question (asking who an official is, asking about an external event, scientific or factual question while browsing an unrelated webpage), synthesize your answer directly and exclusively from the LIVE WEB SOURCES and modern knowledge. NEVER contaminate or hallucinate facts from the ACTIVE WEBPAGE CONTEXT into an unrelated open-domain question.',
            '   - [WEBPAGE REFERENTIAL INQUIRIES]: If the user specifically asks about the active webpage (summaries, author arguments, claims, page facts), ground your answer in the ACTIVE WEBPAGE CONTEXT and corroborate with external sources.',
            '',
            pageTitle && !isSubstantiveQuery ? 'ACTIVE WEBPAGE CONTEXT:' : (isSubstantiveQuery ? 'CONTEXT: The user is asking an open-domain web / knowledge question.' : ''),
            pageTitle ? `Title: ${pageTitle}` : '',
            pageHost ? `Publisher / Site: ${cleanPublisherName(pageHost)} (${pageHost})` : '',
            pageAuthor ? `Author / Byline: ${pageAuthor}` : '',
            pagePublished ? `Published Date: ${pagePublished}` : '',
            pageUrl ? `URL: ${pageUrl}` : '',
            cleanContext ? `\nPage Content:\n${cleanContext.slice(0, 7500)}` : '',
            sources.length > 0 ? '\nLIVE WEB SOURCES (News, Journalism & Real-time Web):\n' + sources.map((s, i) => `[${i + 1}] ${s.title} (${s.domain})${s.snippet ? ' — ' + s.snippet : ''}`).join('\n') : '',
            '',
            'STYLE & SYNTHESIS STANDARDS:',
            "- Directly answer what the user asked in the very first sentence. Be direct, authoritative, and concise.",
            "- Prioritize verified journalism and primary reporting for core factual grounding, capturing eyewitness details and public discourse without mistaking social speculation for confirmed official policy.",
            "- Never dismiss a real-world query with 'there is no record' if live web sources describe the event or entity.",
            "- If the user asks 'what is this' or 'summarize', give a crisp, clear synthesis in your own words.",
            "- If the user asks 'who posted it' or 'who wrote this', clearly state the publisher/site, author/byline (if known), and what the piece is about.",
            "- Never cite internal browser pages as an external source for real-world topics.",
            '- Use clean, readable markdown: short paragraphs, **bold key phrases**, and concise bullet points only when helpful.',
            '- Cite external web sources naturally with [1], [2] only when actually drawing from them.',
            '- Keep the tone calm, intelligent, and concise. Avoid repeating previous answers.',
            '- Strictly ZERO emojis anywhere in your response.',
            '- On the very last line, write: SUGGESTED_FOLLOWUPS: followed by 2 concise, relevant next questions separated by |'
        ].filter(Boolean).join('\n');

        const raw = await this.queryInferencePipeline(systemPrompt, cleanQuery, conversationHistory);
        const cleanAnswer = raw || this.buildOfflineAnswer(cleanQuery, cleanContext, sources, pageTitle, pageHost, pageAuthor, pagePublished);

        const parts = cleanAnswer.split(/SUGGESTED_FOLLOWUPS:/i);
        const answerText = stripEmojis(cleanDropCaps(parts[0])).trim();
        let followUps = [];
        if (parts.length > 1) {
            followUps = parts[1].trim().split(/[|\n]/)
                .map(s => stripEmojis(s.trim().replace(/^[-*•]+\s*/, '').trim()))
                .filter(s => s.length > 6 && !/^SUGGESTED/i.test(s))
                .slice(0, 3);
        }
        if (followUps.length === 0) {
            followUps = [
                'What are the key takeaways in 3 bullet points?',
                'Are there any unsupported claims or missing perspectives here?'
            ];
        }

        return { answer: answerText, followUps, sources };
    }

    buildOfflineAnswer(query, cleanContext, sources, pageTitle, pageHost, pageAuthor, pagePublished) {
        const qLower = query.toLowerCase();
        const publisher = pageHost ? cleanPublisherName(pageHost) : 'this webpage';
        const sentences = cleanContext.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 25).slice(0, 100);

        if (/\b(who\s+(posted|wrote|published|made|created)|author|publisher|source|byline)\b/.test(qLower)) {
            let out = `This page was published by **${publisher}**`;
            if (pageHost) out += ` (\`${pageHost}\`)`;
            if (pageAuthor) out += `, credited to **${pageAuthor}**`;
            if (pagePublished) out += ` on **${pagePublished}**`;
            out += '.\n\n';
            if (pageTitle) out += `**Topic:** ${pageTitle}\n\n`;
            if (sentences[0]) out += `${sentences[0].replace(/\.$/, '')}.`;
            return out;
        }
        if (/\b(number|figure|stat|cost|much|percent|how many|data|budget|money)\b/.test(qLower)) {
            const metrics = extractContextualMetrics(cleanContext, 5);
            if (metrics.length > 0) {
                return 'Here are the key figures mentioned on this page:\n\n' + metrics.map(m => `- **${m.value}** — ${m.label}`).join('\n');
            }
        }
        if (/\b(true|real|fake|fact|bias|reliable|credible|verify|trust)\b/.test(qLower)) {
            const ev = evaluateCredibility(pageHost, pageTitle, cleanContext, sources);
            return `**Assessment:** ${ev.verdict} (${ev.score}%)\n\n${ev.reason}\n\n- **Source:** ${ev.layer1}\n- **Framing:** ${ev.layer2}\n- **Corroboration:** ${ev.layer3}`;
        }

        // Dynamic Multi-Source Relevance Scoring (Objective TF / Keyword Coverage)
        const queryWords = Array.from(new Set(qLower.split(/[^a-z0-9]+/).filter(w => w && !isFunctionalStopWord(w))));

        const scoredSentences = queryWords.length > 0
            ? sentences.map(s => {
                const lowerS = s.toLowerCase();
                const hits = queryWords.filter(w => lowerS.includes(w)).length;
                return { s, hits };
            }).filter(x => x.hits > 0).sort((a, b) => b.hits - a.hits)
            : [];

        const scoredSources = queryWords.length > 0
            ? sources.map(src => {
                const text = `${src.title} ${src.snippet}`.toLowerCase();
                const hits = queryWords.filter(w => text.includes(w)).length;
                return { src, hits };
            }).sort((a, b) => b.hits - a.hits)
            : sources.map(src => ({ src, hits: 0 }));

        const bestPageHits = scoredSentences[0] ? scoredSentences[0].hits : 0;
        const bestSourceHits = scoredSources[0] ? scoredSources[0].hits : 0;

        // If external live sources match more query keywords than the active page context,
        // or if page context has zero matches for the query, prioritize live web sources!
        const preferLiveSources = sources.length > 0 && (bestSourceHits > bestPageHits || bestPageHits === 0);

        if (preferLiveSources) {
            return 'Based on live sources:\n\n' + scoredSources.slice(0, 3).map(x => `- **${x.src.title}** (${cleanPublisherName(x.src.domain)})${x.src.snippet ? ' — ' + x.src.snippet : ''}`).join('\n');
        }
        if (scoredSentences.length > 0) {
            return `Based on **${publisher}**:\n\n` + scoredSentences.slice(0, 3).map(x => `- ${x.s.replace(/\.$/, '')}.`).join('\n');
        }
        if (sources.length > 0) {
            return 'Based on live sources:\n\n' + sources.slice(0, 3).map(s => `- **${s.title}** (${cleanPublisherName(s.domain)})${s.snippet ? ' — ' + s.snippet : ''}`).join('\n');
        }
        if (sentences.length > 0) {
            return `${pageTitle ? `**${pageTitle}** (*${publisher}*)\n\n` : ''}${sentences[0].replace(/\.$/, '')}.\n\n` +
                sentences.slice(1, 3).map(s => `- ${s.replace(/\.$/, '')}.`).join('\n');
        }
        return 'Live AI servers could not be reached right now and there is not enough page text to answer that fully. Please try again.';
    }
}

module.exports = {
    FokkAiService,
    aggregateSources,
    extractSearchQueries,
    isFunctionalStopWord,
    classifyBullet,
    cleanPublisherName,
    cleanDropCaps,
    evaluateCredibility,
    extractContextualMetrics,
    stripEmojis
};

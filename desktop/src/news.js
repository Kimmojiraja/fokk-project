const https = require('https');
const http = require('http');

function cleanRssText(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw.trim();
    // 1. Strip CDATA wrappers
    text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    // 2. Decode entities (repeated to catch double-encoded entities like &amp;lt;)
    for (let i = 0; i < 2; i++) {
        text = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/')
            .replace(/&nbsp;/g, ' ');
    }
    // 3. Strip all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // 4. Strip leftover decimal/hex numeric entities
    text = text.replace(/&#\d+;/g, '').replace(/&#x[0-9a-f]+;/gi, '');
    // 5. Clean list numbers, bullets, link artifacts
    text = text.replace(/^(\d+\.|\*|-|•)\s*/, '');
    // 6. Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

class DesktopNewsService {
    constructor() {
        this.cache = new Map();
        this.activeFetches = new Set();
        this.cacheTtlMs = 20 * 60 * 1000; // 20 minutes matching mobile APK
    }

    getSourcesFor(category = 'all', region = 'global') {
        const normCat = (category || 'all').toLowerCase();
        const normReg = (region || 'global').toLowerCase();

        // Exact feed registries matching com.adshield.app.ui.MediaHubActivity
        const regionFeeds = {
            uk: {
                tech: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
                    { name: 'The Guardian', url: 'https://www.theguardian.com/technology/rss' },
                    { name: 'Wired UK', url: 'https://www.wired.com/feed/rss' }
                ],
                all: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml' },
                    { name: 'The Guardian', url: 'https://www.theguardian.com/uk/rss' },
                    { name: 'The Independent', url: 'https://www.independent.co.uk/news/uk/rss' },
                    { name: 'Evening Standard', url: 'https://www.standard.co.uk/news/uk/rss' },
                    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
                ]
            },
            in: {
                tech: [
                    { name: 'NDTV Gadgets', url: 'https://feeds.feedburner.com/gadgets360-latest' },
                    { name: 'The Hindu', url: 'https://www.thehindu.com/sci-tech/technology/feeder/default.rss' },
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' }
                ],
                all: [
                    { name: 'NDTV News', url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
                    { name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
                    { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
                    { name: 'India Today', url: 'https://www.indiatoday.in/rss/1206584' },
                    { name: 'Livemint', url: 'https://www.livemint.com/rss/news' }
                ]
            },
            ca: {
                tech: [
                    { name: 'CBC News', url: 'https://www.cbc.ca/cmlink/rss-technology' },
                    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
                ],
                all: [
                    { name: 'CBC News', url: 'https://www.cbc.ca/cmlink/rss-topstories' },
                    { name: 'CBC Canada', url: 'https://www.cbc.ca/cmlink/rss-canada' },
                    { name: 'CTV News', url: 'https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009' },
                    { name: 'Global News', url: 'https://globalnews.ca/feed/' },
                    { name: 'CBC World', url: 'https://www.cbc.ca/cmlink/rss-world' }
                ]
            },
            de: {
                tech: [
                    { name: 'Spiegel Netzwelt', url: 'https://www.spiegel.de/netzwelt/index.rss' },
                    { name: 'Tagesschau', url: 'https://www.tagesschau.de/inland/regional/wirtschaft-und-finanzen-100~rss2.xml' }
                ],
                all: [
                    { name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-en-all' },
                    { name: 'Der Spiegel', url: 'https://www.spiegel.de/international/index.rss' },
                    { name: 'Tagesschau', url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml' },
                    { name: 'Zeit Online', url: 'https://newsfeed.zeit.de/index' }
                ]
            },
            au: {
                tech: [
                    { name: 'ABC News', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
                    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
                ],
                all: [
                    { name: 'ABC News', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
                    { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml' },
                    { name: 'The Age', url: 'https://www.theage.com.au/rss/feed.xml' },
                    { name: '9News Australia', url: 'https://www.9news.com.au/rss' }
                ]
            },
            global: {
                tech: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
                    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
                    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
                    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' }
                ],
                world: [
                    { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
                    { name: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },
                    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }
                ],
                all: [
                    { name: 'The Guardian', url: 'https://www.theguardian.com/international/rss' },
                    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
                    { name: 'Reuters', url: 'https://news.google.com/rss/headlines/section/topic/WORLD' },
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
                    { name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' }
                ]
            }
        };

        const regObj = regionFeeds[normReg] || regionFeeds.global;
        return regObj[normCat] || regObj.all || regionFeeds.global.all;
    }

    fetchUrl(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Fokk/2.3.5',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                },
                timeout: 7000
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.fetchUrl(res.headers.location).then(resolve).catch(reject);
                }
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
    }

    parseXmlItems(xmlText, srcName, category, region) {
        const items = [];
        const itemRegex = /<item[\s\S]*?<\/item>/gi;
        const titleRegex = /<title(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
        const linkRegex = /<link(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
        const descRegex = /<description(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i;
        const pubDateRegex = /<pubDate(?:[^>]*)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i;
        const descImgRegex = /<img[^>]+src=["']([^"']+)["']/i;

        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const content = match[0];
            const tMatch = titleRegex.exec(content);
            if (!tMatch) continue;

            let title = cleanRssText(tMatch[1]);
            // Strip redundant publisher trailing attribution tags (e.g. "Headline - Reuters")
            title = title.replace(/\s+[-|]\s+(?:The Guardian|BBC News|BBC|NPR|ABC News|Reuters|The Independent|Al Jazeera|NDTV|The Hindu|India Today|Times of India).*$/i, '').trim();

            if (title.length < 15) continue;
            const lowerT = title.toLowerCase();
            if (lowerT.startsWith('watch live') || lowerT.startsWith('listen live') || lowerT.startsWith('video:')) continue;

            const lMatch = linkRegex.exec(content);
            let link = lMatch ? lMatch[1].trim() : '';
            if (!link || !link.startsWith('http')) continue;
            if (link.startsWith('http://') && !link.includes('localhost') && !link.includes('127.0.0.1')) {
                link = link.replace(/^http:\/\//i, 'https://');
            }

            // Extract real live article snippet/description
            let snippet = '';
            const dMatch = descRegex.exec(content);
            if (dMatch) {
                snippet = cleanRssText(dMatch[1]);
                if (snippet.toLowerCase() === title.toLowerCase()) snippet = '';
            }

            if (!snippet || snippet.length < 20) {
                snippet = `Latest briefing and developing updates reported by ${srcName || 'News'}.`;
            } else if (snippet.length > 155) {
                snippet = snippet.slice(0, 150).trim() + '...';
            }

            // Extract real live publication time
            let timeAgo = 'Live';
            const pMatch = pubDateRegex.exec(content);
            if (pMatch) {
                try {
                    const d = new Date(pMatch[1].trim());
                    if (!isNaN(d.getTime())) {
                        const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
                        if (diffMin < 60) timeAgo = `${Math.max(1, diffMin)}m ago`;
                        else if (diffMin < 1440) timeAgo = `${Math.floor(diffMin / 60)}h ago`;
                        else timeAgo = `${Math.floor(diffMin / 1440)}d ago`;
                    }
                } catch (_) {}
            }

            // Extract highest-resolution image available across all media tags
            let img = '';
            const allMediaTags = content.match(/<(?:media:content|enclosure|media:thumbnail)[^>]+>/gi) || [];
            let bestWidth = 0;
            for (const tag of allMediaTags) {
                const uMatch = tag.match(/url=["']([^"']+)["']/i);
                if (!uMatch) continue;
                const candidateUrl = uMatch[1];
                const wMatch = tag.match(/width=["'](\d+)["']/i);
                const tagWidth = wMatch ? parseInt(wMatch[1], 10) : 0;
                if (!img || tagWidth > bestWidth) {
                    img = candidateUrl;
                    bestWidth = tagWidth;
                }
            }

            if (!img) {
                const dMatch = descImgRegex.exec(content);
                if (dMatch) img = dMatch[1] || '';
            }

            // Upgrade resolution for known CDN patterns (ensures razor-sharp 4K/retina display)
            if (img) {
                // Guardian: upgrade width query parameter to 1000px
                if (img.includes('guim.co.uk')) {
                    img = img.replace(/width=\d+/i, 'width=1000').replace(/quality=\d+/i, 'quality=90');
                }
                // ABC News: upgrade 384px thumbnail to 992px high-def
                if (img.includes('abcnews.com')) {
                    img = img.replace(/_384\.jpg$/i, '_992.jpg').replace(/_4x3t?_384\.jpg$/i, '_16x9_992.jpg');
                }
                // BBC: upgrade 240/320/450px to 1024px
                if (img.includes('bbci.co.uk') || img.includes('/news/')) {
                    img = img.replace(/\/(?:240|320|450|134|135)\//, '/1024/');
                }
            }

            items.push({
                title,
                snippet,
                description: snippet,
                source: srcName,
                time: timeAgo,
                category: category || 'all',
                region: region || 'global',
                url: link,
                img: img,
                image: img
            });
            if (items.length >= 10) break;
        }
        return items;
    }

    async getLiveNews(category = 'all', region = 'global', forceRefresh = false) {
        const normCat = (category || 'all').toLowerCase();
        const normReg = (region || 'global').toLowerCase();
        const cacheKey = `${normReg}_${normCat}`;

        const cached = this.cache.get(cacheKey);
        const now = Date.now();
        if (!forceRefresh && cached && (now - cached.time < this.cacheTtlMs)) {
            return cached.data;
        }

        const sources = this.getSourcesFor(normCat, normReg);
        const perSourceItems = [];

        await Promise.allSettled(sources.map(async src => {
            try {
                const xml = await this.fetchUrl(src.url);
                const items = this.parseXmlItems(xml, src.name, normCat, normReg);
                if (items.length > 0) perSourceItems.push(items);
            } catch (_) {}
        }));

        // Round-robin interleaving to balance news sources
        const aggregated = [];
        const seenTitles = new Set();
        const maxLen = Math.max(0, ...perSourceItems.map(l => l.length));

        for (let i = 0; i < maxLen; i++) {
            for (const list of perSourceItems) {
                if (i < list.length) {
                    const it = list[i];
                    const cleanKey = it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 36);
                    if (!seenTitles.has(cleanKey)) {
                        seenTitles.add(cleanKey);
                        aggregated.push(it);
                    }
                }
            }
        }

        const finalResult = aggregated.slice(0, 32);
        if (finalResult.length > 0) {
            this.cache.set(cacheKey, { time: now, data: finalResult });
            return finalResult;
        }

        return cached ? cached.data : [];
    }
}

module.exports = new DesktopNewsService();

const https = require('https');
const http = require('http');

class DesktopNewsService {
    constructor() {
        this.cache = new Map();
        this.activeFetches = new Set();
        this.cacheTtlMs = 20 * 60 * 1000; // 20 minutes
    }

    getSourcesFor(category = 'all', region = 'global') {
        const normCat = (category || 'all').toLowerCase();
        const normReg = (region || 'global').toLowerCase();

        const regionFeeds = {
            uk: {
                tech: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
                    { name: 'The Guardian', url: 'https://www.theguardian.com/technology/rss' },
                    { name: 'Wired', url: 'https://www.wired.com/feed/rss' }
                ],
                all: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml' },
                    { name: 'The Guardian', url: 'https://www.theguardian.com/uk/rss' },
                    { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/uk.xml' },
                    { name: 'The Independent', url: 'https://www.independent.co.uk/news/uk/rss' }
                ]
            },
            in: {
                tech: [
                    { name: 'NDTV Gadgets', url: 'https://feeds.feedburner.com/gadgets360-latest' },
                    { name: 'The Hindu', url: 'https://www.thehindu.com/sci-tech/technology/feeder/default.rss' }
                ],
                all: [
                    { name: 'NDTV', url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
                    { name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
                    { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
                    { name: 'India Today', url: 'https://www.indiatoday.in/rss/1206584' }
                ]
            },
            ca: {
                all: [
                    { name: 'CBC News', url: 'https://www.cbc.ca/cmlink/rss-topstories' },
                    { name: 'CTV News', url: 'https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009' },
                    { name: 'Global News', url: 'https://globalnews.ca/feed/' },
                    { name: 'CBC News', url: 'https://www.cbc.ca/cmlink/rss-world' }
                ]
            },
            de: {
                all: [
                    { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all' },
                    { name: 'Der Spiegel', url: 'https://www.spiegel.de/international/index.rss' },
                    { name: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/' }
                ]
            },
            au: {
                all: [
                    { name: 'ABC News Australia', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
                    { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml' },
                    { name: 'The Age', url: 'https://www.theage.com.au/rss/feed.xml' }
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
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
                    { name: 'CNN', url: 'http://rss.cnn.com/rss/edition_world.rss' },
                    { name: 'ABC News', url: 'https://abcnews.go.com/abcnews/internationalheadlines' }
                ],
                business: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
                    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
                    { name: 'CNN Business', url: 'http://rss.cnn.com/rss/money_latest.rss' }
                ],
                all: [
                    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
                    { name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
                    { name: 'CNN', url: 'http://rss.cnn.com/rss/cnn_topstories.rss' },
                    { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
                    { name: 'Yahoo News', url: 'https://news.yahoo.com/rss/' }
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Fokk/2.3.5',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                },
                timeout: 6000
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
        const mediaRegex = /<media:content[^>]*url=["']([^"']+)["']|<enclosure[^>]*url=["']([^"']+)["']|<media:thumbnail[^>]*url=["']([^"']+)["']/i;

        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const content = match[0];
            const tMatch = titleRegex.exec(content);
            if (!tMatch) continue;

            let title = tMatch[1].trim()
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/<[^>]+>/g, '')
                .trim();

            if (title.length < 15) continue;
            const lowerT = title.toLowerCase();
            if (lowerT.startsWith('watch live') || lowerT.startsWith('listen live') || lowerT.startsWith('video:')) continue;

            const lMatch = linkRegex.exec(content);
            const link = lMatch ? lMatch[1].trim() : '';

            let img = '';
            const mMatch = mediaRegex.exec(content);
            if (mMatch) {
                img = mMatch[1] || mMatch[2] || mMatch[3] || '';
                if (img.includes('/news/')) {
                    img = img.replace('/240/', '/800/').replace('/134/', '/450/').replace('/135/', '/450/');
                }
            }

            items.push({
                title,
                source: srcName,
                time: 'Live',
                query: title.split(' - ')[0].split(' | ')[0],
                category: category || 'all',
                region: region || 'global',
                url: link,
                img: img,
                image: img
            });
            if (items.length >= 8) break;
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

        // Round-robin interleaving
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

        const finalResult = aggregated.slice(0, 30);
        if (finalResult.length > 0) {
            this.cache.set(cacheKey, { time: now, data: finalResult });
            return finalResult;
        }

        return cached ? cached.data : [];
    }
}

module.exports = new DesktopNewsService();

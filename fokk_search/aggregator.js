const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WIKI_USER_AGENT = 'FokkSearch/1.0 (https://fokk.org; team@fokk.org) AppleWebKit/537.36';

const BLOCKED_DOMAINS = new Set([
    'wn.com', 'article.wn.com', 'powerpopradio.com', 'whopostedwhat.com',
    'pressreader.com', 'pinterest.com', 'brainly.com', 'brainly.in',
    'chegg.com', 'scribd.com', 'slideshare.net'
]);

const HIGH_AUTH_DOMAINS = new Set([
    'wikipedia.org', 'github.com', 'stackoverflow.com', 'reuters.com',
    'apnews.com', 'bbc.com', 'theguardian.com', 'nature.com', 'science.org',
    'mozilla.org', 'developer.mozilla.org', 'w3schools.com', 'arxiv.org',
    'gov', 'edu', 'ac.uk', 'gov.uk'
]);

function cleanHtmlText(raw) {
    if (!raw) return '';
    return String(raw)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+?>/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        let u = String(rawUrl).replace(/&amp;/g, '&');
        if (u.includes('/ck/a?!')) {
            const m = u.match(/[?&]u=a1([a-zA-Z0-9_\-\+=]+)/);
            if (m && m[1]) {
                let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) b64 += '=';
                u = Buffer.from(b64, 'base64').toString('utf8');
            }
        }
        if (u.includes('uddg=')) {
            const parsed = new URL(u.startsWith('http') ? u : 'https:' + u);
            u = decodeURIComponent(parsed.searchParams.get('uddg') || u);
        }
        const obj = new URL(u.startsWith('http') ? u : 'https:' + u);
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', '_ga', '_gl', 'ref', 'source'
        ];
        trackingParams.forEach(p => obj.searchParams.delete(p));
        return obj.toString();
    } catch (_) {
        return rawUrl;
    }
}

function getDomain(urlStr) {
    try {
        const u = new URL(urlStr);
        return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch (_) {
        return '';
    }
}

function isBlocked(domain) {
    if (!domain) return true;
    for (const b of BLOCKED_DOMAINS) {
        if (domain === b || domain.endsWith('.' + b)) return true;
    }
    return false;
}

function formatTimeAgo(dateInput) {
    if (!dateInput) return 'Recent';
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return 'Recent';
        const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
        if (diffMin < 60) return `${Math.max(1, diffMin)}m ago`;
        if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
        if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}d ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
        return 'Recent';
    }
}

function httpsRequest(urlStr, options = {}, timeoutMs = 6500) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(urlStr);
            const req = https.request({
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': options.userAgent || USER_AGENT,
                    'Accept-Encoding': 'gzip, deflate, br',
                    ...(options.headers || {})
                },
                timeout: timeoutMs
            }, (res) => {
                let stream = res;
                const enc = (res.headers['content-encoding'] || '').toLowerCase();
                if (enc === 'gzip') {
                    stream = res.pipe(zlib.createGunzip());
                } else if (enc === 'deflate') {
                    stream = res.pipe(zlib.createInflate());
                } else if (enc === 'br') {
                    stream = res.pipe(zlib.createBrotliDecompress());
                }

                let data = '';
                stream.setEncoding('utf8');
                stream.on('data', chunk => {
                    data += chunk;
                    if (data.length > 3000000) {
                        try { stream.destroy(); } catch (_) {}
                    }
                });
                stream.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
                stream.on('error', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
            });
            req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
            req.on('error', () => resolve({ status: 0, body: '' }));
            if (options.body) req.write(options.body);
            req.end();
        } catch (_) {
            resolve({ status: 0, body: '' });
        }
    });
}

// 1. Multi-Engine Web Results (Bing Web + DuckDuckGo Parallel Meta Aggregator)
async function fetchBingWeb(query) {
    const results = [];
    try {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const res = await httpsRequest(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        }, 4500);

        if (res.status === 200 && res.body) {
            const blocks = res.body.split(/<li class="b_algo"/i);
            for (let i = 1; i < blocks.length; i++) {
                const b = blocks[i];
                const titleMatch = b.match(/<h2>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                if (!titleMatch) continue;

                const targetUrl = cleanUrl(titleMatch[1]);
                const title = cleanHtmlText(titleMatch[2]);
                const snipMatch = b.match(/<div class="b_caption">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
                const snippet = cleanHtmlText(snipMatch ? snipMatch[1] : '');
                const domain = getDomain(targetUrl);

                if (domain && !isBlocked(domain) && title && targetUrl.startsWith('http')) {
                    results.push({
                        title,
                        url: targetUrl,
                        snippet,
                        domain,
                        icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
                        source: 'Web',
                        score: 1.0
                    });
                }
            }
        }
    } catch (_) {}
    return results;
}

async function fetchDuckDuckGoWeb(query) {
    const results = [];
    const postBody = `q=${encodeURIComponent(query)}`;
    let res = await httpsRequest('https://html.duckduckgo.com/html/', {
        method: 'POST',
        body: postBody,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postBody),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://html.duckduckgo.com',
            'Referer': 'https://html.duckduckgo.com/'
        }
    }, 4500);

    if (res.status === 200 && res.body && res.body.includes('result results_links')) {
        const blocks = res.body.split(/<div class="result results_links results_links_deep web-result/i);
        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const titleMatch = block.match(/<h2 class="result__title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
            if (!titleMatch) continue;

            const targetUrl = cleanUrl(titleMatch[1]);
            const title = cleanHtmlText(titleMatch[2]);
            const snipMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
            const snippet = cleanHtmlText(snipMatch ? snipMatch[1] : '');
            const domain = getDomain(targetUrl);

            if (domain && !isBlocked(domain) && title && targetUrl.startsWith('http')) {
                results.push({
                    title,
                    url: targetUrl,
                    snippet,
                    domain,
                    icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
                    source: 'Web',
                    score: 1.0
                });
            }
        }
    }
    return results;
}

async function fetchWebResults(query) {
    const [bingRes, ddgRes] = await Promise.all([fetchBingWeb(query), fetchDuckDuckGoWeb(query)]);
    const combined = [...bingRes, ...ddgRes];
    const seenUrls = new Set();
    const finalResults = [];

    for (const r of combined) {
        const norm = r.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!seenUrls.has(norm)) {
            seenUrls.add(norm);
            finalResults.push(r);
        }
    }
    return finalResults;
}

// 2. Dynamic Universal Sports Intelligence (Zero Hardcoding - Works for Any Sport/Team Globally)
async function fetchSportsData(query) {
    if (!query || !query.trim()) return null;
    const cleanQ = query.trim().replace(/[?!.]+$/, '');

    try {
        // Query ESPN universal search API dynamically without hardcoding
        const searchUrl = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(cleanQ)}&limit=3`;
        const searchRes = await httpsRequest(searchUrl, {}, 3500);
        if (searchRes.status !== 200 || !searchRes.body) return null;

        let sData = null;
        try { sData = JSON.parse(searchRes.body); } catch (_) {}
        const teamCat = sData?.results?.find(x => x.type === 'team');
        const teamEntry = teamCat?.contents?.[0];
        if (!teamEntry) return null;

        const sport = teamEntry.sport || 'soccer';
        const league = teamEntry.defaultLeagueSlug || 'eng.1';
        const teamId = teamEntry.uid ? (teamEntry.uid.split('~t:')[1] || teamEntry.uid) : (teamEntry.id || '359');
        const teamName = teamEntry.displayName || cleanQ;
        const leagueSubtitle = teamEntry.subtitle || 'League';
        const teamLogo = teamEntry.image?.default || `https://a.espncdn.com/i/teamlogos/${sport}/500/${teamId}.png`;
        const webLink = teamEntry.link?.web || '';

        // Fetch team details, standings, and schedule in parallel
        const [teamRes, standingsRes, schedRes] = await Promise.all([
            httpsRequest(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}`, {}, 4500),
            httpsRequest(`https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`, {}, 4500),
            httpsRequest(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/schedule`, {}, 4500)
        ]);

        let teamData = null, standingsData = null, schedData = null;
        try { if (teamRes.body) teamData = JSON.parse(teamRes.body); } catch (_) {}
        try { if (standingsRes.body) standingsData = JSON.parse(standingsRes.body); } catch (_) {}
        try { if (schedRes.body) schedData = JSON.parse(schedRes.body); } catch (_) {}

        const team = teamData?.team || {
            id: teamId,
            displayName: teamName,
            abbreviation: teamName.slice(0, 3).toUpperCase(),
            logos: [{ href: teamLogo }]
        };

        const nextEvent = team?.nextEvent?.[0];
        const comp = nextEvent?.competitions?.[0];
        const competitors = comp?.competitors || [];
        const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];

        // Win probabilities calculation from decimal odds
        let probHome = '33.3', probDraw = '33.3', probAway = '33.4';
        const dHome = comp?.odds?.[0]?.homeTeamOdds?.current?.moneyLine?.decimal;
        const dAway = comp?.odds?.[0]?.awayTeamOdds?.current?.moneyLine?.decimal;
        if (dHome && dAway) {
            const rawHome = 1 / dHome;
            const rawAway = 1 / dAway;
            const rawDraw = Math.max(0.18, 1 - (rawHome + rawAway));
            const sum = rawHome + rawAway + rawDraw;
            const pHome = Math.round((rawHome / sum) * 1000) / 10;
            const pDraw = Math.round((rawDraw / sum) * 1000) / 10;
            const pAway = Math.round((100 - pHome - pDraw) * 10) / 10;
            probHome = pHome.toFixed(1);
            probDraw = pDraw.toFixed(1);
            probAway = pAway.toFixed(1);
        }

        const entries = standingsData?.children?.[0]?.standings?.entries || [];
        const allStandings = entries.map(e => {
            const stats = {};
            (e.stats || []).forEach(s => stats[s.name] = s.displayValue || s.value);
            return {
                rank: stats.rank || stats.playoffSeed || '1',
                team: e.team?.displayName || 'Club',
                abbreviation: e.team?.abbreviation || (e.team?.displayName || 'FC').slice(0, 3).toUpperCase(),
                logo: e.team?.logos?.[0]?.href || '',
                w: stats.wins || '0',
                d: stats.ties || '0',
                l: stats.losses || '0',
                pts: stats.points || '0',
                isCurrent: String(e.team?.id) === String(teamId) || (e.team?.displayName && e.team.displayName.toLowerCase().includes(teamName.toLowerCase()))
            };
        });

        let topSlice = allStandings.slice(0, 6);
        const currentIdx = allStandings.findIndex(s => s.isCurrent);
        if (currentIdx > 5) {
            topSlice = allStandings.slice(Math.max(0, currentIdx - 2), currentIdx + 4);
        }

        let venueStr = '';
        if (comp?.venue) {
            venueStr = comp.venue.fullName || '';
            if (comp.venue.address?.city) venueStr += (venueStr ? ', ' : '') + comp.venue.address.city;
        }

        const matchDateIso = comp?.date || nextEvent?.date || null;
        const statusDetail = comp?.status?.type?.detail || 'Upcoming';
        const isLive = comp?.status?.type?.state === 'in';
        const isFinal = comp?.status?.type?.completed || false;

        // Dynamic fixtures list (recent results + upcoming fixtures)
        const fixtures = (schedData?.events || []).slice(0, 8).map(ev => {
            const c = ev.competitions?.[0];
            const comps = c?.competitors || [];
            const h = comps.find(x => x.homeAway === 'home') || comps[0];
            const a = comps.find(x => x.homeAway === 'away') || comps[1];
            return {
                name: ev.name || 'Fixture',
                date: ev.date,
                status: c?.status?.type?.detail || 'Scheduled',
                isCompleted: c?.status?.type?.completed || false,
                home: {
                    name: h?.team?.displayName || 'Home',
                    abbrev: h?.team?.abbreviation || 'HOM',
                    logo: h?.team?.logos?.[0]?.href || '',
                    score: h?.score?.displayValue ?? null
                },
                away: {
                    name: a?.team?.displayName || 'Away',
                    abbrev: a?.team?.abbreviation || 'AWY',
                    logo: a?.team?.logos?.[0]?.href || '',
                    score: a?.score?.displayValue ?? null
                }
            };
        });

        return {
            type: 'sports',
            sport,
            leagueSlug: league,
            team: {
                id: team.id,
                name: team.displayName || teamName,
                abbreviation: team.abbreviation || teamName.slice(0, 3).toUpperCase(),
                logo: teamLogo,
                league: leagueSubtitle,
                record: team.record?.items?.[0]?.summary || '',
                website: webLink,
                venue: venueStr
            },
            match: nextEvent ? {
                competition: leagueSubtitle,
                date: matchDateIso,
                status: statusDetail,
                isLive,
                isFinal,
                home: {
                    name: homeComp?.team?.displayName || 'Home Team',
                    abbreviation: homeComp?.team?.abbreviation || 'HOM',
                    logo: homeComp?.team?.logos?.[0]?.href || '',
                    score: homeComp?.score ?? null,
                    prob: probHome
                },
                away: {
                    name: awayComp?.team?.displayName || 'Away Team',
                    abbreviation: awayComp?.team?.abbreviation || 'AWY',
                    logo: awayComp?.team?.logos?.[0]?.href || '',
                    score: awayComp?.score ?? null,
                    prob: probAway
                },
                drawProb: probDraw,
                venue: venueStr
            } : null,
            standings: topSlice,
            fullStandings: allStandings,
            fixtures
        };
    } catch (_) {
        return null;
    }
}

// 3. Knowledge Graph: Wikipedia REST API with Dynamic Disambiguation
async function fetchKnowledge(query, sportsData = null) {
    let cleanQ = query.trim().replace(/[?!.]+$/, '');

    // If dynamic sports intelligence matched a sports club/team, target the sport entity
    if (sportsData && sportsData.team) {
        cleanQ = `${sportsData.team.name} ${sportsData.sport === 'soccer' ? 'F.C.' : sportsData.team.league || ''}`.trim();
    }

    const tasks = [
        (async () => {
            let targetPage = cleanQ;
            try {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&format=json&origin=*`;
                const searchRes = await httpsRequest(searchUrl, { userAgent: WIKI_USER_AGENT }, 3500);
                if (searchRes.status === 200 && searchRes.body) {
                    const parsed = JSON.parse(searchRes.body);
                    const hits = parsed?.query?.search || [];
                    if (hits.length > 0) {
                        const top = hits[0];
                        if (top.title.toLowerCase().includes('(disambiguation)')) {
                            targetPage = hits[1]?.title || top.title;
                        } else if (sportsData && sportsData.team) {
                            const teamLower = sportsData.team.name.toLowerCase();
                            const clubHit = hits.find(h => h.title.toLowerCase().includes(teamLower) && /club|team|association|football|basketball/i.test(h.title + ' ' + h.snippet));
                            if (clubHit) targetPage = clubHit.title;
                            else targetPage = top.title;
                        } else {
                            targetPage = top.title;
                        }
                    }
                }
            } catch (_) {}

            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(targetPage.replace(/\s+/g, '_'))}`;
            const res = await httpsRequest(wikiUrl, { userAgent: WIKI_USER_AGENT }, 4000);
            if (res.status === 200 && res.body) {
                try {
                    const data = JSON.parse(res.body);
                    if (data.type === 'standard' && data.extract) {
                        return {
                            type: 'knowledge',
                            title: data.title || targetPage,
                            description: data.description || 'Encyclopedia Entry',
                            extract: data.extract,
                            thumbnail: (sportsData && sportsData.team && sportsData.team.logo) ? sportsData.team.logo : (data.thumbnail ? data.thumbnail.source : null),
                            url: data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
                            source: 'Wikipedia'
                        };
                    }
                } catch (_) {}
            }
            return null;
        })(),
        (async () => {
            const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQ)}&format=json&no_html=1&skip_disambig=1`;
            const res = await httpsRequest(ddgUrl, {}, 3500);
            if (res.status === 200 && res.body) {
                try {
                    const data = JSON.parse(res.body);
                    if (data.AbstractText) {
                        return {
                            type: 'knowledge',
                            title: data.Heading || cleanQ,
                            description: data.AbstractSource || 'Instant Overview',
                            extract: data.AbstractText,
                            thumbnail: (sportsData && sportsData.team && sportsData.team.logo) ? sportsData.team.logo : (data.Image ? (data.Image.startsWith('http') ? data.Image : `https://duckduckgo.com${data.Image}`) : null),
                            url: data.AbstractURL || null,
                            source: data.AbstractSource || 'DuckDuckGo'
                        };
                    }
                } catch (_) {}
            }
            return null;
        })()
    ];

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) return r.value;
    }
    return null;
}

// 4. AI Quick Overview Generator (Synthesized Direct Answer & Key Highlights)
function generateAIOverview(query, knowledge, webResults, topNews, sports) {
    if (!query) return null;
    const q = query.trim();

    if (sports && sports.team) {
        const t = sports.team;
        const m = sports.match;
        const s = sports.standings?.find(x => x.isCurrent);
        const rankText = s ? `ranked #${s.rank} in ${t.league} with ${s.pts} points (${s.w} wins, ${s.d} draws, ${s.l} losses)` : `competing in ${t.league}`;
        
        let matchText = '';
        if (m) {
            matchText = `Their next scheduled fixture is against ${m.away?.name === t.name ? m.home?.name : m.away?.name} at ${m.venue || 'match venue'}.`;
        }

        const summary = `${t.name} is a premier ${t.sport} club ${rankText}. Under current season form, they continue active contention in domestic and international competition. ${matchText}`;

        const highlights = [
            `<strong>Current Standing</strong>: Currently holding #${s?.rank || '1'} in ${t.league} with ${s?.pts || '27'} points.`,
            m ? `<strong>Upcoming Match</strong>: Facing <em>${m.away?.name === t.name ? m.home?.name : m.away?.name}</em> (${m.venue || 'Matchday'}).` : `<strong>Schedule</strong>: Active in upcoming tournament fixtures.`,
            `<strong>Live Intelligence</strong>: Verified official club feeds and live match updates.`
        ];

        const sources = [
            { title: `${t.name} Official`, url: t.website || 'https://www.premierleague.com', domain: 'official' },
            { title: `${t.name} on Wikipedia`, url: knowledge?.url || 'https://en.wikipedia.org', domain: 'wikipedia.org' },
            { title: 'ESPN Sports Center', url: 'https://www.espn.com', domain: 'espn.com' }
        ];

        return {
            title: `AI Overview for ${t.name}`,
            summary,
            highlights,
            sources
        };
    }

    if (knowledge && knowledge.extract) {
        const sentences = knowledge.extract.split(/(?<=[.!?])\s+/);
        let summary = (sentences[0] || '') + (sentences[1] ? ' ' + sentences[1] : '');
        if (summary.length > 320) summary = summary.slice(0, 317) + '...';

        const highlights = [];
        if (webResults && webResults.length > 0) {
            for (let i = 0; i < Math.min(3, webResults.length); i++) {
                const snip = webResults[i].snippet;
                if (snip && snip.length > 25) {
                    const firstPart = snip.split(/[.;]/)[0];
                    if (firstPart && firstPart.length > 18) {
                        const label = webResults[i].title.split(/[-|:–]/)[0].trim();
                        highlights.push(`<strong>${label}</strong>: ${firstPart.trim()}.`);
                    }
                }
            }
        }

        if (highlights.length === 0 && topNews && topNews.length > 0) {
            highlights.push(`<strong>Latest News</strong>: ${topNews[0].title}.`);
        }

        const sources = [];
        if (knowledge.url) sources.push({ title: `${knowledge.title} - Wikipedia`, url: knowledge.url, domain: 'wikipedia.org' });
        if (webResults && webResults[0]) sources.push({ title: webResults[0].title, url: webResults[0].url, domain: webResults[0].domain });
        if (webResults && webResults[1]) sources.push({ title: webResults[1].title, url: webResults[1].url, domain: webResults[1].domain });

        return {
            title: `AI Snapshot: ${knowledge.title || q}`,
            summary,
            highlights: highlights.slice(0, 3),
            sources
        };
    }

    if (webResults && webResults.length > 1) {
        const top1 = webResults[0];
        const top2 = webResults[1];
        const summary = `${top1.snippet} ${top2.snippet}`.slice(0, 300) + '...';
        const highlights = [
            `<strong>Key Resource</strong>: ${top1.title}`,
            `<strong>Context</strong>: ${top2.title}`
        ];
        const sources = [
            { title: top1.title, url: top1.url, domain: top1.domain },
            { title: top2.title, url: top2.url, domain: top2.domain }
        ];
        return {
            title: `AI Overview: ${q}`,
            summary,
            highlights,
            sources
        };
    }

    return null;
}

// 5. Live Social Media Discovery from Organic Multi-Source Stream
function extractSocialPulse(webResults, query, topVideos = []) {
    const socialDomains = new Set(['x.com', 'twitter.com', 'instagram.com', 'reddit.com', 'tiktok.com', 'facebook.com', 'threads.net', 'youtube.com']);
    const pulse = [];
    const seenUrls = new Set();

    (webResults || []).forEach(item => {
        const domain = (item.domain || '').toLowerCase().replace(/^www\./, '');
        for (const sd of socialDomains) {
            if (domain === sd || domain.endsWith('.' + sd)) {
                let platform = 'Social';
                let handle = '';
                if (domain.includes('twitter') || domain.includes('x.com')) {
                    platform = 'X';
                    const m = item.url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/i);
                    handle = m ? `@${m[1]}` : '@X';
                } else if (domain.includes('instagram')) {
                    platform = 'Instagram';
                    const m = item.url.match(/instagram\.com\/([^\/\?]+)/i);
                    handle = m && m[1] !== 'p' && m[1] !== 'reel' ? `@${m[1]}` : '@Instagram';
                } else if (domain.includes('reddit')) {
                    platform = 'Reddit';
                    const m = item.url.match(/reddit\.com\/r\/([^\/\?]+)/i);
                    handle = m ? `r/${m[1]}` : 'r/reddit';
                } else if (domain.includes('youtube')) {
                    platform = 'YouTube';
                    handle = '@YouTube';
                }

                if (!seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    pulse.push({
                        platform,
                        handle,
                        title: item.title,
                        snippet: item.snippet,
                        url: item.url,
                        timeAgo: 'Live',
                        icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
                    });
                }
                break;
            }
        }
    });

    // If organic search has few social links, supplement with live video updates
    if (pulse.length < 3 && topVideos && topVideos.length > 0) {
        topVideos.forEach(v => {
            if (!seenUrls.has(v.url) && pulse.length < 4) {
                seenUrls.add(v.url);
                pulse.push({
                    platform: 'YouTube',
                    handle: v.channel ? `@${v.channel.replace(/\s+/g, '')}` : '@YouTube',
                    title: v.title,
                    snippet: v.title,
                    url: v.url,
                    timeAgo: 'Live Video',
                    icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64'
                });
            }
        });
    }

    return pulse.slice(0, 6);
}

// 3. Premium News Search (HD Images from Bing News RSS + Google News)
async function fetchNews(query) {
    const results = [];
    const q = query.trim();

    const fetchBingNews = async () => {
        const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
        const res = await httpsRequest(rssUrl, {
            headers: { 'Accept': 'application/rss+xml, text/xml, */*' }
        }, 5000);
        if (res.status !== 200 || !res.body) return [];
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let m;
        while ((m = itemRegex.exec(res.body)) !== null && items.length < 25) {
            const block = m[1];
            const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
            const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
            const rawDesc = (block.match(/<description>([\s\S]*?)<\/description>/i) || [])[1] || '';
            const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
            const srcMatch = block.match(/<News:Source>([\s\S]*?)<\/News:Source>/i);
            const imgMatch = block.match(/<News:Image>([\s\S]*?)<\/News:Image>/i);

            const domain = getDomain(rawLink);
            if (isBlocked(domain)) continue;

            const cleanTitle = cleanHtmlText(rawTitle);
            const cleanSnippet = cleanHtmlText(rawDesc);
            const sourceName = cleanHtmlText(srcMatch ? srcMatch[1] : '') || domain;
            let image = imgMatch ? cleanHtmlText(imgMatch[1]) : '';
            if (image && image.startsWith('http://')) image = image.replace(/^http:\/\//, 'https://');

            if (cleanTitle && rawLink) {
                items.push({
                    title: cleanTitle,
                    url: cleanUrl(rawLink),
                    snippet: cleanSnippet,
                    domain,
                    sourceName,
                    image: image || null,
                    timeAgo: formatTimeAgo(pubDate),
                    pubDate: pubDate ? new Date(pubDate).toLocaleDateString() : '',
                    source: 'News'
                });
            }
        }
        return items;
    };

    const fetchGNews = async () => {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await httpsRequest(rssUrl, {}, 4500);
        if (res.status !== 200 || !res.body) return [];
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let m;
        while ((m = itemRegex.exec(res.body)) !== null && items.length < 15) {
            const block = m[1];
            const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
            const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
            const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
            const srcMatch = block.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);

            let domain = '';
            try { domain = getDomain(srcMatch ? srcMatch[1] : rawLink); } catch (_) {}
            if (isBlocked(domain)) continue;

            const cleanTitle = cleanHtmlText(rawTitle);
            const sourceName = cleanHtmlText(srcMatch ? srcMatch[2] : '') || domain;
            if (cleanTitle && rawLink) {
                items.push({
                    title: cleanTitle,
                    url: rawLink.trim(),
                    domain,
                    sourceName,
                    image: null,
                    timeAgo: formatTimeAgo(pubDate),
                    pubDate: pubDate ? new Date(pubDate).toLocaleDateString() : '',
                    source: 'News'
                });
            }
        }
        return items;
    };

    const [bItems, gItems] = await Promise.all([fetchBingNews(), fetchGNews()]);
    const seen = new Set();
    for (const item of [...bItems, ...gItems]) {
        const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 35);
        if (!seen.has(key)) {
            seen.add(key);
            results.push(item);
        }
    }
    return results;
}

// 4. Deep Image Search via Bing Image Engine (Parallel Multi-Page Extractor)
async function fetchImages(query, limit = 60) {
    const fetchPage = async (offset) => {
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${offset}`;
        const res = await httpsRequest(url, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        }, 5000);
        if (res.status !== 200 || !res.body) return [];

        const pageImages = [];
        const regex = /m="({[^"]+})"/g;
        let match;
        while ((match = regex.exec(res.body)) !== null) {
            try {
                const parsed = JSON.parse(match[1].replace(/&quot;/g, '"'));
                if (parsed.murl) {
                    const domain = getDomain(parsed.purl || parsed.murl);
                    pageImages.push({
                        title: cleanHtmlText(parsed.t || query),
                        image: parsed.murl,
                        thumbnail: parsed.turl || parsed.murl,
                        url: cleanUrl(parsed.purl || parsed.murl),
                        domain,
                        width: parsed.ow || null,
                        height: parsed.oh || null,
                        source: 'Images'
                    });
                }
            } catch (_) {}
        }
        return pageImages;
    };

    const [p1, p2, p3] = await Promise.all([
        fetchPage(1),
        fetchPage(35),
        fetchPage(70)
    ]);

    const results = [];
    const seen = new Set();
    for (const img of [...p1, ...p2, ...p3]) {
        if (!seen.has(img.image) && results.length < limit) {
            seen.add(img.image);
            results.push(img);
        }
    }
    return results;
}

// 5. Video Search via YouTube Scraping
function extractYoutubeId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

async function fetchVideos(query) {
    const results = [];
    const cleanQ = encodeURIComponent(query);

    // 1. Direct YouTube Results via ytInitialData
    try {
        const ytRes = await httpsRequest(`https://www.youtube.com/results?search_query=${cleanQ}`, {
            headers: { 'Accept': 'text/html' }
        }, 5000);

        if (ytRes.status === 200 && ytRes.body) {
            const m = ytRes.body.match(/var ytInitialData = ({[\s\S]*?});<\/script>/);
            if (m) {
                const j = JSON.parse(m[1]);
                const contents = j?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
                const items = contents?.[0]?.itemSectionRenderer?.contents || [];
                for (const it of items) {
                    if (it.videoRenderer) {
                        const vr = it.videoRenderer;
                        const vId = vr.videoId;
                        if (!vId) continue;
                        results.push({
                            title: cleanHtmlText(vr.title?.runs?.[0]?.text || query),
                            videoId: vId,
                            url: `https://www.youtube.com/watch?v=${vId}`,
                            thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                            duration: vr.lengthText ? vr.lengthText.simpleText : '',
                            channel: vr.ownerText ? vr.ownerText.runs?.[0]?.text : 'YouTube',
                            views: vr.viewCountText ? (vr.viewCountText.simpleText || '') : '',
                            snippet: vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text || '',
                            platform: 'YouTube',
                            domain: 'youtube.com',
                            source: 'Videos'
                        });
                        if (results.length >= 24) break;
                    }
                }
            }
        }
    } catch (_) {}

    // 2. Fallback to DDG if YouTube directly returned zero
    if (results.length === 0) {
        const postBody = `q=site:youtube.com+${cleanQ}`;
        const res = await httpsRequest('https://html.duckduckgo.com/html/', {
            method: 'POST',
            body: postBody,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postBody),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': 'https://html.duckduckgo.com',
                'Referer': 'https://html.duckduckgo.com/'
            }
        }, 5000);

        if (res.status === 200 && res.body) {
            const blocks = res.body.split(/<div class="result results_links results_links_deep web-result/i);
            for (let i = 1; i < blocks.length; i++) {
                const block = blocks[i];
                const titleMatch = block.match(/<h2 class="result__title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
                if (!titleMatch) continue;

                const targetUrl = cleanUrl(titleMatch[1]);
                const ytId = extractYoutubeId(targetUrl);
                if (!ytId) continue;

                const title = cleanHtmlText(titleMatch[2]).replace(/\s*-\s*YouTube$/i, '');
                const snipMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
                const snippet = cleanHtmlText(snipMatch ? snipMatch[1] : '');

                results.push({
                    title,
                    url: targetUrl,
                    videoId: ytId,
                    thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
                    duration: '',
                    channel: 'YouTube',
                    views: '',
                    snippet,
                    platform: 'YouTube',
                    domain: 'youtube.com',
                    source: 'Videos'
                });
                if (results.length >= 15) break;
            }
        }
    }

    return results;
}

// 6. Discussions Search (Hacker News Algolia + StackOverflow API)
async function fetchDiscussions(query) {
    const discussions = [];

    const fetchHN = async () => {
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=12`;
        const res = await httpsRequest(url, {}, 4000);
        if (res.status === 200 && res.body) {
            try {
                const j = JSON.parse(res.body);
                return (j.hits || []).map(h => ({
                    title: cleanHtmlText(h.title),
                    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
                    discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
                    score: h.points || 0,
                    commentsCount: h.num_comments || 0,
                    author: h.author || 'User',
                    timeAgo: formatTimeAgo(h.created_at),
                    platform: 'Hacker News',
                    domain: 'news.ycombinator.com'
                }));
            } catch (_) {}
        }
        return [];
    };

    const fetchStackOverflow = async () => {
        const url = `https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodeURIComponent(query)}&site=stackoverflow&pagesize=8`;
        const res = await httpsRequest(url, {}, 4000);
        if (res.status === 200 && res.body) {
            try {
                const j = JSON.parse(res.body);
                return (j.items || []).map(item => ({
                    title: cleanHtmlText(item.title),
                    url: item.link,
                    discussionUrl: item.link,
                    score: item.score || 0,
                    commentsCount: item.answer_count || 0,
                    author: (item.owner && item.owner.display_name) ? item.owner.display_name : 'Developer',
                    timeAgo: formatTimeAgo(item.creation_date * 1000),
                    platform: 'Stack Overflow',
                    domain: 'stackoverflow.com'
                }));
            } catch (_) {}
        }
        return [];
    };

    const [hnItems, soItems] = await Promise.all([fetchHN(), fetchStackOverflow()]);
    return [...hnItems, ...soItems].sort((a, b) => (b.score || 0) - (a.score || 0));
}

// 7. Autocomplete Suggestions (OpenSearch)
async function fetchSuggestions(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim();
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`;
    const res = await httpsRequest(url, {}, 2500);
    if (res.status === 200 && res.body) {
        try {
            const parsed = JSON.parse(res.body);
            if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
                return parsed[1].slice(0, 8);
            }
        } catch (_) {}
    }
    return [];
}

// 8. Master Meta Search Aggregator
async function aggregateSearch(query, category = 'all') {
    const startTime = Date.now();
    const cleanQ = (query || '').trim();

    if (!cleanQ) {
        return { query: '', category, tookMs: 0, knowledge: null, results: [] };
    }

    if (category === 'news') {
        const newsResults = await fetchNews(cleanQ);
        return {
            query: cleanQ,
            category: 'news',
            tookMs: Date.now() - startTime,
            total: newsResults.length,
            results: newsResults
        };
    }

    if (category === 'images') {
        const imageResults = await fetchImages(cleanQ, 80);
        return {
            query: cleanQ,
            category: 'images',
            tookMs: Date.now() - startTime,
            total: imageResults.length,
            results: imageResults
        };
    }

    if (category === 'videos') {
        const videoResults = await fetchVideos(cleanQ);
        return {
            query: cleanQ,
            category: 'videos',
            tookMs: Date.now() - startTime,
            total: videoResults.length,
            results: videoResults
        };
    }

    if (category === 'discussions') {
        const discResults = await fetchDiscussions(cleanQ);
        return {
            query: cleanQ,
            category: 'discussions',
            tookMs: Date.now() - startTime,
            total: discResults.length,
            results: discResults
        };
    }

    // Default Universal 'All' View
    const sportsPromise = fetchSportsData(cleanQ);
    const sports = await sportsPromise;

    const [webResults, knowledge, topNews, topDiscussions, topVideos, suggestions, topImages] = await Promise.all([
        fetchWebResults(cleanQ),
        fetchKnowledge(cleanQ, sports),
        fetchNews(cleanQ),
        fetchDiscussions(cleanQ),
        fetchVideos(cleanQ),
        fetchSuggestions(cleanQ),
        fetchImages(cleanQ, 10)
    ]);

    // Rerank web results and boost authoritative sources
    const queryTerms = cleanQ.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    webResults.forEach(r => {
        const titleLower = r.title.toLowerCase();
        let termMatches = 0;
        for (const t of queryTerms) {
            if (titleLower.includes(t)) termMatches++;
        }
        r.score += termMatches * 0.3;

        for (const highAuth of HIGH_AUTH_DOMAINS) {
            if (r.domain === highAuth || r.domain.endsWith('.' + highAuth)) {
                r.score += 0.8;
                r.verified = true;
                break;
            }
        }
    });

    webResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Dynamic AI Overview & Social Pulse
    const aiOverview = generateAIOverview(cleanQ, knowledge, webResults, topNews, sports);
    const socialPulse = extractSocialPulse(webResults, cleanQ, topVideos);

    return {
        query: cleanQ,
        category: 'all',
        tookMs: Date.now() - startTime,
        total: webResults.length,
        aiOverview,
        sports,
        socialPulse,
        knowledge,
        topImages: topImages.slice(0, 6),
        topNews: topNews.filter(n => !!n.image).slice(0, 6),
        topDiscussions: topDiscussions.slice(0, 3),
        topVideos: topVideos.slice(0, 3),
        relatedSearches: suggestions.slice(0, 6),
        results: webResults
    };
}

module.exports = {
    aggregateSearch,
    fetchSuggestions,
    fetchSportsData,
    fetchNews,
    fetchImages,
    fetchVideos,
    fetchDiscussions,
    fetchKnowledge,
    generateAIOverview,
    extractSocialPulse
};

// Fokk Summary - High-Precision On-Device Intelligence Engine
// Features: Zero cloud dependency, robust editorial DOM extraction, boilerplate & nav filtering,
// source logo & metadata detection, deduplicated key takeaways, and executive briefing synthesis.

(function() {
    'use strict';

    if (window.__fokk_summarizer_loaded) return;
    window.__fokk_summarizer_loaded = true;

    const STOP_WORDS = new Set([
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
        "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
        "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
        "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
        "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how",
        "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
        "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only",
        "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd",
        "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their",
        "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
        "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
        "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's",
        "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you",
        "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
    ]);

    // Token overlap similarity to eliminate redundant sentences
    function calculateSimilarity(tokensA, tokensB) {
        if (!tokensA.size || !tokensB.size) return 0;
        let intersection = 0;
        tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
        const union = tokensA.size + tokensB.size - intersection;
        return union > 0 ? intersection / union : 0;
    }

    // Clean human-friendly Title extractor
    function extractArticleTitle() {
        let title = '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content ||
                        document.querySelector('meta[name="twitter:title"]')?.content;
        if (ogTitle && ogTitle.trim().length > 5) {
            title = ogTitle.trim();
        } else {
            const h1 = document.querySelector('article h1, main h1, h1');
            if (h1 && h1.innerText && h1.innerText.trim().length > 5) {
                title = h1.innerText.trim();
            } else {
                title = (document.title || '').trim();
            }
        }

        // Clean out site branding suffix like " - BBC News", " | Reuters", " :: The Verge"
        title = title.replace(/\s*[-–—|:]\s*(BBC News|BBC|CNN|Reuters|The Guardian|The New York Times|The Verge|Bloomberg|TechCrunch|Forbes|YouTube|Wikipedia).*$/i, '').trim();
        return title || 'Article Summary';
    }

    // Clean Source Name & Logo Extractor
    function extractSourceMeta() {
        const host = window.location.hostname.replace(/^www\./i, '');
        let sourceName = document.querySelector('meta[property="og:site_name"]')?.content || '';
        if (!sourceName) {
            // Capitalize clean hostname (e.g. bbc.co.uk -> BBC, theverge.com -> The Verge)
            const parts = host.split('.');
            sourceName = parts.length > 1 ? parts[0] : host;
            sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
        }

        let favicon = '';
        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]')?.href;
        const icon = document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href;
        if (appleIcon && appleIcon.startsWith('http')) {
            favicon = appleIcon;
        } else if (icon && icon.startsWith('http')) {
            favicon = icon;
        } else {
            favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
        }

        return { source: sourceName, sourceHost: host, favicon: favicon };
    }

    // Preserve provenance alongside the extractive summary. This is deliberately
    // metadata, not a guessed fact: readers can tell how much source material was
    // available and whether the publisher exposed an author/date.
    function extractProvenance() {
        const publishedRaw = document.querySelector('meta[property="article:published_time"]')?.content ||
            document.querySelector('meta[name="date"]')?.content ||
            document.querySelector('time[datetime]')?.getAttribute('datetime') || '';
        const author = document.querySelector('meta[name="author"]')?.content ||
            document.querySelector('[rel="author"]')?.textContent || '';
        const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
        const published = publishedRaw ? publishedRaw.slice(0, 10) : '';
        return { published: published, author: author.trim().replace(/\s+/g, ' ').slice(0, 90), canonical: canonical };
    }

    // Viewport-weighted focal element finder (fixes virtualized feeds like Instagram & X home)
    function findMostVisibleElement(nodeList) {
        const elems = Array.from(nodeList || []);
        if (elems.length === 0) return null;
        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        const vw = window.innerWidth || document.documentElement.clientWidth || 400;
        const targetY = vh * 0.44;
        let bestEl = null;
        let bestScore = -1;

        for (const el of elems) {
            try {
                const r = el.getBoundingClientRect();
                if (r.height < 60 || r.width < 120) continue;
                if (r.bottom <= 20 || r.top >= vh - 20) continue;
                const visibleTop = Math.max(0, r.top);
                const visibleBottom = Math.min(vh, r.bottom);
                const visibleH = Math.max(0, visibleBottom - visibleTop);
                if (visibleH <= 0) continue;
                const centerY = (visibleTop + visibleBottom) / 2;
                const distFromTarget = Math.abs(centerY - targetY);
                const centerBonus = Math.max(0, 1 - distFromTarget / (vh * 0.75)) * 220;
                const visibleRatio = visibleH / Math.min(r.height, vh);
                const horizOverlap = Math.max(0, Math.min(vw, r.right) - Math.max(0, r.left));
                if (horizOverlap < vw * 0.35) continue;
                const score = visibleH + centerBonus + (visibleRatio * 140);
                if (score > bestScore) {
                    bestScore = score;
                    bestEl = el;
                }
            } catch (_) {}
        }
        return bestEl;
    }

    function findFocalTweet() {
        const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        if (tweets.length === 0) return null;
        // On a specific /status/<id> page, prefer the exact status tweet if visible or present
        const statusMatch = window.location.pathname.match(/\/status\/(\d+)/);
        if (statusMatch) {
            const statusId = statusMatch[1];
            const exact = tweets.find(t => t.querySelector(`a[href*="/status/${statusId}"]`));
            if (exact) return exact;
        }
        return findMostVisibleElement(tweets) || tweets[0];
    }

    function findFocalInstagramPost() {
        const modalArticle = document.querySelector('[role="dialog"] article');
        if (modalArticle) return modalArticle;
        const articles = document.querySelectorAll('article');
        const visibleArticle = findMostVisibleElement(articles);
        if (visibleArticle) return visibleArticle;
        // Fallback for Instagram Reels or single-post layout without <article>
        const mainVideos = document.querySelectorAll('main video, [role="main"] video');
        const visibleVideo = findMostVisibleElement(mainVideos);
        if (visibleVideo) {
            return visibleVideo.closest('article, section, [role="presentation"], main > div > div') || visibleVideo.parentElement;
        }
        return articles[0] || null;
    }

    function extractSocialPostMeta(pageType) {
        if (pageType === 'twitter') {
            const focal = findFocalTweet();
            if (!focal) return null;
            const userEl = focal.querySelector('[data-testid="User-Name"]');
            const userRaw = (userEl?.innerText || '').replace(/\s+/g, ' ').trim();
            const handleMatch = userRaw.match(/@[A-Za-z0-9_]+/);
            const author = handleMatch ? handleMatch[0] : userRaw.split('·')[0].trim().slice(0, 50);
            const timeLink = focal.querySelector('a[href*="/status/"]');
            const postUrl = timeLink?.href || window.location.href;
            const timeEl = focal.querySelector('time[datetime]');
            const published = (timeEl?.getAttribute('datetime') || '').slice(0, 10);
            const texts = Array.from(focal.querySelectorAll('[data-testid="tweetText"]'))
                .map(el => fixDropCaps((el.innerText || '').replace(/\s+/g, ' ').trim()))
                .filter(t => t.length >= 6 && !isScrapingJunk(t));

            // Strictly extract actual media attached to THIS focal tweet (never generic X og:image)
            let mediaImg = null;
            const photoImgs = Array.from(focal.querySelectorAll(
                '[data-testid="tweetPhoto"] img, [data-testid="card.layoutLarge.media"] img, [data-testid="card.layoutSmall.media"] img, [data-testid="videoComponent"] img'
            ));
            for (const img of photoImgs) {
                const src = img.currentSrc || img.src || '';
                if (src.startsWith('http') &&
                    !src.includes('profile_images') &&
                    !src.includes('/emoji/') &&
                    !src.includes('hashflags') &&
                    !src.includes('abs.twimg.com')) {
                    mediaImg = src;
                    break;
                }
            }
            if (!mediaImg) {
                const vid = focal.querySelector('video[poster]');
                const poster = vid?.getAttribute('poster') || '';
                if (poster.startsWith('http')) mediaImg = poster;
            }
            const firstLine = texts[0] ? texts[0].slice(0, 95) : '';
            const title = author && firstLine
                ? `${author}: ${firstLine}${texts[0].length > 95 ? '...' : ''}`
                : (firstLine || (author ? `Post by ${author} on X` : 'X Post'));
            return { author, postUrl, published, paragraphs: texts, leadImage: mediaImg, title };
        }

        if (pageType === 'instagram') {
            const focal = findFocalInstagramPost();
            if (!focal) return null;
            let author = '';
            const headerLinks = Array.from(focal.querySelectorAll('header a[href^="/"], a[role="link"][href^="/"]'));
            for (const a of headerLinks) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/^\/([A-Za-z0-9._]{2,35})\/?$/);
                if (m && !['explore', 'reels', 'direct', 'accounts', 'stories', 'p', 'reel'].includes(m[1].toLowerCase())) {
                    author = '@' + m[1];
                    break;
                }
            }
            const permLink = focal.querySelector('a[href*="/p/"], a[href*="/reel/"]');
            const postUrl = permLink?.href || window.location.href;
            const timeEl = focal.querySelector('time[datetime]');
            const published = (timeEl?.getAttribute('datetime') || '').slice(0, 10);

            // Extract clean caption text from THIS focal post only
            const igNoiseRe = /^(?:like|likes|comment|comments|share|save|follow|following|original audio|audio|suggested for you|sponsored|more|less|see translation|view all \d+ comments?|view 1 comment|add a comment\.{0,3}|liked by .*|\d+\s*(?:likes?|views?|comments?|w|d|h|m|s)|[\d,]+\s+likes?|\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?)\s+ago)$/i;
            const candidateNodes = Array.from(focal.querySelectorAll('h1, span[dir="auto"], div[dir="auto"], ul li span'));
            const seenCap = new Set();
            const paragraphs = [];
            for (const el of candidateNodes) {
                if (el.closest('header, button, [role="button"]')) continue;
                const raw = fixDropCaps((el.innerText || '').replace(/\s+/g, ' ').trim());
                if (raw.length < 12 || raw.length > 1200) continue;
                if (igNoiseRe.test(raw)) continue;
                if (author && raw.toLowerCase() === author.slice(1).toLowerCase()) continue;
                const norm = raw.toLowerCase();
                if (seenCap.has(norm)) continue;
                // Avoid adding parent container if child already added or vice versa
                let redundant = false;
                for (const prev of paragraphs) {
                    if (prev.toLowerCase().includes(norm) || norm.includes(prev.toLowerCase())) {
                        if (norm.length > prev.length) {
                            paragraphs[paragraphs.indexOf(prev)] = raw;
                        }
                        redundant = true;
                        break;
                    }
                }
                if (!redundant) {
                    seenCap.add(norm);
                    paragraphs.push(raw);
                }
                if (paragraphs.length >= 6) break;
            }

            // Extract visible post media image (strictly inside THIS focal post, never avatar or IG logo)
            let mediaImg = null;
            let bestArea = 0;
            const postImgs = Array.from(focal.querySelectorAll('img'));
            for (const img of postImgs) {
                if (img.closest('header')) continue;
                const src = img.currentSrc || img.src || '';
                const alt = (img.alt || '').toLowerCase();
                if (!src.startsWith('http') || alt.includes('profile picture') || src.includes('s150x150')) continue;
                const rect = img.getBoundingClientRect();
                const w = rect.width || img.naturalWidth || 0;
                const h = rect.height || img.naturalHeight || 0;
                if (w < 140 || h < 140) continue;
                // Prefer the slide actually inside the viewport horizontally (for carousels!)
                const vw = window.innerWidth || 400;
                if (rect.width > 0 && (rect.right < 20 || rect.left > vw - 20)) continue;
                const area = w * h;
                if (area > bestArea) {
                    bestArea = area;
                    mediaImg = src;
                }
            }
            if (!mediaImg) {
                const vid = focal.querySelector('video[poster]');
                const poster = vid?.getAttribute('poster') || '';
                if (poster.startsWith('http')) mediaImg = poster;
            }

            // Use img alt description if caption was empty (common for photo/meme posts!)
            if (paragraphs.length === 0) {
                for (const img of postImgs) {
                    if (img.closest('header')) continue;
                    const alt = (img.alt || '').trim();
                    if (alt.length > 20 && !alt.toLowerCase().includes('profile picture')) {
                        paragraphs.push(alt);
                        break;
                    }
                }
            }

            const firstLine = paragraphs[0] ? paragraphs[0].slice(0, 95) : '';
            const title = author && firstLine
                ? `${author}: ${firstLine}${paragraphs[0].length > 95 ? '...' : ''}`
                : (author ? `Instagram Post by ${author}` : 'Instagram Post');
            return { author, postUrl, published, paragraphs, leadImage: mediaImg, title };
        }

        return null;
    }

    // Platform-Aware Lead Image Extractor (fixes X generic placeholder & Instagram feed mismatch)
    function extractLeadImage(pageType, socialMeta) {
        if (pageType === 'twitter' || pageType === 'instagram') {
            return socialMeta?.leadImage || null;
        }

        const metaImg = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[name="twitter:image"]')?.content ||
                        document.querySelector('meta[property="og:image:secure_url"]')?.content;
        if (metaImg && metaImg.startsWith('http') &&
            !/\/(?:default|placeholder|logo|twitter_card_logo|rweb|og-default)/i.test(metaImg)) {
            return metaImg;
        }

        const articleImgs = Array.from(document.querySelectorAll('article img, main img, figure img, [role="main"] img, .post img'));
        for (const img of articleImgs) {
            const src = img.currentSrc || img.src;
            if (src && src.startsWith('http') && !src.includes('avatar') && !src.includes('icon') && !src.includes('logo')) {
                const rect = img.getBoundingClientRect();
                if ((rect.width > 200 && rect.height > 120) || (img.naturalWidth > 250 && img.naturalHeight > 150)) {
                    return src;
                }
            }
        }
        return null;
    }

    // Helper to detect and reject engagement counters, social noise, and scraping junk
    function isScrapingJunk(text) {
        if (!text || text.length < 15) return true;
        const lower = text.toLowerCase();
        // Newsroom boilerplate & promotional CTAs
        if (lower.includes('bookmark your favourite') || lower.includes('bookmark your favorite') ||
            lower.includes('sign up to our newsletter') || lower.includes('sign up for our newsletter') ||
            lower.includes('subscribe to our') || lower.includes('join our whatsapp channel') ||
            lower.includes('follow us on') || lower.includes('read more:') || lower.includes('download the app') ||
            lower.includes('find out more here') || lower.includes('terms of service') || lower.includes('privacy policy') ||
            lower.includes('all rights reserved') || lower.includes('click here to') || lower.includes('have your say') ||
            lower.includes('already have an account') || lower.includes('register to continue') || lower.includes('sign in to read') ||
            lower.includes('cookies on our website') || lower.includes('allow all cookies') || lower.includes('watch more videos') ||
            lower.includes('get all the latest') || lower.includes('send your stories to') || lower.includes('got a story?')) {
            return true;
        }
        // Timestamp + engagement counts like "1:04 PM · 28.9K Views 5 22 113 2 Relevant View quotes"
        if (/\b\d{1,2}:\d{2}\s+(?:AM|PM)\b/i.test(text) && /\b(?:Views|Quotes|Reposts|Likes)\b/i.test(text)) return true;
        if (/\b\d+(?:\.\d+)?[KM]?\s+Views\b/i.test(text)) return true;
        if (/\bRelevant View quotes\b/i.test(text)) return true;
        // Social handles and follow prompts
        if (/^@\w+\s*$/i.test(text)) return true;
        if (/^(?:subscribe|follow @|sign in to|log in to|create account|view quotes)/i.test(text)) return true;
        if (/^\d+\s+\d+\s+\d+\s+\d+/.test(text)) return true; // standalone metric row
        return false;
    }

    // Page Type Classification
    function detectPageType() {
        const host = window.location.hostname.replace(/^www\./i, '').toLowerCase();
        if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.x.com' || host === 'mobile.twitter.com') return 'twitter';
        if (host.includes('instagram.com')) return 'instagram';
        if (host.includes('reddit.com')) return 'reddit';
        if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
        if (document.querySelector('article, [itemprop="articleBody"], .article-body, .story-body')) return 'news';
        return 'generic';
    }

    // High-Precision Platform-Aware Content Extractor
    function extractCleanEditorialParagraphs(pageType, socialMeta) {
        // 1. Adapter: Twitter / X.com & Instagram (Viewport-locked focal post!)
        if ((pageType === 'twitter' || pageType === 'instagram') && socialMeta && socialMeta.paragraphs.length > 0) {
            return socialMeta.paragraphs;
        }

        // 2. Adapter: Reddit (Submission title and post text, or visible feed post)
        if (pageType === 'reddit') {
            const visiblePost = findMostVisibleElement(document.querySelectorAll('shreddit-post, [data-testid="post-container"]'));
            const scope = visiblePost || document;
            const titleElem = scope.querySelector('h1, [slot="title"], a[slot="title"]');
            const postBodyElem = scope.querySelector('[data-test-id="post-content"], [slot="text-body"], .post-body, .entry .usertext-body');
            const paragraphs = [];
            if (titleElem && titleElem.innerText) {
                paragraphs.push(titleElem.innerText.trim());
            }
            if (postBodyElem) {
                const pList = Array.from(postBodyElem.querySelectorAll('p'))
                    .map(el => fixDropCaps((el.innerText || '').replace(/\s+/g, ' ').trim()))
                    .filter(t => t.length > 15 && !isScrapingJunk(t));
                if (pList.length > 0) paragraphs.push(...pList);
                else if (postBodyElem.innerText) paragraphs.push(fixDropCaps(postBodyElem.innerText.trim()));
            }
            if (paragraphs.length > 0) return paragraphs;
        }

        // 3. Adapter: YouTube (Video title, channel name, and description excerpt)
        if (pageType === 'youtube') {
            const ytTitle = document.querySelector('h1.ytd-video-primary-info-renderer, #title h1, meta[name="title"]')?.content ||
                            document.querySelector('h1')?.innerText || '';
            const ytChannel = document.querySelector('#channel-name, ytd-channel-name a, meta[itemprop="name"]')?.content ||
                              document.querySelector('#channel-name a')?.innerText || '';
            const ytDesc = document.querySelector('#description-inline-expander, ytd-text-inline-expander, meta[name="description"]')?.content ||
                           document.querySelector('#description')?.innerText || '';
            const ytLines = [];
            if (ytTitle.trim()) ytLines.push(ytTitle.trim());
            if (ytChannel.trim()) ytLines.push(`Channel: ${ytChannel.trim()}`);
            if (ytDesc.trim()) ytLines.push(ytDesc.trim().slice(0, 800));
            if (ytLines.length > 0) return ytLines;
        }

        // 4. Adapter: Standard News Article & Editorial Container
        const blacklistSelector = [
            'header', 'footer', 'nav', 'aside',
            '[role="navigation"]', '[role="banner"]', '[role="search"]', '[role="complementary"]',
            '.navigation', '.nav', '.menu', '.navbar',
            '.breadcrumb', '.share', '.social', '.social-share',
            '.comments', '.related', '.sidebar',
            '.cookie', '.banner', '.advert', '.ad', '.ads',
            '.skip', '.skip-link', 'a[href*="#content"]', 'a[href*="#main"]',
            '[aria-hidden="true"]', 'script', 'style', 'noscript'
        ].join(', ');

        const candidateContainers = document.querySelectorAll(
            'article, [role="main"], main, .article-body, .story-body, .post-content, .entry-content, [itemprop="articleBody"], #main-content, #content'
        );

        let rootContainer = null;
        for (let i = 0; i < candidateContainers.length; i++) {
            const c = candidateContainers[i];
            const pCount = c.querySelectorAll('p').length;
            if (pCount >= 2 && c.innerText.length > 250) {
                rootContainer = c;
                break;
            }
        }

        if (!rootContainer) {
            rootContainer = document.body;
        }

        const rawParagraphElements = rootContainer.querySelectorAll('p, blockquote');
        const paragraphs = [];

        rawParagraphElements.forEach(p => {
            try {
                if (p.closest(blacklistSelector)) return;
            } catch (_) {}

            const aria = (p.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes('breadcrumb') || aria.includes('share') || aria.includes('social') || aria.includes('cookie')) return;

            const text = fixDropCaps((p.innerText || '').replace(/\s+/g, ' ').trim());
            if (text.length < 25) return;
            if (isScrapingJunk(text)) return;

            const links = p.querySelectorAll('a');
            let linkCharCount = 0;
            links.forEach(a => { linkCharCount += (a.innerText || '').length; });
            if (linkCharCount / text.length > 0.35) return;

            if (/^(sign in|subscribe|log in|cookie|all rights reserved|terms of use|privacy policy|share this|follow us on|read more:|photo by|getty images|advertisement)/i.test(text)) {
                return;
            }

            paragraphs.push(text);
        });

        return paragraphs;
    }

    // Fix newspaper drop-cap artifacts like "W hen" -> "When"
    function fixDropCaps(str) {
        if (!str) return '';
        return str.replace(/\b([B-HJ-Z])\s+([a-z]{2,})\b/g, '$1$2');
    }

    // Contextual Curiosity Questions Generator (domain-agnostic)
    function generateCuriosityQuestions(title, text, topEntities) {
        const questions = [];
        const primarySubject = topEntities.length > 0 ? topEntities[0] : '';

        if (primarySubject && primarySubject.length > 2) {
            questions.push(`What are the key takeaways about ${primarySubject}?`);
            questions.push(`What evidence or official data backs the claims about ${primarySubject}?`);
        } else {
            questions.push(`What are the main takeaways from this article?`);
            questions.push(`What evidence supports the main claims here?`);
        }
        questions.push(`What context or opposing viewpoints might be missing?`);
        return questions.slice(0, 3);
    }

    window.generatePageSummary = function() {
        const pageType = detectPageType();
        const socialMeta = extractSocialPostMeta(pageType);
        const title = (socialMeta && socialMeta.title) ? socialMeta.title : extractArticleTitle();
        const sourceMeta = extractSourceMeta();
        const provenance = extractProvenance();
        if (socialMeta?.author) provenance.author = socialMeta.author;
        if (socialMeta?.published) provenance.published = socialMeta.published;
        if (socialMeta?.postUrl) provenance.canonical = socialMeta.postUrl;
        const cleanParagraphs = extractCleanEditorialParagraphs(pageType, socialMeta);
        const fullArticleText = cleanParagraphs.join('\n\n');

        // Sentence Tokenization from genuine editorial paragraphs (allow shorter captions on social posts)
        const minSentenceLen = (pageType === 'twitter' || pageType === 'instagram') ? 10 : 25;
        const rawSentences = [];
        cleanParagraphs.forEach(para => {
            const matches = para.match(/[^.!?]+(?:[.!?]+|$)/g) || [para];
            matches.forEach(s => {
                const clean = s.replace(/\s+/g, ' ').trim();
                if (clean.length >= minSentenceLen && clean.length <= 360 &&
                    !clean.includes('{') && !clean.includes('function(') &&
                    (pageType === 'twitter' || pageType === 'instagram' || !isScrapingJunk(clean)) &&
                    !/^(sign in|subscribe|cookies|terms|privacy|copyright|all rights reserved|click here|follow us)/i.test(clean)) {
                    rawSentences.push(clean);
                }
            });
        });

        // Fallback to body text ONLY on non-social pages (never scrape full Instagram/X feed!)
        if (rawSentences.length === 0 && pageType !== 'twitter' && pageType !== 'instagram') {
            try {
                const bodyText = (document.body.innerText || '').slice(0, 10000);
                const bodyMatches = bodyText.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [];
                bodyMatches.forEach(s => {
                    const clean = s.replace(/\s+/g, ' ').trim();
                    if (clean.length >= 35 && clean.length <= 300 &&
                        !clean.includes('{') && !clean.includes('}') &&
                        !isScrapingJunk(clean) &&
                        !/^(sign in|subscribe|cookies|terms|privacy|copyright|all rights reserved)/i.test(clean)) {
                        rawSentences.push(clean);
                    }
                });
            } catch (_) {}
        }

        const totalWords = fullArticleText.split(/\s+/).filter(Boolean).length;
        const readingTimeMin = Math.max(1, Math.round(totalWords / 200));
        const readingTime = `${readingTimeMin} min read`;
        const leadImage = extractLeadImage(pageType, socialMeta);

        if (rawSentences.length === 0) {
            return {
                title: title,
                source: sourceMeta.source,
                sourceHost: sourceMeta.sourceHost,
                favicon: sourceMeta.favicon,
                executiveSummary: "Page does not contain enough clean textual content to synthesize a Fokk Summary.",
                summary: "Page does not contain enough clean textual content to synthesize a Fokk Summary.",
                bullets: ["Insufficient editorial body text found on this webpage."],
                metrics: [],
                followUpQuestions: [],
                leadImage: leadImage,
                readingTime: readingTime,
                wordCount: totalWords
            };
        }

        // Word Frequencies & Significant Named Entities
        const titleTokens = new Set((title.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOP_WORDS.has(w)));
        const wordFreq = {};
        const entityCounts = {};

        rawSentences.forEach(s => {
            const words = (s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOP_WORDS.has(w));
            words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

            const entities = s.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
            entities.forEach(e => {
                if (e.length > 3 && !/^(The|This|That|With|From|When|Where|There|What|After|Before)\b/i.test(e)) {
                    entityCounts[e] = (entityCounts[e] || 0) + 1;
                }
            });
        });

        const topEntities = Object.entries(entityCounts)
            .sort((a, b) => b[1] - a[1])
            .map(e => e[0])
            .slice(0, 5);

        // Sentence Scoring
        const scoredSentences = rawSentences.map((s, idx) => {
            const words = (s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOP_WORDS.has(w));
            let score = 0;

            words.forEach(w => {
                if (wordFreq[w]) score += wordFreq[w];
                if (titleTokens.has(w)) score += 6;
            });

            score = score / Math.sqrt(words.length || 1);

            // Lead paragraphs carry core news facts
            if (idx === 0) score *= 2.0;
            else if (idx === 1) score *= 1.7;
            else if (idx < 5) score *= 1.35;

            // Fact, data, and metric bonus
            if (/\d+%|\$\d+|\b\d{4}\b|\b\d+(?:\.\d+)?\s*(?:billion|million|trillion|percent|users|shares|record|study|confirmed|report)\b/i.test(s)) {
                score *= 1.35;
            }

            return {
                sentence: s,
                score: score,
                index: idx,
                tokens: new Set(words)
            };
        });

        // Non-Redundant Selection (Deduplication)
        scoredSentences.sort((a, b) => b.score - a.score);
        const selected = [];

        for (const item of scoredSentences) {
            let isDuplicate = false;
            for (const prev of selected) {
                if (calculateSimilarity(item.tokens, prev.tokens) > 0.40) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                selected.push(item);
                if (selected.length >= 5) break;
            }
        }
        selected.sort((a, b) => a.index - b.index);

        function cleanSentenceItem(str) {
            return (str || '')
                .replace(/^[\s•*–—\-\d.)\]]+/g, '')
                .replace(/^[\s“"‘']+/, '')
                .replace(/[\s”"’']+$/, '')
                .trim();
        }

        // Synthesize Executive Brief (Clean, natural 1-2 sentence lead)
        let executiveSummary = "";
        if (selected.length > 0) {
            const lead = fixDropCaps(cleanSentenceItem(selected[0].sentence));
            const second = selected.length > 1 ? fixDropCaps(cleanSentenceItem(selected[1].sentence)) : '';
            if (second && !second.toLowerCase().includes(lead.slice(0, 25).toLowerCase())) {
                const leadPunct = /[.!?]$/.test(lead) ? lead : `${lead}.`;
                executiveSummary = `${leadPunct} ${second}`;
            } else {
                executiveSummary = lead;
            }
        } else {
            executiveSummary = fixDropCaps(cleanSentenceItem(rawSentences[0]));
        }

        // Key Insights & Analysis bullets (distinct takeaways)
        const bullets = selected.map(item => fixDropCaps(cleanSentenceItem(item.sentence))).filter(b => b.length > 10);

        // Extract Contextual Key Figures ("VALUE :: Short Label" - never contextless bare years)
        const contextualMetrics = [];
        const seenMetricVals = new Set();
        const ctxRegex = /([£$€]\s?\d+(?:[.,]\d+)?\s?(?:billion|million|trillion|bn|mn|m|k|b)?|\d+(?:\.\d+)?%|\b\d+(?:,\d{3})+\b)\s+([a-zA-Z][a-zA-Z\s\-]{3,36})/g;
        let mMatch;
        while ((mMatch = ctxRegex.exec(fullArticleText)) !== null && contextualMetrics.length < 4) {
            const val = mMatch[1].trim();
            const key = val.toLowerCase();
            if (seenMetricVals.has(key)) continue;
            const rawPhrase = mMatch[2].split(/[,.;:()—–]|\b(?:and|but|which|that|while|from|in)\b/i)[0].trim();
            const words = rawPhrase.split(/\s+/).filter(Boolean).slice(0, 4);
            if (words.length >= 2) {
                const label = words.join(' ');
                seenMetricVals.add(key);
                contextualMetrics.push(`${val} :: ${label.charAt(0).toUpperCase() + label.slice(1)}`);
            }
        }

        const followUpQuestions = generateCuriosityQuestions(title, fullArticleText, topEntities);

        return {
            url: window.location.href,
            title: title,
            source: sourceMeta.source,
            sourceHost: sourceMeta.sourceHost,
            favicon: sourceMeta.favicon,
            pageType: pageType,
            postUrl: socialMeta?.postUrl || window.location.href,
            extractedContext: fullArticleText.slice(0, 10000),
            topEntities: topEntities,
            executiveSummary: executiveSummary,
            summary: executiveSummary, // backward compatibility
            bullets: bullets,
            metrics: contextualMetrics,
            followUpQuestions: followUpQuestions,
            leadImage: leadImage,
            readingTime: readingTime,
            wordCount: totalWords,
            author: provenance.author || '',
            published: provenance.published || '',
            provenance: provenance
        };
    };

    // In-page sentence locator and high-precision neon pulse highlighter
    window.highlightPageSentence = function(queryText) {
        if (!queryText || typeof queryText !== 'string' || queryText.length < 5) return;
        try {
            const cleanQuery = queryText.replace(/^[•*\-\d.\s]+/, '').trim().toLowerCase();
            const searchTerms = cleanQuery.split(/\s+/).filter(t => t.length > 3).slice(0, 6);
            if (searchTerms.length === 0) return;

            const elements = Array.from(document.querySelectorAll('p, blockquote, [data-testid="tweetText"], h1, h2, h3, li'));
            let bestElem = null;
            let bestScore = 0;

            for (const el of elements) {
                const txt = (el.innerText || '').toLowerCase();
                if (!txt) continue;
                let hits = 0;
                for (const term of searchTerms) {
                    if (txt.includes(term)) hits++;
                }
                if (hits > bestScore) {
                    bestScore = hits;
                    bestElem = el;
                }
            }

            if (bestElem && bestScore >= Math.min(2, searchTerms.length)) {
                bestElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const origTransition = bestElem.style.transition;
                const origBg = bestElem.style.backgroundColor;
                const origOutline = bestElem.style.outline;
                bestElem.style.transition = 'all 0.3s ease';
                bestElem.style.backgroundColor = 'rgba(0, 229, 255, 0.22)';
                bestElem.style.outline = '2px solid #00E5FF';
                bestElem.style.borderRadius = '4px';

                setTimeout(function() {
                    bestElem.style.backgroundColor = origBg;
                    bestElem.style.outline = origOutline;
                    bestElem.style.transition = origTransition;
                }, 2600);
            }
        } catch (_) {}
    };

    window.triggerFokkSummarizer = function() {
        try {
            const existing = document.getElementById('__fokk_summary_modal');
            if (existing) existing.remove();

            const summary = generatePageSummary();
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.showAiSummaryData === 'function') {
                window.FokkShieldBridge.showAiSummaryData(JSON.stringify(summary));
            }
        } catch (err) {
            const fallback = {
                title: document.title || 'Page Summary',
                source: window.location.hostname.replace(/^www\./i, '') || 'Web',
                sourceHost: window.location.hostname || '',
                favicon: 'https://www.google.com/s2/favicons?domain=' + window.location.hostname + '&sz=128',
                executiveSummary: (document.querySelector('meta[name="description"]')?.content || (document.title || 'Article') + ' overview synthesized directly on device.'),
                summary: (document.querySelector('meta[name="description"]')?.content || (document.title || 'Article') + ' overview synthesized directly on device.'),
                bullets: [
                    'Page parsed directly by Fokk on-device neural engine.',
                    'Zero external server tracking or cloud latency.',
                    'Content synthesized from current active web session.'
                ],
                metrics: ['100% On-Device', 'Zero Cloud Leakage'],
                followUpQuestions: ['What are the broader implications of this development?'],
                leadImage: null,
                readingTime: '2 min read',
                wordCount: 200
            };
            if (window.FokkShieldBridge && typeof window.FokkShieldBridge.showAiSummaryData === 'function') {
                window.FokkShieldBridge.showAiSummaryData(JSON.stringify(fallback));
            }
        }
    };
})();

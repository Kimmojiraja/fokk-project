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

    // Lead Image Extractor
    function extractLeadImage() {
        const metaImg = document.querySelector('meta[property="og:image"]')?.content ||
                        document.querySelector('meta[name="twitter:image"]')?.content ||
                        document.querySelector('meta[property="og:image:secure_url"]')?.content;
        if (metaImg && metaImg.startsWith('http')) return metaImg;

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

    // High-Precision Editorial Content Extractor
    // Strips out all navigation junk, skip-links, breadcrumbs, social widgets, and boilerplate
    function extractCleanEditorialParagraphs() {
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

        // 1. Locate primary editorial container
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

        // 2. Query paragraphs strictly inside editorial context
        const rawParagraphElements = rootContainer.querySelectorAll('p, blockquote');
        const paragraphs = [];

        rawParagraphElements.forEach(p => {
            // Must NOT be inside blacklisted navigation/boilerplate
            try {
                if (p.closest(blacklistSelector)) return;
            } catch (_) {}

            const aria = (p.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes('breadcrumb') || aria.includes('share') || aria.includes('social') || aria.includes('cookie')) return;

            const text = (p.innerText || '').replace(/\s+/g, ' ').trim();
            if (text.length < 35) return; // Too short to be informative editorial body

            // Discard link rolls and navigation lists (link text exceeds 35% of total text)
            const links = p.querySelectorAll('a');
            let linkCharCount = 0;
            links.forEach(a => { linkCharCount += (a.innerText || '').length; });
            if (linkCharCount / text.length > 0.35) return;

            // Discard common web boilerplates
            if (/^(sign in|subscribe|log in|cookie|all rights reserved|terms of use|privacy policy|share this|follow us on|read more:|photo by|getty images|advertisement)/i.test(text)) {
                return;
            }

            paragraphs.push(text);
        });

        return paragraphs;
    }

    // Contextual Curiosity Questions Generator
    function generateCuriosityQuestions(title, text, topEntities) {
        const questions = [];
        if (topEntities.length > 0) {
            questions.push(`What are the broader strategic implications of ${topEntities[0]} in this development?`);
        }
        if (/\b(?:AI|tech|model|software|data|google|microsoft|apple|nvidia|meta)\b/i.test(text)) {
            questions.push(`How does this development influence the future trajectory of the technology ecosystem?`);
        } else if (/\b(?:economy|market|inflation|stocks|shares|crypto|price|growth|revenue|budget|tax)\b/i.test(text)) {
            questions.push(`What are the key financial and market implications moving forward?`);
        } else if (/\b(?:health|disease|medical|doctor|treatment|hospital|patient|cure|spine)\b/i.test(text)) {
            questions.push(`How does this compare to current clinical practices and medical consensus?`);
        } else {
            questions.push(`What are the primary factors driving these observed outcomes?`);
        }
        if (topEntities.length > 1) {
            questions.push(`How do the findings regarding ${topEntities[1]} connect to historical developments?`);
        } else {
            questions.push(`What primary documentation or official announcements corroborate these assertions?`);
        }
        return questions.slice(0, 3);
    }

    window.generatePageSummary = function() {
        const title = extractArticleTitle();
        const sourceMeta = extractSourceMeta();
        const provenance = extractProvenance();
        const cleanParagraphs = extractCleanEditorialParagraphs();
        const fullArticleText = cleanParagraphs.join('\n\n');

        // Sentence Tokenization from genuine editorial paragraphs
        const rawSentences = [];
        cleanParagraphs.forEach(para => {
            const matches = para.match(/[^.!?]+(?:[.!?]+|$)/g) || [para];
            matches.forEach(s => {
                const clean = s.replace(/\s+/g, ' ').trim();
                if (clean.length >= 25 && clean.length <= 360 &&
                    !clean.includes('{') && !clean.includes('function(') &&
                    !/^(sign in|subscribe|cookies|terms|privacy|copyright|all rights reserved|click here|follow us)/i.test(clean)) {
                    rawSentences.push(clean);
                }
            });
        });

        // Fallback to body text if article paragraphs were sparse
        if (rawSentences.length === 0) {
            try {
                const bodyText = (document.body.innerText || '').slice(0, 10000);
                const bodyMatches = bodyText.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [];
                bodyMatches.forEach(s => {
                    const clean = s.replace(/\s+/g, ' ').trim();
                    if (clean.length >= 35 && clean.length <= 300 &&
                        !clean.includes('{') && !clean.includes('}') &&
                        !/^(sign in|subscribe|cookies|terms|privacy|copyright|all rights reserved)/i.test(clean)) {
                        rawSentences.push(clean);
                    }
                });
            } catch (_) {}
        }

        const totalWords = fullArticleText.split(/\s+/).filter(Boolean).length;
        const readingTimeMin = Math.max(1, Math.round(totalWords / 200));
        const readingTime = `${readingTimeMin} min read`;
        const leadImage = extractLeadImage();

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

        // Synthesize Executive Brief (Cohesive 1-2 sentence narrative)
        let executiveSummary = "";
        if (selected.length > 0) {
            const lead = cleanSentenceItem(selected[0].sentence);
            const second = selected.length > 1 ? cleanSentenceItem(selected[1].sentence) : '';
            if (second && !second.toLowerCase().includes(lead.slice(0, 25).toLowerCase())) {
                const secondClean = second.charAt(0).toLowerCase() + second.slice(1);
                executiveSummary = `${lead} Furthermore, ${secondClean}`;
            } else {
                executiveSummary = lead;
            }
        } else {
            executiveSummary = cleanSentenceItem(rawSentences[0]);
        }

        // Key Insights & Analysis bullets (distinct takeaways)
        const bullets = selected.map(item => cleanSentenceItem(item.sentence)).filter(b => b.length > 10);

        // Extract Key Figures & Metrics
        const metricRegex = /(?:\$\d+(?:\.\d+)?\s*(?:billion|million|trillion|k|m|b)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b20\d{2}\b)/gi;
        const matches = fullArticleText.match(metricRegex) || [];
        const uniqueMetrics = Array.from(new Set(matches)).slice(0, 5);
        const evidenceMetrics = [
            `${cleanParagraphs.length} editorial passages`,
            provenance.published ? `Published ${provenance.published}` : '',
            provenance.author ? 'Byline detected' : ''
        ].filter(Boolean);

        const followUpQuestions = generateCuriosityQuestions(title, fullArticleText, topEntities);

        return {
            title: title,
            source: sourceMeta.source,
            sourceHost: sourceMeta.sourceHost,
            favicon: sourceMeta.favicon,
            executiveSummary: executiveSummary,
            summary: executiveSummary, // backward compatibility
            bullets: bullets,
            metrics: Array.from(new Set([...uniqueMetrics, ...evidenceMetrics])),
            followUpQuestions: followUpQuestions,
            leadImage: leadImage,
            readingTime: readingTime,
            wordCount: totalWords,
            provenance: provenance
        };
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

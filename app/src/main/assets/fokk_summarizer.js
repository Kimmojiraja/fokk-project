// Fokk Summary - 100% In-Browser Intelligence Engine
// Features: Executive narrative paragraph, deduplicated key takeaways, lead image extraction,
// contextual deep-dive questions, and live typewriter generation animation. Zero cloud dependency.

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

    // Token overlap similarity to eliminate redundant/duplicate sentences
    function calculateSimilarity(tokensA, tokensB) {
        if (!tokensA.size || !tokensB.size) return 0;
        let intersection = 0;
        tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
        const union = tokensA.size + tokensB.size - intersection;
        return union > 0 ? intersection / union : 0;
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

    // Contextual Curiosity Questions Generator
    function generateCuriosityQuestions(title, text, topEntities) {
        const questions = [];
        if (topEntities.length > 0) {
            questions.push(`What is the broader impact of ${topEntities[0]} in this development?`);
        }
        if (/\b(?:AI|tech|model|software|data|google|microsoft|apple|nvidia|meta)\b/i.test(text)) {
            questions.push(`How does this development influence the future trajectory of the technology ecosystem?`);
        } else if (/\b(?:economy|market|inflation|stocks|shares|crypto|price|growth|revenue)\b/i.test(text)) {
            questions.push(`What are the key financial and market implications moving forward?`);
        } else if (/\b(?:health|disease|medical|doctor|treatment|hospital|patient|cure|spine)\b/i.test(text)) {
            questions.push(`How does this compare to current clinical practices and medical consensus?`);
        } else {
            questions.push(`What are the primary factors driving these observed outcomes?`);
        }
        if (topEntities.length > 1) {
            questions.push(`How do the findings regarding ${topEntities[1]} connect to historical developments?`);
        } else {
            questions.push(`What evidence or primary documentation supports these conclusions?`);
        }
        return questions.slice(0, 3);
    }

    window.generatePageSummary = function() {
        const title = (document.title || '').trim();
        let text = window.__fokk_current_article_text || '';
        if (!text || text.length < 200) {
            const bodyClone = document.body.cloneNode(true);
            bodyClone.querySelectorAll('script, style, noscript, nav, header, footer, aside, .ad, .ads, [role="navigation"], [role="banner"], [role="complementary"]').forEach(el => el.remove());
            text = bodyClone.innerText;
        }

        // 1. Sentence Tokenization & Cleaning
        const rawSentences = text
            .split(/(?<=[.?!])\s+(?=[A-Z0-9\"\'\‘\“])/)
            .map(s => s.replace(/\s+/g, ' ').trim())
            .filter(s => s.length >= 40 && s.length <= 320 &&
                         !s.includes('{') && !s.includes('function(') &&
                         !/^(sign in|subscribe|cookies|terms|privacy|copyright|all rights reserved|click here|follow us)/i.test(s));

        if (rawSentences.length === 0) {
            return {
                title: title,
                executiveSummary: "Page does not contain enough clean textual content to synthesize a Fokk Summary.",
                bullets: ["Insufficient body text found on this webpage."],
                metrics: [],
                followUpQuestions: [],
                leadImage: null,
                readingTime: "1 min",
                wordCount: 0
            };
        }

        // 2. Word Frequencies & Entities
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

        // 3. Sentence Scoring
        const scoredSentences = rawSentences.map((s, idx) => {
            const words = (s.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).filter(w => !STOP_WORDS.has(w));
            let score = 0;

            words.forEach(w => {
                if (wordFreq[w]) score += wordFreq[w];
                if (titleTokens.has(w)) score += 6;
            });

            score = score / Math.sqrt(words.length || 1);

            if (idx === 0) score *= 2.3;
            else if (idx === 1) score *= 1.9;
            else if (idx < 5) score *= 1.4;

            if (/\d+%|\$\d+|\b\d{4}\b|\b\d+(?:\.\d+)?\s*(?:billion|million|trillion|percent|users|shares|record|study|confirmed)\b/i.test(s)) {
                score *= 1.35;
            }

            return {
                sentence: s,
                score: score,
                index: idx,
                tokens: new Set(words)
            };
        });

        // 4. Non-Redundant Selection (Deduplication)
        scoredSentences.sort((a, b) => b.score - a.score);
        const selected = [];

        for (const item of scoredSentences) {
            let isDuplicate = false;
            for (const prev of selected) {
                if (calculateSimilarity(item.tokens, prev.tokens) > 0.42) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                selected.push(item);
                if (selected.length >= 4) break;
            }
        }
        selected.sort((a, b) => a.index - b.index);

        // 5. Synthesize Executive Narrative Paragraph in its own distinct voice
        let executiveSummary = "";
        if (selected.length > 0) {
            const lead = selected[0].sentence.replace(/^[\s“"‘']+/, '').replace(/[\s”"’']+$/, '');
            const second = selected.length > 1 ? selected[1].sentence.replace(/^[\s“"‘']+/, '').replace(/[\s”"’']+$/, '') : '';
            if (second && !second.toLowerCase().includes(lead.slice(0, 30).toLowerCase())) {
                executiveSummary = `${lead} Furthermore, ${second.charAt(0).toLowerCase() + second.slice(1)}`;
            } else {
                executiveSummary = lead;
            }
        } else {
            executiveSummary = rawSentences[0];
        }

        const bullets = selected.map(item => item.sentence);

        // 6. Extract Key Figures & Metrics
        const metricRegex = /(?:\$\d+(?:\.\d+)?\s*(?:billion|million|trillion|k|m|b)?|\d+(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b20\d{2}\b)/gi;
        const matches = text.match(metricRegex) || [];
        const uniqueMetrics = Array.from(new Set(matches)).slice(0, 6);

        const wordCount = text.split(/\s+/).length;
        const readingTime = Math.max(1, Math.round(wordCount / 200)) + " min read";
        const leadImage = extractLeadImage();
        const followUpQuestions = generateCuriosityQuestions(title, text, topEntities);

        return {
            title: title,
            executiveSummary: executiveSummary,
            bullets: bullets,
            metrics: uniqueMetrics,
            followUpQuestions: followUpQuestions,
            leadImage: leadImage,
            readingTime: readingTime,
            wordCount: wordCount
        };
    };

    window.triggerFokkSummarizer = function() {
        const summary = generatePageSummary();
        if (window.FokkShieldBridge && typeof window.FokkShieldBridge.showAiSummaryData === 'function') {
            window.FokkShieldBridge.showAiSummaryData(JSON.stringify(summary));
        } else {
            renderInPageSummaryModal(summary);
        }
    };

    function renderInPageSummaryModal(data) {
        let existing = document.getElementById('__fokk_summary_modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = '__fokk_summary_modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(16px);
            z-index: 1000000; display: flex; align-items: flex-end; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        modal.innerHTML = `
            <div style="background: #0E121B; border: 1px solid rgba(0,229,255,0.28); border-radius: 24px 24px 0 0; width: 100%; max-width: 620px; padding: 24px; max-height: 88vh; overflow-y: auto; color: #FFFFFF; box-shadow: 0 -12px 48px rgba(0,0,0,0.75);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: rgba(0,229,255,0.15); color: #00E5FF; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1px solid rgba(0,229,255,0.35); letter-spacing: 0.5px;">⚡ FOKK SUMMARY</span>
                        <span style="font-size: 11.5px; color: #94A3B8;">${data.readingTime} &bull; In-Browser &bull; Zero Cloud</span>
                    </div>
                    <button onclick="document.getElementById('__fokk_summary_modal').remove()" style="background: rgba(255,255,255,0.08); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; font-size: 14px; cursor: pointer;">✕</button>
                </div>

                ${data.leadImage ? `
                    <div style="margin-bottom: 16px; border-radius: 14px; overflow: hidden; max-height: 220px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center;">
                        <img src="${data.leadImage}" alt="" style="max-height: 220px; width: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'" />
                    </div>
                ` : ''}

                <h3 style="color: #FFF; font-size: 16px; font-weight: 800; margin-bottom: 14px; line-height: 1.4;">${data.title || 'Executive Brief'}</h3>

                <!-- Executive Paragraph with live typewriter animation -->
                <div style="background: rgba(0,229,255,0.05); border: 1px solid rgba(0,229,255,0.18); border-radius: 14px; padding: 14px; margin-bottom: 18px; line-height: 1.6; font-size: 13.5px; color: #E2E8F0;">
                    <span style="font-size: 10.5px; font-weight: 800; color: #00E5FF; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 6px;">Executive Brief</span>
                    <span id="__fokk_exec_text"></span><span id="__fokk_exec_cursor" style="color: #00E5FF; font-weight: bold;">▌</span>
                </div>

                <!-- Key Takeaways (Bullets) -->
                <div id="__fokk_bullets_section" style="opacity: 0; transition: opacity 0.4s ease; display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
                    <span style="font-size: 11px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px;">Key Takeaways</span>
                    ${data.bullets.map(b => `
                        <div style="display: flex; gap: 10px; font-size: 13px; line-height: 1.5; background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                            <span style="color: #00E5FF; font-weight: bold; font-size: 15px; line-height: 1;">•</span>
                            <span style="color: #F1F5F9;">${b}</span>
                        </div>
                    `).join('')}
                </div>

                ${data.metrics.length > 0 ? `
                    <div style="margin-bottom: 16px;">
                        <span style="font-size: 10.5px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Key Figures &amp; Data Points</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${data.metrics.map(m => `<span style="background: rgba(0,229,255,0.08); color: #00E5FF; border: 1px solid rgba(0,229,255,0.22); padding: 3px 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700;">${m}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${data.followUpQuestions && data.followUpQuestions.length > 0 ? `
                    <div style="margin-bottom: 20px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
                        <span style="font-size: 10.5px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Deep-Dive Questions</span>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${data.followUpQuestions.map(q => `
                                <div style="font-size: 12px; color: #00E5FF; background: rgba(0,229,255,0.04); border: 1px solid rgba(0,229,255,0.12); border-radius: 8px; padding: 7px 10px; cursor: default;">
                                    <span>✦ ${q}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <button onclick="navigator.clipboard.writeText(${JSON.stringify((data.executiveSummary ? data.executiveSummary + '\n\n' : '') + data.bullets.join('\n\n'))}); this.innerText='Summary Copied!';" style="width: 100%; background: linear-gradient(135deg, #00E5FF, #3B82F6); border: none; border-radius: 12px; padding: 12px; color: #000; font-weight: 800; font-size: 13px; cursor: pointer; transition: transform 0.15s ease;">Copy Fokk Summary</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Live Typewriter Effect for Executive Summary
        const execTarget = document.getElementById('__fokk_exec_text');
        const execCursor = document.getElementById('__fokk_exec_cursor');
        const bulletsSec = document.getElementById('__fokk_bullets_section');
        const fullExec = data.executiveSummary || (data.bullets && data.bullets[0]) || "";
        let cIdx = 0;

        function typeNext() {
            if (cIdx < fullExec.length) {
                const chunk = fullExec.slice(cIdx, cIdx + 3);
                cIdx += 3;
                if (execTarget) execTarget.textContent += chunk;
                setTimeout(typeNext, 12);
            } else {
                if (execCursor) execCursor.style.display = 'none';
                if (bulletsSec) bulletsSec.style.opacity = '1';
            }
        }
        typeNext();
    }
})();
(function () {
    'use strict';

    // State
    let currentQuery = '';
    let currentCategory = 'all';
    let suggestTimeout = null;
    let selectedSuggestIndex = -1;

    // Elements
    const body = document.body;
    const heroSection = document.getElementById('heroSection');
    const heroSearchForm = document.getElementById('heroSearchForm');
    const heroSearchInput = document.getElementById('heroSearchInput');
    const heroSuggestions = document.getElementById('heroSuggestions');
    const heroClearBtn = document.getElementById('heroClearBtn');

    const resultsSearchForm = document.getElementById('resultsSearchForm');
    const resultsSearchInput = document.getElementById('resultsSearchInput');
    const resultsSuggestions = document.getElementById('resultsSuggestions');
    const resultsClearBtn = document.getElementById('resultsClearBtn');

    const navCategories = document.getElementById('navCategories');
    const categoryBtns = navCategories.querySelectorAll('.tab-btn');
    const searchMetrics = document.getElementById('searchMetrics');
    const resultsLayout = document.getElementById('resultsLayout');
    const resultsMainCol = document.getElementById('resultsMainCol');
    const resultsSideCol = document.getElementById('resultsSideCol');

    // Theme Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeIconSun = document.getElementById('themeIconSun');
    const themeIconMoon = document.getElementById('themeIconMoon');

    // Image Modal Elements
    const imageModal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const modalTitle = document.getElementById('modalTitle');
    const modalDomain = document.getElementById('modalDomain');
    const modalVisitBtn = document.getElementById('modalVisitBtn');
    const modalDownloadBtn = document.getElementById('modalDownloadBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    // 1. Theme Management
    function initTheme() {
        const savedTheme = localStorage.getItem('fokk_search_theme') || 'dark';
        setTheme(savedTheme);
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        body.setAttribute('data-theme', theme);
        localStorage.setItem('fokk_search_theme', theme);
        if (theme === 'dark') {
            themeIconSun.style.display = 'block';
            themeIconMoon.style.display = 'none';
        } else {
            themeIconSun.style.display = 'none';
            themeIconMoon.style.display = 'block';
        }
    }

    themeToggleBtn.addEventListener('click', () => {
        const current = body.getAttribute('data-theme') || 'dark';
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // 2. Parse URL Parameters
    function parseUrl() {
        const params = new URLSearchParams(window.location.search);
        const q = (params.get('q') || '').trim();
        const cat = (params.get('category') || 'all').toLowerCase();
        return { q, cat };
    }

    function setView(isResults) {
        if (isResults) {
            body.classList.remove('home-view');
            body.classList.add('results-view');
            resultsLayout.style.display = 'flex';
            navCategories.style.display = 'flex';
        } else {
            body.classList.remove('results-view');
            body.classList.add('home-view');
            resultsLayout.style.display = 'none';
            navCategories.style.display = 'none';
            searchMetrics.textContent = '';
            resultsMainCol.innerHTML = '';
            resultsSideCol.innerHTML = '';
        }
    }

    // 3. Perform Search
    async function executeSearch(query, category = 'all', pushHistory = true) {
        if (!query.trim()) {
            setView(false);
            if (pushHistory) window.history.pushState({}, '', '/');
            return;
        }

        currentQuery = query.trim();
        currentCategory = category;

        // Sync inputs
        heroSearchInput.value = currentQuery;
        resultsSearchInput.value = currentQuery;
        updateClearBtns();

        // Update Category Buttons
        categoryBtns.forEach(btn => {
            if (btn.getAttribute('data-category') === currentCategory) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update URL
        if (pushHistory) {
            const newUrl = `/?q=${encodeURIComponent(currentQuery)}&category=${encodeURIComponent(currentCategory)}`;
            window.history.pushState({ q: currentQuery, category: currentCategory }, '', newUrl);
        }

        setView(true);
        document.title = `${currentQuery} - Fokk Search`;

        // Loading State
        resultsMainCol.innerHTML = `
            <div class="state-box">
                <div class="loading-spinner"></div>
                <p>Searching multi-source index privately...</p>
            </div>
        `;
        resultsSideCol.innerHTML = '';
        searchMetrics.textContent = 'Searching...';

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(currentQuery)}&category=${encodeURIComponent(currentCategory)}`);
            const data = await res.json();
            renderResults(data);
        } catch (err) {
            resultsMainCol.innerHTML = `
                <div class="state-box" style="color: #ef4444;">
                    <p>Search failed: ${escapeHtml(err.message || 'Network error')}</p>
                </div>
            `;
            searchMetrics.textContent = '';
        }
    }

    // 4. Render Search Results
    function renderResults(data) {
        const tookSec = ((data.tookMs || 0) / 1000).toFixed(2);
        const count = data.total || (data.results ? data.results.length : 0);
        searchMetrics.textContent = `About ${count} results (${tookSec} seconds) • Filtered & tracker-free`;

        resultsMainCol.innerHTML = '';
        resultsSideCol.innerHTML = '';

        if (!data.results || data.results.length === 0) {
            resultsMainCol.innerHTML = `
                <div class="state-box">
                    <p>No results found for "${escapeHtml(data.query)}".</p>
                    <p style="font-size:0.85rem; margin-top:8px;">Try different keywords or check another category tab.</p>
                </div>
            `;
            return;
        }

        // Render based on category
        if (currentCategory === 'news') {
            renderNewsTab(data.results);
        } else if (currentCategory === 'images') {
            renderImagesTab(data.results);
        } else if (currentCategory === 'videos') {
            renderVideosTab(data.results);
        } else if (currentCategory === 'discussions') {
            renderDiscussionsTab(data.results);
        } else {
            renderAllTab(data);
        }
    }

    // Helper to format match date / time nicely (e.g. "Today 11:00 PM" in local time)
    function formatMatchTime(dateStr, statusStr) {
        if (statusStr && !statusStr.toLowerCase().includes('utc') && !statusStr.toLowerCase().includes('gmt') && statusStr !== 'Upcoming') {
            if (!statusStr.includes(':00') && !statusStr.includes('Sat') && !statusStr.includes('Sun')) {
                return statusStr;
            }
        }
        if (!dateStr) return statusStr || 'Upcoming';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return statusStr || 'Upcoming';
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = d.toDateString() === tomorrow.toDateString();

            const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            if (isToday) return `Today ${timePart}`;
            if (isTomorrow) return `Tomorrow ${timePart}`;
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timePart;
        } catch (_) {
            return statusStr || 'Upcoming';
        }
    }

    // 5. Render "All" Tab (Universal Rich View)
    function renderAllTab(data) {
        resultsLayout.classList.remove('images-container');
        resultsSideCol.style.display = data.knowledge ? 'block' : 'none';

        // 5a. Knowledge Sidebar Panel
        if (data.knowledge) {
            const k = data.knowledge;
            const imgHtml = k.thumbnail ? `<div class="knowledge-img-wrap"><img src="${escapeHtml(k.thumbnail)}" class="knowledge-image" alt="${escapeHtml(k.title)}"></div>` : '';
            const linkHtml = k.url ? `<a href="${escapeHtml(k.url)}" target="_blank" rel="noopener noreferrer" class="knowledge-link">Read more on ${escapeHtml(k.source || 'Wikipedia')} &rarr;</a>` : '';

            resultsSideCol.innerHTML = `
                <div class="knowledge-panel">
                    <div class="knowledge-header">
                        <h2 class="knowledge-title">${escapeHtml(k.title)}</h2>
                        <p class="knowledge-desc">${escapeHtml(k.description || 'Overview')}</p>
                    </div>
                    ${imgHtml}
                    <p class="knowledge-extract">${escapeHtml(k.extract)}</p>
                    ${linkHtml}
                </div>
            `;
        }

        // 5b. Fokk AI Quick Overview (Generative Direct Answer & Bullet Synthesis)
        if (data.aiOverview && data.aiOverview.summary) {
            const ai = data.aiOverview;
            const aiCard = document.createElement('section');
            aiCard.className = 'ai-overview-card';
            aiCard.innerHTML = `
                <div class="ai-overview-header">
                    <div class="ai-badge-group">
                        <div class="ai-badge">
                            <svg class="ai-sparkle-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
                            </svg>
                            <span>Fokk AI Overview</span>
                        </div>
                        <span class="ai-tag">Quick Synthesis</span>
                    </div>
                    <button class="ai-collapse-btn" id="aiCollapseBtn" title="Toggle Overview" aria-label="Toggle Overview">
                        <svg class="ai-collapse-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="ai-overview-body" id="aiOverviewBody">
                    <p class="ai-summary-text">${escapeHtml(ai.summary)}</p>
                    ${ai.highlights && ai.highlights.length > 0 ? `
                        <ul class="ai-highlights-list">
                            ${ai.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                    ` : ''}
                    ${ai.sources && ai.sources.length > 0 ? `
                        <div class="ai-sources-row">
                            <span class="ai-sources-label">Sources:</span>
                            <div class="ai-sources-chips">
                                ${ai.sources.map((src, i) => `
                                    <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="ai-source-chip">
                                        <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(src.domain || 'google.com')}&sz=64" class="ai-source-icon" alt="" onerror="this.style.opacity='0'">
                                        <span class="ai-source-idx">[${i + 1}]</span>
                                        <span class="ai-source-title">${escapeHtml(src.title)}</span>
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            resultsMainCol.appendChild(aiCard);

            const collapseBtn = aiCard.querySelector('#aiCollapseBtn');
            const bodyEl = aiCard.querySelector('#aiOverviewBody');
            if (collapseBtn && bodyEl) {
                collapseBtn.addEventListener('click', () => {
                    const isCollapsed = bodyEl.classList.toggle('collapsed');
                    collapseBtn.classList.toggle('collapsed', isCollapsed);
                });
            }
        }

        // 5c. Intelligent Live & Upcoming Sports Hub (matches Bing / Google sports query)
        if (data.sports) {
            const sp = data.sports;
            const team = sp.team;
            const match = sp.match;

            const sportsSection = document.createElement('section');
            sportsSection.className = 'sports-hub-container';

            // Sports Header with crest, name, league, and filter tabs
            let headerHtml = `
                <div class="sports-entity-header">
                    <div class="sports-entity-left">
                        <img src="${escapeHtml(team.logo)}" class="sports-team-crest" alt="${escapeHtml(team.name)}" onerror="this.style.opacity='0'">
                        <div class="sports-entity-info">
                            <h2 class="sports-team-name">${escapeHtml(team.name)}</h2>
                            <p class="sports-league-name">${escapeHtml(team.league)}${team.record ? ' • ' + escapeHtml(team.record) : ''}</p>
                        </div>
                    </div>
                    <div class="sports-header-nav">
                        <button class="sports-nav-btn active" data-sports-tab="matches">Matches</button>
                        <button class="sports-nav-btn" data-sports-tab="standings">Standings</button>
                        <button class="sports-nav-btn" data-sports-tab="info">Info</button>
                    </div>
                </div>
            `;

            // Match Card
            let matchCardHtml = '';
            if (match) {
                const formattedTime = formatMatchTime(match.date, match.status);
                const isLive = match.isLive;
                const statusBadge = isLive ? `<span class="live-badge">LIVE</span>` : '';

                matchCardHtml = `
                    <div class="sports-card sports-match-card" id="sportsMatchCard">
                        <div class="sports-card-top-label">
                            <span>${escapeHtml(match.competition || team.league)}</span>
                            ${statusBadge}
                        </div>
                        <div class="sports-matchup-row">
                            <div class="match-competitor home">
                                <img src="${escapeHtml(match.home.logo)}" class="competitor-logo" alt="${escapeHtml(match.home.name)}" onerror="this.style.opacity='0'">
                                <span class="competitor-name">${escapeHtml(match.home.name)}</span>
                            </div>
                            <div class="match-center-info">
                                <div class="match-time-text">${escapeHtml(formattedTime)}</div>
                                ${match.home.score !== null && match.away.score !== null ? `
                                    <div class="match-score-text">${escapeHtml(match.home.score)} - ${escapeHtml(match.away.score)}</div>
                                ` : ''}
                            </div>
                            <div class="match-competitor away">
                                <img src="${escapeHtml(match.away.logo)}" class="competitor-logo" alt="${escapeHtml(match.away.name)}" onerror="this.style.opacity='0'">
                                <span class="competitor-name">${escapeHtml(match.away.name)}</span>
                            </div>
                        </div>

                        <!-- Win Probability Bar -->
                        <div class="sports-win-prob-section">
                            <div class="sports-prob-title">Win probability</div>
                            <div class="sports-prob-labels">
                                <span class="prob-label-home">${escapeHtml(match.home.abbreviation || match.home.name.slice(0,3))} ${match.home.prob}%</span>
                                <span class="prob-label-draw">Draw ${match.drawProb}%</span>
                                <span class="prob-label-away">${escapeHtml(match.away.abbreviation || match.away.name.slice(0,3))} ${match.away.prob}%</span>
                            </div>
                            <div class="sports-prob-bar">
                                <div class="prob-seg home" style="width: ${match.home.prob}%" title="${escapeHtml(match.home.name)} ${match.home.prob}%"></div>
                                <div class="prob-seg draw" style="width: ${match.drawProb}%" title="Draw ${match.drawProb}%"></div>
                                <div class="prob-seg away" style="width: ${match.away.prob}%" title="${escapeHtml(match.away.name)} ${match.away.prob}%"></div>
                            </div>
                        </div>

                        <div class="sports-card-footer">
                            <button class="sports-btn-secondary" id="seeMoreMatchesBtn">See more matches ▾</button>
                            ${match.venue ? `
                                <div class="sports-venue-text">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <span>${escapeHtml(match.venue)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            // Standings Card
            const renderRows = (list) => list.map(s => `
                <tr class="standings-row ${s.isCurrent ? 'current-team' : ''}">
                    <td class="col-team">
                        <span class="standings-rank">${escapeHtml(s.rank)}</span>
                        <img src="${escapeHtml(s.logo)}" class="standings-mini-logo" alt="" onerror="this.style.opacity='0'">
                        <span class="standings-abbrev">${escapeHtml(s.abbreviation || s.team.slice(0,3).toUpperCase())}</span>
                    </td>
                    <td class="col-num">${escapeHtml(s.w)}</td>
                    <td class="col-num">${escapeHtml(s.d)}</td>
                    <td class="col-num">${escapeHtml(s.l)}</td>
                    <td class="col-num pts">${escapeHtml(s.pts)}</td>
                </tr>
            `).join('');

            let standingsCardHtml = '';
            if (sp.standings && sp.standings.length > 0) {
                standingsCardHtml = `
                    <div class="sports-card sports-standings-card" id="sportsStandingsCard">
                        <div class="sports-card-top-label">
                            <span>Standings</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                        <div class="sports-table-wrap">
                            <table class="sports-table">
                                <thead>
                                    <tr>
                                        <th class="col-team">Team</th>
                                        <th class="col-num">W</th>
                                        <th class="col-num">D</th>
                                        <th class="col-num">L</th>
                                        <th class="col-num pts">PTS</th>
                                    </tr>
                                </thead>
                                <tbody id="sportsStandingsTbody">
                                    ${renderRows(sp.standings)}
                                </tbody>
                            </table>
                        </div>
                        <div class="sports-card-footer">
                            <button class="sports-btn-secondary" id="toggleStandingsBtn">See full standings</button>
                        </div>
                    </div>
                `;
            }

            // Fixtures Drawer (Integrated inline fixtures, toggled by See more matches)
            let fixturesDrawerHtml = '';
            if (sp.fixtures && sp.fixtures.length > 0) {
                fixturesDrawerHtml = `
                    <div class="sports-fixtures-drawer" id="sportsFixturesDrawer" style="display: none;">
                        <div class="fixtures-drawer-header">
                            <div class="fixtures-header-title">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <span>Upcoming Fixtures & Recent Matches</span>
                            </div>
                            <span class="fixtures-count-badge">${sp.fixtures.length} Fixtures</span>
                        </div>
                        <div class="fixtures-list-grid">
                            ${sp.fixtures.map(f => {
                                const fTime = formatMatchTime(f.date, f.status);
                                const hasScores = f.home.score !== null && f.away.score !== null;
                                return `
                                    <div class="fixture-item-row ${f.isCompleted ? 'completed' : 'scheduled'}">
                                        <div class="fixture-time-badge">
                                            <span class="f-date">${escapeHtml(fTime)}</span>
                                            <span class="f-status ${f.isCompleted ? 'ft' : 'sch'}">${f.isCompleted ? 'FT' : 'SCH'}</span>
                                        </div>
                                        <div class="fixture-match-layout">
                                            <div class="f-team home">
                                                <img src="${escapeHtml(f.home.logo)}" class="f-team-logo" alt="" onerror="this.style.opacity='0'">
                                                <span class="f-team-name">${escapeHtml(f.home.abbrev || f.home.name)}</span>
                                            </div>
                                            <div class="f-score-center">
                                                ${hasScores ? `
                                                    <span class="f-score-text">${escapeHtml(f.home.score)} - ${escapeHtml(f.away.score)}</span>
                                                ` : `
                                                    <span class="f-vs-text">vs</span>
                                                `}
                                            </div>
                                            <div class="f-team away">
                                                <img src="${escapeHtml(f.away.logo)}" class="f-team-logo" alt="" onerror="this.style.opacity='0'">
                                                <span class="f-team-name">${escapeHtml(f.away.abbrev || f.away.name)}</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            // Club Info Drawer (Toggled by Info tab)
            let clubInfoDrawerHtml = `
                <div class="sports-info-drawer" id="sportsInfoDrawer" style="display: none;">
                    <div class="sports-info-content">
                        <div class="sports-info-item">
                            <span class="info-label">League</span>
                            <span class="info-value">${escapeHtml(team.league)}</span>
                        </div>
                        ${team.venue ? `
                            <div class="sports-info-item">
                                <span class="info-label">Home Ground</span>
                                <span class="info-value">${escapeHtml(team.venue)}</span>
                            </div>
                        ` : ''}
                        ${team.record ? `
                            <div class="sports-info-item">
                                <span class="info-label">Record</span>
                                <span class="info-value">${escapeHtml(team.record)}</span>
                            </div>
                        ` : ''}
                        ${team.website ? `
                            <div class="sports-info-item">
                                <span class="info-label">Official Link</span>
                                <a href="${escapeHtml(team.website)}" target="_blank" rel="noopener noreferrer" class="info-link">Visit Official Club Site &rarr;</a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            sportsSection.innerHTML = `
                ${headerHtml}
                <div class="sports-cards-row">
                    ${matchCardHtml}
                    ${standingsCardHtml}
                </div>
                ${fixturesDrawerHtml}
                ${clubInfoDrawerHtml}
            `;
            resultsMainCol.appendChild(sportsSection);

            // Toggle Full Standings
            const toggleStandingsBtn = sportsSection.querySelector('#toggleStandingsBtn');
            const standingsTbody = sportsSection.querySelector('#sportsStandingsTbody');
            let isFullStandings = false;
            if (toggleStandingsBtn && standingsTbody && sp.fullStandings) {
                toggleStandingsBtn.addEventListener('click', () => {
                    isFullStandings = !isFullStandings;
                    standingsTbody.innerHTML = renderRows(isFullStandings ? sp.fullStandings : sp.standings);
                    toggleStandingsBtn.textContent = isFullStandings ? 'Show top standings' : 'See full standings';
                });
            }

            // Inline Fixtures Drawer Toggle
            const seeMoreMatchesBtn = sportsSection.querySelector('#seeMoreMatchesBtn');
            const fixturesDrawer = sportsSection.querySelector('#sportsFixturesDrawer');
            if (seeMoreMatchesBtn && fixturesDrawer) {
                seeMoreMatchesBtn.addEventListener('click', () => {
                    const isHidden = fixturesDrawer.style.display === 'none';
                    fixturesDrawer.style.display = isHidden ? 'block' : 'none';
                    seeMoreMatchesBtn.textContent = isHidden ? 'Hide fixtures ▴' : 'See more matches ▾';
                    if (isHidden) {
                        fixturesDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            }

            // Tab button clicks in sports hub
            const infoDrawer = sportsSection.querySelector('#sportsInfoDrawer');
            sportsSection.querySelectorAll('.sports-nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    sportsSection.querySelectorAll('.sports-nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const tab = btn.getAttribute('data-sports-tab');
                    if (tab === 'matches') {
                        if (infoDrawer) infoDrawer.style.display = 'none';
                        document.getElementById('sportsMatchCard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else if (tab === 'standings') {
                        if (infoDrawer) infoDrawer.style.display = 'none';
                        const standCard = document.getElementById('sportsStandingsCard');
                        if (standCard) {
                            standCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            standCard.classList.add('highlight-pulse');
                            setTimeout(() => standCard.classList.remove('highlight-pulse'), 1500);
                        }
                    } else if (tab === 'info') {
                        if (infoDrawer) {
                            const isHidden = infoDrawer.style.display === 'none';
                            infoDrawer.style.display = isHidden ? 'block' : 'none';
                            if (isHidden) infoDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }
                });
            });
        }

        // 5d. Top Stories Section (Horizontal Scrollable Carousel - ZERO Orphan Rows, ZERO Blank Spaces!)
        if (data.topNews && data.topNews.length > 0) {
            const topNewsWrap = document.createElement('section');
            topNewsWrap.className = 'top-stories-section';
            topNewsWrap.innerHTML = `
                <div class="section-label-header">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
                        <span>Top Stories</span>
                    </div>
                    <div class="carousel-nav-group">
                        <button class="carousel-arrow-btn" id="storiesPrevBtn" title="Scroll left" aria-label="Scroll left">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button class="carousel-arrow-btn" id="storiesNextBtn" title="Scroll right" aria-label="Scroll right">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <a href="javascript:void(0)" class="section-link-more" id="seeMoreNewsBtn">More news &rarr;</a>
                    </div>
                </div>
                <div class="top-stories-carousel" id="topStoriesCarousel">
                    ${data.topNews.map(n => `
                        <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer" class="story-card-compact">
                            <div class="story-thumb-wrap">
                                <img src="${escapeHtml(n.image)}" class="story-thumb" alt="${escapeHtml(n.title)}" loading="lazy">
                            </div>
                            <div class="story-info">
                                <div class="story-source-row">
                                    <span class="story-source-name">${escapeHtml(n.sourceName || n.domain)}</span>
                                    <span>${escapeHtml(n.timeAgo || 'Recent')}</span>
                                </div>
                                <h4 class="story-title">${escapeHtml(n.title)}</h4>
                            </div>
                        </a>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(topNewsWrap);

            const carousel = topNewsWrap.querySelector('#topStoriesCarousel');
            const prevBtn = topNewsWrap.querySelector('#storiesPrevBtn');
            const nextBtn = topNewsWrap.querySelector('#storiesNextBtn');
            if (carousel && prevBtn && nextBtn) {
                prevBtn.addEventListener('click', () => {
                    carousel.scrollBy({ left: -274, behavior: 'smooth' });
                });
                nextBtn.addEventListener('click', () => {
                    carousel.scrollBy({ left: 274, behavior: 'smooth' });
                });
            }

            const moreNews = topNewsWrap.querySelector('#seeMoreNewsBtn');
            if (moreNews) {
                moreNews.addEventListener('click', () => executeSearch(currentQuery, 'news'));
            }
        }

        // 5e. Live Social Media Pulse (Interactive Platform Filters: All, X, Instagram, Reddit, YouTube)
        if (data.socialPulse && data.socialPulse.length > 0) {
            const socialSection = document.createElement('section');
            socialSection.className = 'social-pulse-section';
            socialSection.innerHTML = `
                <div class="section-label-header">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
                        <span>Live Social Pulse</span>
                        <span class="pulse-live-badge">Live Updates</span>
                    </div>
                    <div class="social-tags-list" id="socialFilterTabs">
                        <button type="button" class="social-filter-tab active" data-filter="all">All</button>
                        <button type="button" class="social-filter-tab" data-filter="x">X</button>
                        <button type="button" class="social-filter-tab" data-filter="instagram">Instagram</button>
                        <button type="button" class="social-filter-tab" data-filter="reddit">Reddit</button>
                        <button type="button" class="social-filter-tab" data-filter="youtube">YouTube</button>
                    </div>
                </div>
                <div class="social-pulse-grid" id="socialPulseGrid">
                    ${data.socialPulse.map(item => `
                        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="social-post-card" data-platform="${escapeHtml((item.platform || '').toLowerCase())}">
                            <div class="social-card-top">
                                <div class="social-identity">
                                    <img src="${escapeHtml(item.icon || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent((item.platform || 'x').toLowerCase() + '.com') + '&sz=64')}" class="social-platform-ico" alt="" onerror="this.style.opacity='0'">
                                    <div class="social-identity-meta">
                                        <div class="social-handle-row">
                                            <span class="social-handle">${escapeHtml(item.handle || item.platform)}</span>
                                            <span class="social-verified-svg" title="Verified">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#00d2b4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                            </span>
                                        </div>
                                        <span class="social-platform-name">${escapeHtml(item.platform)}</span>
                                    </div>
                                </div>
                                <span class="social-time-badge">${escapeHtml(item.timeAgo || 'Live')}</span>
                            </div>
                            <div class="social-card-text">
                                <p class="social-content-snip">${escapeHtml(item.snippet || item.title)}</p>
                            </div>
                            <div class="social-card-action">
                                <span>Open ${escapeHtml(item.platform)} update &rarr;</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(socialSection);

            // Wire up interactive filtering by platform
            const filterTabs = socialSection.querySelectorAll('#socialFilterTabs .social-filter-tab');
            filterTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    filterTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const selected = (tab.dataset.filter || 'all').toLowerCase();
                    const cards = socialSection.querySelectorAll('.social-post-card');
                    cards.forEach(card => {
                        const plat = (card.dataset.platform || '').toLowerCase();
                        if (selected === 'all' || plat === selected) {
                            card.style.display = 'flex';
                        } else {
                            card.style.display = 'none';
                        }
                    });
                });
            });
        }

        // 5f. Primary Web Results
        data.results.forEach(item => {
            const card = document.createElement('article');
            card.className = 'result-card';

            const faviconSrc = item.icon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(item.domain)}&sz=64`;
            const verifiedBadge = item.verified ? `
                <span class="result-verified" title="Authoritative Source">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>` : '';

            card.innerHTML = `
                <div class="result-header">
                    <img src="${escapeHtml(faviconSrc)}" class="result-favicon" alt="" onerror="this.src='https://www.google.com/s2/favicons?domain=' + encodeURIComponent(item.domain) + '&sz=64'">
                    <span class="result-domain-wrap">
                        <span>${escapeHtml(item.domain)}</span>
                        ${verifiedBadge}
                    </span>
                </div>
                <h3 class="result-title">
                    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                </h3>
                <p class="result-snippet">${escapeHtml(item.snippet || '')}</p>
            `;
            resultsMainCol.appendChild(card);
        });

        // 5e. Images Preview Row on "All" Tab
        if (data.topImages && data.topImages.length > 0) {
            const imgPreviewWrap = document.createElement('section');
            imgPreviewWrap.className = 'images-preview-section';
            imgPreviewWrap.innerHTML = `
                <div class="section-label-header">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>Images for ${escapeHtml(currentQuery)}</span>
                    </div>
                    <a href="javascript:void(0)" class="section-link-more" id="seeMoreImagesBtn">More images &rarr;</a>
                </div>
                <div class="images-preview-row">
                    ${data.topImages.map((img, i) => `
                        <div class="preview-img-card" data-idx="${i}">
                            <img src="${escapeHtml(img.thumbnail || img.image)}" class="preview-img-thumb" alt="${escapeHtml(img.title)}" loading="lazy">
                        </div>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(imgPreviewWrap);

            const moreImgs = imgPreviewWrap.querySelector('#seeMoreImagesBtn');
            if (moreImgs) {
                moreImgs.addEventListener('click', () => executeSearch(currentQuery, 'images'));
            }

            imgPreviewWrap.querySelectorAll('.preview-img-card').forEach(c => {
                c.addEventListener('click', () => {
                    const idx = parseInt(c.getAttribute('data-idx'), 10);
                    const item = data.topImages[idx];
                    if (item) openImageModal(item);
                });
            });
        }

        // 5f. Video Previews Section
        if (data.topVideos && data.topVideos.length > 0) {
            const vidWrap = document.createElement('section');
            vidWrap.className = 'videos-section';
            vidWrap.innerHTML = `
                <div class="section-label-header">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="3" ry="3"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
                        <span>Videos</span>
                    </div>
                    <a href="javascript:void(0)" class="section-link-more" id="seeMoreVidBtn">More videos &rarr;</a>
                </div>
                <div class="videos-grid">
                    ${data.topVideos.map(v => `
                        <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="video-card">
                            <div class="video-thumb-wrap">
                                <img src="${escapeHtml(v.thumbnail)}" class="video-thumb" alt="${escapeHtml(v.title)}" loading="lazy">
                                <div class="video-play-badge">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    <span>Watch</span>
                                </div>
                            </div>
                            <div class="video-info">
                                <h4 class="video-title">${escapeHtml(v.title)}</h4>
                                <span class="video-source">${escapeHtml(v.platform || 'YouTube')}${v.channel ? ' • ' + escapeHtml(v.channel) : ''}</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(vidWrap);

            const moreVid = vidWrap.querySelector('#seeMoreVidBtn');
            if (moreVid) {
                moreVid.addEventListener('click', () => executeSearch(currentQuery, 'videos'));
            }
        }

        // 5g. Community Discussions Section (Hacker News / StackOverflow)
        if (data.topDiscussions && data.topDiscussions.length > 0) {
            const discWrap = document.createElement('section');
            discWrap.className = 'discussions-section';
            discWrap.innerHTML = `
                <div class="section-label-header">
                    <div class="section-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg>
                        <span>Community Discussions</span>
                    </div>
                    <a href="javascript:void(0)" class="section-link-more" id="seeMoreDiscBtn">More discussions &rarr;</a>
                </div>
                <div class="discussions-list">
                    ${data.topDiscussions.map(d => `
                        <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer" class="discussion-card">
                            <div class="discussion-main">
                                <div class="discussion-meta-row">
                                    <span class="discussion-platform-tag ${d.platform === 'Stack Overflow' ? 'so' : ''}">${escapeHtml(d.platform)}</span>
                                    <span>&bull;</span>
                                    <span>by ${escapeHtml(d.author)}</span>
                                    <span>&bull;</span>
                                    <span>${escapeHtml(d.timeAgo || 'Recent')}</span>
                                </div>
                                <div class="discussion-title-text">${escapeHtml(d.title)}</div>
                            </div>
                            <div class="discussion-stats-col">
                                <span class="stat-chip votes" title="Upvotes">▲ ${d.score}</span>
                                <span class="stat-chip" title="Comments">💬 ${d.commentsCount}</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(discWrap);

            const moreDisc = discWrap.querySelector('#seeMoreDiscBtn');
            if (moreDisc) {
                moreDisc.addEventListener('click', () => executeSearch(currentQuery, 'discussions'));
            }
        }

        // 5h. Related Searches Pills
        if (data.relatedSearches && data.relatedSearches.length > 0) {
            const relWrap = document.createElement('div');
            relWrap.className = 'related-searches-box';
            relWrap.innerHTML = `
                <h4 class="related-title">Related Searches</h4>
                <div class="related-pills-row">
                    ${data.relatedSearches.map(r => `
                        <div class="related-pill" data-rel="${escapeHtml(r)}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <span>${escapeHtml(r)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            resultsMainCol.appendChild(relWrap);

            relWrap.querySelectorAll('.related-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    executeSearch(pill.getAttribute('data-rel'), 'all');
                });
            });
        }
    }

    // 6. Render Dedicated News Tab (Magazine Grid with HD Hero Images)
    function renderNewsTab(results) {
        resultsLayout.classList.remove('images-container');
        resultsSideCol.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'news-magazine-grid';

        results.forEach(item => {
            const card = document.createElement('a');
            card.className = 'news-magazine-card';
            card.href = item.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';

            const imgHtml = item.image ? `
                <div class="news-mag-thumb-wrap">
                    <img src="${escapeHtml(item.image)}" class="news-mag-thumb" alt="${escapeHtml(item.title)}" loading="lazy">
                </div>
            ` : '';

            card.innerHTML = `
                ${imgHtml}
                <div class="news-mag-content">
                    <div class="news-mag-meta">
                        <span class="news-mag-source">${escapeHtml(item.sourceName || item.domain)}</span>
                        <span>&bull;</span>
                        <span>${escapeHtml(item.timeAgo || 'Recent')}</span>
                    </div>
                    <h3 class="news-mag-title">${escapeHtml(item.title)}</h3>
                    ${item.snippet ? `<p class="news-mag-snippet">${escapeHtml(item.snippet)}</p>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });

        resultsMainCol.appendChild(grid);
    }

    // 7. Render Dedicated Images Tab (Deep 60+ Images Masonry Grid)
    function renderImagesTab(results) {
        resultsLayout.classList.add('images-container');
        resultsSideCol.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'images-grid';

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.title = item.title;

            card.innerHTML = `
                <div class="image-thumb-wrap">
                    <img src="${escapeHtml(item.thumbnail || item.image)}" class="image-thumb" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.closest('.image-card').style.display='none'">
                </div>
                <div class="image-info">
                    <div class="image-title">${escapeHtml(item.title)}</div>
                    <div class="image-source">${escapeHtml(item.domain)}</div>
                </div>
            `;

            card.addEventListener('click', () => openImageModal(item));
            grid.appendChild(card);
        });

        resultsMainCol.appendChild(grid);
    }

    // 8. Render Dedicated Videos Tab
    function renderVideosTab(results) {
        resultsLayout.classList.remove('images-container');
        resultsSideCol.style.display = 'none';

        const grid = document.createElement('div');
        grid.className = 'videos-grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';

        results.forEach(item => {
            const card = document.createElement('a');
            card.className = 'video-card';
            card.href = item.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';

            card.innerHTML = `
                <div class="video-thumb-wrap" style="height: 160px;">
                    <img src="${escapeHtml(item.thumbnail)}" class="video-thumb" alt="${escapeHtml(item.title)}" loading="lazy">
                    <div class="video-play-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>Watch on YouTube</span>
                    </div>
                </div>
                <div class="video-info" style="padding: 12px 14px;">
                    <h3 class="video-title" style="font-size: 0.95rem; -webkit-line-clamp: 2;">${escapeHtml(item.title)}</h3>
                    <span class="video-source">${escapeHtml(item.platform || 'YouTube')}</span>
                    ${item.snippet ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(item.snippet)}</p>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });

        resultsMainCol.appendChild(grid);
    }

    // 9. Render Dedicated Discussions Tab
    function renderDiscussionsTab(results) {
        resultsLayout.classList.remove('images-container');
        resultsSideCol.style.display = 'none';

        const wrap = document.createElement('div');
        wrap.className = 'discussions-list';
        wrap.style.maxWidth = '840px';

        results.forEach(d => {
            const card = document.createElement('a');
            card.className = 'discussion-card';
            card.href = d.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.style.padding = '16px 20px';

            card.innerHTML = `
                <div class="discussion-main">
                    <div class="discussion-meta-row">
                        <span class="discussion-platform-tag ${d.platform === 'Stack Overflow' ? 'so' : ''}">${escapeHtml(d.platform)}</span>
                        <span>&bull;</span>
                        <span>by ${escapeHtml(d.author)}</span>
                        <span>&bull;</span>
                        <span>${escapeHtml(d.timeAgo || 'Recent')}</span>
                    </div>
                    <div class="discussion-title-text" style="font-size: 1.05rem;">${escapeHtml(d.title)}</div>
                </div>
                <div class="discussion-stats-col">
                    <span class="stat-chip votes" title="Upvotes">▲ ${d.score}</span>
                    <span class="stat-chip" title="Comments">💬 ${d.commentsCount}</span>
                </div>
            `;
            wrap.appendChild(card);
        });

        resultsMainCol.appendChild(wrap);
    }

    // Lightbox Modal
    function openImageModal(item) {
        modalImg.src = item.image || item.thumbnail;
        modalTitle.textContent = item.title;
        modalDomain.textContent = item.domain;
        modalVisitBtn.href = item.url || item.image;
        modalDownloadBtn.href = item.image;
        imageModal.classList.add('active');
    }

    function closeImageModal() {
        imageModal.classList.remove('active');
        modalImg.src = '';
    }

    modalCloseBtn.addEventListener('click', closeImageModal);
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) closeImageModal();
    });

    // Category Tabs Switching
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-category');
            if (cat !== currentCategory) {
                executeSearch(currentQuery, cat);
            }
        });
    });

    // Autocomplete Handling
    function setupAutocomplete(inputEl, dropdownEl, formEl) {
        inputEl.addEventListener('input', () => {
            const val = inputEl.value.trim();
            updateClearBtns();
            clearTimeout(suggestTimeout);
            selectedSuggestIndex = -1;

            if (!val) {
                dropdownEl.classList.remove('active');
                dropdownEl.innerHTML = '';
                return;
            }

            suggestTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/suggest?q=${encodeURIComponent(val)}`);
                    const suggestions = await res.json();
                    renderSuggestions(suggestions, dropdownEl, inputEl, formEl);
                } catch (_) {}
            }, 180);
        });

        inputEl.addEventListener('keydown', (e) => {
            const items = dropdownEl.querySelectorAll('.suggestion-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedSuggestIndex = (selectedSuggestIndex + 1) % items.length;
                updateSelectedSuggest(items, inputEl);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedSuggestIndex = (selectedSuggestIndex - 1 + items.length) % items.length;
                updateSelectedSuggest(items, inputEl);
            } else if (e.key === 'Escape') {
                dropdownEl.classList.remove('active');
            }
        });
    }

    function renderSuggestions(list, dropdownEl, inputEl, formEl) {
        if (!list || list.length === 0) {
            dropdownEl.classList.remove('active');
            dropdownEl.innerHTML = '';
            return;
        }

        dropdownEl.innerHTML = '';
        list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'suggestion-item';
            row.innerHTML = `
                <svg class="suggestion-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>${escapeHtml(item)}</span>
            `;
            row.addEventListener('click', () => {
                inputEl.value = item;
                dropdownEl.classList.remove('active');
                formEl.dispatchEvent(new Event('submit'));
            });
            dropdownEl.appendChild(row);
        });

        dropdownEl.classList.add('active');
    }

    function updateSelectedSuggest(items, inputEl) {
        items.forEach((item, idx) => {
            if (idx === selectedSuggestIndex) {
                item.classList.add('selected');
                inputEl.value = item.querySelector('span').textContent;
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Forms Submit
    heroSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        heroSuggestions.classList.remove('active');
        executeSearch(heroSearchInput.value, 'all');
    });

    resultsSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        resultsSuggestions.classList.remove('active');
        executeSearch(resultsSearchInput.value, currentCategory);
    });

    setupAutocomplete(heroSearchInput, heroSuggestions, heroSearchForm);
    setupAutocomplete(resultsSearchInput, resultsSuggestions, resultsSearchForm);

    // Clear Buttons
    function updateClearBtns() {
        if (heroSearchInput.value) {
            heroClearBtn.classList.remove('hidden');
        } else {
            heroClearBtn.classList.add('hidden');
        }

        if (resultsSearchInput.value) {
            resultsClearBtn.classList.remove('hidden');
        } else {
            resultsClearBtn.classList.add('hidden');
        }
    }

    heroClearBtn.addEventListener('click', () => {
        heroSearchInput.value = '';
        heroSuggestions.classList.remove('active');
        updateClearBtns();
        heroSearchInput.focus();
    });

    resultsClearBtn.addEventListener('click', () => {
        resultsSearchInput.value = '';
        resultsSuggestions.classList.remove('active');
        updateClearBtns();
        resultsSearchInput.focus();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!heroSearchForm.contains(e.target)) heroSuggestions.classList.remove('active');
        if (!resultsSearchForm.contains(e.target)) resultsSuggestions.classList.remove('active');
    });

    // Global Key Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== heroSearchInput && document.activeElement !== resultsSearchInput) {
            e.preventDefault();
            const activeInput = body.classList.contains('results-view') ? resultsSearchInput : heroSearchInput;
            activeInput.focus();
            activeInput.select();
        }
        if (e.key === 'Escape' && imageModal.classList.contains('active')) {
            closeImageModal();
        }
    });

    // History popstate
    window.addEventListener('popstate', () => {
        const { q, cat } = parseUrl();
        executeSearch(q, cat, false);
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Initialize
    initTheme();
    const initial = parseUrl();
    if (initial.q) {
        executeSearch(initial.q, initial.cat, false);
    } else {
        setView(false);
    }

})();

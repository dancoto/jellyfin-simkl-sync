export const renderOverridesHtml = (): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jellyfin Tracker Sync - Mapping Overrides</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151d2e;
      --card-border: #222f46;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0284c7;
      --anilist: #02a9ff;
      --anilist-hover: #008ecc;
      --anilist-pink: #f472b6;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --input-bg: #0d1525;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 1.5rem 1rem; min-height: 100vh; display: flex; justify-content: center; }
    .container { max-width: 1200px; width: 100%; display: flex; flex-direction: column; gap: 1.25rem; }
    
    header { text-align: center; margin-bottom: 0.25rem; }
    h1 { font-size: 1.8rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    header p { color: var(--text-muted); font-size: 0.95rem; }

    nav { display: flex; justify-content: center; gap: 0.75rem; margin-top: 0.5rem; }
    .nav-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.88rem; text-decoration: none; border: 1px solid var(--card-border); color: var(--text-muted); background: var(--card-bg); transition: all 0.2s; }
    .nav-btn.active { color: #fff; border-color: var(--accent); background: rgba(56, 189, 248, 0.1); }
    .nav-btn:hover { color: #fff; border-color: var(--accent); }

    /* Stats Banner */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.9rem 1.1rem; cursor: pointer; transition: all 0.2s; }
    .stat-card:hover { border-color: var(--accent); background: rgba(56, 189, 248, 0.04); }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.25rem; }
    .stat-val { font-size: 1.4rem; font-weight: 700; color: #fff; }
    .stat-val.anilist { color: var(--anilist-pink); }
    .stat-val.anilist-skipped { color: #c084fc; }
    .stat-val.success { color: var(--success); }

    /* Controls Bar */
    .controls-bar { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.85rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .search-box { flex: 1; min-width: 230px; position: relative; }
    .search-box input { width: 100%; background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.6rem 0.85rem 0.6rem 2.2rem; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
    .search-box input:focus { border-color: var(--accent); }
    .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem; }

    .sort-box { display: flex; align-items: center; gap: 0.4rem; }
    .sort-label { font-size: 0.82rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    .sort-select { background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.84rem; font-weight: 600; outline: none; cursor: pointer; transition: border-color 0.2s; }
    .sort-select:focus { border-color: var(--accent); }

    .filter-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
    .filter-btn { background: var(--input-bg); border: 1px solid var(--card-border); color: var(--text-muted); padding: 0.45rem 0.8rem; border-radius: 6px; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .filter-btn.active { background: var(--accent); color: #0b0f19; border-color: var(--accent); }

    /* Series Cards */
    .series-list { display: flex; flex-direction: column; gap: 1rem; }
    .series-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
    .series-card.modified { border-color: var(--warning); }

    .series-header { padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer; user-select: none; background: rgba(0,0,0,0.15); transition: background 0.15s; }
    .series-header:hover { background: rgba(255,255,255,0.02); }
    .series-title-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .series-title { font-size: 1.1rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .series-badges { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
    .badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-decoration: none; }
    .badge-tvdb { background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .badge-tvdb:hover { background: rgba(14, 165, 233, 0.25); }
    .badge-tmdb { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-tmdb:hover { background: rgba(16, 185, 129, 0.25); }
    .badge-search { background: rgba(255, 255, 255, 0.08); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.12); }
    .badge-search:hover { color: #fff; background: rgba(255, 255, 255, 0.15); }
    .badge-missing { background: var(--warning-bg); color: #fbbf24; }
    .badge-ok { background: var(--success-bg); color: #34d399; }
    .badge-anilist { background: rgba(236, 72, 153, 0.15); color: var(--anilist-pink); border: 1px solid rgba(236, 72, 153, 0.3); }
    .badge-anilist-skipped { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }

    .series-actions { display: flex; align-items: center; gap: 0.6rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.45rem 0.9rem; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: var(--accent); color: #0b0f19; }
    .btn-primary:hover { background: var(--accent-hover); color: #fff; }
    .btn-secondary { background: rgba(255, 255, 255, 0.08); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.1); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
    .btn-anilist-skipped { background: rgba(192, 132, 252, 0.2); color: #d8b4fe; border: 1px solid rgba(192, 132, 252, 0.4); }
    .btn-anilist-skipped:hover { background: rgba(192, 132, 252, 0.35); color: #fff; }
    .btn-sm { padding: 0.35rem 0.65rem; font-size: 0.78rem; }

    .chevron { transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); }
    .chevron.open { transform: rotate(180deg); }

    /* Series Body */
    .series-body { padding: 1.25rem; display: none; border-top: 1px solid var(--card-border); background: #0e1422; }
    .series-body.open { display: block; }

    /* Season Section */
    .season-section { margin-bottom: 1.25rem; }
    .season-section:last-child { margin-bottom: 0; }
    .season-header { font-size: 0.92rem; font-weight: 700; color: #fff; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
    
    .batch-fill-bar { background: rgba(0,0,0,0.25); border: 1px solid var(--card-border); border-radius: 8px; padding: 0.6rem 0.85rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.82rem; }
    .batch-fill-bar span { color: var(--text-muted); font-weight: 500; }

    /* Episodes Table */
    .ep-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    .ep-table th { text-align: left; padding: 0.55rem 0.75rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--card-border); background: rgba(0,0,0,0.2); }
    .ep-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
    .ep-table tr:hover { background: rgba(255,255,255,0.02); }
    .ep-table tr:last-child td { border-bottom: none; }
    .ep-table tr.row-highlight-anilist { background: rgba(236, 72, 153, 0.07); }
    .ep-table tr.row-highlight-anilist td:first-child { border-left: 3px solid #ec4899; }
    .ep-table tr.row-skipped-anilist { background: rgba(192, 132, 252, 0.04); }
    .ep-table tr.row-skipped-anilist .ep-name { color: #d8b4fe; opacity: 0.85; }

    .ep-num { font-weight: 700; color: #fff; width: 60px; }
    .ep-name { max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #cbd5e1; }
    .ep-name:hover { white-space: normal; word-break: break-word; }

    .id-input-group { display: flex; align-items: center; gap: 0.35rem; }
    .id-input { background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.84rem; width: 130px; font-family: monospace; outline: none; transition: border-color 0.15s; }
    .id-input.null-val { color: #64748b; font-style: italic; }
    .id-input.skipped-val { color: #c084fc; font-style: italic; opacity: 0.8; }
    .id-input:focus { border-color: var(--accent); }
    .ep-sub-input { width: 60px; }

    /* Floating Save Bar */
    .save-banner { position: fixed; bottom: 1.5rem; right: 1.5rem; background: #1e293b; border: 1px solid var(--card-border); border-radius: 12px; padding: 0.85rem 1.25rem; display: none; align-items: center; gap: 1rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); z-index: 100; }
    .save-banner.show { display: flex; }
    .save-banner-text { font-size: 0.9rem; font-weight: 600; color: #fff; }

    /* Toast */
    .toast { position: fixed; top: 1.5rem; right: 1.5rem; padding: 0.85rem 1.25rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; display: none; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .toast.success { display: block; background: #065f46; color: #34d399; border: 1px solid #059669; }
    .toast.error { display: block; background: #7f1d1d; color: #f87171; border: 1px solid #dc2626; }

    .loading-spinner { text-align: center; padding: 3rem; color: var(--text-muted); font-size: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>🌸</span> Jellyfin Anime Mapping Overrides</h1>
      <p>Direct TVDB to AniList mappings for Simkl and AniList tracker synchronization</p>
      <nav>
        <a href="/" class="nav-btn"><span>👥</span> User Accounts</a>
        <a href="/overrides" class="nav-btn active"><span>🌸</span> Mapping Overrides</a>
      </nav>
    </header>

    <!-- Stats Banner -->
    <div class="stats-grid">
      <div class="stat-card" onclick="setFilter('all')" title="Filter by All Shows">
        <div class="stat-label">Total Shows in Overrides</div>
        <div class="stat-val" id="stat-total-shows">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('missing-anilist'); setSort('missing-desc');" title="Filter by Only Missing AniList & Sort by Most Missing">
        <div class="stat-label">Missing AniList (Unmapped)</div>
        <div class="stat-val anilist" id="stat-missing-anilist">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('skipped-anilist')" title="Filter by Shows with Skipped AniList Episodes">
        <div class="stat-label">Skipped AniList Episodes</div>
        <div class="stat-val anilist-skipped" id="stat-skipped-anilist">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('complete')" title="Filter by Completed">
        <div class="stat-label">Fully Mapped</div>
        <div class="stat-val success" id="stat-fully-mapped">-</div>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-input" placeholder="Search by title or TVDB ID..." oninput="handleSearch()">
      </div>
      <div class="sort-box">
        <span class="sort-label">Sort:</span>
        <select id="sort-select" class="sort-select" onchange="setSort(this.value)">
          <option value="missing-desc">🌸 Most Missing AniList</option>
          <option value="missing-asc">Least Missing AniList</option>
          <option value="title-asc">Title (A → Z)</option>
          <option value="default">Default (TVDB ID)</option>
        </select>
      </div>
      <div class="filter-tabs">
        <button class="filter-btn active" data-filter="all" onclick="setFilter('all')">All Shows</button>
        <button class="filter-btn" data-filter="missing-anilist" onclick="setFilter('missing-anilist')">🌸 Only Missing AniList</button>
        <button class="filter-btn" data-filter="skipped-anilist" onclick="setFilter('skipped-anilist')">🌸 Skipped AniList</button>
        <button class="filter-btn" data-filter="complete" onclick="setFilter('complete')">Completed</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleAllCards()" id="toggle-all-btn">Expand All</button>
      </div>
    </div>

    <!-- Series Cards Container -->
    <div class="series-list" id="series-container">
      <div class="loading-spinner">Loading mapping overrides...</div>
    </div>
  </div>

  <!-- Floating Save Bar -->
  <div class="save-banner" id="save-banner">
    <span class="save-banner-text" id="save-banner-text">Unsaved changes</span>
    <button class="btn btn-primary" onclick="saveAllChanges()">💾 Save Changes</button>
  </div>

  <!-- Toast Notification -->
  <div class="toast" id="toast"></div>

  <script>
    let overridesData = {};
    let dirtyShows = new Set();
    let currentFilter = 'all';
    let currentSort = 'missing-desc';
    let searchQuery = '';
    let allExpanded = false;
    let openCards = new Set();

    async function loadOverrides() {
      try {
        const res = await fetch('/api/overrides');
        if (!res.ok) throw new Error('Failed to load overrides');
        const data = await res.json();
        overridesData = data.overrides || {};
        updateStats();
        renderSeriesCards();
      } catch (err) {
        document.getElementById('series-container').innerHTML = 
          '<div style="color: #f87171; text-align: center; padding: 2rem;">Error loading overrides: ' + err.message + '</div>';
      }
    }

    function isEpMissingAniList(ep) {
      if (ep.skipAniList) return false;
      return ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '';
    }

    function updateStats() {
      let totalShows = 0;
      let missingAniList = 0;
      let skippedAniList = 0;
      let fullyMapped = 0;

      for (const [tvdbId, show] of Object.entries(overridesData)) {
        totalShows++;
        for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
          for (const [epNum, ep] of Object.entries(season.episodes || {})) {
            if (ep.skipAniList) {
              skippedAniList++;
            } else if (ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '') {
              missingAniList++;
            } else {
              fullyMapped++;
            }
          }
        }
      }

      document.getElementById('stat-total-shows').innerText = totalShows;
      document.getElementById('stat-missing-anilist').innerText = missingAniList;
      document.getElementById('stat-skipped-anilist').innerText = skippedAniList;
      document.getElementById('stat-fully-mapped').innerText = fullyMapped;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function countMissingAniListInShow(show) {
      let count = 0;
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (isEpMissingAniList(ep)) {
            count++;
          }
        }
      }
      return count;
    }

    function countSkippedAniListInShow(show) {
      let count = 0;
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.skipAniList) {
            count++;
          }
        }
      }
      return count;
    }

    function hasMissingAniListInShow(show) {
      return countMissingAniListInShow(show) > 0;
    }

    function hasSkippedAniListInShow(show) {
      return countSkippedAniListInShow(show) > 0;
    }

    function renderSeriesCards() {
      const container = document.getElementById('series-container');
      const entries = Object.entries(overridesData);

      if (entries.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No overrides found in mapping-overrides.json.</div>';
        return;
      }

      // Filter and search
      let filtered = entries.filter(([tvdbId, show]) => {
        const titleMatch = (show.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || tvdbId.includes(searchQuery);
        if (!titleMatch) return false;

        if (currentFilter === 'missing-anilist') {
          return hasMissingAniListInShow(show);
        } else if (currentFilter === 'skipped-anilist') {
          return hasSkippedAniListInShow(show);
        } else if (currentFilter === 'complete') {
          return !hasMissingAniListInShow(show);
        }
        return true;
      });

      // Sort
      filtered.sort(([idA, showA], [idB, showB]) => {
        if (currentSort === 'missing-desc') {
          const diff = countMissingAniListInShow(showB) - countMissingAniListInShow(showA);
          if (diff !== 0) return diff;
          return (showA.title || '').localeCompare(showB.title || '');
        } else if (currentSort === 'missing-asc') {
          const diff = countMissingAniListInShow(showA) - countMissingAniListInShow(showB);
          if (diff !== 0) return diff;
          return (showA.title || '').localeCompare(showB.title || '');
        } else if (currentSort === 'title-asc') {
          return (showA.title || '').localeCompare(showB.title || '');
        }
        return 0; // Default (TVDB ID)
      });

      if (filtered.length === 0) {
        let emptyMsg = 'No series match your search or filter.';
        if (currentFilter === 'missing-anilist') {
          emptyMsg = '🌸 No series are currently missing AniList mappings!';
        } else if (currentFilter === 'skipped-anilist') {
          emptyMsg = '🌸 No series currently have skipped AniList episodes.';
        } else if (currentFilter === 'complete') {
          emptyMsg = 'No completed series yet. Fill in missing AniList IDs or mark them as skipped.';
        }
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">' + emptyMsg + '</div>';
        return;
      }

      container.innerHTML = filtered.map(([tvdbId, show]) => renderShowCard(tvdbId, show)).join('');
    }

    function renderShowCard(tvdbId, show) {
      const missingCount = countMissingAniListInShow(show);
      const skippedCount = countSkippedAniListInShow(show);
      const isModified = dirtyShows.has(tvdbId);
      const cleanTitle = show.title || 'Unknown Title';
      const encodedTitle = encodeURIComponent(cleanTitle);
      const isOpen = openCards.has(tvdbId) || allExpanded;

      let totalEps = 0;
      for (const season of Object.values(show.seasons || {})) {
        totalEps += Object.keys(season.episodes || {}).length;
      }
      const isAllSkipped = totalEps > 0 && skippedCount === totalEps;

      let statusBadge = '';
      if (missingCount > 0) {
        statusBadge = \`<span class="badge badge-anilist" title="\${missingCount} episode(s) missing AniList">🌸 \${missingCount} missing AniList</span>\`;
      } else if (isAllSkipped) {
        statusBadge = \`<span class="badge badge-anilist-skipped">🌸 All Episodes Skipped</span>\`;
      } else if (skippedCount > 0) {
        statusBadge = \`<span class="badge badge-ok">✓ Completed (\${skippedCount} skipped)</span>\`;
      } else {
        statusBadge = \`<span class="badge badge-ok">✓ Completed</span>\`;
      }

      const seasonsHtml = Object.entries(show.seasons || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([seasonNum, season]) => renderSeasonSection(tvdbId, seasonNum, season))
        .join('');

      return \`
        <div class="series-card \${isModified ? 'modified' : ''}" id="card-\${tvdbId}">
          <div class="series-header" onclick="toggleCard('\${tvdbId}')">
            <div class="series-title-group">
              <div class="series-title">
                <span>\${escapeHtml(cleanTitle)}</span>
                \${statusBadge}
              </div>
              <div class="series-badges" onclick="event.stopPropagation()">
                <a href="https://thetvdb.com/dereferrer/series/\${tvdbId}" target="_blank" class="badge badge-tvdb">TVDB: \${tvdbId} ↗</a>
                \${show.tmdbId ? \`<a href="https://www.themoviedb.org/tv/\${show.tmdbId}" target="_blank" class="badge badge-tmdb">TMDB: \${show.tmdbId} ↗</a>\` : ''}
                <a href="https://anilist.co/search/anime?search=\${encodedTitle}" target="_blank" class="badge badge-search" style="color: var(--anilist);">🌸 Search AniList ↗</a>
              </div>
            </div>
            <div class="series-actions" onclick="event.stopPropagation()">
              <button class="btn btn-primary btn-sm" onclick="saveShow('\${tvdbId}')" id="save-btn-\${tvdbId}" \${isModified ? '' : 'style="opacity: 0.6;"'}>💾 Save</button>
              <span class="chevron \${isOpen ? 'open' : ''}" id="chevron-\${tvdbId}">▼</span>
            </div>
          </div>
          <div class="series-body \${isOpen ? 'open' : ''}" id="body-\${tvdbId}">
            \${seasonsHtml}
          </div>
        </div>
      \`;
    }

    function renderSeasonSection(tvdbId, seasonNum, season) {
      const label = seasonNum === '0' ? 'Season 0 (Specials)' : 'Season ' + seasonNum;
      const episodes = Object.entries(season.episodes || {}).sort(([a], [b]) => Number(a) - Number(b));
      const seasonMissing = episodes.filter(([_, ep]) => isEpMissingAniList(ep)).length;
      const seasonSkipped = episodes.filter(([_, ep]) => Boolean(ep.skipAniList)).length;
      const isSeasonAllSkipped = episodes.length > 0 && seasonSkipped === episodes.length;

      const rows = episodes.map(([epNum, ep]) => {
        const isAniListSkipped = Boolean(ep.skipAniList);
        const isAniListNull = isEpMissingAniList(ep);
        const cleanEpName = ep.name || ('Episode ' + epNum);

        let rowHighlight = '';
        if (isAniListSkipped) {
          rowHighlight = 'row-skipped-anilist';
        } else if (currentFilter === 'missing-anilist' && isAniListNull) {
          rowHighlight = 'row-highlight-anilist';
        }

        return \`
          <tr class="\${rowHighlight}">
            <td class="ep-num">E\${epNum}</td>
            <td class="ep-name" title="\${escapeHtml(cleanEpName)}">\${escapeHtml(cleanEpName)}</td>
            <td>
              <div class="id-input-group">
                <input type="number" class="id-input \${isAniListSkipped ? 'skipped-val' : isAniListNull ? 'null-val' : ''}" 
                  id="anilist-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${isAniListNull || isAniListSkipped ? '' : escapeHtml(ep.anilistId)}" 
                  placeholder="\${isAniListSkipped ? 'skipped' : 'null'}"
                  title="\${isAniListSkipped ? 'AniList Skipped (will use TVDB for Simkl)' : 'AniList Media ID'}"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistId', this.value)"
                >
                <input type="number" class="id-input ep-sub-input" 
                  id="anilist-ep-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${ep.anilistEpisode ?? epNum}" 
                  title="AniList Episode Number"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistEpisode', this.value)"
                >
              </div>
            </td>
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center; justify-content: center;">
                <button class="btn btn-sm \${isAniListSkipped ? 'btn-anilist-skipped' : 'btn-secondary'}" 
                  onclick="toggleEpSkipAniList('\${tvdbId}', '\${seasonNum}', '\${epNum}')" 
                  title="\${isAniListSkipped ? 'AniList skipped. Click to unskip.' : 'Skip AniList for this episode (not counted as missing, will use TVDB for Simkl)'}">
                  🌸 \${isAniListSkipped ? 'Skipped' : 'Skip'}
                </button>
                <button class="btn btn-secondary btn-sm" 
                  onclick="setNull('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistId')" 
                  title="Clear AniList ID (sets to null, marks as missing)">∅</button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');

      return \`
        <div class="season-section">
          <div class="season-header">
            <div>
              <span>\${label}</span>
              \${isSeasonAllSkipped ? '<span class="badge badge-anilist-skipped" style="margin-left: 0.5rem;">🌸 Season Skipped (AniList)</span>' : ''}
            </div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              \${episodes.length} episodes
              \${seasonMissing > 0 ? \`· <span style="color: var(--anilist-pink); font-weight: 600;">🌸 \${seasonMissing} missing AniList</span>\` : ''}
              \${seasonSkipped > 0 && !isSeasonAllSkipped ? \`· <span style="color: #c084fc;">🌸 \${seasonSkipped} skipped</span>\` : ''}
            </span>
          </div>
          <div class="batch-fill-bar">
            <span>🌸 Batch Fill \${label}:</span>
            <input type="number" class="id-input" id="batch-anilist-\${tvdbId}-\${seasonNum}" placeholder="AniList ID" style="max-width: 140px;">
            <button class="btn btn-secondary btn-sm" onclick="applyBatchSeason('\${tvdbId}', '\${seasonNum}')">Apply to Season</button>
            <button class="btn btn-secondary btn-sm" onclick="skipUnmappedSeasonAniList('\${tvdbId}', '\${seasonNum}')" title="Mark all unmapped episodes in this season as skipped for AniList">🌸 Skip Unmapped in Season</button>
          </div>
          <table class="ep-table">
            <thead>
              <tr>
                <th style="width: 70px;">Ep</th>
                <th>Title</th>
                <th>AniList [Media ID / Ep]</th>
                <th style="width: 130px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              \${rows}
            </tbody>
          </table>
        </div>
      \`;
    }

    function toggleCard(tvdbId) {
      const body = document.getElementById('body-' + tvdbId);
      const chevron = document.getElementById('chevron-' + tvdbId);
      if (!body) return;

      if (body.classList.contains('open')) {
        body.classList.remove('open');
        chevron.classList.remove('open');
        openCards.delete(tvdbId);
      } else {
        body.classList.add('open');
        chevron.classList.add('open');
        openCards.add(tvdbId);
      }
    }

    function toggleAllCards() {
      allExpanded = !allExpanded;
      document.getElementById('toggle-all-btn').innerText = allExpanded ? 'Collapse All' : 'Expand All';
      document.querySelectorAll('.series-body').forEach(b => {
        if (allExpanded) b.classList.add('open');
        else b.classList.remove('open');
      });
      document.querySelectorAll('.chevron').forEach(c => {
        if (allExpanded) c.classList.add('open');
        else c.classList.remove('open');
      });
      if (!allExpanded) openCards.clear();
    }

    function onFieldChange(tvdbId, seasonNum, epNum, field, val) {
      const ep = overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      if (!ep) return;

      if (field === 'anilistId') {
        const trimmed = val.trim();
        const parsed = parseInt(trimmed, 10);
        ep.anilistId = trimmed === '' || trimmed.toLowerCase() === 'null' || !Number.isInteger(parsed) ? null : parsed;
        if (ep.anilistId !== null) {
          delete ep.skipAniList; // Valid ID entered, clear skip flag
        }
        const input = document.getElementById('anilist-' + tvdbId + '-' + seasonNum + '-' + epNum);
        if (input) {
          if (ep.anilistId === null) input.classList.add('null-val');
          else input.classList.remove('null-val');
        }
      } else if (field === 'anilistEpisode') {
        const parsed = parseInt(val, 10);
        ep.anilistEpisode = Number.isInteger(parsed) ? parsed : null;
      }

      markDirty(tvdbId);
      renderSeriesCards();
    }

    function toggleEpSkipAniList(tvdbId, seasonNum, epNum) {
      const ep = overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      if (!ep) return;

      ep.skipAniList = !ep.skipAniList;
      if (!ep.skipAniList) {
        delete ep.skipAniList;
      }
      markDirty(tvdbId);
      renderSeriesCards();
    }

    function skipUnmappedSeasonAniList(tvdbId, seasonNum) {
      const season = overridesData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      let changed = 0;
      for (const [epNum, ep] of Object.entries(season.episodes)) {
        if (!ep.skipAniList && (ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '')) {
          ep.skipAniList = true;
          changed++;
        }
      }

      if (changed > 0) {
        markDirty(tvdbId);
        renderSeriesCards();
        showToast('Marked ' + changed + ' unmapped episode(s) as skipped for AniList', 'success');
      } else {
        showToast('No unmapped episodes to skip in this season', 'error');
      }
    }

    function setNull(tvdbId, seasonNum, epNum, field) {
      const ep = overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      if (!ep) return;

      ep[field] = null;
      delete ep.skipAniList; // Reset skip flag so it shows as null/missing
      markDirty(tvdbId);
      renderSeriesCards();
    }

    function applyBatchSeason(tvdbId, seasonNum) {
      const anilistVal = document.getElementById('batch-anilist-' + tvdbId + '-' + seasonNum)?.value.trim() || '';
      const season = overridesData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      if (anilistVal) {
        const parsed = parseInt(anilistVal, 10);
        if (Number.isInteger(parsed)) {
          for (const [epNum, ep] of Object.entries(season.episodes)) {
            ep.anilistId = parsed;
            delete ep.skipAniList;
          }
          markDirty(tvdbId);
          renderSeriesCards();
          showToast('Applied AniList ID ' + parsed + ' to ' + (seasonNum === '0' ? 'Specials' : 'Season ' + seasonNum), 'success');
        }
      }
    }

    function markDirty(tvdbId) {
      dirtyShows.add(tvdbId);
      const card = document.getElementById('card-' + tvdbId);
      if (card) card.classList.add('modified');
      const saveBtn = document.getElementById('save-btn-' + tvdbId);
      if (saveBtn) saveBtn.style.opacity = '1';

      updateStats();
      const saveBanner = document.getElementById('save-banner');
      saveBanner.classList.add('show');
      document.getElementById('save-banner-text').innerText = dirtyShows.size + ' show(s) modified';
    }

    async function saveShow(tvdbId) {
      const show = overridesData[tvdbId];
      if (!show) return;

      try {
        const res = await fetch('/api/overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tvdbId, show })
        });
        if (!res.ok) throw new Error('Save failed');

        dirtyShows.delete(tvdbId);
        const card = document.getElementById('card-' + tvdbId);
        if (card) card.classList.remove('modified');
        const saveBtn = document.getElementById('save-btn-' + tvdbId);
        if (saveBtn) saveBtn.style.opacity = '0.6';

        if (dirtyShows.size === 0) {
          document.getElementById('save-banner').classList.remove('show');
        } else {
          document.getElementById('save-banner-text').innerText = dirtyShows.size + ' show(s) modified';
        }

        showToast('Saved ' + (show.title || tvdbId), 'success');
      } catch (err) {
        showToast('Error saving: ' + err.message, 'error');
      }
    }

    async function saveAllChanges() {
      try {
        const res = await fetch('/api/overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overrides: overridesData })
        });
        if (!res.ok) throw new Error('Failed to save all changes');

        dirtyShows.clear();
        document.querySelectorAll('.series-card.modified').forEach(c => c.classList.remove('modified'));
        document.getElementById('save-banner').classList.remove('show');
        showToast('All mapping overrides saved successfully!', 'success');
      } catch (err) {
        showToast('Error saving: ' + err.message, 'error');
      }
    }

    function showToast(msg, type) {
      const toast = document.getElementById('toast');
      toast.className = 'toast ' + type;
      toast.innerText = msg;
      setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function handleSearch() {
      searchQuery = document.getElementById('search-input').value;
      renderSeriesCards();
    }

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      renderSeriesCards();
    }

    function setSort(sortVal) {
      currentSort = sortVal;
      const select = document.getElementById('sort-select');
      if (select) select.value = sortVal;
      renderSeriesCards();
    }

    // Initialize
    loadOverrides();
  </script>
</body>
</html>`;
};

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
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.9rem 1.1rem; cursor: pointer; transition: all 0.2s; }
    .stat-card:hover { border-color: var(--accent); background: rgba(56, 189, 248, 0.04); }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.25rem; }
    .stat-val { font-size: 1.4rem; font-weight: 700; color: #fff; }
    .stat-val.warning { color: var(--warning); }
    .stat-val.success { color: var(--success); }
    .stat-val.anilist { color: #f472b6; }

    /* Controls Bar */
    .controls-bar { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.85rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .search-box { flex: 1; min-width: 250px; position: relative; }
    .search-box input { width: 100%; background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.6rem 0.85rem 0.6rem 2.2rem; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
    .search-box input:focus { border-color: var(--accent); }
    .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem; }

    .filter-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
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
    .badge-anilist { background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); }
    .badge-anidb { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }

    .series-actions { display: flex; align-items: center; gap: 0.6rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.45rem 0.9rem; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: var(--accent); color: #0b0f19; }
    .btn-primary:hover { background: var(--accent-hover); color: #fff; }
    .btn-secondary { background: rgba(255, 255, 255, 0.08); color: #f1f5f9; border: 1px solid rgba(255, 255, 255, 0.1); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
    .btn-sm { padding: 0.35rem 0.65rem; font-size: 0.78rem; }
    .btn-danger { background: var(--danger-bg); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }

    .chevron { transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); }
    .chevron.open { transform: rotate(180deg); }

    /* Series Body */
    .series-body { padding: 1.25rem; display: none; border-top: 1px solid var(--card-border); background: #0e1422; }
    .series-body.open { display: block; }

    /* Season Section */
    .season-section { margin-bottom: 1.25rem; }
    .season-section:last-child { margin-bottom: 0; }
    .season-header { font-size: 0.92rem; font-weight: 700; color: #fff; margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between; }
    
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
    .ep-table tr.row-highlight-anidb { background: rgba(245, 158, 11, 0.07); }
    .ep-table tr.row-highlight-anidb td:first-child { border-left: 3px solid #f59e0b; }

    .ep-num { font-weight: 700; color: #fff; width: 60px; }
    .ep-name { max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #cbd5e1; }
    .ep-name:hover { white-space: normal; word-break: break-word; }

    .id-input-group { display: flex; align-items: center; gap: 0.35rem; }
    .id-input { background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.84rem; width: 110px; font-family: monospace; outline: none; transition: border-color 0.15s; }
    .id-input.null-val { color: #64748b; font-style: italic; }
    .id-input:focus { border-color: var(--accent); }
    .ep-sub-input { width: 55px; }

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
      <p>Fill in missing AniDB & AniList IDs or leave null to explicitly skip that flow</p>
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
      <div class="stat-card" onclick="setFilter('has-nulls')" title="Filter by Shows with nulls">
        <div class="stat-label">Episodes with nulls</div>
        <div class="stat-val warning" id="stat-null-episodes">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('missing-anidb')" title="Filter by Missing AniDB">
        <div class="stat-label">Missing AniDB (null)</div>
        <div class="stat-val" id="stat-missing-anidb">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('missing-anilist')" title="Filter by Only Missing AniList">
        <div class="stat-label">Missing AniList (null)</div>
        <div class="stat-val anilist" id="stat-missing-anilist">-</div>
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
      <div class="filter-tabs">
        <button class="filter-btn active" data-filter="all" onclick="setFilter('all')">All Shows</button>
        <button class="filter-btn" data-filter="has-nulls" onclick="setFilter('has-nulls')">Has nulls</button>
        <button class="filter-btn" data-filter="missing-anilist" onclick="setFilter('missing-anilist')">🌸 Only Missing AniList</button>
        <button class="filter-btn" data-filter="missing-anidb" onclick="setFilter('missing-anidb')">⚡ Missing AniDB</button>
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
    let searchQuery = '';
    let allExpanded = false;

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

    function updateStats() {
      let totalShows = 0;
      let totalEpisodes = 0;
      let nullEpisodes = 0;
      let missingAniDb = 0;
      let missingAniList = 0;
      let fullyMapped = 0;

      for (const [tvdbId, show] of Object.entries(overridesData)) {
        totalShows++;
        for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
          for (const [epNum, ep] of Object.entries(season.episodes || {})) {
            totalEpisodes++;
            const isAniDbNull = ep.anidbId === null || ep.anidbId === undefined || ep.anidbId === '';
            const isAniListNull = ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '';
            
            if (isAniDbNull) missingAniDb++;
            if (isAniListNull) missingAniList++;

            if (isAniDbNull || isAniListNull) {
              nullEpisodes++;
            } else {
              fullyMapped++;
            }
          }
        }
      }

      document.getElementById('stat-total-shows').innerText = totalShows;
      document.getElementById('stat-null-episodes').innerText = nullEpisodes;
      document.getElementById('stat-missing-anidb').innerText = missingAniDb;
      document.getElementById('stat-missing-anilist').innerText = missingAniList;
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

    function renderSeriesCards() {
      const container = document.getElementById('series-container');
      const entries = Object.entries(overridesData);

      if (entries.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No overrides found in mapping-overrides.json.</div>';
        return;
      }

      // Filter and search
      const filtered = entries.filter(([tvdbId, show]) => {
        const titleMatch = (show.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || tvdbId.includes(searchQuery);
        if (!titleMatch) return false;

        if (currentFilter === 'has-nulls') {
          return hasNullsInShow(show);
        } else if (currentFilter === 'missing-anilist') {
          return hasMissingAniListInShow(show);
        } else if (currentFilter === 'missing-anidb') {
          return hasMissingAniDbInShow(show);
        } else if (currentFilter === 'complete') {
          return !hasNullsInShow(show);
        }
        return true;
      });

      if (filtered.length === 0) {
        let emptyMsg = 'No series match your search or filter.';
        if (currentFilter === 'missing-anilist') {
          emptyMsg = '🌸 No series are currently missing AniList mappings!';
        } else if (currentFilter === 'missing-anidb') {
          emptyMsg = '⚡ No series are currently missing AniDB mappings!';
        } else if (currentFilter === 'complete') {
          emptyMsg = 'No completed series yet. Fill in missing AniDB and AniList IDs above.';
        }
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">' + emptyMsg + '</div>';
        return;
      }

      container.innerHTML = filtered.map(([tvdbId, show]) => renderShowCard(tvdbId, show)).join('');
    }

    function hasNullsInShow(show) {
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anidbId === null || ep.anidbId === '' || ep.anilistId === null || ep.anilistId === '') {
            return true;
          }
        }
      }
      return false;
    }

    function countNullsInShow(show) {
      let count = 0;
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anidbId === null || ep.anidbId === '' || ep.anilistId === null || ep.anilistId === '') {
            count++;
          }
        }
      }
      return count;
    }

    function hasMissingAniListInShow(show) {
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anilistId === null || ep.anilistId === '' || ep.anilistId === undefined) {
            return true;
          }
        }
      }
      return false;
    }

    function hasMissingAniDbInShow(show) {
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anidbId === null || ep.anidbId === '' || ep.anidbId === undefined) {
            return true;
          }
        }
      }
      return false;
    }

    function countMissingAniListInShow(show) {
      let count = 0;
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anilistId === null || ep.anilistId === '' || ep.anilistId === undefined) {
            count++;
          }
        }
      }
      return count;
    }

    function countMissingAniDbInShow(show) {
      let count = 0;
      for (const season of Object.values(show.seasons || {})) {
        for (const ep of Object.values(season.episodes || {})) {
          if (ep.anidbId === null || ep.anidbId === '' || ep.anidbId === undefined) {
            count++;
          }
        }
      }
      return count;
    }

    function renderShowCard(tvdbId, show) {
      const nullCount = countNullsInShow(show);
      const aniListNulls = countMissingAniListInShow(show);
      const aniDbNulls = countMissingAniDbInShow(show);
      const isModified = dirtyShows.has(tvdbId);
      const cleanTitle = show.title || 'Unknown Title';
      const encodedTitle = encodeURIComponent(cleanTitle);

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
                \${nullCount > 0 ? \`<span class="badge badge-missing">\${nullCount} nulls</span>\` : \`<span class="badge badge-ok">✓ Completed</span>\`}
                \${aniListNulls > 0 ? \`<span class="badge badge-anilist" title="\${aniListNulls} episode(s) missing AniList">🌸 \${aniListNulls} AniList null</span>\` : ''}
                \${aniDbNulls > 0 && currentFilter === 'missing-anidb' ? \`<span class="badge badge-anidb" title="\${aniDbNulls} episode(s) missing AniDB">⚡ \${aniDbNulls} AniDB null</span>\` : ''}
              </div>
              <div class="series-badges" onclick="event.stopPropagation()">
                <a href="https://thetvdb.com/dereferrer/series/\${tvdbId}" target="_blank" class="badge badge-tvdb">TVDB: \${tvdbId} ↗</a>
                \${show.tmdbId ? \`<a href="https://www.themoviedb.org/tv/\${show.tmdbId}" target="_blank" class="badge badge-tmdb">TMDB: \${show.tmdbId} ↗</a>\` : ''}
                <a href="https://anidb.net/anime/?adb.search=\${encodedTitle}" target="_blank" class="badge badge-search">🔍 AniDB ↗</a>
                <a href="https://anilist.co/search/anime?search=\${encodedTitle}" target="_blank" class="badge badge-search" style="color: var(--anilist);">🌸 AniList ↗</a>
              </div>
            </div>
            <div class="series-actions" onclick="event.stopPropagation()">
              <button class="btn btn-primary btn-sm" onclick="saveShow('\${tvdbId}')" id="save-btn-\${tvdbId}" \${isModified ? '' : 'style="opacity: 0.6;"'}>💾 Save</button>
              <span class="chevron" id="chevron-\${tvdbId}">▼</span>
            </div>
          </div>
          <div class="series-body" id="body-\${tvdbId}">
            \${seasonsHtml}
          </div>
        </div>
      \`;
    }

    function renderSeasonSection(tvdbId, seasonNum, season) {
      const label = seasonNum === '0' ? 'Season 0 (Specials)' : 'Season ' + seasonNum;
      const episodes = Object.entries(season.episodes || {}).sort(([a], [b]) => Number(a) - Number(b));
      const seasonAniListNulls = episodes.filter(([_, ep]) => ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '').length;
      const seasonAniDbNulls = episodes.filter(([_, ep]) => ep.anidbId === null || ep.anidbId === undefined || ep.anidbId === '').length;

      const rows = episodes.map(([epNum, ep]) => {
        const isAniDbNull = ep.anidbId === null || ep.anidbId === undefined || ep.anidbId === '';
        const isAniListNull = ep.anilistId === null || ep.anilistId === undefined || ep.anilistId === '';
        const cleanEpName = ep.name || ('Episode ' + epNum);

        let rowHighlight = '';
        if (currentFilter === 'missing-anilist' && isAniListNull) {
          rowHighlight = 'row-highlight-anilist';
        } else if (currentFilter === 'missing-anidb' && isAniDbNull) {
          rowHighlight = 'row-highlight-anidb';
        }

        return \`
          <tr class="\${rowHighlight}">
            <td class="ep-num">E\${epNum}</td>
            <td class="ep-name" title="\${escapeHtml(cleanEpName)}">\${escapeHtml(cleanEpName)}</td>
            <td>
              <div class="id-input-group">
                <input type="text" class="id-input \${isAniDbNull ? 'null-val' : ''}" 
                  id="anidb-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${isAniDbNull ? '' : escapeHtml(ep.anidbId)}" 
                  placeholder="null"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anidbId', this.value)"
                >
                <input type="number" class="id-input ep-sub-input" 
                  id="anidb-ep-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${ep.anidbEpisode ?? epNum}" 
                  title="AniDB Episode Number"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anidbEpisode', this.value)"
                >
                <button class="btn btn-secondary btn-sm" title="Set to null (skip Simkl)" onclick="setNull('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anidbId')">∅</button>
              </div>
            </td>
            <td>
              <div class="id-input-group">
                <input type="number" class="id-input \${isAniListNull ? 'null-val' : ''}" 
                  id="anilist-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${isAniListNull ? '' : escapeHtml(ep.anilistId)}" 
                  placeholder="null"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistId', this.value)"
                >
                <input type="number" class="id-input ep-sub-input" 
                  id="anilist-ep-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${ep.anilistEpisode ?? epNum}" 
                  title="AniList Episode Number"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistEpisode', this.value)"
                >
                <button class="btn btn-secondary btn-sm" title="Set to null (skip AniList)" onclick="setNull('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistId')">∅</button>
              </div>
            </td>
          </tr>
        \`;
      }).join('');

      return \`
        <div class="season-section">
          <div class="season-header">
            <span>\${label}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              \${episodes.length} episodes
              \${seasonAniListNulls > 0 ? \`· <span style="color: #f472b6; font-weight: 600;">🌸 \${seasonAniListNulls} missing AniList</span>\` : ''}
              \${seasonAniDbNulls > 0 && currentFilter === 'missing-anidb' ? \`· <span style="color: #fbbf24; font-weight: 600;">⚡ \${seasonAniDbNulls} missing AniDB</span>\` : ''}
            </span>
          </div>
          <div class="batch-fill-bar">
            <span>⚡ Batch Fill \${label}:</span>
            <input type="text" class="id-input" id="batch-anidb-\${tvdbId}-\${seasonNum}" placeholder="AniDB ID">
            <input type="number" class="id-input" id="batch-anilist-\${tvdbId}-\${seasonNum}" placeholder="AniList ID">
            <button class="btn btn-secondary btn-sm" onclick="applyBatchSeason('\${tvdbId}', '\${seasonNum}')">Apply to Season</button>
          </div>
          <table class="ep-table">
            <thead>
              <tr>
                <th>Ep</th>
                <th>Title</th>
                <th>AniDB (Simkl) [ID / Ep]</th>
                <th>AniList [ID / Ep]</th>
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
      } else {
        body.classList.add('open');
        chevron.classList.add('open');
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
    }

    function onFieldChange(tvdbId, seasonNum, epNum, field, val) {
      const ep = overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      if (!ep) return;

      if (field === 'anidbId') {
        const trimmed = val.trim();
        ep.anidbId = trimmed === '' || trimmed.toLowerCase() === 'null' ? null : trimmed;
        const input = document.getElementById('anidb-' + tvdbId + '-' + seasonNum + '-' + epNum);
        if (input) {
          if (ep.anidbId === null) input.classList.add('null-val');
          else input.classList.remove('null-val');
        }
      } else if (field === 'anilistId') {
        const trimmed = val.trim();
        const parsed = parseInt(trimmed, 10);
        ep.anilistId = trimmed === '' || trimmed.toLowerCase() === 'null' || !Number.isInteger(parsed) ? null : parsed;
        const input = document.getElementById('anilist-' + tvdbId + '-' + seasonNum + '-' + epNum);
        if (input) {
          if (ep.anilistId === null) input.classList.add('null-val');
          else input.classList.remove('null-val');
        }
      } else if (field === 'anidbEpisode') {
        const parsed = parseInt(val, 10);
        ep.anidbEpisode = Number.isInteger(parsed) ? parsed : null;
      } else if (field === 'anilistEpisode') {
        const parsed = parseInt(val, 10);
        ep.anilistEpisode = Number.isInteger(parsed) ? parsed : null;
      }

      markDirty(tvdbId);
    }

    function setNull(tvdbId, seasonNum, epNum, field) {
      const ep = overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      if (!ep) return;

      ep[field] = null;
      if (field === 'anidbId') {
        const input = document.getElementById('anidb-' + tvdbId + '-' + seasonNum + '-' + epNum);
        if (input) { input.value = ''; input.classList.add('null-val'); }
      } else if (field === 'anilistId') {
        const input = document.getElementById('anilist-' + tvdbId + '-' + seasonNum + '-' + epNum);
        if (input) { input.value = ''; input.classList.add('null-val'); }
      }

      markDirty(tvdbId);
    }

    function applyBatchSeason(tvdbId, seasonNum) {
      const anidbVal = document.getElementById('batch-anidb-' + tvdbId + '-' + seasonNum)?.value.trim() || '';
      const anilistVal = document.getElementById('batch-anilist-' + tvdbId + '-' + seasonNum)?.value.trim() || '';

      const season = overridesData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      for (const [epNum, ep] of Object.entries(season.episodes)) {
        if (anidbVal) {
          ep.anidbId = anidbVal;
          const input = document.getElementById('anidb-' + tvdbId + '-' + seasonNum + '-' + epNum);
          if (input) { input.value = anidbVal; input.classList.remove('null-val'); }
        }
        if (anilistVal) {
          const parsed = parseInt(anilistVal, 10);
          if (Number.isInteger(parsed)) {
            ep.anilistId = parsed;
            const input = document.getElementById('anilist-' + tvdbId + '-' + seasonNum + '-' + epNum);
            if (input) { input.value = parsed; input.classList.remove('null-val'); }
          }
        }
      }

      markDirty(tvdbId);
      showToast('Applied batch values to ' + (seasonNum === '0' ? 'Specials' : 'Season ' + seasonNum), 'success');
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

    // Initialize
    loadOverrides();
  </script>
</body>
</html>`;
};

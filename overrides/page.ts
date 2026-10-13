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
    .container { max-width: 1280px; width: 100%; display: flex; flex-direction: column; gap: 1.25rem; }
    
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
    .stat-val.anilist { color: var(--anilist-pink); }
    .stat-val.overridden { color: #fbbf24; }
    .stat-val.anilist-skipped { color: #c084fc; }
    .stat-val.success { color: var(--success); }

    /* Controls Bar */
    .controls-bar { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.85rem 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .search-box { flex: 1; min-width: 220px; position: relative; }
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
    .badge-custom { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-anilist-skipped { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }
    
    .badge-official { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-family: monospace; font-size: 0.78rem; text-decoration: none; padding: 0.2rem 0.5rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.3rem; }
    .badge-official:hover { background: rgba(56, 189, 248, 0.25); }
    .badge-none { background: rgba(255, 255, 255, 0.05); color: #64748b; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 6px; }

    .override-pill { display: inline-flex; align-items: center; padding: 0.15rem 0.45rem; border-radius: 5px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
    .override-pill.custom { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .override-pill.match { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .override-pill.using-official { background: rgba(56, 189, 248, 0.08); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.2); }
    .override-pill.missing { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .override-pill.skipped { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }

    .series-actions { display: flex; align-items: center; gap: 0.5rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.45rem 0.85rem; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; text-decoration: none; }
    .btn-primary { background: var(--accent); color: #0b0f19; }
    .btn-primary:hover { background: var(--accent-hover); color: #fff; }
    .btn-secondary { background: rgba(255, 255, 255, 0.06); color: var(--text); border: 1px solid var(--card-border); }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
    .btn-anilist-skipped { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }
    .btn-anilist-skipped:hover { background: rgba(192, 132, 252, 0.25); color: #e9d5ff; }
    .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
    .btn-xs { padding: 0.2rem 0.45rem; font-size: 0.72rem; }
    .chevron { transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); }
    .chevron.open { transform: rotate(180deg); }

    /* Series Body / Episodes Table */
    .series-body { display: none; padding: 1.25rem; border-top: 1px solid var(--card-border); background: #0e1422; }
    .series-body.open { display: block; }

    .season-section { margin-bottom: 1.5rem; }
    .season-section:last-child { margin-bottom: 0; }
    .season-header { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.4rem; }
    
    .batch-fill-bar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; background: rgba(255, 255, 255, 0.02); padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04); flex-wrap: wrap; }
    .batch-fill-bar span { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; }

    .ep-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
    .ep-table th { text-align: left; padding: 0.5rem 0.6rem; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--card-border); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .ep-table td { padding: 0.5rem 0.6rem; border-bottom: 1px solid rgba(255, 255, 255, 0.03); vertical-align: middle; }
    .ep-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
    
    .ep-table tr.missing-anilist-row td { background: rgba(244, 114, 182, 0.04); }
    .ep-table tr.overridden-row td { background: rgba(245, 158, 11, 0.04); }
    .ep-table tr.skipped-anilist-row td { background: rgba(192, 132, 252, 0.04); }

    .ep-num { font-weight: 700; color: #fff; width: 45px; }
    .ep-name { color: var(--text); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .id-input-group { display: flex; align-items: center; gap: 0.4rem; }
    .id-input { background: var(--input-bg); border: 1px solid var(--card-border); color: #fff; padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.82rem; font-family: monospace; width: 110px; outline: none; transition: border-color 0.2s; }
    .id-input:focus { border-color: var(--accent); }
    .id-input.null-val { color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
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
        <div class="stat-label">Total Shows in Library</div>
        <div class="stat-val" id="stat-total-shows">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('missing-anilist'); setSort('missing-desc');" title="Filter by Only Missing AniList & Sort by Most Missing">
        <div class="stat-label">Missing AniList (Unmapped)</div>
        <div class="stat-val anilist" id="stat-missing-anilist">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('overridden'); setSort('overridden-desc');" title="Filter by Shows with Custom Overrides">
        <div class="stat-label">Custom Overrides Set</div>
        <div class="stat-val overridden" id="stat-overridden">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('skipped-anilist')" title="Filter by Shows with Skipped AniList Episodes">
        <div class="stat-label">Skipped AniList Episodes</div>
        <div class="stat-val anilist-skipped" id="stat-skipped-anilist">-</div>
      </div>
      <div class="stat-card" onclick="setFilter('complete')" title="Filter by Fully Completed Shows">
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
          <option value="overridden-desc">⚡ Most Custom Overrides</option>
          <option value="missing-asc">Least Missing AniList</option>
          <option value="title-asc">Title (A → Z)</option>
          <option value="default">Default (TVDB ID)</option>
        </select>
      </div>
      <div class="filter-tabs">
        <button class="filter-btn active" data-filter="all" onclick="setFilter('all')">All Shows</button>
        <button class="filter-btn" data-filter="missing-anilist" onclick="setFilter('missing-anilist')">🌸 Only Missing AniList</button>
        <button class="filter-btn" data-filter="overridden" onclick="setFilter('overridden')">⚡ Custom Overrides</button>
        <button class="filter-btn" data-filter="skipped-anilist" onclick="setFilter('skipped-anilist')">🌸 Skipped AniList</button>
        <button class="filter-btn" data-filter="complete" onclick="setFilter('complete')">Completed</button>
        <button class="btn btn-secondary btn-sm" onclick="syncJellyfinCatalog()" id="sync-btn" title="Scan Jellyfin anime libraries and refresh catalog cache">🔄 Sync Library</button>
        <button class="btn btn-secondary btn-sm" onclick="retireRedundantOverrides()" id="retire-btn" title="Retire custom overrides that are 100% identical to official AniBridge mappings">🧹 Retire Redundant</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleAllCards()" id="toggle-all-btn">Expand All</button>
      </div>
    </div>

    <!-- Series Cards Container -->
    <div class="series-list" id="series-container">
      <div class="loading-spinner">Loading anime catalog and overrides...</div>
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
    let catalogData = {};
    let overridesData = {};
    let officialData = {};
    let lastUpdated = '';
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
        catalogData = data.catalog || {};
        overridesData = data.overrides || {};
        officialData = data.official || {};
        lastUpdated = data.lastUpdated || '';
        updateStats();
        renderSeriesCards();
      } catch (err) {
        document.getElementById('series-container').innerHTML = 
          '<div style="color: #f87171; text-align: center; padding: 2rem;">Error loading overrides: ' + err.message + '</div>';
      }
    }

    async function syncJellyfinCatalog() {
      const btn = document.getElementById('sync-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '🔄 Syncing Library...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/catalog/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Sync failed');
        }

        const s = data.summary;
        showToast(
          'Library synced! Found ' + s.catalogShowsCount + ' shows and ' + s.catalogEpisodesCount + ' episodes.',
          'success'
        );
        await loadOverrides();
      } catch (err) {
        showToast('Sync error: ' + err.message, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    async function retireRedundantOverrides() {
      const confirmed = confirm('Check and retire custom overrides that are 100% identical to official AniBridge mappings?\\n\\nExplicit skips and explicit unmapped nulls will NOT be touched. A timestamped backup will be created automatically.');
      if (!confirmed) return;

      const btn = document.getElementById('retire-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '🧹 Retiring...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/overrides/retire-redundant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to retire redundant overrides');
        }

        const s = data.summary;
        if (s.retiredCount > 0) {
          showToast(
            'Retired ' + s.retiredCount + ' redundant override(s) across ' + s.affectedShowsCount + ' show(s)!',
            'success'
          );
        } else {
          showToast('No redundant overrides found. All custom overrides diverge from official mappings.', 'success');
        }
        await loadOverrides();
      } catch (err) {
        showToast('Retire error: ' + err.message, 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    function getOfficialEp(tvdbId, seasonNum, epNum) {
      return officialData[tvdbId]?.[seasonNum]?.[epNum] || null;
    }

    function getOverrideEp(tvdbId, seasonNum, epNum) {
      return overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum] || null;
    }

    function ensureEpisodeInOverrides(tvdbId, seasonNum, epNum) {
      if (!overridesData[tvdbId]) {
        const catShow = catalogData[tvdbId] || {};
        overridesData[tvdbId] = {
          title: catShow.title,
          tmdbId: catShow.tmdbId,
          seasons: {},
        };
      }
      if (!overridesData[tvdbId].seasons) {
        overridesData[tvdbId].seasons = {};
      }
      if (!overridesData[tvdbId].seasons[seasonNum]) {
        overridesData[tvdbId].seasons[seasonNum] = { episodes: {} };
      }
      if (!overridesData[tvdbId].seasons[seasonNum].episodes) {
        overridesData[tvdbId].seasons[seasonNum].episodes = {};
      }
      if (!overridesData[tvdbId].seasons[seasonNum].episodes[epNum]) {
        const catEp = catalogData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum] || {};
        overridesData[tvdbId].seasons[seasonNum].episodes[epNum] = {
          name: catEp.name,
        };
      }
      return overridesData[tvdbId].seasons[seasonNum].episodes[epNum];
    }

    function isEpMissingAniList(tvdbId, seasonNum, epNum) {
      const override = getOverrideEp(tvdbId, seasonNum, epNum);
      if (override?.skipAniList) return false;
      if (typeof override?.anilistId === 'number') return false;
      if (override?.anilistId === null) return true;
      const off = getOfficialEp(tvdbId, seasonNum, epNum);
      return !off;
    }

    function isEpOverridden(tvdbId, seasonNum, epNum) {
      const override = getOverrideEp(tvdbId, seasonNum, epNum);
      if (override?.skipAniList) return false;
      if (typeof override?.anilistId === 'number') {
        const off = getOfficialEp(tvdbId, seasonNum, epNum);
        return !off || off.anilistId !== override.anilistId || off.anilistEpisode !== override.anilistEpisode;
      }
      return false;
    }

    function isEpSkipped(tvdbId, seasonNum, epNum) {
      const override = getOverrideEp(tvdbId, seasonNum, epNum);
      return Boolean(override?.skipAniList);
    }

    function updateStats() {
      let totalShows = 0;
      let missingAniList = 0;
      let overriddenCount = 0;
      let skippedAniList = 0;
      let fullyMapped = 0;

      for (const [tvdbId, show] of Object.entries(catalogData)) {
        totalShows++;
        for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
          for (const [epNum] of Object.entries(season.episodes || {})) {
            if (isEpSkipped(tvdbId, seasonNum, epNum)) {
              skippedAniList++;
            } else if (isEpMissingAniList(tvdbId, seasonNum, epNum)) {
              missingAniList++;
            } else {
              fullyMapped++;
            }

            if (isEpOverridden(tvdbId, seasonNum, epNum)) {
              overriddenCount++;
            }
          }
        }
      }

      document.getElementById('stat-total-shows').innerText = totalShows;
      document.getElementById('stat-missing-anilist').innerText = missingAniList;
      document.getElementById('stat-overridden').innerText = overriddenCount;
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

    function countMissingAniListInShow(tvdbId, show) {
      let count = 0;
      for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
        for (const [epNum] of Object.entries(season.episodes || {})) {
          if (isEpMissingAniList(tvdbId, seasonNum, epNum)) {
            count++;
          }
        }
      }
      return count;
    }

    function countOverriddenInShow(tvdbId, show) {
      let count = 0;
      for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
        for (const [epNum] of Object.entries(season.episodes || {})) {
          if (isEpOverridden(tvdbId, seasonNum, epNum)) {
            count++;
          }
        }
      }
      return count;
    }

    function countSkippedAniListInShow(tvdbId, show) {
      let count = 0;
      for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
        for (const [epNum] of Object.entries(season.episodes || {})) {
          if (isEpSkipped(tvdbId, seasonNum, epNum)) {
            count++;
          }
        }
      }
      return count;
    }

    function renderSeriesCards() {
      const container = document.getElementById('series-container');
      const entries = Object.entries(catalogData);

      if (entries.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No anime catalog found. Click <strong>"🔄 Sync Library"</strong> to scan your Jellyfin anime libraries.</div>';
        return;
      }

      // Filter and search
      let filtered = entries.filter(([tvdbId, show]) => {
        const titleMatch = (show.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || tvdbId.includes(searchQuery);
        if (!titleMatch) return false;

        if (currentFilter === 'missing-anilist') {
          return countMissingAniListInShow(tvdbId, show) > 0;
        } else if (currentFilter === 'overridden') {
          return countOverriddenInShow(tvdbId, show) > 0;
        } else if (currentFilter === 'skipped-anilist') {
          return countSkippedAniListInShow(tvdbId, show) > 0;
        } else if (currentFilter === 'complete') {
          return countMissingAniListInShow(tvdbId, show) === 0;
        }
        return true;
      });

      // Sort
      filtered.sort(([idA, showA], [idB, showB]) => {
        if (currentSort === 'missing-desc') {
          const diff = countMissingAniListInShow(idB, showB) - countMissingAniListInShow(idA, showA);
          if (diff !== 0) return diff;
          return (showA.title || '').localeCompare(showB.title || '');
        } else if (currentSort === 'overridden-desc') {
          const diff = countOverriddenInShow(idB, showB) - countOverriddenInShow(idA, showA);
          if (diff !== 0) return diff;
          return (showA.title || '').localeCompare(showB.title || '');
        } else if (currentSort === 'missing-asc') {
          const diff = countMissingAniListInShow(idA, showA) - countMissingAniListInShow(idB, showB);
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
        } else if (currentFilter === 'overridden') {
          emptyMsg = '⚡ No series currently have custom overrides.';
        } else if (currentFilter === 'skipped-anilist') {
          emptyMsg = '🌸 No series currently have skipped AniList episodes.';
        } else if (currentFilter === 'complete') {
          emptyMsg = 'No series are completely mapped yet.';
        }
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">' + emptyMsg + '</div>';
        return;
      }

      container.innerHTML = filtered.map(([tvdbId, show]) => {
        const isModified = dirtyShows.has(tvdbId);
        const isOpen = allExpanded || openCards.has(tvdbId);
        const missingCount = countMissingAniListInShow(tvdbId, show);
        const overriddenCount = countOverriddenInShow(tvdbId, show);
        const skippedCount = countSkippedAniListInShow(tvdbId, show);
        const searchUrl = 'https://anilist.co/search/anime?search=' + encodeURIComponent(show.title || '');
        const tvdbUrl = 'https://thetvdb.com/dereferrer/series/' + tvdbId;

        // Count total episodes in catalog
        let totalEps = 0;
        for (const season of Object.values(show.seasons || {})) {
          totalEps += Object.keys(season.episodes || {}).length;
        }

        const seasonsHtml = Object.entries(show.seasons || {})
          .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
          .map(([seasonNum, season]) => renderSeasonSection(tvdbId, seasonNum, season))
          .join('');

        return \`
          <div class="series-card \${isModified ? 'modified' : ''}" id="card-\${tvdbId}">
            <div class="series-header" onclick="toggleCard('\${tvdbId}')">
              <div class="series-title-group">
                <div class="series-title">
                  \${escapeHtml(show.title || 'Unknown Title')}
                  \${isModified ? '<span style="color: var(--warning); font-size: 0.8rem;">● Modified</span>' : ''}
                </div>
                <div class="series-badges">
                  <a href="\${tvdbUrl}" target="_blank" class="badge badge-tvdb" onclick="event.stopPropagation();" title="View series on TheTVDB">
                    TVDB \${tvdbId} ↗
                  </a>
                  \${show.tmdbId ? \`<span class="badge badge-tmdb">TMDB \${show.tmdbId}</span>\` : ''}
                  <a href="\${searchUrl}" target="_blank" class="badge badge-search" onclick="event.stopPropagation();" title="Search series on AniList">
                    🌸 Search AniList ↗
                  </a>
                  \${missingCount > 0 
                    ? \`<span class="badge badge-missing">🌸 \${missingCount} Missing AniList</span>\` 
                    : \`<span class="badge badge-ok">✓ \${totalEps} Mapped</span>\`}
                  \${overriddenCount > 0 
                    ? \`<span class="badge badge-custom">⚡ \${overriddenCount} Custom Overrides</span>\` 
                    : ''}
                  \${skippedCount > 0 
                    ? \`<span class="badge badge-anilist-skipped">🌸 \${skippedCount} Skipped</span>\` 
                    : ''}
                </div>
              </div>
              <div class="series-actions">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); saveShow('\${tvdbId}')" id="save-btn-\${tvdbId}" style="\${isModified ? 'opacity: 1;' : 'opacity: 0.6;'}">
                  💾 Save
                </button>
                <span class="chevron \${isOpen ? 'open' : ''}" id="chevron-\${tvdbId}">▼</span>
              </div>
            </div>
            <div class="series-body \${isOpen ? 'open' : ''}" id="body-\${tvdbId}">
              \${seasonsHtml}
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderSeasonSection(tvdbId, seasonNum, season) {
      const episodes = Object.entries(season.episodes || {})
        .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10));

      let seasonMissing = 0;
      let seasonOverridden = 0;
      let seasonSkipped = 0;

      for (const [epNum] of episodes) {
        if (isEpSkipped(tvdbId, seasonNum, epNum)) {
          seasonSkipped++;
        } else if (isEpMissingAniList(tvdbId, seasonNum, epNum)) {
          seasonMissing++;
        }
        if (isEpOverridden(tvdbId, seasonNum, epNum)) {
          seasonOverridden++;
        }
      }

      const isSeasonAllSkipped = seasonSkipped === episodes.length && episodes.length > 0;
      const label = seasonNum === '0' ? 'Specials (Season 0)' : 'Season ' + seasonNum;

      const rows = episodes.map(([epNum, catEp]) => {
        const cleanEpName = catEp.name || ('Episode ' + epNum);
        const override = getOverrideEp(tvdbId, seasonNum, epNum);
        const off = getOfficialEp(tvdbId, seasonNum, epNum);
        const isAniListSkipped = Boolean(override?.skipAniList);
        const isMissingAniList = isEpMissingAniList(tvdbId, seasonNum, epNum);
        const isOverridden = isEpOverridden(tvdbId, seasonNum, epNum);

        let rowHighlight = '';
        if (isAniListSkipped) {
          rowHighlight = 'skipped-anilist-row';
        } else if (isMissingAniList) {
          rowHighlight = 'missing-anilist-row';
        } else if (isOverridden) {
          rowHighlight = 'overridden-row';
        }

        // Official AniList Badge
        let officialDisplay = '';
        if (off) {
          officialDisplay = \`
            <a href="https://anilist.co/anime/\${off.anilistId}" target="_blank" class="badge-official" title="Official AniBridge / AnimeList mapping">
              🌸 \${off.anilistId} <span style="opacity: 0.8; font-weight: normal;">Ep \${off.anilistEpisode}</span> ↗
            </a>
          \`;
        } else {
          officialDisplay = '<span class="badge-none">None / Unmapped</span>';
        }

        // Override AniList Badge & Inputs
        let statusPill = '';
        let inputPlaceholder = '';
        let inputClass = '';

        if (isAniListSkipped) {
          statusPill = \`<span class="override-pill skipped" title="AniList scrobbling skipped for this episode">🌸 Skipped</span>\`;
          inputPlaceholder = 'skipped';
        } else if (override && typeof override.anilistId === 'number') {
          if (off && off.anilistId === override.anilistId && off.anilistEpisode === override.anilistEpisode) {
            statusPill = \`<span class="override-pill match" title="Matches official AniList mapping">✓ Matches Official</span>\`;
          } else {
            statusPill = \`<span class="override-pill custom" title="Manual override set (differs from official)">⚡ Overridden</span>\`;
          }
        } else if (override && override.anilistId === null) {
          statusPill = \`<span class="override-pill missing" title="Explicitly unmapped">∅ Missing</span>\`;
          inputPlaceholder = 'null';
          inputClass = 'null-val';
        } else {
          // No override in mapping-overrides.json
          if (off) {
            statusPill = \`<span class="override-pill using-official" title="Using official mapping (\${off.anilistId})">✓ Using Official</span>\`;
            inputPlaceholder = String(off.anilistId);
          } else {
            statusPill = \`<span class="override-pill missing" title="No AniList mapping exists">🌸 Missing</span>\`;
            inputPlaceholder = 'null';
            inputClass = 'null-val';
          }
        }

        const overrideVal = (override && typeof override.anilistId === 'number') ? override.anilistId : '';
        const overrideEpVal = override?.anilistEpisode ?? (off ? off.anilistEpisode : epNum);

        return \`
          <tr class="\${rowHighlight}">
            <td class="ep-num">E\${epNum}</td>
            <td class="ep-name" title="\${escapeHtml(cleanEpName)}">\${escapeHtml(cleanEpName)}</td>
            <td>\${officialDisplay}</td>
            <td>
              <div class="id-input-group">
                <input type="number" class="id-input \${inputClass}" 
                  id="anilist-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${overrideVal}" 
                  placeholder="\${inputPlaceholder}"
                  title="Override AniList Media ID (leave blank to use official mapping)"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistId', this.value)"
                >
                <input type="number" class="id-input ep-sub-input" 
                  id="anilist-ep-\${tvdbId}-\${seasonNum}-\${epNum}" 
                  value="\${overrideEpVal}" 
                  title="AniList Episode Number"
                  onchange="onFieldChange('\${tvdbId}', '\${seasonNum}', '\${epNum}', 'anilistEpisode', this.value)"
                >
                \${statusPill}
              </div>
            </td>
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center; justify-content: center;">
                \${off ? \`<button class="btn btn-secondary btn-xs" onclick="useOfficial('\${tvdbId}', '\${seasonNum}', '\${epNum}')" title="Copy official AniList ID to override fields">📋 Official</button>\` : ''}
                <button class="btn btn-sm \${isAniListSkipped ? 'btn-anilist-skipped' : 'btn-secondary'}" 
                  onclick="toggleEpSkipAniList('\${tvdbId}', '\${seasonNum}', '\${epNum}')" 
                  title="\${isAniListSkipped ? 'AniList skipped. Click to unskip.' : 'Skip AniList for this episode (will use TVDB for Simkl)'}">
                  🌸 \${isAniListSkipped ? 'Skipped' : 'Skip'}
                </button>
                <button class="btn btn-secondary btn-sm" 
                  onclick="clearOverride('\${tvdbId}', '\${seasonNum}', '\${epNum}')" 
                  title="Clear override (defaults to official mapping, or null if unmapped)">∅ Clear</button>
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
              \${seasonOverridden > 0 ? \`· <span style="color: #fbbf24; font-weight: 600;">⚡ \${seasonOverridden} overridden</span>\` : ''}
              \${seasonSkipped > 0 && !isSeasonAllSkipped ? \`· <span style="color: #c084fc;">🌸 \${seasonSkipped} skipped</span>\` : ''}
            </span>
          </div>
          <div class="batch-fill-bar">
            <span>🌸 Batch Fill \${label}:</span>
            <input type="number" class="id-input" id="batch-anilist-\${tvdbId}-\${seasonNum}" placeholder="AniList ID" style="max-width: 140px;">
            <button class="btn btn-secondary btn-sm" onclick="applyBatchSeason('\${tvdbId}', '\${seasonNum}')">Apply to Season</button>
            <button class="btn btn-secondary btn-sm" onclick="applyOfficialSeason('\${tvdbId}', '\${seasonNum}')" title="Copy official AniList mappings for all episodes in this season">📋 Apply Official to Season</button>
            <button class="btn btn-secondary btn-sm" onclick="skipUnmappedSeasonAniList('\${tvdbId}', '\${seasonNum}')" title="Mark all unmapped episodes in this season as skipped for AniList">🌸 Skip Unmapped</button>
          </div>
          <table class="ep-table">
            <thead>
              <tr>
                <th style="width: 55px;">Ep</th>
                <th style="min-width: 220px;">Title</th>
                <th style="width: 190px;">Official AniList</th>
                <th style="width: 270px;">Override AniList</th>
                <th style="width: 180px; text-align: center;">Actions</th>
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
      const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);

      if (field === 'anilistId') {
        const trimmed = val.trim();
        if (trimmed === '') {
          delete ep.anilistId;
          // If no other fields remain, remove episode
          if (!ep.skipAniList && ep.anilistEpisode === undefined) {
            delete overridesData[tvdbId].seasons[seasonNum].episodes[epNum];
          }
        } else if (trimmed.toLowerCase() === 'null') {
          ep.anilistId = null;
          delete ep.skipAniList;
        } else {
          const parsed = parseInt(trimmed, 10);
          ep.anilistId = Number.isInteger(parsed) ? parsed : null;
          delete ep.skipAniList;
        }
      } else if (field === 'anilistEpisode') {
        const parsed = parseInt(val, 10);
        ep.anilistEpisode = Number.isInteger(parsed) ? parsed : null;
      }

      markDirty(tvdbId);
      renderSeriesCards();
    }

    function useOfficial(tvdbId, seasonNum, epNum) {
      const off = getOfficialEp(tvdbId, seasonNum, epNum);
      if (!off) {
        showToast('No official mapping available for this episode', 'error');
        return;
      }

      const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);
      ep.anilistId = off.anilistId;
      ep.anilistEpisode = off.anilistEpisode;
      delete ep.skipAniList;

      markDirty(tvdbId);
      renderSeriesCards();
      showToast('Applied official AniList ' + off.anilistId + ' (Ep ' + off.anilistEpisode + ')', 'success');
    }

    function clearOverride(tvdbId, seasonNum, epNum) {
      const show = overridesData[tvdbId];
      if (show?.seasons?.[seasonNum]?.episodes?.[epNum]) {
        delete show.seasons[seasonNum].episodes[epNum];
        if (Object.keys(show.seasons[seasonNum].episodes).length === 0) {
          delete show.seasons[seasonNum];
        }
        if (Object.keys(show.seasons).length === 0) {
          delete overridesData[tvdbId];
        }
      }

      markDirty(tvdbId);
      renderSeriesCards();
      showToast('Override cleared (reverted to official mapping)', 'success');
    }

    function toggleEpSkipAniList(tvdbId, seasonNum, epNum) {
      const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);
      ep.skipAniList = !ep.skipAniList;
      if (!ep.skipAniList) {
        delete ep.skipAniList;
        // If episode has no anilistId override, clear it
        if (ep.anilistId === undefined) {
          delete overridesData[tvdbId].seasons[seasonNum].episodes[epNum];
        }
      }

      markDirty(tvdbId);
      renderSeriesCards();
    }

    function skipUnmappedSeasonAniList(tvdbId, seasonNum) {
      const season = catalogData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      let changed = 0;
      for (const [epNum] of Object.entries(season.episodes)) {
        if (!isEpSkipped(tvdbId, seasonNum, epNum) && isEpMissingAniList(tvdbId, seasonNum, epNum)) {
          const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);
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

    function applyBatchSeason(tvdbId, seasonNum) {
      const anilistVal = document.getElementById('batch-anilist-' + tvdbId + '-' + seasonNum)?.value.trim() || '';
      const season = catalogData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      if (anilistVal) {
        const parsed = parseInt(anilistVal, 10);
        if (Number.isInteger(parsed)) {
          for (const [epNum] of Object.entries(season.episodes)) {
            const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);
            ep.anilistId = parsed;
            delete ep.skipAniList;
          }
          markDirty(tvdbId);
          renderSeriesCards();
          showToast('Applied AniList ID ' + parsed + ' to ' + (seasonNum === '0' ? 'Specials' : 'Season ' + seasonNum), 'success');
        }
      }
    }

    function applyOfficialSeason(tvdbId, seasonNum) {
      const season = catalogData[tvdbId]?.seasons?.[seasonNum];
      if (!season || !season.episodes) return;

      let applied = 0;
      for (const [epNum] of Object.entries(season.episodes)) {
        const off = getOfficialEp(tvdbId, seasonNum, epNum);
        if (off) {
          const ep = ensureEpisodeInOverrides(tvdbId, seasonNum, epNum);
          ep.anilistId = off.anilistId;
          ep.anilistEpisode = off.anilistEpisode;
          delete ep.skipAniList;
          applied++;
        }
      }

      if (applied > 0) {
        markDirty(tvdbId);
        renderSeriesCards();
        showToast('Applied official AniList mappings to ' + applied + ' episode(s)', 'success');
      } else {
        showToast('No official mappings available for this season', 'error');
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
      const show = overridesData[tvdbId] || { title: '', seasons: {} };

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

        const catShow = catalogData[tvdbId];
        showToast('Saved ' + (catShow?.title || show.title || tvdbId), 'success');
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

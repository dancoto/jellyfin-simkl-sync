export interface ServiceConfigOptions {
  clientId?: string;
  hasClientSecret?: boolean;
  redirectUri?: string;
}

export interface PageOptions {
  // Backwards compatibility fields for Simkl
  clientId?: string;
  hasClientSecret?: boolean;
  redirectUri?: string;

  simkl?: ServiceConfigOptions;
  anilist?: ServiceConfigOptions;

  successUser?: string;
  successService?: string;
  errorMessage?: string;
}

export const renderAuthHtml = (options: PageOptions): string => {
  const simklClientId = options.simkl?.clientId ?? options.clientId ?? '';
  const simklHasSecret = options.simkl?.hasClientSecret ?? options.hasClientSecret ?? false;
  const simklRedirectUri = options.simkl?.redirectUri ?? options.redirectUri ?? '';

  const anilistClientId = options.anilist?.clientId ?? '';
  const anilistHasSecret = options.anilist?.hasClientSecret ?? false;
  const anilistRedirectUri = options.anilist?.redirectUri ?? '';

  const { successUser, successService, errorMessage } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jellyfin Tracker Sync - Authentication</title>
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
      --anilist-bg: rgba(2, 169, 255, 0.15);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 2rem 1rem; min-height: 100vh; display: flex; justify-content: center; }
    .container { max-width: 900px; width: 100%; display: flex; flex-direction: column; gap: 1.5rem; }
    header { text-align: center; margin-bottom: 0.5rem; }
    h1 { font-size: 1.8rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    header p { color: var(--text-muted); font-size: 0.95rem; }
    .card { background-color: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); }
    .card h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; color: #fff; display: flex; align-items: center; justify-content: space-between; }
    
    .alert { padding: 1rem; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .alert-success { background-color: var(--success-bg); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .alert-danger { background-color: var(--danger-bg); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
    .alert-warning { background-color: var(--warning-bg); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    
    .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.88rem; }
    .config-item { background: rgba(0,0,0,0.25); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
    .config-label { color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
    .config-val { font-family: monospace; font-size: 0.88rem; word-break: break-all; }
    
    .form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
    label { font-size: 0.88rem; color: var(--text-muted); font-weight: 500; }
    select, input[type="text"] { background-color: #0d1525; border: 1px solid var(--card-border); color: #fff; padding: 0.7rem 0.9rem; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border-color 0.2s; width: 100%; }
    select:focus, input[type="text"]:focus { border-color: var(--accent); }
    
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.7rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.92rem; text-decoration: none; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background-color: var(--accent); color: #0b0f19; }
    .btn-primary:hover { background-color: var(--accent-hover); color: #fff; }
    .btn-anilist { background-color: var(--anilist); color: #fff; }
    .btn-anilist:hover { background-color: var(--anilist-hover); color: #fff; }
    .btn-secondary { background-color: rgba(255, 255, 255, 0.08); color: #f1f5f9; }
    .btn-secondary:hover { background-color: rgba(255, 255, 255, 0.15); }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.82rem; }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 0.5rem; }
    th { text-align: left; padding: 0.75rem; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--card-border); font-size: 0.8rem; text-transform: uppercase; }
    td { padding: 0.9rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    
    .badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }
    .badge-success { background-color: var(--success-bg); color: #34d399; }
    .badge-danger { background-color: var(--danger-bg); color: #f87171; }
    .badge-warning { background-color: var(--warning-bg); color: #fbbf24; }
    .badge-secondary { background-color: rgba(255, 255, 255, 0.1); color: var(--text-muted); }
    .badge-anilist { background-color: var(--anilist-bg); color: #38bdf8; }
    .badge-dot { width: 6px; height: 6px; border-radius: 50%; background-color: currentColor; }
    
    .code-box { background: #000; padding: 0.6rem 0.8rem; border-radius: 6px; font-family: monospace; font-size: 0.82rem; color: #a5b4fc; display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
    .copy-btn { cursor: pointer; background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; }
    .copy-btn:hover { background: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>🎬</span> Jellyfin Tracker Sync</h1>
      <p>Authenticate and link Jellyfin user accounts to Simkl and AniList</p>
      <nav style="display: flex; justify-content: center; gap: 0.75rem; margin-top: 0.75rem;">
        <a href="/" class="btn btn-primary btn-sm"><span>👥</span> User Accounts</a>
        <a href="/overrides" class="btn btn-secondary btn-sm"><span>🌸</span> Mapping Overrides</a>
      </nav>
    </header>

    ${
      successUser
        ? `<div class="alert alert-success">
            <span>🎉</span>
            <div>Successfully connected <strong>${escapeHtml(successUser)}</strong> to ${successService === 'anilist' ? 'AniList' : 'Simkl'}! Watch events will now sync automatically.</div>
          </div>`
        : ''
    }

    ${
      errorMessage
        ? `<div class="alert alert-danger">
            <span>❌</span>
            <div><strong>Error:</strong> ${escapeHtml(errorMessage)}</div>
          </div>`
        : ''
    }

    ${
      !simklClientId
        ? `<div class="alert alert-danger">
            <span>⚠️</span>
            <div>
              <strong>Missing Simkl Client ID:</strong> You have not configured <code>client_id</code> in <code>config.toml</code> yet.
              Create an app at <a href="https://simkl.com/settings/developer/new/" target="_blank" style="color: #fef08a; text-decoration: underline;">simkl.com/settings/developer/new/</a> to obtain your client ID.
            </div>
          </div>`
        : !simklHasSecret
          ? `<div class="alert alert-warning">
              <span>ℹ️</span>
              <div>
                <strong>Simkl Client Secret:</strong> No <code>client_secret</code> found in <code>config.toml</code>. If your Simkl developer app was registered as a <em>Server app</em>, make sure to configure it.
              </div>
            </div>`
          : ''
    }

    <!-- Configuration Info Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem;">
      <!-- Simkl OAuth Card -->
      <div class="card">
        <h2><span>⚙️</span> Simkl OAuth Configuration</h2>
        <div class="config-grid">
          <div class="config-item">
            <div class="config-label">Client ID</div>
            <div class="config-val">${simklClientId ? escapeHtml(simklClientId.slice(0, 10)) + '...' : 'Not Set'}</div>
          </div>
          <div class="config-item">
            <div class="config-label">Client Secret</div>
            <div class="config-val">${simklHasSecret ? '✓ Configured' : 'Optional (Server apps)'}</div>
          </div>
          <div class="config-item" style="grid-column: 1 / -1;">
            <div class="config-label">Callback / Redirect URI (Add to Simkl Developer Settings)</div>
            <div class="code-box">
              <span id="simkl-redirect-uri-text">${escapeHtml(simklRedirectUri)}</span>
              <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('simkl-redirect-uri-text').innerText); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 1500);">Copy</button>
            </div>
          </div>
        </div>
      </div>

      <!-- AniList OAuth Card -->
      <div class="card">
        <h2><span>🌸</span> AniList OAuth Configuration</h2>
        <div class="config-grid">
          <div class="config-item">
            <div class="config-label">Client ID</div>
            <div class="config-val">${anilistClientId ? escapeHtml(anilistClientId) : 'Not Set (Optional)'}</div>
          </div>
          <div class="config-item">
            <div class="config-label">Client Secret</div>
            <div class="config-val">${anilistHasSecret ? '✓ Configured' : 'Not Set'}</div>
          </div>
          <div class="config-item" style="grid-column: 1 / -1;">
            <div class="config-label">Callback / Redirect URI (Add to AniList Developer Settings)</div>
            <div class="code-box">
              <span id="anilist-redirect-uri-text">${escapeHtml(anilistRedirectUri)}</span>
              <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('anilist-redirect-uri-text').innerText); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 1500);">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connect User Card -->
    <div class="card">
      <h2><span>🔗</span> Connect a Jellyfin User</h2>
      <form id="auth-form" method="GET">
        <div class="form-group">
          <label for="user-select">Select Jellyfin User:</label>
          <select id="user-select" name="username">
            <option value="" disabled selected>Loading users from Jellyfin...</option>
          </select>
        </div>
        <div class="form-group" id="manual-user-group" style="display: none;">
          <label for="manual-username">Or Enter Custom Username:</label>
          <input type="text" id="manual-username" placeholder="e.g. testuser">
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button type="submit" formaction="/auth/login" class="btn btn-primary" id="simkl-submit-btn" ${!simklClientId ? 'disabled title="Please configure simkl.client_id first"' : ''}>
            <span>🎬</span> Authorize on Simkl
          </button>
          <button type="submit" formaction="/auth/anilist/login" class="btn btn-anilist" id="anilist-submit-btn" ${!anilistClientId ? 'disabled title="Please configure anilist.client_id in config.toml first"' : ''}>
            <span>🌸</span> Authorize on AniList
          </button>
        </div>
      </form>
    </div>

    <!-- Active Users Table -->
    <div class="card">
      <h2>
        <span>👥</span> User Status & Active Connections
        <button class="btn btn-secondary btn-sm" onclick="loadUsers()">↻ Refresh Status</button>
      </h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Jellyfin User</th>
              <th>Simkl Status</th>
              <th>AniList Status</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Loading users...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    window.__APP_STATE = {
      hasSimklClient: ${Boolean(simklClientId)},
      hasAniListClient: ${Boolean(anilistClientId)}
    };

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function loadUsers() {
      const select = document.getElementById('user-select');
      const tableBody = document.getElementById('users-table-body');
      
      try {
        const res = await fetch('/api/users');
        const data = await res.json();
        
        // Populate select
        select.innerHTML = '<option value="" disabled selected>Choose a user...</option>';
        for (const user of data.jellyfinUsers) {
          const opt = document.createElement('option');
          opt.value = user.name;
          opt.textContent = user.name;
          select.appendChild(opt);
        }
        
        // Add option for manual input
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = '✎ Enter custom username...';
        select.appendChild(customOpt);

        select.onchange = function() {
          const manualGroup = document.getElementById('manual-user-group');
          const manualInput = document.getElementById('manual-username');
          if (this.value === '__custom__') {
            manualGroup.style.display = 'flex';
            manualInput.name = 'username';
            select.name = '';
            manualInput.focus();
          } else {
            manualGroup.style.display = 'none';
            manualInput.name = '';
            select.name = 'username';
          }
        };

        // Populate table
        if (!data.users || data.users.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No users found. Connect one above!</td></tr>';
          return;
        }

        tableBody.innerHTML = '';
        for (const u of data.users) {
          const tr = document.createElement('tr');
          
          // Simkl Column
          const s = u.simkl || u;
          let simklBadge = '';
          let simklAction = '';

          if (!s.isConfigured) {
            simklBadge = '<span class="badge badge-secondary"><span class="badge-dot"></span> Not Connected</span>';
            simklAction = '<a href="/auth/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-primary btn-sm"' + (!window.__APP_STATE.hasSimklClient ? ' style="opacity:0.5;pointer-events:none;"' : '') + '>Connect</a>';
          } else if (s.isValid) {
            let expiryText = '';
            if (s.expiresInDays !== undefined) {
              expiryText = ' &bull; ' + (s.expiresInDays > 0 ? 'Expires in ' + s.expiresInDays + 'd' : 'Expires today') + ' (auto-refreshes)';
            }
            simklBadge = '<span class="badge badge-success"><span class="badge-dot"></span> Connected (' + escapeHtml(s.simklUsername || 'Valid') + ')' + expiryText + '</span>';
            let refreshBtn = '';
            if (s.hasRefreshToken) {
              refreshBtn = '<button onclick="refreshUser(\\'' + escapeHtml(u.username) + '\\')" class="btn btn-secondary btn-sm">↻ Refresh</button>';
            }
            simklAction = refreshBtn + '<a href="/auth/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-secondary btn-sm">Re-link</a>';
          } else {
            simklBadge = '<span class="badge badge-danger"><span class="badge-dot"></span> Invalid / Expired</span>';
            simklAction = '<a href="/auth/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-primary btn-sm">Re-link</a>';
          }

          // AniList Column
          const a = u.anilist;
          let anilistBadge = '';
          let anilistAction = '';

          if (!a || !a.isConfigured) {
            anilistBadge = '<span class="badge badge-secondary"><span class="badge-dot"></span> Not Connected</span>';
            anilistAction = '<a href="/auth/anilist/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-anilist btn-sm"' + (!window.__APP_STATE.hasAniListClient ? ' style="opacity:0.5;pointer-events:none;"' : '') + '>Connect</a>';
          } else if (a.isValid) {
            let anilistExpiryText = '';
            let badgeClass = 'badge-anilist';
            if (a.expiresInDays !== undefined) {
              if (a.expiresInDays > 30) {
                anilistExpiryText = ' &bull; Expires in ' + a.expiresInDays + 'd';
              } else if (a.expiresInDays > 0) {
                badgeClass = 'badge-warning';
                anilistExpiryText = ' &bull; Expires in ' + a.expiresInDays + 'd (re-link soon)';
              } else {
                badgeClass = 'badge-danger';
                anilistExpiryText = ' &bull; Expires today';
              }
            }
            anilistBadge = '<span class="badge ' + badgeClass + '"><span class="badge-dot"></span> Connected (' + escapeHtml(a.anilistUsername || 'Valid') + ')' + anilistExpiryText + '</span>';
            anilistAction = '<a href="/auth/anilist/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-secondary btn-sm">Re-link</a>';
          } else {
            anilistBadge = '<span class="badge badge-danger"><span class="badge-dot"></span> Invalid / Expired</span>';
            anilistAction = '<a href="/auth/anilist/login?username=' + encodeURIComponent(u.username) + '" class="btn btn-anilist btn-sm">Re-link</a>';
          }

          tr.innerHTML = '<td><strong>' + escapeHtml(u.username) + '</strong></td>' +
                         '<td><div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">' + simklBadge + '<div style="display: flex; gap: 0.3rem;">' + simklAction + '</div></div></td>' +
                         '<td><div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">' + anilistBadge + '<div style="display: flex; gap: 0.3rem;">' + anilistAction + '</div></div></td>';
          tableBody.appendChild(tr);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--danger);">Failed to load user list</td></tr>';
      }
    }

    async function refreshUser(username) {
      try {
        const res = await fetch('/api/users/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (res.ok) {
          alert('Token refreshed successfully for ' + username);
          loadUsers();
        } else {
          alert('Refresh failed: ' + (data.message || 'Unknown error'));
        }
      } catch (e) {
        alert('Network error during refresh: ' + e.message);
      }
    }

    loadUsers();
  </script>
</body>
</html>`;
};

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

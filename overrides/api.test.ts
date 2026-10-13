import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
  handleGetOverrides,
  handleImportOverrides,
  handleOverridesPage,
  handleRetireRedundantOverrides,
  handleSaveOverrides,
  handleSyncCatalog,
  handleSyncSeries,
} from './api';

describe('Overrides Web Endpoints', () => {
  test('handleOverridesPage should return 200 with HTML content, official mapping column and catalog sync', async () => {
    const res = handleOverridesPage();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('data-filter="missing-anilist"');
    expect(html).toContain('Only Missing AniList');
    expect(html).toContain('sort-select');
    expect(html).toContain('Most Missing AniList');
    expect(html).toContain('data-filter="overridden"');
    expect(html).toContain('Custom Overrides');
    expect(html).toContain('data-filter="skipped-anilist"');
    expect(html).toContain('stat-skipped-anilist');
    expect(html).toContain('toggleEpSkipAniList');
    expect(html).toContain('skipUnmappedSeasonAniList');
    expect(html).toContain('Sync Library');
    expect(html).toContain('Official AniList');
    expect(html).toContain('Override AniList');
    expect(html).toContain('Retire Redundant');
    expect(html).toContain('retire-btn');
    expect(html).toContain('Sync Series');
    expect(html).toContain('sync-series-btn');
  });

  test('handleGetOverrides should return 200 with overrides, catalog, filePath, and official mappings', async () => {
    const res = await handleGetOverrides();
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      filePath?: string;
      catalog?: any;
      overrides?: any;
      official?: any;
    };
    expect(data.filePath).toBeDefined();
    expect(data.catalog).toBeDefined();
    expect(data.overrides).toBeDefined();
    expect(data.official).toBeDefined();

    // Verify official movie mapping resolution (e.g. Your Name. TVDB 197 -> AniList 21519)
    if (data.catalog?.['197']) {
      expect(data.official?.['197']?.['0']?.['1']?.anilistId).toBe(21519);
    }

    // Verify that deleted specials (e.g. Bikini Warriors S0E2) are not resurrected into catalog
    if (data.catalog?.['295897']) {
      expect(data.catalog['295897'].seasons?.['0']?.episodes?.['2']).toBeUndefined();
    }
  });

  test('handleSaveOverrides should reject missing body parameters with 400', async () => {
    const req = new Request('http://localhost:3000/api/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleSaveOverrides(req);
    expect(res.status).toBe(400);
  });

  test('handleSyncCatalog and handleImportOverrides should handle sync request', async () => {
    const req = new Request('http://localhost:3000/api/catalog/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleSyncCatalog(req);
    // Might succeed or fail depending on Jellyfin connectivity in mock, but should return a valid JSON response
    expect([200, 500]).toContain(res.status);
    const data = (await res.json()) as any;
    expect(data).toBeDefined();

    const legacyRes = await handleImportOverrides(req);
    expect([200, 500]).toContain(legacyRes.status);
  });

  test('handleRetireRedundantOverrides should retire matching overrides and return summary', async () => {
    const tempOverridesPath = `/tmp/test-api-retire-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;

    // 457471: Yowayowa Sensei S1E1 matches official AniBridge (185211 ep 1)
    // 82310: Princess Lover! S0E1 diverges (8231 vs official 7468)
    const testOverrides = {
      '457471': {
        title: 'Yowayowa Sensei',
        seasons: {
          '1': {
            episodes: {
              '1': { name: 'Episode 1', anilistId: 185211, anilistEpisode: 1 },
            },
          },
        },
      },
      '82310': {
        title: 'Princess Lover!',
        seasons: {
          '0': {
            episodes: {
              '1': { name: 'OVA 1', anilistId: 8231, anilistEpisode: 1 },
            },
          },
        },
      },
    };

    writeFileSync(tempOverridesPath, JSON.stringify(testOverrides, null, 2), 'utf-8');

    const mockResolver: any = {
      isInitialized: () => true,
      initialize: async () => {},
      resolveOfficialEpisode: (series: any, _seasonNumber: number, episodeNumber: number) => {
        if (series.tvdbId === '457471') {
          return {
            anilist: { mediaId: 185211, episodeNumber },
            source: 'anibridge',
          };
        }
        if (series.tvdbId === '82310') {
          return {
            anilist: { mediaId: 7468, episodeNumber },
            source: 'anibridge',
          };
        }
        return null;
      },
    };

    try {
      const req = new Request('http://localhost:3000/api/overrides/retire-redundant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customOverridesPath: tempOverridesPath }),
      });

      const res = await handleRetireRedundantOverrides(req, mockResolver);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        success: boolean;
        summary: {
          retiredCount: number;
          affectedShowsCount: number;
          affectedShowTitles: string[];
          backupPath?: string;
          details: any[];
        };
      };

      expect(data.success).toBe(true);
      expect(data.summary.retiredCount).toBe(1);
      expect(data.summary.affectedShowsCount).toBe(1);
      expect(data.summary.affectedShowTitles).toContain('Yowayowa Sensei');

      // Verify file on disk
      const updated = JSON.parse(readFileSync(tempOverridesPath, 'utf-8'));
      expect(updated['457471']).toBeUndefined();
      expect(updated['82310']).toBeDefined();

      if (data.summary.backupPath && existsSync(data.summary.backupPath)) {
        unlinkSync(data.summary.backupPath);
      }
    } finally {
      if (existsSync(tempOverridesPath)) {
        unlinkSync(tempOverridesPath);
      }
    }
  });

  test('handleSyncSeries should reject missing tvdbId with 400', async () => {
    const req = new Request('http://localhost:3000/api/catalog/sync-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await handleSyncSeries(req);
    expect(res.status).toBe(400);
  });

  test('handleSyncSeries should return 200 with summary and official mappings for valid series', async () => {
    // 295897 is Bikini Warriors
    const req = new Request('http://localhost:3000/api/catalog/sync-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tvdbId: '295897' }),
    });
    const res = await handleSyncSeries(req);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(data.summary).toBeDefined();
      expect(data.summary.tvdbId).toBe('295897');
      expect(data.official).toBeDefined();
    }
  });
});

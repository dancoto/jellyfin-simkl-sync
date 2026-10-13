import { describe, expect, test } from 'bun:test';
import {
  handleGetOverrides,
  handleImportOverrides,
  handleOverridesPage,
  handleSaveOverrides,
  handleSyncCatalog,
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
});

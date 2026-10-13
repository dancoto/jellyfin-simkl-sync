import { describe, expect, test } from 'bun:test';
import { handleGetOverrides, handleOverridesPage, handleSaveOverrides } from './api';

describe('Overrides Web Endpoints', () => {
  test('handleOverridesPage should return 200 with HTML content and missing AniList filter', async () => {
    const res = handleOverridesPage();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('data-filter="missing-anilist"');
    expect(html).toContain('Only Missing AniList');
    expect(html).toContain('sort-select');
    expect(html).toContain('Most Missing AniList');
    expect(html).toContain('data-filter="skipped-anilist"');
    expect(html).toContain('stat-skipped-anilist');
    expect(html).toContain('toggleEpSkipAniList');
    expect(html).toContain('skipUnmappedSeasonAniList');
  });

  test('handleGetOverrides should return 200 with overrides and filePath', async () => {
    const res = handleGetOverrides();
    expect(res.status).toBe(200);
    const data = (await res.json()) as { filePath?: string; overrides?: any };
    expect(data.filePath).toBeDefined();
    expect(data.overrides).toBeDefined();
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
});

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { pruneOrphanedOverrides } from './prune';
import type { CatalogData } from './catalog';
import { AnimeResolver } from '../anime/resolver';

describe('Prune Orphaned Overrides Engine', () => {
  let tempOverridesPath: string;
  let tempCatalogPath: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    tempOverridesPath = `/tmp/test-prune-overrides-${id}.json`;
    tempCatalogPath = `/tmp/test-prune-catalog-${id}.json`;
  });

  afterEach(() => {
    if (existsSync(tempOverridesPath)) {
      unlinkSync(tempOverridesPath);
    }
    if (existsSync(tempCatalogPath)) {
      unlinkSync(tempCatalogPath);
    }
  });

  test('should prune deleted episodes from overrides and leave valid episodes intact', () => {
    // Overrides has:
    // - Show 295897 (Bikini Warriors): Season 0 has episodes 2, 3 (deleted), 13 (real)
    // - Show 70861 (Love Hina): Season 1 has episode 25 (deleted)
    // - Show 82310 (Princess Lover): Season 0 has episode 1 (real)
    // - Show 999999 (Offline show not in Jellyfin): Season 1 has episode 1
    const mockOverrides: any = {
      '295897': {
        title: 'Bikini Warriors',
        seasons: {
          '0': {
            episodes: {
              '2': { name: 'Deleted Special 2', anilistId: null },
              '3': { name: 'Deleted Special 3', anilistId: null },
              '13': { name: 'Real Special 13', anilistId: 99999 },
            },
          },
        },
      },
      '70861': {
        title: 'Love Hina',
        seasons: {
          '1': {
            episodes: {
              '25': { name: 'Deleted Episode 25', skipAniList: true },
            },
          },
        },
      },
      '82310': {
        title: 'Princess Lover!',
        seasons: {
          '0': {
            episodes: {
              '1': { name: 'Real Special 1', anilistId: 8231 },
            },
          },
        },
      },
      '999999': {
        title: 'Offline Show',
        seasons: {
          '1': {
            episodes: {
              '1': { name: 'Offline Ep 1', anilistId: 1111 },
            },
          },
        },
      },
    };

    writeFileSync(tempOverridesPath, JSON.stringify(mockOverrides, null, 2), 'utf-8');

    // Catalog has:
    // - Show 295897: Season 0 only has episode 13
    // - Show 70861: Season 1 only has episodes 1..24
    // - Show 82310: Season 0 has episode 1
    const mockCatalog: CatalogData = {
      lastUpdated: '2026-10-13T12:00:00.000Z',
      shows: {
        '295897': {
          tvdbId: '295897',
          title: 'Bikini Warriors',
          seasons: {
            '0': {
              seasonNumber: 0,
              episodes: {
                '13': { episodeNumber: 13, name: 'Real Special 13' },
              },
            },
          },
        },
        '70861': {
          tvdbId: '70861',
          title: 'Love Hina',
          seasons: {
            '1': {
              seasonNumber: 1,
              episodes: {
                '1': { episodeNumber: 1, name: 'Ep 1' },
                '24': { episodeNumber: 24, name: 'Ep 24' },
              },
            },
          },
        },
        '82310': {
          tvdbId: '82310',
          title: 'Princess Lover!',
          seasons: {
            '0': {
              seasonNumber: 0,
              episodes: {
                '1': { episodeNumber: 1, name: 'Real Special 1' },
              },
            },
          },
        },
      },
    };

    const resolver = new AnimeResolver();

    const summary = pruneOrphanedOverrides({
      customOverridesPath: tempOverridesPath,
      catalog: mockCatalog,
      resolver,
    });

    expect(summary.prunedEpisodesCount).toBe(3); // Ep 2, Ep 3 from Bikini Warriors, Ep 25 from Love Hina
    expect(summary.prunedShowsCount).toBe(1); // Love Hina became empty and was pruned
    expect(summary.affectedShowTitles).toContain('Bikini Warriors');
    expect(summary.affectedShowTitles).toContain('Love Hina');
    expect(summary.backupPath).toBeDefined();

    const updatedOverrides = JSON.parse(readFileSync(tempOverridesPath, 'utf-8'));

    // Bikini Warriors should only have episode 13 remaining
    expect(updatedOverrides['295897']).toBeDefined();
    expect(updatedOverrides['295897'].seasons['0'].episodes['2']).toBeUndefined();
    expect(updatedOverrides['295897'].seasons['0'].episodes['3']).toBeUndefined();
    expect(updatedOverrides['295897'].seasons['0'].episodes['13']).toBeDefined();

    // Love Hina had all episodes in Season 1 pruned -> show deleted
    expect(updatedOverrides['70861']).toBeUndefined();

    // Princess Lover should be completely untouched
    expect(updatedOverrides['82310']).toBeDefined();
    expect(updatedOverrides['82310'].seasons['0'].episodes['1']).toBeDefined();

    // Offline show (not in Jellyfin catalog) should be preserved
    expect(updatedOverrides['999999']).toBeDefined();

    // Cleanup backup file
    if (summary.backupPath && existsSync(summary.backupPath)) {
      unlinkSync(summary.backupPath);
    }
  });
});

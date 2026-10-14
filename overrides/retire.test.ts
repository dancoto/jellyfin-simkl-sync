import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { retireRedundantOverrides } from './retire';

describe('Retire Redundant Overrides Engine', () => {
  let tempOverridesPath: string;

  beforeEach(() => {
    tempOverridesPath = `/tmp/test-retire-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;

    const initialOverrides = {
      // 1. Identical match -> Should be retired!
      '457471': {
        title: 'Yowayowa Sensei',
        tmdbId: '284447',
        seasons: {
          '1': {
            episodes: {
              '1': { name: 'Spooky Scary Sensei', anilistId: 185211, anilistEpisode: 1 },
              '2': { name: 'Weak and Wimpy', anilistId: 185211 }, // null/undefined episode defaults to 2
            },
          },
        },
      },
      // 2. Divergent ID -> Should be KEPT!
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
      // 3. Divergent Episode number -> Should be KEPT!
      '50810': {
        title: 'Bakemonogatari',
        seasons: {
          '1': {
            episodes: {
              '1': { name: 'Ep 1', anilistId: 5081, anilistEpisode: 1 }, // official says ep 2
            },
          },
        },
      },
      // 4. Explicit null -> Should be KEPT!
      '70861': {
        title: 'Love Hina',
        seasons: {
          '1': {
            episodes: {
              '25': { name: 'Final Special', anilistId: null },
            },
          },
        },
      },
      // 5. Skip -> Should be KEPT!
      '75003': {
        title: 'Maburaho',
        seasons: {
          '0': {
            episodes: {
              '1': { name: 'Special 1', skipAniList: true },
            },
          },
        },
      },
      // 6. Movie exact match -> Should be RETIRED!
      '894': {
        title: 'A Silent Voice: The Movie',
        tmdbId: '378064',
        seasons: {
          '0': {
            episodes: {
              '1': { name: 'A Silent Voice: The Movie', anilistId: 20954 },
            },
          },
        },
      },
    };

    writeFileSync(tempOverridesPath, JSON.stringify(initialOverrides, null, 2), 'utf-8');
  });

  afterEach(() => {
    if (existsSync(tempOverridesPath)) {
      unlinkSync(tempOverridesPath);
    }
  });

  test('should retire exactly matching overrides and preserve divergences, nulls, and skips', () => {
    const mockResolver: any = {
      resolveOfficialEpisode: (series: any, seasonNumber: number, episodeNumber: number) => {
        // Yowayowa Sensei official match
        if (series.tvdbId === '457471') {
          return {
            anilist: { mediaId: 185211, episodeNumber },
            source: 'anibridge',
          };
        }
        // Princess Lover official differs (7468 instead of 8231)
        if (series.tvdbId === '82310') {
          return {
            anilist: { mediaId: 7468, episodeNumber },
            source: 'anibridge',
          };
        }
        // Bakemonogatari official differs in episode number (ep 2 instead of ep 1)
        if (series.tvdbId === '50810') {
          return {
            anilist: { mediaId: 5081, episodeNumber: 2 },
            source: 'anibridge',
          };
        }
        // Love Hina unmapped
        if (series.tvdbId === '70861') {
          return null;
        }
        return null;
      },
      resolveOfficialMovie: (movie: any) => {
        if (movie.tvdbId === '894' || movie.tmdbId === '378064') {
          return {
            episodeNumber: 1,
            source: 'anibridge',
            anilist: { mediaId: 20954, episodeNumber: 1 },
          };
        }
        return null;
      },
      setTvdbOverrides: () => {},
    };

    const summary = retireRedundantOverrides({
      customOverridesPath: tempOverridesPath,
      resolver: mockResolver,
    });

    expect(summary.retiredCount).toBe(3); // Yowayowa Sensei ep 1 & ep 2, and A Silent Voice movie
    expect(summary.affectedShowsCount).toBe(2);
    expect(summary.affectedShowTitles).toContain('Yowayowa Sensei');
    expect(summary.affectedShowTitles).toContain('A Silent Voice: The Movie');
    expect(summary.backupPath).toBeDefined();

    // Verify file contents
    const updated = JSON.parse(readFileSync(tempOverridesPath, 'utf-8'));

    // 1. Yowayowa Sensei should be completely pruned
    expect(updated['457471']).toBeUndefined();

    // 2. A Silent Voice: The Movie should be completely pruned
    expect(updated['894']).toBeUndefined();

    // 3. Princess Lover divergent override preserved
    expect(updated['82310']).toBeDefined();
    expect(updated['82310'].seasons['0'].episodes['1'].anilistId).toBe(8231);

    // 3. Bakemonogatari episode offset preserved
    expect(updated['50810']).toBeDefined();
    expect(updated['50810'].seasons['1'].episodes['1'].anilistEpisode).toBe(1);

    // 4. Love Hina explicit null preserved
    expect(updated['70861']).toBeDefined();
    expect(updated['70861'].seasons['1'].episodes['25'].anilistId).toBeNull();

    // 5. Maburaho skip preserved
    expect(updated['75003']).toBeDefined();
    expect(updated['75003'].seasons['0'].episodes['1'].skipAniList).toBe(true);

    // Clean up backup file created by test
    if (summary.backupPath && existsSync(summary.backupPath)) {
      unlinkSync(summary.backupPath);
    }
  });
});

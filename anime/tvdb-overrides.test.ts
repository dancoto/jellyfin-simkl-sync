import { describe, expect, test } from 'bun:test';
import { AnimeResolver } from './resolver';
import { TvdbOverridesIndex } from './tvdb-overrides';

describe('TVDB Overrides Index & Resolver Integration', () => {
  const sampleOverridesData = {
    '70861': {
      title: 'Love Hina',
      seasons: {
        '1': {
          episodes: {
            '25': {
              name: 'Final Special',
              anidbId: '35',
              anidbEpisode: 25,
              anilistId: null, // null skips AniList
            },
            '26': {
              name: 'Christmas Special',
              anidbId: '35',
              anidbEpisode: 26,
              anilistId: 444, // valid AniList ID
              anilistEpisode: 1,
            },
          },
        },
      },
    },
    '72172': {
      title: 'MegaMan: NT Warrior',
      seasons: {
        '1': {
          episodes: {
            '1': {
              name: 'Jack In! MegaMan!',
              anidbId: null, // both null = skipped
              anilistId: null,
            },
          },
        },
        '2': {
          // Season level 1:1 shorthand
          anidbId: '1500',
          anilistId: 3000,
          anidbEpisodeOffset: 0,
        },
      },
    },
    '99999': {
      title: 'Contiguous OVA',
      seasons: {
        '0': {
          episodes: {
            '1-3': {
              name: 'OVA Trilogy',
              anidbId: '8888',
              anilistId: 9999,
            },
          },
        },
      },
    },
  };

  test('should skip AniList when anilistId is null, but keep AniDB', () => {
    const tvdbOverrides = TvdbOverridesIndex.parse(sampleOverridesData);
    const resolver = new AnimeResolver();
    resolver.setIndices(null, null, null, tvdbOverrides);

    const result = resolver.resolveEpisode({ tvdbId: '70861' }, 1, 25);
    expect(result).not.toBeNull();
    expect(result?.animeId).toBe('35');
    expect(result?.episodeNumber).toBe(25);
    expect(result?.skipAniDb).toBe(false);
    expect(result?.skipAniList).toBe(true);
    expect(result?.anilist).toBeUndefined();
    expect(result?.isSkipped).toBeFalsy();
  });

  test('should map both AniDB and AniList when valid IDs are provided', () => {
    const tvdbOverrides = TvdbOverridesIndex.parse(sampleOverridesData);
    const resolver = new AnimeResolver();
    resolver.setIndices(null, null, null, tvdbOverrides);

    const result = resolver.resolveEpisode({ tvdbId: '70861' }, 1, 26);
    expect(result).not.toBeNull();
    expect(result?.animeId).toBe('35');
    expect(result?.skipAniDb).toBe(false);
    expect(result?.skipAniList).toBe(false);
    expect(result?.anilist).toEqual({ mediaId: 444, episodeNumber: 1 });
  });

  test('should mark isSkipped when both IDs are null', () => {
    const tvdbOverrides = TvdbOverridesIndex.parse(sampleOverridesData);
    const resolver = new AnimeResolver();
    resolver.setIndices(null, null, null, tvdbOverrides);

    const result = resolver.resolveEpisode({ tvdbId: '72172' }, 1, 1);
    expect(result).not.toBeNull();
    expect(result?.isSkipped).toBe(true);
    expect(result?.skipAniDb).toBe(true);
    expect(result?.skipAniList).toBe(true);
  });

  test('should resolve season-level 1:1 default mapping', () => {
    const tvdbOverrides = TvdbOverridesIndex.parse(sampleOverridesData);
    const resolver = new AnimeResolver();
    resolver.setIndices(null, null, null, tvdbOverrides);

    const result = resolver.resolveEpisode({ tvdbId: '72172' }, 2, 5);
    expect(result).not.toBeNull();
    expect(result?.animeId).toBe('1500');
    expect(result?.episodeNumber).toBe(5);
    expect(result?.anilist).toEqual({ mediaId: 3000, episodeNumber: 5 });
  });

  test('should expand episode range like 1-3', () => {
    const tvdbOverrides = TvdbOverridesIndex.parse(sampleOverridesData);
    const resolver = new AnimeResolver();
    resolver.setIndices(null, null, null, tvdbOverrides);

    const ep2 = resolver.resolveEpisode({ tvdbId: '99999' }, 0, 2);
    expect(ep2).not.toBeNull();
    expect(ep2?.animeId).toBe('8888');
    expect(ep2?.anilist?.mediaId).toBe(9999);

    // Episode 4 is not in the 1-3 range
    const ep4 = resolver.resolveEpisode({ tvdbId: '99999' }, 0, 4);
    expect(ep4).toBeNull();
  });
});

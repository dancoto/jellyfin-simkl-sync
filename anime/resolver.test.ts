import { describe, expect, test } from 'bun:test';
import { AniBridgeIndex } from './anibridge';
import { AnimeListIndex } from './animelist';
import { pair, readAllRanges, readRange, readTarget } from './range';
import { AnimeResolver } from './resolver';

describe('Anime Range Parser', () => {
  test('should parse single episodes and ranges', () => {
    expect(readRange('5')).toEqual({ start: 5, end: 5 });
    expect(readRange('1-12')).toEqual({ start: 1, end: 12 });
    expect(readRange('14-')).toEqual({ start: 14, end: null });
    expect(readRange('invalid')).toBeNull();
  });

  test('should parse comma-separated ranges', () => {
    expect(readAllRanges('1-6,8-13')).toEqual([
      { start: 1, end: 6 },
      { start: 8, end: 13 },
    ]);
  });

  test('should parse target with ratios', () => {
    expect(readTarget('1-12')).toEqual({
      ranges: [{ start: 1, end: 12 }],
      ratio: 1,
    });
    expect(readTarget('14-|2')).toEqual({
      ranges: [{ start: 14, end: null }],
      ratio: 2,
    });
    expect(readTarget('1-2|-2')).toEqual({
      ranges: [{ start: 1, end: 2 }],
      ratio: -2,
    });
  });

  test('should pair ranges 1-to-1', () => {
    const entry = [{ start: 1, end: 12 }];
    const season = [{ start: 1, end: 12 }];
    const paired = pair(entry, season);

    expect(paired).toEqual([
      [
        { start: 1, end: 12 },
        { start: 1, end: 12 },
      ],
    ]);
  });

  test('should pair with positive ratio (1 AniDB episode spans 2 TVDB episodes)', () => {
    const entry = [{ start: 1, end: 10 }];
    const season = [{ start: 1, end: 4 }];
    const paired = pair(entry, season, 2);

    expect(paired).toEqual([
      [
        { start: 1, end: 1 },
        { start: 1, end: 1 },
      ],
      [
        { start: 1, end: 1 },
        { start: 2, end: 2 },
      ],
      [
        { start: 2, end: 2 },
        { start: 3, end: 3 },
      ],
      [
        { start: 2, end: 2 },
        { start: 4, end: 4 },
      ],
    ]);
  });

  test('should pair with negative ratio (2 AniDB episodes span 1 TVDB episode)', () => {
    const entry = [{ start: 1, end: 10 }];
    const season = [{ start: 1, end: 2 }];
    const paired = pair(entry, season, -2);

    expect(paired).toEqual([
      [
        { start: 1, end: 1 },
        { start: 1, end: 1 },
      ],
      [
        { start: 3, end: 3 },
        { start: 2, end: 2 },
      ],
    ]);
  });
});

describe('AniBridge Index & Resolver', () => {
  const sampleAniBridgeData = {
    $meta: {
      schema_version: '3.0.3',
    },
    // Frieren: Beyond Journey's End (Season 1, 28 eps)
    'anidb:17617:R': {
      'tvdb_show:439265:s1': { '1-28': '1-28' },
      'tmdb_show:209867:s1': { '1-28': '1-28' },
    },
    // Attack on Titan: S1 (eps 1-25)
    'anidb:9541:R': {
      'tvdb_show:267440:s1': { '1-25': '1-25' },
    },
    // Attack on Titan: S2 (eps 1-12)
    'anidb:10944:R': {
      'tvdb_show:267440:s2': { '1-12': '1-12' },
    },
    // Attack on Titan: S3 Part 1 (eps 1-12) & Part 2 (eps 13-22)
    'anidb:13507:R': {
      'tvdb_show:267440:s3': { '1-12': '1-12' },
    },
    'anidb:14226:R': {
      'tvdb_show:267440:s3': { '1-10': '13-22' },
    },
    // Specials: Attack on Titan OVA (Season 0)
    'anidb:9541:S': {
      'tvdb_show:267440:s0': { '1-3': '1-3' },
    },
    // Queen's Blade: Grimoire (OVA mapped to TVDB S0)
    'anidb:11257:R': {
      'tvdb_show:87491:s0': { '1-2': '37-38' },
    },
    // Princess Mononoke (Movie)
    'anidb:7:R': {
      'tmdb_movie:128': { '1': '1' },
      'imdb_movie:tt0119698': { '1': '1' },
    },
  };

  test('should resolve single-season anime episode (Frieren)', () => {
    const aniBridge = AniBridgeIndex.parse(sampleAniBridgeData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge);

    const result = resolver.resolveEpisode({ tvdbId: '439265' }, 1, 5);
    expect(result).toEqual({
      animeId: '17617',
      episodeNumber: 5,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });
  });

  test('should resolve multi-season anime episodes (Attack on Titan)', () => {
    const aniBridge = AniBridgeIndex.parse(sampleAniBridgeData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge);

    // S1 Ep 10 -> AniDB 9541 Ep 10
    const s1 = resolver.resolveEpisode({ tvdbId: '267440' }, 1, 10);
    expect(s1).toEqual({
      animeId: '9541',
      episodeNumber: 10,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });

    // S2 Ep 3 -> AniDB 10944 Ep 3
    const s2 = resolver.resolveEpisode({ tvdbId: '267440' }, 2, 3);
    expect(s2).toEqual({
      animeId: '10944',
      episodeNumber: 3,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });

    // S3 Ep 5 (Part 1) -> AniDB 13507 Ep 5
    const s3p1 = resolver.resolveEpisode({ tvdbId: '267440' }, 3, 5);
    expect(s3p1).toEqual({
      animeId: '13507',
      episodeNumber: 5,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });

    // S3 Ep 15 (Part 2) -> AniDB 14226 Ep 3 (15 - 13 + 1 = 3)
    const s3p2 = resolver.resolveEpisode({ tvdbId: '267440' }, 3, 15);
    expect(s3p2).toEqual({
      animeId: '14226',
      episodeNumber: 3,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });
  });

  test('should resolve specials (Season 0)', () => {
    const aniBridge = AniBridgeIndex.parse(sampleAniBridgeData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge);

    const special = resolver.resolveEpisode({ tvdbId: '267440' }, 0, 2);
    expect(special).toEqual({
      animeId: '9541',
      episodeNumber: 2,
      isSpecial: true,
      kind: 'special',
      source: 'anibridge',
    });
  });

  test('should resolve standalone OVA mapped to TVDB Season 0 as regular episode', () => {
    const aniBridge = AniBridgeIndex.parse(sampleAniBridgeData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge);

    const ova = resolver.resolveEpisode({ tvdbId: '87491' }, 0, 37);
    expect(ova).toEqual({
      animeId: '11257',
      episodeNumber: 1,
      isSpecial: false,
      kind: 'regular',
      source: 'anibridge',
    });
  });

  test('should resolve anime movies', () => {
    const aniBridge = AniBridgeIndex.parse(sampleAniBridgeData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge);

    const tmdbMovie = resolver.resolveMovie({ tmdbId: '128' });
    expect(tmdbMovie).toEqual({
      animeId: '7',
      episodeNumber: 1,
      source: 'anibridge',
    });

    const imdbMovie = resolver.resolveMovie({ imdbId: 'TT0119698' });
    expect(imdbMovie).toEqual({
      animeId: '7',
      episodeNumber: 1,
      source: 'anibridge',
    });
  });
});

describe('Overrides & Fallback Precedence', () => {
  const aniBridgeData = {
    'anidb:100:R': {
      'tvdb_show:500:s1': { '1-12': '1-12' },
    },
  };

  const overrideData = {
    // Override season 1 to point to anidb 999 instead
    'anidb:999:R': {
      'tvdb_show:500:s1': { '1-12': '1-12' },
    },
  };

  const animeListXml = `
<anime-list>
  <anime anidbid="200" tvdbid="600" defaulttvdbseason="1" episodeoffset="0">
    <name>Fallback Anime</name>
  </anime>
  <anime anidbid="201" tvdbid="600" defaulttvdbseason="0" episodeoffset="10">
    <name>Fallback OVA</name>
  </anime>
</anime-list>
`;

  test('should prioritize overrides ahead of AniBridge', () => {
    const aniBridge = AniBridgeIndex.parse(aniBridgeData);
    const overrides = AniBridgeIndex.parse(overrideData);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge, overrides);

    const result = resolver.resolveEpisode({ tvdbId: '500' }, 1, 1);
    expect(result).toEqual({
      animeId: '999',
      episodeNumber: 1,
      isSpecial: false,
      kind: 'regular',
      source: 'overrides',
    });
  });

  test('should fall back to Anime-Lists when AniBridge has no match', () => {
    const aniBridge = AniBridgeIndex.parse(aniBridgeData);
    const animeList = AnimeListIndex.parse(animeListXml);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge, null, animeList);

    const result = resolver.resolveEpisode({ tvdbId: '600' }, 1, 4);
    expect(result).toEqual({
      animeId: '200',
      episodeNumber: 4,
      isSpecial: false,
      kind: 'regular',
      source: 'animelist',
    });
  });

  test('should fall back to Anime-Lists for Season 0 OVA with defaulttvdbseason=0', () => {
    const aniBridge = AniBridgeIndex.parse(aniBridgeData);
    const animeList = AnimeListIndex.parse(animeListXml);
    const resolver = new AnimeResolver();
    resolver.setIndices(aniBridge, null, animeList);

    const result = resolver.resolveEpisode({ tvdbId: '600' }, 0, 12);
    expect(result).toEqual({
      animeId: '201',
      episodeNumber: 2,
      isSpecial: false,
      kind: 'regular',
      source: 'animelist',
    });
  });
});

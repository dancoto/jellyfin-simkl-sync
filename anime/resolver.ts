import { readFileSync } from 'node:fs';
import { AniBridgeIndex } from './anibridge';
import { AnimeListIndex } from './animelist';
import {
  ANIBRIDGE_MAPPINGS_URL,
  ANIME_LISTS_URL,
  getOrDownloadFile,
  type CacheOptions,
} from './cache';
import type {
  AniBridgeEntry,
  AniDbSeasonSegment,
  AnimeEpisodeResult,
  AnimeMovieResult,
  MovieLookupQuery,
  SeriesLookupQuery,
} from './models';
import { loadOverrides } from './overrides';
import {
  TvdbOverridesIndex,
  type EnsureShowOverrideParams,
  type EnsureShowOverrideResult,
} from './tvdb-overrides';

export interface ResolverOptions extends CacheOptions {
  overridesPath?: string;
  tvdbOverridesPath?: string;
  enableAnimeListFallback?: boolean;
}

export class AnimeResolver {
  private tvdbOverrides: TvdbOverridesIndex | null = null;
  private tvdbOverridesPath?: string;
  private overrides: AniBridgeIndex | null = null;
  private aniBridge: AniBridgeIndex | null = null;
  private animeList: AnimeListIndex | null = null;
  private initialized = false;

  public async initialize(options: ResolverOptions = {}): Promise<void> {
    // 1. Load manual overrides
    this.tvdbOverridesPath = options.tvdbOverridesPath;
    this.tvdbOverrides = TvdbOverridesIndex.load(options.tvdbOverridesPath);
    this.overrides = loadOverrides(options.overridesPath);

    // 2. Load AniBridge mappings
    try {
      const aniBridgePath = await getOrDownloadFile(
        'anibridge-mappings.json',
        ANIBRIDGE_MAPPINGS_URL,
        options,
      );
      if (aniBridgePath) {
        const content = readFileSync(aniBridgePath, 'utf-8');
        this.aniBridge = AniBridgeIndex.parse(content);
        console.log(
          `AniBridge initialized: ${this.aniBridge.entriesByAnimeId.size} entries across ${this.aniBridge.entriesByTvdb.size} TVDB shows, ${this.aniBridge.moviesByKey.size} movies.`,
        );
      }
    } catch (error) {
      console.error('Failed to initialize AniBridge mappings:', error);
    }

    // 3. Load Anime-Lists fallback if enabled (default true)
    if (options.enableAnimeListFallback !== false) {
      try {
        const animeListPath = await getOrDownloadFile('anime-list.xml', ANIME_LISTS_URL, options);
        if (animeListPath) {
          const content = readFileSync(animeListPath, 'utf-8');
          this.animeList = AnimeListIndex.parse(content);
          console.log(
            `Anime-Lists initialized: ${this.animeList.entriesByAnimeId.size} entries across ${this.animeList.entriesByTvdb.size} TVDB shows.`,
          );
        }
      } catch (error) {
        console.error('Failed to initialize Anime-Lists fallback:', error);
      }
    }

    this.initialized = true;
  }

  public setIndices(
    aniBridge: AniBridgeIndex | null,
    overrides: AniBridgeIndex | null = null,
    animeList: AnimeListIndex | null = null,
    tvdbOverrides: TvdbOverridesIndex | null = null,
  ): void {
    this.aniBridge = aniBridge;
    this.overrides = overrides;
    this.animeList = animeList;
    this.tvdbOverrides = tvdbOverrides;
    this.initialized = true;
  }

  public setTvdbOverrides(tvdbOverrides: TvdbOverridesIndex | null): void {
    this.tvdbOverrides = tvdbOverrides;
  }

  public setTvdbOverridesPath(path?: string): void {
    this.tvdbOverridesPath = path;
  }

  public hasTvdbShow(tvdbId: string | undefined): boolean {
    return this.tvdbOverrides?.hasShow(tvdbId) ?? false;
  }

  public ensureShowInOverrides(
    params: EnsureShowOverrideParams,
    customPath?: string,
  ): EnsureShowOverrideResult {
    const targetPath = customPath ?? this.tvdbOverridesPath;
    const result = TvdbOverridesIndex.ensureShowInOverrides(params, targetPath);
    if (result.added && result.data) {
      this.tvdbOverrides = TvdbOverridesIndex.parse(result.data);
    }
    return result;
  }

  public resolveEpisode(
    series: SeriesLookupQuery,
    seasonNumber: number,
    episodeNumber: number,
  ): AnimeEpisodeResult | null {
    if (!this.initialized) {
      console.warn('AnimeResolver: queried before initialization.');
    }

    // 0. Check TVDB-driven manual overrides first
    const tvdbOverride = this.tvdbOverrides?.getEpisodeOverride(
      series.tvdbId,
      seasonNumber,
      episodeNumber,
    );

    if (tvdbOverride) {
      if (tvdbOverride.skip) {
        return {
          animeId: '',
          episodeNumber,
          isSpecial: seasonNumber === 0,
          kind: seasonNumber === 0 ? 'special' : 'regular',
          source: 'overrides',
          isSkipped: true,
          skipAniDb: true,
          skipAniList: true,
        };
      }

      // If anidbId is explicitly specified in override
      if (tvdbOverride.anidbId !== undefined) {
        const result: AnimeEpisodeResult = {
          animeId: tvdbOverride.anidbId,
          episodeNumber: tvdbOverride.anidbEpisode ?? episodeNumber,
          isSpecial: tvdbOverride.isSpecial ?? seasonNumber === 0,
          kind: (tvdbOverride.isSpecial ?? seasonNumber === 0) ? 'special' : 'regular',
          source: 'overrides',
          skipAniDb: tvdbOverride.skipAniDb,
          skipAniList: tvdbOverride.skipAniList,
        };

        if (tvdbOverride.skipAniList) {
          result.anilist = undefined;
          return result;
        }

        if (tvdbOverride.anilistId !== undefined) {
          result.anilist = {
            mediaId: tvdbOverride.anilistId,
            episodeNumber: tvdbOverride.anilistEpisode ?? result.episodeNumber,
          };
          return result;
        }

        return this.attachAniListMapping(
          result,
          series.anilistId,
          series.tvdbId,
          seasonNumber,
          episodeNumber,
        );
      }

      // If anidbId was explicitly set to null (skipAniDb)
      if (tvdbOverride.skipAniDb) {
        const result: AnimeEpisodeResult = {
          animeId: '',
          episodeNumber,
          isSpecial: tvdbOverride.isSpecial ?? seasonNumber === 0,
          kind: (tvdbOverride.isSpecial ?? seasonNumber === 0) ? 'special' : 'regular',
          source: 'overrides',
          skipAniDb: true,
          skipAniList: tvdbOverride.skipAniList,
        };

        if (tvdbOverride.anilistId !== undefined && !tvdbOverride.skipAniList) {
          result.anilist = {
            mediaId: tvdbOverride.anilistId,
            episodeNumber: tvdbOverride.anilistEpisode ?? episodeNumber,
          };
        }
        return result;
      }

      // If anidbId was not specified (partial override for AniList):
      // Resolve through standard pipeline first
      let partialResult: AnimeEpisodeResult | null = null;
      if (seasonNumber === 0) {
        partialResult = this.resolveSpecial(series, episodeNumber);
      } else {
        partialResult =
          this.resolveRegularFromIndex(
            this.overrides,
            series,
            seasonNumber,
            episodeNumber,
            'overrides',
          ) ||
          this.resolveRegularFromIndex(
            this.aniBridge,
            series,
            seasonNumber,
            episodeNumber,
            'anibridge',
          ) ||
          this.resolveRegularFromAnimeList(series, seasonNumber, episodeNumber);

        if (!partialResult && series.anidbId && seasonNumber === 1) {
          partialResult = {
            animeId: series.anidbId,
            episodeNumber,
            isSpecial: false,
            kind: 'regular',
            source: 'overrides',
          };
        }
      }

      if (tvdbOverride.skipAniList) {
        if (!partialResult) return null;
        partialResult.skipAniList = true;
        partialResult.anilist = undefined;
        return partialResult;
      }

      if (tvdbOverride.anilistId !== undefined) {
        if (!partialResult) {
          partialResult = {
            animeId: '',
            episodeNumber,
            isSpecial: seasonNumber === 0,
            kind: seasonNumber === 0 ? 'special' : 'regular',
            source: 'overrides',
            skipAniDb: true,
          };
        }
        partialResult.anilist = {
          mediaId: tvdbOverride.anilistId,
          episodeNumber:
            tvdbOverride.anilistEpisode ?? (partialResult.episodeNumber || episodeNumber),
        };
        return partialResult;
      }
    }

    let result: AnimeEpisodeResult | null = null;

    // 1. Check specials (Season 0)
    if (seasonNumber === 0) {
      result = this.resolveSpecial(series, episodeNumber);
    } else {
      // 2. Regular Season: Check Overrides -> AniBridge -> AnimeList
      result =
        this.resolveRegularFromIndex(
          this.overrides,
          series,
          seasonNumber,
          episodeNumber,
          'overrides',
        ) ||
        this.resolveRegularFromIndex(
          this.aniBridge,
          series,
          seasonNumber,
          episodeNumber,
          'anibridge',
        ) ||
        this.resolveRegularFromAnimeList(series, seasonNumber, episodeNumber);

      // Fallback: If anidbId was given directly and it's season 1
      if (!result && series.anidbId && seasonNumber === 1) {
        result = {
          animeId: series.anidbId,
          episodeNumber,
          isSpecial: false,
          kind: 'regular',
          source: 'overrides',
        };
      }
    }

    if (result) {
      return this.attachAniListMapping(
        result,
        series.anilistId,
        series.tvdbId,
        seasonNumber,
        episodeNumber,
      );
    }

    // Fallback: If no AniDB mapping exists, but a direct TVDB -> AniList mapping is known
    if (this.aniBridge && series.tvdbId) {
      const anilistMatch = this.aniBridge.resolveAniListFromTvdb(
        series.tvdbId,
        seasonNumber,
        episodeNumber,
      );
      if (anilistMatch) {
        return {
          animeId: '',
          episodeNumber,
          isSpecial: seasonNumber === 0,
          kind: seasonNumber === 0 ? 'special' : 'regular',
          source: 'anibridge',
          skipAniDb: true,
          anilist: anilistMatch,
        };
      }
    }

    return null;
  }

  public resolveMovie(movie: MovieLookupQuery): AnimeMovieResult | null {
    if (!this.initialized) {
      console.warn('AnimeResolver: queried before initialization.');
    }

    let result: AnimeMovieResult | null = null;

    // 1. Overrides
    if (this.overrides) {
      const match = this.overrides.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        result = {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'overrides',
        };
      }
    }

    // 2. AniBridge
    if (!result && this.aniBridge) {
      const match = this.aniBridge.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        result = {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'anibridge',
        };
      }
    }

    // 3. AnimeList
    if (!result && this.animeList) {
      const match = this.animeList.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        result = {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'animelist',
        };
      }
    }

    // 4. Fallback if anidbId directly passed
    if (!result && movie.anidbId) {
      result = {
        animeId: movie.anidbId,
        episodeNumber: 1,
        source: 'overrides',
      };
    }

    if (result) {
      return this.attachAniListMovieMapping(result, movie);
    }

    // Fallback: If no AniDB mapping exists, but direct AniList movie mapping is known
    if (this.aniBridge) {
      const anilistMatch = this.aniBridge.resolveAniListMovie(
        movie.tmdbId,
        movie.imdbId,
        movie.tvdbId,
      );
      if (anilistMatch) {
        return {
          animeId: '',
          episodeNumber: anilistMatch.episodeNumber,
          source: 'anibridge',
          anilist: anilistMatch,
        };
      }
    }

    return null;
  }

  private attachAniListMapping(
    result: AnimeEpisodeResult,
    anilistId?: string,
    tvdbId?: string,
    seasonNumber?: number,
    episodeNumber?: number,
  ): AnimeEpisodeResult {
    let anilistMatch: { mediaId: number; episodeNumber: number } | null = null;
    if (anilistId) {
      const parsed = parseInt(anilistId, 10);
      if (Number.isInteger(parsed)) {
        anilistMatch = { mediaId: parsed, episodeNumber: result.episodeNumber };
      }
    }
    if (!anilistMatch && this.overrides) {
      anilistMatch = this.overrides.resolveAniList(
        result.animeId,
        result.kind,
        result.episodeNumber,
      );
    }
    // Check direct TVDB Season -> AniList mapping from AniBridge index
    if (
      !anilistMatch &&
      this.aniBridge &&
      tvdbId &&
      seasonNumber !== undefined &&
      episodeNumber !== undefined
    ) {
      anilistMatch = this.aniBridge.resolveAniListFromTvdb(tvdbId, seasonNumber, episodeNumber);
    }
    // Fallback to AniDB -> AniList mapping
    if (!anilistMatch && this.aniBridge) {
      anilistMatch = this.aniBridge.resolveAniList(
        result.animeId,
        result.kind,
        result.episodeNumber,
      );
    }
    if (anilistMatch) {
      result.anilist = anilistMatch;
    }
    return result;
  }

  private attachAniListMovieMapping(
    result: AnimeMovieResult,
    movie: MovieLookupQuery,
  ): AnimeMovieResult {
    let anilistMatch: { mediaId: number; episodeNumber: number } | null = null;
    if (movie.anilistId) {
      const parsed = parseInt(movie.anilistId, 10);
      if (Number.isInteger(parsed)) {
        anilistMatch = { mediaId: parsed, episodeNumber: 1 };
      }
    }
    if (!anilistMatch && this.overrides) {
      anilistMatch = this.overrides.resolveAniList(result.animeId, 'regular', 1);
    }
    if (!anilistMatch && this.aniBridge) {
      anilistMatch = this.aniBridge.resolveAniListMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
    }
    if (!anilistMatch && this.aniBridge) {
      anilistMatch = this.aniBridge.resolveAniList(result.animeId, 'regular', 1);
    }
    if (anilistMatch) {
      result.anilist = anilistMatch;
    }
    return result;
  }

  private resolveSpecial(
    series: SeriesLookupQuery,
    episodeNumber: number,
  ): AnimeEpisodeResult | null {
    // 1. Overrides
    if (this.overrides) {
      const siblings = this.getSiblingsFromAniBridge(this.overrides, series);
      if (siblings) {
        const match = this.overrides.placeSpecial(siblings, episodeNumber);
        if (match) {
          return {
            animeId: match.animeId,
            episodeNumber: match.episodeNumber,
            isSpecial: match.kind === 'special',
            kind: match.kind,
            source: 'overrides',
          };
        }
      }
    }

    // 2. AniBridge
    if (this.aniBridge) {
      const siblings = this.getSiblingsFromAniBridge(this.aniBridge, series);
      if (siblings) {
        const match = this.aniBridge.placeSpecial(siblings, episodeNumber);
        if (match) {
          return {
            animeId: match.animeId,
            episodeNumber: match.episodeNumber,
            isSpecial: match.kind === 'special',
            kind: match.kind,
            source: 'anibridge',
          };
        }
      }
    }

    // 3. AnimeList
    if (this.animeList && series.tvdbId) {
      const siblings = this.animeList.getEntriesForShow(series.tvdbId);
      if (siblings) {
        const match = this.animeList.placeSpecial(siblings, episodeNumber);
        if (match) {
          return {
            animeId: match.animeId,
            episodeNumber: match.episodeNumber,
            isSpecial: match.kind === 'special',
            kind: match.kind,
            source: 'animelist',
          };
        }
      }
    }

    return null;
  }

  private resolveRegularFromIndex(
    index: AniBridgeIndex | null,
    series: SeriesLookupQuery,
    seasonNumber: number,
    episodeNumber: number,
    source: 'overrides' | 'anibridge',
  ): AnimeEpisodeResult | null {
    if (!index) return null;

    const siblings = this.getSiblingsFromAniBridge(index, series);
    if (!siblings || siblings.length === 0) return null;

    const segments = index.placeSeason(siblings, seasonNumber);
    const segment = this.findMatchingSegment(segments, episodeNumber);
    if (!segment) return null;

    const offset = episodeNumber - segment.firstEpisodeNumber;
    return {
      animeId: segment.animeId,
      episodeNumber: segment.firstEpisodeInEntry + offset,
      isSpecial: segment.kind === 'special',
      kind: segment.kind,
      source,
    };
  }

  private resolveRegularFromAnimeList(
    series: SeriesLookupQuery,
    seasonNumber: number,
    episodeNumber: number,
  ): AnimeEpisodeResult | null {
    if (!this.animeList) return null;

    let siblings = series.tvdbId ? this.animeList.getEntriesForShow(series.tvdbId) : null;
    if (!siblings && series.anidbId) {
      const entry = this.animeList.entriesByAnimeId.get(series.anidbId);
      if (entry) {
        siblings = this.animeList.getEntriesForShow(entry.seriesKey);
      }
    }

    if (!siblings || siblings.length === 0) return null;

    const segments = this.animeList.placeSeason(siblings, seasonNumber);
    const segment = this.findMatchingSegment(segments, episodeNumber);
    if (!segment) return null;

    const offset = episodeNumber - segment.firstEpisodeNumber;
    return {
      animeId: segment.animeId,
      episodeNumber: segment.firstEpisodeInEntry + offset,
      isSpecial: false,
      kind: 'regular',
      source: 'animelist',
    };
  }

  private getSiblingsFromAniBridge(
    index: AniBridgeIndex,
    series: SeriesLookupQuery,
  ): AniBridgeEntry[] | null {
    if (series.tvdbId) {
      const entries = index.getEntriesForShow(series.tvdbId);
      if (entries) return entries;
    }

    if (series.tmdbId) {
      const entries = index.getEntriesForTmdbShow(series.tmdbId);
      if (entries) return entries;
    }

    if (series.anidbId) {
      const entries = index.getEntriesForAnimeId(series.anidbId);
      if (entries) return entries;
    }

    return null;
  }

  private findMatchingSegment(
    segments: AniDbSeasonSegment[],
    episodeNumber: number,
  ): AniDbSeasonSegment | null {
    for (const seg of segments) {
      if (episodeNumber < seg.firstEpisodeNumber) continue;

      if (seg.episodeCount === 0) {
        return seg;
      }

      if (episodeNumber < seg.firstEpisodeNumber + seg.episodeCount) {
        return seg;
      }
    }
    return null;
  }
}

export const defaultAnimeResolver = new AnimeResolver();

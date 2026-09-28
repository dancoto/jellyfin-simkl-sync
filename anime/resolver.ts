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

export interface ResolverOptions extends CacheOptions {
  overridesPath?: string;
  enableAnimeListFallback?: boolean;
}

export class AnimeResolver {
  private overrides: AniBridgeIndex | null = null;
  private aniBridge: AniBridgeIndex | null = null;
  private animeList: AnimeListIndex | null = null;
  private initialized = false;

  public async initialize(options: ResolverOptions = {}): Promise<void> {
    // 1. Load manual overrides
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
  ): void {
    this.aniBridge = aniBridge;
    this.overrides = overrides;
    this.animeList = animeList;
    this.initialized = true;
  }

  public resolveEpisode(
    series: SeriesLookupQuery,
    seasonNumber: number,
    episodeNumber: number,
  ): AnimeEpisodeResult | null {
    if (!this.initialized) {
      console.warn('AnimeResolver: queried before initialization.');
    }

    // 1. Check specials (Season 0)
    if (seasonNumber === 0) {
      return this.resolveSpecial(series, episodeNumber);
    }

    // 2. Regular Season: Check Overrides -> AniBridge -> AnimeList
    const overrideResult = this.resolveRegularFromIndex(
      this.overrides,
      series,
      seasonNumber,
      episodeNumber,
      'overrides',
    );
    if (overrideResult) return overrideResult;

    const aniBridgeResult = this.resolveRegularFromIndex(
      this.aniBridge,
      series,
      seasonNumber,
      episodeNumber,
      'anibridge',
    );
    if (aniBridgeResult) return aniBridgeResult;

    const animeListResult = this.resolveRegularFromAnimeList(series, seasonNumber, episodeNumber);
    if (animeListResult) return animeListResult;

    // Fallback: If anidbId was given directly and it's season 1
    if (series.anidbId && seasonNumber === 1) {
      return {
        animeId: series.anidbId,
        episodeNumber,
        isSpecial: false,
        kind: 'regular',
        source: 'overrides',
      };
    }

    return null;
  }

  public resolveMovie(movie: MovieLookupQuery): AnimeMovieResult | null {
    if (!this.initialized) {
      console.warn('AnimeResolver: queried before initialization.');
    }

    // 1. Overrides
    if (this.overrides) {
      const match = this.overrides.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        return {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'overrides',
        };
      }
    }

    // 2. AniBridge
    if (this.aniBridge) {
      const match = this.aniBridge.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        return {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'anibridge',
        };
      }
    }

    // 3. AnimeList
    if (this.animeList) {
      const match = this.animeList.resolveMovie(movie.tmdbId, movie.imdbId, movie.tvdbId);
      if (match) {
        return {
          animeId: match.animeId,
          episodeNumber: match.episodeNumber,
          source: 'animelist',
        };
      }
    }

    // 4. Fallback if anidbId directly passed
    if (movie.anidbId) {
      return {
        animeId: movie.anidbId,
        episodeNumber: 1,
        source: 'overrides',
      };
    }

    return null;
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

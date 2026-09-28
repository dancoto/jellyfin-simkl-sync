import type { AniBridgeEntry, AniBridgeSpan, AniDbSeasonSegment, EpisodeKind } from './models';
import { pair, rangeLength, readAllRanges, readTarget } from './range';
import { resolveSeasonSegments } from './segments';

export interface MovieClaim {
  animeId: string;
  episodeNumber: number;
  kind: EpisodeKind;
}

export class AniBridgeIndex {
  public readonly entriesByTvdb: Map<string, AniBridgeEntry[]> = new Map();
  public readonly entriesByTmdb: Map<string, AniBridgeEntry[]> = new Map();
  public readonly entriesByAnimeId: Map<string, AniBridgeEntry> = new Map();
  public readonly moviesByKey: Map<string, MovieClaim> = new Map();
  public readonly tvdbToTmdbShow: Map<string, string> = new Map();
  public readonly tmdbToTvdbShow: Map<string, string> = new Map();

  private readonly placements: Map<string, AniDbSeasonSegment[]> = new Map();

  public static parse(jsonStringOrObject: string | Record<string, any>): AniBridgeIndex {
    const rawData =
      typeof jsonStringOrObject === 'string'
        ? (JSON.parse(jsonStringOrObject) as Record<string, any>)
        : jsonStringOrObject;

    const index = new AniBridgeIndex();

    for (const [key, targets] of Object.entries(rawData)) {
      if (!key.startsWith('anidb:')) {
        continue;
      }

      // Format: anidb:<animeId>:<scope> where scope is R, S, or O
      const parts = key.split(':');
      if (parts.length < 3) continue;

      const animeId = parts[1]!;
      const scopeLetter = parts[2]!;
      const kind: EpisodeKind =
        scopeLetter === 'S' ? 'special' : scopeLetter === 'O' ? 'other' : 'regular';

      if (!targets || typeof targets !== 'object') continue;

      index.processEntryTargets(animeId, kind, targets);
    }

    return index;
  }

  private processEntryTargets(
    animeId: string,
    kind: EpisodeKind,
    targets: Record<string, any>,
  ): void {
    const spansByTvdb = new Map<string, AniBridgeSpan[]>();

    for (const [descriptor, mapping] of Object.entries(targets)) {
      if (typeof mapping !== 'object' || mapping === null) continue;

      // Handle movies: tmdb_movie:<id>, imdb_movie:<id>, tvdb_movie:<id>
      if (
        descriptor.startsWith('tmdb_movie:') ||
        descriptor.startsWith('imdb_movie:') ||
        descriptor.startsWith('tvdb_movie:')
      ) {
        this.processMovieTarget(animeId, kind, descriptor, mapping);
        continue;
      }

      // Handle shows: tvdb_show:<id>:s<season>, tmdb_show:<id>:s<season>
      if (descriptor.startsWith('tvdb_show:')) {
        this.processTvdbShowTarget(animeId, kind, descriptor, mapping, spansByTvdb);
      } else if (descriptor.startsWith('tmdb_show:')) {
        this.processTmdbShowTarget(animeId, descriptor);
      }
    }

    // Register entries by TVDB
    for (const [seriesKey, spans] of spansByTvdb.entries()) {
      const entry: AniBridgeEntry = {
        animeId,
        seriesKey,
        spans,
      };

      this.entriesByAnimeId.set(animeId, entry);

      let seriesList = this.entriesByTvdb.get(seriesKey);
      if (!seriesList) {
        seriesList = [];
        this.entriesByTvdb.set(seriesKey, seriesList);
      }
      seriesList.push(entry);
    }
  }

  private processMovieTarget(
    animeId: string,
    kind: EpisodeKind,
    descriptor: string,
    mapping: Record<string, any>,
  ): void {
    const colonIndex = descriptor.indexOf(':');
    const prefix = descriptor.slice(0, colonIndex);
    const rawId = descriptor.slice(colonIndex + 1).trim();

    let movieKey: string | null = null;
    if (prefix === 'tmdb_movie') {
      movieKey = `tmdb:${rawId}`;
    } else if (prefix === 'imdb_movie') {
      movieKey = `imdb:${rawId.toLowerCase()}`;
    } else if (prefix === 'tvdb_movie') {
      movieKey = `tvdb:${rawId}`;
    }

    if (!movieKey) return;

    // Mapping maps AniDB episode to 1, e.g. { "1": "1" } or { "3": "1" }
    for (const [inEntryEpStr] of Object.entries(mapping)) {
      const epNum = parseInt(inEntryEpStr, 10);
      if (Number.isInteger(epNum)) {
        this.moviesByKey.set(movieKey, {
          animeId,
          episodeNumber: epNum,
          kind,
        });
        break;
      }
    }
  }

  private processTvdbShowTarget(
    animeId: string,
    kind: EpisodeKind,
    descriptor: string,
    mapping: Record<string, any>,
    spansByTvdb: Map<string, AniBridgeSpan[]>,
  ): void {
    // Descriptor: tvdb_show:<showId>:s<season>
    const parts = descriptor.split(':');
    if (parts.length < 3) return;

    const showId = parts[1]!;
    const seasonStr = parts[2]!;
    if (!seasonStr.startsWith('s')) return;

    const season = parseInt(seasonStr.slice(1), 10);
    if (!Number.isInteger(season)) return;

    let spans = spansByTvdb.get(showId);
    if (!spans) {
      spans = [];
      spansByTvdb.set(showId, spans);
    }

    for (const [inEntryRaw, inSeasonRaw] of Object.entries(mapping)) {
      if (typeof inSeasonRaw !== 'string') continue;

      const inEntryRanges = readAllRanges(inEntryRaw);
      const targetParsed = readTarget(inSeasonRaw);

      if (!inEntryRanges || !targetParsed) continue;

      const paired = pair(inEntryRanges, targetParsed.ranges, targetParsed.ratio);
      for (const [inEntry, inSeason] of paired) {
        spans.push({
          season,
          inEntry,
          inSeason,
          kind,
        });
      }
    }
  }

  private processTmdbShowTarget(animeId: string, descriptor: string): void {
    // Descriptor: tmdb_show:<showId>:s<season>
    const parts = descriptor.split(':');
    if (parts.length < 3) return;
    const tmdbId = parts[1]!;

    // Link by entry if TVDB is known
    const entry = this.entriesByAnimeId.get(animeId);
    if (entry) {
      let tmdbList = this.entriesByTmdb.get(tmdbId);
      if (!tmdbList) {
        tmdbList = [];
        this.entriesByTmdb.set(tmdbId, tmdbList);
      }
      if (!tmdbList.includes(entry)) {
        tmdbList.push(entry);
      }
      this.tvdbToTmdbShow.set(entry.seriesKey, tmdbId);
      this.tmdbToTvdbShow.set(tmdbId, entry.seriesKey);
    }
  }

  public getEntriesForShow(seriesKey: string): AniBridgeEntry[] | null {
    return this.entriesByTvdb.get(seriesKey) ?? null;
  }

  public getEntriesForTmdbShow(tmdbId: string): AniBridgeEntry[] | null {
    const list = this.entriesByTmdb.get(tmdbId);
    if (list) return list;

    const tvdbId = this.tmdbToTvdbShow.get(tmdbId);
    return tvdbId ? this.getEntriesForShow(tvdbId) : null;
  }

  public getEntriesForAnimeId(animeId: string): AniBridgeEntry[] | null {
    const entry = this.entriesByAnimeId.get(animeId);
    if (!entry) return null;
    return this.getEntriesForShow(entry.seriesKey);
  }

  public placeSeason(siblings: AniBridgeEntry[], seasonNumber: number): AniDbSeasonSegment[] {
    if (seasonNumber < 1 || siblings.length === 0) {
      return [];
    }

    const seriesKey = siblings[0]!.seriesKey;
    const memoKey = `${seriesKey}/${seasonNumber}`;
    const cached = this.placements.get(memoKey);
    if (cached) {
      return cached;
    }

    const claimsByKind = new Map<EpisodeKind, AniDbSeasonSegment[]>();

    for (const entry of siblings) {
      for (const span of entry.spans) {
        if (span.season !== seasonNumber) continue;

        const epCount = rangeLength(span.inSeason) ?? 0;
        const segment: AniDbSeasonSegment = {
          animeId: entry.animeId,
          firstEpisodeNumber: span.inSeason.start,
          episodeCount: epCount,
          firstEpisodeInEntry: span.inEntry.start,
          kind: span.kind,
        };

        let list = claimsByKind.get(span.kind);
        if (!list) {
          list = [];
          claimsByKind.set(span.kind, list);
        }
        list.push(segment);
      }
    }

    const placed = resolveSeasonSegments(claimsByKind);
    this.placements.set(memoKey, placed);
    return placed;
  }

  public placeSpecial(
    siblings: AniBridgeEntry[],
    episodeNumber: number,
  ): { animeId: string; episodeNumber: number; kind: EpisodeKind } | null {
    let holder: AniBridgeEntry | null = null;
    let narrowest: AniBridgeSpan | null = null;

    for (const entry of siblings) {
      for (const span of entry.spans) {
        if (span.season !== 0) continue;
        if (episodeNumber < span.inSeason.start) continue;
        if (span.inSeason.end !== null && episodeNumber > span.inSeason.end) continue;

        const number = span.inEntry.start + (episodeNumber - span.inSeason.start);
        if (span.inEntry.end !== null && number > span.inEntry.end) {
          continue;
        }

        const spanSeasonLen = rangeLength(span.inSeason) ?? Number.MAX_SAFE_INTEGER;
        const narrowestLen = narrowest
          ? (rangeLength(narrowest.inSeason) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER;

        if (narrowest === null || spanSeasonLen < narrowestLen) {
          holder = entry;
          narrowest = span;
        }
      }
    }

    if (!holder || !narrowest) {
      return null;
    }

    const resolvedEpisode = narrowest.inEntry.start + (episodeNumber - narrowest.inSeason.start);

    return {
      animeId: holder.animeId,
      episodeNumber: resolvedEpisode,
      kind: narrowest.kind,
    };
  }

  public resolveMovie(tmdbId?: string, imdbId?: string, tvdbId?: string): MovieClaim | null {
    if (tmdbId) {
      const match = this.moviesByKey.get(`tmdb:${tmdbId}`);
      if (match) return match;
    }
    if (imdbId) {
      const match = this.moviesByKey.get(`imdb:${imdbId.toLowerCase()}`);
      if (match) return match;
    }
    if (tvdbId) {
      const match = this.moviesByKey.get(`tvdb:${tvdbId}`);
      if (match) return match;
    }
    return null;
  }
}

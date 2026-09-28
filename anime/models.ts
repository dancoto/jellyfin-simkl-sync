export type EpisodeKind = 'regular' | 'special' | 'other';

export interface AniBridgeRange {
  start: number;
  end: number | null;
}

export interface AniBridgeSpan {
  season: number;
  inEntry: AniBridgeRange;
  inSeason: AniBridgeRange;
  kind: EpisodeKind;
}

export interface AniBridgeEntry {
  animeId: string;
  seriesKey: string;
  spans: AniBridgeSpan[];
}

export interface AniDbSeasonSegment {
  animeId: string;
  firstEpisodeNumber: number;
  episodeCount: number;
  firstEpisodeInEntry: number;
  kind: EpisodeKind;
}

export interface AnimeEpisodeResult {
  animeId: string;
  episodeNumber: number;
  isSpecial: boolean;
  kind: EpisodeKind;
  source: 'overrides' | 'anibridge' | 'animelist';
}

export interface AnimeMovieResult {
  animeId: string;
  episodeNumber: number;
  source: 'overrides' | 'anibridge' | 'animelist';
}

export interface SeriesLookupQuery {
  tvdbId?: string;
  tmdbId?: string;
  anidbId?: string;
}

export interface MovieLookupQuery {
  tmdbId?: string;
  imdbId?: string;
  tvdbId?: string;
  anidbId?: string;
}

export const WATCH_STATUS = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  HOLD: 'hold',
} as const;

export type WatchStatus = (typeof WATCH_STATUS)[keyof typeof WATCH_STATUS];

export type Show = {
  title?: string;
  ids: {
    anidb?: string;
    tvdb?: string;
    tmdb?: string;
    imdb?: string;
    [key: string]: any;
  };
  seasons: Season[];
};

export type Season = {
  number: number;
  episodes: Episode[];
};

export type Episode = {
  number: number;
};

export type Movie = {
  title?: string;
  ids: {
    anidb?: string;
    tmdb?: string;
    imdb?: string;
    tvdb?: string;
    [key: string]: any;
  };
  status?: WatchStatus;
};

export type TVPayload = {
  shows: Show[];
};

export type MoviePayload = {
  movies: Movie[];
};

export type SyncResponse = {
  added: {
    movies: number;
    shows: number;
    episodes: number;
    statuses: {
      request: {
        ids: {
          anidb?: string;
          [key: string]: any;
        };
        type: string;
      };
    }[];
  };
  not_found: {
    movies: any[];
    shows: any[];
    episodes: any[];
  };
};

export interface ScrobbleIds {
  simkl?: number;
  anidb?: number | string;
  tvdb?: number | string;
  tmdb?: number | string;
  imdb?: string;
  slug?: string;
}

export interface ScrobbleShow {
  title?: string;
  year?: number;
  ids?: ScrobbleIds;
}

export interface ScrobbleEpisode {
  season?: number;
  number?: number;
  ids?: ScrobbleIds;
}

export interface ScrobbleMovie {
  title?: string;
  year?: number;
  ids?: ScrobbleIds;
}

export interface ScrobbleRequest {
  progress?: number;
  show?: ScrobbleShow;
  episode?: ScrobbleEpisode;
  movie?: ScrobbleMovie;
}

export type ScrobbleResult =
  | { success: true; id: string; watchStatus: WatchStatus; skipped: false }
  | { success: true; skipped: true }
  | { success: false; reason: 'not_found' | 'api_error'; anidbId: string };

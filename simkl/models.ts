type Show = {
  ids: {
    anidb: string;
  };
  seasons: Season[];
};
type Season = {
  number: number;
  episodes: Episode[];
};
type Episode = {
  number: number;
};

type Movie = {
  ids: {
    anidb: string;
  };
  status: WatchStatus;
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
          anidb: string;
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

export const WATCH_STATUS = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  HOLD: 'hold',
} as const;

export type WatchStatus = (typeof WATCH_STATUS)[keyof typeof WATCH_STATUS];

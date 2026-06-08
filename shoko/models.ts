export type ShokoResponse = {
  IDs: {
    TMDB: {
      Movie: number[];
    };
  };
  AniDB: {
    AnimeID: number;
    Type: string;
    EpisodeNumber: number;
  };
};

export interface ShokoEpisode extends ShokoMovie {
  isSpecial: boolean;
  episodeNumber: number;
}

export interface ShokoMovie {
  anidbId: string;
}

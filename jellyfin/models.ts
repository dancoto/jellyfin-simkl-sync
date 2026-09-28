export interface RawJellyfinPayload extends Record<string, any> {
  NotificationType?: string;
  NotificationUsername?: string;
  Username?: string;
  UserId?: string;
  ItemType?: string;
  ItemId?: string;
  Name?: string;
  SeriesName?: string;
  SeriesId?: string;
  SeasonNumber?: number;
  EpisodeNumber?: number;
  EpisodeNumberEnd?: number;
  IndexNumberEnd?: number;
  Year?: number;
  PlaybackPositionTicks?: number;
  RunTimeTicks?: number;
  Played?: boolean;
  LibraryName?: string;
  Library?: string;
  CollectionName?: string;
  Path?: string;
}

export interface NormalizedPlaybackEvent {
  notificationType: string;
  username: string;
  itemType: 'Episode' | 'Movie' | 'Other';
  itemId?: string;
  name: string;
  seriesName?: string;
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeNumberEnd?: number;
  year?: number;
  libraryName?: string;
  path?: string;
  playbackPositionTicks: number;
  runTimeTicks: number;
  progressPercentage: number;
  isCompleted: boolean;
  providerIds: {
    tvdb?: string;
    tmdb?: string;
    imdb?: string;
    anidb?: string;
    [key: string]: string | undefined;
  };
  seriesProviderIds: {
    tvdb?: string;
    tmdb?: string;
    imdb?: string;
    anidb?: string;
    [key: string]: string | undefined;
  };
}

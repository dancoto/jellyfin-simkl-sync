import { describe, expect, test } from 'bun:test';
import { isAnimeLibrary, normalizeJellyfinWebhook } from './normalizer';

describe('Jellyfin Webhook Normalizer', () => {
  test('isAnimeLibrary helper should identify anime libraries case-insensitively', () => {
    expect(isAnimeLibrary('Anime')).toBe(true);
    expect(isAnimeLibrary('Anime Shows')).toBe(true);
    expect(isAnimeLibrary('ANIME MOVIES')).toBe(true);
    expect(isAnimeLibrary('my-anime-collection')).toBe(true);

    expect(isAnimeLibrary('TV Shows')).toBe(false);
    expect(isAnimeLibrary('Movies')).toBe(false);
    expect(isAnimeLibrary('Documentaries')).toBe(false);
    expect(isAnimeLibrary(undefined)).toBe(false);
    expect(isAnimeLibrary(null)).toBe(false);
  });

  test('should normalize Episode webhook with flat Provider_ keys and LibraryName', () => {
    const raw = {
      NotificationType: 'PlaybackStop',
      NotificationUsername: 'daniel',
      ItemType: 'Episode',
      Name: 'The Journey Begins',
      SeriesName: 'Frieren: Beyond Journey’s End',
      SeriesId: 'series-guid-123',
      LibraryName: 'Anime Shows',
      SeasonNumber: 1,
      EpisodeNumber: 5,
      Year: 2023,
      PlaybackPositionTicks: 9000000000,
      RunTimeTicks: 10000000000, // 90%
      Provider_tvdb: '10052',
      Provider_tmdb: '209867',
      Series_Provider_tvdb: '439265',
    };

    const event = normalizeJellyfinWebhook(raw);

    expect(event.notificationType).toBe('PlaybackStop');
    expect(event.username).toBe('daniel');
    expect(event.itemType).toBe('Episode');
    expect(event.name).toBe('The Journey Begins');
    expect(event.seriesName).toBe('Frieren: Beyond Journey’s End');
    expect(event.seriesId).toBe('series-guid-123');
    expect(event.libraryName).toBe('Anime Shows');
    expect(event.seasonNumber).toBe(1);
    expect(event.episodeNumber).toBe(5);
    expect(event.progressPercentage).toBe(90);
    expect(event.isCompleted).toBe(true);
    expect(event.providerIds.tvdb).toBe('10052');
    expect(event.providerIds.tmdb).toBe('209867');
    expect(event.seriesProviderIds.tvdb).toBe('439265');
  });

  test('should normalize Movie webhook with nested ProviderIds', () => {
    const raw = {
      NotificationType: 'PlaybackStop',
      NotificationUsername: 'diana',
      ItemType: 'Movie',
      Name: 'Princess Mononoke',
      Library: 'Anime Movies',
      Year: 1997,
      PlaybackPositionTicks: 8500000000,
      RunTimeTicks: 10000000000, // 85%
      ProviderIds: {
        Tmdb: '128',
        Imdb: 'tt0119698',
      },
    };

    const event = normalizeJellyfinWebhook(raw);

    expect(event.itemType).toBe('Movie');
    expect(event.username).toBe('diana');
    expect(event.libraryName).toBe('Anime Movies');
    expect(event.isCompleted).toBe(true);
    expect(event.providerIds.tmdb).toBe('128');
    expect(event.providerIds.imdb).toBe('tt0119698');
  });

  test('should mark incomplete if progress < 80%', () => {
    const raw = {
      NotificationType: 'PlaybackStop',
      NotificationUsername: 'daniel',
      ItemType: 'Episode',
      PlaybackPositionTicks: 5000000000,
      RunTimeTicks: 10000000000, // 50%
      Played: false,
    };

    const event = normalizeJellyfinWebhook(raw);
    expect(event.progressPercentage).toBe(50);
    expect(event.isCompleted).toBe(false);
  });

  test('should mark complete if Played is true regardless of ticks', () => {
    const raw = {
      NotificationType: 'UserDataSaved',
      NotificationUsername: 'daniel',
      ItemType: 'Episode',
      PlaybackPositionTicks: 0,
      RunTimeTicks: 0,
      Played: true,
    };

    const event = normalizeJellyfinWebhook(raw);
    expect(event.isCompleted).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { AniBridgeIndex, defaultAnimeResolver } from './anime';
import { defaultJellyfinClient } from './jellyfin';
import { handleWebhook } from './main';
import { appConfig } from './shared/config';

describe('Main Webhook Handler', () => {
  let fetchMock: any;
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.jellyfin = { url: 'http://jellyfin-mock:8096', token: 'mock-jf-token' };
    appConfig.simkl = {
      app_name: 'mock-simkl-app',
      client_id: 'mock-simkl-client-id',
      users: { 'test-user': 'mock-simkl-user-token' },
    };
    appConfig.ntfy = {
      url: 'http://ntfy-mock',
      token: 'mock-ntfy-token',
      topic: 'mock-ntfy-topic',
    };

    // Setup AniBridge test mappings in resolver
    const testAniBridge = AniBridgeIndex.parse({
      // Attack on Titan TVDB 267440 Season 1 -> AniDB 9541
      'anidb:9541:R': {
        'tvdb_show:267440:s1': { '1-25': '1-25' },
      },
      // Test Movie: TMDB 54321 -> AniDB 54321
      'anidb:54321:R': {
        'tmdb_movie:54321': { '1': '1' },
      },
      // Valid Movie: TMDB 12345 -> AniDB 12345
      'anidb:12345:R': {
        'tmdb_movie:12345': { '1': '1' },
      },
    });
    defaultAnimeResolver.setIndices(testAniBridge);
    defaultJellyfinClient.clearCache();

    fetchMock = mock((urlInput: string | URL, options?: any) => {
      const url = urlInput.toString();

      // Mock Jellyfin API: GET /Items/{id}/Ancestors
      if (url.includes('/Ancestors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { Name: 'Season 1', Type: 'Season' },
              { Name: 'Attack on Titan', Type: 'Series' },
              { Name: 'Anime TV', Type: 'CollectionFolder' },
            ]),
          ),
        );
      }

      // Mock Jellyfin API: GET /Items/{SeriesId} or /Items?ids={SeriesId}
      if (url.includes('series-jf-1')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              Id: 'series-jf-1',
              Name: 'Attack on Titan',
              ProviderIds: {
                Tvdb: '267440',
              },
              Items: [
                {
                  Id: 'series-jf-1',
                  Name: 'Attack on Titan',
                  ProviderIds: {
                    Tvdb: '267440',
                  },
                },
              ],
            }),
          ),
        );
      }

      // Mock Simkl API: /sync/history
      if (url.includes('api.simkl.com/sync/history')) {
        const body = JSON.parse(options?.body || '{}');
        const isMovie = 'movies' in body;
        const anidbId = isMovie ? body.movies?.[0]?.ids?.anidb : body.shows?.[0]?.ids?.anidb;
        const isNotFoundTest = anidbId === '54321'; // AniDB 54321 simulates not_found

        return Promise.resolve(
          new Response(
            JSON.stringify({
              added: {
                movies: isMovie && !isNotFoundTest ? 1 : 0,
                shows: !isMovie && !isNotFoundTest ? 1 : 0,
                episodes: !isMovie && !isNotFoundTest ? 1 : 0,
                statuses: isNotFoundTest
                  ? []
                  : [
                      {
                        request: {
                          ids: isMovie ? body.movies?.[0]?.ids : body.shows?.[0]?.ids,
                          type: isMovie ? 'movie' : 'show',
                        },
                      },
                    ],
              },
              not_found: {
                movies: isMovie && isNotFoundTest ? [anidbId] : [],
                shows: !isMovie && isNotFoundTest ? [anidbId] : [],
                episodes: !isMovie && isNotFoundTest ? [anidbId] : [],
              },
            }),
          ),
        );
      }

      // Default mock response for ntfy
      return Promise.resolve(new Response(JSON.stringify({ ok: true })));
    });

    global.fetch = fetchMock;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  test('should exit early if user has no Simkl token', async () => {
    const payload: any = {
      NotificationUsername: 'unknown-user',
    };

    await handleWebhook(payload);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('should exit early if playback is not completed (< 80%)', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 200, // 20%
    };

    await handleWebhook(payload);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('should route to anime pipeline when LibraryName contains Anime', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      Name: 'To You, in 2000 Years',
      SeriesName: 'Attack on Titan',
      LibraryName: 'Anime Shows',
      SeasonNumber: 1,
      EpisodeNumber: 1,
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900, // 90%
      Series_Provider_tvdb: '267440',
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.shows[0].ids.anidb).toBe('9541');
    expect(simklBody.shows[0].seasons[0].episodes[0].number).toBe(1);
  });

  test('should route to standard pipeline when LibraryName does not contain Anime', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      Name: 'Pilot',
      SeriesName: 'Breaking Bad',
      LibraryName: 'TV Shows',
      SeasonNumber: 1,
      EpisodeNumber: 1,
      Year: 2008,
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Series_Provider_tvdb: '81189',
      Series_Provider_tmdb: '1396',
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    // Should NOT have anidb ID! Should have TVDB/TMDB
    expect(simklBody.shows[0].ids.tvdb).toBe('81189');
    expect(simklBody.shows[0].ids.tmdb).toBe('1396');
    expect(simklBody.shows[0].title).toBe('Breaking Bad');
  });

  test('should route standard movie when Library is Movies', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Movie',
      Name: 'Inception',
      Library: 'Movies',
      Year: 2010,
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Provider_tmdb: '27205',
      Provider_imdb: 'tt1375666',
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.movies[0].title).toBe('Inception');
    expect(simklBody.movies[0].ids.tmdb).toBe('27205');
    expect(simklBody.movies[0].ids.imdb).toBe('tt1375666');
  });

  test('should query Jellyfin for library name and series metadata when missing in payload', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      Name: 'To You, in 2000 Years',
      SeriesName: 'Attack on Titan',
      SeriesId: 'series-jf-1',
      SeasonNumber: 1,
      EpisodeNumber: 2,
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    // 1 call for Ancestors (library name), 1 call for Series metadata, 1 call for Simkl
    expect(calls.length).toBe(3);

    expect(calls[0][0].toString()).toContain('/Ancestors');
    expect(calls[1][0].toString()).toContain('series-jf-1');
    expect(calls[2][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[2][1].body);
    expect(simklBody.shows[0].ids.anidb).toBe('9541');
    expect(simklBody.shows[0].seasons[0].episodes[0].number).toBe(2);
  });

  test('should send ntfy notification if movie returns not_found', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Movie',
      Name: 'Not Found Anime Movie',
      LibraryName: 'Anime Movies',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Provider_tmdb: '54321', // Triggers not_found in our mock
    };

    await handleWebhook(payload);

    // Yield execution for fetch promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(2);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    expect(calls[1][0].toString()).toBe('http://ntfy-mock');

    const ntfyBody = JSON.parse(calls[1][1].body);
    expect(ntfyBody).toEqual({
      title: 'Failed to update Simkl for anime movie',
      message: 'Item: Not Found Anime Movie\nID: 54321\nLink: https://anidb.net/anime/54321',
      priority: 4,
      topic: 'mock-ntfy-topic',
    });
  });

  test('should fallback to standard pipeline if anime episode is NOT a special and has NO matching AniDB mapping', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      SeriesName: 'Unmapped Anime',
      Name: 'Episode 1',
      SeasonNumber: 1,
      EpisodeNumber: 1,
      LibraryName: 'Anime Shows',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Series_Provider_tvdb: '999999',
      Series_Provider_tmdb: '888888',
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.shows[0].title).toBe('Unmapped Anime');
    expect(simklBody.shows[0].ids.tvdb).toBe('999999');
    expect(simklBody.shows[0].ids.tmdb).toBe('888888');
    expect(simklBody.shows[0].ids.anidb).toBeUndefined();
    expect(simklBody.shows[0].seasons[0].number).toBe(1);
    expect(simklBody.shows[0].seasons[0].episodes[0].number).toBe(1);
  });

  test('should skip scrobble if anime episode is a special (S0) and has NO matching AniDB mapping', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      SeriesName: 'Unmapped Anime',
      Name: 'Special 1',
      SeasonNumber: 0,
      EpisodeNumber: 1,
      LibraryName: 'Anime Shows',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Series_Provider_tvdb: '999999',
    };

    await handleWebhook(payload);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('should debounce and batch multiple rapid episode completions of a season into a single Simkl request', async () => {
    // Simulate user marking 5 episodes of Attack on Titan watched at once
    for (let ep = 1; ep <= 5; ep++) {
      handleWebhook(
        {
          NotificationUsername: 'test-user',
          ItemType: 'Episode',
          Name: `Episode ${ep}`,
          SeriesName: 'Attack on Titan',
          LibraryName: 'Anime Shows',
          SeasonNumber: 1,
          EpisodeNumber: ep,
          NotificationType: 'PlaybackStop',
          RunTimeTicks: 1000,
          PlaybackPositionTicks: 900,
          Series_Provider_tvdb: '267440',
        } as any,
        { debounceMs: 50 },
      );
    }

    // Immediately after, no Simkl fetch should have fired yet
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // Wait 100ms for debounce timer to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Exactly 1 batch request sent to Simkl containing all 5 episodes!
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calls = fetchMock.mock.calls;
    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');

    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.shows.length).toBe(1);
    expect(simklBody.shows[0].ids.anidb).toBe('9541');
    expect(simklBody.shows[0].seasons.length).toBe(1);
    expect(simklBody.shows[0].seasons[0].number).toBe(1);
    expect(simklBody.shows[0].seasons[0].episodes.length).toBe(5);
    expect(simklBody.shows[0].seasons[0].episodes.map((e: any) => e.number)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  test('should fallback to standard movie pipeline if anime movie has NO matching AniDB mapping', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Movie',
      Name: 'Voltage Fighter Gowcaizer',
      LibraryName: 'anime-movies',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Provider_tmdb: '94505',
      Provider_imdb: 'tt0204034',
      Provider_tvdb: '202176',
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.movies).toBeDefined();
    expect(simklBody.movies.length).toBe(1);
    expect(simklBody.movies[0].title).toBe('Voltage Fighter Gowcaizer');
    expect(simklBody.movies[0].ids.tmdb).toBe('94505');
    expect(simklBody.movies[0].ids.imdb).toBe('tt0204034');
    expect(simklBody.movies[0].ids.tvdb).toBe('202176');
  });

  test('should handle multi-episode file (e.g. S01E01-E02) by batching all episodes in range', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      ItemType: 'Episode',
      SeriesName: 'Attack on Titan',
      Name: 'Episode 1 & 2',
      SeasonNumber: 1,
      EpisodeNumber: 1,
      IndexNumberEnd: 2,
      LibraryName: 'Anime Shows',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
      Series_Provider_tvdb: '267440',
    };

    await handleWebhook(payload, { debounceMs: 50 });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(1);

    expect(calls[0][0].toString()).toContain('api.simkl.com/sync/history');
    const simklBody = JSON.parse(calls[0][1].body);
    expect(simklBody.shows.length).toBe(1);
    expect(simklBody.shows[0].ids.anidb).toBe('9541');
    expect(simklBody.shows[0].seasons[0].episodes.map((e: any) => e.number)).toEqual([1, 2]);
  });
});

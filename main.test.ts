import { test, expect, mock, describe, beforeEach, afterEach } from 'bun:test';
import { appConfig } from './shared/config';
import { handleWebhook } from './main';

describe('Main Webhook Handler', () => {
  let fetchMock: any;
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.shoko = { url: 'http://shoko-mock', token: 'mock-shoko-token' };
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

    fetchMock = mock((urlInput: string | URL, options?: any) => {
      const url = urlInput.toString();

      // Mock Shoko API
      if (url.includes('/api/v3/Episode/')) {
        // Return movie for episode 99999 mock, series for others
        const isMovieTest = url.includes('99999');
        if (isMovieTest) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                IDs: { TMDB: { Movie: [54321] } },
                AniDB: { AnimeID: 54321, Type: 'Movie', EpisodeNumber: 1 },
              }),
            ),
          );
        } else {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                IDs: { TMDB: { Movie: [] } },
                AniDB: { AnimeID: 12345, Type: 'Regular', EpisodeNumber: 5 },
              }),
            ),
          );
        }
      }

      // Mock Simkl API
      if (url.includes('api.simkl.com/sync/history')) {
        const body = JSON.parse(options?.body || '{}');
        const isMovie = 'movies' in body;
        const anidbId = isMovie ? body.movies?.[0]?.ids?.anidb : body.shows?.[0]?.ids?.anidb;
        const isNotFoundTest = anidbId === '54321'; // We use movie 54321 to test not found

        return Promise.resolve(
          new Response(
            JSON.stringify({
              added: {
                movies: isMovie && !isNotFoundTest ? 1 : 0,
                shows: !isMovie && !isNotFoundTest ? 1 : 0,
                episodes: !isMovie && !isNotFoundTest ? 1 : 0,
                statuses: isNotFoundTest
                  ? []
                  : [{ request: { ids: { anidb: anidbId }, type: isMovie ? 'movie' : 'show' } }],
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

  test('should exit early if no shoko episode ID is present', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
    };

    await handleWebhook(payload);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('should call fetchAnidb and scrobbleAnimeEpisode for a series', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      'Provider_shoko episode': '999',
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
    };

    await handleWebhook(payload);

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(2);

    expect(calls[0][0].toString()).toContain('/api/v3/Episode/999');
    expect(calls[1][0].toString()).toContain('api.simkl.com/sync/history');
  });

  test('should send notification if scrobbling returns not_found error', async () => {
    const payload: any = {
      NotificationUsername: 'test-user',
      'Provider_shoko episode': '99999', // Trigger movie TMDB return in our mock
      NotificationType: 'PlaybackStop',
      RunTimeTicks: 1000,
      PlaybackPositionTicks: 900,
    };

    await handleWebhook(payload);

    // Yield execution for fetch promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBe(3);

    expect(calls[0][0].toString()).toContain('/api/v3/Episode/99999');
    expect(calls[1][0].toString()).toContain('api.simkl.com/sync/history');
    expect(calls[2][0].toString()).toBe('http://ntfy-mock');

    const ntfyBody = JSON.parse(calls[2][1].body);
    expect(ntfyBody).toEqual({
      title: 'Failed to update Simkl for movie',
      message: 'AniDB ID: 54321\nLink: https://anidb.net/anime/54321',
      priority: 4,
      topic: 'mock-ntfy-topic',
    });
  });
});

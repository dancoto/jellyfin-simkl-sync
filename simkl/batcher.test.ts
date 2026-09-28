import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { appConfig } from '../shared/config';
import { buildSyncPayload, enqueueScrobble } from './batcher';

describe('Simkl Scrobble Batcher & Debouncer', () => {
  let originalConfig: any;
  let fetchMock: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.simkl.client_id = 'test-client-id';
    appConfig.simkl.app_name = 'test-app';

    fetchMock = mock(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            added: { movies: 1, shows: 1, episodes: 12, statuses: [] },
            not_found: { movies: [], shows: [], episodes: [] },
          }),
        ),
      );
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  test('buildSyncPayload should group 12 episodes of the same anime season into 1 show entry', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      kind: 'anime_episode' as const,
      animeId: '9541',
      episodeNumber: i + 1,
      isSpecial: false,
      seriesName: 'Attack on Titan',
      episodeName: `Episode ${i + 1}`,
    }));

    const { payload } = buildSyncPayload(items);

    expect(payload.movies).toBeUndefined();
    expect(payload.shows).toBeDefined();
    expect(payload.shows?.length).toBe(1);

    const show = payload.shows![0]!;
    expect(show.ids.anidb).toBe('9541');
    expect(show.seasons.length).toBe(1);
    expect(show.seasons[0]!.number).toBe(1);
    expect(show.seasons[0]!.episodes.length).toBe(12);
    expect(show.seasons[0]!.episodes.map((e) => e.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  test('buildSyncPayload should group standard TV show episodes and movies together', () => {
    const items: any[] = [
      {
        kind: 'standard_episode',
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        ids: { tvdb: '81189' },
        episodeName: 'Pilot',
      },
      {
        kind: 'standard_episode',
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 2,
        ids: { tvdb: '81189' },
        episodeName: 'Cat in the Bag...',
      },
      {
        kind: 'standard_movie',
        name: 'Inception',
        ids: { tmdb: '27205' },
      },
    ];

    const { payload } = buildSyncPayload(items);

    expect(payload.shows?.length).toBe(1);
    expect(payload.shows![0]!.ids.tvdb).toBe('81189');
    expect(payload.shows![0]!.seasons[0]!.episodes.length).toBe(2);

    expect(payload.movies?.length).toBe(1);
    expect(payload.movies![0]!.title).toBe('Inception');
    expect(payload.movies![0]!.ids.tmdb).toBe('27205');
  });

  test('enqueueScrobble should debounce multiple rapid calls into 1 single POST request', async () => {
    const username = 'binge-user';
    const token = 'token-123';

    // Send 10 rapid episodes with 50ms debounce
    for (let i = 1; i <= 10; i++) {
      enqueueScrobble(
        username,
        token,
        {
          kind: 'anime_episode',
          animeId: '9541',
          episodeNumber: i,
          isSpecial: false,
        },
        { debounceMs: 50 },
      );
    }

    // Immediately after queueing, fetch should not have fired yet
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // Wait 100ms for debounce timer to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Exactly 1 request should have been made for all 10 episodes!
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('api.simkl.com/sync/history');

    const sentBody = JSON.parse(options.body);
    expect(sentBody.shows.length).toBe(1);
    expect(sentBody.shows[0].seasons[0].episodes.length).toBe(10);
  });
});

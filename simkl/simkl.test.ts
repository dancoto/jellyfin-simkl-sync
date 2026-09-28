import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { NormalizedPlaybackEvent } from '../jellyfin/models';
import { appConfig } from '../shared/config';
import { WATCH_STATUS } from './models';
import {
  scrobbleAnimeEpisode,
  scrobbleAnimeMovie,
  scrobbleStandardEpisode,
  scrobbleStandardMovie,
} from './simkl';

describe('Simkl Scrobbler', () => {
  let fetchMock: any;
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.jellyfin = { url: 'http://jellyfin-mock:8096', token: 'mock-token' };
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

    fetchMock = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            added: {
              movies: 1,
              shows: 1,
              episodes: 1,
              statuses: [
                {
                  request: {
                    ids: { anidb: '12345', tvdb: '81189' },
                    type: 'movie',
                  },
                },
              ],
            },
            not_found: {
              movies: [],
              shows: [],
              episodes: [],
            },
          }),
        ),
      ),
    );
    global.fetch = fetchMock;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  describe('scrobbleAnimeEpisode', () => {
    test('should skip scrobbling if not completed', async () => {
      const animeEpisode = {
        animeId: '12345',
        episodeNumber: 1,
        isSpecial: false,
      };

      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStart',
        username: 'test-user',
        itemType: 'Episode',
        name: 'Ep 1',
        runTimeTicks: 1000,
        playbackPositionTicks: 100, // 10%
        progressPercentage: 10,
        isCompleted: false,
        providerIds: {},
        seriesProviderIds: {},
      };

      const result = await scrobbleAnimeEpisode(animeEpisode, event, 'user-token');

      expect(result).toEqual({ success: true, skipped: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('should scrobble if completed', async () => {
      const animeEpisode = {
        animeId: '12345',
        episodeNumber: 1,
        isSpecial: false,
      };

      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStop',
        username: 'test-user',
        itemType: 'Episode',
        name: 'Ep 1',
        runTimeTicks: 1000,
        playbackPositionTicks: 900, // 90%
        progressPercentage: 90,
        isCompleted: true,
        providerIds: {},
        seriesProviderIds: {},
      };

      const result = await scrobbleAnimeEpisode(animeEpisode, event, 'user-token');

      expect(result.success).toBe(true);
      if (result.success && !result.skipped) {
        expect(result.watchStatus).toBe(WATCH_STATUS.COMPLETED);
      }
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('scrobbleAnimeMovie', () => {
    test('should scrobble movie with watching status if incomplete', async () => {
      const animeMovie = { animeId: '54321', episodeNumber: 1 };
      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStart',
        username: 'test-user',
        itemType: 'Movie',
        name: 'Movie Title',
        runTimeTicks: 1000,
        playbackPositionTicks: 100,
        progressPercentage: 10,
        isCompleted: false,
        providerIds: {},
        seriesProviderIds: {},
      };

      const result = await scrobbleAnimeMovie(animeMovie, event, 'user-token');

      expect(result.success).toBe(true);
      if (result.success && !result.skipped) {
        expect(result.watchStatus).toBe(WATCH_STATUS.WATCHING);
      }
      expect(fetchMock).toHaveBeenCalled();
    });

    test('should scrobble movie with completed status if completed', async () => {
      const animeMovie = { animeId: '54321', episodeNumber: 1 };
      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStop',
        username: 'test-user',
        itemType: 'Movie',
        name: 'Movie Title',
        runTimeTicks: 1000,
        playbackPositionTicks: 900,
        progressPercentage: 90,
        isCompleted: true,
        providerIds: {},
        seriesProviderIds: {},
      };

      const result = await scrobbleAnimeMovie(animeMovie, event, 'user-token');

      expect(result.success).toBe(true);
      if (result.success && !result.skipped) {
        expect(result.watchStatus).toBe(WATCH_STATUS.COMPLETED);
      }
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('scrobbleStandardEpisode (Non-Anime)', () => {
    test('should scrobble standard episode using TVDB/TMDB/IMDb IDs', async () => {
      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStop',
        username: 'test-user',
        itemType: 'Episode',
        name: 'Pilot',
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        year: 2008,
        runTimeTicks: 1000,
        playbackPositionTicks: 950,
        progressPercentage: 95,
        isCompleted: true,
        providerIds: { tvdb: '100' },
        seriesProviderIds: { tvdb: '81189', tmdb: '1396' },
      };

      const result = await scrobbleStandardEpisode(event, 'user-token');

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalled();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url.toString()).toContain('api.simkl.com/sync/history');
      const body = JSON.parse(options.body);
      expect(body.shows[0].title).toBe('Breaking Bad');
      expect(body.shows[0].ids.tvdb).toBe('81189');
      expect(body.shows[0].ids.tmdb).toBe('1396');
      expect(body.shows[0].seasons[0].number).toBe(1);
      expect(body.shows[0].seasons[0].episodes[0].number).toBe(1);
    });
  });

  describe('scrobbleStandardMovie (Non-Anime)', () => {
    test('should scrobble standard movie using TMDB/IMDb IDs', async () => {
      const event: NormalizedPlaybackEvent = {
        notificationType: 'PlaybackStop',
        username: 'test-user',
        itemType: 'Movie',
        name: 'Inception',
        year: 2010,
        runTimeTicks: 1000,
        playbackPositionTicks: 900,
        progressPercentage: 90,
        isCompleted: true,
        providerIds: { tmdb: '27205', imdb: 'tt1375666' },
        seriesProviderIds: {},
      };

      const result = await scrobbleStandardMovie(event, 'user-token');

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalled();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url.toString()).toContain('api.simkl.com/sync/history');
      const body = JSON.parse(options.body);
      expect(body.movies[0].title).toBe('Inception');
      expect(body.movies[0].ids.tmdb).toBe('27205');
      expect(body.movies[0].ids.imdb).toBe('tt1375666');
    });
  });
});

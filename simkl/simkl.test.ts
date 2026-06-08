import { test, expect, mock, describe, beforeEach, afterEach } from 'bun:test';
import { appConfig } from '../shared/config';
import { scrobbleAnimeEpisode, scrobbleAnimeMovie } from './simkl';
import { WATCH_STATUS } from './models';

describe('Simkl Scrobbler', () => {
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

    // Reset global fetch mock
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
                    ids: { anidb: '12345' },
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
    test('should skip scrobbling if watch status is not COMPLETED', async () => {
      const shokoEpisode = {
        anidbId: '12345',
        episodeNumber: 1,
        isSpecial: false,
      };

      const payload: any = {
        NotificationType: 'PlaybackStart',
        RunTimeTicks: 1000,
        PlaybackPositionTicks: 100, // 10%
      };

      const result = await scrobbleAnimeEpisode(shokoEpisode, payload, 'user-token');

      expect(result).toEqual({ success: true, skipped: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    test('should scrobble if watch status is COMPLETED', async () => {
      const shokoEpisode = {
        anidbId: '12345',
        episodeNumber: 1,
        isSpecial: false,
      };

      const payload: any = {
        NotificationType: 'PlaybackStop',
        RunTimeTicks: 1000,
        PlaybackPositionTicks: 900, // 90% (>= 80%)
      };

      const result = await scrobbleAnimeEpisode(shokoEpisode, payload, 'user-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skipped).toBe(false);
        if (!result.skipped) {
          expect(result.watchStatus).toBe(WATCH_STATUS.COMPLETED);
        }
      }
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('scrobbleAnimeMovie', () => {
    test('should scrobble movie with correct watch status (watching)', async () => {
      const shokoMovie = { anidbId: '54321' };
      const payload: any = {
        NotificationType: 'PlaybackStart',
        RunTimeTicks: 1000,
        PlaybackPositionTicks: 0,
      };

      const result = await scrobbleAnimeMovie(shokoMovie, payload, 'user-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skipped).toBe(false);
        if (!result.skipped) {
          expect(result.watchStatus).toBe(WATCH_STATUS.WATCHING);
        }
      }
      expect(fetchMock).toHaveBeenCalled();
    });

    test('should scrobble movie with correct watch status (completed)', async () => {
      const shokoMovie = { anidbId: '54321' };
      const payload: any = {
        NotificationType: 'PlaybackStop',
        RunTimeTicks: 1000,
        PlaybackPositionTicks: 850,
      };

      const result = await scrobbleAnimeMovie(shokoMovie, payload, 'user-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.skipped).toBe(false);
        if (!result.skipped) {
          expect(result.watchStatus).toBe(WATCH_STATUS.COMPLETED);
        }
      }
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});

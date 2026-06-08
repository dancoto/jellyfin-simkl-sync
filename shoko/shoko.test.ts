import { test, expect, mock, describe, beforeEach, afterEach } from 'bun:test';
import { appConfig } from '../shared/config';
import { fetchAnidb } from './shoko';

describe('Shoko API Client', () => {
  let fetchMock: any;
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.shoko = { url: 'http://shoko-mock', token: 'mock-shoko-token' };

    fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({}))));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    Object.assign(appConfig, originalConfig);
    mock.restore();
  });

  test('should fetch and parse a Movie when TMDB Movie array has length 1', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            IDs: {
              TMDB: {
                Movie: [12345],
              },
            },
            AniDB: {
              AnimeID: 5555,
              Type: 'Movie',
              EpisodeNumber: 1,
            },
          }),
        ),
      ),
    );

    const result = await fetchAnidb('shoko-ep-id-1');

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v3/Episode/shoko-ep-id-1');
    expect(options.headers.get('apiKey')).toBe('mock-shoko-token');

    expect(result).toEqual({
      anidbId: '5555',
    });
  });

  test('should fetch and parse an Episode when TMDB Movie array is empty', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            IDs: {
              TMDB: {
                Movie: [],
              },
            },
            AniDB: {
              AnimeID: 7777,
              Type: 'Regular',
              EpisodeNumber: 12,
            },
          }),
        ),
      ),
    );

    const result = await fetchAnidb('shoko-ep-id-2');

    expect(result).toEqual({
      anidbId: '7777',
      episodeNumber: 12,
      isSpecial: false,
    });
  });

  test('should handle Special episodes correctly', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            IDs: {
              TMDB: {
                Movie: [],
              },
            },
            AniDB: {
              AnimeID: 7777,
              Type: 'Special',
              EpisodeNumber: 2,
            },
          }),
        ),
      ),
    );

    const result = await fetchAnidb('shoko-ep-id-3');

    expect(result).toEqual({
      anidbId: '7777',
      episodeNumber: 2,
      isSpecial: true,
    });
  });

  test('should return null and log on fetch failure', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));

    const result = await fetchAnidb('shoko-ep-id-err');
    expect(result).toBeNull();
  });
});

import type { AnimeEpisodeResult, AnimeMovieResult } from '../anime/models';
import type { NormalizedPlaybackEvent } from '../jellyfin/models';
import { appConfig } from '../shared/config';
import {
  WATCH_STATUS,
  type MoviePayload,
  type ScrobbleResult,
  type SyncResponse,
  type TVPayload,
  type WatchStatus,
} from './models';
export type { ScrobbleResult };

export const scrobbleAnimeEpisode = async (
  animeEpisode: Pick<AnimeEpisodeResult, 'animeId' | 'episodeNumber' | 'isSpecial'>,
  event: NormalizedPlaybackEvent,
  userToken: string,
): Promise<ScrobbleResult> => {
  if (!event.isCompleted) {
    return { success: true, skipped: true };
  }

  const episodePayload: TVPayload = {
    shows: [
      {
        ids: { anidb: animeEpisode.animeId },
        seasons: [
          {
            number: animeEpisode.isSpecial ? 0 : 1,
            episodes: [{ number: animeEpisode.episodeNumber }],
          },
        ],
      },
    ],
  };

  const response = await sendPayload(episodePayload, userToken, WATCH_STATUS.COMPLETED);
  if (response.success) {
    return {
      success: true,
      id: response.id,
      watchStatus: WATCH_STATUS.COMPLETED,
      skipped: false,
    };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: animeEpisode.animeId,
  };
};

export const scrobbleAnimeMovie = async (
  animeMovie: Pick<AnimeMovieResult, 'animeId' | 'episodeNumber'>,
  event: NormalizedPlaybackEvent,
  userToken: string,
): Promise<ScrobbleResult> => {
  const watchStatus: WatchStatus = event.isCompleted
    ? WATCH_STATUS.COMPLETED
    : WATCH_STATUS.WATCHING;

  const moviePayload: MoviePayload = {
    movies: [
      {
        ids: { anidb: animeMovie.animeId },
        status: watchStatus,
      },
    ],
  };

  const response = await sendPayload(moviePayload, userToken, watchStatus);
  if (response.success) {
    return {
      success: true,
      id: response.id,
      watchStatus,
      skipped: false,
    };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: animeMovie.animeId,
  };
};

export const scrobbleStandardEpisode = async (
  event: NormalizedPlaybackEvent,
  userToken: string,
): Promise<ScrobbleResult> => {
  if (!event.isCompleted) {
    return { success: true, skipped: true };
  }

  const showIds: Record<string, any> = {};
  if (event.seriesProviderIds.tvdb) showIds.tvdb = event.seriesProviderIds.tvdb;
  if (event.seriesProviderIds.tmdb) showIds.tmdb = event.seriesProviderIds.tmdb;
  if (event.seriesProviderIds.imdb) showIds.imdb = event.seriesProviderIds.imdb;

  const episodePayload: TVPayload = {
    shows: [
      {
        title: event.seriesName,
        ids: showIds,
        seasons: [
          {
            number: event.seasonNumber ?? 1,
            episodes: [{ number: event.episodeNumber ?? 1 }],
          },
        ],
      },
    ],
  };

  const fallbackId =
    event.seriesProviderIds.tvdb ?? event.seriesProviderIds.tmdb ?? event.seriesName ?? 'unknown';

  const response = await sendPayload(episodePayload, userToken, WATCH_STATUS.COMPLETED);
  if (response.success) {
    return {
      success: true,
      id: response.id,
      watchStatus: WATCH_STATUS.COMPLETED,
      skipped: false,
    };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: fallbackId,
  };
};

export const scrobbleStandardMovie = async (
  event: NormalizedPlaybackEvent,
  userToken: string,
): Promise<ScrobbleResult> => {
  const watchStatus: WatchStatus = event.isCompleted
    ? WATCH_STATUS.COMPLETED
    : WATCH_STATUS.WATCHING;

  const movieIds: Record<string, any> = {};
  if (event.providerIds.tmdb) movieIds.tmdb = event.providerIds.tmdb;
  if (event.providerIds.imdb) movieIds.imdb = event.providerIds.imdb;
  if (event.providerIds.tvdb) movieIds.tvdb = event.providerIds.tvdb;

  const moviePayload: MoviePayload = {
    movies: [
      {
        title: event.name,
        ids: movieIds,
        status: watchStatus,
      },
    ],
  };

  const fallbackId = event.providerIds.tmdb ?? event.providerIds.imdb ?? event.name ?? 'unknown';

  const response = await sendPayload(moviePayload, userToken, watchStatus);
  if (response.success) {
    return {
      success: true,
      id: response.id,
      watchStatus,
      skipped: false,
    };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: fallbackId,
  };
};

type SendPayloadResult =
  | { success: true; id: string }
  | { success: false; reason: 'not_found' | 'api_error' };

const sendPayload = async (
  payload: MoviePayload | TVPayload,
  userToken: string,
  watchStatus: WatchStatus,
): Promise<SendPayloadResult> => {
  const { client_id, app_name } = appConfig.simkl;
  const url = new URL('https://api.simkl.com/sync/history');
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('app_name', app_name);
  url.searchParams.set('app_version', '2.0');

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('User-Agent', `${app_name}/2.0`);
  headers.append('Authorization', `Bearer ${userToken}`);

  try {
    const response = await fetch(url, {
      headers,
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, reason: 'api_error' };
    }

    const data = (await response.json()) as SyncResponse;

    // Check not_found
    if ('movies' in payload) {
      if (data.not_found.movies.length > 0) {
        return { success: false, reason: 'not_found' };
      }
    } else {
      if (data.not_found.episodes.length > 0 || data.not_found.shows.length > 0) {
        return { success: false, reason: 'not_found' };
      }
    }

    const statusObj = data.added.statuses[0]?.request;
    const id =
      (statusObj?.ids.anidb as string) ??
      (statusObj?.ids.tvdb ? String(statusObj.ids.tvdb) : undefined) ??
      (statusObj?.ids.tmdb ? String(statusObj.ids.tmdb) : undefined) ??
      (statusObj?.ids.imdb as string) ??
      'synced';

    const typeStr = 'movies' in payload ? 'Movie' : 'Episode';
    const statusStr = watchStatus === WATCH_STATUS.COMPLETED ? 'watched' : watchStatus;
    console.log(`${typeStr} marked ${statusStr}`);
    return { success: true, id };
  } catch (error) {
    console.error('Error syncing with Simkl:', error);
    return { success: false, reason: 'api_error' };
  }
};

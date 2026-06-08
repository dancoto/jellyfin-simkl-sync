import { appConfig } from '../shared/config';
import type { WebhookPayload } from '../shared/payload';
import type { ShokoEpisode, ShokoMovie } from '../shoko/models';
import {
  WATCH_STATUS,
  type MoviePayload,
  type SyncResponse,
  type TVPayload,
  type WatchStatus,
} from './models';

export type ScrobbleResult =
  | { success: true; id: string; watchStatus: WatchStatus; skipped: false }
  | { success: true; skipped: true }
  | { success: false; reason: 'not_found' | 'api_error'; anidbId: string };

const determineWatchStatus = (payload: WebhookPayload): WatchStatus => {
  if (payload.NotificationType === 'PlaybackStart') {
    return WATCH_STATUS.WATCHING;
  }

  if (payload.RunTimeTicks === 0) {
    return WATCH_STATUS.WATCHING;
  }

  const percentage = (payload.PlaybackPositionTicks / payload.RunTimeTicks) * 100.0;
  if (percentage >= 80.0) {
    return WATCH_STATUS.COMPLETED;
  }

  return WATCH_STATUS.HOLD;
};

export const scrobbleAnimeMovie = async (
  shokoMovie: ShokoMovie,
  payload: WebhookPayload,
  userToken: string,
): Promise<ScrobbleResult> => {
  const watchStatus = determineWatchStatus(payload);
  const moviePayload: MoviePayload = {
    movies: [
      {
        ids: { anidb: shokoMovie.anidbId },
        status: watchStatus,
      },
    ],
  };
  const response = await sendPayload(moviePayload, userToken, watchStatus);
  if (response.success) {
    return { success: true, id: response.id, watchStatus, skipped: false };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: shokoMovie.anidbId,
  };
};

export const scrobbleAnimeEpisode = async (
  shokoEpisode: ShokoEpisode,
  payload: WebhookPayload,
  userToken: string,
): Promise<ScrobbleResult> => {
  const watchStatus = determineWatchStatus(payload);
  if (watchStatus !== WATCH_STATUS.COMPLETED) {
    return { success: true, skipped: true };
  }
  const episodePayload: TVPayload = {
    shows: [
      {
        ids: { anidb: shokoEpisode.anidbId },
        seasons: [
          {
            number: shokoEpisode.isSpecial ? 0 : 1,
            episodes: [{ number: shokoEpisode.episodeNumber }],
          },
        ],
      },
    ],
  };
  const response = await sendPayload(episodePayload, userToken, watchStatus);
  if (response.success) {
    return { success: true, id: response.id, watchStatus, skipped: false };
  }
  return {
    success: false,
    reason: response.reason,
    anidbId: shokoEpisode.anidbId,
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
  url.searchParams.set('app_version', '1.0');

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  headers.append('User-Agent', `${app_name}/1.0`);
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

    // simkl returns a not_found section. If no error check these as a success can still be not found
    if ('movies' in payload) {
      if (data.not_found.movies.length > 0) {
        return { success: false, reason: 'not_found' };
      }
    } else {
      if (data.not_found.episodes.length > 0 || data.not_found.shows.length > 0) {
        return { success: false, reason: 'not_found' };
      }
    }

    const id = data.added.statuses[0]?.request.ids.anidb as string;
    const typeStr = 'movies' in payload ? 'Movie' : 'Episode';
    const statusStr = watchStatus === WATCH_STATUS.COMPLETED ? 'watched' : watchStatus;
    console.log(`${typeStr} marked ${statusStr}`);
    return { success: true, id };
  } catch (error) {
    console.error('Error syncing with Simkl.', error);
    return { success: false, reason: 'api_error' };
  }
};

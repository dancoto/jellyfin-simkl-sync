import { sendNotification } from './ntfy';
import { appConfig } from './shared/config';
import type { WebhookPayload } from './shared/payload';
import { fetchAnidb } from './shoko';
import { scrobbleAnimeEpisode, scrobbleAnimeMovie, type ScrobbleResult } from './simkl/simkl';

export const handleWebhook = async (payload: WebhookPayload) => {
  // 1. Ensure user has valid token
  const userToken = appConfig.simkl.users[payload.NotificationUsername];
  if (!userToken) {
    console.warn('Current user has no token. Nothing will be synced.');
    return;
  }

  // 1. Filter for anime and extract Shoko episode
  const shokoEpisodeId = payload['Provider_shoko episode'];
  if (!shokoEpisodeId) {
    return;
  }
  // 2. Call shoko
  console.log(`Payload received for ${payload.NotificationUsername}`);
  const shokoDetails = await fetchAnidb(payload['Provider_shoko episode']);
  if (!shokoDetails) {
    return;
  }

  // 3. Call simkl for episode or movie
  let result: ScrobbleResult;
  if ('episodeNumber' in shokoDetails) {
    console.log(`Found series with ID of ${shokoDetails.anidbId}`);
    result = await scrobbleAnimeEpisode(shokoDetails, payload, userToken);
  } else {
    console.log(`Found movie with ID of ${shokoDetails.anidbId}`);
    result = await scrobbleAnimeMovie(shokoDetails, payload, userToken);
  }

  // 4. Send notification if not found in Simkl database
  if (result && !result.success && result.reason === 'not_found') {
    const mediaType = 'episodeNumber' in shokoDetails ? 'series' : 'movie';
    sendNotification({
      title: `Failed to update Simkl for ${mediaType}`,
      message: `AniDB ID: ${result.anidbId}\nLink: https://anidb.net/anime/${result.anidbId}`,
      priority: 4,
    });
  }
};

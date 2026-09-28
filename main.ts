import { defaultAnimeResolver } from './anime';
import {
  defaultJellyfinClient,
  isAnimeLibrary,
  normalizeJellyfinWebhook,
  type RawJellyfinPayload,
} from './jellyfin';
import { logger } from './shared/logger';
import { getOrRefreshUserToken } from './simkl/auth';
import { enqueueScrobble } from './simkl/batcher';

export const handleWebhook = async (
  rawPayload: RawJellyfinPayload,
  options?: { debounceMs?: number },
) => {
  const event = normalizeJellyfinWebhook(rawPayload);

  logger.info(
    `[Webhook] Received "${event.notificationType}" for user "${event.username || 'unknown'}": ${event.seriesName ? `${event.seriesName} - ` : ''}${event.name} (Progress: ${Math.round(event.progressPercentage)}%)`,
  );
  logger.debug('[Webhook] Raw payload keys:', Object.keys(rawPayload));
  logger.debug('[Webhook] Full payload:', JSON.stringify(rawPayload, null, 2));
  logger.debug('[Webhook] Normalized event:', {
    notificationType: event.notificationType,
    username: event.username,
    itemType: event.itemType,
    seriesName: event.seriesName,
    seasonNumber: event.seasonNumber,
    episodeNumber: event.episodeNumber,
    libraryName: event.libraryName,
    isCompleted: event.isCompleted,
    providerIds: event.providerIds,
    seriesProviderIds: event.seriesProviderIds,
  });

  // 1. Ensure user has valid token (auto-refreshes if nearing 7-day expiration)
  const userToken = await getOrRefreshUserToken(event.username);
  if (!userToken) {
    logger.warn(`User "${event.username}" has no configured Simkl token. Nothing will be synced.`);
    return;
  }

  // 2. Only scrobble on completion (>= 80% progress or marked played)
  if (!event.isCompleted) {
    logger.debug(
      `[Webhook] Event "${event.notificationType}" does not meet completion threshold (progress: ${Math.round(event.progressPercentage)}% < 80%, played: ${Boolean(event.isCompleted)}). No scrobble queued.`,
    );
    return;
  }

  logger.info(`Processing playback completion for user "${event.username}": ${event.name}`);

  // 3. Determine library name and ensure provider IDs are loaded before anime fallback check
  let libraryName = event.libraryName;
  if (!libraryName || libraryName.toLowerCase() === 'root') {
    libraryName =
      (await defaultJellyfinClient.getLibraryName(event.seriesId ?? event.itemId)) ?? undefined;
  }

  // Pre-fetch provider IDs from Jellyfin API if missing from webhook body
  if (event.itemType === 'Episode' && event.seriesId) {
    if (
      !event.seriesProviderIds.tvdb &&
      !event.seriesProviderIds.tmdb &&
      !event.seriesProviderIds.anidb
    ) {
      logger.debug(`Querying series provider IDs from Jellyfin API for ${event.seriesId}...`);
      const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.seriesId);
      if (fetched) {
        event.seriesProviderIds = { ...event.seriesProviderIds, ...fetched };
      }
    }
  } else if (event.itemType === 'Movie' && event.itemId) {
    if (
      !event.providerIds.tmdb &&
      !event.providerIds.imdb &&
      !event.providerIds.tvdb &&
      !event.providerIds.anidb
    ) {
      logger.debug(`Querying movie provider IDs from Jellyfin API for ${event.itemId}...`);
      const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.itemId);
      if (fetched) {
        event.providerIds = { ...event.providerIds, ...fetched };
      }
    }
  }

  const isAnime = (libraryName && isAnimeLibrary(libraryName)) || checkIfAnimeFallback(event);

  const routeLabel = isAnime ? 'Anime' : 'Standard/Non-Anime';
  logger.info(`Library: "${libraryName ?? 'Unknown'}" -> Routing to ${routeLabel} pipeline.`);

  if (isAnime) {
    // === ANIME PIPELINE ===
    if (event.itemType === 'Episode') {
      if (event.seasonNumber === undefined || event.episodeNumber === undefined) {
        logger.warn('Episode event is missing season or episode number.');
        return;
      }

      const seriesProviderIds = event.seriesProviderIds;
      logger.debug(
        `Series Provider IDs for "${event.seriesName ?? event.name}":`,
        seriesProviderIds,
      );

      const startEp = event.episodeNumber;
      const endEp =
        event.episodeNumberEnd && event.episodeNumberEnd >= startEp
          ? event.episodeNumberEnd
          : startEp;

      for (let ep = startEp; ep <= endEp; ep++) {
        const resolved = defaultAnimeResolver.resolveEpisode(
          {
            tvdbId: seriesProviderIds.tvdb,
            tmdbId: seriesProviderIds.tmdb,
            anidbId: seriesProviderIds.anidb ?? event.providerIds.anidb,
          },
          event.seasonNumber,
          ep,
        );

        if (!resolved) {
          // Edge case: If NOT a special (season !== 0), fallback to standard pipeline
          if (event.seasonNumber !== 0) {
            console.log(
              `No AniDB mapping found for anime "${event.seriesName ?? event.name}" (S${event.seasonNumber}E${ep}). Falling back to standard non-anime pipeline.`,
            );
            await enqueueStandardEpisode(event, userToken, ep, options);
          } else {
            console.log(
              `No anime mapping match found for special "${event.seriesName ?? event.name}" (S0E${ep}). Skipping anime scrobble.`,
            );
          }
        } else {
          console.log(
            `Mapped anime "${event.seriesName ?? event.name}" S${event.seasonNumber}E${ep} -> AniDB ${resolved.animeId} Ep ${resolved.episodeNumber} (${resolved.source})`,
          );

          await enqueueScrobble(
            event.username,
            userToken,
            {
              kind: 'anime_episode',
              animeId: resolved.animeId,
              episodeNumber: resolved.episodeNumber,
              isSpecial: resolved.isSpecial,
              seriesName: event.seriesName,
              episodeName: ep === startEp ? event.name : `Episode ${ep}`,
            },
            options,
          );
        }
      }
    } else if (event.itemType === 'Movie') {
      const resolved = defaultAnimeResolver.resolveMovie({
        tmdbId: event.providerIds.tmdb,
        imdbId: event.providerIds.imdb,
        tvdbId: event.providerIds.tvdb,
        anidbId: event.providerIds.anidb,
      });

      if (!resolved) {
        logger.info(
          `No AniDB mapping found for anime movie "${event.name}". Falling back to standard movie pipeline with TMDB/IMDb/TVDB IDs.`,
        );
        await enqueueStandardMovie(event, userToken, options);
      } else {
        logger.info(
          `Mapped anime movie "${event.name}" -> AniDB ${resolved.animeId} (${resolved.source})`,
        );

        await enqueueScrobble(
          event.username,
          userToken,
          {
            kind: 'anime_movie',
            animeId: resolved.animeId,
            name: event.name,
          },
          options,
        );
      }
    }
  } else {
    // === NON-ANIME / STANDARD MEDIA PIPELINE ===
    if (event.itemType === 'Episode') {
      const startEp = event.episodeNumber ?? 1;
      const endEp =
        event.episodeNumberEnd && event.episodeNumberEnd >= startEp
          ? event.episodeNumberEnd
          : startEp;

      for (let ep = startEp; ep <= endEp; ep++) {
        await enqueueStandardEpisode(event, userToken, ep, options);
      }
    } else if (event.itemType === 'Movie') {
      await enqueueStandardMovie(event, userToken, options);
    }
  }
};

const enqueueStandardMovie = async (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
  userToken: string,
  options?: { debounceMs?: number },
): Promise<void> => {
  let providerIds = { ...event.providerIds };
  if (!providerIds.tmdb && !providerIds.imdb && !providerIds.tvdb && event.itemId) {
    logger.debug(`Querying movie provider IDs from Jellyfin API for ${event.itemId}...`);
    const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.itemId);
    if (fetched) {
      providerIds = { ...providerIds, ...fetched };
      event.providerIds = providerIds;
    }
  }

  logger.info(`Scrobbling standard movie "${event.name}" to Simkl.`);
  logger.debug('Movie IDs:', event.providerIds);

  await enqueueScrobble(
    event.username,
    userToken,
    {
      kind: 'standard_movie',
      name: event.name,
      ids: {
        tmdb: event.providerIds.tmdb,
        imdb: event.providerIds.imdb,
        tvdb: event.providerIds.tvdb,
      },
    },
    options,
  );
};

const enqueueStandardEpisode = async (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
  userToken: string,
  episodeNumber: number,
  options?: { debounceMs?: number },
): Promise<void> => {
  let seriesProviderIds = { ...event.seriesProviderIds };
  if (
    !seriesProviderIds.tvdb &&
    !seriesProviderIds.tmdb &&
    !seriesProviderIds.imdb &&
    event.seriesId
  ) {
    logger.debug(
      `Querying standard series provider IDs from Jellyfin API for ${event.seriesId}...`,
    );
    const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.seriesId);
    if (fetched) {
      seriesProviderIds = { ...seriesProviderIds, ...fetched };
    }
  }

  event.seriesProviderIds = seriesProviderIds;
  logger.info(
    `Scrobbling standard series "${event.seriesName ?? event.name}" (S${event.seasonNumber ?? 1}E${episodeNumber}) to Simkl.`,
  );
  logger.debug('Standard series IDs:', event.seriesProviderIds);

  await enqueueScrobble(
    event.username,
    userToken,
    {
      kind: 'standard_episode',
      seriesName: event.seriesName,
      seasonNumber: event.seasonNumber ?? 1,
      episodeNumber,
      ids: {
        tvdb: event.seriesProviderIds.tvdb,
        tmdb: event.seriesProviderIds.tmdb,
        imdb: event.seriesProviderIds.imdb,
      },
      episodeName: episodeNumber === event.episodeNumber ? event.name : `Episode ${episodeNumber}`,
    },
    options,
  );
};

const checkIfAnimeFallback = (event: ReturnType<typeof normalizeJellyfinWebhook>): boolean => {
  // Check if provider IDs or series match AniBridge
  if (event.itemType === 'Episode') {
    const match = defaultAnimeResolver.resolveEpisode(
      {
        tvdbId: event.seriesProviderIds.tvdb,
        tmdbId: event.seriesProviderIds.tmdb,
        anidbId: event.seriesProviderIds.anidb ?? event.providerIds.anidb,
      },
      event.seasonNumber ?? 1,
      event.episodeNumber ?? 1,
    );
    return match !== null;
  }
  if (event.itemType === 'Movie') {
    const match = defaultAnimeResolver.resolveMovie({
      tmdbId: event.providerIds.tmdb,
      imdbId: event.providerIds.imdb,
      tvdbId: event.providerIds.tvdb,
      anidbId: event.providerIds.anidb,
    });
    return match !== null;
  }
  return false;
};

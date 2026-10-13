import { defaultAnimeResolver } from './anime';
import { getAniListUserToken } from './anilist/auth';
import { enqueueAniListScrobble } from './anilist/scrobbler';
import {
  defaultJellyfinClient,
  isAnimeLibrary,
  isExcludedLibrary,
  normalizeJellyfinWebhook,
  type RawJellyfinPayload,
} from './jellyfin';
import { logger } from './shared/logger';
import { sendNotification } from './ntfy';
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

  // 1. Ensure user has valid token (Simkl and/or AniList)
  let simklToken: string | null = null;
  try {
    simklToken = await getOrRefreshUserToken(event.username);
  } catch (err) {
    logger.warn(`Failed to retrieve Simkl token for "${event.username}":`, err);
  }

  let anilistToken: string | null = null;
  try {
    anilistToken = getAniListUserToken(event.username);
  } catch (err) {
    logger.warn(`Failed to retrieve AniList token for "${event.username}":`, err);
  }

  if (!simklToken && !anilistToken) {
    logger.warn(
      `User "${event.username}" has no configured Simkl or AniList token. Nothing will be synced.`,
    );
    return;
  }

  // 2. Determine library name and ensure provider IDs are loaded before anime fallback check
  let libraryName = event.libraryName;
  if (!libraryName || libraryName.toLowerCase() === 'root') {
    libraryName =
      (await defaultJellyfinClient.getLibraryName(event.seriesId ?? event.itemId)) ?? undefined;
  }

  // 2b. Explicitly exclude libraries configured/defaulted to be excluded from sync
  if (libraryName && isExcludedLibrary(libraryName)) {
    logger.info(
      `[Webhook] Library "${libraryName}" is explicitly excluded from sync. Skipping event for "${event.name}".`,
    );
    return;
  }

  // Path check fallback if library name could not be resolved from Jellyfin
  const isExcludedPath =
    event.path &&
    (event.path.toLowerCase().includes('/other anime/') ||
      event.path.toLowerCase().includes('/other-anime/') ||
      event.path.toLowerCase().includes('/other anime movies/') ||
      event.path.toLowerCase().includes('/other-anime-movies/'));

  if (isExcludedPath) {
    logger.info(
      `[Webhook] Item path "${event.path}" belongs to an excluded library. Skipping event for "${event.name}".`,
    );
    return;
  }

  // Pre-fetch provider IDs from Jellyfin API if missing from webhook body
  if (event.itemType === 'Episode' && event.seriesId) {
    if (!event.seriesProviderIds.tvdb && !event.seriesProviderIds.tmdb) {
      logger.debug(`Querying series provider IDs from Jellyfin API for ${event.seriesId}...`);
      const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.seriesId);
      if (fetched) {
        event.seriesProviderIds = { ...event.seriesProviderIds, ...fetched };
      }
    }
  } else if (event.itemType === 'Movie' && event.itemId) {
    if (!event.providerIds.tmdb && !event.providerIds.imdb && !event.providerIds.tvdb) {
      logger.debug(`Querying movie provider IDs from Jellyfin API for ${event.itemId}...`);
      const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.itemId);
      if (fetched) {
        event.providerIds = { ...event.providerIds, ...fetched };
      }
    }
  }

  const isAnime = (libraryName && isAnimeLibrary(libraryName)) || checkIfAnimeFallback(event);

  // 3. Handle PlaybackStart: immediately catch and alert on missing anime mappings
  const isPlaybackStart = (event.notificationType ?? '').toLowerCase() === 'playbackstart';
  if (isPlaybackStart) {
    if (isAnime) {
      logger.info(
        `[Webhook] PlaybackStart received for anime "${event.seriesName ?? event.name}". Checking for missing mappings...`,
      );
      checkAnimeMissingMappings(event);
    }
    logger.debug(`[Webhook] PlaybackStart event processed. No scrobble queued.`);
    return;
  }

  // 4. Only scrobble on completion (>= 80% progress or marked played)
  if (!event.isCompleted) {
    logger.debug(
      `[Webhook] Event "${event.notificationType}" does not meet completion threshold (progress: ${Math.round(event.progressPercentage)}% < 80%, played: ${Boolean(event.isCompleted)}). No scrobble queued.`,
    );
    return;
  }

  logger.info(`Processing playback completion for user "${event.username}": ${event.name}`);

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
            anilistId: seriesProviderIds.anilist ?? event.providerIds.anilist,
          },
          event.seasonNumber,
          ep,
        );

        const hasAniList = Boolean(resolved?.anilist?.mediaId);

        if (!hasAniList && !resolved?.skipAniList) {
          handleMissingAnimeMapping(
            event,
            seriesProviderIds.tvdb,
            event.seasonNumber,
            ep,
            hasAniList,
            resolved,
          );
        }

        // 1. Simkl scrobbling
        if (simklToken) {
          if (hasAniList && !resolved?.skipAniList) {
            console.log(
              `Mapped anime "${event.seriesName ?? event.name}" S${event.seasonNumber}E${ep} -> AniList ${resolved!.anilist!.mediaId} Ep ${resolved!.anilist!.episodeNumber} (${resolved!.source})`,
            );

            try {
              await enqueueScrobble(
                event.username,
                simklToken,
                {
                  kind: 'anime_episode',
                  anilistId: resolved!.anilist!.mediaId,
                  anilistEpisode: resolved!.anilist!.episodeNumber,
                  episodeNumber: ep,
                  isSpecial: event.seasonNumber === 0,
                  seriesName: event.seriesName,
                  episodeName: ep === startEp ? event.name : `Episode ${ep}`,
                  tvdbId: seriesProviderIds.tvdb,
                  tmdbId: seriesProviderIds.tmdb,
                  seasonNumber: event.seasonNumber,
                },
                options,
              );
            } catch (err) {
              logger.error(
                `[Simkl] Failed to enqueue scrobble for anime episode "${event.name}":`,
                err,
              );
            }
          } else if (!resolved?.isSkipped) {
            // Fallback for Simkl: No AniList ID, try TVDB/TMDB
            if (event.seasonNumber !== 0) {
              console.log(
                `No AniList mapping found for anime "${event.seriesName ?? event.name}" (S${event.seasonNumber}E${ep}). Falling back to standard non-anime pipeline for Simkl.`,
              );
              await enqueueStandardEpisode(event, simklToken, ep, options);
            } else {
              console.log(
                `No AniList mapping found for special "${event.seriesName ?? event.name}" (S0E${ep}). Falling back to TVDB Season 0 pipeline for Simkl.`,
              );
              await enqueueStandardEpisode(event, simklToken, ep, options);
            }
          }
        }

        // 2. AniList scrobbling
        if (anilistToken && !resolved?.skipAniList && !resolved?.isSkipped) {
          try {
            if (resolved?.anilist) {
              await enqueueAniListScrobble(
                event.username,
                anilistToken,
                {
                  mediaId: resolved.anilist.mediaId,
                  episodeNumber: resolved.anilist.episodeNumber,
                  isMovie: false,
                  title: event.seriesName ?? event.name,
                },
                options,
              );
            } else {
              logger.info(
                `[AniList] No matching AniList mapping found for anime "${event.seriesName ?? event.name}". Skipping AniList scrobble.`,
              );
            }
          } catch (err) {
            logger.error(
              `[AniList] Failed to enqueue scrobble for anime episode "${event.name}":`,
              err,
            );
          }
        }
      }
    } else if (event.itemType === 'Movie') {
      const resolved = defaultAnimeResolver.resolveMovie({
        tmdbId: event.providerIds.tmdb,
        imdbId: event.providerIds.imdb,
        tvdbId: event.providerIds.tvdb,
        anilistId: event.providerIds.anilist,
      });

      const hasAniList = Boolean(resolved?.anilist?.mediaId);

      if (!hasAniList) {
        handleMissingAnimeMovieMapping(event, event.providerIds.tvdb, hasAniList, resolved);
      }

      // 1. Simkl scrobbling
      if (simklToken) {
        if (resolved?.anilist?.mediaId) {
          logger.info(
            `Mapped anime movie "${event.name}" -> AniList ${resolved.anilist.mediaId} (${resolved.source})`,
          );
          try {
            await enqueueScrobble(
              event.username,
              simklToken,
              {
                kind: 'anime_movie',
                anilistId: resolved.anilist.mediaId,
                name: event.name,
                tmdbId: event.providerIds.tmdb,
                tvdbId: event.providerIds.tvdb,
              },
              options,
            );
          } catch (err) {
            logger.error(
              `[Simkl] Failed to enqueue scrobble for anime movie "${event.name}":`,
              err,
            );
          }
        } else {
          logger.info(
            `No AniList mapping found for anime movie "${event.name}". Falling back to standard movie pipeline with TMDB/IMDb/TVDB IDs for Simkl.`,
          );
          try {
            await enqueueStandardMovie(event, simklToken, options);
          } catch (err) {
            logger.error(`[Simkl] Failed to enqueue movie "${event.name}":`, err);
          }
        }
      }

      // 2. AniList scrobbling
      if (anilistToken) {
        if (resolved?.anilist) {
          try {
            await enqueueAniListScrobble(
              event.username,
              anilistToken,
              {
                mediaId: resolved.anilist.mediaId,
                episodeNumber: 1,
                isMovie: true,
                title: event.name,
              },
              options,
            );
          } catch (err) {
            logger.error(
              `[AniList] Failed to enqueue scrobble for anime movie "${event.name}":`,
              err,
            );
          }
        } else {
          logger.info(
            `[AniList] No matching AniList mapping found for anime movie "${event.name}". Skipping AniList scrobble.`,
          );
        }
      }
    }
  } else {
    // === NON-ANIME / STANDARD MEDIA PIPELINE ===
    if (simklToken) {
      if (event.itemType === 'Episode') {
        const startEp = event.episodeNumber ?? 1;
        const endEp =
          event.episodeNumberEnd && event.episodeNumberEnd >= startEp
            ? event.episodeNumberEnd
            : startEp;

        for (let ep = startEp; ep <= endEp; ep++) {
          await enqueueStandardEpisode(event, simklToken, ep, options);
        }
      } else if (event.itemType === 'Movie') {
        await enqueueStandardMovie(event, simklToken, options);
      }
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
        anilistId: event.seriesProviderIds.anilist ?? event.providerIds.anilist,
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
      anilistId: event.providerIds.anilist,
    });
    return match !== null;
  }
  return false;
};

const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per series
export const notifiedAnimeCooldown = new Map<string, number>();

export const clearNotificationCooldowns = (): void => {
  notifiedAnimeCooldown.clear();
};

const handleMissingAnimeMapping = (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
  tvdbId: string | undefined,
  seasonNumber: number,
  episodeNumber: number,
  hasAniList: boolean,
  resolved: ReturnType<typeof defaultAnimeResolver.resolveEpisode>,
): void => {
  if (hasAniList || resolved?.skipAniList) return;

  const seriesTitle = event.seriesName ?? event.name;
  let actionNotice = '';

  if (tvdbId) {
    const overrideResult = defaultAnimeResolver.ensureShowInOverrides({
      tvdbId,
      title: seriesTitle,
      tmdbId: event.seriesProviderIds?.tmdb ?? event.providerIds?.tmdb,
      seasonNumber,
      episodeNumber,
      episodeName: episodeNumber === event.episodeNumber ? event.name : `Episode ${episodeNumber}`,
      anilistId: resolved?.anilist?.mediaId ?? null,
      anilistEpisode: resolved?.anilist?.episodeNumber ?? null,
    });

    if (overrideResult.added) {
      actionNotice = `\nAdded to mapping-overrides.json (${overrideResult.reason.replace('_', ' ')})`;
      logger.info(
        `[Overrides] Added unmapped anime "${seriesTitle}" (TVDB ${tvdbId}) to mapping overrides file.`,
      );
    } else if (overrideResult.reason === 'already_exists') {
      actionNotice = '\nAlready in mapping-overrides.json';
    }
  } else {
    logger.warn(
      `[Overrides] Anime "${seriesTitle}" is missing TVDB ID in Jellyfin. Cannot add to TVDB overrides.`,
    );
  }

  const cooldownKey = tvdbId ?? seriesTitle;
  const lastNotified = notifiedAnimeCooldown.get(cooldownKey) ?? 0;
  const now = Date.now();

  if (now - lastNotified > NOTIFICATION_COOLDOWN_MS) {
    notifiedAnimeCooldown.set(cooldownKey, now);
    sendNotification({
      title: `Missing Anime Mapping: ${seriesTitle}`,
      message: `Show: ${seriesTitle}\nEpisode: S${seasonNumber}E${episodeNumber}\nTVDB: ${tvdbId ?? 'Not found in Jellyfin'}\nMissing: AniList${actionNotice}`,
      priority: 4,
    });
  }
};

const handleMissingAnimeMovieMapping = (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
  tvdbId: string | undefined,
  hasAniList: boolean,
  resolved: ReturnType<typeof defaultAnimeResolver.resolveMovie>,
): void => {
  if (hasAniList) return;

  let actionNotice = '';
  if (tvdbId) {
    const overrideResult = defaultAnimeResolver.ensureShowInOverrides({
      tvdbId,
      title: event.name,
      tmdbId: event.providerIds?.tmdb,
      seasonNumber: 0,
      episodeNumber: 1,
      episodeName: event.name,
      anilistId: resolved?.anilist?.mediaId ?? null,
      anilistEpisode: resolved?.anilist?.episodeNumber ?? null,
    });

    if (overrideResult.added) {
      actionNotice = `\nAdded to mapping-overrides.json (${overrideResult.reason.replace('_', ' ')})`;
      logger.info(
        `[Overrides] Added unmapped anime movie "${event.name}" (TVDB ${tvdbId}) to mapping overrides file.`,
      );
    } else if (overrideResult.reason === 'already_exists') {
      actionNotice = '\nAlready in mapping-overrides.json';
    }
  } else {
    logger.warn(
      `[Overrides] Anime movie "${event.name}" is missing TVDB ID in Jellyfin. Cannot add to TVDB overrides.`,
    );
  }

  const cooldownKey = tvdbId ?? event.name;
  const lastNotified = notifiedAnimeCooldown.get(cooldownKey) ?? 0;
  const now = Date.now();

  if (now - lastNotified > NOTIFICATION_COOLDOWN_MS) {
    notifiedAnimeCooldown.set(cooldownKey, now);
    sendNotification({
      title: `Missing Anime Movie Mapping: ${event.name}`,
      message: `Movie: ${event.name}\nTVDB: ${tvdbId ?? 'Not found in Jellyfin'}\nTMDB: ${event.providerIds?.tmdb ?? 'None'}\nMissing: AniList${actionNotice}`,
      priority: 4,
    });
  }
};

export const checkAnimeMissingMappings = (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
): void => {
  if (event.itemType === 'Episode') {
    if (event.seasonNumber === undefined || event.episodeNumber === undefined) {
      logger.warn('Episode event is missing season or episode number.');
      return;
    }

    const seriesProviderIds = event.seriesProviderIds;
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
          anilistId: seriesProviderIds.anilist ?? event.providerIds.anilist,
        },
        event.seasonNumber,
        ep,
      );

      const hasAniList = Boolean(resolved?.anilist?.mediaId);

      if (!hasAniList && !resolved?.skipAniList) {
        handleMissingAnimeMapping(
          event,
          seriesProviderIds.tvdb,
          event.seasonNumber,
          ep,
          hasAniList,
          resolved,
        );
      }
    }
  } else if (event.itemType === 'Movie') {
    const resolved = defaultAnimeResolver.resolveMovie({
      tmdbId: event.providerIds.tmdb,
      imdbId: event.providerIds.imdb,
      tvdbId: event.providerIds.tvdb,
      anilistId: event.providerIds.anilist,
    });

    const hasAniList = Boolean(resolved?.anilist?.mediaId);

    if (!hasAniList) {
      handleMissingAnimeMovieMapping(event, event.providerIds.tvdb, hasAniList, resolved);
    }
  }
};

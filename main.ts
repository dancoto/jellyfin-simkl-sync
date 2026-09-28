import { defaultAnimeResolver } from './anime';
import {
  defaultJellyfinClient,
  isAnimeLibrary,
  normalizeJellyfinWebhook,
  type RawJellyfinPayload,
} from './jellyfin';
import { sendNotification } from './ntfy';
import { getOrRefreshUserToken } from './simkl/auth';
import {
  scrobbleAnimeEpisode,
  scrobbleAnimeMovie,
  scrobbleStandardEpisode,
  scrobbleStandardMovie,
  type ScrobbleResult,
} from './simkl/simkl';

export const handleWebhook = async (rawPayload: RawJellyfinPayload) => {
  const event = normalizeJellyfinWebhook(rawPayload);

  // 1. Ensure user has valid token (auto-refreshes if nearing 7-day expiration)
  const userToken = await getOrRefreshUserToken(event.username);
  if (!userToken) {
    console.warn(`User "${event.username}" has no configured Simkl token. Nothing will be synced.`);
    return;
  }

  // 2. Only scrobble on completion (>= 80% progress or marked played)
  if (!event.isCompleted) {
    return;
  }

  console.log(`Processing playback completion for user "${event.username}": ${event.name}`);

  // 3. Determine library name and route anime vs non-anime
  let libraryName = event.libraryName;
  if (!libraryName) {
    libraryName =
      (await defaultJellyfinClient.getLibraryName(event.seriesId ?? event.itemId)) ?? undefined;
  }

  const isAnime = libraryName
    ? isAnimeLibrary(libraryName)
    : // If library name is unknown, fallback to checking if it resolves in the anime index
      checkIfAnimeFallback(event);

  const routeLabel = isAnime ? 'Anime' : 'Standard/Non-Anime';
  console.log(`Library: "${libraryName ?? 'Unknown'}" -> Routing to ${routeLabel} pipeline.`);

  let result: ScrobbleResult | null = null;
  let notFoundId: string | null = null;
  let mediaType: 'series' | 'movie' = 'series';
  let isAniDbScrobble = false;

  if (isAnime) {
    // === ANIME PIPELINE ===
    if (event.itemType === 'Episode') {
      mediaType = 'series';
      if (event.seasonNumber === undefined || event.episodeNumber === undefined) {
        console.warn('Episode event is missing season or episode number.');
        return;
      }

      let seriesProviderIds = { ...event.seriesProviderIds };
      if (
        !seriesProviderIds.tvdb &&
        !seriesProviderIds.tmdb &&
        !seriesProviderIds.anidb &&
        event.seriesId
      ) {
        const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.seriesId);
        if (fetched) {
          seriesProviderIds = { ...seriesProviderIds, ...fetched };
        }
      }

      const resolved = defaultAnimeResolver.resolveEpisode(
        {
          tvdbId: seriesProviderIds.tvdb,
          tmdbId: seriesProviderIds.tmdb,
          anidbId: seriesProviderIds.anidb ?? event.providerIds.anidb,
        },
        event.seasonNumber,
        event.episodeNumber,
      );

      if (!resolved) {
        // Edge case: If NOT a special (season !== 0), fallback to standard pipeline
        if (event.seasonNumber !== 0) {
          console.log(
            `No AniDB mapping found for anime "${event.seriesName ?? event.name}" (S${event.seasonNumber}E${event.episodeNumber}). Falling back to standard non-anime pipeline.`,
          );
          event.seriesProviderIds = seriesProviderIds;
          const fallback = await handleStandardEpisode(event, userToken);
          result = fallback.result;
          notFoundId = fallback.notFoundId;
          isAniDbScrobble = false;
        } else {
          console.log(
            `No anime mapping match found for special "${event.seriesName ?? event.name}" (S0E${event.episodeNumber}). Skipping anime scrobble.`,
          );
          return;
        }
      } else {
        console.log(
          `Mapped anime "${event.seriesName ?? event.name}" S${event.seasonNumber}E${event.episodeNumber} -> AniDB ${resolved.animeId} Ep ${resolved.episodeNumber} (${resolved.source})`,
        );

        result = await scrobbleAnimeEpisode(resolved, event, userToken);
        notFoundId = resolved.animeId;
        isAniDbScrobble = true;
      }
    } else if (event.itemType === 'Movie') {
      mediaType = 'movie';

      const resolved = defaultAnimeResolver.resolveMovie({
        tmdbId: event.providerIds.tmdb,
        imdbId: event.providerIds.imdb,
        tvdbId: event.providerIds.tvdb,
        anidbId: event.providerIds.anidb,
      });

      if (!resolved) {
        console.log(
          `No anime mapping match found for movie "${event.name}". Skipping anime scrobble.`,
        );
        return;
      }

      console.log(
        `Mapped anime movie "${event.name}" -> AniDB ${resolved.animeId} (${resolved.source})`,
      );

      result = await scrobbleAnimeMovie(resolved, event, userToken);
      notFoundId = resolved.animeId;
      isAniDbScrobble = true;
    }
  } else {
    // === NON-ANIME / STANDARD MEDIA PIPELINE ===
    if (event.itemType === 'Episode') {
      mediaType = 'series';
      const standard = await handleStandardEpisode(event, userToken);
      result = standard.result;
      notFoundId = standard.notFoundId;
      isAniDbScrobble = false;
    } else if (event.itemType === 'Movie') {
      mediaType = 'movie';

      console.log(`Scrobbling standard movie "${event.name}" to Simkl.`);
      result = await scrobbleStandardMovie(event, userToken);
      notFoundId = event.providerIds.tmdb ?? event.providerIds.imdb ?? event.name;
      isAniDbScrobble = false;
    }
  }

  // 4. Send notification if not found in Simkl database
  if (result && !result.success && result.reason === 'not_found' && notFoundId) {
    const link = isAniDbScrobble
      ? `https://anidb.net/anime/${notFoundId}`
      : `https://simkl.com/search/?q=${encodeURIComponent(event.seriesName ?? event.name)}`;

    sendNotification({
      title: `Failed to update Simkl for ${isAniDbScrobble ? 'anime ' : ''}${mediaType}`,
      message: `Item: ${event.seriesName ? `${event.seriesName} - ` : ''}${event.name}\nID: ${notFoundId}\nLink: ${link}`,
      priority: 4,
    });
  }
};

const handleStandardEpisode = async (
  event: ReturnType<typeof normalizeJellyfinWebhook>,
  userToken: string,
): Promise<{ result: ScrobbleResult; notFoundId: string }> => {
  let seriesProviderIds = { ...event.seriesProviderIds };
  if (
    !seriesProviderIds.tvdb &&
    !seriesProviderIds.tmdb &&
    !seriesProviderIds.imdb &&
    event.seriesId
  ) {
    const fetched = await defaultJellyfinClient.getSeriesProviderIds(event.seriesId);
    if (fetched) {
      seriesProviderIds = { ...seriesProviderIds, ...fetched };
    }
  }

  event.seriesProviderIds = seriesProviderIds;
  console.log(
    `Scrobbling standard series "${event.seriesName ?? event.name}" (S${event.seasonNumber}E${event.episodeNumber}) to Simkl.`,
  );

  const result = await scrobbleStandardEpisode(event, userToken);
  const notFoundId =
    event.seriesProviderIds.tvdb ??
    event.seriesProviderIds.tmdb ??
    event.seriesProviderIds.imdb ??
    event.seriesName ??
    'unknown';

  return { result, notFoundId };
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

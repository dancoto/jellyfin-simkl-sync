import type { NormalizedPlaybackEvent, RawJellyfinPayload } from './models';

export const isAnimeLibrary = (libraryName?: string | null): boolean => {
  if (!libraryName) return false;
  return libraryName.toLowerCase().includes('anime');
};

export const normalizeJellyfinWebhook = (payload: RawJellyfinPayload): NormalizedPlaybackEvent => {
  const notificationType = payload.NotificationType ?? 'PlaybackStop';
  const username = payload.NotificationUsername ?? payload.Username ?? payload.User?.Name ?? '';

  let itemType: 'Episode' | 'Movie' | 'Other' = 'Other';
  const rawItemType = (payload.ItemType ?? '').toLowerCase();
  if (rawItemType === 'episode') {
    itemType = 'Episode';
  } else if (rawItemType === 'movie') {
    itemType = 'Movie';
  }

  const itemId = payload.ItemId;
  const name = payload.Name ?? '';
  const seriesName = payload.SeriesName;
  const seriesId = payload.SeriesId;

  const libraryName =
    payload.LibraryName ?? payload.Library ?? payload.CollectionName ?? payload.Series_LibraryName;

  const path = payload.Path ?? payload.ItemPath;

  const seasonNumber =
    payload.SeasonNumber !== undefined
      ? Number(payload.SeasonNumber)
      : payload.ParentIndexNumber !== undefined
        ? Number(payload.ParentIndexNumber)
        : undefined;

  const episodeNumber =
    payload.EpisodeNumber !== undefined
      ? Number(payload.EpisodeNumber)
      : payload.IndexNumber !== undefined
        ? Number(payload.IndexNumber)
        : undefined;

  const year = payload.Year !== undefined ? Number(payload.Year) : undefined;

  const playbackPositionTicks = Number(payload.PlaybackPositionTicks ?? 0);
  const runTimeTicks = Number(payload.RunTimeTicks ?? 0);

  let progressPercentage = 0;
  if (runTimeTicks > 0) {
    progressPercentage = (playbackPositionTicks / runTimeTicks) * 100;
  } else if (payload.Played === true) {
    progressPercentage = 100;
  }

  const isCompleted =
    progressPercentage >= 80 ||
    payload.Played === true ||
    payload.SaveReason === 'PlaybackFinished';

  const providerIds: Record<string, string | undefined> = {};
  const seriesProviderIds: Record<string, string | undefined> = {};

  // 1. Check nested ProviderIds if provided
  if (typeof payload.ProviderIds === 'object' && payload.ProviderIds !== null) {
    for (const [k, v] of Object.entries(payload.ProviderIds)) {
      if (v) providerIds[k.toLowerCase()] = String(v);
    }
  }

  // 2. Check nested SeriesProviderIds if provided
  if (typeof payload.SeriesProviderIds === 'object' && payload.SeriesProviderIds !== null) {
    for (const [k, v] of Object.entries(payload.SeriesProviderIds)) {
      if (v) seriesProviderIds[k.toLowerCase()] = String(v);
    }
  }

  // 3. Scan flat keys (e.g. Provider_tvdb, Series_Provider_tvdb)
  for (const [key, value] of Object.entries(payload)) {
    if (!value) continue;
    const strVal = String(value);

    if (key.startsWith('Provider_')) {
      const provider = key.slice('Provider_'.length).toLowerCase();
      providerIds[provider] = strVal;
    } else if (key.startsWith('Series_Provider_')) {
      const provider = key.slice('Series_Provider_'.length).toLowerCase();
      seriesProviderIds[provider] = strVal;
    } else if (key.startsWith('Series_') && key.includes('Provider_')) {
      const provider = key.split('Provider_')[1]?.toLowerCase();
      if (provider) seriesProviderIds[provider] = strVal;
    }
  }

  return {
    notificationType,
    username,
    itemType,
    itemId,
    name,
    seriesName,
    seriesId,
    seasonNumber,
    episodeNumber,
    year,
    libraryName,
    path,
    playbackPositionTicks,
    runTimeTicks,
    progressPercentage,
    isCompleted,
    providerIds,
    seriesProviderIds,
  };
};

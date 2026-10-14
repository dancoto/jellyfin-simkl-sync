import {
  CatalogShow,
  OfficialEpisodeInfo,
  OfficialMappingsMap,
  OverridesSummary,
  RawEpisodeOverride,
  RawTvdbOverrides,
} from '../models/types';

/**
 * Look up the official episode mapping for a given series, season, and episode.
 */
export function getOfficialEp(
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): OfficialEpisodeInfo | null {
  return officialData[tvdbId]?.[seasonNum]?.[epNum] ?? null;
}

/**
 * Look up the override configuration for a given series, season, and episode.
 */
export function getOverrideEp(
  overridesData: RawTvdbOverrides,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): RawEpisodeOverride | undefined {
  return overridesData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
}

/**
 * Check whether a single episode override is flagged to skip AniList scrobbling.
 */
export function isEpisodeSkipped(override?: RawEpisodeOverride): boolean {
  return Boolean(override?.skipAniList);
}

/**
 * Check whether a single episode is missing AniList mapping.
 */
export function isEpisodeMissingAniList(
  override?: RawEpisodeOverride,
  official?: OfficialEpisodeInfo | null
): boolean {
  if (isEpisodeSkipped(override)) return false;
  if (typeof override?.anilistId === 'number') return false;
  if (override?.anilistId === null) return true;
  return !official;
}

/**
 * Check whether an episode has a custom override that diverges from official mapping.
 */
export function isEpisodeOverridden(
  override?: RawEpisodeOverride,
  official?: OfficialEpisodeInfo | null
): boolean {
  if (isEpisodeSkipped(override)) return false;
  if (typeof override?.anilistId === 'number') {
    return !official || official.anilistId !== override.anilistId || official.anilistEpisode !== override.anilistEpisode;
  }
  return false;
}

/**
 * Check whether an episode has been flagged to skip AniList scrobbling.
 */
export function isEpSkipped(
  overridesData: RawTvdbOverrides,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): boolean {
  return isEpisodeSkipped(getOverrideEp(overridesData, tvdbId, seasonNum, epNum));
}

/**
 * Check whether an episode is missing an AniList mapping.
 */
export function isEpMissingAniList(
  overridesData: RawTvdbOverrides,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): boolean {
  return isEpisodeMissingAniList(
    getOverrideEp(overridesData, tvdbId, seasonNum, epNum),
    getOfficialEp(officialData, tvdbId, seasonNum, epNum)
  );
}

/**
 * Check whether an episode has a custom override that diverges from official mapping.
 */
export function isEpOverridden(
  overridesData: RawTvdbOverrides,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): boolean {
  return isEpisodeOverridden(
    getOverrideEp(overridesData, tvdbId, seasonNum, epNum),
    getOfficialEp(officialData, tvdbId, seasonNum, epNum)
  );
}

/**
 * Count missing AniList mappings in a given show.
 */
export function countMissingInShow(
  overridesData: RawTvdbOverrides,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  show: CatalogShow
): number {
  let count = 0;
  for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
    for (const [epNum] of Object.entries(season.episodes || {})) {
      if (isEpMissingAniList(overridesData, officialData, tvdbId, seasonNum, epNum)) count++;
    }
  }
  return count;
}

/**
 * Count overridden episodes in a given show.
 */
export function countOverriddenInShow(
  overridesData: RawTvdbOverrides,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  show: CatalogShow
): number {
  let count = 0;
  for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
    for (const [epNum] of Object.entries(season.episodes || {})) {
      if (isEpOverridden(overridesData, officialData, tvdbId, seasonNum, epNum)) count++;
    }
  }
  return count;
}

/**
 * Count skipped episodes in a given show.
 */
export function countSkippedInShow(
  overridesData: RawTvdbOverrides,
  tvdbId: string,
  show: CatalogShow
): number {
  let count = 0;
  for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
    for (const [epNum] of Object.entries(season.episodes || {})) {
      if (isEpSkipped(overridesData, tvdbId, seasonNum, epNum)) count++;
    }
  }
  return count;
}

/**
 * Compute the overall library overrides statistics summary.
 */
export function calculateStatsSummary(
  catalog: Record<string, CatalogShow>,
  overrides: RawTvdbOverrides,
  official: OfficialMappingsMap
): OverridesSummary {
  let totalShows = 0;
  let totalEpisodes = 0;
  let unmappedEpisodes = 0;
  let showsWithOverrides = 0;
  let skippedEpisodes = 0;
  let mappedEpisodes = 0;

  for (const [tvdbId, show] of Object.entries(catalog)) {
    totalShows++;
    let showHasOverride = false;

    for (const [sKey, season] of Object.entries(show.seasons || {})) {
      for (const [eKey] of Object.entries(season.episodes || {})) {
        totalEpisodes++;
        if (isEpSkipped(overrides, tvdbId, sKey, eKey)) {
          skippedEpisodes++;
        } else if (isEpMissingAniList(overrides, official, tvdbId, sKey, eKey)) {
          unmappedEpisodes++;
        } else {
          mappedEpisodes++;
        }

        if (isEpOverridden(overrides, official, tvdbId, sKey, eKey)) {
          showHasOverride = true;
        }
      }
    }

    if (showHasOverride) showsWithOverrides++;
  }

  return {
    totalShows,
    totalEpisodes,
    mappedEpisodes,
    showsWithOverrides,
    unmappedEpisodes,
    skippedEpisodes,
  };
}

/**
 * Compute filter badge counts across the whole catalog.
 */
export function calculateFilterCounts(
  catalog: Record<string, CatalogShow>,
  overrides: RawTvdbOverrides,
  official: OfficialMappingsMap
): { all: number; unmapped: number; overrides: number; skipped: number; complete: number } {
  let all = 0;
  let unmapped = 0;
  let overridesCount = 0;
  let skipped = 0;
  let complete = 0;

  for (const [id, show] of Object.entries(catalog)) {
    all++;
    const missing = countMissingInShow(overrides, official, id, show);
    if (missing > 0) unmapped++;
    else complete++;

    if (countOverriddenInShow(overrides, official, id, show) > 0) overridesCount++;
    if (countSkippedInShow(overrides, id, show) > 0) skipped++;
  }

  return { all, unmapped, overrides: overridesCount, skipped, complete };
}

/**
 * Filter and sort catalog shows based on search query, filter mode, and sort order.
 */
export function filterAndSortShows(
  catalog: Record<string, CatalogShow>,
  overrides: RawTvdbOverrides,
  official: OfficialMappingsMap,
  searchQuery: string,
  filter: string,
  sort: string
): [string, CatalogShow][] {
  const entries = Object.entries(catalog);
  const q = searchQuery.trim().toLowerCase();

  const filtered = entries.filter(([tvdbId, show]) => {
    const titleMatch =
      !q ||
      (show.title || '').toLowerCase().includes(q) ||
      tvdbId.includes(q);
    if (!titleMatch) return false;

    if (filter === 'unmapped' || filter === 'missing-anilist') {
      return countMissingInShow(overrides, official, tvdbId, show) > 0;
    }
    if (filter === 'overrides' || filter === 'overridden') {
      return countOverriddenInShow(overrides, official, tvdbId, show) > 0;
    }
    if (filter === 'skipped' || filter === 'skipped-anilist') {
      return countSkippedInShow(overrides, tvdbId, show) > 0;
    }
    if (filter === 'mapped' || filter === 'complete') {
      return countMissingInShow(overrides, official, tvdbId, show) === 0;
    }
    return true;
  });

  filtered.sort(([idA, showA], [idB, showB]) => {
    if (sort === 'missing-desc') {
      const diff =
        countMissingInShow(overrides, official, idB, showB) -
        countMissingInShow(overrides, official, idA, showA);
      if (diff !== 0) return diff;
      return (showA.title || '').localeCompare(showB.title || '');
    }
    if (sort === 'overridden-desc') {
      const diff =
        countOverriddenInShow(overrides, official, idB, showB) -
        countOverriddenInShow(overrides, official, idA, showA);
      if (diff !== 0) return diff;
      return (showA.title || '').localeCompare(showB.title || '');
    }
    if (sort === 'missing-asc') {
      const diff =
        countMissingInShow(overrides, official, idA, showA) -
        countMissingInShow(overrides, official, idB, showB);
      if (diff !== 0) return diff;
      return (showA.title || '').localeCompare(showB.title || '');
    }
    if (sort === 'title-asc') {
      return (showA.title || '').localeCompare(showB.title || '');
    }
    return idA.localeCompare(idB);
  });

  return filtered;
}

/**
 * Paginate a list of shows.
 */
export function paginateShows(
  shows: [string, CatalogShow][],
  currentPage: number,
  pageSize: number
): [string, CatalogShow][] {
  if (pageSize >= 99999) return shows;
  const start = (currentPage - 1) * pageSize;
  return shows.slice(start, start + pageSize);
}

/**
 * Pure helper to ensure a nested series / season / episode exists in an overrides object.
 */
export function ensureEpisodeInOverrides(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): { overrides: RawTvdbOverrides; ep: RawEpisodeOverride } {
  const overrides: RawTvdbOverrides = JSON.parse(JSON.stringify(overridesData));
  if (!overrides[tvdbId]) {
    const catShow = catalogData[tvdbId] || ({} as any);
    overrides[tvdbId] = {
      title: catShow.title,
      tmdbId: catShow.tmdbId,
      seasons: {},
    };
  }
  if (!overrides[tvdbId].seasons) {
    overrides[tvdbId].seasons = {};
  }
  if (!overrides[tvdbId].seasons![seasonNum]) {
    overrides[tvdbId].seasons![seasonNum] = { episodes: {} };
  }
  if (!overrides[tvdbId].seasons![seasonNum].episodes) {
    overrides[tvdbId].seasons![seasonNum].episodes = {};
  }
  if (!overrides[tvdbId].seasons![seasonNum].episodes![epNum]) {
    const catEp = catalogData[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
    overrides[tvdbId].seasons![seasonNum].episodes![epNum] = {
      name: catEp?.name,
    };
  }
  return { overrides, ep: overrides[tvdbId].seasons![seasonNum].episodes![epNum] };
}

/**
 * Pure function to apply a field update to an episode override.
 */
export function applyEpisodeUpdate(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  tvdbId: string,
  seasonNum: string,
  epNum: string,
  field: 'anilistId' | 'anilistEpisode',
  value: string
): RawTvdbOverrides {
  const { overrides, ep } = ensureEpisodeInOverrides(
    overridesData,
    catalogData,
    tvdbId,
    seasonNum,
    epNum
  );

  if (field === 'anilistId') {
    const trimmed = value.trim();
    if (trimmed === '') {
      delete ep.anilistId;
      if (!ep.skipAniList && ep.anilistEpisode === undefined) {
        delete overrides[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      }
    } else if (trimmed.toLowerCase() === 'null') {
      ep.anilistId = null;
      delete ep.skipAniList;
    } else {
      const parsed = parseInt(trimmed, 10);
      ep.anilistId = Number.isInteger(parsed) ? parsed : null;
      delete ep.skipAniList;
    }
  } else if (field === 'anilistEpisode') {
    const parsed = parseInt(value, 10);
    ep.anilistEpisode = Number.isInteger(parsed) ? parsed : null;
  }

  return overrides;
}

/**
 * Pure function to apply the official mapping to an episode override.
 */
export function applyOfficialEpisode(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): { overrides: RawTvdbOverrides; official: OfficialEpisodeInfo | null } {
  const off = getOfficialEp(officialData, tvdbId, seasonNum, epNum);
  if (!off) {
    return { overrides: overridesData, official: null };
  }

  const { overrides, ep } = ensureEpisodeInOverrides(
    overridesData,
    catalogData,
    tvdbId,
    seasonNum,
    epNum
  );
  ep.anilistId = off.anilistId;
  ep.anilistEpisode = off.anilistEpisode;
  delete ep.skipAniList;

  return { overrides, official: off };
}

/**
 * Pure function to toggle the skipAniList state on an episode override.
 */
export function toggleSkipEpisodeOverride(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): RawTvdbOverrides {
  const { overrides, ep } = ensureEpisodeInOverrides(
    overridesData,
    catalogData,
    tvdbId,
    seasonNum,
    epNum
  );
  ep.skipAniList = !ep.skipAniList;
  if (!ep.skipAniList) {
    delete ep.skipAniList;
    if (ep.anilistId === undefined) {
      delete overrides[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
    }
  }
  return overrides;
}

/**
 * Pure function to remove an episode override and prune empty parent objects.
 */
export function clearEpisodeOverride(
  overridesData: RawTvdbOverrides,
  tvdbId: string,
  seasonNum: string,
  epNum: string
): RawTvdbOverrides {
  const overrides: RawTvdbOverrides = JSON.parse(JSON.stringify(overridesData));
  const show = overrides[tvdbId];
  if (show?.seasons?.[seasonNum]?.episodes?.[epNum]) {
    delete show.seasons[seasonNum].episodes![epNum];
    if (Object.keys(show.seasons[seasonNum].episodes || {}).length === 0) {
      delete show.seasons[seasonNum];
    }
    if (Object.keys(show.seasons || {}).length === 0) {
      delete overrides[tvdbId];
    }
  }
  return overrides;
}

/**
 * Pure function to apply a single AniList ID across all episodes in a season.
 */
export function applyBatchSeasonOverride(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  tvdbId: string,
  seasonNum: string,
  anilistId: number
): RawTvdbOverrides {
  const season = catalogData[tvdbId]?.seasons?.[seasonNum];
  if (!season || !season.episodes) return overridesData;

  const overrides: RawTvdbOverrides = JSON.parse(JSON.stringify(overridesData));
  for (const [epNum] of Object.entries(season.episodes)) {
    if (!overrides[tvdbId]) {
      overrides[tvdbId] = { title: catalogData[tvdbId]?.title || '', seasons: {} };
    }
    if (!overrides[tvdbId].seasons) overrides[tvdbId].seasons = {};
    if (!overrides[tvdbId].seasons![seasonNum]) {
      overrides[tvdbId].seasons![seasonNum] = { episodes: {} };
    }
    if (!overrides[tvdbId].seasons![seasonNum].episodes) {
      overrides[tvdbId].seasons![seasonNum].episodes = {};
    }

    const ep = overrides[tvdbId].seasons![seasonNum].episodes![epNum] || {};
    ep.anilistId = anilistId;
    delete ep.skipAniList;
    overrides[tvdbId].seasons![seasonNum].episodes![epNum] = ep;
  }
  return overrides;
}

/**
 * Pure function to apply official mappings across an entire season.
 */
export function applyOfficialSeasonOverride(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string
): { overrides: RawTvdbOverrides; appliedCount: number } {
  const season = catalogData[tvdbId]?.seasons?.[seasonNum];
  if (!season || !season.episodes) return { overrides: overridesData, appliedCount: 0 };

  let appliedCount = 0;
  const overrides: RawTvdbOverrides = JSON.parse(JSON.stringify(overridesData));

  for (const [epNum] of Object.entries(season.episodes)) {
    const off = getOfficialEp(officialData, tvdbId, seasonNum, epNum);
    if (off) {
      if (!overrides[tvdbId]) {
        overrides[tvdbId] = { title: catalogData[tvdbId]?.title || '', seasons: {} };
      }
      if (!overrides[tvdbId].seasons) overrides[tvdbId].seasons = {};
      if (!overrides[tvdbId].seasons![seasonNum]) {
        overrides[tvdbId].seasons![seasonNum] = { episodes: {} };
      }
      if (!overrides[tvdbId].seasons![seasonNum].episodes) {
        overrides[tvdbId].seasons![seasonNum].episodes = {};
      }

      const ep = overrides[tvdbId].seasons![seasonNum].episodes![epNum] || {};
      ep.anilistId = off.anilistId;
      ep.anilistEpisode = off.anilistEpisode;
      delete ep.skipAniList;
      overrides[tvdbId].seasons![seasonNum].episodes![epNum] = ep;
      appliedCount++;
    }
  }

  return { overrides, appliedCount };
}

/**
 * Pure function to mark all unmapped episodes in a season as skipped for AniList.
 */
export function skipUnmappedSeasonOverride(
  overridesData: RawTvdbOverrides,
  catalogData: Record<string, CatalogShow>,
  officialData: OfficialMappingsMap,
  tvdbId: string,
  seasonNum: string
): { overrides: RawTvdbOverrides; changedCount: number } {
  const season = catalogData[tvdbId]?.seasons?.[seasonNum];
  if (!season || !season.episodes) return { overrides: overridesData, changedCount: 0 };

  let changedCount = 0;
  const overrides: RawTvdbOverrides = JSON.parse(JSON.stringify(overridesData));

  for (const [epNum] of Object.entries(season.episodes)) {
    if (
      !isEpSkipped(overrides, tvdbId, seasonNum, epNum) &&
      isEpMissingAniList(overrides, officialData, tvdbId, seasonNum, epNum)
    ) {
      if (!overrides[tvdbId]) {
        overrides[tvdbId] = { title: catalogData[tvdbId]?.title || '', seasons: {} };
      }
      if (!overrides[tvdbId].seasons) overrides[tvdbId].seasons = {};
      if (!overrides[tvdbId].seasons![seasonNum]) {
        overrides[tvdbId].seasons![seasonNum] = { episodes: {} };
      }
      if (!overrides[tvdbId].seasons![seasonNum].episodes) {
        overrides[tvdbId].seasons![seasonNum].episodes = {};
      }

      const ep = overrides[tvdbId].seasons![seasonNum].episodes![epNum] || {};
      ep.skipAniList = true;
      overrides[tvdbId].seasons![seasonNum].episodes![epNum] = ep;
      changedCount++;
    }
  }

  return { overrides, changedCount };
}

/**
 * Pure function to remove a series from catalog, overrides, and official mapping datasets.
 */
export function removeSeriesFromCatalog(
  catalogData: Record<string, CatalogShow>,
  overridesData: RawTvdbOverrides,
  officialData: OfficialMappingsMap,
  tvdbId: string
): {
  catalog: Record<string, CatalogShow>;
  overrides: RawTvdbOverrides;
  official: OfficialMappingsMap;
} {
  const catalog = { ...catalogData };
  delete catalog[tvdbId];
  const overrides = { ...overridesData };
  delete overrides[tvdbId];
  const official = { ...officialData };
  delete official[tvdbId];

  return { catalog, overrides, official };
}

/**
 * Pure function to toggle a card ID in the list of open cards.
 */
export function toggleCardId(openCards: string[], tvdbId: string): string[] {
  return openCards.includes(tvdbId)
    ? openCards.filter((id) => id !== tvdbId)
    : [...openCards, tvdbId];
}

/**
 * Pure function to resolve sort option based on active filter.
 */
export function resolveFilterSort(currentFilter: string, currentSort: string): string {
  if (currentFilter === 'unmapped') return 'missing-desc';
  if (currentFilter === 'overrides') return 'overridden-desc';
  return currentSort;
}

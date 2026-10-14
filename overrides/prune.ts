import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type AnimeResolver, defaultAnimeResolver } from '../anime/resolver';
import { TvdbOverridesIndex, type RawTvdbOverrides } from '../anime/tvdb-overrides';
import { logger } from '../shared/logger';
import { type CatalogData, loadCatalog } from './catalog';

export interface PrunedOverrideDetail {
  tvdbId: string;
  title: string;
  season: number;
  episode: number;
  reason: string;
}

export interface PruneOrphanedSummary {
  prunedEpisodesCount: number;
  prunedShowsCount: number;
  affectedShowTitles: string[];
  backupPath?: string;
  details: PrunedOverrideDetail[];
}

export interface PruneOrphanedOptions {
  customCatalogPath?: string;
  customOverridesPath?: string;
  catalog?: CatalogData;
  resolver?: AnimeResolver;
}

/**
 * Prunes orphaned overrides from mapping-overrides.json where episodes or specials
 * no longer exist on disk / in the Jellyfin catalog (e.g. after user renumbered or deleted files).
 *
 * Safety Guardrails:
 * - Creates a timestamped backup before writing any changes.
 * - Only prunes episodes for shows that exist in the catalog (leaves unknown/offline shows intact).
 * - Prunes empty seasons and empty shows cleanly.
 * - Updates the in-memory resolver immediately.
 */
export const pruneOrphanedOverrides = (
  options: PruneOrphanedOptions = {},
): PruneOrphanedSummary => {
  const overridesPath = options.customOverridesPath || TvdbOverridesIndex.getFilePath();
  const summary: PruneOrphanedSummary = {
    prunedEpisodesCount: 0,
    prunedShowsCount: 0,
    affectedShowTitles: [],
    details: [],
  };

  if (!existsSync(overridesPath)) {
    return summary;
  }

  let currentOverrides: RawTvdbOverrides = {};
  try {
    const raw = readFileSync(overridesPath, 'utf-8');
    currentOverrides = JSON.parse(raw) as RawTvdbOverrides;
  } catch (err) {
    logger.error(`[Prune] Failed reading overrides at ${overridesPath}:`, err);
    return summary;
  }

  const catalog = options.catalog || loadCatalog(options.customCatalogPath);
  if (!catalog || !catalog.shows || Object.keys(catalog.shows).length === 0) {
    logger.warn('[Prune] Catalog is empty or missing; skipping pruning to avoid false deletions.');
    return summary;
  }

  const affectedShows = new Set<string>();
  const affectedTitles = new Set<string>();

  for (const [tvdbId, show] of Object.entries(currentOverrides)) {
    const catShow = catalog.shows[tvdbId];
    if (!catShow) {
      // Show is not in the Jellyfin catalog (e.g. offline show or different library).
      // Keep untouched.
      continue;
    }

    const title = show.title || catShow.title || `Show ${tvdbId}`;
    const seasons = show.seasons || {};

    for (const [sKey, season] of Object.entries(seasons)) {
      const sNum = parseInt(sKey, 10);
      const catSeason = catShow.seasons?.[sKey];
      const episodes = season.episodes || {};

      for (const [eKey] of Object.entries(episodes)) {
        const eNum = parseInt(eKey, 10);
        const catEp = catSeason?.episodes?.[eKey];

        if (!catEp) {
          // Episode does not exist in Jellyfin on disk!
          delete episodes[eKey];
          summary.prunedEpisodesCount++;
          affectedShows.add(tvdbId);
          affectedTitles.add(title);
          summary.details.push({
            tvdbId,
            title,
            season: sNum,
            episode: eNum,
            reason: `Episode S${sKey}E${eKey} not found in Jellyfin catalog`,
          });
        }
      }

      // If season has no remaining episodes and no season-level override fields, prune season
      if (
        Object.keys(episodes).length === 0 &&
        season.anilistId === undefined &&
        season.anilistEpisodeOffset === undefined
      ) {
        delete seasons[sKey];
      }
    }

    // If show has no remaining seasons, prune show
    if (Object.keys(seasons).length === 0) {
      delete currentOverrides[tvdbId];
      summary.prunedShowsCount++;
    }
  }

  if (summary.prunedEpisodesCount > 0) {
    // 1. Create timestamped backup
    const backupPath = overridesPath.replace(/\.json$/, `.backup.${Date.now()}.json`);
    try {
      copyFileSync(overridesPath, backupPath);
      summary.backupPath = backupPath;
      logger.info(`[Prune] Backed up overrides to ${backupPath}`);
    } catch (err) {
      logger.error(`[Prune] Failed to create backup before pruning:`, err);
    }

    // 2. Save pruned overrides
    try {
      writeFileSync(overridesPath, JSON.stringify(currentOverrides, null, 2), 'utf-8');
      logger.info(
        `[Prune] Pruned ${summary.prunedEpisodesCount} orphaned overrides across ${affectedShows.size} show(s).`,
      );
    } catch (err) {
      logger.error(`[Prune] Failed to save pruned overrides:`, err);
      return summary;
    }

    // 3. Update resolver in memory
    const resolver = options.resolver || defaultAnimeResolver;
    try {
      if (typeof resolver.setTvdbOverrides === 'function') {
        resolver.setTvdbOverrides(TvdbOverridesIndex.parse(currentOverrides));
      }
    } catch (err) {
      logger.warn(`[Prune] Could not update in-memory resolver immediately:`, err);
    }
  }

  summary.affectedShowTitles = Array.from(affectedTitles);
  return summary;
};

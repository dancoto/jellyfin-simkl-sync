import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AnimeResolver } from '../anime/resolver';
import {
  TvdbOverridesIndex,
  type RawSeasonOverride,
  type RawTvdbOverrides,
} from '../anime/tvdb-overrides';
import { logger } from '../shared/logger';
import { loadCatalog } from './catalog';

export interface RetireDetail {
  tvdbId: string;
  title: string;
  season: number;
  episode: number;
  anilistId: number;
  anilistEpisode: number;
  source: string;
}

export interface RetireSummary {
  retiredCount: number;
  affectedShowsCount: number;
  affectedShowTitles: string[];
  backupPath?: string;
  details: RetireDetail[];
}

export interface RetireOptions {
  customOverridesPath?: string;
  resolver?: AnimeResolver;
}

/**
 * Checks all manual overrides in mapping-overrides.json against official AniBridge/Anime-Lists mappings.
 * If an override is 100% identical (same anilistId AND same anilistEpisode), the override is retired (deleted),
 * allowing the episode to cleanly follow upstream official mappings.
 *
 * Skips explicit skips (skipAniList: true) and explicit nulls (anilistId: null).
 */
export const retireRedundantOverrides = (options: RetireOptions = {}): RetireSummary => {
  const filePath = options.customOverridesPath || TvdbOverridesIndex.getFilePath();

  const summary: RetireSummary = {
    retiredCount: 0,
    affectedShowsCount: 0,
    affectedShowTitles: [],
    details: [],
  };

  if (!existsSync(filePath)) {
    return summary;
  }

  let currentOverrides: RawTvdbOverrides = {};
  try {
    const raw = readFileSync(filePath, 'utf-8');
    currentOverrides = JSON.parse(raw) as RawTvdbOverrides;
  } catch (err) {
    logger.error(`[Retire] Failed reading overrides at ${filePath}:`, err);
    return summary;
  }

  const resolver = options.resolver;
  if (!resolver) {
    logger.warn('[Retire] No AnimeResolver provided for retiring redundant overrides.');
    return summary;
  }

  const catalog = loadCatalog();
  const catalogShows = catalog?.shows || {};
  const affectedShowSet = new Set<string>();
  const affectedTitles = new Set<string>();

  for (const [tvdbId, show] of Object.entries(currentOverrides)) {
    const title = show.title || `Show ${tvdbId}`;
    const seasons = show.seasons || {};
    const effectiveTmdbId = show.tmdbId || catalogShows[tvdbId]?.tmdbId;

    for (const [sKey, season] of Object.entries(seasons)) {
      const sNum = parseInt(sKey, 10);
      const episodes = season.episodes || {};

      for (const [eKey, ep] of Object.entries(episodes)) {
        // 1. Safety Guardrails: Never retire skips or explicit unmapped nulls
        if (ep.skipAniList || ep.anilistId === null || ep.anilistId === undefined) {
          continue;
        }

        const numericAnilistId =
          typeof ep.anilistId === 'number'
            ? ep.anilistId
            : parseInt(String(ep.anilistId).trim(), 10);

        if (!Number.isInteger(numericAnilistId)) {
          continue;
        }

        const eNum = parseInt(eKey, 10);
        const expectedEpNum = ep.anilistEpisode ?? eNum;

        // 2. Resolve official mapping
        let off = resolver.resolveOfficialEpisode({ tvdbId, tmdbId: effectiveTmdbId }, sNum, eNum);

        // Fallback: If Season 0 Episode 1 (standalone movie) is not a TV special, check official movie mapping
        if (!off?.anilist && sNum === 0 && eNum === 1) {
          const movieOff =
            typeof (resolver as any).resolveOfficialMovie === 'function'
              ? (resolver as any).resolveOfficialMovie({ tvdbId, tmdbId: effectiveTmdbId })
              : typeof resolver.resolveMovie === 'function'
                ? resolver.resolveMovie({ tvdbId, tmdbId: effectiveTmdbId })
                : null;
          if (movieOff?.anilist) {
            off = {
              episodeNumber: movieOff.episodeNumber,
              isSpecial: false,
              kind: 'regular',
              source: movieOff.source,
              anilist: movieOff.anilist,
            };
          }
        }

        if (!off?.anilist) {
          continue;
        }

        // 3. Exact Match Check: Both AniList Media ID and Episode Number must match
        if (
          off.anilist.mediaId === numericAnilistId &&
          off.anilist.episodeNumber === expectedEpNum
        ) {
          // Identical match -> Safe to retire!
          delete episodes[eKey];
          summary.retiredCount++;
          affectedShowSet.add(tvdbId);
          affectedTitles.add(title);
          summary.details.push({
            tvdbId,
            title,
            season: sNum,
            episode: eNum,
            anilistId: numericAnilistId,
            anilistEpisode: expectedEpNum,
            source: off.source || 'official',
          });
        }
      }

      // Prune season if episodes became empty and has no season-level override
      if (
        Object.keys(episodes).length === 0 &&
        season.anilistId === undefined &&
        (season as RawSeasonOverride).anilistEpisodeOffset === undefined
      ) {
        delete seasons[sKey];
      }
    }

    // Prune show if seasons became empty
    if (Object.keys(seasons).length === 0) {
      delete currentOverrides[tvdbId];
    }
  }

  summary.affectedShowsCount = affectedShowSet.size;
  summary.affectedShowTitles = Array.from(affectedTitles);

  // If any overrides were retired, backup and save
  if (summary.retiredCount > 0) {
    try {
      const backupPath = filePath.replace(/\.json$/, `.backup.${Date.now()}.json`);
      copyFileSync(filePath, backupPath);
      summary.backupPath = backupPath;
      logger.info(
        `[Retire] Backed up overrides to ${backupPath} before retiring redundant entries.`,
      );

      writeFileSync(filePath, JSON.stringify(currentOverrides, null, 2), 'utf-8');
      logger.info(
        `[Retire] Successfully retired ${summary.retiredCount} redundant override(s) across ${summary.affectedShowsCount} show(s) at ${filePath}.`,
      );

      // Reload resolver's in-memory overrides index
      if (typeof resolver.setTvdbOverrides === 'function') {
        resolver.setTvdbOverrides(TvdbOverridesIndex.load(filePath));
      }
    } catch (err) {
      logger.error(`[Retire] Failed saving overrides after retiring redundant entries:`, err);
    }
  }

  return summary;
};

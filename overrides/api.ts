import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defaultAnimeResolver } from '../anime';
import {
  TvdbOverridesIndex,
  type RawShowOverride,
  type RawTvdbOverrides,
} from '../anime/tvdb-overrides';
import {
  loadCatalog,
  pruneSparseOverrides,
  syncJellyfinCatalog,
  type AnimeCatalog,
  type CatalogSyncOptions,
} from './catalog';
import { renderOverridesHtml } from './page';

export interface OfficialEpisodeInfo {
  anilistId: number;
  anilistEpisode: number;
}

export type OfficialMappingsMap = Record<
  string,
  Record<string, Record<string, OfficialEpisodeInfo | null>>
>;

export const handleOverridesPage = (): Response => {
  const html = renderOverridesHtml();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

export const handleGetOverrides = async (): Promise<Response> => {
  if (!defaultAnimeResolver.isInitialized()) {
    try {
      await defaultAnimeResolver.initialize();
    } catch (err) {
      console.warn('AnimeResolver: failed initializing in handleGetOverrides:', err);
    }
  }

  const filePath = TvdbOverridesIndex.getFilePath();
  let overrides: RawTvdbOverrides = {};

  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      overrides = JSON.parse(content) as RawTvdbOverrides;
    } catch (err) {
      console.error(`Failed to read overrides from ${filePath}:`, err);
    }
  }

  // Load Jellyfin anime catalog
  const catalogData = loadCatalog();
  const catalogShows: AnimeCatalog = { ...catalogData.shows };

  // Ensure any shows present in overrides are also present in catalog
  for (const [tvdbId, show] of Object.entries(overrides)) {
    if (!catalogShows[tvdbId]) {
      catalogShows[tvdbId] = {
        tvdbId,
        title: show.title || `Show ${tvdbId}`,
        tmdbId: show.tmdbId,
        seasons: {},
      };
    }
    const catShow = catalogShows[tvdbId];
    for (const [sKey, sea] of Object.entries(show.seasons || {})) {
      const sNum = parseInt(sKey, 10);
      if (!catShow.seasons[sKey]) {
        catShow.seasons[sKey] = {
          seasonNumber: sNum,
          episodes: {},
        };
      }
      const catSea = catShow.seasons[sKey];
      for (const [eKey, ep] of Object.entries(sea.episodes || {})) {
        const eNum = parseInt(eKey, 10);
        if (!catSea.episodes[eKey]) {
          catSea.episodes[eKey] = {
            episodeNumber: eNum,
            name: ep.name,
          };
        }
      }
    }
  }

  // Pre-compute official AniList mappings for all episodes in the catalog
  const official: OfficialMappingsMap = {};
  for (const [tvdbId, show] of Object.entries(catalogShows)) {
    official[tvdbId] = {};
    for (const [seasonNumStr, season] of Object.entries(show.seasons || {})) {
      const seasonNum = parseInt(seasonNumStr, 10);
      official[tvdbId][seasonNumStr] = {};
      for (const [epNumStr] of Object.entries(season.episodes || {})) {
        const epNum = parseInt(epNumStr, 10);
        const resolved = defaultAnimeResolver.resolveOfficialEpisode(
          { tvdbId, tmdbId: show.tmdbId },
          seasonNum,
          epNum,
        );
        if (resolved?.anilist) {
          official[tvdbId][seasonNumStr][epNumStr] = {
            anilistId: resolved.anilist.mediaId,
            anilistEpisode: resolved.anilist.episodeNumber,
          };
        } else {
          official[tvdbId][seasonNumStr][epNumStr] = null;
        }
      }
    }
  }

  return Response.json({
    filePath,
    catalog: catalogShows,
    overrides,
    official,
    lastUpdated: catalogData.lastUpdated,
  });
};

export const handleSaveOverrides = async (req: Request): Promise<Response> => {
  try {
    const body = (await req.json()) as {
      overrides?: RawTvdbOverrides;
      tvdbId?: string;
      show?: RawShowOverride;
    };

    const filePath = TvdbOverridesIndex.getFilePath();
    let currentOverrides: RawTvdbOverrides = {};

    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        currentOverrides = JSON.parse(content) as RawTvdbOverrides;
      } catch {
        currentOverrides = {};
      }
    }

    if (body.overrides) {
      currentOverrides = pruneSparseOverrides(body.overrides);
    } else if (body.tvdbId && body.show) {
      const prunedSingle = pruneSparseOverrides({ [body.tvdbId]: body.show });
      const singleShow = prunedSingle[body.tvdbId];
      if (singleShow) {
        currentOverrides[body.tvdbId] = singleShow;
      } else {
        delete currentOverrides[body.tvdbId];
      }
    } else {
      return Response.json(
        { error: 'Missing overrides or tvdbId/show parameters' },
        { status: 400 },
      );
    }

    writeFileSync(filePath, JSON.stringify(currentOverrides, null, 2), 'utf-8');
    console.log(`Saved mapping overrides to ${filePath}`);

    // Re-initialize resolver so overrides take effect immediately in memory
    try {
      await defaultAnimeResolver.initialize();
      console.log('Reloaded AnimeResolver indices with new overrides');
    } catch (err) {
      console.error('Failed reloading AnimeResolver:', err);
    }

    return Response.json({ status: 'saved' });
  } catch (err) {
    console.error('Error saving overrides:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};

export const handleSyncCatalog = async (req: Request): Promise<Response> => {
  try {
    let options: CatalogSyncOptions | undefined;
    if (req.headers.get('content-type')?.includes('application/json')) {
      try {
        options = (await req.json()) as CatalogSyncOptions;
      } catch {
        options = undefined;
      }
    }

    const summary = await syncJellyfinCatalog(options);
    return Response.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error('Error during Jellyfin catalog sync:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};

/** Alias for backward compatibility */
export const handleImportOverrides = handleSyncCatalog;

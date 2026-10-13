import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TVDB_OVERRIDES_FILE_NAME = 'mapping-overrides.json';

export interface RawEpisodeOverride {
  name?: string;
  anidbId?: string | number | null;
  anidbEpisode?: number | null;
  anilistId?: string | number | null;
  anilistEpisode?: number | null;
  isSpecial?: boolean;
}

export interface RawSeasonOverride {
  anidbId?: string | number | null;
  anidbEpisodeOffset?: number;
  anilistId?: string | number | null;
  anilistEpisodeOffset?: number;
  episodes?: Record<string, RawEpisodeOverride>;
}

export interface RawShowOverride {
  title?: string;
  tmdbId?: string;
  seasons?: Record<string | number, RawSeasonOverride>;
}

export type RawTvdbOverrides = Record<string, RawShowOverride>;

export interface TvdbResolvedOverride {
  skip?: boolean;
  skipAniDb?: boolean;
  skipAniList?: boolean;
  anidbId?: string;
  anidbEpisode?: number;
  anilistId?: number;
  anilistEpisode?: number;
  isSpecial?: boolean;
}

export interface EnsureShowOverrideParams {
  tvdbId: string;
  title: string;
  tmdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  anidbId?: string | number | null;
  anidbEpisode?: number | null;
  anilistId?: string | number | null;
  anilistEpisode?: number | null;
}

export interface EnsureShowOverrideResult {
  added: boolean;
  reason: 'show_added' | 'season_added' | 'episode_added' | 'already_exists' | 'missing_tvdb_id';
  filePath?: string;
  data?: RawTvdbOverrides;
}

export class TvdbOverridesIndex {
  private shows: Map<string, RawShowOverride> = new Map();

  public static getFilePath(customPath?: string): string {
    if (customPath) {
      return resolve(customPath);
    }
    const inConfig = resolve('/config', TVDB_OVERRIDES_FILE_NAME);
    if (existsSync(inConfig)) {
      return inConfig;
    }
    return resolve('.', TVDB_OVERRIDES_FILE_NAME);
  }

  public static load(customPath?: string): TvdbOverridesIndex | null {
    const filePath = TvdbOverridesIndex.getFilePath(customPath);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content) as RawTvdbOverrides;
      console.log(`Loaded TVDB mapping overrides from ${filePath}`);
      return TvdbOverridesIndex.parse(parsed);
    } catch (error) {
      console.error(`Failed to load TVDB mapping overrides from ${filePath}:`, error);
      return null;
    }
  }

  public static parse(data: RawTvdbOverrides): TvdbOverridesIndex {
    const index = new TvdbOverridesIndex();
    for (const [tvdbId, show] of Object.entries(data)) {
      if (show && typeof show === 'object') {
        index.shows.set(String(tvdbId).trim(), show);
      }
    }
    return index;
  }

  public hasShow(tvdbId: string | undefined): boolean {
    if (!tvdbId) {
      return false;
    }
    return this.shows.has(String(tvdbId).trim());
  }

  public static ensureShowInOverrides(
    params: EnsureShowOverrideParams,
    customPath?: string,
  ): EnsureShowOverrideResult {
    if (!params.tvdbId) {
      return { added: false, reason: 'missing_tvdb_id' };
    }

    const filePath = TvdbOverridesIndex.getFilePath(customPath);
    let data: RawTvdbOverrides = {};

    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        data = JSON.parse(content) as RawTvdbOverrides;
      } catch (err) {
        console.error(`Failed to parse overrides file at ${filePath}:`, err);
        data = {};
      }
    }

    const showKey = String(params.tvdbId).trim();
    let show = data[showKey];
    let added = false;
    let reason: EnsureShowOverrideResult['reason'] = 'already_exists';

    if (!show) {
      show = {
        title: params.title,
        tmdbId: params.tmdbId,
        seasons: {},
      };
      data[showKey] = show;
      added = true;
      reason = 'show_added';
    } else {
      if (!show.title && params.title) {
        show.title = params.title;
      }
      if (!show.tmdbId && params.tmdbId) {
        show.tmdbId = params.tmdbId;
      }
      if (!show.seasons) {
        show.seasons = {};
      }
    }

    const seasons = show.seasons ?? {};
    show.seasons = seasons;

    const seasonNum = params.seasonNumber ?? 1;
    const epNum = params.episodeNumber ?? 1;
    const seasonKey = String(seasonNum);
    let season = seasons[seasonKey] ?? seasons[seasonNum];

    if (!season) {
      season = { episodes: {} };
      seasons[seasonKey] = season;
      if (!added) {
        added = true;
        reason = 'season_added';
      }
    }

    if (!season.episodes) {
      season.episodes = {};
    }
    const episodes = season.episodes;

    const epKey = String(epNum);
    if (!episodes[epKey]) {
      episodes[epKey] = {
        name: params.episodeName ?? `Episode ${epNum}`,
        anidbId: params.anidbId ?? null,
        anidbEpisode: params.anidbEpisode ?? (params.anidbId ? epNum : null),
        anilistId: params.anilistId ?? null,
        anilistEpisode: params.anilistEpisode ?? (params.anilistId ? epNum : null),
      };
      if (!added) {
        added = true;
        reason = 'episode_added';
      }
    }

    if (added) {
      try {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(
          `Updated TVDB mapping overrides at ${filePath} (${reason} for TVDB ${params.tvdbId})`,
        );
      } catch (err) {
        console.error(`Failed to write TVDB overrides to ${filePath}:`, err);
        return { added: false, reason: 'already_exists', filePath, data };
      }
    }

    return { added, reason, filePath, data };
  }

  public getEpisodeOverride(
    tvdbId: string | undefined,
    seasonNumber: number,
    episodeNumber: number,
  ): TvdbResolvedOverride | null {
    if (!tvdbId) {
      return null;
    }

    const show = this.shows.get(String(tvdbId).trim());
    if (!show || !show.seasons) {
      return null;
    }

    const season = show.seasons[String(seasonNumber)] ?? show.seasons[seasonNumber];
    if (!season) {
      return null;
    }

    // 1. Check episode-specific override
    let epConfig: RawEpisodeOverride | undefined;
    if (season.episodes) {
      epConfig = season.episodes[String(episodeNumber)];

      // Check range keys (e.g. "1-12")
      if (!epConfig) {
        for (const [key, conf] of Object.entries(season.episodes)) {
          if (key.includes('-')) {
            const [startStr, endStr] = key.split('-').map((s) => s.trim());
            if (!startStr || !endStr) continue;
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (
              Number.isInteger(start) &&
              Number.isInteger(end) &&
              episodeNumber >= start &&
              episodeNumber <= end
            ) {
              epConfig = conf;
              break;
            }
          }
        }
      }
    }

    // 2. Resolve episode configuration
    if (epConfig) {
      const skipAniDb = epConfig.anidbId === null;
      const skipAniList = epConfig.anilistId === null;

      // Both explicitly null -> skip both flows
      if (skipAniDb && skipAniList) {
        return { skip: true, skipAniDb: true, skipAniList: true };
      }

      const anidbId =
        epConfig.anidbId !== undefined && epConfig.anidbId !== null
          ? String(epConfig.anidbId)
          : undefined;

      const anilistId =
        epConfig.anilistId !== undefined && epConfig.anilistId !== null
          ? parseInt(String(epConfig.anilistId), 10)
          : undefined;

      return {
        skip: false,
        skipAniDb,
        skipAniList,
        anidbId,
        anidbEpisode: epConfig.anidbEpisode ?? (anidbId ? episodeNumber : undefined),
        anilistId: Number.isInteger(anilistId) ? anilistId : undefined,
        anilistEpisode: epConfig.anilistEpisode ?? (anilistId ? episodeNumber : undefined),
        isSpecial: epConfig.isSpecial ?? seasonNumber === 0,
      };
    }

    // 3. Fallback to season-level 1:1 defaults
    const hasSeasonAniDb = season.anidbId !== undefined;
    const hasSeasonAniList = season.anilistId !== undefined;

    if (hasSeasonAniDb || hasSeasonAniList) {
      const skipAniDb = season.anidbId === null;
      const skipAniList = season.anilistId === null;

      if (skipAniDb && skipAniList) {
        return { skip: true, skipAniDb: true, skipAniList: true };
      }

      const anidbId =
        season.anidbId !== undefined && season.anidbId !== null
          ? String(season.anidbId)
          : undefined;

      const anilistId =
        season.anilistId !== undefined && season.anilistId !== null
          ? parseInt(String(season.anilistId), 10)
          : undefined;

      const anidbOffset = season.anidbEpisodeOffset ?? 0;
      const anilistOffset = season.anilistEpisodeOffset ?? 0;

      return {
        skip: false,
        skipAniDb,
        skipAniList,
        anidbId,
        anidbEpisode: anidbId ? episodeNumber + anidbOffset : undefined,
        anilistId: Number.isInteger(anilistId) ? anilistId : undefined,
        anilistEpisode: anilistId ? episodeNumber + anilistOffset : undefined,
        isSpecial: seasonNumber === 0,
      };
    }

    return null;
  }
}

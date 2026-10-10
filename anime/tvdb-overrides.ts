import { existsSync, readFileSync } from 'node:fs';
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

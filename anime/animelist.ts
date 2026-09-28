import type { AniDbSeasonSegment } from './models';
import { orderSegments } from './segments';

export interface AnimeListEntry {
  animeId: string;
  seriesKey: string;
  defaultTvdbSeason: number | null;
  episodeOffset: number;
  mappings: Array<{
    anidbSeason: number;
    tvdbSeason: number;
    range?: string;
  }>;
}

export class AnimeListIndex {
  public readonly entriesByTvdb: Map<string, AnimeListEntry[]> = new Map();
  public readonly entriesByAnimeId: Map<string, AnimeListEntry> = new Map();
  public readonly moviesByKey: Map<string, { animeId: string; episodeNumber: number }> = new Map();

  public static parse(xmlContent: string): AnimeListIndex {
    const index = new AnimeListIndex();

    // Regex to match each <anime ...> ... </anime> or self-closing <anime .../>
    const animeRegex = /<anime\s+([^>]+?)(?:\s*\/>|>([\s\S]*?)<\/anime>)/gi;
    let match: RegExpExecArray | null;

    while ((match = animeRegex.exec(xmlContent)) !== null) {
      const attributesStr = match[1]!;
      const body = match[2] ?? '';

      const anidbId = getAttr(attributesStr, 'anidbid');
      if (!anidbId) continue;

      const tvdbId = getAttr(attributesStr, 'tvdbid');
      const defaultSeasonStr = getAttr(attributesStr, 'defaulttvdbseason');
      const offsetStr = getAttr(attributesStr, 'episodeoffset');
      const tmdbId = getAttr(attributesStr, 'tmdbid');
      const imdbId = getAttr(attributesStr, 'imdbid');

      // Check movie mappings
      if (tmdbId && /^\d+$/.test(tmdbId)) {
        index.moviesByKey.set(`tmdb:${tmdbId}`, { animeId: anidbId, episodeNumber: 1 });
      }
      if (imdbId && /^tt\d+$/i.test(imdbId)) {
        index.moviesByKey.set(`imdb:${imdbId.toLowerCase()}`, {
          animeId: anidbId,
          episodeNumber: 1,
        });
      }

      // Check if this entry is tied to a valid TVDB series
      if (!tvdbId || !/^\d+$/.test(tvdbId)) {
        continue;
      }

      const defaultTvdbSeason =
        defaultSeasonStr && /^\d+$/.test(defaultSeasonStr) ? parseInt(defaultSeasonStr, 10) : null;
      const episodeOffset = offsetStr ? parseInt(offsetStr, 10) || 0 : 0;

      // Parse inner <mapping> tags if present
      const mappings: AnimeListEntry['mappings'] = [];
      const mappingRegex = /<mapping\s+([^>]+)>([^<]*)<\/mapping>/gi;
      let mapMatch: RegExpExecArray | null;

      while ((mapMatch = mappingRegex.exec(body)) !== null) {
        const mapAttrs = mapMatch[1]!;
        const mapBody = mapMatch[2]?.trim();
        const aSeasonStr = getAttr(mapAttrs, 'anidbseason');
        const tSeasonStr = getAttr(mapAttrs, 'tvdbseason');

        if (aSeasonStr && tSeasonStr) {
          mappings.push({
            anidbSeason: parseInt(aSeasonStr, 10),
            tvdbSeason: parseInt(tSeasonStr, 10),
            range: mapBody,
          });
        }
      }

      const entry: AnimeListEntry = {
        animeId: anidbId,
        seriesKey: tvdbId,
        defaultTvdbSeason,
        episodeOffset,
        mappings,
      };

      index.entriesByAnimeId.set(anidbId, entry);

      let seriesEntries = index.entriesByTvdb.get(tvdbId);
      if (!seriesEntries) {
        seriesEntries = [];
        index.entriesByTvdb.set(tvdbId, seriesEntries);
      }
      seriesEntries.push(entry);
    }

    return index;
  }

  public getEntriesForShow(seriesKey: string): AnimeListEntry[] | null {
    return this.entriesByTvdb.get(seriesKey) ?? null;
  }

  public placeSeason(siblings: AnimeListEntry[], seasonNumber: number): AniDbSeasonSegment[] {
    if (seasonNumber < 1 || siblings.length === 0) {
      return [];
    }

    const segments: AniDbSeasonSegment[] = [];

    for (const entry of siblings) {
      if (entry.defaultTvdbSeason === seasonNumber) {
        // Episode offset: if offset is e.g. 12, then TVDB episode 13 = AniDB episode 1
        const firstEpisodeNumber = entry.episodeOffset + 1;
        segments.push({
          animeId: entry.animeId,
          firstEpisodeNumber,
          episodeCount: 0, // open-ended until next entry or season end
          firstEpisodeInEntry: 1,
          kind: 'regular',
        });
      }
    }

    return orderSegments(segments);
  }

  public placeSpecial(
    siblings: AnimeListEntry[],
    episodeNumber: number,
  ): { animeId: string; episodeNumber: number; kind: 'special' } | null {
    for (const entry of siblings) {
      for (const map of entry.mappings) {
        if (map.tvdbSeason === 0 && map.anidbSeason === 0) {
          // If range is specified, e.g. ;1-4;
          if (map.range) {
            const clean = map.range.replace(/^;|;$/g, '');
            const parts = clean.split('-');
            const start = parseInt(parts[0] ?? '', 10);
            const end = parts.length > 1 ? parseInt(parts[1] ?? '', 10) : start;

            if (Number.isInteger(start) && Number.isInteger(end)) {
              if (episodeNumber >= start && episodeNumber <= end) {
                const epInEntry = episodeNumber - start + 1;
                return {
                  animeId: entry.animeId,
                  episodeNumber: epInEntry,
                  kind: 'special',
                };
              }
            }
          } else {
            return {
              animeId: entry.animeId,
              episodeNumber,
              kind: 'special',
            };
          }
        }
      }
    }
    return null;
  }

  public resolveMovie(
    tmdbId?: string,
    imdbId?: string,
    tvdbId?: string,
  ): { animeId: string; episodeNumber: number } | null {
    if (tmdbId) {
      const match = this.moviesByKey.get(`tmdb:${tmdbId}`);
      if (match) return match;
    }
    if (imdbId) {
      const match = this.moviesByKey.get(`imdb:${imdbId.toLowerCase()}`);
      if (match) return match;
    }
    if (tvdbId) {
      const match = this.moviesByKey.get(`tvdb:${tvdbId}`);
      if (match) return match;
    }
    return null;
  }
}

const getAttr = (attrsStr: string, attrName: string): string | null => {
  const regex = new RegExp(`\\b${attrName}="([^"]*)"`, 'i');
  const match = regex.exec(attrsStr);
  return match ? (match[1] ?? null) : null;
};

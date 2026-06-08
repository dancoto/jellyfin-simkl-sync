import { appConfig } from '../shared/config';
import type { ShokoResponse, ShokoEpisode, ShokoMovie } from './models';

export const fetchAnidb = async (
  shokoEpisodeId: string,
): Promise<ShokoMovie | ShokoEpisode | null> => {
  try {
    const url = `${appConfig.shoko.url}/api/v3/Episode/${shokoEpisodeId}?includeDataFrom=AniDB`;
    const headers = new Headers();
    headers.append('apiKey', appConfig.shoko.token);

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ShokoResponse;

    if (data.IDs.TMDB.Movie.length === 1) {
      return { anidbId: data.AniDB.AnimeID + '' };
    } else {
      return {
        anidbId: data.AniDB.AnimeID + '',
        episodeNumber: data.AniDB.EpisodeNumber,
        isSpecial: data.AniDB.Type === 'Special',
      };
    }
  } catch (error) {
    console.error(`Error fetching AniDB data for episode ${shokoEpisodeId}:`, error);
    return null;
  }
};

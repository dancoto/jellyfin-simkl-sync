import { resolve } from 'path';
import { appConfig } from '../shared/config';

interface SimklAnimeItem {
  added_to_watchlist_at?: string | null;
  last_watched_at?: string | null;
  user_rated_at?: string | null;
  user_rating?: number | null;
  status: string;
  last_watched?: string | null;
  watched_episodes_count?: number | null;
  total_episodes_count?: number | null;
  anime_type?: string | null;
  show?: {
    title: string;
    year?: number;
    ids?: {
      simkl?: number;
      slug?: string;
      mal?: string | number;
      anidb?: string | number;
      anilist?: string | number;
      tmdb?: string | number;
      tvdb?: string | number;
    };
  };
  movie?: {
    title: string;
    year?: number;
    ids?: {
      simkl?: number;
      slug?: string;
      mal?: string | number;
      anidb?: string | number;
      anilist?: string | number;
      tmdb?: string | number;
    };
  };
}

const mapStatus = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'Completed';
    case 'watching':
      return 'Watching';
    case 'plantowatch':
    case 'plan to watch':
      return 'Plan to Watch';
    case 'hold':
    case 'onhold':
    case 'on-hold':
      return 'On-Hold';
    case 'dropped':
      return 'Dropped';
    default:
      return 'Completed';
  }
};

const mapType = (type?: string | null): string => {
  switch (type?.toLowerCase()) {
    case 'tv':
      return 'TV';
    case 'movie':
      return 'Movie';
    case 'ova':
      return 'OVA';
    case 'ona':
      return 'ONA';
    case 'special':
      return 'Special';
    case 'music':
      return 'Music';
    default:
      return 'TV';
  }
};

const formatDate = (isoString?: string | null): string => {
  if (!isoString) return '0000-00-00';
  const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/);
  return match && match[1] ? match[1] : '0000-00-00';
};

const escapeCdata = (str: string): string => {
  return str.replace(/]]>/g, ']]&gt;');
};

export const exportSimklToMalXml = async (
  username?: string,
  outputFilePath = './simkl-anime-mal-export.xml',
): Promise<{ total: number; outputPath: string }> => {
  const targetUser = username || Object.keys(appConfig.simkl.users)[0];
  if (!targetUser) {
    throw new Error('No users configured in config.simkl.users');
  }

  const userTokenEntry = appConfig.simkl.users[targetUser];
  if (!userTokenEntry) {
    throw new Error(`User "${targetUser}" not found in config.simkl.users`);
  }

  const token = typeof userTokenEntry === 'string' ? userTokenEntry : userTokenEntry.token;
  const clientId = appConfig.simkl.client_id;
  const appName = appConfig.simkl.app_name || 'jellyfin-tracker-sync';

  console.log(`[Simkl Export] Fetching anime library from Simkl...`);

  const url = new URL('https://api.simkl.com/sync/all-items/anime');
  url.searchParams.set('extended', 'full');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'simkl-api-key': clientId,
      'User-Agent': `${appName}/2.0`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch from Simkl API (HTTP ${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = (await response.json()) as { anime?: SimklAnimeItem[] };
  const items = data.anime || [];
  console.log(`[Simkl Export] Retrieved ${items.length} anime entries.`);

  const statusCounts = {
    watching: 0,
    completed: 0,
    onhold: 0,
    dropped: 0,
    plantowatch: 0,
  };

  const animeNodes: string[] = [];

  for (const item of items) {
    const media = item.show || item.movie;
    if (!media) continue;

    const malId = media.ids?.mal ? String(media.ids.mal) : undefined;
    if (!malId) {
      console.warn(`[Simkl Export] Skipping "${media.title}": No MyAnimeList ID found.`);
      continue;
    }

    const title = escapeCdata(media.title);
    const seriesType = mapType(item.anime_type);
    const seriesEpisodes = item.total_episodes_count || 0;
    const watchedEpisodes = item.watched_episodes_count || 0;
    const score = item.user_rating || 0;
    const status = mapStatus(item.status);

    // Track counts for <myinfo>
    switch (status) {
      case 'Watching':
        statusCounts.watching++;
        break;
      case 'Completed':
        statusCounts.completed++;
        break;
      case 'On-Hold':
        statusCounts.onhold++;
        break;
      case 'Dropped':
        statusCounts.dropped++;
        break;
      case 'Plan to Watch':
        statusCounts.plantowatch++;
        break;
    }

    let startDate = formatDate(item.added_to_watchlist_at);
    let finishDate = formatDate(item.last_watched_at);

    // Sanity-check date logic
    if (status === 'Completed') {
      if (finishDate === '0000-00-00' && startDate !== '0000-00-00') {
        finishDate = startDate;
      }
      if (startDate !== '0000-00-00' && finishDate !== '0000-00-00' && startDate > finishDate) {
        // If added to watchlist after watched, clear start date to prevent validation error
        startDate = '0000-00-00';
      }
    } else {
      finishDate = '0000-00-00';
    }

    animeNodes.push(`	<anime>
		<series_animedb_id>${malId}</series_animedb_id>
		<series_title><![CDATA[${title}]]></series_title>
		<series_type>${seriesType}</series_type>
		<series_episodes>${seriesEpisodes}</series_episodes>
		<my_id>0</my_id>
		<my_watched_episodes>${watchedEpisodes}</my_watched_episodes>
		<my_start_date>${startDate}</my_start_date>
		<my_finish_date>${finishDate}</my_finish_date>
		<my_rated></my_rated>
		<my_score>${score}</my_score>
		<my_dvd></my_dvd>
		<my_storage></my_storage>
		<my_status>${status}</my_status>
		<my_comments><![CDATA[]]></my_comments>
		<my_times_watched>0</my_times_watched>
		<my_rewatch_value></my_rewatch_value>
		<my_priority>LOW</my_priority>
		<my_tags><![CDATA[]]></my_tags>
		<my_discuss>1</my_discuss>
		<my_sns>default</my_sns>
		<update_on_import>1</update_on_import>
	</anime>`);
  }

  const xmlContent = `<?xml version="1.0" encoding="UTF-8" ?>
<!--
Created by Simkl-to-MAL Exporter for AniList Import
-->
<myanimelist>
	<myinfo>
		<user_id>0</user_id>
		<user_name>redacted</user_name>
		<user_export_type>1</user_export_type>
		<user_total_anime>${animeNodes.length}</user_total_anime>
		<user_total_watching>${statusCounts.watching}</user_total_watching>
		<user_total_completed>${statusCounts.completed}</user_total_completed>
		<user_total_onhold>${statusCounts.onhold}</user_total_onhold>
		<user_total_dropped>${statusCounts.dropped}</user_total_dropped>
		<user_total_plantowatch>${statusCounts.plantowatch}</user_total_plantowatch>
	</myinfo>

${animeNodes.join('\n\n')}
</myanimelist>
`;

  const absPath = resolve(outputFilePath);
  await Bun.write(absPath, xmlContent);
  console.log(`[Simkl Export] Successfully wrote ${animeNodes.length} anime entries to ${absPath}`);

  return { total: animeNodes.length, outputPath: absPath };
};

// Allow direct execution from CLI: `bun scripts/export-simkl-mal-xml.ts [username] [outputPath]`
if (import.meta.main) {
  const targetUser = process.argv[2];
  const targetOutput = process.argv[3] || './simkl-anime-mal-export.xml';

  exportSimklToMalXml(targetUser, targetOutput)
    .then(({ total, outputPath }) => {
      console.log(`\nExport complete! ${total} entries written to:`);
      console.log(`-> ${outputPath}`);
      console.log('\nYou can now import this file into AniList:');
      console.log('-> https://anilist.co/settings/import (choose MyAnimeList XML)');
    })
    .catch((err) => {
      console.error('[Simkl Export] Error:', err);
      process.exit(1);
    });
}

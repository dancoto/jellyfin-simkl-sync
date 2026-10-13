import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { defaultAnimeResolver } from '../anime';
import {
  TvdbOverridesIndex,
  type RawShowOverride,
  type RawTvdbOverrides,
} from '../anime/tvdb-overrides';
import { renderOverridesHtml } from './page';

export const handleOverridesPage = (): Response => {
  const html = renderOverridesHtml();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

export const handleGetOverrides = (): Response => {
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

  return Response.json({
    filePath,
    overrides,
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
      currentOverrides = body.overrides;
    } else if (body.tvdbId && body.show) {
      currentOverrides[body.tvdbId] = body.show;
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

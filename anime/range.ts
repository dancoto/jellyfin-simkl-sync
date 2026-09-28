import type { AniBridgeRange } from './models';

const MAX_WALKED_EPISODES = 2000;

export const rangeLength = (range: AniBridgeRange): number | null => {
  return range.end !== null ? Math.max(range.end - range.start + 1, 0) : null;
};

export const readRange = (value?: string | null): AniBridgeRange | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(',') || trimmed.includes('|')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('-');
  if (separatorIndex < 0) {
    const only = parseInt(trimmed, 10);
    return Number.isInteger(only) ? { start: only, end: only } : null;
  }

  const startStr = trimmed.slice(0, separatorIndex);
  const start = parseInt(startStr, 10);
  if (!Number.isInteger(start)) {
    return null;
  }

  const rest = trimmed.slice(separatorIndex + 1);
  if (rest.length === 0) {
    return { start, end: null };
  }

  const end = parseInt(rest, 10);
  return Number.isInteger(end) ? { start, end } : null;
};

export const readAllRanges = (value?: string | null): AniBridgeRange[] | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.includes(',')) {
    const single = readRange(trimmed);
    return single ? [single] : null;
  }

  const ranges: AniBridgeRange[] = [];
  const parts = trimmed.split(',');

  for (const part of parts) {
    const range = readRange(part);
    if (!range) return null;

    // Only the last range can be open-ended
    if (ranges.length > 0 && ranges[ranges.length - 1]?.end === null) {
      return null;
    }
    ranges.push(range);
  }

  return ranges.length > 0 ? ranges : null;
};

export const readTarget = (
  value?: string | null,
): { ranges: AniBridgeRange[]; ratio: number } | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const separatorIndex = trimmed.indexOf('|');
  if (separatorIndex < 0) {
    const ranges = readAllRanges(trimmed);
    return ranges ? { ranges, ratio: 1 } : null;
  }

  const ratioStr = trimmed.slice(separatorIndex + 1).trim();
  const ratio = parseInt(ratioStr, 10);
  if (!Number.isInteger(ratio) || ratio === 0) {
    return null;
  }

  const rangesStr = trimmed.slice(0, separatorIndex);
  const ranges = readAllRanges(rangesStr);
  return ranges ? { ranges, ratio } : null;
};

export const walkRange = (ranges: AniBridgeRange[]): number[] => {
  const episodes: number[] = [];

  for (const range of ranges) {
    const last = range.end ?? Number.MAX_SAFE_INTEGER;
    for (let ep = range.start; ep <= last && episodes.length < MAX_WALKED_EPISODES; ep++) {
      episodes.push(ep);
    }
  }

  return episodes;
};

export const pair = (
  inEntry: AniBridgeRange[],
  inSeason: AniBridgeRange[],
  ratio = 1,
): Array<[AniBridgeRange, AniBridgeRange]> => {
  if (ratio === 1 || ratio === -1) {
    return pairEvenly(inEntry, inSeason);
  }
  return pairByRatio(inEntry, inSeason, ratio);
};

const pairEvenly = (
  inEntry: AniBridgeRange[],
  inSeason: AniBridgeRange[],
): Array<[AniBridgeRange, AniBridgeRange]> => {
  if (inEntry.length === 1 && inSeason.length === 1) {
    return [[inEntry[0]!, inSeason[0]!]];
  }

  const result: Array<[AniBridgeRange, AniBridgeRange]> = [];
  let entryIndex = 0;
  let seasonIndex = 0;
  let takenFromEntry = 0;
  let takenFromSeason = 0;

  while (entryIndex < inEntry.length && seasonIndex < inSeason.length) {
    const entryRun = inEntry[entryIndex]!;
    const seasonRun = inSeason[seasonIndex]!;

    const entryLen = rangeLength(entryRun);
    const seasonLen = rangeLength(seasonRun);

    const leftInEntry = entryLen !== null ? entryLen - takenFromEntry : null;
    const leftInSeason = seasonLen !== null ? seasonLen - takenFromSeason : null;

    if (leftInEntry === 0) {
      entryIndex++;
      takenFromEntry = 0;
      continue;
    }

    if (leftInSeason === 0) {
      seasonIndex++;
      takenFromSeason = 0;
      continue;
    }

    const entryStart = entryRun.start + takenFromEntry;
    const seasonStart = seasonRun.start + takenFromSeason;

    if (leftInEntry === null && leftInSeason === null) {
      result.push([
        { start: entryStart, end: null },
        { start: seasonStart, end: null },
      ]);
      break;
    }

    const take = Math.min(
      leftInEntry ?? Number.MAX_SAFE_INTEGER,
      leftInSeason ?? Number.MAX_SAFE_INTEGER,
    );

    result.push([
      { start: entryStart, end: entryStart + take - 1 },
      { start: seasonStart, end: seasonStart + take - 1 },
    ]);

    takenFromEntry += take;
    takenFromSeason += take;

    if (leftInEntry === take) {
      entryIndex++;
      takenFromEntry = 0;
    }

    if (leftInSeason === take) {
      seasonIndex++;
      takenFromSeason = 0;
    }
  }

  return result;
};

const pairByRatio = (
  inEntry: AniBridgeRange[],
  inSeason: AniBridgeRange[],
  ratio: number,
): Array<[AniBridgeRange, AniBridgeRange]> => {
  const entryEpisodes = walkRange(inEntry);
  const seasonEpisodes = walkRange(inSeason);
  const result: Array<[AniBridgeRange, AniBridgeRange]> = [];

  for (let index = 0; index < seasonEpisodes.length; index++) {
    const inEntryIndex = ratio > 0 ? Math.floor(index / ratio) : index * -ratio;

    if (inEntryIndex >= entryEpisodes.length) {
      break;
    }

    const entryEp = entryEpisodes[inEntryIndex]!;
    const seasonEp = seasonEpisodes[index]!;

    result.push([
      { start: entryEp, end: entryEp },
      { start: seasonEp, end: seasonEp },
    ]);
  }

  return result;
};

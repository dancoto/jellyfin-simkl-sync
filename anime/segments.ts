import type { AniDbSeasonSegment, EpisodeKind } from './models';

const MAX_EPISODES_PER_SEASON = 2000;

export const orderSegments = (claims: AniDbSeasonSegment[]): AniDbSeasonSegment[] => {
  if (claims.length === 0) {
    return [];
  }

  const segments = [...claims].sort((a, b) => {
    if (a.firstEpisodeNumber !== b.firstEpisodeNumber) {
      return a.firstEpisodeNumber - b.firstEpisodeNumber;
    }
    return (a.episodeCount === 0 ? 1 : 0) - (b.episodeCount === 0 ? 1 : 0);
  });

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]!;
    const next = segments[i + 1]!;
    const room = next.firstEpisodeNumber - current.firstEpisodeNumber;

    if (current.episodeCount === 0 && room > 0) {
      segments[i] = { ...current, episodeCount: room };
    }
  }

  return segments;
};

export const resolveSeasonSegments = (
  claimsByKind: Map<EpisodeKind, AniDbSeasonSegment[]>,
): AniDbSeasonSegment[] => {
  if (claimsByKind.size === 0) {
    return [];
  }

  if (claimsByKind.size === 1) {
    const only = Array.from(claimsByKind.values())[0]!;
    return orderSegments(only);
  }

  return orderSegments(mergeSegments(claimsByKind));
};

const getCoverage = (segments: AniDbSeasonSegment[]): number => {
  let covered = 0;
  for (const seg of segments) {
    if (seg.episodeCount <= 0) {
      return Number.MAX_SAFE_INTEGER;
    }
    covered += seg.episodeCount;
  }
  return covered;
};

const mergeSegments = (
  claimsByKind: Map<EpisodeKind, AniDbSeasonSegment[]>,
): AniDbSeasonSegment[] => {
  const ordered = Array.from(claimsByKind.entries()).sort(([kindA, segsA], [kindB, segsB]) => {
    const covA = getCoverage(segsA);
    const covB = getCoverage(segsB);
    if (covA !== covB) return covB - covA;

    const distinctA = new Set(segsA.map((s) => s.firstEpisodeInEntry)).size;
    const distinctB = new Set(segsB.map((s) => s.firstEpisodeInEntry)).size;
    if (distinctA !== distinctB) return distinctB - distinctA;

    return (kindA === 'regular' ? 0 : 1) - (kindB === 'regular' ? 0 : 1);
  });

  const hasOpenEndedOrHuge = ordered.some(([, segs]) =>
    segs.some((s) => s.episodeCount <= 0 || s.episodeCount > MAX_EPISODES_PER_SEASON),
  );

  if (hasOpenEndedOrHuge) {
    return ordered[0]![1];
  }

  const placed = new Map<number, AniDbSeasonSegment>();

  for (const [, segments] of ordered) {
    for (const segment of segments) {
      const count = getSegmentCount(segment);
      for (let offset = 0; offset < count; offset++) {
        const episode = segment.firstEpisodeNumber + offset;
        if (!placed.has(episode)) {
          placed.set(episode, {
            animeId: segment.animeId,
            firstEpisodeNumber: episode,
            episodeCount: 1,
            firstEpisodeInEntry: segment.firstEpisodeInEntry + offset,
            kind: segment.kind,
          });
        }
      }
    }
  }

  const sortedEpisodes = Array.from(placed.keys()).sort((a, b) => a - b);
  const merged: AniDbSeasonSegment[] = [];

  for (const ep of sortedEpisodes) {
    const one = placed.get(ep)!;
    const last = merged[merged.length - 1];

    if (
      last &&
      last.animeId === one.animeId &&
      last.kind === one.kind &&
      last.firstEpisodeNumber + last.episodeCount === one.firstEpisodeNumber &&
      last.firstEpisodeInEntry + last.episodeCount === one.firstEpisodeInEntry
    ) {
      last.episodeCount += 1;
    } else {
      merged.push({ ...one });
    }
  }

  return merged;
};

const getSegmentCount = (seg: AniDbSeasonSegment): number => {
  return seg.episodeCount > 0 ? seg.episodeCount : 0;
};

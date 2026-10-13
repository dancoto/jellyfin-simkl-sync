import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { appConfig } from '../shared/config';
import {
  clearSeriesSyncQueue,
  enqueueSeriesSync,
  flushAllPendingSeriesSync,
  getPendingSeriesSyncCount,
  getPendingSeriesSyncKeys,
  getSeriesSyncKey,
  resetSeriesSyncRunner,
  setSeriesSyncRunner,
} from './series-debouncer';

describe('Series Debouncer', () => {
  let originalConfig: any;
  let syncSeriesMock: any;

  beforeEach(() => {
    clearSeriesSyncQueue();
    originalConfig = JSON.parse(JSON.stringify(appConfig));
    appConfig.jellyfin = {
      url: 'http://mock-jf:8096',
      token: 'mock-token',
      continuous_sync: {
        enabled: true,
        debounce_ms: 50,
      },
    };

    syncSeriesMock = mock(async (tvdbId: string, _options?: any) => {
      return {
        tvdbId,
        title: `Mock Show ${tvdbId}`,
        deleted: false,
        totalEpisodes: 12,
        prunedOverridesCount: 0,
      };
    });
    setSeriesSyncRunner(syncSeriesMock);
  });

  afterEach(() => {
    clearSeriesSyncQueue();
    resetSeriesSyncRunner();
    // @ts-ignore
    appConfig.jellyfin = originalConfig.jellyfin;
  });

  test('getSeriesSyncKey should correctly prioritize TVDB ID over Jellyfin ID', () => {
    expect(getSeriesSyncKey('82310', 'jf-guid-1')).toBe('tvdb:82310');
    expect(getSeriesSyncKey(undefined, 'jf-guid-1')).toBe('jf:jf-guid-1');
    expect(getSeriesSyncKey(undefined, undefined)).toBeNull();
  });

  test('enqueueSeriesSync should debounce multiple episode additions for the same series', async () => {
    // Simulate 3 episodes added in rapid succession with a 60ms debounce
    enqueueSeriesSync({
      tvdbId: '82310',
      jellyfinSeriesId: 'series-guid-1',
      seriesName: 'Princess Lover!',
      itemType: 'Episode',
      debounceMs: 60,
    });
    enqueueSeriesSync({
      tvdbId: '82310',
      jellyfinSeriesId: 'series-guid-1',
      seriesName: 'Princess Lover!',
      itemType: 'Episode',
      debounceMs: 60,
    });
    enqueueSeriesSync({
      tvdbId: '82310',
      jellyfinSeriesId: 'series-guid-1',
      seriesName: 'Princess Lover!',
      itemType: 'Episode',
      debounceMs: 60,
    });

    expect(getPendingSeriesSyncCount()).toBe(1);
    expect(getPendingSeriesSyncKeys()).toEqual(['tvdb:82310']);
    expect(syncSeriesMock).not.toHaveBeenCalled();

    // Wait for the debounce timer to elapse
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(getPendingSeriesSyncCount()).toBe(0);
    expect(syncSeriesMock).toHaveBeenCalledTimes(1);
    expect(syncSeriesMock.mock.calls[0][0]).toBe('82310');
    expect(syncSeriesMock.mock.calls[0][1]?.jellyfinSeriesId).toBe('series-guid-1');
  });

  test('enqueueSeriesSync should merge Jellyfin ID entry into TVDB ID entry when TVDB ID is discovered', async () => {
    // First event only had Jellyfin ID
    enqueueSeriesSync({
      jellyfinSeriesId: 'jf-series-xyz',
      seriesName: 'New Show',
      debounceMs: 100,
    });
    expect(getPendingSeriesSyncKeys()).toEqual(['jf:jf-series-xyz']);

    // Second event resolves the TVDB ID for that Jellyfin ID
    enqueueSeriesSync({
      tvdbId: '998877',
      jellyfinSeriesId: 'jf-series-xyz',
      seriesName: 'New Show',
      debounceMs: 100,
    });
    expect(getPendingSeriesSyncKeys()).toEqual(['tvdb:998877']);

    await flushAllPendingSeriesSync();
    expect(syncSeriesMock).toHaveBeenCalledTimes(1);
    expect(syncSeriesMock.mock.calls[0][0]).toBe('998877');
  });

  test('enqueueSeriesSync should not queue when continuous_sync.enabled is false', () => {
    appConfig.jellyfin!.continuous_sync = { enabled: false };

    enqueueSeriesSync({
      tvdbId: '82310',
      seriesName: 'Disabled Show',
      debounceMs: 10,
    });

    expect(getPendingSeriesSyncCount()).toBe(0);
    expect(syncSeriesMock).not.toHaveBeenCalled();
  });

  test('flushAllPendingSeriesSync should immediately process all debounced series', async () => {
    enqueueSeriesSync({
      tvdbId: '111',
      seriesName: 'Show 1',
      debounceMs: 5000,
    });
    enqueueSeriesSync({
      tvdbId: '222',
      seriesName: 'Show 2',
      debounceMs: 5000,
    });

    expect(getPendingSeriesSyncCount()).toBe(2);

    await flushAllPendingSeriesSync();

    expect(getPendingSeriesSyncCount()).toBe(0);
    expect(syncSeriesMock).toHaveBeenCalledTimes(2);
  });

  test('clearSeriesSyncQueue should cancel timers and clear pending items without running sync', () => {
    enqueueSeriesSync({
      tvdbId: '333',
      seriesName: 'Show 3',
      debounceMs: 5000,
    });
    expect(getPendingSeriesSyncCount()).toBe(1);

    clearSeriesSyncQueue();

    expect(getPendingSeriesSyncCount()).toBe(0);
    expect(syncSeriesMock).not.toHaveBeenCalled();
  });
});

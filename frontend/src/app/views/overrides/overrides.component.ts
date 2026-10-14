import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import {
  CatalogShow,
  OfficialMappingsMap,
  OverridesSummary,
  RawEpisodeOverride,
  RawTvdbOverrides,
} from '../../models/types';
import { StatsBannerComponent } from '../../components/stats-banner/stats-banner.component';
import { ControlsBarComponent } from '../../components/controls-bar/controls-bar.component';
import { PaginationComponent } from '../../components/pagination/pagination.component';
import { SeriesCardComponent } from '../../components/series-card/series-card.component';
import { BulkImportModalComponent } from '../../components/modals/bulk-import-modal/bulk-import-modal.component';
import { RetireRedundantModalComponent } from '../../components/modals/retire-redundant-modal/retire-redundant-modal.component';

@Component({
  selector: 'app-overrides-view',
  imports: [
    StatsBannerComponent,
    ControlsBarComponent,
    PaginationComponent,
    SeriesCardComponent,
    BulkImportModalComponent,
    RetireRedundantModalComponent,
  ],
  templateUrl: './overrides.component.html',
  styleUrl: './overrides.component.css',
})
export class OverridesComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  catalogData = signal<Record<string, CatalogShow>>({});
  overridesData = signal<RawTvdbOverrides>({});
  officialData = signal<OfficialMappingsMap>({});
  dirtyShows = signal<Set<string>>(new Set());
  openCards = signal<Set<string>>(new Set());
  syncingSeriesIds = signal<Set<string>>(new Set());

  allExpanded = signal(false);
  currentFilter = signal('all');
  currentSort = signal('missing-desc');
  searchQuery = signal('');
  currentPage = signal(1);
  pageSize = signal(50);

  isLoading = signal(true);
  isSyncingLibrary = signal(false);
  isRetiring = signal(false);
  isSaving = signal(false);

  isBulkImportOpen = signal(false);
  isRetireOpen = signal(false);

  toast = signal<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  ngOnInit() {
    this.loadData();
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ visible: true, message, type });
    this.toastTimer = setTimeout(() => {
      this.toast.update(t => ({ ...t, visible: false }));
    }, 4000);
  }

  getOfficialEp(tvdbId: string, seasonNum: string, epNum: string) {
    return this.officialData()[tvdbId]?.[seasonNum]?.[epNum] ?? null;
  }

  getOverrideEp(tvdbId: string, seasonNum: string, epNum: string): RawEpisodeOverride | undefined {
    return this.overridesData()[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
  }

  isEpSkipped(tvdbId: string, seasonNum: string, epNum: string): boolean {
    return Boolean(this.getOverrideEp(tvdbId, seasonNum, epNum)?.skipAniList);
  }

  isEpMissingAniList(tvdbId: string, seasonNum: string, epNum: string): boolean {
    const ovr = this.getOverrideEp(tvdbId, seasonNum, epNum);
    if (ovr?.skipAniList) return false;
    if (typeof ovr?.anilistId === 'number') return false;
    if (ovr?.anilistId === null) return true;
    return !this.getOfficialEp(tvdbId, seasonNum, epNum);
  }

  isEpOverridden(tvdbId: string, seasonNum: string, epNum: string): boolean {
    const ovr = this.getOverrideEp(tvdbId, seasonNum, epNum);
    if (ovr?.skipAniList) return false;
    if (typeof ovr?.anilistId === 'number') {
      const off = this.getOfficialEp(tvdbId, seasonNum, epNum);
      return !off || off.anilistId !== ovr.anilistId || off.anilistEpisode !== ovr.anilistEpisode;
    }
    return false;
  }

  countMissingAniListInShow(tvdbId: string, show: CatalogShow): number {
    let count = 0;
    for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
      for (const [epNum] of Object.entries(season.episodes || {})) {
        if (this.isEpMissingAniList(tvdbId, seasonNum, epNum)) count++;
      }
    }
    return count;
  }

  countOverriddenInShow(tvdbId: string, show: CatalogShow): number {
    let count = 0;
    for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
      for (const [epNum] of Object.entries(season.episodes || {})) {
        if (this.isEpOverridden(tvdbId, seasonNum, epNum)) count++;
      }
    }
    return count;
  }

  countSkippedAniListInShow(tvdbId: string, show: CatalogShow): number {
    let count = 0;
    for (const [seasonNum, season] of Object.entries(show.seasons || {})) {
      for (const [epNum] of Object.entries(season.episodes || {})) {
        if (this.isEpSkipped(tvdbId, seasonNum, epNum)) count++;
      }
    }
    return count;
  }

  ensureEpisodeInOverrides(tvdbId: string, seasonNum: string, epNum: string): RawEpisodeOverride {
    const all = { ...this.overridesData() };
    if (!all[tvdbId]) {
      const catShow = this.catalogData()[tvdbId] || ({} as any);
      all[tvdbId] = {
        title: catShow.title,
        tmdbId: catShow.tmdbId,
        seasons: {},
      };
    }
    if (!all[tvdbId].seasons) {
      all[tvdbId].seasons = {};
    }
    if (!all[tvdbId].seasons![seasonNum]) {
      all[tvdbId].seasons![seasonNum] = { episodes: {} };
    }
    if (!all[tvdbId].seasons![seasonNum].episodes) {
      all[tvdbId].seasons![seasonNum].episodes = {};
    }
    if (!all[tvdbId].seasons![seasonNum].episodes![epNum]) {
      const catEp = this.catalogData()[tvdbId]?.seasons?.[seasonNum]?.episodes?.[epNum];
      all[tvdbId].seasons![seasonNum].episodes![epNum] = {
        name: catEp?.name,
      };
    }
    this.overridesData.set(all);
    return all[tvdbId].seasons![seasonNum].episodes![epNum];
  }

  markDirty(tvdbId: string) {
    this.dirtyShows.update(s => new Set(s).add(tvdbId));
  }

  statsSummary = computed<OverridesSummary>(() => {
    let totalShows = 0;
    let totalEpisodes = 0;
    let unmappedEpisodes = 0;
    let showsWithOverrides = 0;
    let skippedEpisodes = 0;
    let mappedEpisodes = 0;

    const catalog = this.catalogData();
    for (const [tvdbId, show] of Object.entries(catalog)) {
      totalShows++;
      let showHasOverride = false;

      for (const [sKey, season] of Object.entries(show.seasons || {})) {
        for (const [eKey] of Object.entries(season.episodes || {})) {
          totalEpisodes++;
          if (this.isEpSkipped(tvdbId, sKey, eKey)) {
            skippedEpisodes++;
          } else if (this.isEpMissingAniList(tvdbId, sKey, eKey)) {
            unmappedEpisodes++;
          } else {
            mappedEpisodes++;
          }

          if (this.isEpOverridden(tvdbId, sKey, eKey)) {
            showHasOverride = true;
          }
        }
      }

      if (showHasOverride) showsWithOverrides++;
    }

    return {
      totalShows,
      totalEpisodes,
      mappedEpisodes,
      showsWithOverrides,
      unmappedEpisodes,
      skippedEpisodes,
    };
  });

  filterCounts = computed(() => {
    let all = 0;
    let unmapped = 0;
    let overrides = 0;
    let skipped = 0;
    let complete = 0;

    const catalog = this.catalogData();
    for (const [id, show] of Object.entries(catalog)) {
      all++;
      const missingCount = this.countMissingAniListInShow(id, show);
      if (missingCount > 0) unmapped++;
      else complete++;

      if (this.countOverriddenInShow(id, show) > 0) overrides++;
      if (this.countSkippedAniListInShow(id, show) > 0) skipped++;
    }

    return { all, unmapped, overrides, skipped, complete };
  });

  filteredShows = computed<[string, CatalogShow][]>(() => {
    const entries = Object.entries(this.catalogData());
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.currentFilter();

    const filtered = entries.filter(([tvdbId, show]) => {
      const titleMatch =
        !q ||
        (show.title || '').toLowerCase().includes(q) ||
        tvdbId.includes(q);
      if (!titleMatch) return false;

      if (filter === 'unmapped' || filter === 'missing-anilist') {
        return this.countMissingAniListInShow(tvdbId, show) > 0;
      }
      if (filter === 'overrides' || filter === 'overridden') {
        return this.countOverriddenInShow(tvdbId, show) > 0;
      }
      if (filter === 'skipped' || filter === 'skipped-anilist') {
        return this.countSkippedAniListInShow(tvdbId, show) > 0;
      }
      if (filter === 'mapped' || filter === 'complete') {
        return this.countMissingAniListInShow(tvdbId, show) === 0;
      }
      return true;
    });

    const sort = this.currentSort();
    filtered.sort(([idA, showA], [idB, showB]) => {
      if (sort === 'missing-desc') {
        const diff = this.countMissingAniListInShow(idB, showB) - this.countMissingAniListInShow(idA, showA);
        if (diff !== 0) return diff;
        return (showA.title || '').localeCompare(showB.title || '');
      }
      if (sort === 'overridden-desc') {
        const diff = this.countOverriddenInShow(idB, showB) - this.countOverriddenInShow(idA, showA);
        if (diff !== 0) return diff;
        return (showA.title || '').localeCompare(showB.title || '');
      }
      if (sort === 'missing-asc') {
        const diff = this.countMissingAniListInShow(idA, showA) - this.countMissingAniListInShow(idB, showB);
        if (diff !== 0) return diff;
        return (showA.title || '').localeCompare(showB.title || '');
      }
      if (sort === 'title-asc') {
        return (showA.title || '').localeCompare(showB.title || '');
      }
      return idA.localeCompare(idB);
    });

    return filtered;
  });

  paginatedShows = computed<[string, CatalogShow][]>(() => {
    if (this.pageSize() >= 99999) return this.filteredShows();
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredShows().slice(start, start + this.pageSize());
  });

  loadData() {
    this.isLoading.set(true);
    this.api
      .getOverrides()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.catalogData.set(res.catalog || {});
          this.overridesData.set(res.overrides || {});
          this.officialData.set(res.official || {});
          this.dirtyShows.set(new Set());
          this.isLoading.set(false);
        },
        error: err => {
          this.showToast('Failed to load overrides: ' + (err.message || String(err)), 'error');
          this.isLoading.set(false);
        },
      });
  }

  toggleCard(tvdbId: string) {
    this.openCards.update(set => {
      const next = new Set(set);
      if (next.has(tvdbId)) {
        next.delete(tvdbId);
      } else {
        next.add(tvdbId);
      }
      return next;
    });
  }

  toggleAllCards() {
    this.allExpanded.update(v => !v);
    if (!this.allExpanded()) {
      this.openCards.set(new Set());
    }
  }

  isCardOpen(tvdbId: string): boolean {
    return this.allExpanded() || this.openCards().has(tvdbId);
  }

  handleUpdateEpisode(
    tvdbId: string,
    payload: { seasonNum: string; epNum: string; field: 'anilistId' | 'anilistEpisode'; value: string }
  ) {
    const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, payload.epNum);
    const overrides = { ...this.overridesData() };

    if (payload.field === 'anilistId') {
      const trimmed = payload.value.trim();
      if (trimmed === '') {
        delete ep.anilistId;
        if (!ep.skipAniList && ep.anilistEpisode === undefined) {
          delete overrides[tvdbId]?.seasons?.[payload.seasonNum]?.episodes?.[payload.epNum];
        }
      } else if (trimmed.toLowerCase() === 'null') {
        ep.anilistId = null;
        delete ep.skipAniList;
      } else {
        const parsed = parseInt(trimmed, 10);
        ep.anilistId = Number.isInteger(parsed) ? parsed : null;
        delete ep.skipAniList;
      }
    } else if (payload.field === 'anilistEpisode') {
      const parsed = parseInt(payload.value, 10);
      ep.anilistEpisode = Number.isInteger(parsed) ? parsed : null;
    }

    this.overridesData.set(overrides);
    this.markDirty(tvdbId);
  }

  handleUseOfficialEpisode(tvdbId: string, payload: { seasonNum: string; epNum: string }) {
    const off = this.getOfficialEp(tvdbId, payload.seasonNum, payload.epNum);
    if (!off) {
      this.showToast('No official mapping available for this episode', 'error');
      return;
    }

    const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, payload.epNum);
    ep.anilistId = off.anilistId;
    ep.anilistEpisode = off.anilistEpisode;
    delete ep.skipAniList;

    this.overridesData.set({ ...this.overridesData() });
    this.markDirty(tvdbId);
    this.showToast(`Applied official AniList ${off.anilistId} (Ep ${off.anilistEpisode})`, 'success');
  }

  handleToggleSkipEpisode(tvdbId: string, payload: { seasonNum: string; epNum: string }) {
    const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, payload.epNum);
    ep.skipAniList = !ep.skipAniList;
    const overrides = { ...this.overridesData() };
    if (!ep.skipAniList) {
      delete ep.skipAniList;
      if (ep.anilistId === undefined) {
        delete overrides[tvdbId]?.seasons?.[payload.seasonNum]?.episodes?.[payload.epNum];
      }
    }

    this.overridesData.set(overrides);
    this.markDirty(tvdbId);
  }

  handleClearOverrideEpisode(tvdbId: string, payload: { seasonNum: string; epNum: string }) {
    const overrides = { ...this.overridesData() };
    const show = overrides[tvdbId];
    if (show?.seasons?.[payload.seasonNum]?.episodes?.[payload.epNum]) {
      delete show.seasons[payload.seasonNum].episodes![payload.epNum];
      if (Object.keys(show.seasons[payload.seasonNum].episodes || {}).length === 0) {
        delete show.seasons[payload.seasonNum];
      }
      if (Object.keys(show.seasons || {}).length === 0) {
        delete overrides[tvdbId];
      }
    }

    this.overridesData.set(overrides);
    this.markDirty(tvdbId);
    this.showToast('Override cleared (reverted to official mapping)', 'success');
  }

  handleApplyBatchSeason(tvdbId: string, payload: { seasonNum: string; anilistId: number }) {
    const season = this.catalogData()[tvdbId]?.seasons?.[payload.seasonNum];
    if (!season || !season.episodes) return;

    for (const [epNum] of Object.entries(season.episodes)) {
      const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, epNum);
      ep.anilistId = payload.anilistId;
      delete ep.skipAniList;
    }

    this.overridesData.set({ ...this.overridesData() });
    this.markDirty(tvdbId);
    this.showToast(`Applied AniList ID ${payload.anilistId} to Season ${payload.seasonNum}`, 'success');
  }

  handleApplyOfficialSeason(tvdbId: string, payload: { seasonNum: string }) {
    const season = this.catalogData()[tvdbId]?.seasons?.[payload.seasonNum];
    if (!season || !season.episodes) return;

    let applied = 0;
    for (const [epNum] of Object.entries(season.episodes)) {
      const off = this.getOfficialEp(tvdbId, payload.seasonNum, epNum);
      if (off) {
        const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, epNum);
        ep.anilistId = off.anilistId;
        ep.anilistEpisode = off.anilistEpisode;
        delete ep.skipAniList;
        applied++;
      }
    }

    if (applied > 0) {
      this.overridesData.set({ ...this.overridesData() });
      this.markDirty(tvdbId);
      this.showToast(`Applied official AniList mappings to ${applied} episode(s)`, 'success');
    } else {
      this.showToast('No official mappings available for this season', 'error');
    }
  }

  handleSkipUnmappedSeason(tvdbId: string, payload: { seasonNum: string }) {
    const season = this.catalogData()[tvdbId]?.seasons?.[payload.seasonNum];
    if (!season || !season.episodes) return;

    let changed = 0;
    for (const [epNum] of Object.entries(season.episodes)) {
      if (!this.isEpSkipped(tvdbId, payload.seasonNum, epNum) && this.isEpMissingAniList(tvdbId, payload.seasonNum, epNum)) {
        const ep = this.ensureEpisodeInOverrides(tvdbId, payload.seasonNum, epNum);
        ep.skipAniList = true;
        changed++;
      }
    }

    if (changed > 0) {
      this.overridesData.set({ ...this.overridesData() });
      this.markDirty(tvdbId);
      this.showToast(`Marked ${changed} unmapped episode(s) as skipped for AniList`, 'success');
    } else {
      this.showToast('No unmapped episodes to skip in this season', 'error');
    }
  }

  handleSaveShow(tvdbId: string) {
    const show = this.overridesData()[tvdbId] || { title: '', seasons: {} };
    this.api
      .saveShow(tvdbId, show)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dirtyShows.update(s => {
            const next = new Set(s);
            next.delete(tvdbId);
            return next;
          });
          const catShow = this.catalogData()[tvdbId];
          this.showToast(`Saved "${catShow?.title || show.title || tvdbId}"`, 'success');
        },
        error: err => {
          this.showToast(`Error saving show: ${err.message}`, 'error');
        },
      });
  }

  handleSaveAllChanges() {
    this.isSaving.set(true);
    this.api
      .saveOverrides(this.overridesData())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dirtyShows.set(new Set());
          this.showToast('All mapping overrides saved successfully!', 'success');
          this.isSaving.set(false);
        },
        error: err => {
          this.showToast(`Error saving overrides: ${err.message}`, 'error');
          this.isSaving.set(false);
        },
      });
  }

  handleSyncSeries(tvdbId: string) {
    this.syncingSeriesIds.update(s => new Set(s).add(tvdbId));
    this.api
      .syncSeries(tvdbId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          const s = (res as any).summary || res;
          if (s.deleted) {
            const cat = { ...this.catalogData() };
            delete cat[tvdbId];
            this.catalogData.set(cat);

            const ovr = { ...this.overridesData() };
            delete ovr[tvdbId];
            this.overridesData.set(ovr);

            const off = { ...this.officialData() };
            delete off[tvdbId];
            this.officialData.set(off);

            this.dirtyShows.update(set => {
              const next = new Set(set);
              next.delete(tvdbId);
              return next;
            });
            this.showToast('Series no longer found in Jellyfin. Removed from catalog.', 'info');
          } else if (s.show) {
            this.catalogData.update(cat => ({ ...cat, [tvdbId]: s.show }));
            if ((res as any).official) {
              this.officialData.update(off => ({ ...off, [tvdbId]: (res as any).official }));
            }
            let msg = `Synced "${s.title || tvdbId}" from Jellyfin! (${s.totalEpisodes} episodes)`;
            if (s.prunedOverridesCount > 0) {
              msg += ` Cleaned up ${s.prunedOverridesCount} deleted override(s).`;
              this.loadData();
            }
            this.showToast(msg, 'success');
          }
          this.syncingSeriesIds.update(set => {
            const next = new Set(set);
            next.delete(tvdbId);
            return next;
          });
        },
        error: err => {
          this.showToast(`Sync error: ${err.message}`, 'error');
          this.syncingSeriesIds.update(set => {
            const next = new Set(set);
            next.delete(tvdbId);
            return next;
          });
        },
      });
  }

  handleSyncLibrary() {
    this.isSyncingLibrary.set(true);
    this.api
      .syncLibrary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          const s = (res as any).summary || res;
          let msg = `Library synced! Found ${s.catalogShowsCount} shows and ${s.catalogEpisodesCount} episodes.`;
          if (s.prunedOverridesCount && s.prunedOverridesCount > 0) {
            msg += ` Cleaned up ${s.prunedOverridesCount} deleted override(s).`;
          }
          this.showToast(msg, 'success');
          this.loadData();
          this.isSyncingLibrary.set(false);
        },
        error: err => {
          this.showToast(`Sync error: ${err.message}`, 'error');
          this.isSyncingLibrary.set(false);
        },
      });
  }

  handleFilterSelect(f: string) {
    this.currentFilter.set(f);
    if (f === 'unmapped') this.currentSort.set('missing-desc');
    if (f === 'overrides') this.currentSort.set('overridden-desc');
    this.currentPage.set(1);
  }
}

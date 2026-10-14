import { Component, computed, input, output, signal } from '@angular/core';
import { CatalogEpisode, CatalogShow, OfficialEpisodeInfo, RawEpisodeOverride, RawShowOverride } from '../../models/types';
import { EpisodeRowComponent } from '../episode-row/episode-row.component';
import {
  isEpisodeMissingAniList,
  isEpisodeOverridden,
  isEpisodeSkipped,
} from '../../stores/overrides.store.utils';

export interface SeasonViewItem {
  seasonNum: string;
  label: string;
  episodes: [string, CatalogEpisode][];
  seasonMissing: number;
  seasonOverridden: number;
  seasonSkipped: number;
  isSeasonAllSkipped: boolean;
}

@Component({
  selector: 'app-series-card',
  imports: [EpisodeRowComponent],
  templateUrl: './series-card.component.html',
  styleUrl: './series-card.component.css',
})
export class SeriesCardComponent {
  tvdbId = input.required<string>();
  show = input.required<CatalogShow>();
  overrideShow = input<RawShowOverride | undefined>();
  officialShow = input<Record<string, Record<string, OfficialEpisodeInfo | null>> | undefined>();
  isModified = input<boolean>(false);
  isOpen = input<boolean>(false);
  isSyncing = input<boolean>(false);

  toggleOpen = output<void>();
  syncSeries = output<string>();
  saveSeries = output<string>();
  updateEpisode = output<{
    seasonNum: string;
    epNum: string;
    field: 'anilistId' | 'anilistEpisode';
    value: string;
  }>();
  useOfficialEpisode = output<{ seasonNum: string; epNum: string }>();
  toggleSkipEpisode = output<{ seasonNum: string; epNum: string }>();
  clearOverrideEpisode = output<{ seasonNum: string; epNum: string }>();
  applyBatchSeason = output<{ seasonNum: string; anilistId: number }>();
  applyOfficialSeason = output<{ seasonNum: string }>();
  skipUnmappedSeason = output<{ seasonNum: string }>();

  batchInputs = signal<Record<string, string>>({});

  getOfficialEp(seasonNum: string, epNum: string): OfficialEpisodeInfo | null {
    return this.officialShow()?.[seasonNum]?.[epNum] ?? null;
  }

  getOverrideEp(seasonNum: string, epNum: string): RawEpisodeOverride | undefined {
    return this.overrideShow()?.seasons?.[seasonNum]?.episodes?.[epNum];
  }

  isEpSkipped(seasonNum: string, epNum: string): boolean {
    return isEpisodeSkipped(this.getOverrideEp(seasonNum, epNum));
  }

  isEpMissingAniList(seasonNum: string, epNum: string): boolean {
    return isEpisodeMissingAniList(
      this.getOverrideEp(seasonNum, epNum),
      this.getOfficialEp(seasonNum, epNum)
    );
  }

  isEpOverridden(seasonNum: string, epNum: string): boolean {
    return isEpisodeOverridden(
      this.getOverrideEp(seasonNum, epNum),
      this.getOfficialEp(seasonNum, epNum)
    );
  }

  showStats = computed(() => {
    let missing = 0;
    let overridden = 0;
    let skipped = 0;
    let total = 0;

    const s = this.show();
    for (const [sKey, season] of Object.entries(s.seasons || {})) {
      for (const [eKey] of Object.entries(season.episodes || {})) {
        total++;
        if (this.isEpSkipped(sKey, eKey)) {
          skipped++;
        } else if (this.isEpMissingAniList(sKey, eKey)) {
          missing++;
        }
        if (this.isEpOverridden(sKey, eKey)) {
          overridden++;
        }
      }
    }

    return { missing, overridden, skipped, total };
  });

  sortedSeasons = computed<SeasonViewItem[]>(() => {
    const s = this.show();
    return Object.entries(s.seasons || {})
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([seasonNum, season]) => {
        const episodes = Object.entries(season.episodes || {}).sort(
          ([a], [b]) => parseInt(a, 10) - parseInt(b, 10),
        );

        let seasonMissing = 0;
        let seasonOverridden = 0;
        let seasonSkipped = 0;

        for (const [epNum] of episodes) {
          if (this.isEpSkipped(seasonNum, epNum)) {
            seasonSkipped++;
          } else if (this.isEpMissingAniList(seasonNum, epNum)) {
            seasonMissing++;
          }
          if (this.isEpOverridden(seasonNum, epNum)) {
            seasonOverridden++;
          }
        }

        const isSeasonAllSkipped = seasonSkipped === episodes.length && episodes.length > 0;
        const label = seasonNum === '0' ? 'Specials (Season 0)' : `Season ${seasonNum}`;

        return {
          seasonNum,
          label,
          episodes,
          seasonMissing,
          seasonOverridden,
          seasonSkipped,
          isSeasonAllSkipped,
        };
      });
  });

  updateBatchInput(seasonNum: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.batchInputs.update(current => ({ ...current, [seasonNum]: value }));
  }

  handleApplyBatch(seasonNum: string) {
    const val = this.batchInputs()[seasonNum]?.trim();
    if (!val) return;
    const num = parseInt(val, 10);
    if (Number.isInteger(num)) {
      this.applyBatchSeason.emit({ seasonNum, anilistId: num });
      this.batchInputs.update(current => ({ ...current, [seasonNum]: '' }));
    }
  }
}

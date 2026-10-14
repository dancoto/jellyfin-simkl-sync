import { Component, computed, input, output } from '@angular/core';
import { OverridesSummary } from '../../models/types';

@Component({
  selector: 'app-stats-banner',
  templateUrl: './stats-banner.component.html',
  styleUrl: './stats-banner.component.css',
})
export class StatsBannerComponent {
  summary = input<OverridesSummary | undefined>();
  selectedFilter = input<string>('all');

  selectFilter = output<string>();

  coveragePercent = computed(() => {
    const s = this.summary();
    if (!s || s.totalEpisodes === 0) return 0;
    return Math.round((s.mappedEpisodes / s.totalEpisodes) * 100);
  });
}

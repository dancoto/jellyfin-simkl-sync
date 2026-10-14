import { Component, inject, OnInit } from '@angular/core';
import { OverridesStore } from '../../stores/overrides.store';
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
  store = inject(OverridesStore);

  ngOnInit() {
    this.store.loadData();
  }
}

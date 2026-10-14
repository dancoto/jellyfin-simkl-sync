import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-controls-bar',
  templateUrl: './controls-bar.component.html',
  styleUrl: './controls-bar.component.css',
})
export class ControlsBarComponent {
  search = input<string>('');
  filter = input<string>('all');
  sort = input<string>('missing-desc');
  allExpanded = input<boolean>(false);
  isSyncing = input<boolean>(false);
  isRetiring = input<boolean>(false);
  filterCounts = input<{
    all: number;
    unmapped: number;
    overrides: number;
    skipped: number;
    complete: number;
  }>();

  searchChange = output<string>();
  filterChange = output<string>();
  sortChange = output<string>();
  syncLibrary = output<void>();
  retireRedundant = output<void>();
  bulkImport = output<void>();
  toggleExpandAll = output<void>();

  onSearchInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchChange.emit(val);
  }

  onSortChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.sortChange.emit(val);
  }
}

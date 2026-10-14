import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../stores/auth.store';
import { getAniListAuthUrl, getSimklAuthUrl } from '../../stores/auth.store.utils';

@Component({
  selector: 'app-auth-view',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent implements OnInit {
  store = inject(AuthStore);
  private route = inject(ActivatedRoute);

  queryParams = toSignal(this.route.queryParams);
  successUser = computed(() => this.queryParams()?.['success'] as string | undefined);
  successService = computed(() => this.queryParams()?.['service'] as string | undefined);
  errorMessage = computed(() => this.queryParams()?.['error'] as string | undefined);

  ngOnInit() {
    this.store.loadUsers();
  }

  getSimklAuthUrl(username: string): string {
    return getSimklAuthUrl(username);
  }

  getAniListAuthUrl(username: string): string {
    return getAniListAuthUrl(username);
  }

  connectSimkl() {
    const user = this.store.targetUsername();
    if (!user) return;
    window.location.href = this.getSimklAuthUrl(user);
  }

  connectAniList() {
    const user = this.store.targetUsername();
    if (!user) return;
    window.location.href = this.getAniListAuthUrl(user);
  }

  onUserSelect(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.store.setSelectedUser(val);
  }

  onCustomUserInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.store.setCustomUsername(val);
  }
}

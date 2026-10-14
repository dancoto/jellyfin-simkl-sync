import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-auth-view',
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  usersResource = this.api.getUsersResource();

  queryParams = toSignal(this.route.queryParams);
  successUser = computed(() => this.queryParams()?.['success'] as string | undefined);
  successService = computed(() => this.queryParams()?.['service'] as string | undefined);
  errorMessage = computed(() => this.queryParams()?.['error'] as string | undefined);

  selectedUser = signal('');
  customUsername = signal('');
  isCustomUser = computed(() => this.selectedUser() === '__custom__');
  targetUsername = computed(() =>
    this.isCustomUser() ? this.customUsername().trim() : this.selectedUser(),
  );

  refreshingUsers = signal<Set<string>>(new Set());
  actionNotification = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  copiedService = signal<string | null>(null);

  private notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const data = this.usersResource.value();
      if (data?.jellyfinUsers?.length && !this.selectedUser()) {
        this.selectedUser.set(data.jellyfinUsers[0].name);
      }
    });

    // Clean up timers when destroyed
    this.destroyRef.onDestroy(() => {
      if (this.notificationTimer) clearTimeout(this.notificationTimer);
      if (this.copyTimer) clearTimeout(this.copyTimer);
    });
  }

  showNotification(message: string, type: 'success' | 'error') {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.actionNotification.set({ message, type });
    this.notificationTimer = setTimeout(() => {
      this.actionNotification.set(null);
    }, 4000);
  }

  getSimklAuthUrl(username: string): string {
    return `/auth/login?username=${encodeURIComponent(username)}`;
  }

  getAniListAuthUrl(username: string): string {
    return `/auth/anilist/login?username=${encodeURIComponent(username)}`;
  }

  connectSimkl() {
    const user = this.targetUsername();
    if (!user) return;
    window.location.href = this.getSimklAuthUrl(user);
  }

  connectAniList() {
    const user = this.targetUsername();
    if (!user) return;
    window.location.href = this.getAniListAuthUrl(user);
  }

  refreshUser(username: string) {
    this.refreshingUsers.update(set => new Set(set).add(username));

    this.api
      .refreshUserToken(username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotification(`Token refreshed successfully for "${username}"`, 'success');
          this.refreshingUsers.update(set => {
            const next = new Set(set);
            next.delete(username);
            return next;
          });
          this.usersResource.reload();
        },
        error: err => {
          this.showNotification(`Refresh failed: ${err.message || String(err)}`, 'error');
          this.refreshingUsers.update(set => {
            const next = new Set(set);
            next.delete(username);
            return next;
          });
        },
      });
  }

  async copyText(text: string, service: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedService.set(service);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (this.copiedService() === service) {
          this.copiedService.set(null);
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  }

  onUserSelect(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedUser.set(val);
  }

  onCustomUserInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.customUsername.set(val);
  }
}

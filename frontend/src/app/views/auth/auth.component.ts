import { Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { AuthStore } from '../../stores/auth.store';
import { getAniListAuthUrl, getSimklAuthUrl } from '../../stores/auth.store.utils';

@Component({
  selector: 'app-auth-view',
  imports: [
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatOption,
    MatSelect,
    MatProgressSpinner,
    MatTooltip,
  ],
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

  onUserSelect(val: string) {
    this.store.setSelectedUser(val);
  }

  onCustomUserInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.store.setCustomUsername(val);
  }
}

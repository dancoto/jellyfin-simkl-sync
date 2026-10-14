import { Routes } from '@angular/router';
import { AuthComponent } from './views/auth/auth.component';
import { OverridesComponent } from './views/overrides/overrides.component';

export const routes: Routes = [
  {
    path: '',
    component: AuthComponent,
    title: 'Authentication & Users - Jellyfin Tracker Sync',
  },
  {
    path: 'auth',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'overrides',
    component: OverridesComponent,
    title: 'Mapping Overrides - Jellyfin Tracker Sync',
  },
  {
    path: '**',
    redirectTo: '',
  },
];

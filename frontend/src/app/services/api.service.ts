import { inject, Injectable } from '@angular/core';
import { HttpClient, httpResource, HttpResourceRef } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CatalogSyncResult,
  OverridesApiResponse,
  RawTvdbOverrides,
  RetireRedundantResult,
  SeriesSyncResult,
  UsersApiResponse,
} from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);

  // Resource-based reactive GETs (Signals)
  getUsersResource(): HttpResourceRef<UsersApiResponse | undefined> {
    return httpResource<UsersApiResponse>(() => '/api/users');
  }

  getOverridesResource(): HttpResourceRef<OverridesApiResponse | undefined> {
    return httpResource<OverridesApiResponse>(() => '/api/overrides');
  }

  // Observable-based HTTP GET requests
  getOverrides(): Observable<OverridesApiResponse> {
    return this.http.get<OverridesApiResponse>('/api/overrides');
  }

  getUsers(): Observable<UsersApiResponse> {
    return this.http.get<UsersApiResponse>('/api/users');
  }

  // Observable-based HTTP POST requests
  refreshUserToken(username: string): Observable<{ status: string; username: string }> {
    return this.http.post<{ status: string; username: string }>('/api/users/refresh', { username });
  }

  saveOverrides(overrides: RawTvdbOverrides): Observable<{ status: string }> {
    return this.http.post<{ status: string }>('/api/overrides', { overrides });
  }

  saveShow(tvdbId: string, show: any): Observable<{ status: string }> {
    return this.http.post<{ status: string }>('/api/overrides', { tvdbId, show });
  }

  importMappings(options: {
    overwriteExistingManual?: boolean;
    includeNonAnime?: boolean;
  }): Observable<any> {
    return this.http.post<any>('/api/overrides/import', options);
  }

  retireRedundantOverrides(options?: { dryRun?: boolean }): Observable<RetireRedundantResult> {
    return this.http.post<RetireRedundantResult>('/api/overrides/retire-redundant', {
      dryRun: Boolean(options?.dryRun),
    });
  }

  syncLibrary(): Observable<CatalogSyncResult> {
    return this.http.post<CatalogSyncResult>('/api/catalog/sync', {});
  }

  syncSeries(tvdbId: string): Observable<SeriesSyncResult> {
    return this.http.post<SeriesSyncResult>('/api/catalog/sync-series', { tvdbId });
  }
}

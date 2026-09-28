import { appConfig } from '../shared/config';
import { logger } from '../shared/logger';

export class JellyfinClient {
  private seriesCache = new Map<string, Record<string, string>>();
  private libraryCache = new Map<string, string>();

  public async getSeriesProviderIds(seriesId?: string): Promise<Record<string, string> | null> {
    if (!seriesId) {
      return null;
    }

    const cached = this.seriesCache.get(seriesId);
    if (cached) {
      return cached;
    }

    const config = appConfig.jellyfin;
    if (!config?.url || !config?.token) {
      return null;
    }

    try {
      const headers = new Headers();
      headers.set('Authorization', `MediaBrowser Token="${config.token}"`);
      headers.set('Accept', 'application/json');

      // 1. Try querying /Items?ids={seriesId}&fields=ProviderIds (non-user-scoped endpoint)
      const queryUrl = new URL('/Items', config.url);
      queryUrl.searchParams.set('ids', seriesId);
      queryUrl.searchParams.set('fields', 'ProviderIds');

      let response = await fetch(queryUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          Items?: Array<{ Id?: string; ProviderIds?: Record<string, string> }>;
        };
        const item = data.Items?.[0];
        if (item?.ProviderIds && typeof item.ProviderIds === 'object') {
          const normalized: Record<string, string> = {};
          for (const [key, value] of Object.entries(item.ProviderIds)) {
            if (value) {
              normalized[key.toLowerCase()] = String(value);
            }
          }
          this.seriesCache.set(seriesId, normalized);
          return normalized;
        }
      }

      // 2. Fallback to /Items/{seriesId}
      const directUrl = new URL(`/Items/${seriesId}`, config.url);
      response = await fetch(directUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn(
          `Jellyfin API returned ${response.status} when fetching series metadata for ${seriesId}: ${errorText}`,
        );
        return null;
      }

      const data = (await response.json()) as { ProviderIds?: Record<string, string> };
      if (data.ProviderIds && typeof data.ProviderIds === 'object') {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(data.ProviderIds)) {
          if (value) {
            normalized[key.toLowerCase()] = String(value);
          }
        }
        this.seriesCache.set(seriesId, normalized);
        return normalized;
      }

      return null;
    } catch (error) {
      logger.error(`Error querying Jellyfin API for series ${seriesId}:`, error);
      return null;
    }
  }

  public async getLibraryName(itemId?: string): Promise<string | null> {
    if (!itemId) {
      return null;
    }

    const cached = this.libraryCache.get(itemId);
    if (cached) {
      return cached;
    }

    const config = appConfig.jellyfin;
    if (!config?.url || !config?.token) {
      return null;
    }

    try {
      const headers = new Headers();
      headers.set('Authorization', `MediaBrowser Token="${config.token}"`);
      headers.set('Accept', 'application/json');

      // 1. Query Ancestors endpoint
      const ancestorsUrl = new URL(`/Items/${itemId}/Ancestors`, config.url);
      const res = await fetch(ancestorsUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const ancestors = (await res.json()) as Array<{ Name?: string; Type?: string }>;
        if (Array.isArray(ancestors)) {
          // Filter out server root and aggregate containers
          const validAncestors = ancestors.filter(
            (a) => a.Name && a.Name.toLowerCase() !== 'root' && a.Type !== 'AggregateFolder',
          );

          // Find collection folder or user view
          const collection = validAncestors.find(
            (a) => a.Type === 'CollectionFolder' || a.Type === 'UserView',
          );
          const libraryName = collection?.Name ?? validAncestors[validAncestors.length - 1]?.Name;
          if (libraryName && libraryName.toLowerCase() !== 'root') {
            this.libraryCache.set(itemId, libraryName);
            return libraryName;
          }
        }
      }

      // 2. Fallback to querying item path
      const itemUrl = new URL(`/Items?ids=${itemId}&fields=Path`, config.url);
      const itemRes = await fetch(itemUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (itemRes.ok) {
        const itemData = (await itemRes.json()) as { Items?: Array<{ Path?: string }> };
        const path = itemData.Items?.[0]?.Path;
        if (path) {
          const segments = path.split(/[/\\]+/).filter(Boolean);
          for (const seg of segments) {
            if (seg.toLowerCase().includes('anime')) {
              this.libraryCache.set(itemId, seg);
              return seg;
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error querying Jellyfin for library name of ${itemId}:`, error);
      return null;
    }
  }

  public setCachedSeries(seriesId: string, providerIds: Record<string, string>): void {
    this.seriesCache.set(seriesId, providerIds);
  }

  public setCachedLibrary(itemId: string, libraryName: string): void {
    this.libraryCache.set(itemId, libraryName);
  }

  public async getUsers(): Promise<Array<{ id: string; name: string }>> {
    const config = appConfig.jellyfin;
    if (!config?.url || !config?.token) {
      return [];
    }

    try {
      const url = new URL('/Users', config.url);
      const headers = new Headers();
      headers.set('Authorization', `MediaBrowser Token="${config.token}"`);
      headers.set('Accept', 'application/json');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.warn(`Jellyfin API returned ${response.status} when fetching users`);
        return [];
      }

      const users = (await response.json()) as Array<{ Id: string; Name: string }>;
      if (Array.isArray(users)) {
        return users.map((u) => ({ id: u.Id, name: u.Name }));
      }
      return [];
    } catch (error) {
      console.error('Error querying Jellyfin API for users:', error);
      return [];
    }
  }

  public clearCache(): void {
    this.seriesCache.clear();
    this.libraryCache.clear();
  }
}

export const defaultJellyfinClient = new JellyfinClient();

import { appConfig } from '../shared/config';

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
      const url = new URL(`/Items/${seriesId}`, config.url);
      const headers = new Headers();
      headers.set('Authorization', `MediaBrowser Token="${config.token}"`);
      headers.set('Accept', 'application/json');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.warn(
          `Jellyfin API returned ${response.status} when fetching series metadata for ${seriesId}`,
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
      console.error(`Error querying Jellyfin API for series ${seriesId}:`, error);
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
          const collection = ancestors.find((a) => a.Type === 'CollectionFolder');
          const libraryName = collection?.Name ?? ancestors[ancestors.length - 1]?.Name;
          if (libraryName) {
            this.libraryCache.set(itemId, libraryName);
            return libraryName;
          }
        }
      }

      // 2. Fallback to GET /Items/{itemId}
      const itemUrl = new URL(`/Items/${itemId}`, config.url);
      const itemRes = await fetch(itemUrl.toString(), {
        method: 'GET',
        headers,
      });

      if (itemRes.ok) {
        const itemData = (await itemRes.json()) as { Path?: string };
        if (itemData.Path) {
          const segments = itemData.Path.split(/[/\\]+/).filter(Boolean);
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
      console.error(`Error querying Jellyfin for library name of ${itemId}:`, error);
      return null;
    }
  }

  public setCachedSeries(seriesId: string, providerIds: Record<string, string>): void {
    this.seriesCache.set(seriesId, providerIds);
  }

  public setCachedLibrary(itemId: string, libraryName: string): void {
    this.libraryCache.set(itemId, libraryName);
  }

  public clearCache(): void {
    this.seriesCache.clear();
    this.libraryCache.clear();
  }
}

export const defaultJellyfinClient = new JellyfinClient();

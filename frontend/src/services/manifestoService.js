import { manifestoEndpoint } from 'resource/resources';

// In-memory cache for manifesto data
const manifestoCache = new Map();
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

// Cache entry structure: { data, timestamp, loading: Promise }
class ManifestoService {
  static async getPartyManifesto(partyName) {
    const cacheKey = partyName;
    const now = Date.now();

    // Check if we have cached data that's still valid
    const cached = manifestoCache.get(cacheKey);
    if (cached) {
      // If data is still loading, return the same promise
      if (cached.loading) {
        return cached.loading;
      }

      // If data is fresh, return it
      if (cached.data && now - cached.timestamp < CACHE_EXPIRY_TIME) {
        return Promise.resolve(cached.data);
      }
    }

    // Create a new loading promise
    // eslint-disable-next-line no-underscore-dangle
    const loadingPromise = this._fetchPartyManifesto(partyName);

    // Store the loading promise in cache
    manifestoCache.set(cacheKey, {
      loading: loadingPromise,
      timestamp: now,
    });

    try {
      const data = await loadingPromise;

      // Update cache with the actual data
      manifestoCache.set(cacheKey, {
        data,
        timestamp: now,
        loading: null,
      });

      return data;
    } catch (error) {
      // Remove failed loading promise from cache
      manifestoCache.delete(cacheKey);
      throw error;
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  static async _fetchPartyManifesto(partyName) {
    // URL encode the party name for the API call
    const encodedPartyName = encodeURIComponent(partyName);
    const url = `${manifestoEndpoint}party/${encodedPartyName}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`党「${partyName}」のデータが見つかりません`);
      }
      throw new Error(`データの取得に失敗しました: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  static async getAvailableParties() {
    const cacheKey = '__available_parties__';
    const now = Date.now();

    // Check cache
    const cached = manifestoCache.get(cacheKey);
    if (cached) {
      if (cached.loading) {
        return cached.loading;
      }

      if (cached.data && now - cached.timestamp < CACHE_EXPIRY_TIME) {
        return Promise.resolve(cached.data);
      }
    }

    // Create loading promise
    // eslint-disable-next-line no-underscore-dangle
    const loadingPromise = this._fetchAvailableParties();

    manifestoCache.set(cacheKey, {
      loading: loadingPromise,
      timestamp: now,
    });

    try {
      const data = await loadingPromise;

      manifestoCache.set(cacheKey, {
        data,
        timestamp: now,
        loading: null,
      });

      return data;
    } catch (error) {
      manifestoCache.delete(cacheKey);
      throw error;
    }
  }

  // eslint-disable-next-line no-underscore-dangle
  static async _fetchAvailableParties() {
    const url = `${manifestoEndpoint}parties`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `利用可能な政党データの取得に失敗しました: ${response.status}`
      );
    }

    const data = await response.json();
    return data;
  }

  // Clear cache for a specific party or all cache
  static clearCache(partyName = null) {
    if (partyName) {
      manifestoCache.delete(partyName);
    } else {
      manifestoCache.clear();
    }
  }

  // Get cache statistics (useful for debugging)
  static getCacheStats() {
    const stats = {
      size: manifestoCache.size,
      entries: [],
    };

    const now = Date.now();
    manifestoCache.forEach((entry, key) => {
      stats.entries.push({
        key,
        hasData: !!entry.data,
        isLoading: !!entry.loading,
        age: now - entry.timestamp,
        isExpired: now - entry.timestamp > CACHE_EXPIRY_TIME,
      });
    });

    return stats;
  }
}

export default ManifestoService;

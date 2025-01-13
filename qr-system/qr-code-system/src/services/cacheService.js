// src/services/cacheService.js
import localforage from 'localforage';

const CACHE_CONFIG = {
  // Static data that changes infrequently
  STATIC: {
    users: {
      expiry: 24 * 60 * 60 * 1000, // 24 hours
      key: 'cached_users'
    },
    locations: {
      expiry: 7 * 24 * 60 * 60 * 1000, // 7 days
      key: 'cached_locations'
    }
  },
  // Dynamic data that changes frequently
  DYNAMIC: {
    attendance: {
      expiry: 5 * 60 * 1000, // 5 minutes
      key: 'cached_attendance'
    },
    dashboard: {
      expiry: 2 * 60 * 1000, // 2 minutes
      key: 'cached_dashboard'
    }
  }
};

class CacheService {
  constructor() {
    this.store = localforage.createInstance({
      name: 'qrAttendanceSystem'
    });
  }

  async get(key) {
    try {
      const cachedData = await this.store.getItem(key);
      if (!cachedData) return null;

      const { data, timestamp, expiry } = cachedData;
      const now = Date.now();

      // Check if cache is expired
      if (now - timestamp > expiry) {
        await this.remove(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }

  async set(key, data, expiry) {
    try {
      const cacheObject = {
        data,
        timestamp: Date.now(),
        expiry
      };
      await this.store.setItem(key, cacheObject);
      return true;
    } catch (error) {
      console.error('Cache setting error:', error);
      return false;
    }
  }

  async remove(key) {
    try {
      await this.store.removeItem(key);
      return true;
    } catch (error) {
      console.error('Cache removal error:', error);
      return false;
    }
  }

  async clear() {
    try {
      await this.store.clear();
      return true;
    } catch (error) {
      console.error('Cache clearing error:', error);
      return false;
    }
  }

  // Utility method to check if cache exists and is valid
  async isValid(key) {
    try {
      const cachedData = await this.store.getItem(key);
      if (!cachedData) return false;

      const { timestamp, expiry } = cachedData;
      return Date.now() - timestamp <= expiry;
    } catch {
      return false;
    }
  }
}

export const cacheService = new CacheService();
export { CACHE_CONFIG };
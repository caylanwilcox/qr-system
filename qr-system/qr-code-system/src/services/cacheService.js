// src/services/cacheService.js (FIXED)
/**
 * Simple cache service for temporary data storage
 * Uses localStorage with expiration
 */
class CacheService {
  constructor() {
    this.PREFIX = 'attendance_app_';
    this.DEBUG_PREFIX = '🔄 [CacheService]';
  }

  /**
   * Get a cached item by key
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if expired/missing
   */
  async get(key) {
    try {
      const fullKey = this.PREFIX + key;
      const cachedItem = localStorage.getItem(fullKey);
      
      if (!cachedItem) {
        return null;
      }
      
      const { value, expiry } = JSON.parse(cachedItem);
      
      // Check if expired
      if (expiry && expiry < Date.now()) {
        console.log(`${this.DEBUG_PREFIX} Cache expired for key: ${key}`);
        localStorage.removeItem(fullKey);
        return null;
      }
      
      return value;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error getting cache:`, error);
      return null;
    }
  }

  /**
   * Set a cached item
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} expiry - Expiration time in milliseconds
   * @returns {Promise<boolean>} - Success indicator
   */
  async set(key, value, expiry = 5 * 60 * 1000) { // Default: 5 minutes
    try {
      const fullKey = this.PREFIX + key;
      const item = {
        value,
        expiry: Date.now() + expiry
      };
      
      localStorage.setItem(fullKey, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error setting cache:`, error);
      return false;
    }
  }

  /**
   * Remove a cached item
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success indicator
   */
  async remove(key) {
    try {
      const fullKey = this.PREFIX + key;
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error removing cache:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<number>} - Number of items cleared
   */
  async clear() {
    try {
      const count = await this.clearByPrefix(this.PREFIX);
      return count;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error clearing cache:`, error);
      return 0;
    }
  }

  /**
   * Clear cache by prefix
   * @param {string} prefix - Key prefix
   * @returns {Promise<number>} - Number of items cleared
   */
  async clearByPrefix(prefix) {
    try {
      const fullPrefix = prefix.startsWith(this.PREFIX) ? prefix : this.PREFIX + prefix;
      let count = 0;
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(fullPrefix)) {
          localStorage.removeItem(key);
          count++;
        }
      });
      
      return count;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error clearing cache by prefix:`, error);
      return 0;
    }
  }

  /**
   * Get all cache keys
   * @returns {Promise<string[]>} - Array of cache keys
   */
  async keys() {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(this.PREFIX))
        .map(key => key.substring(this.PREFIX.length));
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error getting keys:`, error);
      return [];
    }
  }
}

// Define cache configuration constants here directly instead of importing
export const CACHE_CONFIG = {
  STATIC: {
    users: {
      key: 'users_all',
      expiry: 60 * 60 * 1000 // 1 hour
    },
    locations: {
      key: 'locations_all',
      expiry: 60 * 60 * 1000 // 1 hour
    },
    eventTypes: {
      key: 'event_types_all',
      expiry: 60 * 60 * 1000 // 1 hour
    }
  },
  DYNAMIC: {
    users: {
      expiry: 5 * 60 * 1000 // 5 minutes
    },
    attendance: {
      key: 'attendance',
      expiry: 2 * 60 * 1000 // 2 minutes
    },
    events: {
      key: 'events_all', 
      expiry: 10 * 60 * 1000 // 10 minutes
    },
    dashboard: {
      key: 'dashboard',
      expiry: 2 * 60 * 1000 // 2 minutes
    }
  }
};

// Export a singleton instance
export const cacheService = new CacheService();
export default cacheService;
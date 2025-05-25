// src/utils/LocationManager.js
// Add this file if it doesn't exist

/**
 * Location Manager Utility
 * 
 * Provides consistent methods for working with locations
 */
export class LocationManager {
  /**
   * Get a location by its key
   * @param {string} key - Location key
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByKey(key) {
    if (!key) return null;
    
    try {
      // Convert key to lowercase for consistent lookup
      const normalizedKey = key.toLowerCase();
      
      // Try to get from database - stub implementation
      // You can replace this with actual database logic
      const locations = {
        aurora: { key: 'aurora', name: 'Aurora' },
        elgin: { key: 'elgin', name: 'Elgin' },
        joliet: { key: 'joliet', name: 'Joliet' },
        lyons: { key: 'lyons', name: 'Lyons' },
        'west chicago': { key: 'west chicago', name: 'West Chicago' },
        wheeling: { key: 'wheeling', name: 'Wheeling' }
      };
      
      return locations[normalizedKey] || { key: normalizedKey, name: key };
    } catch (error) {
      console.error('Error fetching location by key:', error);
      return { key, name: key };
    }
  }

  /**
   * Get a location by its name
   * @param {string} name - Location name
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByName(name) {
    if (!name) return null;
    
    try {
      // Convert name to consistent format
      const normalizedName = name.trim();
      
      // Create key from name
      const key = normalizedName.toLowerCase().replace(/\s+/g, ' ');
      
      return { key, name: normalizedName };
    } catch (error) {
      console.error('Error creating location from name:', error);
      return { key: name.toLowerCase(), name };
    }
  }

  /**
   * Get all locations
   * @returns {Promise<Array>} - Array of location objects
   */
  static async getAllLocations() {
    try {
      // Stub implementation - replace with actual database call
      return [
        { key: 'aurora', name: 'Aurora' },
        { key: 'elgin', name: 'Elgin' },
        { key: 'joliet', name: 'Joliet' },
        { key: 'lyons', name: 'Lyons' },
        { key: 'west chicago', name: 'West Chicago' },
        { key: 'wheeling', name: 'Wheeling' }
      ];
    } catch (error) {
      console.error('Error fetching all locations:', error);
      return [];
    }
  }

  /**
   * Normalize a location key or name
   * @param {string} location - Location key or name
   * @returns {string} - Normalized key
   */
  static normalizeLocationKey(location) {
    if (!location) return '';
    return location.toLowerCase().replace(/\s+/g, ' ');
  }
}

export default LocationManager;
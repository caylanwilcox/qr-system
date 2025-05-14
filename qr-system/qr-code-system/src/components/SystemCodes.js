// SystemCodes.js - Comprehensive utility for all system codes

import { ref, get } from 'firebase/database';
import { database } from '../services/firebaseConfig';

/**
 * Utility class for managing and accessing system codes
 */
export class SystemCodes {
  /**
   * Normalizes text to a consistent key format
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized key
   */
  static normalizeToKey(text) {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  }
  
  /**
   * Fetches all items from a system code category
   * @param {string} category - The category to fetch (e.g., 'serviceTypes', 'locations')
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Data in the specified format
   */
  static async getAll(category, format = 'array') {
    try {
      const categoryRef = ref(database, category);
      const snapshot = await get(categoryRef);
      
      if (!snapshot.exists()) {
        console.warn(`No data found for category: ${category}`);
        return format === 'array' || format === 'nameArray' || format === 'options' ? [] : {};
      }
      
      const data = snapshot.val();
      
      // Process based on requested format
      if (format === 'array') {
        return Object.entries(data).map(([id, item]) => ({
          id,
          ...item
        }));
      } else if (format === 'object') {
        return data;
      } else if (format === 'nameArray') {
        return Object.values(data).map(item => 
          typeof item === 'object' && item !== null ? item.name : item
        );
      } else if (format === 'options') {
        // For dropdowns with value/label pairs
        return Object.entries(data).map(([id, item]) => {
          if (typeof item === 'object' && item !== null) {
            // For locations and other structured data
            const value = item.key || this.normalizeToKey(item.name);
            const label = item.name;
            const extra = {};
            
            // Add additional fields based on item type
            if (item.address) extra.address = item.address;
            if (item.description) extra.description = item.description;
            if (item.displayName) extra.displayName = item.displayName;
            
            return {
              value,
              label,
              id,
              ...extra
            };
          } else {
            // For simple string items
            return {
              value: typeof item === 'string' ? this.normalizeToKey(item) : id,
              label: item,
              id
            };
          }
        });
      } else if (format === 'keyMap') {
        // Returns map of keys to objects
        const keyMap = {};
        Object.entries(data).forEach(([id, item]) => {
          if (typeof item === 'object' && item !== null) {
            const key = item.key || this.normalizeToKey(item.name);
            keyMap[key] = {
              id,
              ...item
            };
          } else {
            const key = this.normalizeToKey(String(item));
            keyMap[key] = {
              id,
              name: String(item),
              key
            };
          }
        });
        return keyMap;
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${category}:`, error);
      return format === 'array' || format === 'nameArray' || format === 'options' ? [] : {};
    }
  }
  
  /**
   * Fetches locations
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Location data
   */
  static async getLocations(format = 'nameArray') {
    return this.getAll('locations', format);
  }
  
  /**
   * Gets a location by its key
   * @param {string} key - The location key
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByKey(key) {
    if (!key) return null;
    
    const keyMap = await this.getAll('locations', 'keyMap');
    return keyMap[key] || null;
  }
  
  /**
   * Gets a location by its name
   * @param {string} name - The location name
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByName(name) {
    if (!name) return null;
    
    const locations = await this.getAll('locations', 'array');
    return locations.find(loc => loc.name === name) || null;
  }
  
  /**
   * Fetches service types
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Service type data
   */
  static async getServiceTypes(format = 'nameArray') {
    return this.getAll('serviceTypes', format);
  }
  
  /**
   * Fetches meeting types
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Meeting type data
   */
  static async getMeetingTypes(format = 'nameArray') {
    return this.getAll('meetingTypes', format);
  }
  
  /**
   * Fetches event types
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Event type data
   */
  static async getEventTypes(format = 'array') {
    const eventTypes = await this.getAll('eventTypes', 'array');
    
    if (format === 'constants') {
      // Return as EVENT_TYPES constant object
      const constants = {};
      eventTypes.forEach(type => {
        if (type.name) {
          const normalizedName = type.name.toUpperCase().replace(/\s+/g, '_');
          constants[normalizedName] = normalizedName;
        }
      });
      return constants;
    } else if (format === 'displayNames') {
      // Return as EVENT_TYPE_DISPLAY_NAMES mapping
      const displayNames = {};
      eventTypes.forEach(type => {
        if (type.name) {
          const normalizedName = type.name.toUpperCase().replace(/\s+/g, '_');
          displayNames[normalizedName] = type.displayName || type.name;
        }
      });
      return displayNames;
    }
    
    return eventTypes;
  }
  
  /**
   * Fetches roles
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Role data
   */
  static async getRoles(format = 'nameArray') {
    return this.getAll('roles', format);
  }
  
  /**
   * Fetches statuses
   * @param {string} format - The format to return data in
   * @returns {Promise<Array|Object>} - Status data
   */
  static async getStatuses(format = 'nameArray') {
    return this.getAll('statuses', format);
  }
  
  /**
   * Fetches event type to category mapping
   * @returns {Promise<Object>} - Mapping object
   */
  static async getEventTypeCategoryMap() {
    try {
      const mapRef = ref(database, 'eventTypeCategories');
      const snapshot = await get(mapRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      
      return {};
    } catch (error) {
      console.error('Error fetching event type category map:', error);
      return {};
    }
  }
  
  /**
   * Utility function to normalize an event type string for consistent use
   * @param {string} eventType - The event type to normalize
   * @returns {string} - The normalized event type
   */
  static normalizeEventType(eventType) {
    if (!eventType) return '';
    
    // Handle legacy strings or format inconsistencies
    const normalized = eventType.toUpperCase().replace(/\s+/g, '_');
    
    // Common mappings
    const mappings = {
      'WORKSHOP': 'WORKSHOPS',
      'MEETING': 'MEETINGS',
      'HACIENDA': 'HACIENDAS',
    };
    
    return mappings[normalized] || normalized;
  }
}

/**
 * React hook to use system codes in components
 * @param {string} category - The category to fetch
 * @param {string} format - The format to return data in
 * @returns {Array} - [loading, data, error]
 */
export const useSystemCodes = (category, format = 'nameArray') => {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState(format === 'array' || format === 'nameArray' || format === 'options' ? [] : {});
  const [error, setError] = React.useState(null);
  
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let result;
        
        // Use the appropriate method based on category
        if (category === 'locations') {
          result = await SystemCodes.getLocations(format);
        } else if (category === 'serviceTypes') {
          result = await SystemCodes.getServiceTypes(format);
        } else if (category === 'meetingTypes') {
          result = await SystemCodes.getMeetingTypes(format);
        } else if (category === 'eventTypes') {
          result = await SystemCodes.getEventTypes(format);
        } else if (category === 'roles') {
          result = await SystemCodes.getRoles(format);
        } else if (category === 'statuses') {
          result = await SystemCodes.getStatuses(format);
        } else {
          result = await SystemCodes.getAll(category, format);
        }
        
        setData(result);
        setError(null);
      } catch (err) {
        console.error(`Error in useSystemCodes for ${category}:`, err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [category, format]);
  
  return [loading, data, error];
};

export default SystemCodes;
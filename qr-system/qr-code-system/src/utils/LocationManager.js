// LocationManager.js - Central utility for location management

import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { useState, useEffect } from 'react';

/**
 * LocationManager - Comprehensive utility for standardized location management
 * This class ensures consistent location handling throughout the application
 */
export class LocationManager {
  /**
   * Normalizes location text to a consistent key format
   * @param {string} locationName - Location name to normalize
   * @returns {string} - Normalized key for consistent referencing
   */
  static normalizeToKey(locationName) {
    if (!locationName) return '';
    return locationName.trim().toLowerCase().replace(/\s+/g, '');
  }
  
  /**
   * Properly formats a location name for display
   * @param {string} locationName - Raw location name
   * @returns {string} - Properly formatted location name
   */
  static formatDisplayName(locationName) {
    if (!locationName) return '';
    
    // Properly capitalize the first letter of each word
    return locationName.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Fetches all locations with standardized formatting
   * @param {string} format - Output format (options: 'array', 'object', 'options', 'keyMap')
   * @returns {Promise<Array|Object>} - Locations in requested format
   */
  static async getAllLocations(format = 'array') {
    try {
      const locationsRef = ref(database, 'locations');
      const snapshot = await get(locationsRef);
      
      if (!snapshot.exists()) {
        console.warn('No locations found in database');
        return format === 'array' || format === 'options' ? [] : {};
      }
      
      const locationsData = snapshot.val();
      
      // Process based on requested format
      if (format === 'array') {
        return Object.entries(locationsData).map(([id, item]) => ({
          id,
          ...item,
          // Ensure key exists
          key: item.key || this.normalizeToKey(item.name)
        }));
      } 
      else if (format === 'object') {
        return locationsData;
      } 
      else if (format === 'options') {
        // For dropdowns (value/label pairs)
        return Object.entries(locationsData)
          .filter(([_, item]) => item.active !== false) // Only include active locations by default
          .map(([id, item]) => {
            const key = item.key || this.normalizeToKey(item.name);
            return {
              value: key,
              label: item.name,
              id,
              address: item.address || ''
            };
          });
      } 
      else if (format === 'keyMap') {
        // Map of keys to location objects
        const keyMap = {};
        Object.entries(locationsData).forEach(([id, item]) => {
          const key = item.key || this.normalizeToKey(item.name);
          keyMap[key] = {
            id,
            ...item
          };
        });
        return keyMap;
      }
      
      return locationsData;
    } catch (error) {
      console.error('Error fetching locations:', error);
      return format === 'array' || format === 'options' ? [] : {};
    }
  }
  
  /**
   * Gets a location by its key
   * @param {string} key - Location key
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByKey(key) {
    if (!key) return null;
    
    try {
      const keyMap = await this.getAllLocations('keyMap');
      return keyMap[key] || null;
    } catch (error) {
      console.error('Error fetching location by key:', error);
      return null;
    }
  }
  
  /**
   * Gets a location by name
   * @param {string} name - Location name
   * @returns {Promise<Object|null>} - Location data or null if not found
   */
  static async getLocationByName(name) {
    if (!name) return null;
    
    try {
      const locations = await this.getAllLocations('array');
      return locations.find(loc => 
        loc.name.toLowerCase() === name.toLowerCase() ||
        loc.key === this.normalizeToKey(name)
      ) || null;
    } catch (error) {
      console.error('Error fetching location by name:', error);
      return null;
    }
  }
  
  /**
   * Gets all users assigned to a location
   * @param {string} locationKey - Location key
   * @returns {Promise<Array>} - Array of users at the location
   */
  static async getUsersAtLocation(locationKey) {
    if (!locationKey) return [];
    
    try {
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        return [];
      }
      
      const usersData = usersSnapshot.val();
      const usersAtLocation = [];
      
      // Filter users by location
      Object.entries(usersData).forEach(([userId, userData]) => {
        // Check different possible location references
        const userLocationKey = 
          (userData.profile?.locationKey) || 
          this.normalizeToKey(userData.profile?.location) ||
          this.normalizeToKey(userData.location);
        
        if (userLocationKey === locationKey) {
          usersAtLocation.push({
            id: userId,
            ...userData,
            locationKey // Add locationKey if it wasn't already there
          });
        }
      });
      
      return usersAtLocation;
    } catch (error) {
      console.error('Error fetching users at location:', error);
      return [];
    }
  }
  
  /**
   * Creates a new location with proper formatting
   * @param {Object} locationData - Location data
   * @returns {Promise<string>} - ID of the created location
   */
  static async createLocation(locationData) {
    try {
      if (!locationData.name) {
        throw new Error('Location name is required');
      }
      
      const displayName = this.formatDisplayName(locationData.name);
      const locationKey = locationData.key || this.normalizeToKey(displayName);
      
      // Check if this key already exists
      const existingLocation = await this.getLocationByKey(locationKey);
      if (existingLocation) {
        throw new Error(`Location with name "${displayName}" already exists`);
      }
      
      // Reference to create a new location
      const newLocationRef = ref(database, `locations/${locationData.id || locationKey}`);
      
      // Build location object
      const newLocation = {
        name: displayName,
        key: locationKey,
        active: locationData.active !== false, // Default to active
        createdAt: new Date().toISOString(),
        ...locationData, // Include any additional fields
        // Ensure key properties are properly set with our formatting
        name: displayName, 
        key: locationKey
      };
      
      // Remove id if present (not stored in the object itself)
      if (newLocation.id) {
        delete newLocation.id;
      }
      
      // Save to database
      await set(newLocationRef, newLocation);
      
      return newLocationRef.key;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  }
  
  /**
   * Updates a location
   * @param {string} locationId - Location ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<void>}
   */
  static async updateLocation(locationId, updateData) {
    try {
      if (!locationId) {
        throw new Error('Location ID is required');
      }
      
      const locationRef = ref(database, `locations/${locationId}`);
      const locationSnapshot = await get(locationRef);
      
      if (!locationSnapshot.exists()) {
        throw new Error('Location not found');
      }
      
      const existingData = locationSnapshot.val();
      const updates = { ...updateData };
      
      // Handle name changes (which affect the key)
      if (updateData.name && updateData.name !== existingData.name) {
        updates.name = this.formatDisplayName(updateData.name);
        
        // If key was auto-generated from name, update it
        if (!updateData.key && existingData.key === this.normalizeToKey(existingData.name)) {
          updates.key = this.normalizeToKey(updates.name);
        }
      }
      
      // If key is explicitly changed
      if (updateData.key && updateData.key !== existingData.key) {
        // Check if this key is already in use
        const keyMap = await this.getAllLocations('keyMap');
        if (keyMap[updateData.key] && keyMap[updateData.key].id !== locationId) {
          throw new Error(`Location key "${updateData.key}" is already in use`);
        }
        
        // Update all users that reference this location
        await this.updateUserLocationReferences(existingData.key, updateData.key);
      }
      
      // Add updated timestamp
      updates.updatedAt = new Date().toISOString();
      
      // Update location
      await update(locationRef, updates);
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }
  
  /**
   * Updates all user references to a location
   * @param {string} oldKey - Old location key
   * @param {string} newKey - New location key
   * @returns {Promise<number>} - Number of users updated
   */
  static async updateUserLocationReferences(oldKey, newKey) {
    try {
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        return 0;
      }
      
      const usersData = usersSnapshot.val();
      const updates = {};
      let updateCount = 0;
      
      // Find users referencing the location
      Object.entries(usersData).forEach(([userId, userData]) => {
        let needsUpdate = false;
        
        // Check profile.locationKey
        if (userData.profile?.locationKey === oldKey) {
          updates[`users/${userId}/profile/locationKey`] = newKey;
          needsUpdate = true;
        }
        
        // Check profile.location (string name)
        if (userData.profile?.location && this.normalizeToKey(userData.profile.location) === oldKey) {
          // Get the new location's display name
          const locationDisplayName = newKey;
          updates[`users/${userId}/profile/location`] = locationDisplayName;
          needsUpdate = true;
        }
        
        // Check root-level location
        if (userData.location && this.normalizeToKey(userData.location) === oldKey) {
          updates[`users/${userId}/location`] = newKey;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          updateCount++;
        }
      });
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
      
      return updateCount;
    } catch (error) {
      console.error('Error updating user location references:', error);
      throw error;
    }
  }
  
  /**
   * Updates a user's location
   * @param {string} userId - User ID
   * @param {string} locationKey - Location key
   * @returns {Promise<void>}
   */
  static async setUserLocation(userId, locationKey) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Verify location exists
      const location = await this.getLocationByKey(locationKey);
      if (!location && locationKey) {
        throw new Error(`Location with key "${locationKey}" not found`);
      }
      
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userSnapshot.val();
      const now = new Date().toISOString();
      const locationDisplayName = location ? location.name : '';
      
      // Create updates
      const updates = {};
      
      // Update profile.locationKey
      updates[`users/${userId}/profile/locationKey`] = locationKey;
      
      // Update profile.location with display name
      updates[`users/${userId}/profile/location`] = locationDisplayName;
      
      // Update root-level location reference
      updates[`users/${userId}/location`] = locationKey;
      
      // Add to location history if it exists
      if (userData.locationHistory && Array.isArray(userData.locationHistory)) {
        const locationHistory = [...userData.locationHistory];
        locationHistory.unshift({
          locationKey,
          locationName: locationDisplayName,
          date: now,
          changedBy: 'system'
        });
        
        // Keep only the last 10 entries
        updates[`users/${userId}/locationHistory`] = locationHistory.slice(0, 10);
      } else {
        // Initialize location history
        updates[`users/${userId}/locationHistory`] = [{
          locationKey,
          locationName: locationDisplayName,
          date: now,
          changedBy: 'system'
        }];
      }
      
      // Apply updates
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error setting user location:', error);
      throw error;
    }
  }
  
  /**
   * Gets all active locations for UI components
   * @returns {Promise<Array>} - Array of location objects
   */
  static async getActiveLocationsForDropdown() {
    try {
      const locations = await this.getAllLocations('array');
      return locations
        .filter(loc => loc.active !== false)
        .map(loc => ({
          value: loc.key,
          label: loc.name,
          address: loc.address || ''
        }));
    } catch (error) {
      console.error('Error fetching locations for dropdown:', error);
      return [];
    }
  }
}

/**
 * React hook for location data
 * @param {string} format - Output format
 * @returns {Array} - [loading, locations, error]
 */
export const useLocations = (format = 'options') => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const data = await LocationManager.getAllLocations(format);
        setLocations(data);
        setError(null);
      } catch (err) {
        console.error('Error in useLocations hook:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLocations();
  }, [format]);
  
  return [loading, locations, error];
};

export default LocationManager;
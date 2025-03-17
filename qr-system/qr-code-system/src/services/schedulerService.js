// src/services/schedulerService.js
import { ref, get, set, push, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebaseConfig';
import { cacheService, CACHE_CONFIG } from './cacheService';

// Cache keys
const EVENTS_CACHE_KEY = 'cached_events';
const MANAGEABLE_USERS_CACHE_KEY = 'cached_manageable_users';

/**
 * Get all events for a user
 * @param {string} userId - The user ID
 * @param {boolean} includeManaged - Whether to include events for managed users
 * @returns {Promise<Array>} - Array of events
 */
export const getUserEvents = async (userId, includeManaged = false) => {
  try {
    // Check cache first
    const cachedEvents = await cacheService.get(EVENTS_CACHE_KEY + '_' + userId);
    if (cachedEvents) return cachedEvents;

    // Get basic user info
    const userRef = ref(database, `users/${userId}`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnapshot.val();
    const userRole = userData.profile?.role;
    
    let events = [];
    
    // Get direct events (events the user is assigned to)
    if (userData.schedule) {
      const eventIds = Object.keys(userData.schedule);
      
      // Get each event
      for (const eventId of eventIds) {
        const eventRef = ref(database, `events/${eventId}`);
        const eventSnapshot = await get(eventRef);
        
        if (eventSnapshot.exists()) {
          const eventData = eventSnapshot.val();
          events.push({
            id: eventId,
            ...eventData,
            start: new Date(eventData.start),
            end: new Date(eventData.end)
          });
        }
      }
    }
    
    // If user is admin or super_admin and includeManaged is true, get events for managed users
    if (includeManaged && (userRole === 'admin' || userRole === 'super_admin')) {
      // Get management structure
      const managementRef = ref(database, `managementStructure/${userId}`);
      const managementSnapshot = await get(managementRef);
      
      if (managementSnapshot.exists()) {
        const managementData = managementSnapshot.val();
        const managedLocations = Object.keys(managementData.managedLocations || {});
        
        if (managedLocations.length > 0) {
          // Get all events for these locations
          const eventsRef = ref(database, 'events');
          const eventsSnapshot = await get(eventsRef);
          
          if (eventsSnapshot.exists()) {
            const allEvents = eventsSnapshot.val();
            
            // Filter events by managed locations
            Object.entries(allEvents).forEach(([eventId, eventData]) => {
              // Skip events already added
              if (events.some(e => e.id === eventId)) return;
              
              // Add event if it's in a managed location
              if (eventData.location && managedLocations.includes(eventData.location)) {
                events.push({
                  id: eventId,
                  ...eventData,
                  start: new Date(eventData.start),
                  end: new Date(eventData.end)
                });
              }
            });
          }
        }
      }
    }
    
    // Sort events by start date
    events.sort((a, b) => a.start - b.start);
    
    // Cache the results
    await cacheService.set(
      EVENTS_CACHE_KEY + '_' + userId, 
      events, 
      CACHE_CONFIG.DYNAMIC.dashboard.expiry
    );
    
    return events;
  } catch (error) {
    console.error('Error fetching user events:', error);
    throw error;
  }
};

/**
 * Create a new event
 * @param {Object} eventData - The event data
 * @param {string} userId - The creator's user ID
 * @returns {Promise<string>} - The new event ID
 */
export const createEvent = async (eventData, userId) => {
  try {
    const eventsRef = ref(database, 'events');
    const newEventRef = push(eventsRef);
    
    // Format dates as ISO strings
    const formattedEvent = {
      ...eventData,
      start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
      end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };
    
    await set(newEventRef, formattedEvent);
    
    // Clear event cache
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
    
    return newEventRef.key;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

/**
 * Update an existing event
 * @param {string} eventId - The event ID
 * @param {Object} eventData - The updated event data
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export const updateEvent = async (eventId, eventData, userId) => {
  try {
    const eventRef = ref(database, `events/${eventId}`);
    
    // Format dates as ISO strings
    const formattedEvent = {
      ...eventData,
      start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
      end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    };
    
    await update(eventRef, formattedEvent);
    
    // Clear event cache
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

/**
 * Delete an event
 * @param {string} eventId - The event ID
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export const deleteEvent = async (eventId, userId) => {
  try {
    const eventRef = ref(database, `events/${eventId}`);
    
    // Get event data to find participants
    const eventSnapshot = await get(eventRef);
    if (eventSnapshot.exists()) {
      const eventData = eventSnapshot.val();
      
      // Remove event from participants' schedules
      if (eventData.participants) {
        const updates = {};
        
        Object.keys(eventData.participants).forEach(participantId => {
          updates[`users/${participantId}/schedule/${eventId}`] = null;
        });
        
        // Apply updates
        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
        }
      }
    }
    
    // Delete the event
    await remove(eventRef);
    
    // Clear event cache
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

/**
 * Assign participants to an event
 * @param {string} eventId - The event ID
 * @param {Array<string>} participantIds - Array of user IDs to assign
 * @param {string} userId - The user ID making the change
 * @returns {Promise<void>}
 */
export const assignEventParticipants = async (eventId, participantIds, userId) => {
  try {
    const updates = {};
    
    // 1. Add participants to event
    const participants = {};
    participantIds.forEach(id => {
      participants[id] = true;
    });
    
    updates[`events/${eventId}/participants`] = participants;
    updates[`events/${eventId}/updatedBy`] = userId;
    updates[`events/${eventId}/updatedAt`] = new Date().toISOString();
    
    // 2. Add event to each participant's schedule
    participantIds.forEach(id => {
      updates[`users/${id}/schedule/${eventId}`] = true;
    });
    
    // Apply updates
    await update(ref(database), updates);
    
    // Clear caches
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
    participantIds.forEach(async id => {
      await cacheService.remove(EVENTS_CACHE_KEY + '_' + id);
    });
  } catch (error) {
    console.error('Error assigning participants:', error);
    throw error;
  }
};

/**
 * Get users that an admin can manage based on location and department
 * @param {string} adminId - The admin's user ID
 * @returns {Promise<Array>} - Array of manageable users
 */
export const getManageableUsers = async (adminId) => {
  try {
    // Check cache first
    const cachedUsers = await cacheService.get(MANAGEABLE_USERS_CACHE_KEY + '_' + adminId);
    if (cachedUsers) return cachedUsers;
    
    // Get admin's management permissions
    const permissionsRef = ref(database, `managementStructure/${adminId}`);
    const permissionsSnapshot = await get(permissionsRef);
    
    if (!permissionsSnapshot.exists()) {
      return [];
    }
    
    const adminPermissions = permissionsSnapshot.val();
    
    // Get all users
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    
    if (!usersSnapshot.exists()) {
      return [];
    }
    
    const users = usersSnapshot.val();
    const manageableUsers = [];
    
    // Super admin can manage all users
    if (adminPermissions.role === 'super_admin') {
      Object.entries(users).forEach(([userId, userData]) => {
        if (userData.profile) {
          manageableUsers.push({
            id: userId,
            ...userData.profile,
            stats: userData.stats || {}
          });
        }
      });
    } else {
      // Regular admin - filter by managed locations and departments
      const managedLocations = adminPermissions.managedLocations || {};
      const managedDepartments = adminPermissions.managedDepartments || {};
      
      Object.entries(users).forEach(([userId, userData]) => {
        if (!userData.profile) return;
        
        const userLocation = userData.profile.primaryLocation;
        const userDepartment = userData.profile.department;
        
        // Skip users with no location
        if (!userLocation) return;
        
        // Check if admin manages this location
        const locationMatch = managedLocations[userLocation];
        if (!locationMatch) return;
        
        // If user has a department, check if admin manages it
        if (userDepartment && userDepartment.trim() !== '') {
          const departmentMatch = managedDepartments[userDepartment];
          if (!departmentMatch) return;
        }
        
        // Add user to manageable users
        manageableUsers.push({
          id: userId,
          ...userData.profile,
          stats: userData.stats || {}
        });
      });
    }
    
    // Cache the results
    await cacheService.set(
      MANAGEABLE_USERS_CACHE_KEY + '_' + adminId, 
      manageableUsers, 
      CACHE_CONFIG.STATIC.users.expiry
    );
    
    return manageableUsers;
  } catch (error) {
    console.error('Error getting manageable users:', error);
    return [];
  }
};

/**
 * Get locations that an admin can manage
 * @param {string} adminId - The admin's user ID
 * @returns {Promise<Array>} - Array of location names
 */
export const getManagedLocations = async (adminId) => {
  try {
    // Get admin's management permissions
    const permissionsRef = ref(database, `managementStructure/${adminId}`);
    const permissionsSnapshot = await get(permissionsRef);
    
    if (!permissionsSnapshot.exists()) {
      return [];
    }
    
    const adminPermissions = permissionsSnapshot.val();
    
    // Super admin can manage all locations
    if (adminPermissions.role === 'super_admin') {
      const locationsRef = ref(database, 'locations');
      const locationsSnapshot = await get(locationsRef);
      
      if (!locationsSnapshot.exists()) {
        return [];
      }
      
      return Object.keys(locationsSnapshot.val());
    }
    
    // Regular admin - return managed locations
    return Object.keys(adminPermissions.managedLocations || {});
  } catch (error) {
    console.error('Error getting managed locations:', error);
    return [];
  }
};

/**
 * Check if an admin can manage a specific user
 * @param {string} adminId - The admin's user ID
 * @param {string} userId - The user to check
 * @returns {Promise<boolean>} - Whether the admin can manage this user
 */
export const canManageUser = async (adminId, userId) => {
  try {
    // Get admin's management permissions
    const permissionsRef = ref(database, `managementStructure/${adminId}`);
    const permissionsSnapshot = await get(permissionsRef);
    
    if (!permissionsSnapshot.exists()) {
      return false;
    }
    
    const adminPermissions = permissionsSnapshot.val();
    
    // Super admin can manage all users
    if (adminPermissions.role === 'super_admin') {
      return true;
    }
    
    // Get user data
    const userRef = ref(database, `users/${userId}`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) {
      return false;
    }
    
    const userData = userSnapshot.val();
    
    // Check location and department permissions
    const userLocation = userData.profile?.primaryLocation;
    const userDepartment = userData.profile?.department;
    
    if (!userLocation || !adminPermissions.managedLocations?.[userLocation]) {
      return false;
    }
    
    // If user has a department, check if admin can manage it
    if (userDepartment && userDepartment.trim() !== '') {
      return !!adminPermissions.managedDepartments?.[userDepartment];
    }
    
    // User has no department or admin can manage it
    return true;
  } catch (error) {
    console.error('Error checking management permissions:', error);
    return false;
  }
};
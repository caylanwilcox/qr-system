// src/services/schedulerService.js - Updated with missing variables/exports
import { ref, get, set, push, update, remove } from 'firebase/database';
import { database } from './firebaseConfig';
import { cacheService, CACHE_CONFIG } from './cacheService';
import { eventBus, EVENTS } from './eventBus';
import { buildParticipantUpdates } from '../utils/eventParticipants';
import { normalizeRole, ROLES } from '../utils/roles';
import { canSeeManagedEvent } from '../utils/eventVisibility';

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
    const userRole = normalizeRole(userData.profile?.role);
    
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
            ...eventData,
            id: eventId, // the database key wins over any stored id
            start: new Date(eventData.start),
            end: new Date(eventData.end)
          });
        }
      }
    }
    
    // Admins also see the events they manage. Super admins see every event,
    // even with no management entry; '*' used to match nothing here, so a
    // super admin's calendar came up empty.
    if (includeManaged && (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN)) {
      let managedLocations = {};
      if (userRole === ROLES.ADMIN) {
        const managementSnapshot = await get(ref(database, `managementStructure/${userId}`));
        if (managementSnapshot.exists()) {
          managedLocations = managementSnapshot.val().managedLocations || {};
        }
      }

      const eventsSnapshot = await get(ref(database, 'events'));
      if (eventsSnapshot.exists()) {
        const alreadyAdded = new Set(events.map(e => e.id));
        Object.entries(eventsSnapshot.val()).forEach(([eventId, eventData]) => {
          if (alreadyAdded.has(eventId)) return;
          if (!canSeeManagedEvent(eventData, { role: userRole, managedLocations, userId })) return;
          events.push({
            ...eventData,
            id: eventId, // the database key wins over any stored id
            start: new Date(eventData.start),
            end: new Date(eventData.end)
          });
        });
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
    // The database key is the event's id. A stored copy (createEventObject
    // adds a made-up "event-<time>" one) overrode the key on read.
    delete formattedEvent.id;

    await set(newEventRef, formattedEvent);
    
    // Clear event cache
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
    
    // Emit event updated
    eventBus.emit(EVENTS.EVENT_UPDATED, {
      eventId: newEventRef.key,
      userId: userId,
      action: 'create'
    });
    
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
    // Never store the key inside the event; null also erases a stale copy
    // that older code saved.
    formattedEvent.id = null;

    await update(eventRef, formattedEvent);
    
    // Clear event cache
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
    
    // Emit event updated
    eventBus.emit(EVENTS.EVENT_UPDATED, {
      eventId: eventId,
      userId: userId,
      action: 'update'
    });
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
    
    // Emit event updated
    eventBus.emit(EVENTS.EVENT_UPDATED, {
      eventId: eventId,
      userId: userId,
      action: 'delete'
    });
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
    const eventSnapshot = await get(ref(database, `events/${eventId}`));
    if (!eventSnapshot.exists()) {
      throw new Error(`Event ${eventId} not found`);
    }
    const eventData = eventSnapshot.val();

    // Diff against the current participants so existing attendance survives.
    const { updates, added, removed } = buildParticipantUpdates({
      eventId,
      existing: eventData.participants,
      nextIds: participantIds,
      changedBy: userId,
      now: new Date().toISOString()
    });
    await update(ref(database), updates);
    
    // Clear caches
    await cacheService.remove(EVENTS_CACHE_KEY + '_' + userId);
    [...participantIds, ...removed].forEach(async id => {
      await cacheService.remove(EVENTS_CACHE_KEY + '_' + id);
    });
    
    // Emit event updated
    eventBus.emit(EVENTS.EVENT_UPDATED, {
      eventId: eventId,
      userId: userId,
      action: 'assign',
      participants: participantIds
    });
    
    // Email only the people just added; re-saving shouldn't re-notify everyone.
    if (added.length > 0) {
      // Dynamically import email service to avoid circular deps
      const { sendEventNotifications } = await import('./emailService');
      sendEventNotifications(eventData, added).catch((error) => {
        console.error('Error sending event notifications:', error);
      });
    }
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

// Export a service object for compatibility with the other implementation
export const schedulerService = {
  getUserEvents,
  getManagedLocations,
  createEvent,
  updateEvent,
  deleteEvent,
  assignEventParticipants,
  canManageUser,
  getManageableUsers
};
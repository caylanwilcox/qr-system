// src/services/attendanceService.js - Modified to use LocationManager
import { ref, get, set, update, query, orderByChild, equalTo } from 'firebase/database';
import { database } from './firebaseConfig';
import { eventBus, EVENTS } from './eventBus';
import { LocationManager } from '../utils/LocationManager';
import moment from 'moment-timezone';

/**
 * Enhanced Attendance Service
 * 
 * Handles attendance tracking, event marking, and data fetching with improved
 * event emission and caching. Integrated with LocationManager for consistent location handling.
 */
class AttendanceService {
  constructor() {
    this.cache = {};
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.DEBUG_PREFIX = '🔄 [AttendanceService]';
    this.timezone = 'America/Chicago'; // Use Chicago timezone for all timestamps
  }

  /**
   * Clear cache for a specific key or pattern
   * @param {string} keyPattern - Key or pattern to match
   */
  clearCache(keyPattern) {
    if (keyPattern) {
      // Clear specific keys matching the pattern
      Object.keys(this.cache).forEach(key => {
        if (key.includes(keyPattern)) {
          console.log(`${this.DEBUG_PREFIX} Clearing cache for key: ${key}`);
          delete this.cache[key];
        }
      });
    } else {
      // Clear all cache
      console.log(`${this.DEBUG_PREFIX} Clearing all cache`);
      this.cache = {};
    }
  }

  /**
   * Get cached data or fetch from database
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<any>} - Cached or fetched data
   */
  async getCachedData(key, fetchFunction, forceRefresh = false) {
    // Check if data is in cache and not expired
    const cached = this.cache[key];
    const now = Date.now();
    
    if (!forceRefresh && cached && cached.expiry > now) {
      console.log(`${this.DEBUG_PREFIX} Using cached data for ${key}`);
      return cached.data;
    }
    
    // Fetch fresh data
    console.log(`${this.DEBUG_PREFIX} Fetching fresh data for ${key}`);
    try {
      const data = await fetchFunction();
      
      // Cache the result with expiry
      this.cache[key] = {
        data,
        expiry: now + this.cacheExpiry
      };
      
      return data;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error fetching data for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a user by ID
   * @param {string} userId - User ID
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Object|null>} - User data
   */
  async fetchUser(userId, forceRefresh = false) {
    if (!userId) {
      console.error(`${this.DEBUG_PREFIX} fetchUser called without userId`);
      return null;
    }
    
    console.log(`${this.DEBUG_PREFIX} fetchUser: ${userId}, forceRefresh: ${forceRefresh}`);
    
    return this.getCachedData(
      `user_${userId}`,
      async () => {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
          console.warn(`${this.DEBUG_PREFIX} User ${userId} not found`);
          return null;
        }
        
        const userData = snapshot.val();
        // Add id to user data for convenience
        return { ...userData, id: userId };
      },
      forceRefresh
    );
  }

  /**
   * Record attendance for a user
   * @param {string} userId - User ID
   * @param {string} locationKey - Location key (from LocationManager)
   * @param {Object} eventData - Optional event data
   * @returns {Promise<Object>} - Result with success status
   */
  async recordAttendance(userId, locationKey, eventData = null) {
    console.log(`${this.DEBUG_PREFIX} Recording attendance for user ${userId} at location key ${locationKey}`);
    
    try {
      // FIXED: Get current date and time in Chicago timezone consistently
      const chicagoNow = moment().tz(this.timezone);
      const today = chicagoNow.format('YYYY-MM-DD');
      const now = chicagoNow.toDate(); // Convert to Date object for compatibility
      const timestamp = chicagoNow.valueOf(); // Use Chicago timezone timestamp
      
      console.log(`${this.DEBUG_PREFIX} Using Chicago timezone:`, {
        today,
        timestamp,
        chicagoTime: chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'),
        utcTime: new Date().toISOString()
      });
      
      // Get user data
      const user = await this.fetchUser(userId, true);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Get location data - using LocationManager
      let locationName = locationKey;
      let locationObj = null;
      
      try {
        locationObj = await LocationManager.getLocationByKey(locationKey);
        if (locationObj) {
          locationName = locationObj.name;
        }
      } catch (locError) {
        console.warn(`${this.DEBUG_PREFIX} Could not fetch location details: ${locError.message}`);
      }
      
      const name = user.profile?.name || 'Unknown';
      const position = user.profile?.position || 'Member';
      
      // Determine if the user is late (after 9:00 AM)
      const clockInHour = now.getHours();
      const clockInMinute = now.getMinutes();
      const isLate = clockInHour > 9 || (clockInHour === 9 && clockInMinute > 0);
      
      // Create attendance record
      const attendanceRecord = {
        userId,
        name,
        position,
        location: locationKey,
        locationName,
        clockInTime: now.toISOString(),
        clockInTimestamp: timestamp,
        isLate
      };
      
      // Add event data if provided
      if (eventData) {
        attendanceRecord.eventId = eventData.id;
        attendanceRecord.eventType = eventData.type;
        attendanceRecord.attended = true;
        attendanceRecord.attendedAt = now.toISOString();
      }
      
      // Write attendance record - use locationKey for consistent DB structure
      const attendanceRef = ref(database, `attendance/${locationKey}/${today}/${userId}`);
      await set(attendanceRef, attendanceRecord);
      
      // Update user stats
      const userRef = ref(database, `users/${userId}`);
      
      // Update user stats based on current stats
      const statsUpdate = {};
      
      // Increment days present
      statsUpdate['stats/daysPresent'] = (user.stats?.daysPresent || 0) + 1;
      
      // Update last clock in time
      statsUpdate['stats/lastClockIn'] = now.toISOString();
      
      // If late, increment days late
      if (isLate) {
        statsUpdate['stats/daysLate'] = (user.stats?.daysLate || 0) + 1;
      }
      
      // Set clockedIn status
      statsUpdate['clockedIn'] = true;
      
      // Add timestamp to clockInTimes object
      statsUpdate[`clockInTimes/${timestamp}`] = moment(now).format('hh:mm A');
      
      // Create attendance record in user's data
      statsUpdate[`attendance/${today}/clockedIn`] = true;
      statsUpdate[`attendance/${today}/clockInTime`] = moment(now).format('hh:mm A');
      statsUpdate[`attendance/${today}/isLate`] = isLate;
      
      // If there's event data, update user's events
      if (eventData) {
        const eventType = eventData.type.toLowerCase();
        statsUpdate[`events/${eventType}/${eventData.id}/attended`] = true;
        statsUpdate[`events/${eventType}/${eventData.id}/attendedAt`] = now.toISOString();
      }
      
      // Apply all updates to user
      await update(userRef, statsUpdate);
      
      // Clear cache for this user
      this.clearCache(`user_${userId}`);
      
      // Emit events - be generous with events to ensure UI updates
      console.log(`${this.DEBUG_PREFIX} Emitting events for attendance recorded`);
      
      // Emit attendance updated event
      eventBus.emit(EVENTS.ATTENDANCE_UPDATED, {
        userId,
        location: locationKey, 
        locationName,
        timestamp: now.toISOString(),
        type: 'clock-in',
        isLate,
        eventData: eventData
      });
      
      // Emit user data updated event
      eventBus.emit(EVENTS.USER_DATA_UPDATED, {
        userId,
        field: 'attendance',
        timestamp: now.toISOString()
      });
      
      // If an event was marked, emit event updated
      if (eventData) {
        eventBus.emit(EVENTS.EVENT_UPDATED, {
          userId,
          eventId: eventData.id,
          eventType: eventData.type,
          status: 'attended',
          timestamp: now.toISOString()
        });
      }
      
      // Also emit dashboard update for real-time dashboards
      eventBus.emit(EVENTS.DASHBOARD_DATA_UPDATED, {
        location: locationKey,
        timestamp: now.toISOString()
      });
      
      return {
        success: true,
        message: `Attendance recorded for ${name}`,
        data: {
          userId,
          name,
          clockInTime: now.toISOString(),
          isLate,
          location: locationKey,
          locationName
        }
      };
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error recording attendance:`, error);
      
      return {
        success: false,
        message: `Error recording attendance: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Record clock-out for a user
   * @param {string} userId - User ID
   * @param {string} locationKey - Location key
   * @returns {Promise<Object>} - Result with success status
   */
  async recordClockOut(userId, locationKey) {
    console.log(`${this.DEBUG_PREFIX} Recording clock-out for user ${userId} at location key ${locationKey}`);
    
    try {
      // FIXED: Get current date and time in Chicago timezone consistently
      const chicagoNow = moment().tz(this.timezone);
      const today = chicagoNow.format('YYYY-MM-DD');
      const now = chicagoNow.toDate(); // Convert to Date object for compatibility
      const timestamp = chicagoNow.valueOf(); // Use Chicago timezone timestamp
      
      console.log(`${this.DEBUG_PREFIX} Clock-out using Chicago timezone:`, {
        today,
        timestamp,
        chicagoTime: chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'),
        utcTime: new Date().toISOString()
      });
      
      // Get user data
      const user = await this.fetchUser(userId, true);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Get location details
      let locationName = locationKey;
      try {
        const locationObj = await LocationManager.getLocationByKey(locationKey);
        if (locationObj) {
          locationName = locationObj.name;
        }
      } catch (locError) {
        console.warn(`${this.DEBUG_PREFIX} Could not fetch location details: ${locError.message}`);
      }
      
      // Check if user is clocked in
      const clockedIn = user.clockedIn === true || 
                        (user.attendance && user.attendance[today] && user.attendance[today].clockedIn);
      
      if (!clockedIn) {
        throw new Error('User is not clocked in');
      }
      
      // Get clock-in time
      let clockInTime;
      let clockInTimestamp;
      
      if (user.attendance && user.attendance[today] && user.attendance[today].clockInTime) {
        // Use clock-in time from attendance record if available
        clockInTime = moment(user.attendance[today].clockInTime, 'hh:mm A').tz(this.timezone);
        
        // If the attendance record has a timestamp, use that
        if (user.attendance[today].clockInTimestamp) {
          clockInTimestamp = user.attendance[today].clockInTimestamp;
        } else {
          // Otherwise, calculate it from the time
          clockInTimestamp = clockInTime.valueOf();
        }
      } else if (user.stats && user.stats.lastClockIn) {
        // Use lastClockIn from stats if available
        clockInTime = moment(user.stats.lastClockIn).tz(this.timezone);
        clockInTimestamp = clockInTime.valueOf();
      } else {
        // If no clock-in time found, use the beginning of the day
        clockInTime = moment().tz(this.timezone).startOf('day').add(9, 'hours');
        clockInTimestamp = clockInTime.valueOf();
      }
      
      // Calculate hours worked
      const clockOutTime = moment(now).tz(this.timezone);
      const hoursWorked = clockOutTime.diff(clockInTime, 'hours', true);
      
      // Update attendance record
      const attendanceRef = ref(database, `attendance/${locationKey}/${today}/${userId}`);
      const attendanceSnapshot = await get(attendanceRef);
      
      if (attendanceSnapshot.exists()) {
        // Update existing record
        await update(attendanceRef, {
          clockOutTime: now.toISOString(),
          clockOutTimestamp: timestamp,
          hoursWorked
        });
      } else {
        // Create new record with both clock in and out times
        const name = user.profile?.name || 'Unknown';
        const position = user.profile?.position || 'Member';
        
        await set(attendanceRef, {
          userId,
          name,
          position,
          location: locationKey,
          locationName,
          clockInTime: clockInTime.toISOString(),
          clockInTimestamp,
          clockOutTime: now.toISOString(),
          clockOutTimestamp: timestamp,
          hoursWorked
        });
      }
      
      // Update user's record
      const userRef = ref(database, `users/${userId}`);
      
      const updates = {};
      
      // Set clockedIn status to false
      updates['clockedIn'] = false;
      
      // Update lastClockOut
      updates['stats/lastClockOut'] = now.toISOString();
      
      // Add hours worked to total
      updates['stats/totalHours'] = (user.stats?.totalHours || 0) + hoursWorked;
      
      // Add to clockOutTimes
      updates[`clockOutTimes/${timestamp}`] = moment(now).format('hh:mm A');
      
      // Update attendance record
      updates[`attendance/${today}/clockedIn`] = false;
      updates[`attendance/${today}/clockOutTime`] = moment(now).format('hh:mm A');
      updates[`attendance/${today}/hoursWorked`] = hoursWorked;
      
      // Apply updates
      await update(userRef, updates);
      
      // Clear cache
      this.clearCache(`user_${userId}`);
      
      // Emit events
      eventBus.emit(EVENTS.ATTENDANCE_UPDATED, {
        userId,
        location: locationKey,
        locationName,
        timestamp: now.toISOString(),
        type: 'clock-out',
        hoursWorked
      });
      
      eventBus.emit(EVENTS.USER_DATA_UPDATED, {
        userId,
        field: 'attendance',
        timestamp: now.toISOString()
      });
      
      eventBus.emit(EVENTS.DASHBOARD_DATA_UPDATED, {
        location: locationKey,
        timestamp: now.toISOString()
      });
      
      return {
        success: true,
        message: `Clock-out recorded for ${user.profile?.name || 'Unknown'}`,
        data: {
          userId,
          name: user.profile?.name || 'Unknown',
          position: user.profile?.position || 'Member',
          clockOutTime: now.toISOString(),
          hoursWorked
        }
      };
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error recording clock-out:`, error);
      
      return {
        success: false,
        message: `Error recording clock-out: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Mark event attendance for a user
   * @param {string} userId - User ID
   * @param {string} eventId - Event ID
   * @param {string} eventType - Event type
   * @param {string} locationKey - Location key
   * @returns {Promise<Object>} - Result with success status
   */
  async markEventAttendance(userId, eventId, eventType, locationKey) {
    console.log(`🔄 [AttendanceService] Marking event attendance for user ${userId}, event ${eventId} (${eventType}) at location ${locationKey}`);
    
    try {
      // FIXED: Get current date and time in Chicago timezone consistently
      const chicagoNow = moment().tz(this.timezone);
      const today = chicagoNow.format('YYYY-MM-DD');
      const now = chicagoNow.toDate(); // Convert to Date object for compatibility
      
      console.log(`🔄 [AttendanceService] Event attendance using Chicago timezone:`, {
        today,
        chicagoTime: chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'),
        utcTime: new Date().toISOString()
      });
      
      // Fetch fresh user data
      const user = await this.fetchUser(userId, true);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Normalize the event type into your DB structure
      let normalizedEventType = eventType
        .toLowerCase()
        .replace(/\s+/g, '');
      if (normalizedEventType.includes('junta') && normalizedEventType.includes('hacienda')) {
        normalizedEventType = 'juntahacienda';
      }
      
      console.log(`🔄 [AttendanceService] Normalized event type: ${normalizedEventType}`);
      
      // Build the user‐side update path
      const userRef = ref(database, `users/${userId}`);
      const eventUpdate = {};
      eventUpdate[`events/${normalizedEventType}/${eventId}/attended`]   = true;
      eventUpdate[`events/${normalizedEventType}/${eventId}/attendedAt`] = now.toISOString();
      
      // Build the global events collection path, including participants
      const eventRef = ref(
        database,
        `events/${normalizedEventType}/${eventId}/participants/${userId}`
      );
      const eventParticipantUpdate = {
        attended:   true,
        attendedAt: now.toISOString()
      };
      
      // 1) Ensure there's an attendance record today
      const attendanceRef = ref(database, `attendance/${locationKey}/${today}/${userId}`);
      const attendanceSnapshot = await get(attendanceRef);
      if (!attendanceSnapshot.exists()) {
        // If they haven't clocked in, record a clock‐in tied to this event
        await this.recordAttendance(userId, locationKey, {
          id:   eventId,
          type: normalizedEventType
        });
      } else {
        // Otherwise, just attach the event info
        await update(attendanceRef, {
          eventId,
          eventType: normalizedEventType,
          attended:  true,
          attendedAt: now.toISOString()
        });
      }
      
      // 2) Update the user's own profile under users/{userId}/events/…
      await update(userRef, eventUpdate);
      // 3) Update the global event's participants list
      await update(eventRef, eventParticipantUpdate);
      
      // 4) Clear cache so next fetch is fresh
      this.clearCache(`user_${userId}`);
      
      // 5) Emit real‐time events for UI/dashboards
      this.emitEventUpdated(userId, eventId, normalizedEventType, now);
      
      return {
        success: true,
        message: `Event attendance marked for ${user.profile?.name || 'Unknown'}`,
        data: {
          userId,
          eventId,
          eventType: normalizedEventType,
          attendedAt: now.toISOString()
        }
      };
    } catch (error) {
      console.error(`🔄 [AttendanceService] Error marking event attendance:`, error);
      return {
        success: false,
        message: `Error marking event attendance: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Emit events for event update
   * @private
   */
  emitEventUpdated(userId, eventId, eventType, timestamp) {
    if (typeof eventBus !== 'undefined' && typeof EVENTS !== 'undefined') {
      // Emit event updated event
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        userId,
        eventId,
        eventType,
        status: 'attended',
        timestamp: timestamp.toISOString()
      });
      
      // Also emit user data updated event for consistency
      eventBus.emit(EVENTS.USER_DATA_UPDATED, {
        userId,
        field: 'events',
        timestamp: timestamp.toISOString()
      });
      
      // Also emit attendance updated event
      eventBus.emit(EVENTS.ATTENDANCE_UPDATED, {
        userId,
        timestamp: timestamp.toISOString(),
        type: 'event-attendance',
        eventId,
        eventType
      });
    } else {
      console.log(`🔄 [AttendanceService] Event bus not available, skipping event emission`);
    }
  }

  /**
   * Get clocked-in users for a location and date
   * @param {string} locationKey - Location key
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} - Array of clocked-in users
   */
  async fetchClockedInUsers(locationKey, date = null, forceRefresh = false) {
    // Use current date if not provided
    const targetDate = date || moment().tz(this.timezone).format('YYYY-MM-DD');
    
    console.log(`${this.DEBUG_PREFIX} Fetching clocked-in users for ${locationKey} on ${targetDate}`);
    
    return this.getCachedData(
      `clockedIn_${locationKey}_${targetDate}`,
      async () => {
        let attendanceRef;
        
        if (locationKey.toLowerCase() === 'all') {
          // Fetch from all locations
          attendanceRef = ref(database, 'attendance');
        } else {
          // Fetch from specific location
          attendanceRef = ref(database, `attendance/${locationKey}/${targetDate}`);
        }
        
        const snapshot = await get(attendanceRef);
        
        if (!snapshot.exists()) {
          return [];
        }
        
        const attendanceData = snapshot.val();
        
        // Handle different data structures depending on if it's all locations or specific
        if (locationKey.toLowerCase() === 'all') {
          // Process all locations
          const allUsers = [];
          
          // Loop through each location
          Object.entries(attendanceData).forEach(([loc, dates]) => {
            // Check if this date exists in the location
            if (dates[targetDate]) {
              // Add users from this location
              Object.values(dates[targetDate]).forEach(user => {
                allUsers.push({
                  ...user,
                  location: loc
                });
              });
            }
          });
          
          return allUsers;
        } else {
          // Process single location
          return Object.values(attendanceData);
        }
      },
      forceRefresh
    );
  }
  
  /**
   * Fetch scheduled events for a location and event type
   * @param {string} locationKey - Location key
   * @param {string} eventType - Event type
   * @returns {Promise<Array>} - Array of scheduled events
   */
  async fetchScheduledEvents(locationKey, eventType = '') {
    console.log(`${this.DEBUG_PREFIX} Fetching scheduled events for ${locationKey}, type: ${eventType}`);
    
    try {
      const today = moment().tz(this.timezone).format('YYYY-MM-DD');
      let eventsRef;
      
      // Get location display name if needed
      let locationName = locationKey;
      try {
        const locationObj = await LocationManager.getLocationByKey(locationKey);
        if (locationObj) {
          locationName = locationObj.name;
        }
      } catch (error) {
        console.warn(`${this.DEBUG_PREFIX} Could not fetch location name: ${error.message}`);
      }
      
      // Query based on location and event type
      if (locationKey && eventType) {
        // Specific location and event type
        eventsRef = query(
          ref(database, 'events'),
          orderByChild('location'),
          equalTo(locationName)
        );
      } else if (locationKey) {
        // Only location specified
        eventsRef = query(
          ref(database, 'events'),
          orderByChild('location'),
          equalTo(locationName)
        );
      } else {
        // No filters
        eventsRef = ref(database, 'events');
      }
      
      const snapshot = await get(eventsRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const eventsData = snapshot.val();
      
      // Filter to only include events scheduled for today
      const todayEvents = Object.entries(eventsData)
        .map(([id, event]) => ({ id, ...event }))
        .filter(event => {
          // Check if event is today
          const isToday = event.start && moment(event.start).tz(this.timezone).isSame(today, 'day');
          
          // Also match event type if specified
          const matchesType = !eventType || 
                              event.eventType === eventType || 
                              event.category === eventType;
                             
          // Check location if available - support both location key and name
          const matchesLocation = !locationKey || 
                                  event.location === locationName || 
                                  event.location === 'All Locations';
                                 
          return isToday && matchesType && matchesLocation;
        });
      
      console.log(`${this.DEBUG_PREFIX} Found ${todayEvents.length} events scheduled for today`);
      
      return todayEvents;
    } catch (error) {
      console.error(`${this.DEBUG_PREFIX} Error fetching scheduled events:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const attendanceService = new AttendanceService();

export default attendanceService;
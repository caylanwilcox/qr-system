// src/services/clockInService.js
import { ref, get, update, serverTimestamp } from "firebase/database";
import { database } from './firebaseConfig';

/**
 * Clock in service to handle employee clock-ins and update attendance for scheduled events
 */
export const clockInService = {
  /**
   * Handle employee clock-in and update their attendance for scheduled events
   * @param {string} userId - The user/employee ID
   * @param {string} locationId - The location where the employee is clocking in
   * @returns {Promise<object>} - Result of the clock-in operation
   */
  async clockIn(userId, locationId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Get the current timestamp
      const now = new Date();
      const timestamp = now.toISOString();
      
      // Update user's clock-in status
      const clockInData = {
        locationId,
        timestamp,
        type: 'in'
      };
      
      // Reference to the user's data
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userSnapshot.val();
      
      // Prepare updates object
      const updates = {};
      
      // Add clock-in record to user's activity log
      const clockInRef = ref(database, `users/${userId}/activityLog/clockIns`);
      updates[`users/${userId}/activityLog/clockIns/${now.getTime()}`] = clockInData;
      
      // Update user's last clock in time
      updates[`users/${userId}/stats/lastClockIn`] = timestamp;
      
      // Check for scheduled events that this clock-in should mark as attended
      // Process each event type (workshops, meetings, haciendas, juntaHacienda)
      const eventTypes = ['workshops', 'meetings', 'haciendas', 'juntaHacienda', 'gestion'];
      let eventsUpdated = false;
      
      // Function to check if a date is today
      const isToday = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
      };
      
      // Check each event type for scheduled events today
      for (const eventType of eventTypes) {
        // Skip if user doesn't have events of this type
        if (!userData.events || !userData.events[eventType]) continue;
        
        // Get all events of this type for the user
        const eventsOfType = userData.events[eventType];
        
        // Loop through each event
        for (const [eventId, eventData] of Object.entries(eventsOfType)) {
          // Only process events that are scheduled for today and not yet marked as attended
          if (eventData.scheduled && !eventData.attended && isToday(eventData.date)) {
            // Mark this event as attended
            updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = true;
            // Add timestamp of attendance
            updates[`users/${userId}/events/${eventType}/${eventId}/attendedAt`] = timestamp;
            eventsUpdated = true;
          }
        }
      }
      
      // Increment days present if this is the first clock-in today
      const lastClockInDate = userData.stats?.lastClockIn 
        ? new Date(userData.stats.lastClockIn) 
        : null;
        
      // Only count as a new day if last clock-in wasn't today
      if (!lastClockInDate || !isToday(lastClockInDate)) {
        // Increment days present counter
        const daysPresent = (userData.stats?.daysPresent || 0) + 1;
        updates[`users/${userId}/stats/daysPresent`] = daysPresent;
        
        // Check if late (after 9:00 AM)
        const isLate = now.getHours() >= 9 && now.getMinutes() > 0;
        
        if (isLate) {
          // Increment days late counter
          const daysLate = (userData.stats?.daysLate || 0) + 1;
          updates[`users/${userId}/stats/daysLate`] = daysLate;
          updates[`users/${userId}/activityLog/clockIns/${now.getTime()}/isLate`] = true;
        }
      }
      
      // Add to location history if location changed
      const currentLocation = userData.locationHistory && userData.locationHistory.length > 0
        ? userData.locationHistory[0]
        : null;
      
      if (!currentLocation || currentLocation.locationId !== locationId) {
        updates[`users/${userId}/locationHistory/0`] = {
          locationId,
          date: timestamp
        };
      }
      
      // Update database with all changes
      await update(ref(database), updates);
      
      return {
        success: true,
        message: 'Clock-in successful',
        eventsUpdated: eventsUpdated,
        timestamp: timestamp
      };
    } catch (error) {
      console.error('Error during clock-in:', error);
      return {
        success: false,
        message: error.message || 'Failed to clock in',
        error: error.toString()
      };
    }
  },
  
  /**
   * Handle employee clock-out
   * @param {string} userId - The user/employee ID
   * @returns {Promise<object>} - Result of the clock-out operation
   */
  async clockOut(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Get the current timestamp
      const now = new Date();
      const timestamp = now.toISOString();
      
      // Get user's last clock-in data
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userSnapshot.val();
      
      // Check if user has clocked in
      if (!userData.stats?.lastClockIn) {
        throw new Error('You must clock in before clocking out');
      }
      
      // Calculate hours worked during this session
      const lastClockIn = new Date(userData.stats.lastClockIn);
      const hoursWorked = (now - lastClockIn) / (1000 * 60 * 60); // Convert ms to hours
      
      // Prepare updates
      const updates = {};
      
      // Update total hours
      const totalHours = (userData.stats?.totalHours || 0) + hoursWorked;
      updates[`users/${userId}/stats/totalHours`] = totalHours;
      
      // Update last clock out
      updates[`users/${userId}/stats/lastClockOut`] = timestamp;
      
      // Add clock-out record
      updates[`users/${userId}/activityLog/clockOuts/${now.getTime()}`] = {
        timestamp,
        hoursWorked
      };
      
      // Update database
      await update(ref(database), updates);
      
      return {
        success: true,
        message: 'Clock-out successful',
        hoursWorked,
        timestamp
      };
    } catch (error) {
      console.error('Error during clock-out:', error);
      return {
        success: false,
        message: error.message || 'Failed to clock out',
        error: error.toString()
      };
    }
  },
  
  /**
   * Mark a user as absent for a scheduled event
   * @param {string} userId - The user/employee ID
   * @param {string} eventType - The type of event (workshops, meetings, etc.)
   * @param {string} eventId - The event ID
   * @returns {Promise<object>} - Result of the operation
   */
  async markAbsent(userId, eventType, eventId) {
    try {
      if (!userId || !eventType || !eventId) {
        throw new Error('User ID, event type, and event ID are required');
      }
      
      // Check if event exists for this user
      const eventRef = ref(database, `users/${userId}/events/${eventType}/${eventId}`);
      const eventSnapshot = await get(eventRef);
      
      if (!eventSnapshot.exists()) {
        throw new Error('Event not found for this user');
      }
      
      // Mark as absent (explicitly false)
      const updates = {};
      updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = false;
      updates[`users/${userId}/events/${eventType}/${eventId}/markedAbsent`] = true;
      updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedAt`] = new Date().toISOString();
      
      // Update database
      await update(ref(database), updates);
      
      return {
        success: true,
        message: 'User marked as absent for the event'
      };
    } catch (error) {
      console.error('Error marking user as absent:', error);
      return {
        success: false,
        message: error.message || 'Failed to mark user as absent',
        error: error.toString()
      };
    }
  },
  
  /**
   * Process scheduled events at the end of the day to mark absent users
   * Should be run by an admin or a scheduled cloud function
   * @returns {Promise<object>} - Result of the operation
   */
  async processEndOfDayAttendance() {
    try {
      // Get today's date
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get all users
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        return { success: true, message: 'No users found' };
      }
      
      const users = usersSnapshot.val();
      const updates = {};
      
      // Process each user
      for (const [userId, userData] of Object.entries(users)) {
        // Skip if user has no events
        if (!userData.events) continue;
        
        // Get event types for this user
        const eventTypes = Object.keys(userData.events);
        
        // Process each event type
        for (const eventType of eventTypes) {
          // Skip if user has no events of this type
          if (!userData.events[eventType]) continue;
          
          // Get all events of this type
          const events = userData.events[eventType];
          
          // Process each event
          for (const [eventId, eventData] of Object.entries(events)) {
            // Skip if not scheduled or already marked
            if (!eventData.scheduled || eventData.attended === true || eventData.markedAbsent === true) continue;
            
            // Check if event was for today but earlier
            const eventDate = new Date(eventData.date);
            const isEventToday = eventDate.toISOString().split('T')[0] === todayStr;
            const isPastEvent = eventDate < today;
            
            if (isEventToday && isPastEvent) {
              // Mark as absent (explicitly false) since event passed without attendance
              updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = false;
              updates[`users/${userId}/events/${eventType}/${eventId}/markedAbsent`] = true;
              updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedAt`] = today.toISOString();
            }
          }
        }
      }
      
      // Apply all updates if any
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
      
      return {
        success: true,
        message: 'End of day attendance processed',
        updatesCount: Object.keys(updates).length
      };
    } catch (error) {
      console.error('Error processing end of day attendance:', error);
      return {
        success: false,
        message: error.message || 'Failed to process attendance',
        error: error.toString()
      };
    }
  }
};

export default clockInService;
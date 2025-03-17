// src/components/Scheduler/context/hooks/useEventHandlers.js
import { ref, push, update, remove, get, set } from 'firebase/database';
import { database } from '../../../../services/firebaseConfig';

/**
 * Custom hook for event-related operations in the Scheduler
 * @param {Object} authState - Authentication state containing current user info
 * @param {Object} eventState - Event state containing events and setter functions
 * @param {Object} uiState - UI state for dialogs and error handling
 * @returns {Object} Event handling functions
 */
export const useEventHandlers = (authState, eventState, uiState) => {
  const { currentUser } = authState;
  const { events, setEvents, selectedEvent, setSelectedEvent } = eventState;
  const { setShowEventDialog, setShowAssignmentDialog, setError } = uiState;
  
  /**
   * Add an event directly to the current user's schedule
   * @param {string} eventId - ID of the event to add
   * @returns {Promise<boolean>} Success status
   */
  const addToCurrentUserSchedule = async (eventId) => {
    if (!currentUser?.uid || !eventId) return false;
    
    try {
      console.log(`Adding event ${eventId} directly to current user's schedule`);
      
      // Update the user's schedule with this event
      const userScheduleRef = ref(database, `users/${currentUser.uid}/schedule/${eventId}`);
      await set(userScheduleRef, true);
      
      // Also add the current user to the event's participants
      const eventParticipantsRef = ref(database, `events/${eventId}/participants/${currentUser.uid}`);
      await set(eventParticipantsRef, true);
      
      console.log(`Successfully added event ${eventId} to user's schedule`);
      return true;
    } catch (error) {
      console.error(`Failed to add event to user's schedule:`, error);
      return false;
    }
  };
  
  /**
   * Ensures a user has a schedule node in the database
   * @param {string} userId - User ID to check/create schedule node for
   * @returns {Promise<boolean>} True if created, false if already existed
   */
  const ensureUserScheduleNode = async (userId) => {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }
      
      console.log(`Checking schedule node for user ${userId}`);
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        console.error(`User ${userId} not found in database`);
        return false;
      }
      
      const userData = userSnapshot.val();
      
      // Check if schedule node exists
      if (!userData.schedule) {
        console.log(`Creating schedule node for user ${userId}`);
        // Create an empty schedule node
        await set(ref(database, `users/${userId}/schedule`), {});
        return true; // Created new schedule node
      }
      
      console.log(`User ${userId} already has a schedule node`);
      return false; // Schedule node already existed
    } catch (error) {
      console.error(`Error in ensureUserScheduleNode for ${userId}:`, error);
      throw error;
    }
  };

  /**
   * Creates a new event in the database
   * @param {Object} eventData - Event data to be created
   * @returns {Promise<string>} Created event ID
   */
  const handleCreateEvent = async (eventData) => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to create events");
      }
      
      console.log("Creating new event:", eventData);
      
      // Format dates for Firebase storage
      const formattedEvent = {
        ...eventData,
        start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
        end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
      };
      
      // Create event in Firebase
      const eventsRef = ref(database, 'events');
      const newEventRef = await push(eventsRef, formattedEvent);
      const eventId = newEventRef.key;
      
      console.log("Event created with ID:", eventId);
      
      // Immediately add it to the current user's schedule
      await addToCurrentUserSchedule(eventId);
      
      // Add to local state with proper date objects
      const localEvent = {
        ...formattedEvent,
        id: eventId,
        title: formattedEvent.title || "Untitled Event",
        start: new Date(formattedEvent.start),
        end: new Date(formattedEvent.end),
        participants: { [currentUser.uid]: true } // Add creator as participant
      };
      
      setEvents(prevEvents => [...prevEvents, localEvent]);
      setShowEventDialog(false);
      
      // Schedule the assignment dialog to open
      setTimeout(() => {
        setSelectedEvent(localEvent);
        setShowAssignmentDialog(true);
      }, 300);
      
      return eventId;
    } catch (error) {
      console.error("Error creating event:", error);
      setError(`Failed to create event: ${error.message}`);
      throw error;
    }
  };

  /**
   * Updates an existing event
   * @param {string} eventId - ID of the event to update
   * @param {Object} eventData - Updated event data
   * @returns {Promise<string>} Updated event ID
   */
  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to update events");
      }
      
      if (!eventId) {
        throw new Error("Event ID is required for updates");
      }
      
      console.log(`Updating event ${eventId}:`, eventData);
      
      // First, get existing event to preserve any fields not in eventData
      const eventRef = ref(database, `events/${eventId}`);
      const eventSnapshot = await get(eventRef);
      
      if (!eventSnapshot.exists()) {
        throw new Error(`Event ${eventId} not found in database`);
      }
      
      const existingEvent = eventSnapshot.val();
      
      // Format dates for Firebase storage
      const formattedEvent = {
        // Start with existing event data to preserve fields
        ...existingEvent,
        // Then add updated fields
        ...eventData,
        // Ensure dates are formatted correctly
        start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
        end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
        // Add metadata
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid,
      };
      
      // Log the formatted event for debugging
      console.log(`Formatted event for database:`, {
        id: eventId,
        title: formattedEvent.title,
        start: formattedEvent.start,
        end: formattedEvent.end
      });
      
      // Update in Firebase
      await update(eventRef, formattedEvent);
      console.log(`Event ${eventId} updated successfully in Firebase`);
      
      // Make sure it's in the current user's schedule
      await addToCurrentUserSchedule(eventId);
      
      // Update in local state with proper date objects
      const localEvent = {
        ...formattedEvent,
        id: eventId,
        start: new Date(formattedEvent.start),
        end: new Date(formattedEvent.end),
        title: formattedEvent.title || "Untitled Event"
      };
      
      // Log the local event for debugging
      console.log(`Formatted event for local state:`, {
        id: localEvent.id,
        title: localEvent.title,
        start: localEvent.start,
        end: localEvent.end
      });
      
      // Update the events array by replacing the updated event
      setEvents(prevEvents => {
        // First check if the event exists in the array
        const eventExists = prevEvents.some(e => e.id === eventId);
        
        if (eventExists) {
          console.log(`Event ${eventId} found in local state, updating it`);
          // Replace the event
          return prevEvents.map(event => 
            event.id === eventId ? localEvent : event
          );
        } else {
          // Add the event if it doesn't exist
          console.log(`Event ${eventId} not found in local state, adding it`);
          return [...prevEvents, localEvent];
        }
      });
      
      setShowEventDialog(false);
      
      // Keep a reference to the event even after closing the dialog
      const updatedSelectedEvent = selectedEvent?.id === eventId 
        ? { ...localEvent }
        : null;
      
      setSelectedEvent(updatedSelectedEvent);
      
      return eventId;
    } catch (error) {
      console.error(`Error updating event ${eventId}:`, error);
      setError(`Failed to update event: ${error.message}`);
      throw error;
    }
  };

  /**
   * Deletes an event and removes it from all participants' schedules
   * @param {string} eventId - ID of the event to delete
   * @returns {Promise<boolean>} Success status
   */
  const handleDeleteEvent = async (eventId) => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to delete events");
      }
      
      if (!eventId) {
        throw new Error("Event ID is required for deletion");
      }
      
      console.log(`Deleting event ${eventId}`);
      
      // First, remove event from participants' schedules
      const eventRef = ref(database, `events/${eventId}`);
      const eventSnapshot = await get(eventRef);
      
      const batchUpdates = {};
      
      if (eventSnapshot.exists()) {
        const eventData = eventSnapshot.val();
        const participants = eventData.participants || {};
        
        // Prepare updates to remove event from all participants' schedules
        Object.keys(participants).forEach(userId => {
          batchUpdates[`users/${userId}/schedule/${eventId}`] = null;
        });
      }
      
      // Delete the event itself
      batchUpdates[`events/${eventId}`] = null;
      
      // Execute all updates in a single batch
      await update(ref(database), batchUpdates);
      console.log("Event deleted successfully");
      
      // Update local state by removing the event
      setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
      
      setShowEventDialog(false);
      
      // Clear selected event if it's the one being deleted
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting event ${eventId}:`, error);
      setError(`Failed to delete event: ${error.message}`);
      return false;
    }
  };

  /**
   * Gets users by location
   * @param {string} location - Location name to filter by
   * @returns {Promise<Array>} Array of user objects
   */
  const getUsersByLocation = async (location) => {
    try {
      if (!location) {
        return [];
      }
      
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const usersData = snapshot.val();
      const locationLower = location.toLowerCase().trim();
      
      // Filter users by location (case-insensitive)
      return Object.entries(usersData)
        .filter(([_, userData]) => {
          const userLocation = (userData.profile?.primaryLocation || userData.profile?.location || '').toLowerCase().trim();
          return userLocation === locationLower;
        })
        .map(([id, userData]) => ({
          id,
          name: userData.profile?.name || 'Unknown',
          ...userData.profile
        }));
    } catch (error) {
      console.error(`Error fetching users for location ${location}:`, error);
      return [];
    }
  };

  /**
   * Assigns participants to an event
   * @param {string} eventId - ID of the event
   * @param {Array<string>} participantIds - Array of user IDs to assign
   * @param {boolean} assignToAllInLocation - Whether to assign to all users in the event's location
   * @returns {Promise<boolean>} Success status
   */
  const handleAssignParticipants = async (eventId, participantIds, assignToAllInLocation = false) => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to assign participants");
      }
      
      if (!eventId) {
        throw new Error("Event ID is required for participant assignment");
      }
      
      console.log(`Assigning participants to event ${eventId}:`, participantIds);
      console.log("Assign to all in location:", assignToAllInLocation);
      
      // First verify the event exists
      const eventRef = ref(database, `events/${eventId}`);
      const eventSnapshot = await get(eventRef);
      
      if (!eventSnapshot.exists()) {
        throw new Error(`Event ${eventId} not found in database`);
      }
      
      // Store current event for reference
      const eventData = eventSnapshot.val();
      const currentEvent = events.find(e => e.id === eventId) || {
        ...eventData,
        id: eventId,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
        title: eventData.title || "Untitled Event"
      };
      
      // Get event data for location (if needed)
      let finalParticipantIds = [...participantIds];
      
      // Add all users from location if requested
      if (assignToAllInLocation && eventData.location) {
        console.log(`Finding users in location: ${eventData.location}`);
        
        const usersFromLocation = await getUsersByLocation(eventData.location);
        const locationUserIds = usersFromLocation.map(user => user.id);
        
        // Combine with selected users, removing duplicates
        finalParticipantIds = [...new Set([...participantIds, ...locationUserIds])];
        
        console.log(`Found ${locationUserIds.length} users in location ${eventData.location}`);
        console.log(`Final participant list now has ${finalParticipantIds.length} users`);
      }
      
      // Always include the current user as a participant
      if (!finalParticipantIds.includes(currentUser.uid)) {
        finalParticipantIds.push(currentUser.uid);
      }
      
      // If no participants, just add the current user
      if (finalParticipantIds.length === 0) {
        finalParticipantIds = [currentUser.uid];
        console.log("No participants selected, adding only the current user");
      }
      
      // Create participants object
      const participantsObj = {};
      finalParticipantIds.forEach(userId => {
        participantsObj[userId] = true;
      });
      
      // Create batch updates object
      const batchUpdates = {};
      
      // Add participants to event
      batchUpdates[`events/${eventId}/participants`] = participantsObj;
      batchUpdates[`events/${eventId}/updatedAt`] = new Date().toISOString();
      batchUpdates[`events/${eventId}/lastAssignedBy`] = currentUser.uid;
      
      // Process each participant
      for (const userId of finalParticipantIds) {
        // First ensure user has a schedule node
        await ensureUserScheduleNode(userId);
        
        // Add event to user's schedule
        batchUpdates[`users/${userId}/schedule/${eventId}`] = true;
      }
      
      // Apply all updates in one batch
      await update(ref(database), batchUpdates);
      console.log("Participant assignments completed successfully");
      
      // Update local state with the event and participants
      setEvents(prevEvents => {
        // First check if the event exists in the state
        const eventExists = prevEvents.some(e => e.id === eventId);
        
        if (eventExists) {
          // Update the event with participants
          return prevEvents.map(event => 
            event.id === eventId 
              ? { ...event, participants: participantsObj }
              : event
          );
        } else {
          // Add the event if it doesn't exist
          return [...prevEvents, { ...currentEvent, participants: participantsObj }];
        }
      });
      
      // Keep this as the selected event
      setSelectedEvent(prev => {
        if (prev && prev.id === eventId) {
          return { ...prev, participants: participantsObj };
        }
        return prev;
      });
      
      setShowAssignmentDialog(false);
      return true;
    } catch (error) {
      console.error(`Error assigning participants to event ${eventId}:`, error);
      setError(`Failed to assign participants: ${error.message}`);
      return false;
    }
  };

  /**
   * Assigns an event to all users in a specific location
   * @param {string} eventId - ID of the event
   * @param {string} locationName - Name of the location
   * @returns {Promise<boolean>} Success status
   */
  const assignToLocation = async (eventId, locationName) => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to assign events to locations");
      }
      
      if (!eventId || !locationName) {
        throw new Error("Event ID and location name are required");
      }
      
      console.log(`Assigning event ${eventId} to all users in location ${locationName}`);
      
      // Get users by location
      const usersInLocation = await getUsersByLocation(locationName);
      
      if (usersInLocation.length === 0) {
        setError(`No users found in location ${locationName}`);
        return false;
      }
      
      console.log(`Found ${usersInLocation.length} users in location ${locationName}`);
      
      // Set location metadata on the event
      await update(ref(database, `events/${eventId}`), {
        assignedToLocation: locationName,
        assignedToLocationAt: new Date().toISOString(),
        updatedBy: currentUser.uid,
        updatedAt: new Date().toISOString()
      });
      
      // Assign event to all users in the location
      const userIds = usersInLocation.map(user => user.id);
      const result = await handleAssignParticipants(eventId, userIds);
      
      return result;
    } catch (error) {
      console.error(`Error assigning event ${eventId} to location ${locationName}:`, error);
      setError(`Failed to assign to location: ${error.message}`);
      return false;
    }
  };

  /**
   * Repairs schedule nodes for all users
   * @returns {Promise<Object>} Results of the repair operation
   */
  const repairAllScheduleNodes = async () => {
    try {
      if (!currentUser?.uid) {
        throw new Error("You must be logged in to repair schedule nodes");
      }
      
      console.log("Starting repair of all user schedule nodes");
      
      // Get all users
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return { success: false, message: "No users found in database" };
      }
      
      const userIds = Object.keys(snapshot.val());
      const results = {
        checked: userIds.length,
        created: 0,
        errors: []
      };
      
      // Process each user
      for (const userId of userIds) {
        try {
          const created = await ensureUserScheduleNode(userId);
          if (created) {
            results.created++;
          }
        } catch (error) {
          console.error(`Error creating schedule node for user ${userId}:`, error);
          results.errors.push({ userId, error: error.message });
        }
      }
      
      return {
        success: true,
        message: `Repaired ${results.created} of ${results.checked} users`,
        ...results
      };
    } catch (error) {
      console.error("Error repairing schedule nodes:", error);
      return {
        success: false,
        message: `Repair failed: ${error.message}`
      };
    }
  };

  return {
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleAssignParticipants,
    assignToLocation,
    ensureUserScheduleNode,
    repairAllScheduleNodes,
    addToCurrentUserSchedule
  };
};

export default useEventHandlers;
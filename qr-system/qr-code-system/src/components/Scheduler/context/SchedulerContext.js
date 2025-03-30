// src/components/Scheduler/context/SchedulerContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from '../../../services/firebaseConfig';
import { useAuth } from '../../../services/authContext';
import moment from 'moment-timezone';

// Import the updated utility functions
import { 
  EVENT_TYPES, 
  EVENT_TYPE_DISPLAY_NAMES, 
  normalizeEventType,
  getChicagoTime,
  createEventObject,
  EVENT_TYPE_TO_CATEGORY_MAP,
  LOCATIONS
} from '../../../utils/eventUtils';

// Create the context
const SchedulerContext = createContext(null);

// Custom hook to use the scheduler context
export const useSchedulerContext = () => {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useSchedulerContext must be used within a SchedulerProvider');
  }
  return context;
};

// Provider component
export const SchedulerProvider = ({ children }) => {
  // Get auth data
  const auth = useAuth();
  const user = auth?.user;
  const userProfile = user?.profile;
  const adminPermissions = user?.managementPermissions;
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  
  // Data State
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // Use standardized locations list with All Locations option
  const [locations] = useState(['All Locations', ...LOCATIONS]);

  // Define canManageLocation as a regular function declaration that gets hoisted
  // IMPORTANT: This must be defined before use in useEffect
  function canManageLocation(locationName) {
    if (!locationName || !userProfile) return false;
    
    // "All Locations" is handled specially - accessible to super admins only by default
    if (locationName === "All Locations") {
      return userProfile.role === 'super_admin';
    }
    
    // Super admins can manage all locations
    if (userProfile.role === 'super_admin') return true;
    
    // Check if admin can manage this location
    if (userProfile.role === 'admin' && adminPermissions) {
      return adminPermissions.managedLocations?.[locationName] === true;
    }
    
    // Regular employees can't manage locations
    return false;
  }

  // Firebase Event Handlers
  const handleCreateEvent = async (eventData) => {
    try {
      console.log("Creating event with data:", eventData);
      
      const eventsRef = ref(database, 'events');
      
      // Use utility to create standardized event object
      const newEvent = createEventObject({
        ...eventData,
        createdBy: user?.uid || null
      });
      
      console.log("Saving event to Firebase:", newEvent);
      
      const newEventRef = await push(eventsRef, newEvent);
      const eventId = newEventRef.key;
      console.log("Event created with ID:", eventId);
      
      // Close the event creation dialog
      setShowEventDialog(false);
      
      // Create event object in the same format as the events in your state
      const createdEvent = {
        ...newEvent,
        id: eventId,
        start: new Date(newEvent.start),
        end: new Date(newEvent.end),
        title: newEvent.title || "Untitled Event",
      };
      
      // Add the event to local state directly
      setEvents(prev => [...prev, createdEvent]);
      
      // Directly set the event and open the dialog in one operation
      setTimeout(() => {
        console.log("Opening assignment dialog for event:", eventId);
        setSelectedEvent(createdEvent);
        setShowAssignmentDialog(true);
      }, 200);
      
      return eventId;
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Failed to create event. Please try again.');
      throw error;
    }
  };
  
  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      console.log(`Starting update process for event ID: ${eventId}`);
      const eventRef = ref(database, `events/${eventId}`);
      
      // Get the current event to check for event type changes
      const currentEventSnapshot = await get(eventRef);
      
      if (!currentEventSnapshot.exists()) {
        throw new Error(`Event ${eventId} not found for update`);
      }
      
      const currentEvent = currentEventSnapshot.val();
      console.log(`Current event data:`, currentEvent);
      
      // Use standardized event object utility but preserve participants
      const participants = currentEvent.participants || {};
      const updatedEvent = createEventObject({
        ...eventData,
        updatedBy: user?.uid || null,
        updatedAt: getChicagoTime().toISOString()
      });
      updatedEvent.participants = participants;
      
      console.log(`Prepared updated event data`);
      
      // Check if event type has changed
      const previousType = currentEvent.eventType;
      const newType = updatedEvent.eventType;
      const typeChanged = previousType !== newType;
      console.log(`Event type changed: ${typeChanged} (${previousType} → ${newType})`);
      
      // First, update the main event
      await update(eventRef, updatedEvent);
      console.log(`Main event record updated successfully`);
      
      // If type changed and there are participants, update them in separate operation
      if (typeChanged && Object.keys(participants).length > 0) {
        const participantIds = Object.keys(participants);
        console.log(`Moving ${participantIds.length} participants to new event type category`);
        
        // Prepare updates for participants
        const participantUpdates = {};
        
        for (const userId of participantIds) {
          // Remove from old category
          participantUpdates[`users/${userId}/events/${previousType}/${eventId}`] = null;
          
          // Add to new category
          participantUpdates[`users/${userId}/events/${newType}/${eventId}`] = {
            date: updatedEvent.start,
            endDate: updatedEvent.end,
            scheduled: true,
            attended: participants[userId].attended || false,
            markedAbsent: participants[userId].markedAbsent || false,
            title: updatedEvent.title,
            eventType: newType,
            eventId: eventId,
            assignedAt: participants[userId].assignedAt || getChicagoTime().toISOString()
          };
        }
        
        // Apply participant updates
        if (Object.keys(participantUpdates).length > 0) {
          await update(ref(database), participantUpdates);
          console.log(`Participant records moved successfully`);
        }
      }
      
      // Update event in local state
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { ...updatedEvent, id: eventId, start: new Date(updatedEvent.start), end: new Date(updatedEvent.end) } 
          : event
      ));
      
      console.log(`Event update completed successfully`);
      setShowEventDialog(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error updating event:', error);
      // Log the specific error for debugging
      console.error('Error details:', error.message, error.code);
      setError('Failed to update event. Please try again.');
      throw error;
    }
  };

const handleDeleteEvent = async (eventId) => {
  try {
    console.log(`Starting deletion process for event ID: ${eventId}`);
    const eventRef = ref(database, `events/${eventId}`);
    
    // Before deleting, get event data to handle cleanup
    const eventSnapshot = await get(eventRef);
    if (eventSnapshot.exists()) {
      const eventData = eventSnapshot.val();
      console.log(`Found event data:`, eventData);
      
      // Prepare batch updates
      const updates = {};
      
      // If there are participants, remove the event from their records
      if (eventData.participants) {
        const participantIds = Object.keys(eventData.participants);
        console.log(`Event has ${participantIds.length} participants to clean up`);
        
        // Get the correct event type category for cleanup
        const eventType = eventData.eventType || EVENT_TYPES.HACIENDAS;
        console.log(`Event type for cleanup: ${eventType}`);
        
        // For each participant, remove from events and schedule
        participantIds.forEach(userId => {
          // Remove from user's category-specific events
          updates[`users/${userId}/events/${eventType}/${eventId}`] = null;
          
          // Remove from user's schedule
          updates[`users/${userId}/schedule/${eventId}`] = null;
          
          console.log(`Added removal for user ${userId} path: users/${userId}/events/${eventType}/${eventId}`);
        });
      }
      
      // Remove the event itself
      updates[`events/${eventId}`] = null;
      
      // Apply all removals in one batch
      console.log(`Applying ${Object.keys(updates).length} database updates...`);
      await update(ref(database), updates);
      console.log(`Batch update completed successfully`);
    } else {
      console.log(`Event ${eventId} not found in database, nothing to clean up`);
      // Still remove the event record itself
      await remove(eventRef);
    }
    
    console.log(`Event deletion process for ${eventId} completed`);
    
    // Update local state
    setEvents(prev => prev.filter(event => event.id !== eventId));
    setShowEventDialog(false);
    setSelectedEvent(null);
  } catch (error) {
    console.error('Error deleting event:', error);
    setError('Failed to delete event. Please try again.');
  }
};

// Add this to your SchedulerContext.js
const handleAssignParticipants = async (eventId, participantIds) => {
  try {
    if (!eventId || !participantIds.length) {
      throw new Error('Event ID and participants are required');
    }
    
    console.log(`Starting participant assignment for event ID: ${eventId} with ${participantIds.length} users`);
    
    // Get event details
    const eventRef = ref(database, `events/${eventId}`);
    const eventSnapshot = await get(eventRef);
    
    if (!eventSnapshot.exists()) {
      throw new Error('Event not found');
    }
    
    const eventData = eventSnapshot.val();
    const eventType = eventData.eventType || 'other'; // Use default if not specified
    
    // Prepare database updates
    const updates = {};
    const now = new Date().toISOString();
    
    // Create participants object with additional properties for the event
    const participantsObj = {};
    participantIds.forEach(id => {
      participantsObj[id] = {
        assigned: true,
        assignedAt: now,
        attended: false
      };
    });
    
    // Add participants to event
    updates[`events/${eventId}/participants`] = participantsObj;
    
    // Add event to each participant's records
    participantIds.forEach(userId => {
      // Add to user's schedule
      updates[`users/${userId}/schedule/${eventId}`] = true;
      
      if (eventType) {
        // Add to user's type-specific events
        updates[`users/${userId}/events/${eventType}/${eventId}`] = {
          date: eventData.start,
          endDate: eventData.end,
          scheduled: true,
          attended: false,
          markedAbsent: false,
          title: eventData.title,
          eventType: eventType,
          location: eventData.location,
          eventId: eventId,
          assignedAt: now
        };
      }
    });
    
    // Perform batch update
    await update(ref(database), updates);
    console.log(`Successfully assigned ${participantIds.length} participants to event ${eventId}`);
    
    // Update local state to reflect the changes immediately
    setEvents(prev => prev.map(event => {
      if (event.id === eventId) {
        return {
          ...event,
          participants: participantsObj
        };
      }
      return event;
    }));
    
    setShowAssignmentDialog(false);
  } catch (error) {
    console.error('Error assigning participants:', error);
    setError('Failed to assign participants. Please try again.');
  }
};

  // Data Fetching
  useEffect(() => {
    console.log("Setting up events listener, user:", user?.uid);
    
    if (!user) {
      setLoading(false);
      return;
    }

    const eventsRef = ref(database, 'events');
    setLoading(true);

    const unsubscribe = onValue(eventsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log("Raw events data:", data);
        
        if (!data) {
          console.log("No events data found");
          setEvents([]);
          setLoading(false);
          return;
        }
        
        const formattedEvents = Object.entries(data).map(([id, event]) => {
          // Ensure valid date objects
          let startDate, endDate;
          
          try {
            startDate = new Date(event.start);
            if (isNaN(startDate.getTime())) {
              console.error(`Invalid start date for event ${id}:`, event.start);
              startDate = new Date(); // Fallback to current date
            }
          } catch (e) {
            console.error(`Error parsing start date for event ${id}:`, e);
            startDate = new Date();
          }
          
          try {
            endDate = new Date(event.end);
            if (isNaN(endDate.getTime())) {
              console.error(`Invalid end date for event ${id}:`, event.end);
              endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); // Default to 1 hour after start
            }
          } catch (e) {
            console.error(`Error parsing end date for event ${id}:`, e);
            endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
          }
          
          return {
            ...event,
            id,
            title: event.title || "Untitled Event",
            start: startDate,
            end: endDate,
          };
        });
        
        // Filter events based on user permissions
        let filteredEvents = formattedEvents;
        
        // For admin users, filter by managed locations
        if (userProfile?.role === 'admin' && adminPermissions) {
          filteredEvents = formattedEvents.filter(event => {
            // Always include events created by this user
            if (event.createdBy === user.uid) return true;
            
            // Always include "All Locations" events
            if (event.location === "All Locations") return true;
            
            // Check if admin can manage this event's location
            return canManageLocation(event.location);
          });
        }
        // For super admins, show all events
        else if (userProfile?.role !== 'super_admin') {
          // Regular users only see events they're participants in or created
          filteredEvents = formattedEvents.filter(event => {
            // Events created by this user
            if (event.createdBy === user.uid) return true;
            
            // Events where user is a participant
            if (event.participants && event.participants[user.uid]) return true;
            
            // "All Locations" events should be visible to everyone
            if (event.location === "All Locations") return true;
            
            // Events at user's primary location
            return event.location === userProfile?.primaryLocation;
          });
        }
        
        console.log("Filtered events:", filteredEvents);
        setEvents(filteredEvents);
        setError(null);
      } catch (error) {
        console.error('Error processing events:', error);
        setError('Failed to load events. Please try again.');
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Database error:', error);
      setError('Failed to connect to the database. Please try again.');
      setLoading(false);
    });

    return () => {
      console.log("Cleaning up events listener");
      unsubscribe();
    };
  }, [user, userProfile, adminPermissions]); // No need to include canManageLocation as dependency

  // Helper Functions
  const getEventsForDay = (selectedDate) => {
    // Convert selectedDate to Chicago timezone for consistent comparison
    const chicagoDate = moment(selectedDate).tz('America/Chicago');
    const start = moment(chicagoDate).startOf('day').toDate();
    const end = moment(chicagoDate).endOf('day').toDate();
    
    return events.filter(event => {
      const eventDate = moment(event.start).tz('America/Chicago').toDate();
      return eventDate >= start && eventDate <= end;
    });
  };

  const getEventsForLocation = (location) => {
    // If "All Locations" is selected, return all events
    if (location === "All Locations") {
      return events;
    }
    
    // Otherwise, filter by specific location or include "All Locations" events
    return events.filter(event => 
      event.location === location || event.location === "All Locations"
    );
  };

  // Function to get users that can be managed by this admin
  const getManageableUsers = async () => {
    if (!user) return [];
    
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const allUsers = snapshot.val();
      
      // For super admins, return all users
      if (userProfile?.role === 'super_admin') {
        return Object.entries(allUsers)
          .filter(([id, userData]) => userData.profile)
          .map(([id, userData]) => ({
            id,
            name: userData.profile?.name,
            ...userData.profile
          }));
      }
      
      // For regular admins, filter by their managed locations and departments
      if (userProfile?.role === 'admin' && adminPermissions) {
        return Object.entries(allUsers)
          .filter(([id, userData]) => {
            if (!userData.profile) return false;
            
            const userLocation = userData.profile.primaryLocation;
            const userDepartment = userData.profile.department;
            
            const canManageUserLocation = adminPermissions.managedLocations?.[userLocation];
            const canManageDepartment = !userDepartment || 
                                        adminPermissions.managedDepartments?.[userDepartment];
            
            return canManageUserLocation && canManageDepartment;
          })
          .map(([id, userData]) => ({
            id,
            name: userData.profile?.name,
            ...userData.profile
          }));
      }
      
      // Regular employees should only see themselves or their team
      return [];
    } catch (error) {
      console.error('Error fetching manageable users:', error);
      return [];
    }
  };

  // Create the context value object
  const contextValue = {
    // UI State
    loading,
    error,
    view,
    setView,
    date,
    setDate,
    showEventDialog,
    setShowEventDialog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    
    // Data State
    events,
    selectedEvent,
    setSelectedEvent,
    locations,
    
    // Auth and Permissions
    currentUser: user,
    userProfile,
    adminPermissions,
    
    // Event Handlers
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleAssignParticipants,
    
    // Helper Functions
    getEventsForDay,
    getEventsForLocation,
    getManageableUsers,
    canManageLocation,
    
    // Constants
    EVENT_TYPES,
    EVENT_TYPE_TO_CATEGORY_MAP
  };

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
};
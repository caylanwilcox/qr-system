// src/components/Scheduler/context/SchedulerContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from '../../../services/firebaseConfig';
import { startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../../../services/authContext';

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
  const [locations] = useState([
    'West Chicago',
    'Lyons',
    'Agua Viva',
    'Elgin R7',
    'Joliet',
    'Wheeling',
  ]);

  // Firebase Event Handlers
  const handleCreateEvent = async (eventData) => {
    try {
      console.log("Creating event with data:", eventData);
      
      const eventsRef = ref(database, 'events');
      
      const newEvent = {
        ...eventData,
        start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
        end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
        createdAt: new Date().toISOString(),
      };
      
      if (user && user.uid) {
        newEvent.createdBy = user.uid;
      }
      
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
      const eventRef = ref(database, `events/${eventId}`);
      
      const updatedEvent = {
        ...eventData,
        start: eventData.start instanceof Date ? eventData.start.toISOString() : eventData.start,
        end: eventData.end instanceof Date ? eventData.end.toISOString() : eventData.end,
        updatedAt: new Date().toISOString(),
      };
      
      if (user && user.uid) {
        updatedEvent.updatedBy = user.uid;
      }
      
      await update(eventRef, updatedEvent);
      console.log("Event updated:", eventId);
      
      setShowEventDialog(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event. Please try again.');
      throw error;
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const eventRef = ref(database, `events/${eventId}`);
      await remove(eventRef);
      console.log("Event deleted:", eventId);
      
      setShowEventDialog(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event. Please try again.');
    }
  };

  const handleAssignParticipants = async (eventId, participantIds) => {
    try {
      const updates = {};
      
      updates[`events/${eventId}/participants`] = participantIds.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {});
      
      participantIds.forEach(userId => {
        updates[`users/${userId}/schedule/${eventId}`] = true;
      });
      
      await update(ref(database), updates);
      console.log("Participants assigned to event:", eventId);
      
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
        
        // Don't filter by permissions yet, just display all events for testing
        console.log("Formatted events:", formattedEvents);
        setEvents(formattedEvents);
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
  }, [user]);

  // Helper Functions
  const getEventsForDay = (selectedDate) => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= start && eventDate <= end;
    });
  };

  const getEventsForLocation = (location) => {
    return events.filter(event => event.location === location);
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
            
            const canManageLocation = adminPermissions.managedLocations?.[userLocation];
            const canManageDepartment = !userDepartment || 
                                        adminPermissions.managedDepartments?.[userDepartment];
            
            return canManageLocation && canManageDepartment;
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

  // Check if a user can manage a specific location
  const canManageLocation = (locationName) => {
    if (!locationName || !userProfile) return false;
    
    // Super admins can manage all locations
    if (userProfile.role === 'super_admin') return true;
    
    // Check if admin can manage this location
    if (userProfile.role === 'admin' && adminPermissions) {
      return adminPermissions.managedLocations?.[locationName] === true;
    }
    
    // Regular employees can't manage locations
    return false;
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
    canManageLocation
  };

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
};
// src/components/Scheduler/context/SchedulerContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, update, remove, get } from "firebase/database";
import { database } from '../../../services/firebaseConfig';
import { useAuth } from '../../../services/authContext';
import moment from 'moment-timezone';
import { eventBus, EVENTS } from '../../../services/eventBus';

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

// Import individual functions from schedulerService
import {
  getUserEvents,
  getManagedLocations,
  createEvent as serviceCreateEvent,
  updateEvent as serviceUpdateEvent,
  deleteEvent as serviceDeleteEvent,
  assignEventParticipants,
  canManageUser
} from '../../../services/schedulerService';

// Create the context
export const SchedulerContext = createContext();

// Custom hook to use the scheduler context - export with BOTH names for compatibility
export const useScheduler = () => {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useScheduler must be used within a SchedulerProvider');
  }
  return context;
};

// Export with the name expected by component imports
export const useSchedulerContext = useScheduler;

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
  const [includeManaged, setIncludeManaged] = useState(true);
  const [viewType, setViewType] = useState('month'); // For compatibility with the other implementation
  const [currentDate, setCurrentDate] = useState(getChicagoTime());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Use standardized locations list - will be updated based on user permissions
  const [locations, setLocations] = useState([]);

  // Define canManageLocation as a regular function declaration that gets hoisted
  function canManageLocation(locationName) {
    if (!locationName || !userProfile) return false;
    
    // "All Locations" is handled specially - accessible to super admins only
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

  // Get all user events - using the same name as in the other implementation
  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching events for user:', user.uid, 'Include managed:', includeManaged);
      const userEvents = await getUserEvents(user.uid, includeManaged);
      
      // Process events for calendar display
      const processedEvents = userEvents.map(event => ({
        ...event,
        title: event.title || 'Untitled Event', 
        color: getEventColor(event)
      }));
      
      setEvents(processedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user, includeManaged]);

  // Get managed locations - updated to properly filter based on user role
  const fetchLocations = useCallback(async () => {
    if (!user) {
      setLocations([]);
      return;
    }

    try {
      console.log('🔍 SchedulerContext: Fetching locations for user:', user.uid, 'role:', userProfile?.role);
      
      // Load locations from database
      const locationsRef = ref(database, 'locations');
      const locationsSnapshot = await get(locationsRef);
      let locationsList = [];
      
      if (locationsSnapshot.exists()) {
        const locationsData = locationsSnapshot.val();
        console.log('🔍 SchedulerContext: Raw locations data:', locationsData);
        
        // Extract location names from database
        locationsList = Object.entries(locationsData).map(([key, value]) => {
          if (typeof value === 'object' && value !== null && value.name) {
            return value.name;
          }
          if (typeof value === 'string') {
            return value;
          }
          return key;
        }).filter(loc => loc && typeof loc === 'string');
        
        console.log('🔍 SchedulerContext: Extracted locations:', locationsList);
      } else {
        console.log('🔍 SchedulerContext: No locations in database, using defaults');
        locationsList = [...LOCATIONS];
      }

      // Get user's own location
      const userLocation = userProfile?.primaryLocation || 
                         userProfile?.locationKey || 
                         userProfile?.location ||
                         user?.location;

      // Filter locations based on user permissions
      if (userProfile?.role === 'super_admin') {
        // Super admins can see all locations including "All Locations"
        locationsList.unshift('All Locations');
        console.log('🔍 SchedulerContext: Super admin gets all locations with "All Locations"');
      } else if (userProfile?.role === 'admin') {
        // Location admins only see their managed locations (no "All Locations")
        const managedLocations = adminPermissions?.managedLocations || {};
        console.log('🔍 SchedulerContext: Admin managed locations:', managedLocations);
        
        const filteredLocations = locationsList.filter(location => {
          // Check if location is in managed locations or is the user's own location
          const isManaged = managedLocations[location] === true;
          const isUserLocation = userLocation && location === userLocation;
          return isManaged || isUserLocation;
        });
        
        console.log('🔍 SchedulerContext: Filtered locations for admin:', filteredLocations);
        
        // If no locations are allowed but user has a location, include it
        if (filteredLocations.length === 0 && userLocation) {
          locationsList = [userLocation];
        } else if (filteredLocations.length === 0) {
          locationsList = [...LOCATIONS]; // Fallback to defaults
        } else {
          locationsList = filteredLocations;
        }
      } else {
        // Regular users only see their own location if they have one
        if (userLocation && locationsList.includes(userLocation)) {
          locationsList = [userLocation];
          console.log('🔍 SchedulerContext: Regular user filtered to their location:', userLocation);
        } else {
          // If no user location or location not in list, use defaults
          locationsList = [...LOCATIONS];
        }
      }

      console.log('🔍 SchedulerContext: Final locations list:', locationsList);
      setLocations(locationsList);
    } catch (err) {
      console.error('Error fetching locations:', err);
      // Fallback to user location or defaults
      const userLocation = userProfile?.primaryLocation || userProfile?.locationKey || user?.location;
      if (userLocation) {
        setLocations([userLocation]);
      } else {
        setLocations([...LOCATIONS]);
      }
    }
  }, [user, userProfile, adminPermissions]);

  // Initialize data when user changes
  useEffect(() => {
    fetchEvents();
    fetchLocations();
  }, [fetchEvents, fetchLocations]);

  // Subscribe to event updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to event updates
    const unsubscribeEvent = eventBus.subscribe(EVENTS.EVENT_UPDATED, () => {
      fetchEvents();
    });

    return () => {
      unsubscribeEvent();
    };
  }, [user, fetchEvents]);

  // Firebase Event Handlers
  const handleCreateEvent = async (eventData) => {
    try {
      if (!user) return null;
      
      console.log("Creating event with data:", eventData);
      
      // Use utility to create standardized event object
      const newEvent = createEventObject({
        ...eventData,
        createdBy: user?.uid || null
      });
      
      console.log("Saving event to Firebase:", newEvent);
      
      // Use the service to create the event
      const eventId = await serviceCreateEvent(newEvent, user.uid);
      console.log("Event created with ID:", eventId);
      
      // Emit event update
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        eventId,
        action: 'create',
        userId: user.uid
      });
      
      // Close dialogs
      setShowEventDialog(false);
      setIsModalOpen(false);
      
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
  
  // Different name format for compatibility with both implementations
  const createEvent = handleCreateEvent;
  
  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      console.log(`Starting update process for event ID: ${eventId}`);
      
      await serviceUpdateEvent(eventId, eventData, user?.uid);
      
      // Emit event update
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        eventId,
        action: 'update',
        userId: user?.uid
      });
      
      // Refresh events
      await fetchEvents();
      
      // Close dialog
      setShowEventDialog(false);
      setIsModalOpen(false);
      setSelectedEvent(null);
      
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Failed to update event. Please try again.');
      throw error;
    }
  };

  // Different name format for compatibility with both implementations
  const updateEvent = handleUpdateEvent;

  const handleDeleteEvent = async (eventId) => {
    try {
      await serviceDeleteEvent(eventId, user?.uid);
      
      // Emit event update
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        eventId,
        action: 'delete',
        userId: user?.uid
      });
      
      // Update local state
      setEvents(prev => prev.filter(event => event.id !== eventId));
      setShowEventDialog(false);
      setIsModalOpen(false);
      setSelectedEvent(null);
      
      return true;
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event. Please try again.');
      throw error;
    }
  };

  // Different name format for compatibility with both implementations
  const deleteEvent = handleDeleteEvent;

  const handleAssignParticipants = async (eventId, participantIds) => {
    try {
      await assignEventParticipants(eventId, participantIds, user?.uid);
      
      // Emit event update
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        eventId,
        action: 'assign',
        userId: user?.uid,
        participants: participantIds
      });
      
      // Refresh events
      await fetchEvents();
      
      // Close dialog
      setShowAssignmentDialog(false);
      
      return true;
    } catch (error) {
      console.error('Error assigning participants:', error);
      setError('Failed to assign participants. Please try again.');
      throw error;
    }
  };

  // Different name format for compatibility with both implementations
  const assignParticipants = handleAssignParticipants;

  // Open modal for new event (for compatibility with the other implementation)
  const openCreateModal = useCallback((dateObj) => {
    // Create an empty event at the selected date and time
    const selectedDate = dateObj || currentDate;
    
    // Create default event object
    const newEvent = createEventObject({
      start: selectedDate.toISOString(),
      end: moment(selectedDate).add(1, 'hour').toISOString(),
      createdBy: user?.uid || 'unknown',
    });
    
    setSelectedEvent(newEvent);
    setIsCreating(true);
    setIsModalOpen(true);
    setShowEventDialog(true);
  }, [currentDate, user]);

  // Open modal for existing event (for compatibility with the other implementation)
  const openEditModal = useCallback((event) => {
    setSelectedEvent(event);
    setIsCreating(false);
    setIsModalOpen(true);
    setShowEventDialog(true);
  }, []);

  // Close modal (for compatibility with the other implementation)
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setShowEventDialog(false);
    setSelectedEvent(null);
    setIsCreating(false);
  }, []);

  // Toggle view type (for compatibility with the other implementation)
  const toggleViewType = useCallback((type) => {
    if (['month', 'week', 'day', 'agenda'].includes(type)) {
      setViewType(type);
      setView(type);
    }
  }, []);

  // Navigate to next/previous period (for compatibility with the other implementation)
  const navigatePeriod = useCallback((direction) => {
    const updateDate = (date) => {
      if (direction === 'next') {
        if (viewType === 'month') return moment(date).add(1, 'month').toDate();
        if (viewType === 'week') return moment(date).add(1, 'week').toDate();
        if (viewType === 'day') return moment(date).add(1, 'day').toDate();
        return moment(date).add(1, 'month').toDate();
      } else if (direction === 'prev') {
        if (viewType === 'month') return moment(date).subtract(1, 'month').toDate();
        if (viewType === 'week') return moment(date).subtract(1, 'week').toDate();
        if (viewType === 'day') return moment(date).subtract(1, 'day').toDate();
        return moment(date).subtract(1, 'month').toDate();
      }
      return date;
    };
    
    const newDate = updateDate(currentDate.toDate ? currentDate.toDate() : currentDate);
    setCurrentDate(moment(newDate));
    setDate(newDate);
  }, [viewType, currentDate]);

  // Navigate to today (for compatibility with the other implementation)
  const goToToday = useCallback(() => {
    const today = getChicagoTime();
    setCurrentDate(today);
    setDate(today.toDate());
  }, []);

  // Set date (for compatibility with the other implementation)
  const setDateTime = useCallback((dateObj) => {
    setCurrentDate(moment(dateObj));
    setDate(moment(dateObj).toDate());
  }, []);

  // Toggle include managed events (for compatibility with the other implementation)
  const toggleIncludeManaged = useCallback(() => {
    setIncludeManaged(prev => !prev);
  }, []);

  // Data Fetching - no longer needed as we're using the service directly
  // But keeping in case other components still use it
  const getManageableUsers = async () => {
    if (!user) return [];
    
    try {
      return await getManagedLocations(user.uid);
    } catch (error) {
      console.error('Error fetching manageable users:', error);
      return [];
    }
  };

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

  // Get event color based on event type or status (from the other implementation)
  const getEventColor = (event) => {
    // Basic color mapping for event types
    const colors = {
      'workshops': '#4285F4', // Blue
      'meetings': '#34A853', // Green
      'haciendas': '#FBBC05', // Yellow
      'juntahacienda': '#EA4335', // Red
      'gestion': '#673AB7', // Purple
      'default': '#9E9E9E' // Gray
    };
    
    // First check if it's urgent
    if (event.isUrgent) {
      return '#EA4335'; // Red for urgent
    }
    
    // Check event type
    if (event.eventType) {
      const typeKey = event.eventType.toLowerCase();
      
      // Check for specific types
      if (typeKey.includes('workshop')) return colors.workshops;
      if (typeKey.includes('meeting')) return colors.meetings;
      if (typeKey.includes('hacienda') && typeKey.includes('junta')) return colors.juntahacienda;
      if (typeKey.includes('hacienda')) return colors.haciendas;
      if (typeKey.includes('gestion')) return colors.gestion;
      
      // Try direct match
      for (const [key, color] of Object.entries(colors)) {
        if (typeKey.includes(key)) return color;
      }
    }
    
    // Check category
    if (event.category) {
      const categoryKey = event.category.toLowerCase();
      
      // Try direct match
      for (const [key, color] of Object.entries(colors)) {
        if (categoryKey.includes(key)) return color;
      }
    }
    
    // Default color
    return colors.default;
  };

  // Combine context values to be compatible with both implementations
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
    includeManaged,
    
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
    EVENT_TYPE_TO_CATEGORY_MAP,
    
    // For compatibility with the other implementation
    viewType,
    currentDate,
    isModalOpen,
    isCreating,
    fetchEvents,
    openCreateModal,
    openEditModal,
    closeModal,
    createEvent,
    updateEvent,
    deleteEvent,
    assignParticipants,
    toggleViewType,
    navigatePeriod,
    goToToday,
    setDate: setDateTime,
    toggleIncludeManaged,
    getEventColor
  };

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
};

export default SchedulerProvider;
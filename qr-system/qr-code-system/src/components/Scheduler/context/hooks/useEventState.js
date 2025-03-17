// src/components/Scheduler/context/hooks/useEventState.js
import { useState, useEffect, useRef } from 'react';
import { ref, onValue, get, set } from 'firebase/database';
import { database } from '../../../../services/firebaseConfig';

/**
 * Hook to manage event state with improved date handling and error checking
 * @param {Object} authState - Authentication state containing user info
 * @returns {Object} Event state and functions
 */
export const useEventState = (authState) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Use refs to track manually added events to prevent them from disappearing
  const manuallyAddedEvents = useRef(new Set());
  
  const { currentUser, userProfile } = authState;

  // Helper function to safely parse dates and handle errors
  const safeParseDates = (eventData, eventId) => {
    let startDate, endDate;
    
    try {
      // Convert start date
      if (eventData.start instanceof Date) {
        startDate = eventData.start;
      } else {
        startDate = new Date(eventData.start);
        if (isNaN(startDate.getTime())) {
          console.warn(`Invalid start date for event ${eventId}:`, eventData.start);
          startDate = new Date(); // Use current date as fallback
        }
      }
      
      // Convert end date
      if (eventData.end instanceof Date) {
        endDate = eventData.end;
      } else {
        endDate = new Date(eventData.end);
        if (isNaN(endDate.getTime())) {
          console.warn(`Invalid end date for event ${eventId}:`, eventData.end);
          // Use start date + 1 hour as fallback
          endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
        }
      }
      
      return { startDate, endDate };
    } catch (error) {
      console.error(`Error parsing dates for event ${eventId}:`, error);
      startDate = new Date();
      endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
      return { startDate, endDate };
    }
  };

  // Helper function to format events consistently
  const formatEvent = (eventId, eventData) => {
    const { startDate, endDate } = safeParseDates(eventData, eventId);
    
    return {
      id: eventId,
      title: eventData.title || "Untitled Event",
      description: eventData.description || "",
      location: eventData.location || "",
      department: eventData.department || "",
      isUrgent: eventData.isUrgent || false,
      start: startDate,
      end: endDate,
      participants: eventData.participants || {},
      createdBy: eventData.createdBy || "",
      createdAt: eventData.createdAt || "",
      // Make sure all properties from the original are carried over
      ...eventData,
      // But ensure start and end dates are overridden as Date objects
      start: startDate,
      end: endDate
    };
  };

  // Also update the user's own schedule when a new event is created
  const updateUserSchedule = async (eventId) => {
    if (!currentUser?.uid || !eventId) return;
    
    try {
      const userScheduleRef = ref(database, `users/${currentUser.uid}/schedule/${eventId}`);
      await set(userScheduleRef, true);
      console.log(`Added event ${eventId} to user's own schedule`);
    } catch (error) {
      console.error(`Error adding event to user's schedule:`, error);
    }
  };

  // Load events based on user role
  useEffect(() => {
    // Skip if no user is logged in
    if (!currentUser) {
      console.log("No user logged in, skipping event fetch");
      setLoading(false);
      setEvents([]);
      setIsInitialLoad(false);
      return;
    }

    console.log("Setting up events listener, user:", currentUser.uid);
    console.log("User role:", userProfile?.role);
    
    setLoading(true);
    setError(null);

    // Different approach based on user role
    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
    
    if (isAdmin) {
      // For admins - load all events
      console.log("Loading events for admin user");
      const eventsRef = ref(database, 'events');
      
      const unsubscribe = onValue(eventsRef, (snapshot) => {
        try {
          const data = snapshot.val();
          console.log("Raw events data received:", data ? Object.keys(data).length : 0, "events");
          
          if (!data) {
            // Keep manually added events even if no events in database
            const currentManualEvents = Array.from(manuallyAddedEvents.current).map(id => {
              const found = events.find(e => e.id === id);
              return found || null;
            }).filter(Boolean);
            
            if (currentManualEvents.length) {
              console.log(`Keeping ${currentManualEvents.length} manually added events`);
              setEvents(currentManualEvents);
            } else {
              setEvents([]);
            }
            
            setLoading(false);
            setIsInitialLoad(false);
            return;
          }
          
          // Process all events with careful date handling
          const formattedEvents = Object.entries(data)
            .map(([id, event]) => {
              try {
                return formatEvent(id, event);
              } catch (err) {
                console.error(`Error formatting event ${id}:`, err);
                return null;
              }
            })
            .filter(Boolean); // Remove any null events
          
          console.log(`Admin events loaded: ${formattedEvents.length}`);
          
          // Add any manually tracked events that aren't in the database yet
          if (manuallyAddedEvents.current.size > 0) {
            const manualEvents = Array.from(manuallyAddedEvents.current);
            console.log(`Checking for ${manualEvents.length} manually added events`);
            
            for (const id of manualEvents) {
              if (!formattedEvents.some(e => e.id === id)) {
                const existingEvent = events.find(e => e.id === id);
                if (existingEvent) {
                  console.log(`Adding manually tracked event ${id} to events list`);
                  formattedEvents.push(existingEvent);
                }
              }
            }
          }
          
          // Log a sample event for debugging
          if (formattedEvents.length > 0) {
            const sampleEvent = formattedEvents[0];
            console.log("Sample event:", {
              id: sampleEvent.id,
              title: sampleEvent.title,
              start: sampleEvent.start,
              end: sampleEvent.end,
              isDateObject: sampleEvent.start instanceof Date
            });
          }
          
          setEvents(formattedEvents);
          setError(null);
        } catch (error) {
          console.error('Error processing events:', error);
          setError('Failed to load events. Please try again.');
        } finally {
          setLoading(false);
          setIsInitialLoad(false);
        }
      }, (error) => {
        console.error('Database error:', error);
        setError('Failed to connect to the database. Please try again.');
        setLoading(false);
        setIsInitialLoad(false);
      });
      
      return () => {
        console.log("Cleaning up admin events listener");
        unsubscribe();
      };
    } else {
      // For regular users - only load events from their schedule
      console.log("Loading events for regular user:", currentUser.uid);
      const userScheduleRef = ref(database, `users/${currentUser.uid}/schedule`);
      
      get(userScheduleRef).then(scheduleSnapshot => {
        if (!scheduleSnapshot.exists()) {
          console.log("User has no scheduled events");
          
          // Keep manually added events even if no events in database
          const currentManualEvents = Array.from(manuallyAddedEvents.current).map(id => {
            const found = events.find(e => e.id === id);
            return found || null;
          }).filter(Boolean);
          
          if (currentManualEvents.length) {
            console.log(`Keeping ${currentManualEvents.length} manually added events`);
            setEvents(currentManualEvents);
          } else {
            setEvents([]);
          }
          
          setLoading(false);
          setIsInitialLoad(false);
          return;
        }
        
        // Get event IDs from user's schedule
        const eventIds = Object.keys(scheduleSnapshot.val());
        console.log("User's scheduled event IDs:", eventIds);
        
        if (eventIds.length === 0) {
          // Keep manually added events even if no events in schedule
          const currentManualEvents = Array.from(manuallyAddedEvents.current).map(id => {
            const found = events.find(e => e.id === id);
            return found || null;
          }).filter(Boolean);
          
          if (currentManualEvents.length) {
            console.log(`Keeping ${currentManualEvents.length} manually added events`);
            setEvents(currentManualEvents);
          } else {
            setEvents([]);
          }
          
          setLoading(false);
          setIsInitialLoad(false);
          return;
        }
        
        // Fetch events one by one and process them
        const eventsPromises = eventIds.map(async (eventId) => {
          try {
            const eventRef = ref(database, `events/${eventId}`);
            const eventSnapshot = await get(eventRef);
            
            if (eventSnapshot.exists()) {
              const eventData = eventSnapshot.val();
              return formatEvent(eventId, eventData);
            }
            
            return null;
          } catch (error) {
            console.error(`Error fetching event ${eventId}:`, error);
            return null;
          }
        });
        
        // When all events are fetched, update the state
        Promise.all(eventsPromises)
          .then(fetchedEvents => {
            let validEvents = fetchedEvents.filter(Boolean);
            console.log(`User events loaded: ${validEvents.length} out of ${eventIds.length} scheduled`);
            
            // Add any manually tracked events that aren't in the database yet
            if (manuallyAddedEvents.current.size > 0) {
              const manualEvents = Array.from(manuallyAddedEvents.current);
              console.log(`Checking for ${manualEvents.length} manually added events`);
              
              for (const id of manualEvents) {
                if (!validEvents.some(e => e.id === id)) {
                  const existingEvent = events.find(e => e.id === id);
                  if (existingEvent) {
                    console.log(`Adding manually tracked event ${id} to events list`);
                    validEvents.push(existingEvent);
                  }
                }
              }
            }
            
            // Log a sample event for debugging
            if (validEvents.length > 0) {
              const sampleEvent = validEvents[0];
              console.log("Sample user event:", {
                id: sampleEvent.id,
                title: sampleEvent.title,
                start: sampleEvent.start,
                end: sampleEvent.end,
                isDateObject: sampleEvent.start instanceof Date
              });
            }
            
            setEvents(validEvents);
            setLoading(false);
            setIsInitialLoad(false);
          })
          .catch(error => {
            console.error('Error processing user events:', error);
            setError('Failed to load events. Please try again.');
            setLoading(false);
            setIsInitialLoad(false);
          });
        
        // Set up a listener for any changes to the events
        const eventsRef = ref(database, 'events');
        
        const unsubscribe = onValue(eventsRef, () => {
          // When events change, refresh the user's events
          // by re-fetching them from the database
          get(userScheduleRef).then(newScheduleSnapshot => {
            if (!newScheduleSnapshot.exists()) {
              // Only update if we have no manually added events
              if (manuallyAddedEvents.current.size === 0) {
                setEvents([]);
              }
              return;
            }
            
            // Get updated list of event IDs
            const newEventIds = Object.keys(newScheduleSnapshot.val());
            
            // Fetch updated events
            const updatedEventsPromises = newEventIds.map(async (eventId) => {
              try {
                const eventRef = ref(database, `events/${eventId}`);
                const eventSnapshot = await get(eventRef);
                
                if (eventSnapshot.exists()) {
                  const eventData = eventSnapshot.val();
                  return formatEvent(eventId, eventData);
                }
                
                return null;
              } catch (error) {
                console.error(`Error fetching updated event ${eventId}:`, error);
                return null;
              }
            });
            
            // Update state with refreshed events
            Promise.all(updatedEventsPromises)
              .then(refreshedEvents => {
                let validEvents = refreshedEvents.filter(Boolean);
                
                // Add any manually tracked events that aren't in the database yet
                if (manuallyAddedEvents.current.size > 0) {
                  const manualEvents = Array.from(manuallyAddedEvents.current);
                  
                  for (const id of manualEvents) {
                    if (!validEvents.some(e => e.id === id)) {
                      const existingEvent = events.find(e => e.id === id);
                      if (existingEvent) {
                        validEvents.push(existingEvent);
                      }
                    }
                  }
                }
                
                console.log(`User events refreshed: ${validEvents.length}`);
                setEvents(validEvents);
              })
              .catch(error => {
                console.error('Error refreshing user events:', error);
              });
          }).catch(error => {
            console.error('Error re-fetching user schedule:', error);
          });
        });
        
        // Return cleanup function
        return () => {
          console.log("Cleaning up user events listener");
          unsubscribe();
        };
      }).catch(error => {
        console.error('Error fetching user schedule:', error);
        setError('Failed to load schedule. Please try again.');
        setLoading(false);
        setIsInitialLoad(false);
      });
      
      // Return empty cleanup function for the outer useEffect
      return () => {};
    }
  }, [currentUser, userProfile]);

  // Keep track of newly created events and add to local state
  useEffect(() => {
    if (!currentUser || !selectedEvent || !selectedEvent.id) return;
    
    // Check if this event is already in our events state
    const eventExists = events.some(e => e.id === selectedEvent.id);
    
    // If the selected event doesn't exist in our events array, add it
    if (!eventExists) {
      console.log(`Adding newly created/selected event ${selectedEvent.id} to local state`);
      
      // Format the event properly with correct date objects
      let eventToAdd;
      
      if (selectedEvent.start instanceof Date && selectedEvent.end instanceof Date) {
        // Already has proper Date objects
        eventToAdd = { ...selectedEvent };
      } else {
        // Need to convert dates
        const { startDate, endDate } = safeParseDates(selectedEvent, selectedEvent.id);
        eventToAdd = {
          ...selectedEvent,
          start: startDate,
          end: endDate
        };
      }
      
      // Track this manually added event to prevent it from disappearing
      manuallyAddedEvents.current.add(selectedEvent.id);
      console.log(`Tracking manually added event: ${selectedEvent.id}`);
      
      // Add to user's own schedule to ensure it appears for them
      updateUserSchedule(selectedEvent.id);
      
      // Add the event to state
      setEvents(prevEvents => {
        const stillNotExists = !prevEvents.some(e => e.id === selectedEvent.id);
        if (stillNotExists) {
          console.log("Event added to local state:", eventToAdd);
          return [...prevEvents, eventToAdd];
        }
        return prevEvents; // No change if it's already there
      });
    }
  }, [selectedEvent, currentUser]);

  return {
    events,
    setEvents,
    selectedEvent,
    setSelectedEvent,
    loading,
    setLoading,
    error,
    setError,
    isInitialLoad,
    setIsInitialLoad
  };
};

export default useEventState;
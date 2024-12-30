// src/components/Scheduler/context/SchedulerContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, push, update, remove } from "firebase/database";
import { database } from '../../../services/firebaseConfig';
import { startOfDay, endOfDay } from 'date-fns';

const SchedulerContext = createContext();

export const useSchedulerContext = () => {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useSchedulerContext must be used within a SchedulerProvider');
  }
  return context;
};

export const SchedulerProvider = ({ children }) => {
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  
  // Data State
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [locations] = useState([
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ]);

  // Firebase Event Handlers
  const handleCreateEvent = async (eventData) => {
    try {
      const eventsRef = ref(database, 'events');
      const newEvent = {
        ...eventData,
        start: eventData.start.toISOString(),
        end: eventData.end.toISOString(),
        createdAt: new Date().toISOString(),
      };
      await push(eventsRef, newEvent);
      setShowEventDialog(false);
    } catch (error) {
      setError('Failed to create event. Please try again.');
      console.error('Error creating event:', error);
    }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      const eventRef = ref(database, `events/${eventId}`);
      const updatedEvent = {
        ...eventData,
        start: eventData.start.toISOString(),
        end: eventData.end.toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await update(eventRef, updatedEvent);
      setShowEventDialog(false);
      setSelectedEvent(null);
    } catch (error) {
      setError('Failed to update event. Please try again.');
      console.error('Error updating event:', error);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const eventRef = ref(database, `events/${eventId}`);
      await remove(eventRef);
      setShowEventDialog(false);
      setSelectedEvent(null);
    } catch (error) {
      setError('Failed to delete event. Please try again.');
      console.error('Error deleting event:', error);
    }
  };

  // Data Fetching
  useEffect(() => {
    const eventsRef = ref(database, 'events');
    setLoading(true);

    const unsubscribe = onValue(eventsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const formattedEvents = Object.entries(data).map(([id, event]) => ({
            ...event,
            id,
            start: new Date(event.start),
            end: new Date(event.end),
          }));
          setEvents(formattedEvents);
        } else {
          setEvents([]);
        }
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

    return () => unsubscribe();
  }, []);

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
    
    // Data State
    events,
    selectedEvent,
    setSelectedEvent,
    locations,
    
    // Event Handlers
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    
    // Helper Functions
    getEventsForDay,
    getEventsForLocation,
  };

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
};
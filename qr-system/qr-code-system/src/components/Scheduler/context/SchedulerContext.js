// src/components/Scheduler/context/SchedulerContext.js
import React, { createContext, useContext, useEffect } from 'react';
import { useAuthState } from './hooks/useAuthState';
import { useEventState } from './hooks/useEventState';
import { useUIState } from './hooks/useUIState';
import { useLocationState } from './hooks/useLocationState';
import { useEventHandlers } from './hooks/useEventHandlers';
import { useHelperFunctions } from './hooks/useHelperFunctions';
import { useDebugFunctions } from './hooks/useDebugFunctions';

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
  // Get auth state
  const authState = useAuthState();
  
  // Get UI state
  const uiState = useUIState();
  
  // Get locations
  const locationState = useLocationState();
  
  // Get event state - pass auth to handle different user roles
  const eventState = useEventState(authState);
  
  // Set up event handlers
  const eventHandlers = useEventHandlers(authState, eventState, uiState);
  
  // Set up helper functions
  const helperFunctions = useHelperFunctions(authState, eventState);
  
  // Set up debug functions
  const debugFunctions = useDebugFunctions(eventHandlers, authState);
  
  // Monitor events state changes for debugging
  useEffect(() => {
    if (eventState.events && eventState.events.length > 0) {
      console.log("SchedulerContext: Events state updated, now has", eventState.events.length, "events");
      
      // Sample the first event for debugging
      const sampleEvent = eventState.events[0];
      console.log("Sample event from context:", {
        id: sampleEvent.id,
        title: sampleEvent.title,
        startType: sampleEvent.start instanceof Date ? "Date" : typeof sampleEvent.start,
        endType: sampleEvent.end instanceof Date ? "Date" : typeof sampleEvent.end,
        startValid: sampleEvent.start instanceof Date && !isNaN(sampleEvent.start.getTime()),
        endValid: sampleEvent.end instanceof Date && !isNaN(sampleEvent.end.getTime())
      });
    } else {
      console.log("SchedulerContext: Events state updated, now empty");
    }
  }, [eventState.events]);
  
  // Monitor selected event changes
  useEffect(() => {
    if (eventState.selectedEvent) {
      console.log("SchedulerContext: Selected event updated:", {
        id: eventState.selectedEvent.id,
        title: eventState.selectedEvent.title
      });
    } else {
      console.log("SchedulerContext: Selected event cleared");
    }
  }, [eventState.selectedEvent]);
  
  // Monitor loading state changes
  useEffect(() => {
    console.log("SchedulerContext: Loading state changed to", uiState.loading);
  }, [uiState.loading]);
  
  // Monitor UI dialog states
  useEffect(() => {
    console.log("SchedulerContext: Event dialog state changed to", uiState.showEventDialog);
  }, [uiState.showEventDialog]);
  
  useEffect(() => {
    console.log("SchedulerContext: Assignment dialog state changed to", uiState.showAssignmentDialog);
  }, [uiState.showAssignmentDialog]);

  // Create the context value object by combining all the state and functions
  const contextValue = {
    // Auth state
    ...authState,
    
    // UI State
    ...uiState,
    
    // Data State
    ...eventState,
    ...locationState,
    
    // Event Handlers
    ...eventHandlers,
    
    // Helper Functions
    ...helperFunctions,
    
    // Debug Functions
    ...debugFunctions
  };

  return (
    <SchedulerContext.Provider value={contextValue}>
      {children}
    </SchedulerContext.Provider>
  );
};

export default SchedulerProvider;

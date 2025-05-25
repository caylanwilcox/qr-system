// src/components/debugging/EventLogger.js
import { useEffect, useRef } from 'react';
import { eventBus, EVENTS } from '../../services/eventBus';

/**
 * Component that logs all events from the eventBus
 * Add this anywhere in your application to debug event flow
 * 
 * @param {Object} props
 * @param {Array} props.eventsToLog - Array of event types to log (default: all events)
 * @param {string} props.componentName - Name of the component for log identification
 */
const EventLogger = ({ eventsToLog = Object.values(EVENTS), componentName = 'Unknown' }) => {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Create a single debug logger for all events
    const debugPrefix = `🔍 [EventLogger:${componentName}]`;
    console.log(`${debugPrefix} Initialized event logging for events:`, eventsToLog);

    // Subscribe to each event type
    const unsubscribes = eventsToLog.map(eventType => {
      return eventBus.subscribe(eventType, (data) => {
        if (!mounted.current) return;
        console.group(`${debugPrefix} Event: ${eventType}`);
        console.log('Event data:', data);
        console.log('Timestamp:', new Date().toISOString());
        console.log('Component:', componentName);
        console.groupEnd();
      });
    });

    // Cleanup function
    return () => {
      mounted.current = false;
      unsubscribes.forEach(unsubscribe => unsubscribe());
      console.log(`${debugPrefix} Unsubscribed from all events`);
    };
  }, [eventsToLog, componentName]);

  // This component doesn't render anything
  return null;
};

export default EventLogger;
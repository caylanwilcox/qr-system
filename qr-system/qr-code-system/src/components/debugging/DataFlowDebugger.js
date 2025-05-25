// src/components/DataFlowDebugger.jsx
import React, { useState, useEffect, useRef } from 'react';
import { eventBus, EVENTS } from '../../services/eventBus';
import { ArrowDownCircle, Bug, Zap, X, RotateCcw } from 'lucide-react';
import './DataFlowDebugger.css';

/**
 * DataFlowDebugger Component
 * 
 * A debugging tool that monitors and displays event flow in the application
 * Only rendered in development mode
 */
const DataFlowDebugger = ({ componentName = 'Unknown' }) => {
  const [events, setEvents] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const eventLogRef = useRef(null);

  // Register for all events when component mounts
  useEffect(() => {
    console.log(`[DEBUG:${componentName}] Component mounted`);
    
    // Listen to all events for debugging
    const unsubscribes = [];
    
    // Create handlers for all event types
    Object.values(EVENTS).forEach(eventType => {
      const unsub = eventBus.subscribe(eventType, (data) => {
        const timestamp = new Date().toISOString();
        const newEvent = {
          id: Date.now() + Math.random().toString(36).substr(2, 5),
          type: eventType,
          timestamp,
          data: JSON.stringify(data, null, 2),
          formattedTime: new Date().toLocaleTimeString()
        };
        
        setEvents(prev => [newEvent, ...prev].slice(0, 100)); // Keep the latest 100 events
      });
      
      unsubscribes.push(unsub);
    });
    
    // Also subscribe to any custom events
    const debugUnsub = eventBus.subscribeToAll((event, data) => {
      if (!Object.values(EVENTS).includes(event)) {
        const timestamp = new Date().toISOString();
        const newEvent = {
          id: Date.now() + Math.random().toString(36).substr(2, 5),
          type: event,
          timestamp,
          data: JSON.stringify(data, null, 2),
          formattedTime: new Date().toLocaleTimeString(),
          isCustom: true
        };
        
        setEvents(prev => [newEvent, ...prev].slice(0, 100));
      }
    });
    
    unsubscribes.push(debugUnsub);
    
    return () => {
      // Clean up all subscriptions
      unsubscribes.forEach(unsub => unsub());
      console.log(`[DEBUG:${componentName}] Component unmounted, unsubscribed from all events`);
    };
  }, [componentName]);

  // Scroll to bottom when new events arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && eventLogRef.current && isOpen) {
      eventLogRef.current.scrollTop = 0;
    }
  }, [events, autoScroll, isOpen]);

  // Clear all events
  const handleClearEvents = () => {
    setEvents([]);
  };

  // Toggle debugger open/closed
  const toggleDebugger = () => {
    setIsOpen(prev => !prev);
  };

  // Get color class for event type
  const getEventColor = (eventType) => {
    switch (eventType) {
      case EVENTS.ATTENDANCE_UPDATED:
        return 'event-attendance';
      case EVENTS.USER_DATA_UPDATED:
        return 'event-user';
      case EVENTS.EVENT_UPDATED:
        return 'event-calendar';
      case EVENTS.DASHBOARD_DATA_UPDATED:
        return 'event-dashboard';
      default:
        return 'event-other';
    }
  };

  // Filter events by type
  const filteredEvents = filter
    ? events.filter(event => event.type.toLowerCase().includes(filter.toLowerCase()))
    : events;

  // If not in development mode, don't render
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className={`debugger-container ${isOpen ? 'open' : ''}`}>
      {/* Debugger tab button */}
      <button className="debugger-tab" onClick={toggleDebugger}>
        <Bug size={16} />
        <span>Event Debugger</span>
        {events.length > 0 && <span className="event-count">{events.length}</span>}
      </button>
      
      {/* Debugger panel */}
      {isOpen && (
        <div className="debugger-panel">
          <div className="debugger-header">
            <h3>
              <Zap size={16} className="inline-block mr-1" />
              Event Flow Debugger
            </h3>
            <div className="debugger-controls">
              <input
                type="text"
                placeholder="Filter events..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-input"
              />
              <button 
                className={`auto-scroll-btn ${autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll(!autoScroll)}
                title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              >
                <ArrowDownCircle size={14} />
              </button>
              <button 
                className="clear-btn"
                onClick={handleClearEvents}
                title="Clear all events"
              >
                <RotateCcw size={14} />
              </button>
              <button 
                className="close-btn"
                onClick={toggleDebugger}
                title="Close debugger"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          
          <div className="event-log" ref={eventLogRef}>
            {filteredEvents.length === 0 ? (
              <div className="no-events">
                No events logged yet. Actions in the app will appear here.
              </div>
            ) : (
              filteredEvents.map(event => (
                <div 
                  key={event.id} 
                  className={`event-item ${getEventColor(event.type)}`}
                >
                  <div className="event-header">
                    <span className="event-type">{event.type}</span>
                    <span className="event-time">{event.formattedTime}</span>
                  </div>
                  <pre className="event-data">{event.data}</pre>
                </div>
              ))
            )}
          </div>
          
          <div className="debugger-footer">
            <span className="component-info">
              Component: <strong>{componentName}</strong>
            </span>
            <span className="events-info">
              Showing {filteredEvents.length} of {events.length} events
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataFlowDebugger;
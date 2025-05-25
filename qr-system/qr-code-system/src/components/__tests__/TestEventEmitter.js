// src/components/testing/TestEventEmitter.js
import React, { useState } from 'react';
import { eventBus, EVENTS } from '../../services/eventBus';

/**
 * Test component to manually emit events for debugging event propagation
 * Use this in development to test if components are properly responding to events
 */
const TestEventEmitter = () => {
  const [userId, setUserId] = useState('test-user-123');
  const [location, setLocation] = useState('Aurora');
  const [eventType, setEventType] = useState(EVENTS.ATTENDANCE_UPDATED);
  const [emitStatus, setEmitStatus] = useState(null);
  
  // Available event types for dropdown
  const eventTypes = Object.entries(EVENTS).map(([key, value]) => ({ 
    key, 
    value
  }));
  
  // Available locations
  const locations = [
    'Aurora', 'Elgin', 'Joliet', 'Lyons', 'West Chicago', 'Wheeling'
  ];
  
  // Emit a test event
  const emitEvent = (e) => {
    e.preventDefault();
    
    // Create event data based on the event type
    let eventData = {
      userId,
      location,
      timestamp: new Date().toISOString(),
      testMode: true
    };
    
    // Add specific fields based on event type
    if (eventType === EVENTS.ATTENDANCE_UPDATED) {
      eventData = {
        ...eventData,
        action: 'clockIn'
      };
    } else if (eventType === EVENTS.USER_DATA_UPDATED) {
      eventData = {
        ...eventData,
        updateType: 'attendance',
        includeEvents: true
      };
    } else if (eventType === EVENTS.EVENT_UPDATED) {
      eventData = {
        ...eventData,
        eventId: 'test-event-123',
        eventType: 'workshop',
        action: 'attended'
      };
    } else if (eventType === EVENTS.DASHBOARD_DATA_UPDATED) {
      eventData = {
        ...eventData,
        type: 'attendance',
        date: new Date().toISOString().split('T')[0]
      };
    }
    
    // Emit the event
    console.log(`🧪 [TestEventEmitter] Emitting ${eventType} event:`, eventData);
    eventBus.emit(eventType, eventData);
    
    // Show success message
    setEmitStatus(`Event ${eventType} emitted at ${new Date().toLocaleTimeString()}`);
    
    // Clear status after 3 seconds
    setTimeout(() => setEmitStatus(null), 3000);
  };
  
  return (
    <div className="fixed bottom-0 left-0 z-50 p-4 bg-slate-800 border border-slate-600 rounded-tr-lg text-white max-w-sm">
      <h3 className="text-lg font-bold mb-3">Event Tester</h3>
      
      <form onSubmit={emitEvent} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Event Type</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
          >
            {eventTypes.map(({ key, value }) => (
              <option key={key} value={value}>
                {key}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm mb-1">Location</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
        >
          Emit Event
        </button>
      </form>
      
      {emitStatus && (
        <div className="mt-3 p-2 bg-green-900 text-green-300 rounded text-sm">
          {emitStatus}
        </div>
      )}
      
      <div className="mt-4 text-xs text-slate-400">
        Use this tool to test if your components are correctly subscribing to and handling events.
      </div>
    </div>
  );
};

export default TestEventEmitter;
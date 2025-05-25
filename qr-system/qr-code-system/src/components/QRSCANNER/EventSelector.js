// src/components/QRSCANNER/EventSelector.js
import React from 'react';
import { X, Clock, Users, Calendar, AlertCircle } from 'lucide-react';
import moment from 'moment-timezone';

/**
 * Component for selecting events and displaying the selected event
 * 
 * @param {Object} props
 * @param {Array} props.scheduledEvents - List of scheduled events
 * @param {Function} props.onSelect - Function to call when an event is selected
 * @param {Function} props.onClose - Function to call when the selector is closed
 * @param {Object} props.selectedEvent - Currently selected event
 */
const EventSelector = ({
  scheduledEvents = [],
  onSelect,
  onClose,
  selectedEvent
}) => {
  console.log('EventSelector rendering with', scheduledEvents.length, 'events');
  console.log('EventSelector current selected event:', selectedEvent);
  
  // Sort events by start time
  const sortedEvents = [...scheduledEvents].sort((a, b) => {
    return new Date(a.start) - new Date(b.start);
  });

  // Format event time for display
  const formatEventTime = (date) => {
    if (!date) return '';
    return moment(date).format('h:mm A');
  };
  
  // Group events by type for easier selection
  const eventsByType = sortedEvents.reduce((acc, event) => {
    const type = event.eventType || 'Other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(event);
    return acc;
  }, {});

  // Handle event click with debugging
  const handleEventClick = (event) => {
    console.log("EVENT SELECTOR - Event clicked:", event);
    console.log("EVENT SELECTOR - Will call onSelect with event:", event);
    onSelect(event);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-xl font-semibold">Select Event</h3>
          <button onClick={onClose} className="text-white hover:bg-slate-700 p-1 rounded-full">
            <X size={20} />
          </button>
        </div>

        {scheduledEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle size={48} className="text-amber-500 mb-4" />
            <p className="text-white text-opacity-80">No events scheduled for today</p>
            <p className="text-white text-opacity-60 text-sm mt-2">
              You can create a new event or check your calendar settings
            </p>
          </div>
        ) : (
          <>
            <p className="text-white text-opacity-70 mb-4">
              {scheduledEvents.length} events found for today. Select an event to track attendance.
            </p>
            
            <div className="space-y-4 flex-grow overflow-y-auto">
              {Object.entries(eventsByType).map(([type, events]) => (
                <div key={type} className="mb-4">
                  <h4 className="text-blue-400 text-sm font-semibold mb-2 px-1">{type}</h4>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className={`p-4 rounded-lg ${
                          selectedEvent?.id === event.id
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-slate-700 hover:bg-slate-600'
                        } cursor-pointer transition`}
                        data-testid={`event-item-${event.id}`}
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-white font-medium">{event.title}</h4>
                          <span className="text-white text-opacity-70 flex items-center">
                            <Clock size={14} className="mr-1" />
                            {formatEventTime(event.start)}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 text-white text-opacity-70 text-sm">
                          {event.location && (
                            <span className="flex items-center mr-3">
                              <Users size={14} className="mr-1" />
                              {event.location}
                            </span>
                          )}
                          {event.meetingType && (
                            <span className="bg-slate-600 px-2 py-0.5 rounded-full text-xs">
                              {event.meetingType}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        <button
          onClick={onClose}
          className="mt-4 w-full p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Component to display a selected event banner
 * @param {Object} props
 * @param {Object} props.event - The selected event
 * @param {Function} props.onDeselect - Function to call to deselect the event
 */
const SelectedEventBanner = ({ event, onDeselect }) => {
  console.log('SelectedEventBanner rendering with event:', event?.title);
  
  if (!event) return null;

  // Format event time for display
  const formatEventTime = (date) => {
    if (!date) return '';
    return moment(date).format('h:mm A');
  };

  return (
    <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4 mb-6 max-w-lg mx-auto" data-testid="selected-event-banner">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white text-lg font-semibold">{event.title}</h3>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-white text-opacity-70 text-sm flex items-center">
              <Clock className="mr-1 h-4 w-4" />
              {formatEventTime(event.start)}
              {event.end && ` - ${formatEventTime(event.end)}`}
            </p>
            {event.location && (
              <p className="text-white text-opacity-70 text-sm flex items-center">
                <Users className="mr-1 h-4 w-4" /> 
                {event.location}
              </p>
            )}
            {event.eventType && (
              <span className="bg-blue-600 bg-opacity-30 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                {event.eventType}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            console.log('Deselecting event');
            onDeselect();
          }}
          className="text-white text-opacity-70 hover:text-opacity-100 p-1 hover:bg-slate-700 rounded-full"
          aria-label="Deselect event"
          data-testid="deselect-event-button"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

// Add SelectedEventBanner as a static property of EventSelector
EventSelector.SelectedEventBanner = SelectedEventBanner;

export default EventSelector;
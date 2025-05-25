import React, { useState, memo, useEffect } from 'react';
import { Calendar, Users, Clock, X, ChevronRight } from 'lucide-react';
import moment from 'moment-timezone';

/**
 * Component to display a list of pending events for the employee
 * Memoized to prevent unnecessary re-renders
 */
const PendingEvents = memo(({
  events = [],
  onEventCheckIn,
  isProcessing = false,
  getEventTypeName = (type) => type
}) => {
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    console.log('PendingEvents rendering with', events.length, 'events');
  }, [events.length]);
  
  // No need to render if there are no events
  if (!events || events.length === 0) return null;
  
  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return moment(dateStr).format('MMM D, YYYY');
  };
  
  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr;
  };
  
  return (
    <div 
      className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-4 mb-6 max-w-lg mx-auto"
      data-testid="pending-events"
    >
      {/* Header with toggle */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => {
          console.log('Toggling expanded state:', !expanded);
          setExpanded(!expanded);
        }}
        data-testid="pending-events-header"
      >
        <h3 className="text-white text-md font-semibold flex items-center">
          <Calendar size={18} className="mr-2" />
          Pending Events ({events.length})
        </h3>
        <ChevronRight
          size={20}
          className={`text-white transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          data-testid="expand-icon"
        />
      </div>

      {/* Event list (when expanded) */}
      {expanded && (
        <div className="mt-4 max-h-64 overflow-y-auto" data-testid="expanded-event-list">
          {events.map((event) => (
            <div
              key={`${event.eventType}-${event.id}`}
              className="bg-slate-800 rounded-lg p-3 mb-2"
              data-testid={`event-item-${event.id}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-medium">{event.title || 'Untitled Event'}</div>
                  <div className="text-xs text-white text-opacity-60 flex items-center gap-1 mt-1">
                    <Calendar size={12} className="shrink-0" />
                    {formatDate(event.date)}
                    
                    {event.time && (
                      <span className="flex items-center ml-2">
                        <Clock size={12} className="mr-1 shrink-0" />
                        {formatTime(event.time)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 inline-block px-2 py-1 bg-slate-700 rounded-full text-xs text-white text-opacity-70">
                    {getEventTypeName(event.eventType)}
                  </div>
                  
                  {event.location && (
                    <div className="mt-1 text-xs text-white text-opacity-60">
                      Location: {event.location}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Check in clicked for event:', event.title);
                    onEventCheckIn(event);
                  }}
                  disabled={isProcessing}
                  className={`px-3 py-1 rounded-md text-sm ${
                    isProcessing 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white transition`}
                  data-testid={`check-in-button-${event.id}`}
                >
                  {isProcessing ? 'Processing...' : 'Check In'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Quick check-in buttons when collapsed */}
      {!expanded && events.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" data-testid="quick-check-in-buttons">
          {events.slice(0, 3).map((event) => (
            <button
              key={`quick-${event.eventType}-${event.id}`}
              onClick={() => {
                console.log('Quick check in for event:', event.title);
                onEventCheckIn(event);
              }}
              disabled={isProcessing}
              className={`px-3 py-1 rounded-md text-xs ${
                isProcessing 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition flex items-center gap-1`}
              data-testid={`quick-check-in-${event.id}`}
            >
              <Clock size={12} />
              {event.title?.substring(0, 20) || getEventTypeName(event.eventType)}
              {event.title?.length > 20 && '...'}
            </button>
          ))}
          {events.length > 3 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('Show more events clicked');
                setExpanded(true);
              }}
              className="px-3 py-1 rounded-md text-xs bg-slate-600 hover:bg-slate-700 text-white transition"
              data-testid="show-more-button"
            >
              +{events.length - 3} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if any of these props change
  const eventsEqual = prevProps.events.length === nextProps.events.length && 
                       JSON.stringify(prevProps.events) === JSON.stringify(nextProps.events);
  
  const processingEqual = prevProps.isProcessing === nextProps.isProcessing;
  
  return eventsEqual && processingEqual;
});

export default PendingEvents;
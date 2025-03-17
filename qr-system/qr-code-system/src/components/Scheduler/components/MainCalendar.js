import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useSchedulerContext } from '../context/SchedulerContext';
import { useAuth } from '../../../services/authContext';
import { Sun, AlertCircle, Loader2 } from 'lucide-react';
import CalendarToolbar from './CalendarToolbar';
import '../styles/MainCalendar.css';

const locales = {
  'en-US': require('date-fns/locale/en-US')
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Debug function to check date objects
const debugEvent = (event) => {
  // Ensure valid date objects (detect any issues with dates)
  try {
    const startValid = event.start instanceof Date && !isNaN(event.start.getTime());
    const endValid = event.end instanceof Date && !isNaN(event.end.getTime());
    
    // Log any date issues for troubleshooting
    if (!startValid || !endValid) {
      console.warn('Invalid date detected in event:', {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        startValid,
        endValid
      });
    }
    
    return startValid && endValid;
  } catch (e) {
    console.error('Error validating event dates:', e);
    return false;
  }
};

// Event style getter for improved readability with glass effect
const eventStyleGetter = (event, start, end, isSelected) => {
  let style = {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    color: '#333', // Dark text for better readability
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  };

  // Styling for urgent events
  if (event.isUrgent) {
    style = {
      ...style,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.25)'
    };
  }

  // Department-specific styling for easier identification
  if (event.department) {
    switch (event.department.toLowerCase()) {
      case 'hr':
      case 'human resources':
        style = {
          ...style,
          backgroundColor: 'rgba(124, 58, 237, 0.15)',
          borderColor: 'rgba(124, 58, 237, 0.25)'
        };
        break;
      case 'finance':
      case 'accounting':
        style = {
          ...style,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderColor: 'rgba(16, 185, 129, 0.25)'
        };
        break;
      case 'it':
      case 'technology':
        style = {
          ...style,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderColor: 'rgba(245, 158, 11, 0.25)'
        };
        break;
      default:
        // Use default styling
        break;
    }
  }

  // Style for selected events
  if (isSelected) {
    style = {
      ...style,
      backgroundColor: style.backgroundColor.replace('0.15', '0.35'),
      borderColor: style.borderColor.replace('0.25', '0.5'),
      boxShadow: '0 0 0 1px ' + style.borderColor.replace('0.25', '0.6') + ', 0 3px 6px rgba(0, 0, 0, 0.15)'
    };
  }

  return { style };
};

const MainCalendar = () => {
  const [weekWeather, setWeekWeather] = useState([]);
  const [authError, setAuthError] = useState(null);
  const [eventsReady, setEventsReady] = useState(false);
  const [processedEvents, setProcessedEvents] = useState([]);
  
  const {
    events,
    loading,
    error,
    isInitialLoad,
    selectedEvent,
    setSelectedEvent,
    setShowEventDialog,
    view,
    setView,
    date,
    setDate,
    setError
  } = useSchedulerContext();
  
  // Add auth context
  const auth = useAuth();
  const currentUser = auth?.user;

  // Process events to ensure valid date objects
  useEffect(() => {
    if (events.length > 0) {
      console.log("MainCalendar - Processing events:", events);
      
      // Process events to ensure valid date objects
      try {
        const validEvents = events
          .map(event => {
            // Ensure start and end are Date objects
            let startDate = event.start;
            let endDate = event.end;
            
            // Convert strings to Date objects if needed
            if (typeof event.start === 'string') {
              startDate = new Date(event.start);
            }
            
            if (typeof event.end === 'string') {
              endDate = new Date(event.end);
            }
            
            // Check for valid dates
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn(`Invalid date in event ${event.id}:`, {
                title: event.title,
                start: event.start,
                end: event.end
              });
              
              // Use current date as fallback for invalid dates
              const now = new Date();
              if (isNaN(startDate.getTime())) startDate = now;
              if (isNaN(endDate.getTime())) endDate = new Date(now.getTime() + 3600000); // 1 hour later
            }
            
            return {
              ...event,
              start: startDate,
              end: endDate,
              title: event.title || "Untitled Event"
            };
          })
          .filter(event => debugEvent(event)); // Extra validation
        
        console.log("MainCalendar - Valid events processed:", validEvents.length);
        setProcessedEvents(validEvents);
        setEventsReady(true);
      } catch (err) {
        console.error("Error processing events:", err);
        setError("Failed to process events: " + err.message);
        setEventsReady(true);
      }
    } else {
      console.log("MainCalendar - No events to process");
      setProcessedEvents([]);
      setEventsReady(true);
    }
  }, [events, setError]);

  // Mock weather data
  useEffect(() => {
    const mockWeatherData = () => {
      const weatherData = [
        { day: 'Sun', temp: 65, date: '2025-03-16', weatherIcon: '01d' },
        { day: 'Mon', temp: 66, date: '2025-03-17', weatherIcon: '01d' },
        { day: 'Tue', temp: 66, date: '2025-03-18', weatherIcon: '01d' },
        { day: 'Wed', temp: 83, date: '2025-03-19', weatherIcon: '01d' },
        { day: 'Thu', temp: 69, date: '2025-03-20', weatherIcon: '01d' },
        { day: 'Fri', temp: 67, date: '2025-03-21', weatherIcon: '01d' },
        { day: 'Sat', temp: 74, date: '2025-03-22', weatherIcon: '01d' }
      ];
      setWeekWeather(weatherData);
    };

    mockWeatherData();
  }, []);

  const handleSelectSlot = ({ start, end }) => {
    // Check if user is logged in before allowing event creation
    if (!currentUser) {
      setAuthError('You must be logged in to create events');
      setTimeout(() => setAuthError(null), 3000); // Clear error after 3 seconds
      return;
    }
    
    // Proceed with event creation if logged in
    setSelectedEvent({
      start,
      end,
      title: '',
      description: '',
      location: '',
      attendees: [],
    });
    setShowEventDialog(true);
  };

  const handleSelectEvent = (event) => {
    // Check if user is logged in before allowing event editing
    if (!currentUser) {
      setAuthError('You must be logged in to view or edit events');
      setTimeout(() => setAuthError(null), 3000); // Clear error after 3 seconds
      return;
    }
    
    console.log("Selected event:", event);
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleLoginRedirect = () => {
    window.location.href = '/login';
  };

  // Get today's date for highlighting in the weather strip
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0].slice(5); // "MM-DD" format
  
  return (
    <div className="main-calendar-wrapper">
      {/* Auth Error Message */}
      {authError && (
        <div className="auth-error-banner">
          <div className="auth-error-content">
            <AlertCircle size={18} />
            <span>{authError}</span>
            <button 
              className="login-redirect-button"
              onClick={handleLoginRedirect}
            >
              Log In
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {(loading || isInitialLoad || !eventsReady) && (
        <div className="calendar-loading-overlay">
          <div className="loading-indicator">
            <Loader2 className="animate-spin h-6 w-6 mr-2" />
            <span>Loading calendar data...</span>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="calendar-error-message">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      
      <div className="weather-strip">
        {weekWeather.map((day) => (
          <div 
            key={day.date} 
            className={`weather-day ${day.date.includes(todayStr) ? 'today' : ''}`}
          >
            <span className="day-name">{day.day}</span>
            <Sun size={16} />
            <span className="temperature">{day.temp}°</span>
          </div>
        ))}
      </div>
      
      <Calendar
        localizer={localizer}
        events={processedEvents}
        startAccessor="start"
        endAccessor="end"
        selectable
        resizable
        defaultView="month"
        view={view}
        date={date}
        onView={setView}
        onNavigate={setDate}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        components={{
          toolbar: CalendarToolbar
        }}
        dayLayoutAlgorithm="no-overlap"
        showAllEvents={true}
        popup={true}
        style={{ height: authError ? 'calc(100% - 90px)' : 'calc(100% - 50px)' }} // Adjust height based on error banner
      />
      
      {/* Debug info - remove in production */}
      <div className="event-debug-info" style={{ display: 'none' }}>
        <p>Events Count: {processedEvents.length}</p>
        <p>Loading: {loading ? 'true' : 'false'}</p>
        <p>Initial Load: {isInitialLoad ? 'true' : 'false'}</p>
        <p>Events Ready: {eventsReady ? 'true' : 'false'}</p>
      </div>
    </div>
  );
};

export default MainCalendar;
// src/components/Scheduler/components/EmployeeScheduler.js
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useSchedulerContext } from '../context/SchedulerContext';
import { Clock } from 'lucide-react';
import { useAuth } from '../../../services/authContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CustomEvent = ({ event }) => (
  <div className={`calendar-event ${event.type}`}>
    <div className="event-content">
      <Clock className="w-3.5 h-3.5" />
      <span>{event.title}</span>
    </div>
  </div>
);

const CustomToolbar = ({ label, onNavigate, onView, view }) => (
  <div className="flex flex-wrap justify-between items-center mb-4">
    <div className="flex items-center gap-2">
      <button
        onClick={() => onNavigate('TODAY')}
        className="px-3 py-1.5 text-sm bg-glass-light text-white/70 rounded-lg 
                 hover:bg-white/10 transition-colors"
      >
        Today
      </button>
      <button
        onClick={() => onNavigate('PREV')}
        className="px-3 py-1.5 text-sm bg-glass-light text-white/70 rounded-lg 
                 hover:bg-white/10 transition-colors"
      >
        Back
      </button>
      <button
        onClick={() => onNavigate('NEXT')}
        className="px-3 py-1.5 text-sm bg-glass-light text-white/70 rounded-lg 
                 hover:bg-white/10 transition-colors"
      >
        Next
      </button>
    </div>

    <h2 className="text-lg font-medium text-white/90 px-4">{label}</h2>

    <div className="flex items-center gap-2">
      {['month', 'week', 'day'].map((viewType) => (
        <button
          key={viewType}
          onClick={() => onView(viewType)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            view === viewType
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-glass-light text-white/70 hover:bg-white/10'
          }`}
        >
          {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
        </button>
      ))}
    </div>
  </div>
);

const EmployeeScheduler = () => {
  const {
    events,
    view,
    setView,
    date,
    setDate,
    getEventsForLocation,
    loading,
    error
  } = useSchedulerContext();

  const { user } = useAuth();
  const [filteredEvents, setFilteredEvents] = useState([]);

  useEffect(() => {
    // Filter events based on employee's location and assignments
    const employeeEvents = events.filter(event => {
      // Show events for employee's location
      if (event.location === user.location) {
        // Show if employee is assigned or eligible for the position
        return event.staffAssignments?.[user.id] || 
               event.staffRequirements?.some(req => req.position === user.position);
      }
      return false;
    });
    setFilteredEvents(employeeEvents);
  }, [events, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
      <div className="p-6">
        {/* Legend */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
            <span className="text-sm text-white/70">Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
            <span className="text-sm text-white/70">Available</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-glass-dark backdrop-blur rounded-lg border border-glass-light">
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ minHeight: 600 }}
            views={['month', 'week', 'day']}
            defaultView="month"
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            components={{
              event: CustomEvent,
              toolbar: CustomToolbar,
            }}
            className="custom-calendar"
            dayLayoutAlgorithm="no-overlap"
          />
        </div>
      </div>
    </div>
  );
};

export default EmployeeScheduler;
// src/components/Scheduler/components/AdminScheduler.js
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { useSchedulerContext } from '../context/SchedulerContext';
import EventDialog from './EventDialog';
import EventAssignmentDialog from './EventAssignmentDialog';
import { Calendar as CalendarIcon, Clock, Plus } from 'lucide-react';
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

// Custom Components
const CustomEvent = ({ event }) => (
  <div className={`calendar-event ${event.type}`}>
    <div className="event-content">
      <Clock className="w-3.5 h-3.5" />
      <span>{event.title}</span>
    </div>
  </div>
);

const CustomToolbar = ({ label, onNavigate, onView, view, onCreateEvent }) => (
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
      <button
        onClick={onCreateEvent}
        className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 
                 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 
                 transition-colors flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Create Event
      </button>
    </div>
  </div>
);

const AdminScheduler = () => {
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    setShowEventDialog,
    view,
    setView,
    date,
    setDate,
    getEventsForLocation,
    loading,
    error
  } = useSchedulerContext();

  const [currentLocation, setCurrentLocation] = useState(null);
  const [filteredEvents, setFilteredEvents] = useState([]);

  useEffect(() => {
    if (currentLocation) {
      setFilteredEvents(getEventsForLocation(currentLocation));
    } else {
      setFilteredEvents(events);
    }
  }, [currentLocation, events, getEventsForLocation]);

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent({
      start,
      end,
      title: '',
      description: '',
      location: currentLocation || '',
      staffRequirements: [],
    });
    setShowEventDialog(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

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
        {/* Location Filter */}
        <div className="mb-6">
          <select
            value={currentLocation || ''}
            onChange={(e) => setCurrentLocation(e.target.value || null)}
            className="px-4 py-2.5 bg-glass border border-glass-light rounded-lg
                     text-white/90 focus:outline-none focus:border-blue-500/50"
          >
            <option value="">All Locations</option>
            {/* Add your locations from context here */}
          </select>
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
              toolbar: (props) => (
                <CustomToolbar {...props} onCreateEvent={handleCreateEvent} />
              ),
            }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            className="custom-calendar"
            dayLayoutAlgorithm="no-overlap"
          />
        </div>
      </div>

      {/* Dialogs */}
      <EventDialog />
      {selectedEvent && selectedEvent.type === 'schedule_template' && (
        <EventAssignmentDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default AdminScheduler;
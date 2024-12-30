// MainCalendar.js
import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useSchedulerContext } from '../context/SchedulerContext';
import CalendarToolbar from './CalendarToolbar';
import { eventStyleGetter } from '../utils/eventStyles';
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

const MainCalendar = () => {
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    setShowEventDialog,
    view,
    setView,
    date,
    setDate,
  } = useSchedulerContext();

  const { components } = useMemo(() => ({
    components: {
      toolbar: CalendarToolbar,
    }
  }), []);

  const handleSelectSlot = ({ start, end }) => {
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
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  return (
    <div className="main-calendar-wrapper">
      <Calendar
        localizer={localizer}
        events={events}
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
        components={components}
        dayLayoutAlgorithm="no-overlap"
        className="main-calendar"
      />
    </div>
  );
};

export default MainCalendar;
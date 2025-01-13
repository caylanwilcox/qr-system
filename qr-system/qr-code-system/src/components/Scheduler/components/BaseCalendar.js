// src/components/Scheduler/components/BaseCalendar.js
import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useSchedulerContext } from '../context/SchedulerContext';
import { eventStyleGetter } from '../utils/eventStyles';
import CalendarToolbar from './CalendarToolbar';

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

const BaseCalendar = ({ 
  userRole, 
  onSelectSlot, 
  onSelectEvent, 
  events, 
  customComponents,
  additionalProps = {} 
}) => {
  const {
    view,
    setView,
    date,
    setDate,
  } = useSchedulerContext();

  const { components } = useMemo(() => ({
    components: {
      toolbar: (props) => (
        <CalendarToolbar
          {...props}
          userRole={userRole}
          customComponents={customComponents}
        />
      ),
      ...customComponents
    }
  }), [userRole, customComponents]);

  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      selectable={userRole === 'admin' || userRole === 'super_admin'}
      resizable={userRole === 'admin' || userRole === 'super_admin'}
      defaultView="month"
      view={view}
      date={date}
      onView={setView}
      onNavigate={setDate}
      onSelectSlot={onSelectSlot}
      onSelectEvent={onSelectEvent}
      eventPropGetter={eventStyleGetter}
      components={components}
      dayLayoutAlgorithm="no-overlap"
      className="main-calendar"
      {...additionalProps}
    />
  );
};

export default BaseCalendar;
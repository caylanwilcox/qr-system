import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { Clock, Plus } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS }
});

// A custom event component for styling each event
const CustomEvent = ({ event }) => (
  <div className="calendar-event">
    <div className={`event-content ${event.type}`}>
      <Clock className="w-4 h-4" />
      <span>{event.title}</span>
    </div>
  </div>
);

const ScheduleSection = ({ userId, scheduleData = {} }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const events = useMemo(() => {
    return Object.entries(scheduleData).map(([id, event]) => ({
      id,
      title: event.title,
      start: new Date(event.timestamp),
      end: new Date(event.timestamp),
      type: event.type || 'scheduled'
    }));
  }, [scheduleData]);

  return (
    <div className="schedule-section">
      <div className="p-6 border-b border-slate-700">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Schedule</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30">
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          // IMPORTANT: Ensure 'month' is included in views and set as defaultView
          views={['month', 'week', 'day']}
          defaultView="month"
          date={currentDate}
          onNavigate={date => setCurrentDate(date)}
          components={{
            event: CustomEvent
          }}
          className="custom-calendar"
          style={{ height: 600 }}
        />
      </div>

      <div className="schedule-legend">
        <div className="legend-item">
          <div className="legend-color scheduled" />
          <span>Scheduled</span>
        </div>
        <div className="legend-item">
          <div className="legend-color attended" />
          <span>Attended</span>
        </div>
        <div className="legend-item">
          <div className="legend-color absent" />
          <span>Absent</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSection;

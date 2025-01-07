import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
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

const ScheduleSection = ({
  scheduledDates,
  attendanceRecords,
  onScheduleAdd,
  newScheduleDate,
  newScheduleTime,
  setNewScheduleDate,
  setNewScheduleTime
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Format events properly
  const events = [
    ...scheduledDates.map(date => ({
      id: `scheduled-${date.date}`,
      title: 'Scheduled',
      start: new Date(`${date.date}T${date.time}`),
      end: new Date(`${date.date}T${date.time}`),
      type: 'scheduled'
    })),
    ...attendanceRecords.map(record => ({
      id: `attended-${record.timestamp}`,
      title: record.clockInTime ? 'Attended' : 'Absent',
      start: new Date(record.date),
      end: new Date(record.date),
      type: record.clockInTime ? 'attended' : 'absent'
    }))
  ];

  const handleNavigate = (newDate) => {
    setCurrentDate(newDate);
  };

  const handleSelect = ({ start }) => {
    setNewScheduleDate(format(start, 'yyyy-MM-dd'));
  };

  return (
    <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
      <div className="p-6">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
            <span className="text-sm text-white/70">Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
            <span className="text-sm text-white/70">Attended</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
            <span className="text-sm text-white/70">Absent</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-glass-dark backdrop-blur rounded-lg border border-glass-light">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ minHeight: 600 }}
            views={['month', 'week', 'day']}
            defaultView="month"
            date={currentDate}
            onNavigate={handleNavigate}
            components={{
              event: CustomEvent,
              toolbar: CustomToolbar
            }}
            selectable
            onSelectSlot={handleSelect}
            className="custom-calendar"
            dayLayoutAlgorithm="no-overlap"
          />
        </div>

        {/* Schedule Form */}
        <div className="mt-6 p-6 bg-glass-dark backdrop-blur rounded-lg border border-glass-light">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Date
              </label>
              <input
                type="date"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full px-4 py-2.5 bg-glass border border-glass-light rounded-lg
                          text-white/90 focus:outline-none focus:border-blue-500/50 
                          focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-white/70 mb-2">
                Time
              </label>
              <input
                type="time"
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-glass border border-glass-light rounded-lg
                          text-white/90 focus:outline-none focus:border-blue-500/50 
                          focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={onScheduleAdd}
                disabled={!newScheduleDate || !newScheduleTime}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/20 text-blue-400
                         border border-blue-500/30 rounded-lg hover:bg-blue-500/30 
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSection;
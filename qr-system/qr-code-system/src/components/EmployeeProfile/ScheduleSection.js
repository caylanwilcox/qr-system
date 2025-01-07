// components/ScheduleSection.js
import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Calendar as CalendarIcon, Clock, Plus } from 'lucide-react';
import PropTypes from 'prop-types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const CustomEvent = ({ event }) => (
  <div className={`calendar-event ${event.type}`}>
    <div className="event-content">
      <Clock size={14} />
      <span>{event.title}</span>
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
  setNewScheduleTime,
  onScheduleDelete
}) => {
  const events = [
    ...scheduledDates.map(date => ({
      id: `scheduled-${date.date}`,
      title: 'Scheduled',
      start: new Date(`${date.date}T${date.time}`),
      end: new Date(`${date.date}T${date.time}`),
      allDay: false,
      type: 'scheduled'
    })),
    ...attendanceRecords.map(record => ({
      id: `attended-${record.timestamp}`,
      title: record.clockInTime ? 'Attended' : 'Absent',
      start: new Date(record.date),
      end: new Date(record.date),
      allDay: false,
      type: record.clockInTime ? 'attended' : 'absent'
    }))
  ];

  const handleSelect = ({ start }) => {
    const date = moment(start).format('YYYY-MM-DD');
    setNewScheduleDate(date);
  };

  return (
    <div className="section glass-panel">
      <div className="section-header">
        <h2 className="section-title">
          <CalendarIcon size={20} className="mr-2" />
          Schedule
        </h2>
      </div>
      <div className="calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 500 }}
          views={['month', 'week', 'day']}
          components={{
            event: CustomEvent
          }}
          selectable
          onSelectSlot={handleSelect}
          tooltipAccessor={event => `${event.title} at ${moment(event.start).format('HH:mm')}`}
        />

        <div className="calendar-actions glass-panel mt-4">
          <div className="schedule-form">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                min={moment().format('YYYY-MM-DD')}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
                className="form-input"
              />
            </div>
            <button 
              onClick={onScheduleAdd}
              className="btn primary"
              disabled={!newScheduleDate || !newScheduleTime}
            >
              <Plus size={18} />
              Add Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ScheduleSection.propTypes = {
  scheduledDates: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ).isRequired,
  attendanceRecords: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.number.isRequired,
      date: PropTypes.string.isRequired,
      clockInTime: PropTypes.string,
      clockOutTime: PropTypes.string,
    })
  ).isRequired,
  onScheduleAdd: PropTypes.func.isRequired,
  newScheduleDate: PropTypes.string.isRequired,
  newScheduleTime: PropTypes.string.isRequired,
  setNewScheduleDate: PropTypes.func.isRequired,
  setNewScheduleTime: PropTypes.func.isRequired,
  onScheduleDelete: PropTypes.func,
};

ScheduleSection.defaultProps = {
  onScheduleDelete: () => {},
};

export default ScheduleSection;
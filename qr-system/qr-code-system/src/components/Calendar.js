// Calendar.js
import React, { useState, useEffect } from 'react';
import './Calendar.css';

const Calendar = ({ 
  scheduledDates = [], 
  onDateClick, 
  onScheduleUpdate,
  minDate = new Date() 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDetails, setScheduleDetails] = useState(null);

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', type: 'empty' });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const isScheduled = scheduledDates.some(schedule => schedule.date === dateStr);
      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
      
      days.push({
        day,
        date: dateStr,
        type: isPast ? 'past' : isScheduled ? 'scheduled' : 'available',
        schedules: scheduledDates.filter(schedule => schedule.date === dateStr)
      });
    }

    return days;
  };

  const handleDateClick = (dayInfo) => {
    if (dayInfo.type === 'empty' || dayInfo.type === 'past') return;

    setSelectedDate(dayInfo);
    setScheduleDetails(dayInfo.schedules);
    setShowModal(true);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  };

  const handleScheduleSubmit = () => {
    if (!selectedDate) return;

    const newSchedule = {
      date: selectedDate.date,
      time: scheduleTime,
      status: 'scheduled'
    };

    onScheduleUpdate?.(newSchedule);
    setShowModal(false);
    setSelectedDate(null);
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="calendar-wrapper">
      {/* Calendar Header */}
      <div className="calendar-header">
        <button onClick={handlePrevMonth}>&lt;</button>
        <h2>{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <button onClick={handleNextMonth}>&gt;</button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day Headers */}
        {DAYS.map(day => (
          <div key={day} className="calendar-day-header">
            {day.slice(0, 3)}
          </div>
        ))}

        {/* Calendar Days */}
        {generateCalendarDays().map((dayInfo, index) => (
          <div
            key={`${dayInfo.date}-${index}`}
            className={`calendar-day ${dayInfo.type}`}
            onClick={() => handleDateClick(dayInfo)}
          >
            <span className="day-number">{dayInfo.day}</span>
            {dayInfo.schedules?.length > 0 && (
              <div className="schedule-indicator">
                {dayInfo.schedules.length} scheduled
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedDate.date} - 
                {selectedDate.type === 'scheduled' ? ' Schedule Details' : ' Add Schedule'}
              </h3>
              <button className="close-button" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {scheduleDetails?.length > 0 ? (
                // Show existing schedules
                <div className="schedule-list">
                  {scheduleDetails.map((schedule, index) => (
                    <div key={index} className="schedule-item">
                      <span>{formatTime(schedule.time)}</span>
                      <span className={`status ${schedule.status}`}>
                        {schedule.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                // Show schedule form
                <div className="schedule-form">
                  <div className="form-group">
                    <label>Select Time:</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="time-input"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!scheduleDetails?.length && (
                <button 
                  className="schedule-button"
                  onClick={handleScheduleSubmit}
                >
                  Schedule
                </button>
              )}
              <button 
                className="cancel-button"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
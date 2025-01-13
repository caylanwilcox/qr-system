// src/components/Scheduler/components/CalendarToolbar.js
import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Plus, Edit } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/CalendarToolbar.css';

const VIEW_NAMES = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda'
};

const CalendarToolbar = ({ 
  onNavigate, 
  onView, 
  date, 
  view, 
  views,
  isEditMode,
  setIsEditMode 
}) => {
  const { 
    setDate, 
    setView, 
    setShowEventDialog, 
    setSelectedEvent 
  } = useSchedulerContext();

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }, [date]);

  const handleNavigation = (action) => {
    onNavigate(action);
    const newDate = new Date(date);

    switch (action) {
      case 'PREV':
        newDate.setMonth(date.getMonth() - 1);
        break;
      case 'NEXT':
        newDate.setMonth(date.getMonth() + 1);
        break;
      case 'TODAY':
        newDate.setTime(new Date().getTime());
        break;
    }

    setDate(newDate);
  };

  const handleViewChange = (newView) => {
    onView(newView);
    setView(newView);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setSelectedEvent(null); // Clear any selected event when exiting edit mode
      setShowEventDialog(false); // Close any open dialogs
    }
  };

  return (
    <div className="calendar-toolbar" role="toolbar" aria-label="Calendar navigation">
      <div className="toolbar-section">
        <button
          onClick={() => handleNavigation('TODAY')}
          className="toolbar-button today-button"
          aria-label="Go to today"
        >
          <Calendar className="toolbar-icon" aria-hidden="true" />
          <span>Today</span>
        </button>

        <div className="nav-buttons" role="group" aria-label="Calendar navigation">
          <button
            onClick={() => handleNavigation('PREV')}
            className="toolbar-button nav-button"
            aria-label="Previous month"
          >
            <ChevronLeft className="toolbar-icon" aria-hidden="true" />
          </button>
          <button
            onClick={() => handleNavigation('NEXT')}
            className="toolbar-button nav-button"
            aria-label="Next month"
          >
            <ChevronRight className="toolbar-icon" aria-hidden="true" />
          </button>
        </div>

        <span className="toolbar-date" aria-label="Current date range">
          {formattedDate}
        </span>
      </div>

      <div className="toolbar-section">
        <div
          className="view-buttons"
          role="group"
          aria-label="Calendar view options"
        >
          {views.map((name) => (
            <button
              key={name}
              onClick={() => handleViewChange(name)}
              className={`toolbar-button view-button ${
                view === name ? 'active' : ''
              }`}
              aria-pressed={view === name}
              aria-label={`${VIEW_NAMES[name]} view`}
            >
              {VIEW_NAMES[name]}
            </button>
          ))}
        </div>

        <div className="action-buttons">
          <button
            onClick={toggleEditMode}
            className={`toolbar-button ${isEditMode ? 'active' : ''}`}
            aria-label={isEditMode ? "Exit edit mode" : "Enter edit mode"}
          >
            <Edit className="toolbar-icon" aria-hidden="true" />
            <span>{isEditMode ? 'Exit Edit' : 'Edit'}</span>
          </button>

          <button
            onClick={handleCreateEvent}
            className="toolbar-button create-event-button"
            aria-label="Create new event"
            disabled={isEditMode}
          >
            <Plus className="toolbar-icon" aria-hidden="true" />
            <span>Create Event</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarToolbar;
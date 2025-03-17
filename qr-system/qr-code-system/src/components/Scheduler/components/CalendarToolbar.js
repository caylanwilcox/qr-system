import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Plus, LayoutGrid, List, Clock, Wrench } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/CalendarToolbar.css';

const VIEW_ICONS = {
  month: <LayoutGrid size={16} />,
  week: <Clock size={16} />,
  day: <Clock size={16} />,
  agenda: <List size={16} />
};

const VIEW_NAMES = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda'
};

const CalendarToolbar = ({ onNavigate, onView, date, view, views }) => {
  const [repairing, setRepairing] = useState(false);
  const [result, setResult] = useState(null);

  const { 
    setDate, 
    setView, 
    setShowEventDialog, 
    setSelectedEvent,
    repairAllScheduleNodes 
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
      default:
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

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const repairResult = await repairAllScheduleNodes();
      setResult(repairResult);
      console.log('Repair completed:', repairResult);
    } catch (error) {
      console.error('Repair failed:', error);
      setResult({ success: false, message: error.message });
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="calendar-toolbar" role="toolbar" aria-label="Calendar navigation">
      <div className="toolbar-left">
        <div className="navigation-controls">
          <button
            onClick={() => handleNavigation('TODAY')}
            className="toolbar-button today-button"
            aria-label="Go to today"
          >
            Today
          </button>
          <div className="nav-arrows">
            <button
              onClick={() => handleNavigation('PREV')}
              className="nav-arrow"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => handleNavigation('NEXT')}
              className="nav-arrow"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        
        <h2 className="current-date">
          <Calendar size={18} className="date-icon" />
          {formattedDate}
        </h2>
      </div>

      <div className="toolbar-right">
        <div className="view-selector">
          {views.map((name) => (
            <button
              key={name}
              onClick={() => handleViewChange(name)}
              className={`view-button ${view === name ? 'active' : ''}`}
              aria-pressed={view === name}
              aria-label={`${VIEW_NAMES[name]} view`}
            >
              <span className="view-icon">{VIEW_ICONS[name]}</span>
              <span className="view-name">{VIEW_NAMES[name]}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleCreateEvent}
          className="create-button"
          aria-label="Create new event"
        >
          <Plus size={18} />
          <span>Create Event</span>
        </button>
        
        <button 
  onClick={handleRepair}
  disabled={repairing}
  className="repair-button toolbar-button"
  aria-label="Repair schedule nodes"
>
  <Wrench size={16} />
  <span>{repairing ? 'Repairing...' : 'Repair Schedules'}</span>
</button>
      </div>
      
      {result && (
        <div className={`repair-result ${result.success ? 'success' : 'error'}`}>
          <p>{result.success 
            ? `Repair successful: Created ${result.created} nodes out of ${result.checked} users` 
            : `Repair failed: ${result.message}`}
          </p>
          <button onClick={() => setResult(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default CalendarToolbar;
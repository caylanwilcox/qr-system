import React from 'react';
import { AlertTriangle } from 'lucide-react';
import MainCalendar from './components/MainCalendar';
import EventDialog from './components/EventDialog';
import { SchedulerProvider, useSchedulerContext } from './context/SchedulerContext';
import './styles/Scheduler.css';
// Main container component that uses the context
const SchedulerContent = () => {
  const {
    loading,
    error,
    showEventDialog,
    selectedEvent,
    setSelectedEvent,
    setShowEventDialog
  } = useSchedulerContext();

  if (loading) {
    return (
      <div className="scheduler-loading">
        <div className="loading-spinner"></div>
        <p>Loading scheduler...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scheduler-error">
        <AlertTriangle className="h-5 w-5" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="scheduler-container">
      
      
       

      <div className="scheduler-main" >
        <MainCalendar />
      </div>

      {showEventDialog && <EventDialog />}
    </div>
  );
};

// Wrapper component that provides the context
const SchedulerContainer = () => {
  return (
    <SchedulerProvider>
      <SchedulerContent />
    </SchedulerProvider>
  );
};

export default SchedulerContainer;
// src/components/Scheduler/SchedulerContainer.js
import React from 'react';
import { useSchedulerContext } from './context/SchedulerContext';
import MainCalendar from './components/MainCalendar';
import EventDialog from './components/EventDialog';
import ParticipantSelectionDialog from './components/ParticipantSelectionDialog';
import './SchedulerContainer.css';

// Remove the SchedulerProvider wrapper - it will be provided at a higher level
const SchedulerContainer = () => {
  const {
    selectedEvent,
    showEventDialog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    adminPermissions,
    loading,
    error
  } = useSchedulerContext();

  if (loading) {
    return (
      <div className="scheduler-loading">
        <div className="loading-spinner"></div>
        <p>Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="scheduler-error">
        <div className="error-icon">!</div>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }
  console.log("SchedulerContainer render - Dialog states:", {
    showEventDialog,
    showAssignmentDialog,
    hasSelectedEvent: Boolean(selectedEvent),
    selectedEventId: selectedEvent?.id
  });
  return (
    <div className="scheduler-container">
      {adminPermissions && (
        <div className="admin-status">
          <div className="admin-badge">
            {adminPermissions.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </div>
          <div className="admin-info">
            <span>Managing {Object.keys(adminPermissions.managedLocations || {}).length} locations</span>
            <span>and {Object.keys(adminPermissions.managedDepartments || {}).length} departments</span>
          </div>
        </div>
      )}
      
      <MainCalendar />
      
      {showEventDialog && <EventDialog />}
      
   
      {showAssignmentDialog && selectedEvent && (
  <ParticipantSelectionDialog 
    eventId={selectedEvent.id} // CORRECT: This is passing a string ID
    onClose={() => setShowAssignmentDialog(false)} 
  />
)}
    </div>
  );
};

export default SchedulerContainer;
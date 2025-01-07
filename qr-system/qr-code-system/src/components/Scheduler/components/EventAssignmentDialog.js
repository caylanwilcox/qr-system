// EventAssignmentDialog.js
import React, { useState, useEffect } from 'react';
import { X, Check, UserPlus, Clock, Calendar, Plus, Trash2 } from 'lucide-react';
import { format, isEqual, parseISO } from 'date-fns';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/EventAssignment.css';

const EventAssignmentDialog = ({ event, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [roster, setRoster] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [locationStatus, setLocationStatus] = useState({});

  useEffect(() => {
    setIsOpen(true);
    // Initialize with the original event date
    setSelectedDates([{
      id: 1,
      start: event.start,
      end: event.end
    }]);
    fetchRosterData();
    fetchEventCategories();
  }, [event]);

  const handleAddDate = () => {
    setSelectedDates(prev => [
      ...prev,
      {
        id: prev.length + 1,
        start: event.start,
        end: event.end
      }
    ]);
  };

  const handleDateChange = (id, field, value) => {
    setSelectedDates(prev => 
      prev.map(date => 
        date.id === id ? { ...date, [field]: value } : date
      )
    );
  };

  const handleRemoveDate = (id) => {
    setSelectedDates(prev => prev.filter(date => date.id !== id));
  };

  const renderDateSelectors = () => (
    <div className="date-selection-container">
      <h3 className="section-title">Event Dates</h3>
      {selectedDates.map((date) => (
        <div key={date.id} className="date-row">
          <div className="date-inputs">
            <div className="input-group">
              <label>Start</label>
              <input
                type="datetime-local"
                value={format(new Date(date.start), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleDateChange(date.id, 'start', e.target.value)}
                className="date-input"
              />
            </div>
            <div className="input-group">
              <label>End</label>
              <input
                type="datetime-local"
                value={format(new Date(date.end), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleDateChange(date.id, 'end', e.target.value)}
                className="date-input"
              />
            </div>
          </div>
          {selectedDates.length > 1 && (
            <button 
              className="remove-date-button"
              onClick={() => handleRemoveDate(date.id)}
            >
              <Trash2 className="icon" />
            </button>
          )}
        </div>
      ))}
      <button className="add-date-button" onClick={handleAddDate}>
        <Plus className="icon" />
        Add Another Date
      </button>
    </div>
  );

  return (
    <div className={`event-assignment-overlay ${isOpen ? 'open' : ''}`}>
      <div className="event-assignment-container">
        {/* Left Panel - Staff Roster */}
        <div className={`panel panel-left ${isOpen ? 'slide-in-left' : ''}`}>
          <div className="panel-header">
            <h2>Available Staff</h2>
            {renderDateSelectors()}
          </div>
          
          <div className="roster-list">
            {roster.map(staff => (
              <div 
                key={staff.id} 
                className={`roster-item ${
                  selectedStaff.includes(staff.id) ? 'selected' : ''
                }`}
                onClick={() => handleStaffSelect(staff)}
              >
                <div className="staff-info">
                  <span className="staff-name">{staff.name}</span>
                  <span className="staff-role">{staff.role}</span>
                </div>
                <div className="date-availability">
                  {selectedDates.map(date => (
                    <span 
                      key={date.id}
                      className={`availability-indicator ${
                        isStaffAvailable(staff, date) ? 'available' : 'unavailable'
                      }`}
                      title={format(new Date(date.start), 'MMM d, yyyy')}
                    />
                  ))}
                </div>
                <div className="staff-status">
                  {staff.status === 'available' ? (
                    <Clock className="icon available" />
                  ) : (
                    <Check className="icon assigned" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Event Requirements */}
        <div className={`panel panel-right ${isOpen ? 'slide-in-right' : ''}`}>
          <div className="panel-header">
            <h2>Event Requirements</h2>
            <div className="event-summary">
              <h3>{event.title}</h3>
              <div className="date-summary">
                {selectedDates.length === 1 ? (
                  <p>{format(new Date(selectedDates[0].start), 'MMMM d, yyyy')}</p>
                ) : (
                  <p>{selectedDates.length} dates selected</p>
                )}
              </div>
            </div>
          </div>

          <div className="categories-list">
            {eventCategories.map(category => (
              <div key={category.id} className="category-item">
                <div className="category-header">
                  <span className="category-name">{category.name}</span>
                  <div className="date-requirements">
                    {selectedDates.map(date => (
                      <div key={date.id} className="date-requirement">
                        <span className="date-label">
                          {format(new Date(date.start), 'MMM d')}:
                        </span>
                        <span className="requirement-count">
                          {locationStatus[date.id]?.[category.id]?.filled || 0}/
                          {category.required}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedDates.map(date => (
                  <div key={date.id} className="category-progress">
                    <div 
                      className="progress-bar"
                      style={{ 
                        width: `${((locationStatus[date.id]?.[category.id]?.filled || 0) / 
                          category.required) * 100}%` 
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="panel-footer">
            <div className="status-summary">
              {selectedDates.map(date => (
                <div key={date.id} className="date-status">
                  <span className="date-label">
                    {format(new Date(date.start), 'MMM d')}
                  </span>
                  <div className="status-numbers">
                    <span>
                      {Object.values(locationStatus[date.id] || {}).reduce(
                        (acc, curr) => acc + (curr.filled || 0), 0
                      )}/
                      {Object.values(eventCategories).reduce(
                        (acc, curr) => acc + curr.required, 0
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="action-buttons">
              <button className="cancel-button" onClick={onClose}>
                <X className="icon" />
                Cancel
              </button>
              <button 
                className="send-invites-button"
                onClick={sendInvites}
                disabled={selectedStaff.length === 0}
              >
                <UserPlus className="icon" />
                Send Invites
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventAssignmentDialog;
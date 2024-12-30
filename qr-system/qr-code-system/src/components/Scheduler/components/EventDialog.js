// src/components/Scheduler/components/EventDialog.js
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/EventDialog.css';

const EventDialog = () => {
  const {
    selectedEvent,
    setSelectedEvent,
    showEventDialog,
    setShowEventDialog,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    locations
  } = useSchedulerContext();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: locations[0],
    start: new Date(),
    end: new Date(),
    isUrgent: false
  });

  useEffect(() => {
    if (selectedEvent) {
      setFormData({
        title: selectedEvent.title || '',
        description: selectedEvent.description || '',
        location: selectedEvent.location || locations[0],
        start: selectedEvent.start || new Date(),
        end: selectedEvent.end || new Date(),
        isUrgent: selectedEvent.isUrgent || false
      });
    }
  }, [selectedEvent, locations]);

  const handleClose = () => {
    setShowEventDialog(false);
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      location: locations[0],
      start: new Date(),
      end: new Date(),
      isUrgent: false
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedEvent?.id) {
        await handleUpdateEvent(selectedEvent.id, formData);
      } else {
        await handleCreateEvent(formData);
      }
      handleClose();
    } catch (error) {
      console.error('Error submitting event:', error);
    }
  };

  const handleDelete = async () => {
    if (selectedEvent?.id && window.confirm('Are you sure you want to delete this event?')) {
      await handleDeleteEvent(selectedEvent.id);
      handleClose();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!showEventDialog) return null;

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        <div className="event-dialog-header">
          <h2>{selectedEvent ? 'Edit Event' : 'Create New Event'}</h2>
          <button onClick={handleClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className="form-input"
            >
              {locations.map(location => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start">Start Time</label>
              <input
                type="datetime-local"
                id="start"
                name="start"
                value={formData.start instanceof Date ? formData.start.toISOString().slice(0, 16) : formData.start}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="end">End Time</label>
              <input
                type="datetime-local"
                id="end"
                name="end"
                value={formData.end instanceof Date ? formData.end.toISOString().slice(0, 16) : formData.end}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label htmlFor="isUrgent" className="checkbox-label">
              <input
                type="checkbox"
                id="isUrgent"
                name="isUrgent"
                checked={formData.isUrgent}
                onChange={handleChange}
              />
              Mark as Urgent
            </label>
          </div>

          <div className="dialog-actions">
            {selectedEvent && (
              <button
                type="button"
                onClick={handleDelete}
                className="delete-button"
              >
                Delete Event
              </button>
            )}
            <button type="submit" className="submit-button">
              {selectedEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventDialog;
import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2 } from 'lucide-react';
import { ref, get } from 'firebase/database';
// Update these import lines in EventDialog.js
import { database } from '../../../services/firebaseConfig';  // Go up to src then to services
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
    staffRequirements: [],
    isUrgent: false
  });

  const [availablePositions, setAvailablePositions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        const usersData = snapshot.val();

        if (usersData) {
          // Extract unique positions from users
          const positions = new Set();
          Object.values(usersData).forEach(user => {
            if (user.position && user.position !== 'Member') {
              positions.add(user.position);
            }
          });

          setAvailablePositions(Array.from(positions).sort());
          
          // Initialize with first position if no requirements exist
          if (positions.size > 0 && (!selectedEvent || !selectedEvent.staffRequirements)) {
            setFormData(prev => ({
              ...prev,
              staffRequirements: [
                { position: Array.from(positions)[0], count: 1 }
              ]
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching positions:', error);
        setError('Failed to load position data');
      }
    };

    fetchPositions();
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent) {
      setFormData({
        title: selectedEvent.title || '',
        description: selectedEvent.description || '',
        location: selectedEvent.location || locations[0],
        start: selectedEvent.start || new Date(),
        end: selectedEvent.end || new Date(),
        staffRequirements: selectedEvent.staffRequirements || [],
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
      staffRequirements: [],
      isUrgent: false
    });
  };

  const handleAddPosition = () => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: [
        ...prev.staffRequirements,
        { position: availablePositions[0], count: 1 }
      ]
    }));
  };

  const handleRemovePosition = (index) => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements.filter((_, i) => i !== index)
    }));
  };

  const handlePositionChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      staffRequirements: prev.staffRequirements.map((req, i) => 
        i === index ? { ...req, [field]: value } : req
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const eventData = {
        ...formData,
        type: 'schedule_template',
        status: 'pending',
        staffAssignments: {}
      };

      if (selectedEvent?.id) {
        await handleUpdateEvent(selectedEvent.id, eventData);
      } else {
        await handleCreateEvent(eventData);
      }
      handleClose();
    } catch (error) {
      console.error('Error submitting event:', error);
      setError('Failed to save event');
    }
  };

  const handleDelete = async () => {
    if (selectedEvent?.id && window.confirm('Are you sure you want to delete this event?')) {
      await handleDeleteEvent(selectedEvent.id);
      handleClose();
    }
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
        {error && (
  <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
    {error}
  </div>
)}
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="form-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <select
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
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
                value={formData.start instanceof Date ? formData.start.toISOString().slice(0, 16) : formData.start}
                onChange={(e) => setFormData(prev => ({ ...prev, start: e.target.value }))}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="end">End Time</label>
              <input
                type="datetime-local"
                id="end"
                value={formData.end instanceof Date ? formData.end.toISOString().slice(0, 16) : formData.end}
                onChange={(e) => setFormData(prev => ({ ...prev, end: e.target.value }))}
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Staff Requirements</label>
              <button
                type="button"
                onClick={handleAddPosition}
                className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Position
              </button>
            </div>

            <div className="space-y-3">
              {formData.staffRequirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={req.position}
                    onChange={(e) => handlePositionChange(index, 'position', e.target.value)}
                    className="flex-1 form-input"
                    required
                  >
                    {availablePositions.map(position => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={req.count}
                    onChange={(e) => handlePositionChange(index, 'count', parseInt(e.target.value))}
                    min="1"
                    className="w-24 form-input"
                    required
                  />
                  {formData.staffRequirements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePosition(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label htmlFor="isUrgent" className="checkbox-label">
              <input
                type="checkbox"
                id="isUrgent"
                checked={formData.isUrgent}
                onChange={(e) => setFormData(prev => ({ ...prev, isUrgent: e.target.checked }))}
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
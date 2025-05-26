import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Users, AlertCircle, Loader2, Clock } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import { useAuth } from '../../../services/authContext';
import { ref, get } from 'firebase/database';
import { database } from '../../../services/firebaseConfig';
import moment from 'moment-timezone';
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
    setShowAssignmentDialog,
  } = useSchedulerContext();

  const { user: currentUser } = useAuth();
  
  // State for database-driven data
  const [locations, setLocations] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    eventType: '',
    start: '',
    end: '',
  });

  // Load all data from database
  useEffect(() => {
    const loadSystemData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Load locations from database with extensive debugging
        console.log('🔍 EventDialog: Starting to load locations...');
        const locationsRef = ref(database, 'locations');
        const locationsSnapshot = await get(locationsRef);
        let locationsList = [];
        
        console.log('🔍 EventDialog: Locations snapshot exists?', locationsSnapshot.exists());
        
        if (locationsSnapshot.exists()) {
          const locationsData = locationsSnapshot.val();
          console.log('🔍 EventDialog: Raw locations data from Firebase:', locationsData);
          console.log('🔍 EventDialog: Type of locations data:', typeof locationsData);
          console.log('🔍 EventDialog: Object.keys(locationsData):', Object.keys(locationsData));
          console.log('🔍 EventDialog: Object.values(locationsData):', Object.values(locationsData));
          
          // Try multiple approaches to extract locations
          
          // Approach 1: Simple Object.values (like QR Scanner)
          const approach1 = Object.values(locationsData);
          console.log('🔍 EventDialog: Approach 1 (Object.values):', approach1);
          
          // Approach 2: Object.entries with mapping
          const approach2 = Object.entries(locationsData).map(([key, value]) => {
            console.log(`🔍 EventDialog: Processing entry - key: ${key}, value:`, value, 'type:', typeof value);
            if (typeof value === 'object' && value !== null && value.name) {
              return value.name;
            }
            if (typeof value === 'string') {
              return value;
            }
            return key;
          }).filter(loc => loc && typeof loc === 'string');
          console.log('🔍 EventDialog: Approach 2 (entries mapping):', approach2);
          
          // Approach 3: Just use keys
          const approach3 = Object.keys(locationsData);
          console.log('🔍 EventDialog: Approach 3 (Object.keys):', approach3);
          
          // Use the approach that gives us the most results
          if (approach1.length > 0 && approach1.every(item => typeof item === 'string')) {
            locationsList = approach1;
            console.log('🔍 EventDialog: Using approach 1');
          } else if (approach2.length > 0) {
            locationsList = approach2;
            console.log('🔍 EventDialog: Using approach 2');
          } else if (approach3.length > 0) {
            locationsList = approach3;
            console.log('🔍 EventDialog: Using approach 3');
          } else {
            console.log('🔍 EventDialog: No valid locations found, using defaults');
            locationsList = ['Aurora', 'Elgin', 'Chicago'];
          }
          
          console.log('🔍 EventDialog: Final locations list:', locationsList);
        } else {
          console.log('🔍 EventDialog: No locations found in database, using defaults');
          locationsList = ['Aurora', 'Elgin', 'Chicago'];
        }

        console.log('🔍 EventDialog: Before permission filtering:', locationsList);
        console.log('🔍 EventDialog: Current user:', currentUser);
        console.log('🔍 EventDialog: User role:', currentUser?.role);
        console.log('🔍 EventDialog: Management permissions:', currentUser?.managementPermissions);

        // Add "All Locations" option for admins
        if (currentUser?.role === 'super_admin' || currentUser?.role === 'admin') {
          locationsList.unshift('All Locations');
          console.log('🔍 EventDialog: Added "All Locations" for admin');
        }

        // Filter locations based on user permissions
        if (currentUser?.role !== 'super_admin') {
          const managedLocations = currentUser?.managementPermissions?.managedLocations || {};
          console.log('🔍 EventDialog: Managed locations:', managedLocations);
          
          const filteredLocations = locationsList.filter(location => {
            const isAllowed = location === 'All Locations' || managedLocations[location] === true;
            console.log(`🔍 EventDialog: Location "${location}" allowed?`, isAllowed);
            return isAllowed;
          });
          
          console.log('🔍 EventDialog: Filtered locations:', filteredLocations);
          
          // If no locations are allowed, show all locations (fallback)
          if (filteredLocations.length === 0) {
            console.log('🔍 EventDialog: No locations allowed, using all locations as fallback');
            locationsList = locationsList;
          } else {
            locationsList = filteredLocations;
          }
        }

        console.log('🔍 EventDialog: Setting locations state to:', locationsList);
        setLocations(locationsList);
        console.log('🔍 EventDialog: Locations state should now be set');

        // Load event types from database using QR Scanner logic
        const eventTypesRef = ref(database, 'eventTypes');
        const eventTypesSnapshot = await get(eventTypesRef);
        let eventTypesList = [];
        
        if (eventTypesSnapshot.exists()) {
          const eventTypesData = eventTypesSnapshot.val();
          console.log('Raw event types from Firebase:', eventTypesData);
          
          // Use the same logic as QR Scanner
          eventTypesList = Object.entries(eventTypesData).map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              const eventTypeName = value.name || value.key || key;
              return {
                id: key,
                name: eventTypeName,
                displayName: value.displayName || eventTypeName,
                description: value.description
              };
            } else if (typeof value === 'string') {
              return {
                id: key,
                name: value,
                displayName: value,
                description: ''
              };
            }
            return {
              id: key,
              name: key,
              displayName: key,
              description: ''
            };
          }).filter(type => type && type.name)
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
          
          console.log('Processed event types list:', eventTypesList);
        } else {
          console.log('No event types found in database, using defaults');
          eventTypesList = [
            { id: 'general', name: 'general', displayName: 'General Meeting', description: '' },
            { id: 'juntahacienda', name: 'juntahacienda', displayName: 'Junta Hacienda', description: '' },
            { id: 'meeting', name: 'meeting', displayName: 'Meeting', description: '' },
            { id: 'training', name: 'training', displayName: 'Training', description: '' }
          ];
        }

        setEventTypes(eventTypesList);



      } catch (err) {
        console.error('Error loading system data:', err);
        setError('Failed to load system data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (showEventDialog) {
      loadSystemData();
    }
  }, [showEventDialog, currentUser]);

  // Initialize form when event is selected
  useEffect(() => {
    if (selectedEvent) {
      setFormData({
        title: selectedEvent.title || '',
        description: selectedEvent.description || '',
        location: selectedEvent.location || '',
        eventType: selectedEvent.eventType || '',
        start: selectedEvent.start ? moment(selectedEvent.start).format('YYYY-MM-DDTHH:mm') : '',
        end: selectedEvent.end ? moment(selectedEvent.end).format('YYYY-MM-DDTHH:mm') : '',
      });
    } else {
      // Reset form for new event
      const now = moment();
      setFormData({
        title: '',
        description: '',
        location: locations[0] || '',
        eventType: '',
        start: now.format('YYYY-MM-DDTHH:mm'),
        end: now.add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      });
    }
  }, [selectedEvent, locations]);

  const handleClose = () => {
    setShowEventDialog(false);
    setSelectedEvent(null);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to create events.');
      return;
    }

    // Validation
    if (!formData.title.trim()) {
      setError('Event title is required.');
      return;
    }

    if (!formData.location) {
      setError('Please select a location.');
      return;
    }

    if (!formData.eventType) {
      setError('Please select an event type.');
      return;
    }

    if (!formData.start || !formData.end) {
      setError('Please set start and end times.');
      return;
    }

    const startTime = moment(formData.start);
    const endTime = moment(formData.end);

    if (endTime.isSameOrBefore(startTime)) {
      setError('End time must be after start time.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location,
        eventType: formData.eventType,
        start: startTime.tz('America/Chicago').toISOString(),
        end: endTime.tz('America/Chicago').toISOString(),
      };

      if (selectedEvent?.id) {
        await handleUpdateEvent(selectedEvent.id, eventData);
      } else {
        await handleCreateEvent(eventData);
      }

      handleClose();
    } catch (err) {
      console.error('Error saving event:', err);
      setError('Failed to save event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent?.id) return;
    
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        setSaving(true);
        await handleDeleteEvent(selectedEvent.id);
        handleClose();
      } catch (err) {
        console.error('Error deleting event:', err);
        setError('Failed to delete event. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAssignParticipants = () => {
    if (!selectedEvent?.id) {
      // Save event first, then open assignment dialog
      handleSubmit(new Event('submit')).then(() => {
        // Assignment dialog will open automatically after creation
      });
    } else {
      setShowAssignmentDialog(true);
    }
  };

  if (!showEventDialog) return null;

  if (!currentUser) {
    return (
      <div className="event-dialog-overlay">
        <div className="event-dialog auth-required">
          <div className="auth-message">
            <AlertCircle size={48} className="auth-icon" />
            <h2>Login Required</h2>
            <p>Please log in to create or manage events.</p>
            <div className="auth-actions">
              <button onClick={handleClose} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={() => window.location.href = '/login'}
                className="btn-primary"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        <div className="dialog-header">
          <div className="header-content">
            <Calendar size={24} className="header-icon" />
            <h2>{selectedEvent ? 'Edit Event' : 'Create New Event'}</h2>
          </div>
          <button onClick={handleClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={32} />
            <p>Loading system data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="event-form">
            <div className="form-section">
              <h3>Event Details</h3>
              
              <div className="form-group">
                <label htmlFor="title">Event Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter event title"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventType">Event Type *</label>
                <select
                  id="eventType"
                  name="eventType"
                  value={formData.eventType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select event type</option>
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.displayName}
                    </option>
                  ))}
                </select>
                <small className="help-text">
                  Determines how this event appears in employee timelines
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter event description (optional)"
                  rows={3}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>
                <MapPin size={16} />
                Location
              </h3>
              
              <div className="form-group">
                <label htmlFor="location">Location *</label>
                <select
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select location</option>
                  {(() => {
                    console.log('🔍 EventDialog: Rendering locations dropdown, locations array:', locations);
                    console.log('🔍 EventDialog: Locations array length:', locations.length);
                    return locations.map((location, index) => {
                      console.log(`🔍 EventDialog: Rendering location ${index}:`, location);
                      return (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      );
                    });
                  })()}
                </select>
                {formData.location === 'All Locations' && (
                  <small className="help-text">
                    Event will be visible to all locations
                  </small>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3>
                <Clock size={16} />
                Schedule
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start">Start Time *</label>
                  <input
                    type="datetime-local"
                    id="start"
                    name="start"
                    value={formData.start}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end">End Time *</label>
                  <input
                    type="datetime-local"
                    id="end"
                    name="end"
                    value={formData.end}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="dialog-actions">
              <div className="action-group">
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn-danger"
                    disabled={saving}
                  >
                    Delete Event
                  </button>
                )}
              </div>

              <div className="action-group">
                <button
                  type="button"
                  onClick={handleAssignParticipants}
                  className="btn-secondary"
                  disabled={saving}
                >
                  <Users size={16} />
                  Assign Participants
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || locations.length === 0}
                >
                  {saving ? (
                    <>
                      <Loader2 className="spinner" size={16} />
                      Saving...
                    </>
                  ) : (
                    selectedEvent ? 'Update Event' : 'Create Event'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EventDialog;
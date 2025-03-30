import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import { useAuth } from '../../../services/authContext';
import { ref, get } from 'firebase/database';
import { database } from '../../../services/firebaseConfig';
import moment from 'moment-timezone';
import '../styles/EventDialog.css';
import { 
  EVENT_TYPES, 
  EVENT_TYPE_DISPLAY_NAMES, 
  normalizeEventType,
  getChicagoTime
} from '../../../utils/eventUtils';

// Export meeting type mapping
export const MEETING_TYPE_MAPPING = {
  "PADRINOS Y OREJAS": "padrinos",
  "GENERAL": "general", 
  "INICIANDO EL CAMINO": "iniciando",
  "CIRCULO DE RECUPERACION": "recuperacion",
  "TRIBUNA": "tribuna",
  "SEGUIMIENTO": "seguimiento",
  "CIRCULO DE ESTUDIO": "estudio",
  "NOCHE DE GUERRO": "guerrero"
};

// Define standardized event types for the dropdown
const eventTypes = [
  { 
    id: EVENT_TYPES.WORKSHOPS, 
    name: EVENT_TYPE_DISPLAY_NAMES[EVENT_TYPES.WORKSHOPS] || 'PO Workshop (Monthly)',
    category: EVENT_TYPES.WORKSHOPS
  },
  { 
    id: EVENT_TYPES.MEETINGS, 
    name: EVENT_TYPE_DISPLAY_NAMES[EVENT_TYPES.MEETINGS] || 'PO Group Meeting',
    category: EVENT_TYPES.MEETINGS
  },
  { 
    id: EVENT_TYPES.HACIENDAS, 
    name: EVENT_TYPE_DISPLAY_NAMES[EVENT_TYPES.HACIENDAS] || 'Hacienda',
    category: EVENT_TYPES.HACIENDAS
  },
  { 
    id: EVENT_TYPES.JUNTA_HACIENDA, 
    name: EVENT_TYPE_DISPLAY_NAMES[EVENT_TYPES.JUNTA_HACIENDA] || 'Junta de Hacienda',
    category: EVENT_TYPES.JUNTA_HACIENDA
  },
  { 
    id: EVENT_TYPES.GESTION, 
    name: EVENT_TYPE_DISPLAY_NAMES[EVENT_TYPES.GESTION] || 'Gestion',
    category: EVENT_TYPES.GESTION
  },
  { 
    id: 'other', 
    name: 'Other (Will not appear in timeline)',
    category: null
  }
];

// Define the event dialog component
const EventDialog = () => {
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    showEventDialog,
    setShowEventDialog,
    handleCreateEvent,
    handleUpdateEvent, 
    handleDeleteEvent,
    setShowAssignmentDialog,
    locations,
    canManageLocation,
  } = useSchedulerContext();

  // Get auth context to check if user is logged in
  const auth = useAuth();
  const currentUser = auth?.user;
  
  const [authError, setAuthError] = useState(null);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    department: '',
    eventType: '',  // Field for event type
    start: new Date(),
    end: new Date(),
    isUrgent: false
  });

  // Debug: Log when selected event changes
  useEffect(() => {
    if (selectedEvent) {
      console.log("Selected event changed:", {
        id: selectedEvent.id,
        title: selectedEvent.title,
        eventType: selectedEvent.eventType, // Log the event type if it exists
        start: selectedEvent.start instanceof Date ? selectedEvent.start.toISOString() : selectedEvent.start,
        end: selectedEvent.end instanceof Date ? selectedEvent.end.toISOString() : selectedEvent.end
      });
    }
  }, [selectedEvent]);

  // Fetch locations the user can manage
  useEffect(() => {
    const fetchManagedLocations = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Start with the locations from context
        let baseLocations = [...locations];
        
        // Add "All Locations" option at the beginning
        baseLocations = ["All Locations", ...baseLocations];
        
        // For admins, filter by permissions
        if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'super_admin') {
          const filteredLocations = baseLocations.filter(location => 
            location === "All Locations" || canManageLocation(location)
          );
          setAvailableLocations(filteredLocations);
        } else {
          // Super admins can manage all locations
          setAvailableLocations(baseLocations);
        }
      } catch (err) {
        console.error('Error fetching managed locations:', err);
        setAuthError('Failed to load your managed locations');
      } finally {
        setLoading(false);
      }
    };
    
    fetchManagedLocations();
  }, [currentUser, locations, canManageLocation]);

  // Initialize form with selected event data or defaults
  useEffect(() => {
    // Check for authentication
    if (!currentUser) {
      setAuthError('You must be logged in to create or modify events.');
    } else {
      setAuthError(null);
    }
    
    if (selectedEvent) {
      // For existing event, use its data
      console.log("Setting form data from selected event:", selectedEvent);
      
      setFormData({
        title: selectedEvent.title || '',
        description: selectedEvent.description || '',
        location: selectedEvent.location || '',
        department: selectedEvent.department || '',
        eventType: selectedEvent.eventType || 'other', // Set default to 'other' if not specified
        start: selectedEvent.start || new Date(),
        end: selectedEvent.end || new Date(),
        isUrgent: selectedEvent.isUrgent || false
      });
    } else if (availableLocations.length > 0) {
      // For new event, set default location to first managed location
      setFormData(prev => ({
        ...prev,
        location: availableLocations[0],
        eventType: 'other' // Default event type for new events
      }));
    }
  }, [selectedEvent, availableLocations, currentUser]);

  const handleClose = () => {
    setShowEventDialog(false);
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      location: availableLocations.length > 0 ? availableLocations[0] : '',
      department: '',
      eventType: 'other', // Reset to default
      start: new Date(),
      end: new Date(),
      isUrgent: false
    });
    setAuthError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setAuthError('You must be logged in to create or modify events.');
      return;
    }
    
    // Validate event type is selected
    if (!formData.eventType) {
      setAuthError('Please select an event type.');
      return;
    }
    
    try {
      // Convert date objects to Chicago timezone ISO strings
      const chicagoStart = moment(formData.start).tz('America/Chicago').toISOString();
      const chicagoEnd = moment(formData.end).tz('America/Chicago').toISOString();
      
      // Find the selected event type option
      const selectedEventType = eventTypes.find(type => type.id === formData.eventType);
      
      // Create data with standardized time
      const eventDataToSave = {
        ...formData,
        start: chicagoStart,
        end: chicagoEnd,
        // Use the canonical eventType ID which matches the DB category
        eventType: formData.eventType, 
        // Include display name for UI
        eventTypeName: selectedEventType?.name || 'Other'
      };
      
      console.log("EVENT DATA TO SAVE:", eventDataToSave);
      
      if (selectedEvent?.id) {
        // Add debugging before update
        console.log("EVENT UPDATE - Selected event before update:", selectedEvent);
        console.log("EVENT UPDATE - Form data for update:", eventDataToSave);
        
        // Perform the update
        await handleUpdateEvent(selectedEvent.id, eventDataToSave);
        
        // Add debugging after update
        console.log("EVENT UPDATE - Update completed successfully");
      } else {
        await handleCreateEvent(eventDataToSave);
      }
      handleClose();
    } catch (error) {
      console.error('Error submitting event:', error);
      setAuthError('Failed to save event. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!currentUser) {
      setAuthError('You must be logged in to delete events.');
      return;
    }
    
    if (selectedEvent?.id && window.confirm('Are you sure you want to delete this event?')) {
      try {
        await handleDeleteEvent(selectedEvent.id);
        handleClose();
      } catch (error) {
        console.error('Error deleting event:', error);
        setAuthError('Failed to delete event. Please try again.');
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDateTimeChange = (e) => {
    const { name, value } = e.target;
    
    try {
      // Parse the date from the input value (already in local timezone)
      const newDate = new Date(value);
      
      // Validate the date
      if (isNaN(newDate.getTime())) {
        console.error(`Invalid date string: ${value}`);
        return;
      }
      
      console.log(`Date change - ${name}: ${value} -> ${newDate.toISOString()}`);
      
      setFormData(prev => ({
        ...prev,
        [name]: newDate
      }));
    } catch (error) {
      console.error(`Error parsing date: ${value}`, error);
    }
  };

  const handleAssignParticipants = () => {
    if (!currentUser) {
      setAuthError('You must be logged in to assign participants.');
      return;
    }
    
    // Only save the event if it doesn't exist yet
    if (!selectedEvent?.id) {
      // Convert date objects to Chicago timezone ISO strings
      const chicagoStart = moment(formData.start).tz('America/Chicago').toISOString();
      const chicagoEnd = moment(formData.end).tz('America/Chicago').toISOString();
      
      // Create data with standardized time
      const eventDataToSave = {
        ...formData,
        start: chicagoStart,
        end: chicagoEnd
      };
      
      handleCreateEvent(eventDataToSave).then(() => {
        // The assignment dialog will open automatically after creation
        // (handled in useEventHandlers hook)
      }).catch(error => {
        console.error('Error creating event:', error);
        setAuthError('Failed to create event. Please try again.');
      });
    } else {
      // For existing events, just open the assignment dialog
      setShowAssignmentDialog(true);
    }
  };

  // Redirect to login if not showing dialog
  if (!showEventDialog) return null;

  // If not authenticated, show auth error UI
  if (!currentUser) {
    return (
      <div className="event-dialog-overlay">
        <div className="auth-error-container">
          <AlertCircle size={48} className="auth-error-icon" />
          <h2>Authentication Required</h2>
          <p>You must be logged in to create or modify events.</p>
          <div className="auth-actions">
            <button className="cancel-button" onClick={handleClose}>
              Cancel
            </button>
            <button 
              className="login-button"
              onClick={() => window.location.href = '/login'}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        {authError && (
          <div className="event-dialog-error">
            <AlertCircle size={16} />
            <span>{authError}</span>
            <button onClick={() => setAuthError(null)} className="dismiss-error">
              <X size={14} />
            </button>
          </div>
        )}
      
        <div className="event-dialog-header">
          <h2>{selectedEvent ? 'Edit Event' : 'Create New Event'}</h2>
          <button onClick={handleClose} className="close-button">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            <p>Loading your managed locations...</p>
          </div>
        ) : (
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
                placeholder="Enter event title"
              />
            </div>

            {/* Event Type dropdown field */}
            <div className="form-group">
              <label htmlFor="eventType">Event Type <span className="required-field">*</span></label>
              <select
                id="eventType"
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select Event Type</option>
                {eventTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <small className="input-help-text">
                Event type determines how this event appears in employee timelines
              </small>
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
                placeholder="Enter event description (optional)"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                {availableLocations.length === 0 ? (
                  <div className="empty-locations-message">
                    No locations available for your account
                  </div>
                ) : (
                  <select
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    required
                    className="form-input"
                  >
                    <option value="">Select Location</option>
                    {availableLocations.map(location => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                )}
                {formData.location === "All Locations" && (
                  <small className="input-help-text">
                    This event will be visible across all locations
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="department">Department</label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start">Start Time</label>
                <input
                  type="datetime-local"
                  id="start"
                  name="start"
                  value={formData.start instanceof Date ? 
                    // Format for local timezone
                    moment(formData.start).format('YYYY-MM-DDTHH:mm') : 
                    formData.start
                  }
                  onChange={handleDateTimeChange}
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
                  value={formData.end instanceof Date ? 
                    // Format for local timezone
                    moment(formData.end).format('YYYY-MM-DDTHH:mm') : 
                    formData.end
                  }
                  onChange={handleDateTimeChange}
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
              
              <div className="right-actions">
                <button 
                  type="button" 
                  onClick={handleAssignParticipants}
                  className="assign-button"
                >
                  <UserPlus size={16} />
                  Assign Participants
                </button>
                
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={availableLocations.length === 0 || !formData.eventType}
                >
                  {selectedEvent ? 'Update Event' : 'Create Event'}
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
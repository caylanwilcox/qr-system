import React, { useState, useEffect } from 'react';
import { X, Check, UserPlus, Clock, Calendar, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { format, isEqual, parseISO, isWithinInterval, areIntervalsOverlapping } from 'date-fns';
import { ref, get, update } from 'firebase/database';
import { database } from '../../../services/firebaseConfig';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/EventAssignment.css';

const LoadingSpinner = () => (
  <div className="loading-overlay">
    <div className="loading-spinner" />
  </div>
);

const ErrorMessage = ({ message, onDismiss }) => (
  <div className="error-banner">
    <AlertTriangle className="icon" />
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="dismiss-button">
        <X className="icon" />
      </button>
    )}
  </div>
);

const EventAssignmentDialog = ({ event, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [roster, setRoster] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [eventCategories, setEventCategories] = useState([]);
  const [locationStatus, setLocationStatus] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState({
    roster: true,
    categories: true,
    submit: false
  });
  const [staffConflicts, setStaffConflicts] = useState({});

  useEffect(() => {
    setIsOpen(true);
    setSelectedDates([{
      id: 1,
      start: event.start,
      end: event.end
    }]);
    
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchRosterData(),
          fetchEventCategories()
        ]);
      } catch (error) {
        setError("Failed to initialize event assignment. Please try again.");
      }
    };

    initializeData();
  }, [event]);

  const fetchRosterData = async () => {
    setLoading(prev => ({ ...prev, roster: true }));
    try {
      const usersRef = ref(database, 'users');
      const eventsRef = ref(database, 'events');
      
      const [usersSnapshot, eventsSnapshot] = await Promise.all([
        get(usersRef),
        get(eventsRef)
      ]);

      const usersData = usersSnapshot.val();
      const eventsData = eventsSnapshot.val();

      if (usersData) {
        const availableStaff = Object.entries(usersData)
          .filter(([_, user]) => user.status === 'active' && user.location === event.location)
          .map(([id, user]) => {
            // Check for existing assignments
            const existingAssignments = findExistingAssignments(id, eventsData);
            
            return {
              id,
              name: user.name,
              position: user.position,
              status: 'available',
              availability: user.availability || {},
              existingAssignments
            };
          });

        setRoster(availableStaff);
      }
    } catch (error) {
      console.error('Error fetching roster:', error);
      setError('Failed to load staff roster. Please refresh and try again.');
    } finally {
      setLoading(prev => ({ ...prev, roster: false }));
    }
  };

  const findExistingAssignments = (staffId, eventsData) => {
    if (!eventsData) return [];

    return Object.entries(eventsData)
      .filter(([eventId, eventData]) => {
        return eventData.staffAssignments && 
               Object.values(eventData.staffAssignments)
                     .some(assignments => assignments[staffId]);
      })
      .map(([eventId, eventData]) => ({
        eventId,
        start: new Date(eventData.start),
        end: new Date(eventData.end)
      }));
  };

  const fetchEventCategories = async () => {
    setLoading(prev => ({ ...prev, categories: true }));
    try {
      const categories = event.staffRequirements.map((req, index) => ({
        id: index.toString(),
        name: req.position,
        required: req.count
      }));

      setEventCategories(categories);
      
      const initialStatus = {};
      selectedDates.forEach(date => {
        initialStatus[date.id] = {};
        categories.forEach(category => {
          initialStatus[date.id][category.id] = {
            filled: 0,
            required: category.required
          };
        });
      });
      setLocationStatus(initialStatus);
    } catch (error) {
      console.error('Error processing categories:', error);
      setError('Failed to load event categories. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, categories: false }));
    }
  };

  const handleStaffSelect = (staff) => {
    // Check for scheduling conflicts
    const conflicts = checkSchedulingConflicts(staff);
    setStaffConflicts(prev => ({
      ...prev,
      [staff.id]: conflicts
    }));

    setSelectedStaff(prev => {
      const isSelected = prev.includes(staff.id);
      if (isSelected) {
        return prev.filter(id => id !== staff.id);
      } else {
        // Only add if no conflicts
        if (conflicts.length === 0) {
          return [...prev, staff.id];
        }
        return prev;
      }
    });
  };

  const checkSchedulingConflicts = (staff) => {
    const conflicts = [];
    
    selectedDates.forEach(selectedDate => {
      const selectedInterval = {
        start: new Date(selectedDate.start),
        end: new Date(selectedDate.end)
      };

      // Check existing assignments
      staff.existingAssignments.forEach(assignment => {
        if (areIntervalsOverlapping(selectedInterval, {
          start: assignment.start,
          end: assignment.end
        })) {
          conflicts.push({
            date: selectedDate.id,
            reason: 'Existing assignment conflict'
          });
        }
      });

      // Check availability preferences
      if (!isStaffAvailable(staff, selectedDate)) {
        conflicts.push({
          date: selectedDate.id,
          reason: 'Outside availability hours'
        });
      }
    });

    return conflicts;
  };

  const isStaffAvailable = (staff, date) => {
    const startTime = new Date(date.start);
    const endTime = new Date(date.end);
    
    // Check staff availability settings
    const dayOfWeek = format(startTime, 'EEEE').toLowerCase();
    const availability = staff.availability[dayOfWeek];
    
    if (!availability) return true; // No restrictions set

    try {
      const availableStart = parseISO(`${format(startTime, 'yyyy-MM-dd')}T${availability.start}`);
      const availableEnd = parseISO(`${format(startTime, 'yyyy-MM-dd')}T${availability.end}`);
      
      return isWithinInterval(startTime, { start: availableStart, end: availableEnd }) &&
             isWithinInterval(endTime, { start: availableStart, end: availableEnd });
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  };

  const sendInvites = async () => {
    setLoading(prev => ({ ...prev, submit: true }));
    try {
      // Validate before sending
      const validationError = validateAssignments();
      if (validationError) {
        setError(validationError);
        return;
      }

      const updates = {};
      
      // Update event assignments
      selectedDates.forEach(date => {
        selectedStaff.forEach(staffId => {
          const path = `events/${event.id}/staffAssignments/${date.id}/${staffId}`;
          updates[path] = {
            status: 'pending',
            assignedAt: new Date().toISOString()
          };
        });
      });

      // Update staff schedules
      selectedStaff.forEach(staffId => {
        selectedDates.forEach(date => {
          const path = `users/${staffId}/assignments/${event.id}_${date.id}`;
          updates[path] = {
            eventId: event.id,
            dateId: date.id,
            start: date.start,
            end: date.end,
            status: 'pending'
          };
        });
      });

      await update(ref(database), updates);
      onClose();
    } catch (error) {
      console.error('Error sending invites:', error);
      setError('Failed to send invites. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  const validateAssignments = () => {
    // Check if minimum requirements are met
    let validation = '';

    eventCategories.forEach(category => {
      const assignedStaffCount = selectedStaff.filter(staffId => {
        const staff = roster.find(s => s.id === staffId);
        return staff && staff.position === category.name;
      }).length;

      if (assignedStaffCount < category.required) {
        validation += `Need ${category.required - assignedStaffCount} more ${category.name}(s). `;
      }
    });

    return validation || null;
  };

  // ... rest of your render functions ...

  if (!isOpen) return null;

  const isLoading = loading.roster || loading.categories;

  return (
    <div className={`event-assignment-overlay ${isOpen ? 'open' : ''}`}>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="event-assignment-container">
          {error && (
            <ErrorMessage 
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
          
          {/* Your existing JSX structure */}
          {loading.submit && <LoadingSpinner />}
          
          <button 
            onClick={sendInvites}
            disabled={loading.submit || selectedStaff.length === 0}
            className="send-invites-button"
          >
            {loading.submit ? (
              <span>Sending...</span>
            ) : (
              <>
                <UserPlus className="icon" />
                Send Invites
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default EventAssignmentDialog;
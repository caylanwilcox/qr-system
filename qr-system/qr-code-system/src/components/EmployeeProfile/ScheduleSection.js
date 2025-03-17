// src/components/EmployeeProfile/ScheduleSection.js
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { Clock, Plus, X, AlertCircle } from 'lucide-react';
import { ref, update, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './styles/ScheduleSection.css';

// Calendar localizer setup
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS }
});

// Custom Event Component
const CustomEvent = ({ event }) => (
  <div className={`calendar-event ${event.eventType || 'default'}`}>
    <div className="event-content">
      <Clock className="w-3.5 h-3.5" />
      <span>{event.title}</span>
    </div>
  </div>
);

// Event Dialog Component
const EventDialog = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">{event.title}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-white/70 text-sm">Date</p>
            <p className="text-white">{format(new Date(event.start), 'PPP')}</p>
          </div>
          
          <div>
            <p className="text-white/70 text-sm">Time</p>
            <p className="text-white">{format(new Date(event.start), 'p')}</p>
          </div>
          
          {event.location && (
            <div>
              <p className="text-white/70 text-sm">Location</p>
              <p className="text-white">{event.location}</p>
            </div>
          )}
          
          {event.description && (
            <div>
              <p className="text-white/70 text-sm">Description</p>
              <p className="text-white">{event.description}</p>
            </div>
          )}
          
          {event.notes && (
            <div>
              <p className="text-white/70 text-sm">Notes</p>
              <p className="text-white">{event.notes}</p>
            </div>
          )}

          <div>
            <p className="text-white/70 text-sm">Type</p>
            <p className={`inline-flex px-2 py-1 rounded text-sm ${
              event.eventType === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
              event.eventType === 'clockIn' ? 'bg-emerald-500/20 text-emerald-400' :
              event.eventType === 'assigned' ? 'bg-purple-500/20 text-purple-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {event.eventType === 'scheduled' ? 'Scheduled' :
               event.eventType === 'clockIn' ? 'Clock In' :
               event.eventType === 'assigned' ? 'Assigned' : 'Event'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Event Modal Component
const AddEventModal = ({ isOpen, onClose, onSave, selectedDate }) => {
  const [eventDetails, setEventDetails] = useState({
    title: '',
    time: '09:00',
    notes: ''
  });

  const handleSave = () => {
    onSave({
      ...eventDetails,
      date: selectedDate,
      timestamp: new Date(`${selectedDate}T${eventDetails.time}`).toISOString()
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-white">Schedule Event</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Title
            </label>
            <input
              type="text"
              value={eventDetails.title}
              onChange={(e) => setEventDetails(prev => ({...prev, title: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-700 rounded-lg text-white"
              placeholder="Event title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Time
            </label>
            <input
              type="time"
              value={eventDetails.time}
              onChange={(e) => setEventDetails(prev => ({...prev, time: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-700 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Notes
            </label>
            <textarea
              value={eventDetails.notes}
              onChange={(e) => setEventDetails(prev => ({...prev, notes: e.target.value}))}
              className="w-full px-3 py-2 bg-slate-700 rounded-lg text-white resize-none"
              rows={3}
              placeholder="Additional notes"
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              disabled={!eventDetails.title || !eventDetails.time}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Schedule Section Component
const ScheduleSection = ({ employeeId, employeeDetails }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch assigned events from schedule
  useEffect(() => {
    const fetchAssignedEvents = async () => {
      if (!employeeId) return;
      
      try {
        setLoading(true);
        
        // Fetch user's scheduled events (from assigned events)
        const userScheduleRef = ref(database, `users/${employeeId}/schedule`);
        const scheduleSnapshot = await get(userScheduleRef);
        
        if (!scheduleSnapshot.exists()) {
          console.log("User has no assigned events");
          setAssignedEvents([]);
          setLoading(false);
          return;
        }
        
        // Get event IDs from user's schedule
        const eventIds = Object.keys(scheduleSnapshot.val());
        console.log("Assigned event IDs:", eventIds);
        
        if (eventIds.length === 0) {
          setAssignedEvents([]);
          setLoading(false);
          return;
        }
        
        // Fetch the actual events from events collection
        const eventsPromises = eventIds.map(async (eventId) => {
          const eventRef = ref(database, `events/${eventId}`);
          try {
            const eventSnapshot = await get(eventRef);
            if (eventSnapshot.exists()) {
              const eventData = eventSnapshot.val();
              // Convert dates and format to match the calendar requirements
              return {
                id: eventId,
                title: eventData.title || "Untitled Event",
                start: new Date(eventData.start),
                end: new Date(eventData.end),
                location: eventData.location,
                description: eventData.description,
                eventType: 'assigned',
                isUrgent: eventData.isUrgent
              };
            }
            return null;
          } catch (e) {
            console.error("Error fetching event:", e);
            return null;
          }
        });
        
        const fetchedEvents = await Promise.all(eventsPromises);
        const validEvents = fetchedEvents.filter(Boolean);
        console.log("Fetched assigned events:", validEvents);
        
        setAssignedEvents(validEvents);
      } catch (err) {
        console.error("Error fetching assigned events:", err);
        setError("Failed to load assigned events");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssignedEvents();
  }, [employeeId]);

  // Process all event types
  const combinedEvents = useMemo(() => {
    if (!employeeDetails) return [...assignedEvents];
    
    const allEvents = [...assignedEvents]; // Start with assigned events

    // Add location history records
    if (employeeDetails.locationHistory) {
      employeeDetails.locationHistory.forEach(record => {
        if (record.date) {
          allEvents.push({
            id: `location-${record.date}`,
            title: `Location: ${record.locationId}`,
            start: new Date(record.date),
            end: new Date(record.date),
            eventType: 'location',
            location: record.locationId
          });
        }
      });
    }

    // Add clock in/out events
    if (employeeDetails.stats?.lastClockIn) {
      allEvents.push({
        id: `clockin-${employeeDetails.stats.lastClockIn}`,
        title: 'Clock In',
        start: new Date(employeeDetails.stats.lastClockIn),
        end: new Date(employeeDetails.stats.lastClockIn),
        eventType: 'clockIn',
        location: employeeDetails.primaryLocation || employeeDetails.location
      });
    }

    if (employeeDetails.stats?.lastClockOut) {
      allEvents.push({
        id: `clockout-${employeeDetails.stats.lastClockOut}`,
        title: 'Clock Out',
        start: new Date(employeeDetails.stats.lastClockOut),
        end: new Date(employeeDetails.stats.lastClockOut),
        eventType: 'clockOut',
        location: employeeDetails.primaryLocation || employeeDetails.location
      });
    }

    // Add manually scheduled events
    if (employeeDetails.scheduledEvents) {
      Object.entries(employeeDetails.scheduledEvents).forEach(([id, event]) => {
        allEvents.push({
          id,
          title: event.title || 'Scheduled Event',
          start: new Date(event.timestamp),
          end: new Date(event.timestamp),
          eventType: 'scheduled',
          notes: event.notes,
          location: event.location || employeeDetails.primaryLocation || employeeDetails.location
        });
      });
    }

    console.log('All combined events:', allEvents);
    return allEvents.sort((a, b) => new Date(b.start) - new Date(a.start));
  }, [employeeDetails, assignedEvents]);

  const handleScheduleEvent = async (eventDetails) => {
    if (!employeeId) return;

    try {
      const eventRef = ref(database, `users/${employeeId}/scheduledEvents`);
      const newEvent = {
        title: eventDetails.title,
        timestamp: eventDetails.timestamp,
        notes: eventDetails.notes,
        location: employeeDetails.primaryLocation || employeeDetails.location
      };

      await update(eventRef, {
        [`event-${Date.now()}`]: newEvent
      });
      
      // Add the event to the local state immediately
      const localEvent = {
        id: `event-${Date.now()}`,
        title: eventDetails.title,
        start: new Date(eventDetails.timestamp),
        end: new Date(eventDetails.timestamp),
        eventType: 'scheduled',
        notes: eventDetails.notes,
        location: employeeDetails.primaryLocation || employeeDetails.location
      };
      
      // This will trigger a re-render with the new event
      // The component will fully refresh when the useEffect runs again
    } catch (error) {
      console.error('Error scheduling event:', error);
      setError('Failed to schedule event. Please try again.');
    }
  };

  const handleSelectSlot = ({ start }) => {
    setSelectedDate(format(start, 'yyyy-MM-dd'));
    setShowAddModal(true);
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="p-6">
        {/* Loading/Error States */}
        {loading && (
          <div className="bg-slate-700 p-4 mb-4 rounded-lg text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white">Loading schedule...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-900 bg-opacity-20 border border-red-500 text-red-400 p-4 mb-4 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
      
        {/* Calendar */}
        <div className="bg-slate-900 rounded-lg">
          <BigCalendar
            localizer={localizer}
            events={combinedEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ minHeight: 600 }}
            views={['month', 'week', 'day']}
            defaultView="month"
            date={currentDate}
            onNavigate={(date) => setCurrentDate(date)}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={(event) => setSelectedEvent(event)}
            className="custom-calendar"
            components={{ event: CustomEvent }}
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
            <span className="text-sm text-white/70">Scheduled</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-400 mr-2"></div>
            <span className="text-sm text-white/70">Assigned</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-emerald-400 mr-2"></div>
            <span className="text-sm text-white/70">Clock In/Out</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
            <span className="text-sm text-white/70">Location</span>
          </div>
        </div>

        {/* Modals */}
        {selectedEvent && (
          <EventDialog 
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)} 
          />
        )}

        <AddEventModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleScheduleEvent}
          selectedDate={selectedDate}
        />
      </div>
    </div>
  );
};

export default ScheduleSection;
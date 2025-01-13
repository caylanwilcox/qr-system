// src/components/EmployeeProfile/ScheduleSection.js
import React, { useState, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { Clock, Plus, X } from 'lucide-react';
import { ref, update } from 'firebase/database';
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
  <div className={`calendar-event ${event.type}`}>
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
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {event.eventType === 'scheduled' ? 'Scheduled' :
               event.eventType === 'clockIn' ? 'Clock In' : 'Event'}
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

  // Process events from employee details
  const events = useMemo(() => {
    if (!employeeDetails) return [];
    
    const allEvents = [];

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
        location: employeeDetails.location
      });
    }

    if (employeeDetails.stats?.lastClockOut) {
      allEvents.push({
        id: `clockout-${employeeDetails.stats.lastClockOut}`,
        title: 'Clock Out',
        start: new Date(employeeDetails.stats.lastClockOut),
        end: new Date(employeeDetails.stats.lastClockOut),
        eventType: 'clockOut',
        location: employeeDetails.location
      });
    }

    // Add scheduled events
    if (employeeDetails.scheduledEvents) {
      Object.entries(employeeDetails.scheduledEvents).forEach(([id, event]) => {
        allEvents.push({
          id,
          title: event.title || 'Scheduled Event',
          start: new Date(event.timestamp),
          end: new Date(event.timestamp),
          eventType: 'scheduled',
          notes: event.notes,
          location: event.location || employeeDetails.location
        });
      });
    }

    console.log('Generated events:', allEvents);
    return allEvents.sort((a, b) => new Date(b.start) - new Date(a.start));
  }, [employeeDetails]);

  const handleScheduleEvent = async (eventDetails) => {
    if (!employeeId) return;

    try {
      const eventRef = ref(database, `users/${employeeId}/scheduledEvents`);
      const newEvent = {
        title: eventDetails.title,
        timestamp: eventDetails.timestamp,
        notes: eventDetails.notes,
        location: employeeDetails.location
      };

      await update(eventRef, {
        [`event-${Date.now()}`]: newEvent
      });
    } catch (error) {
      console.error('Error scheduling event:', error);
    }
  };

  const handleSelectSlot = ({ start }) => {
    setSelectedDate(format(start, 'yyyy-MM-dd'));
    setShowAddModal(true);
  };

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="p-6">
        {/* Calendar */}
        <div className="bg-slate-900 rounded-lg">
          <BigCalendar
            localizer={localizer}
            events={events}
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
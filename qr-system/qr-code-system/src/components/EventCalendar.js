'use client';
import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2 } from 'lucide-react';
import './Calendar.css';

const EventCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    const meetingsRef = ref(database, 'meetings');
    const unsubscribe = onValue(meetingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedMeetings = Object.entries(data).map(([id, meeting]) => ({
          id,
          date: meeting.date,
          time: meeting.time,
          status: meeting.status,
          adminId: meeting.adminId,
          location: meeting.location,
          title: meeting.title || 'Untitled Meeting'
        }));
        setMeetings(formattedMeetings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', type: 'empty' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const dayMeetings = meetings.filter(meeting => meeting.date === dateStr);
      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
      
      days.push({
        day,
        date: dateStr,
        type: isPast ? 'past' : dayMeetings.length > 0 ? 'scheduled' : 'available',
        meetings: dayMeetings
      });
    }

    return days;
  };

  const handleScheduleSubmit = async () => {
    if (!selectedDate) return;

    const newMeeting = {
      date: selectedDate.date,
      time: scheduleTime,
      status: 'scheduled',
      adminId: 'current-admin-id', // Replace with actual admin ID
      location: 'TBD',
      title: 'New Meeting'
    };

    try {
      const meetingsRef = ref(database, 'meetings');
      const newMeetingRef = push(meetingsRef);
      await set(newMeetingRef, newMeeting);
      setShowModal(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
    }
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="calendar-wrapper bg-gray-900 text-white p-6 rounded-lg">
      <div className="calendar-header flex justify-between items-center mb-6">
        <button 
          onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
          className="bg-gray-800 p-2 rounded hover:bg-gray-700"
        >
          &lt;
        </button>
        <h2 className="text-xl font-semibold">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button 
          onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
          className="bg-gray-800 p-2 rounded hover:bg-gray-700"
        >
          &gt;
        </button>
      </div>

      <div className="calendar-grid grid grid-cols-7 gap-2">
        {DAYS.map(day => (
          <div key={day} className="text-center text-gray-400 py-2">
            {day.slice(0, 3)}
          </div>
        ))}

        {generateCalendarDays().map((dayInfo, index) => (
          <div
            key={`${dayInfo.date}-${index}`}
            className={`
              p-2 min-h-[80px] rounded cursor-pointer
              ${dayInfo.type === 'empty' ? 'bg-transparent' : 
                dayInfo.type === 'past' ? 'bg-gray-800 opacity-50' :
                dayInfo.type === 'scheduled' ? 'bg-blue-900' : 'bg-gray-800'}
              hover:bg-gray-700
            `}
            onClick={() => {
              if (dayInfo.type !== 'empty' && dayInfo.type !== 'past') {
                setSelectedDate(dayInfo);
                setShowModal(true);
              }
            }}
          >
            <span className="block text-right mb-2">{dayInfo.day}</span>
            {dayInfo.meetings?.map((meeting, idx) => (
              <div 
                key={idx}
                className="text-xs bg-blue-800 p-1 rounded mb-1 truncate"
              >
                {formatTime(meeting.time)} - {meeting.title}
              </div>
            ))}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selectedDate.date} - {selectedDate.meetings?.length ? 'Meetings' : 'New Meeting'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                ×
              </button>
            </div>

            {selectedDate.meetings?.length ? (
              <div className="space-y-2">
                {selectedDate.meetings.map((meeting, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                    <div>
                      <div className="font-medium">{meeting.title}</div>
                      <div className="text-sm text-gray-400">
                        {formatTime(meeting.time)} - {meeting.location}
                      </div>
                    </div>
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                      {meeting.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full bg-gray-700 rounded p-2"
                  />
                </div>
                <button
                  onClick={handleScheduleSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded"
                >
                  Schedule Meeting
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventCalendar;
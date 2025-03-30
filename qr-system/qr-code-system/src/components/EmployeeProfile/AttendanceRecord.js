// src/components/AttendanceRecord.jsx
import React from 'react';
import { Trash2 } from 'lucide-react';
import { safeFormatDate, formatHours } from '../utils/dateUtils';

const AttendanceRecord = ({ record, onDelete }) => {
  // Display the clock-in time safely
  const clockInTime = safeFormatDate(record.clockInTime, 'MMM D, YYYY h:mm A', 'Unknown');
  
  // Display the clock-out time safely
  const clockOutTime = safeFormatDate(record.clockOutTime, 'h:mm A', 'Not clocked out');
  
  // Calculate hours worked safely
  let hoursWorked;
  if (record.hoursWorked !== undefined && !isNaN(parseFloat(record.hoursWorked))) {
    // Use pre-calculated hours if available and valid
    hoursWorked = formatHours(record.hoursWorked);
  } else if (record.clockInTime && record.clockOutTime) {
    // Calculate hours if both times exist
    const hours = (new Date(record.clockOutTime) - new Date(record.clockInTime)) / (1000 * 60 * 60);
    if (!isNaN(hours) && isFinite(hours)) {
      hoursWorked = formatHours(hours);
    } else {
      hoursWorked = 'N/A';
    }
  } else {
    // Default if we can't calculate
    hoursWorked = 'N/A';
  }

  // Format date for display (Mar 28, 2025)
  const displayDate = safeFormatDate(record.date || record.clockInTime, 'MMM D, YYYY', 'Unknown Date');
  
  // Time status (On Time, Late, etc.)
  const timeStatus = record.status || 'On Time';
  
  // Event type or category (if available)
  const eventType = record.eventType || record.originalEventType || '';
  const eventTitle = record.eventTitle || '';

  // Only display time part from clock-in time (e.g., "3:45 PM")
  const clockInTimePart = clockInTime.includes(' ') ? 
    clockInTime.split(' ').slice(-2).join(' ') : clockInTime;
  
  return (
    <div className="attendance-record flex justify-between items-center p-3 border-b border-gray-700">
      <div className="flex-1">
        <div className="font-medium text-white">{displayDate}</div>
        <div className="text-sm text-gray-300">
          {clockInTimePart} - {clockOutTime}
        </div>
        <div className="text-sm font-medium text-blue-400">{hoursWorked}</div>
        {(eventType || eventTitle) && (
          <div className="text-xs text-gray-400 mt-1">
            {eventTitle}{eventType && eventTitle ? ' • ' : ''}{eventType}
          </div>
        )}
      </div>
      <div className="flex items-center">
        <span className="mr-3 text-green-400 text-sm">{timeStatus}</span>
        {onDelete && (
          <button 
            onClick={() => onDelete(record.id)}
            className="text-red-400 hover:text-red-300 transition-colors"
            aria-label="Delete record"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AttendanceRecord;
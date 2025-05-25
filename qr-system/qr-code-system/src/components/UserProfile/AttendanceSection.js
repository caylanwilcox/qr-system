// src/components/UserProfile/AttendanceSection.js
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, AlertCircle, CheckCircle, RefreshCw, Calendar } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import moment from 'moment-timezone';

// Helper to get current time in Chicago timezone (matching your QR Scanner)
const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

const AttendanceSection = ({ employeeId, viewOnly = false }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to determine status color based on clock in time
  const getStatusColor = (clockIn, expectedTime = '09:00') => {
    if (!clockIn) return 'text-red-400';
    
    // Parse times for comparison
    const clockInTime = new Date(`2000-01-01 ${clockIn}`);
    const expectedDateTime = new Date(`2000-01-01 ${expectedTime}`);
    const lateDateTime = new Date(`2000-01-01 09:15`);
    
    // On time - green, slightly late - yellow, very late - red
    if (clockInTime <= expectedDateTime) return 'text-emerald-400';
    if (clockInTime <= lateDateTime) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Status badge component with consistent styling
  const StatusBadge = ({ clockInTime }) => {
    if (!clockInTime) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                       bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle className="w-3 h-3" />
          Absent
        </span>
      );
    }

    // Parse times for comparison
    const clockInTime9AM = new Date(`2000-01-01 ${clockInTime}`);
    const expectedTime = new Date(`2000-01-01 09:00`);
    const lateTime = new Date(`2000-01-01 09:15`);

    if (clockInTime9AM > lateTime) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                       bg-red-500/10 text-red-400 border border-red-500/20">
          <Clock className="w-3 h-3" />
          Late
        </span>
      );
    }

    if (clockInTime9AM > expectedTime) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                       bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" />
          Slightly Late
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                     bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="w-3 h-3" />
        On Time
      </span>
    );
  };

  // Format attendance records from clock-in/clock-out times
  const formatAttendanceRecords = (clockInTimes, clockOutTimes) => {
    if (!clockInTimes || Object.keys(clockInTimes).length === 0) {
      return [];
    }

    return Object.keys(clockInTimes).map(timestamp => {
      // Convert timestamp to proper date
      const date = new Date(parseInt(timestamp));
      // Use Chicago timezone to get the correct date
      const chicagoTime = getChicagoTime();
      chicagoTime.set({
        year: date.getFullYear(),
        month: date.getMonth(),
        date: date.getDate()
      });
      const formattedDate = chicagoTime.format('YYYY-MM-DD');
      
      const clockInTime = clockInTimes[timestamp];
      let clockOutTime = null;
      let hoursWorked = null;
      
      // First try exact timestamp match
      if (clockOutTimes?.[timestamp]) {
        clockOutTime = clockOutTimes[timestamp];
      } else {
        // If no exact match, find the closest clock-out time after this clock-in
        const clockInTimestamp = parseInt(timestamp);
        const clockOutTimestamps = Object.keys(clockOutTimes || {})
          .map(ts => parseInt(ts))
          .filter(ts => ts > clockInTimestamp) // Only consider clock-outs after clock-in
          .sort((a, b) => a - b); // Sort ascending to get the closest one
        
        if (clockOutTimestamps.length > 0) {
          const closestClockOutTimestamp = clockOutTimestamps[0];
          // Only use if it's within a reasonable time frame (e.g., 24 hours)
          if (closestClockOutTimestamp - clockInTimestamp < 24 * 60 * 60 * 1000) {
            clockOutTime = clockOutTimes[closestClockOutTimestamp.toString()];
          }
        }
      }
      
      // Calculate hours worked if both clock-in and clock-out times exist
      if (clockInTime && clockOutTime) {
        try {
          const inParts = clockInTime.split(/[:\s]/);
          const outParts = clockOutTime.split(/[:\s]/);
          
          const inDate = new Date();
          inDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), 0);
          
          const outDate = new Date();
          outDate.setHours(parseInt(outParts[0]), parseInt(outParts[1]), 0);
          
          // Handle AM/PM if present
          if (clockInTime.toLowerCase().includes('pm') && parseInt(inParts[0]) !== 12) {
            inDate.setHours(inDate.getHours() + 12);
          }
          if (clockOutTime.toLowerCase().includes('pm') && parseInt(outParts[0]) !== 12) {
            outDate.setHours(outDate.getHours() + 12);
          }
          
          // If clock-out is earlier than clock-in, assume next day
          if (outDate < inDate) {
            outDate.setDate(outDate.getDate() + 1);
          }
          
          const diffMs = outDate - inDate;
          hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
        } catch (e) {
          console.error('Error calculating hours worked:', e);
        }
      }
      
      return {
        timestamp,
        date: formattedDate, // Use properly formatted date
        clockInTime,
        clockOutTime,
        hoursWorked
      };
    });
  };

  // Fetch from attendance nodes
  const fetchAttendanceFromNodes = async () => {
    if (!employeeId) return [];
    
    try {
      const attendanceRef = ref(database, 'attendance');
      const attendanceSnapshot = await get(attendanceRef);
      
      if (!attendanceSnapshot.exists()) return [];
      
      const attendanceData = attendanceSnapshot.val();
      const records = [];
      
      // Iterate through all locations
      for (const location in attendanceData) {
        // Check regular attendance records
        if (attendanceData[location] && typeof attendanceData[location] === 'object') {
          for (const date in attendanceData[location]) {
            // Skip if it's the meetings node
            if (date === 'meetings') continue;
            
            // Check if this date node has entries for this employee
            const dateNode = attendanceData[location][date];
            
            if (dateNode && typeof dateNode === 'object') {
              // Iterate through all timestamps for this date
              for (const timestampKey in dateNode) {
                const record = dateNode[timestampKey];
                
                // Only include records for this employee
                if (record && record.userId === employeeId && record.clockInTime) {
                  // Handle different time formats - check if it's already in readable format or ISO
                  let clockInTime = record.clockInTime;
                  let clockOutTime = record.clockOutTime || null;
                  let hoursWorked = record.hoursWorked || null;
                  
                  // If clockInTime is an ISO string, convert it to readable format
                  if (record.clockInTime && record.clockInTime.includes('T')) {
                    try {
                      const clockInDateTime = new Date(record.clockInTime);
                      clockInTime = clockInDateTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      });
                    } catch (e) {
                      console.error('Error parsing clock-in time:', e);
                      clockInTime = record.clockInTime; // fallback to original
                    }
                  }
                  
                  // If clockOutTime is an ISO string, convert it to readable format
                  if (record.clockOutTime && record.clockOutTime.includes('T')) {
                    try {
                      const clockOutDateTime = new Date(record.clockOutTime);
                      clockOutTime = clockOutDateTime.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      });
                      
                      // Calculate hours if we have both times and no existing hours
                      if (!hoursWorked) {
                        const inDateTime = new Date(record.clockInTime);
                        const outDateTime = new Date(record.clockOutTime);
                        const diffMs = outDateTime - inDateTime;
                        hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
                      }
                    } catch (e) {
                      console.error('Error parsing clock-out time:', e);
                      clockOutTime = record.clockOutTime; // fallback to original
                    }
                  }
                  
                  // Use the record's timestamp if available, otherwise create one
                  const recordTimestamp = record.clockInTimestamp || 
                                        parseInt(timestampKey) ||
                                        new Date().getTime();
                  
                  // Ensure we use the correct date from the path, not from parsing times
                  const correctDate = date; // This comes from the database path structure
                  
                  records.push({
                    timestamp: recordTimestamp.toString(),
                    date: correctDate, // Use the date from the database path
                    clockInTime,
                    clockOutTime,
                    hoursWorked,
                    location,
                    eventType: record.eventType || null,
                    isLate: record.isLate || false,
                    onTime: record.onTime || true,
                    attendanceRecordId: `${location}/${date}/${timestampKey}`
                  });
                }
              }
            }
          }
        }
        
        // Check meetings attendance (similar approach)
        if (attendanceData[location]?.meetings) {
          for (const meetingType in attendanceData[location].meetings) {
            for (const date in attendanceData[location].meetings[meetingType]) {
              const dateNode = attendanceData[location].meetings[meetingType][date];
              
              if (dateNode && typeof dateNode === 'object') {
                // Iterate through all timestamps for this date
                for (const timestampKey in dateNode) {
                  const record = dateNode[timestampKey];
                  
                  // Only include records for this employee
                  if (record && record.userId === employeeId && record.clockInTime) {
                    // Handle different time formats - check if it's already in readable format or ISO
                    let clockInTime = record.clockInTime;
                    let clockOutTime = record.clockOutTime || null;
                    let hoursWorked = record.hoursWorked || null;
                    
                    // If clockInTime is an ISO string, convert it to readable format
                    if (record.clockInTime && record.clockInTime.includes('T')) {
                      try {
                        const clockInDateTime = new Date(record.clockInTime);
                        clockInTime = clockInDateTime.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        });
                      } catch (e) {
                        console.error('Error parsing clock-in time:', e);
                        clockInTime = record.clockInTime; // fallback to original
                      }
                    }
                    
                    // If clockOutTime is an ISO string, convert it to readable format
                    if (record.clockOutTime && record.clockOutTime.includes('T')) {
                      try {
                        const clockOutDateTime = new Date(record.clockOutTime);
                        clockOutTime = clockOutDateTime.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        });
                        
                        // Calculate hours if we have both times and no existing hours
                        if (!hoursWorked) {
                          const inDateTime = new Date(record.clockInTime);
                          const outDateTime = new Date(record.clockOutTime);
                          const diffMs = outDateTime - inDateTime;
                          hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
                        }
                      } catch (e) {
                        console.error('Error parsing clock-out time:', e);
                        clockOutTime = record.clockOutTime; // fallback to original
                      }
                    }
                    
                    // Use the record's timestamp if available, otherwise create one
                    const recordTimestamp = record.clockInTimestamp || 
                                          parseInt(timestampKey) ||
                                          new Date().getTime();
                    
                    // Ensure we use the correct date from the path, not from parsing times
                    const correctDate = date; // This comes from the database path structure
                    
                    records.push({
                      timestamp: recordTimestamp.toString(),
                      date: correctDate, // Use the date from the database path
                      clockInTime,
                      clockOutTime,
                      hoursWorked,
                      location: `${location} - ${meetingType}`,
                      eventType: record.eventType || null,
                      isLate: record.isLate || false,
                      onTime: record.onTime || true,
                      attendanceRecordId: `${location}/meetings/${meetingType}/${date}/${timestampKey}`
                    });
                  }
                }
              }
            }
          }
        }
      }
      
      return records;
    } catch (err) {
      console.error('Error fetching attendance from nodes:', err);
      return [];
    }
  };

  // Fetch attendance records directly from the database
  const fetchAttendanceRecords = async () => {
    if (!employeeId) {
      console.error('No employeeId provided');
      setError('Employee ID is missing');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching attendance records for employee: ${employeeId}`);
      
      // Get clock-in times from the database
      const clockInRef = ref(database, `users/${employeeId}/clockInTimes`);
      const clockInSnapshot = await get(clockInRef);
      const clockInTimes = clockInSnapshot.exists() ? clockInSnapshot.val() : {};
      
      console.log('Clock-in times retrieved:', clockInTimes);
      
      // Get clock-out times from the database
      const clockOutRef = ref(database, `users/${employeeId}/clockOutTimes`);
      const clockOutSnapshot = await get(clockOutRef);
      const clockOutTimes = clockOutSnapshot.exists() ? clockOutSnapshot.val() : {};
      
      console.log('Clock-out times retrieved:', clockOutTimes);
      
      // Get attendance records from user's attendance object (where QR scanner stores data)
      const userAttendanceRef = ref(database, `users/${employeeId}/attendance`);
      const userAttendanceSnapshot = await get(userAttendanceRef);
      const userAttendance = userAttendanceSnapshot.exists() ? userAttendanceSnapshot.val() : {};
      
      console.log('User attendance records retrieved:', userAttendance);
      
      // Format records from clockIn/clockOut
      const formattedRecords = formatAttendanceRecords(clockInTimes, clockOutTimes);
      
      // Format records from user's attendance object
      const attendanceRecords = Object.entries(userAttendance).map(([date, record]) => {
        if (!record || typeof record !== 'object') return null;
        
        // Skip if no clock-in time
        if (!record.clockInTime) return null;
        
        // Ensure date is in proper YYYY-MM-DD format
        let formattedDate = date;
        if (date.includes('T')) {
          // If date is an ISO string, convert it to YYYY-MM-DD
          try {
            const dateObj = new Date(date);
            formattedDate = dateObj.toISOString().split('T')[0];
          } catch (e) {
            console.error('Error parsing date:', e);
            formattedDate = new Date().toISOString().split('T')[0]; // fallback to today
          }
        }
        
        // Create a timestamp for this record
        let timestamp;
        if (record.clockInTimestamp) {
          timestamp = record.clockInTimestamp.toString();
        } else {
          // Create timestamp from date and time
          try {
            const dateTime = new Date(`${formattedDate} ${record.clockInTime}`);
            timestamp = dateTime.getTime().toString();
          } catch (e) {
            timestamp = new Date(formattedDate).getTime().toString();
          }
        }
        
        // Get clock-out time - use only what's in the record itself (most reliable)
        let clockOutTime = record.clockOutTime || null;
        let hoursWorked = record.hoursWorked || null;
        
        // Normalize time formats - handle both formatted strings and ISO strings
        let normalizedClockInTime = record.clockInTime;
        let normalizedClockOutTime = clockOutTime;
        
        // If clockInTime looks like an ISO string, convert it to readable format
        if (record.clockInTime && record.clockInTime.includes('T')) {
          try {
            const date = new Date(record.clockInTime);
            normalizedClockInTime = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
          } catch (e) {
            console.error('Error parsing clock-in time:', e);
          }
        }
        
        // If clockOutTime looks like an ISO string, convert it to readable format
        if (clockOutTime && clockOutTime.includes('T')) {
          try {
            const date = new Date(clockOutTime);
            normalizedClockOutTime = date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
          } catch (e) {
            console.error('Error parsing clock-out time:', e);
          }
        }
        
        // Calculate hours worked if both times exist and not already calculated
        if (normalizedClockInTime && normalizedClockOutTime && !hoursWorked) {
          try {
            // Parse the times properly
            let inDate, outDate;
            
            if (record.clockInTime.includes('T')) {
              inDate = new Date(record.clockInTime);
            } else {
              inDate = new Date(`${formattedDate} ${record.clockInTime}`);
            }
            
            if (record.clockOutTime && record.clockOutTime.includes('T')) {
              outDate = new Date(record.clockOutTime);
            } else if (record.clockOutTime) {
              outDate = new Date(`${formattedDate} ${record.clockOutTime}`);
            }
            
            if (inDate && outDate) {
              const diffMs = outDate - inDate;
              hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
            }
          } catch (e) {
            console.error('Error calculating hours worked:', e);
          }
        }
        
        return {
          timestamp,
          date: formattedDate, // Use properly formatted date
          clockInTime: normalizedClockInTime,
          clockOutTime: normalizedClockOutTime,
          hoursWorked,
          location: record.locationName || record.location || null,
          eventType: record.eventType || null,
          isLate: record.isLate || false,
          onTime: record.onTime || false
        };
      }).filter(Boolean); // Remove null entries
      
      // Also fetch records from attendance nodes
      const attendanceNodeRecords = await fetchAttendanceFromNodes();
      
      // Combine all sets of records
      const allRecords = [...formattedRecords, ...attendanceRecords, ...attendanceNodeRecords];
      
      console.log('Combined records:', allRecords);
      
      // Remove duplicates based on date and approximate time (keep the most complete record)
      const uniqueRecords = [];
      const seenKeys = new Set();
      
      // Sort by completeness (records with clock-out times first, then by hours worked, then by location)
      allRecords.sort((a, b) => {
        const aComplete = (a.clockOutTime ? 4 : 0) + (a.hoursWorked ? 2 : 0) + (a.location ? 1 : 0);
        const bComplete = (b.clockOutTime ? 4 : 0) + (b.hoursWorked ? 2 : 0) + (b.location ? 1 : 0);
        return bComplete - aComplete;
      });
      
      for (const record of allRecords) {
        // Check for duplicates by date only (more aggressive deduplication)
        const recordDate = record.date;
        
        // Skip records with invalid times (NaN)
        if (record.clockInTime && (record.clockInTime.includes('NaN') || record.clockInTime === 'NaN:NaN')) {
          console.log(`Skipping record with invalid clock-in time: ${record.clockInTime}`);
          continue;
        }
        
        if (record.clockOutTime && (record.clockOutTime.includes('NaN') || record.clockOutTime === 'NaN:NaN')) {
          console.log(`Skipping record with invalid clock-out time: ${record.clockOutTime}`);
          continue;
        }
        
        // Use date as the primary key for deduplication
        const key = recordDate;
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueRecords.push(record);
          console.log(`Added record: ${recordDate} ${record.clockInTime} - Clock Out: ${record.clockOutTime || 'None'} - Hours: ${record.hoursWorked || 'None'}`);
        } else {
          console.log(`Skipped duplicate: ${recordDate} ${record.clockInTime} - Clock Out: ${record.clockOutTime || 'None'} - Hours: ${record.hoursWorked || 'None'}`);
        }
      }
      
      // Sort records by date (most recent first) and then by time
      uniqueRecords.sort((a, b) => {
        // First compare dates
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        
        // If same date, compare by timestamp
        return parseInt(b.timestamp) - parseInt(a.timestamp);
      });
      
      // Update the state with the formatted records
      setAttendanceRecords(uniqueRecords);

      // If no records and no errors, show a more specific message in the UI
      if (uniqueRecords.length === 0) {
        console.log('No attendance records found for this user');
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setError(`Failed to load attendance records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch records on component mount or when employeeId changes
  useEffect(() => {
    if (employeeId) {
      console.log(`Initial fetch for employee ID: ${employeeId}`);
      fetchAttendanceRecords();
    } else {
      console.log('No employee ID available for initial fetch');
    }
  }, [employeeId]);

  return (
    <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-glass-light">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-white/90">My Attendance Records</h2>
            <p className="text-sm text-white/60 mt-1">
              Showing {attendanceRecords.length} attendance records
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchAttendanceRecords}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30
                      transition-all duration-200"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-md border border-red-500/20">
            {error}
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="p-6">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                             border-b border-glass-light">
                  Date
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                             border-b border-glass-light">
                  Clock In
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                             border-b border-glass-light">
                  Clock Out
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                             border-b border-glass-light">
                  Hours
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                             border-b border-glass-light">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-light">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-2" />
                      <span className="text-sm text-white/70">Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : attendanceRecords.length > 0 ? (
                attendanceRecords.map(record => (
                  <tr 
                    key={record.timestamp}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-white/90">
                      {record.date ? format(new Date(record.date), 'MMM dd, yyyy') : 'N/A'}
                      {record.location && (
                        <div className="text-xs text-white/50 mt-1">{record.location}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-sm ${getStatusColor(record.clockInTime)}`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-mono">
                          {record.clockInTime || 'Not Clocked In'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-white/70">
                        <Clock className="w-4 h-4" />
                        <span className="font-mono">
                          {record.clockOutTime || 'Not Clocked Out'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      {record.hoursWorked ? (
                        <span className="text-white/90">{record.hoursWorked}h</span>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge clockInTime={record.clockInTime} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan="5" 
                    className="px-6 py-8 text-center text-sm text-white/50"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Calendar className="w-8 h-8 text-white/30" />
                      <div>
                        <p className="font-medium text-white/70 mb-1">No attendance records found</p>
                        <p>You have no clock-in/clock-out history yet.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSection;
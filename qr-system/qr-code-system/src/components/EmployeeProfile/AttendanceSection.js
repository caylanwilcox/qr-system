import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Trash2, Clock, AlertCircle, CheckCircle, RefreshCw, Calendar, Plus } from 'lucide-react';
import { ref, get, set, remove, update, serverTimestamp } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import moment from 'moment-timezone';

// Helper to get current time in Chicago timezone (matching your QR Scanner)
const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

const AttendanceSection = ({
  attendanceRecords: initialRecords = [],
  deleteConfirm,
  onDeleteRecord,
  employeeId
}) => {
  const [attendanceRecords, setAttendanceRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    clockInTime: '09:00',
    clockOutTime: '17:00'
  });

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

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRecord(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle adding a new attendance record
  const handleAddRecord = async () => {
    if (!employeeId) {
      setError('Employee ID is missing');
      return;
    }

    setLoading(true);
    try {
      // Generate a unique timestamp for this record
      const timestamp = new Date(newRecord.date).getTime();
      // Add a random number to ensure uniqueness (in case multiple records are added for the same day)
      const uniqueTimestamp = timestamp + Math.floor(Math.random() * 10000);
      
      // Format the times to match your QR scanner format
      const now = getChicagoTime().toISOString();
      
      // Add the clock-in time
      await set(ref(database, `users/${employeeId}/clockInTimes/${uniqueTimestamp}`), newRecord.clockInTime);
      
      // Add the clock-out time if provided
      if (newRecord.clockOutTime) {
        await set(ref(database, `users/${employeeId}/clockOutTimes/${uniqueTimestamp}`), newRecord.clockOutTime);
      }
      
      // Calculate hours worked during this session if both times are provided
      if (newRecord.clockInTime && newRecord.clockOutTime) {
        const inParts = newRecord.clockInTime.split(':');
        const outParts = newRecord.clockOutTime.split(':');
        
        const inDate = new Date();
        inDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), 0);
        
        const outDate = new Date();
        outDate.setHours(parseInt(outParts[0]), parseInt(outParts[1]), 0);
        
        // If clock-out is earlier than clock-in, assume next day
        if (outDate < inDate) {
          outDate.setDate(outDate.getDate() + 1);
        }
        
        const hoursWorked = (outDate - inDate) / (1000 * 60 * 60); // Convert ms to hours
        
        // Update total hours in stats
        const statsRef = ref(database, `users/${employeeId}/stats`);
        const statsSnapshot = await get(statsRef);
        const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
        
        await update(statsRef, {
          totalHours: (currentStats.totalHours || 0) + hoursWorked,
          lastClockIn: now,
          lastClockOut: now,
          daysPresent: (currentStats.daysPresent || 0) + 1
        });
      }
      
      // Reset form and refresh records
      setShowAddForm(false);
      setNewRecord({
        date: new Date().toISOString().split('T')[0],
        clockInTime: '09:00',
        clockOutTime: '17:00'
      });
      
      // Refresh attendance records
      await fetchAttendanceRecords();
    } catch (err) {
      console.error('Error adding attendance record:', err);
      setError(`Failed to add record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format attendance records from clock-in/clock-out times
  const formatAttendanceRecords = (clockInTimes, clockOutTimes) => {
    if (!clockInTimes || Object.keys(clockInTimes).length === 0) {
      return [];
    }

    return Object.keys(clockInTimes).map(timestamp => {
      const date = new Date(parseInt(timestamp));
      const clockInTime = clockInTimes[timestamp];
      const clockOutTime = clockOutTimes?.[timestamp] || null;
      
      // Calculate hours worked if both clock-in and clock-out times exist
      let hoursWorked = null;
      if (clockInTime && clockOutTime) {
        const inParts = clockInTime.split(':');
        const outParts = clockOutTime.split(':');
        
        const inDate = new Date();
        inDate.setHours(parseInt(inParts[0]), parseInt(inParts[1]), 0);
        
        const outDate = new Date();
        outDate.setHours(parseInt(outParts[0]), parseInt(outParts[1]), 0);
        
        // If clock-out is earlier than clock-in, assume next day
        if (outDate < inDate) {
          outDate.setDate(outDate.getDate() + 1);
        }
        
        const diffMs = outDate - inDate;
        hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
      }
      
      return {
        timestamp,
        date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
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
            // Note: Now each date might have multiple timestamp-based entries
            const dateNode = attendanceData[location][date];
            
            if (dateNode && typeof dateNode === 'object') {
              // Iterate through all timestamps for this date
              for (const timestampKey in dateNode) {
                const record = dateNode[timestampKey];
                
                // Only include records for this employee
                if (record && record.userId === employeeId && record.clockInTime) {
                  // Parse time from ISO string
                  const clockInDateTime = new Date(record.clockInTime);
                  const clockInTime = `${String(clockInDateTime.getHours()).padStart(2, '0')}:${String(clockInDateTime.getMinutes()).padStart(2, '0')}`;
                  
                  // Parse clockOutTime if exists
                  let clockOutTime = null;
                  let hoursWorked = null;
                  
                  if (record.clockOutTime) {
                    const clockOutDateTime = new Date(record.clockOutTime);
                    clockOutTime = `${String(clockOutDateTime.getHours()).padStart(2, '0')}:${String(clockOutDateTime.getMinutes()).padStart(2, '0')}`;
                    
                    // Calculate hours if we have both times
                    if (record.hoursWorked) {
                      hoursWorked = record.hoursWorked;
                    } else {
                      const diffMs = clockOutDateTime - clockInDateTime;
                      hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
                    }
                  }
                  
                  // Use the record's timestamp if available, otherwise create one
                  const recordTimestamp = record.clockInTimestamp || 
                                        (new Date(`${date} ${clockInTime}`).getTime()) || 
                                        parseInt(timestampKey);
                  
                  records.push({
                    timestamp: recordTimestamp.toString(),
                    date: date,
                    clockInTime,
                    clockOutTime,
                    hoursWorked,
                    location,
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
                    // Parse time from ISO string
                    const clockInDateTime = new Date(record.clockInTime);
                    const clockInTime = `${String(clockInDateTime.getHours()).padStart(2, '0')}:${String(clockInDateTime.getMinutes()).padStart(2, '0')}`;
                    
                    // Parse clockOutTime if exists
                    let clockOutTime = null;
                    let hoursWorked = null;
                    
                    if (record.clockOutTime) {
                      const clockOutDateTime = new Date(record.clockOutTime);
                      clockOutTime = `${String(clockOutDateTime.getHours()).padStart(2, '0')}:${String(clockOutDateTime.getMinutes()).padStart(2, '0')}`;
                      
                      // Calculate hours if we have both times
                      if (record.hoursWorked) {
                        hoursWorked = record.hoursWorked;
                      } else {
                        const diffMs = clockOutDateTime - clockInDateTime;
                        hoursWorked = (diffMs / 1000 / 60 / 60).toFixed(2);
                      }
                    }
                    
                    // Use the record's timestamp if available, otherwise create one
                    const recordTimestamp = record.clockInTimestamp || 
                                          (new Date(`${date} ${clockInTime}`).getTime()) || 
                                          parseInt(timestampKey);
                    
                    records.push({
                      timestamp: recordTimestamp.toString(),
                      date: date,
                      clockInTime,
                      clockOutTime,
                      hoursWorked,
                      location: `${location} - ${meetingType}`,
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
    
    // Format records from clockIn/clockOut
    const formattedRecords = formatAttendanceRecords(clockInTimes, clockOutTimes);
    
    // Also fetch records from attendance nodes
    const attendanceNodeRecords = await fetchAttendanceFromNodes();
    
    // Combine both sets of records
    const allRecords = [...formattedRecords, ...attendanceNodeRecords];
    
    console.log('Combined records:', allRecords);
    
    // Sort records by date (most recent first) and then by time
    allRecords.sort((a, b) => {
      // First compare dates
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, compare by timestamp
      return parseInt(b.timestamp) - parseInt(a.timestamp);
    });
    
    // No longer remove duplicates - we want to show all clock-ins
    // Update the state with the formatted records
    setAttendanceRecords(allRecords);

    // If no records and no errors, show a more specific message in the UI
    if (allRecords.length === 0) {
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

// Handle record deletion - support both formats
const handleDeleteRecord = async (timestamp, recordId) => {
  if (!employeeId) {
    setError('Employee ID is missing');
    return;
  }

  try {
    if (deleteConfirm !== timestamp) {
      // First click - ask for confirmation
      if (onDeleteRecord) {
        onDeleteRecord(timestamp);
      }
      return;
    }

    // If using the normal clock-in/clock-out structure
    if (!recordId) {
      await remove(ref(database, `users/${employeeId}/clockInTimes/${timestamp}`));
      await remove(ref(database, `users/${employeeId}/clockOutTimes/${timestamp}`));
    } else {
      // If using the attendance node structure
      await remove(ref(database, `attendance/${recordId}`));
    }

    // Update the local state to remove this record
    setAttendanceRecords(prev => prev.filter(record => record.timestamp !== timestamp));
    
    // Reset confirmation state (handled in parent)
    if (onDeleteRecord) {
      onDeleteRecord(null);
    }
  } catch (err) {
    console.error('Error deleting record:', err);
    setError(`Failed to delete record: ${err.message}`);
  }
};

return (
  <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
    {/* Header */}
    <div className="p-6 border-b border-glass-light">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Attendance Records</h2>
          <p className="text-sm text-white/60 mt-1">
            Showing {attendanceRecords.length} attendance records
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                    bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30
                    transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Record
          </button>
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

      {/* Add Record Form */}
      {showAddForm && (
        <div className="mt-4 p-4 bg-glass-dark backdrop-blur border border-glass-light rounded-lg">
          <h3 className="text-sm font-medium text-white/90 mb-3">Add New Attendance Record</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-white/70 mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={newRecord.date}
                onChange={handleInputChange}
                className="w-full bg-glass-dark border border-glass-light rounded-lg px-3 py-2 text-sm text-white/90"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Clock In Time</label>
              <input
                type="time"
                name="clockInTime"
                value={newRecord.clockInTime}
                onChange={handleInputChange}
                className="w-full bg-glass-dark border border-glass-light rounded-lg px-3 py-2 text-sm text-white/90"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Clock Out Time</label>
              <input
                type="time"
                name="clockOutTime"
                value={newRecord.clockOutTime}
                onChange={handleInputChange}
                className="w-full bg-glass-dark border border-glass-light rounded-lg px-3 py-2 text-sm text-white/90"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      bg-glass-light text-white/70 hover:bg-white/10
                      transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddRecord}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                      bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30
                      transition-all duration-200"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Record'}
            </button>
          </div>
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
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 
                           border-b border-glass-light">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-light">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center">
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
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDeleteRecord(record.timestamp, record.attendanceRecordId)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium 
                                transition-all duration-200 ${
                        deleteConfirm === record.timestamp
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                          : 'bg-glass-light text-white/70 hover:text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {deleteConfirm === record.timestamp ? (
                        'Confirm Delete'
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan="6" 
                  className="px-6 py-8 text-center text-sm text-white/50"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Calendar className="w-8 h-8 text-white/30" />
                    <div>
                      <p className="font-medium text-white/70 mb-1">No attendance records found</p>
                      <p>This employee has no clock-in/clock-out history. You can add records manually.</p>
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
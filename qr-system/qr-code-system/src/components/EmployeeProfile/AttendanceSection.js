import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Trash2, Clock, AlertCircle, CheckCircle, RefreshCw, Calendar, Plus, MapPin, Tag } from 'lucide-react';
import { ref, get, set, remove, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import moment from 'moment-timezone';

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
    date: moment().tz('America/Chicago').format('YYYY-MM-DD'), // Chicago timezone
    clockInTime: '09:00',
    clockOutTime: '17:00',
    eventType: 'general'
  });

  // Get current date in Chicago timezone
  const getChicagoDate = () => {
    return moment().tz('America/Chicago').format('YYYY-MM-DD');
  };

  // Get Chicago time from various inputs
  const getChicagoTime = () => {
    return moment().tz('America/Chicago');
  };

  // Convert timestamp to Chicago timezone date
  const timestampToChicagoDate = (timestamp) => {
    return moment(parseInt(timestamp)).tz('America/Chicago').format('YYYY-MM-DD');
  };

  // Status badge component
  const StatusBadge = ({ clockInTime, isLate }) => {
    if (!clockInTime) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                       bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle className="w-3 h-3" />
          Absent
        </span>
      );
    }

    if (isLate) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                       bg-red-500/10 text-red-400 border border-red-500/20">
          <Clock className="w-3 h-3" />
          Late
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

  // Get status color for clock in time
  const getStatusColor = (clockIn) => {
    if (!clockIn) return 'text-red-400';
    
    try {
      const clockInTime = new Date(`2000-01-01 ${clockIn}`);
      const expectedTime = new Date(`2000-01-01 09:00`);
      const lateTime = new Date(`2000-01-01 09:15`);
      
      if (clockInTime <= expectedTime) return 'text-emerald-400';
      if (clockInTime <= lateTime) return 'text-yellow-400';
      return 'text-red-400';
    } catch (e) {
      return 'text-red-400';
    }
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
      const now = moment().tz('America/Chicago');
      
      // FIXED: Create datetime in Chicago timezone to prevent date issues
      const clockInDateTime = moment.tz(`${newRecord.date} ${newRecord.clockInTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
      const timestamp = clockInDateTime.valueOf();
      
      let clockOutTimestamp = null;
      let hoursWorked = 0;
      
      if (newRecord.clockOutTime) {
        const clockOutDateTime = moment.tz(`${newRecord.date} ${newRecord.clockOutTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
        if (clockOutDateTime.isBefore(clockInDateTime)) {
          clockOutDateTime.add(1, 'day'); // Next day
        }
        clockOutTimestamp = clockOutDateTime.valueOf();
        hoursWorked = clockOutDateTime.diff(clockInDateTime, 'hours', true);
      }

      // FIXED: Use Chicago timezone for late calculation
      const isLate = moment.tz(`2000-01-01 ${newRecord.clockInTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago')
        .isAfter(moment.tz('2000-01-01 09:00', 'YYYY-MM-DD HH:mm', 'America/Chicago'));
      
      // FIXED: Create unique attendance record key to prevent overwriting
      const uniqueAttendanceKey = `${newRecord.date}_${timestamp}`;
      
      // Create attendance record
      const attendanceData = {
        clockedIn: newRecord.clockOutTime ? false : true, // If clock-out provided, set to false
        clockInTime: newRecord.clockInTime,
        clockInTimestamp: timestamp,
        isLate,
        onTime: !isLate,
        location: 'manual',
        locationName: 'Manual Entry',
        eventType: newRecord.eventType,
        date: newRecord.date,
        status: newRecord.clockOutTime ? 'completed' : 'clocked-in'
      };

      if (newRecord.clockOutTime) {
        attendanceData.clockedOut = true;
        attendanceData.clockOutTime = newRecord.clockOutTime;
        attendanceData.clockOutTimestamp = clockOutTimestamp;
        attendanceData.hoursWorked = hoursWorked.toFixed(2);
      }

      // FIXED: Save to database using unique key
      await set(ref(database, `users/${employeeId}/attendance/${uniqueAttendanceKey}`), attendanceData);

      // Also save to legacy format for compatibility
      await set(ref(database, `users/${employeeId}/clockInTimes/${timestamp}`), newRecord.clockInTime);
      if (clockOutTimestamp) {
        await set(ref(database, `users/${employeeId}/clockOutTimes/${clockOutTimestamp}`), newRecord.clockOutTime);
      }

      // Update stats only if this is the first record for the day
      const statsRef = ref(database, `users/${employeeId}/stats`);
      const statsSnapshot = await get(statsRef);
      const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
      
      // Check if there are already records for this date
      const userAttendanceRef = ref(database, `users/${employeeId}/attendance`);
      const userAttendanceSnapshot = await get(userAttendanceRef);
      const existingAttendance = userAttendanceSnapshot.exists() ? userAttendanceSnapshot.val() : {};
      
      const existingRecordsForDate = Object.keys(existingAttendance).filter(key => 
        key.startsWith(newRecord.date) && key !== uniqueAttendanceKey
      );
      
      const statsUpdate = {
        lastClockIn: now.toISOString()
      };

      // Only increment stats if this is the first record for this date
      if (existingRecordsForDate.length === 0) {
        statsUpdate.daysPresent = (currentStats.daysPresent || 0) + 1;
        
        if (isLate) {
          statsUpdate.daysLate = (currentStats.daysLate || 0) + 1;
        }
      }

      if (hoursWorked > 0) {
        statsUpdate.totalHours = (currentStats.totalHours || 0) + hoursWorked;
        statsUpdate.lastClockOut = now.toISOString();
      }

      await update(statsRef, statsUpdate);
      
      // Reset form and refresh
      setShowAddForm(false);
      setNewRecord({
        date: moment().tz('America/Chicago').format('YYYY-MM-DD'), // Chicago timezone
        clockInTime: '09:00',
        clockOutTime: '17:00',
        eventType: 'general'
      });
      
      await fetchAttendanceRecords();
    } catch (err) {
      console.error('Error adding attendance record:', err);
      setError(`Failed to add record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Format time from various formats to readable format
  const formatTime = (timeStr) => {
    if (!timeStr) return null;
    
    // If already in readable format (e.g., "09:15 AM"), return as-is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      return timeStr;
    }
    
    // If it's an ISO string
    if (timeStr.includes('T')) {
      try {
        return new Date(timeStr).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } catch (e) {
        console.error('Error parsing ISO time:', e);
        return timeStr;
      }
    }
    
    // If it's in HH:MM format, convert to 12-hour format
    if (timeStr.match(/^\d{2}:\d{2}$/)) {
      try {
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0);
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } catch (e) {
        console.error('Error parsing HH:MM time:', e);
        return timeStr;
      }
    }
    
    return timeStr;
  };

  // Main function to fetch attendance records - COMPLETELY REWRITTEN for proper clock-in/out handling
  const fetchAttendanceRecords = async () => {
    if (!employeeId) {
      setError('Employee ID is missing');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching attendance records for employee: ${employeeId}`);
      
      // Get attendance records from user's attendance object (primary source)
      const userAttendanceRef = ref(database, `users/${employeeId}/attendance`);
      const userAttendanceSnapshot = await get(userAttendanceRef);
      const userAttendance = userAttendanceSnapshot.exists() ? userAttendanceSnapshot.val() : {};
      
      console.log('User attendance records:', userAttendance);

      const records = [];
      const processedSessions = new Set(); // Track processed sessions to avoid duplicates

      // FIXED: Process attendance records with proper session grouping
      Object.entries(userAttendance).forEach(([attendanceKey, record]) => {
        if (!record || typeof record !== 'object') return;

        // Skip if already processed
        if (processedSessions.has(attendanceKey)) return;

        // Extract date from the key or record
        let formattedDate;
        if (attendanceKey.includes('_')) {
          // New format: YYYY-MM-DD_timestamp
          formattedDate = attendanceKey.split('_')[0];
        } else if (attendanceKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Old format: YYYY-MM-DD
          formattedDate = attendanceKey;
        } else if (record.date) {
          // Use date from record if available
          formattedDate = record.date;
        } else {
          console.warn('Could not determine date for attendance key:', attendanceKey);
          return;
        }

        // Validate date format
        if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn('Invalid date format for key:', attendanceKey, 'date:', formattedDate);
          return;
        }

        // FIXED: Use Chicago timezone for date parsing to prevent date shifting
        const recordDate = moment.tz(formattedDate, 'America/Chicago');
        const displayDate = recordDate.format('YYYY-MM-DD');

        // Format times
        const clockInTime = formatTime(record.clockInTime);
        const clockOutTime = formatTime(record.clockOutTime);

        // Calculate hours worked if both times exist
        let hoursWorked = record.hoursWorked;
        if (!hoursWorked && record.clockInTimestamp && record.clockOutTimestamp) {
          const diffMs = record.clockOutTimestamp - record.clockInTimestamp;
          hoursWorked = (diffMs / (1000 * 60 * 60)).toFixed(2);
        } else if (!hoursWorked && clockInTime && clockOutTime) {
          try {
            // Calculate hours using Chicago timezone
            const clockInMoment = moment.tz(`${displayDate} ${clockInTime}`, 'YYYY-MM-DD hh:mm A', 'America/Chicago');
            const clockOutMoment = moment.tz(`${displayDate} ${clockOutTime}`, 'YYYY-MM-DD hh:mm A', 'America/Chicago');
            
            // Handle next day clock-out
            if (clockOutMoment.isBefore(clockInMoment)) {
              clockOutMoment.add(1, 'day');
            }
            
            hoursWorked = clockOutMoment.diff(clockInMoment, 'hours', true).toFixed(2);
          } catch (e) {
            console.error('Error calculating hours:', e);
          }
        }

        // Create timestamp for this record
        let timestamp = record.clockInTimestamp || record.clockOutTimestamp;
        if (!timestamp) {
          try {
            // Extract timestamp from key if available
            const keyParts = attendanceKey.split('_');
            if (keyParts.length > 1 && !isNaN(keyParts[1])) {
              timestamp = parseInt(keyParts[1]);
            } else {
              // Create timestamp from date using Chicago timezone
              const chicagoDateTime = moment.tz(`${displayDate} ${clockInTime || '09:00'}`, 'YYYY-MM-DD HH:mm A', 'America/Chicago');
              timestamp = chicagoDateTime.valueOf();
            }
          } catch (e) {
            const chicagoDate = moment.tz(displayDate, 'America/Chicago');
            timestamp = chicagoDate.valueOf();
          }
        }

        // Determine record status and type
        let recordType = 'Unknown';
        let status = record.status || 'unknown';
        
        if (clockInTime && clockOutTime) {
          recordType = 'Complete Session';
          status = 'completed';
        } else if (clockInTime && !clockOutTime) {
          recordType = 'Clock In Only';
          status = record.status === 'clocked-in' ? 'clocked-in' : 'incomplete';
        } else if (!clockInTime && clockOutTime) {
          recordType = 'Clock Out Only';
          status = 'clock-out-only';
        }

        // Create the record
        const attendanceRecord = {
          timestamp: timestamp.toString(),
          date: displayDate,
          clockInTime,
          clockOutTime,
          hoursWorked,
          location: record.locationName || record.location || null,
          eventType: record.eventType || null,
          isLate: record.isLate || false,
          onTime: record.onTime || !record.isLate,
          source: 'QR Scanner',
          recordId: `attendance/${attendanceKey}`,
          originalKey: attendanceKey,
          recordType,
          status
        };

        records.push(attendanceRecord);
        processedSessions.add(attendanceKey);

        console.log(`Added record: ${displayDate} ${clockInTime || 'No clock-in'} -> ${clockOutTime || 'No clock-out'} (${recordType})`);
      });

      // FIXED: Get legacy records and process them properly
      if (records.length === 0) {
        console.log('No attendance records found, checking legacy clock times...');
        
        const clockInRef = ref(database, `users/${employeeId}/clockInTimes`);
        const clockInSnapshot = await get(clockInRef);
        const clockInTimes = clockInSnapshot.exists() ? clockInSnapshot.val() : {};
        
        const clockOutRef = ref(database, `users/${employeeId}/clockOutTimes`);
        const clockOutSnapshot = await get(clockOutRef);
        const clockOutTimes = clockOutSnapshot.exists() ? clockOutSnapshot.val() : {};

        // Group legacy times by Chicago timezone date
        const legacyByDate = {};

        // Process legacy clock-in times
        Object.entries(clockInTimes).forEach(([timestamp, clockInTime]) => {
          try {
            // FIXED: Use Chicago timezone for date calculation
            const recordMoment = moment(parseInt(timestamp)).tz('America/Chicago');
            const recordDate = recordMoment.format('YYYY-MM-DD');
            
            if (!legacyByDate[recordDate]) {
              legacyByDate[recordDate] = [];
            }

            legacyByDate[recordDate].push({
              timestamp,
              clockInTime,
              clockOutTime: clockOutTimes[timestamp] || null,
              recordDate,
              clockInTimestamp: parseInt(timestamp),
              clockOutTimestamp: clockOutTimes[timestamp] ? parseInt(timestamp) : null
            });
          } catch (e) {
            console.error('Error processing legacy timestamp:', timestamp, e);
          }
        });

        // Process legacy clock-out times that don't have corresponding clock-ins
        Object.entries(clockOutTimes).forEach(([timestamp, clockOutTime]) => {
          if (!clockInTimes[timestamp]) {
            try {
              // FIXED: Use Chicago timezone for date calculation
              const recordMoment = moment(parseInt(timestamp)).tz('America/Chicago');
              const recordDate = recordMoment.format('YYYY-MM-DD');
              
              if (!legacyByDate[recordDate]) {
                legacyByDate[recordDate] = [];
              }

              legacyByDate[recordDate].push({
                timestamp,
                clockInTime: null,
                clockOutTime,
                recordDate,
                clockInTimestamp: null,
                clockOutTimestamp: parseInt(timestamp)
              });
            } catch (e) {
              console.error('Error processing legacy clock-out timestamp:', timestamp, e);
            }
          }
        });

        // Convert legacy groups to records
        Object.entries(legacyByDate).forEach(([date, entries]) => {
          entries.forEach(entry => {
            let hoursWorked = null;

            if (entry.clockInTime && entry.clockOutTime) {
              try {
                // FIXED: Use Chicago timezone for hour calculation
                const chicagoInTime = moment.tz(`${date} ${entry.clockInTime}`, 'YYYY-MM-DD HH:mm A', 'America/Chicago');
                const chicagoOutTime = moment.tz(`${date} ${entry.clockOutTime}`, 'YYYY-MM-DD HH:mm A', 'America/Chicago');
                
                if (chicagoOutTime.isBefore(chicagoInTime)) {
                  chicagoOutTime.add(1, 'day'); // Next day
                }
                
                hoursWorked = chicagoOutTime.diff(chicagoInTime, 'hours', true).toFixed(2);
              } catch (e) {
                console.error('Error calculating hours:', e);
              }
            }

            const isLate = entry.clockInTime ? 
              moment.tz(`2000-01-01 ${entry.clockInTime}`, 'YYYY-MM-DD HH:mm A', 'America/Chicago').isAfter(
                moment.tz('2000-01-01 09:00', 'YYYY-MM-DD HH:mm', 'America/Chicago')
              ) : false;

            let recordType = 'Unknown';
            let status = 'legacy';
            
            if (entry.clockInTime && entry.clockOutTime) {
              recordType = 'Complete Session';
              status = 'completed';
            } else if (entry.clockInTime && !entry.clockOutTime) {
              recordType = 'Clock In Only';
              status = 'incomplete';
            } else if (!entry.clockInTime && entry.clockOutTime) {
              recordType = 'Clock Out Only';
              status = 'clock-out-only';
            }

            records.push({
              timestamp: entry.timestamp,
              date,
              clockInTime: formatTime(entry.clockInTime),
              clockOutTime: formatTime(entry.clockOutTime),
              hoursWorked,
              location: null,
              eventType: null,
              isLate,
              onTime: !isLate,
              source: 'Legacy',
              recordId: `clockTimes/${entry.timestamp}`,
              originalKey: entry.timestamp,
              recordType,
              status
            });
          });
        });
      }

      // FIXED: Sort by date (most recent first), then by timestamp (most recent first)
      records.sort((a, b) => {
        // Use Chicago timezone for date comparison
        const dateA = moment.tz(a.date, 'America/Chicago');
        const dateB = moment.tz(b.date, 'America/Chicago');
        const dateCompare = dateB.valueOf() - dateA.valueOf();
        
        if (dateCompare !== 0) return dateCompare;
        return parseInt(b.timestamp) - parseInt(a.timestamp);
      });

      console.log(`Final records count: ${records.length}`);
      setAttendanceRecords(records);

    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setError(`Failed to load attendance records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch records on component mount
  useEffect(() => {
    if (employeeId) {
      fetchAttendanceRecords();
    }
  }, [employeeId]);

  // Handle record deletion - updated to use originalKey
  const handleDeleteRecord = async (timestamp, recordId) => {
    if (!employeeId) {
      setError('Employee ID is missing');
      return;
    }

    try {
      if (deleteConfirm !== timestamp) {
        if (onDeleteRecord) {
          onDeleteRecord(timestamp);
        }
        return;
      }

      const record = attendanceRecords.find(r => r.timestamp === timestamp);
      if (!record) {
        throw new Error('Record not found');
      }

      if (record.source === 'QR Scanner') {
        // Use originalKey for proper deletion path
        await remove(ref(database, `users/${employeeId}/attendance/${record.originalKey}`));
      } else {
        await remove(ref(database, `users/${employeeId}/clockInTimes/${timestamp}`));
        await remove(ref(database, `users/${employeeId}/clockOutTimes/${timestamp}`));
      }

      setAttendanceRecords(prev => prev.filter(r => r.timestamp !== timestamp));
      
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <label className="block text-xs text-white/70 mb-1">Clock Out Time (Optional)</label>
                <input
                  type="time"
                  name="clockOutTime"
                  value={newRecord.clockOutTime}
                  onChange={handleInputChange}
                  className="w-full bg-glass-dark border border-glass-light rounded-lg px-3 py-2 text-sm text-white/90"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Event Type</label>
                <select
                  name="eventType"
                  value={newRecord.eventType}
                  onChange={handleInputChange}
                  className="w-full bg-glass-dark border border-glass-light rounded-lg px-3 py-2 text-sm text-white/90"
                >
                  <option value="general">General</option>
                  <option value="juntahacienda">Junta Hacienda</option>
                  <option value="meetings">Meeting</option>
                  <option value="workshops">Workshop</option>
                  <option value="haciendas">Hacienda</option>
                  <option value="gestion">Gestion</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        bg-glass-light text-white/70 hover:bg-white/10 transition-all duration-200"
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

      {/* Table */}
      <div className="p-6">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Date
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Clock In
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Clock Out
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Hours
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Status
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Type
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Details
                </th>
                <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-light">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mb-2" />
                      <span className="text-sm text-white/70">Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : attendanceRecords.length > 0 ? (
                attendanceRecords.map(record => (
                  <tr 
                    key={`${record.date}-${record.timestamp}`}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-white/90">
                      {/* FIXED: Use Chicago timezone for date display to prevent date shifting */}
                      {moment.tz(record.date, 'America/Chicago').format('MMM DD, YYYY')}
                      <div className="text-xs text-white/40 mt-1">
                        {record.source}
                      </div>
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
                          {record.clockOutTime ? (
                            <span className="text-white/90">{record.clockOutTime}</span>
                          ) : (
                            <span className="text-yellow-400">Not Clocked Out</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      {record.hoursWorked ? (
                        <span className="text-emerald-400 font-medium">{record.hoursWorked}h</span>
                      ) : record.clockInTime && !record.clockOutTime ? (
                        <span className="text-yellow-400">In Progress</span>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {record.clockInTime ? (
                        <StatusBadge clockInTime={record.clockInTime} isLate={record.isLate} />
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                                       bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <AlertCircle className="w-3 h-3" />
                          Clock Out Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.recordType === 'Complete Session' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : record.recordType === 'Clock In Only'
                            ? record.status === 'clocked-in' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            : record.recordType === 'Clock Out Only'
                              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {record.recordType}
                      </span>
                      {record.status === 'clocked-in' && (
                        <div className="text-xs text-blue-400 mt-1">Currently Active</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {record.location && (
                          <div className="flex items-center gap-1 text-xs text-white/50">
                            <MapPin className="w-3 h-3" />
                            {record.location}
                          </div>
                        )}
                        {record.eventType && (
                          <div className="flex items-center gap-1 text-xs text-white/50">
                            <Tag className="w-3 h-3" />
                            {record.eventType}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteRecord(record.timestamp, record.recordId)}
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
                  <td colSpan="8" className="px-6 py-8 text-center text-sm text-white/50">
                    <div className="flex flex-col items-center gap-3">
                      <Calendar className="w-8 h-8 text-white/30" />
                      <div>
                        <p className="font-medium text-white/70 mb-1">No attendance records found</p>
                        <p>This employee has no clock-in/clock-out history. Records will appear here after using the QR scanner.</p>
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
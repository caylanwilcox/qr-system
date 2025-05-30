// src/components/ClockedInList.js - Rewritten with event handling and improved detection
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import moment from 'moment-timezone';
import { eventBus, EVENTS } from '../../services/eventBus';

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

  // Parse times for comparison (fallback gracefully if parsing fails)
  try {
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
  } catch (e) {
    // If time parsing fails, just show a generic status
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                    bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Clock className="w-3 h-3" />
        Present
      </span>
    );
  }
};

// Helper to format date in different formats
const formatDateAlt = (isoDate, formatStr) => {
  try {
    if (!isoDate) return null;
    
    // Parse the ISO date (YYYY-MM-DD)
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    // MM/DD/YYYY format (with leading zeroes)
    if (formatStr === 'MM/DD/YYYY') {
      return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
    }
    
    // M/D/YYYY format (without leading zeroes)
    if (formatStr === 'M/D/YYYY') {
      return `${month}/${day}/${year}`;
    }
    
    return isoDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

// Helper function to get user's full name from various possible fields
const getUserFullName = (user) => {
  const profile = user.profile || {};
  
  // Priority order for name fields
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  
  if (profile.name) return profile.name;
  if (profile.displayName) return profile.displayName;
  if (profile.fullName) return profile.fullName;
  
  if (profile.firstName) return profile.firstName;
  if (profile.lastName) return profile.lastName;
  
  return `Unknown User (${user.id?.substring(0, 5) || 'N/A'})`;
};

const ClockedInList = ({ data = [], date }) => {
  const [clockedInUsers, setClockedInUsers] = useState([]);
  const [debug, setDebug] = useState({ 
    checked: 0, 
    found: 0,
    lastUpdate: new Date().toISOString(),
    eventCount: 0,
    dataSnapshot: null
  });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const DEBUG_PREFIX = '🔍 [ClockedInList]';
  
  // Get today's date if date is not provided - FIXED: Use Chicago timezone
  const effectiveDate = date || moment().tz('America/Chicago').format('YYYY-MM-DD');
  // FIXED: Use Chicago timezone for date display to prevent date shifting
  const formattedDate = effectiveDate ? moment.tz(effectiveDate, 'America/Chicago').format('MMMM D, YYYY') : 'Today';
  
  console.log('🔍 ClockedInList Debug:', {
    providedDate: date,
    effectiveDate,
    formattedDate,
    chicagoNow: moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm:ss Z'),
    utcNow: new Date().toISOString()
  });
  
  // Helper to check if a user has clocked in with the correct date
  const hasClockInWithCorrectDate = useCallback((user, date) => {
    if (!user) return false;
    
    // FIXED: Use Chicago timezone for date comparison
    const targetDateChicago = moment.tz(date, 'America/Chicago');
    const targetDateStr = targetDateChicago.format('YYYY-MM-DD');
    
    // Method 1: Check clockInTimes object
    if (user.clockInTimes) {
    for (const timestamp in user.clockInTimes) {
      try {
          // FIXED: Convert timestamp to Chicago timezone for comparison
          const clockInChicago = moment(parseInt(timestamp)).tz('America/Chicago');
          const dateString = clockInChicago.format('YYYY-MM-DD');
        
        if (dateString === targetDateStr) {
          return true;
        }
      } catch (e) {
        console.error('Error parsing timestamp:', e);
        }
      }
    }
    
    // Method 2: Check user events structure (where QR scanner writes data)
    if (user.events) {
      // Check all event types for attendance on the target date
      for (const [eventType, events] of Object.entries(user.events)) {
        if (!events || typeof events !== 'object') continue;
        
        for (const [eventId, eventData] of Object.entries(events)) {
          if (!eventData || typeof eventData !== 'object') continue;
          
          // Check if this event was attended on the target date
          if (eventData.attended === true && eventData.date === targetDateStr) {
            console.log(`${DEBUG_PREFIX} User has attended ${eventType} event on ${targetDateStr}`);
            return true;
          }
          
          // Also check if the event ID contains the target date (QR scanner format)
          if (eventData.attended === true && eventId.startsWith(targetDateStr)) {
            console.log(`${DEBUG_PREFIX} User has QR scan attendance for ${eventType} on ${targetDateStr}`);
            return true;
          }
        }
      }
    }
    
    // Method 3: Check clockedIn flag with date validation
    if (user.clockedIn === true) {
      // Check if clockedInDate matches
      if (user.clockedInDate === targetDateStr) {
        return true;
      }
      
      // Check if clockedInTimestamp is from today
      if (user.clockedInTimestamp) {
        try {
          // FIXED: Convert timestamp to Chicago timezone for comparison
          const clockedInChicago = moment(parseInt(user.clockedInTimestamp)).tz('America/Chicago');
          const clockedInDateStr = clockedInChicago.format('YYYY-MM-DD');
          if (clockedInDateStr === targetDateStr) {
            return true;
          }
        } catch (e) {
          console.error('Error parsing clockedInTimestamp:', e);
        }
      }
    }
    
    return false;
  }, []);
  
  // Process data to find clocked in users
  const processData = useCallback((force = false) => {
    if (!data || !mountedRef.current) {
      return;
    }
    
    console.log(`${DEBUG_PREFIX} Processing data, forced: ${force}`);
    
    const today = effectiveDate;
    const clockedInList = [];
    let checkedCount = 0;
    let foundCount = 0;
    
    // FIXED: Date formats to check - use Chicago timezone consistently
    const todayChicago = moment.tz(today, 'America/Chicago');
    const possibleDateFormats = [
      today,
      todayChicago.format('MM/DD/YYYY'),
      todayChicago.format('M/D/YYYY')
    ];
    
    // Process each user to find who's clocked in
    Object.entries(data).forEach(([id, user]) => {
      if (!user || !user.profile) {
        console.log(`${DEBUG_PREFIX} Skipping user ${id}: missing user or profile data`);
        return;
      }
      
      // Add ID to the user object
      user.id = id;
      checkedCount++;
      
      // Check for clocked in status across multiple structures
      let isClocked = false;
      let clockInTime = null;
      let clockOutTime = null;
      let onTime = false;
      let timestamp = null;
      
      // 1. First check attendance object with today's date (standardized format)
      if (user.attendance && user.attendance[today]) {
        const entry = user.attendance[today];
        
        // If clockedIn is explicitly false, user has clocked out - exclude them
        if (entry.clockedIn === false) {
          console.log(`${DEBUG_PREFIX} User ${id} has clocked out on ${today} - excluding from clocked-in list`);
          return; // Skip this user entirely
        }
        
        // Check for any field that indicates clocked in
        if (entry.clockedIn === true || entry.isClocked === true || 
            entry.checkedIn === true || entry.present === true) {
          isClocked = true;
          clockInTime = entry.clockInTime || entry.time || '';
          clockOutTime = entry.clockOutTime || null;
          onTime = entry.onTime === true || entry.isLate === false;
          timestamp = entry.clockInTimestamp || null;
          
          console.log(`${DEBUG_PREFIX} User ${id} is clocked in via attendance object with date ${today}`);
        }
      }
      
      // FIXED: Check for new unique timestamp-based attendance keys (YYYY-MM-DD_timestamp format)
      if (!isClocked && user.attendance) {
        Object.entries(user.attendance).forEach(([attendanceKey, entry]) => {
          if (!entry || typeof entry !== 'object') return;
          
          // Check if this key is for today (starts with today's date)
          if (attendanceKey.startsWith(today) && attendanceKey.includes('_')) {
            // If clockedIn is explicitly false, user has clocked out - exclude them
            if (entry.clockedIn === false) {
              console.log(`${DEBUG_PREFIX} User ${id} has clocked out via unique key ${attendanceKey} - excluding from clocked-in list`);
              return; // Skip this user entirely
            }
            
            // Check if this is an active clock-in (status: 'clocked-in')
            if ((entry.clockedIn === true || entry.isClocked === true || 
                 entry.checkedIn === true || entry.present === true) && 
                entry.status === 'clocked-in') {
              isClocked = true;
              clockInTime = entry.clockInTime || entry.time || '';
              clockOutTime = entry.clockOutTime || null;
              onTime = entry.onTime === true || entry.isLate === false;
              timestamp = entry.clockInTimestamp || null;
              
              console.log(`${DEBUG_PREFIX} User ${id} is clocked in via unique attendance key ${attendanceKey}`);
            }
          }
        });
      }
      
      // 2. Also check attendance with alternate date formats if needed
      if (!isClocked && user.attendance) {
        for (let i = 1; i < possibleDateFormats.length; i++) {
          const dateFormat = possibleDateFormats[i];
          const entry = user.attendance[dateFormat];
          if (!entry) continue;
          
          if (entry.clockedIn === true || entry.isClocked === true || 
              entry.checkedIn === true || entry.present === true) {
            isClocked = true;
            clockInTime = entry.clockInTime || entry.time || '';
            clockOutTime = entry.clockOutTime || null;
            onTime = entry.onTime === true || entry.isLate === false;
            timestamp = entry.clockInTimestamp || null;
            
            console.log(`${DEBUG_PREFIX} User ${id} is clocked in via attendance object with date format ${dateFormat}`);
            break;
          }
        }
      }
      
      // 3. Then check clockInTimes object if not already found
      if (!isClocked && user.clockInTimes) {
        // FIXED: Use Chicago timezone for timestamp comparison
        const todayChicago = moment.tz(today, 'America/Chicago');
        const todayString = todayChicago.format('YYYY-MM-DD');
        
        for (const ts in user.clockInTimes) {
          try {
            // FIXED: Convert timestamp to Chicago timezone for comparison
            const timestampChicago = moment(parseInt(ts)).tz('America/Chicago');
            const timestampDateStr = timestampChicago.format('YYYY-MM-DD');
            
            console.log(`${DEBUG_PREFIX} Comparing clockInTimes: timestamp ${ts} (${timestampDateStr}) vs today (${todayString})`);
            
            if (timestampDateStr === todayString) {
              // Check if there's a corresponding clock-out time
              if (user.clockOutTimes && user.clockOutTimes[ts]) {
                console.log(`${DEBUG_PREFIX} User ${id} has clocked out via clockOutTimes for timestamp ${ts} - excluding from clocked-in list`);
                return; // Skip this user entirely as they've clocked out
              }
              
              isClocked = true;
              clockInTime = user.clockInTimes[ts];
              clockOutTime = user.clockOutTimes?.[ts] || null;
              timestamp = ts;
              
              // Determine if on time (before 9am)
              try {
              const clockInTime9AM = new Date(`2000-01-01 ${clockInTime}`);
              const expectedTime = new Date(`2000-01-01 09:00`);
              onTime = clockInTime9AM <= expectedTime;
              } catch (e) {
                console.error(`${DEBUG_PREFIX} Error parsing time:`, e);
                onTime = false;
              }
              
              console.log(`${DEBUG_PREFIX} User ${id} is clocked in via clockInTimes with timestamp ${ts} (Chicago timezone match)`);
              break;
            }
          } catch (e) {
            console.error(`${DEBUG_PREFIX} Error parsing timestamp for user ${id}:`, e);
          }
        }
      }
      
      // 4. Also check for specific fields in the user object directly
      if (!isClocked && (
          user.clockedIn === true || 
          user.isClocked === true || 
          user.checkedIn === true || 
          user.present === true)) {
        
        // Only count if lastClockIn is from today
        if (user.stats && user.stats.lastClockIn) {
          try {
            // FIXED: Convert lastClockIn to Chicago timezone for comparison
            const lastClockInChicago = moment(user.stats.lastClockIn).tz('America/Chicago');
            const lastClockInStr = lastClockInChicago.format('YYYY-MM-DD');
            const todayStr = today; // Already in Chicago timezone format
            
            if (lastClockInStr === todayStr) {
              isClocked = true;
              clockInTime = user.clockInTime || user.time || lastClockInChicago.format('hh:mm A');
              console.log(`${DEBUG_PREFIX} User ${id} is clocked in via direct flags with lastClockIn matching today (Chicago timezone)`);
            }
          } catch (e) {
            console.error(`${DEBUG_PREFIX} Error checking lastClockIn date:`, e);
          }
        } else {
          // If no lastClockIn, still mark as clocked in but note the uncertainty
          isClocked = true;
          clockInTime = user.clockInTime || user.time || 'Unknown';
          console.log(`${DEBUG_PREFIX} User ${id} is clocked in via direct flags but no lastClockIn date`);
          }
        }
        
      // 5. Check if user is explicitly clocked out via direct flags
      if (user.clockedIn === false) {
        console.log(`${DEBUG_PREFIX} User ${id} is explicitly clocked out via direct flag - excluding from clocked-in list`);
        return; // Skip this user entirely as they've clocked out
      }
      
      // If user is clocked in, add to list
      if (isClocked) {
        foundCount++;
        
        // Format name and extract other user info
        const name = user.profile.name || user.name || 'Unknown';
        const location = user.profile?.primaryLocation || user.location || 'Unknown';
        const position = user.profile?.position || 'Member';
        const padrinoColor = user.profile?.padrinoColorCode || null;
        
        clockedInList.push({
          id,
          name,
          location,
          position,
          clockInTime,
          clockOutTime,
          onTime,
          timestamp,
          profile: user.profile,
          padrinoColor,
          time: clockInTime // Add time property for consistency
        });
      }
    });
    
    // Sort by name
    clockedInList.sort((a, b) => a.name.localeCompare(b.name));
    
    // Update state
    setClockedInUsers(clockedInList);
    setDebug(prev => ({
      ...prev,
      checked: checkedCount,
      found: foundCount,
      lastUpdate: new Date().toISOString()
    }));
    
    console.log(`${DEBUG_PREFIX} Found ${foundCount} clocked in users out of ${checkedCount} checked`);
  }, [data, effectiveDate]);
  
  // Process the data when it changes
  useEffect(() => {
    processData();
  }, [data, effectiveDate, processData]);
  
  // Setup event listeners for real-time updates
  useEffect(() => {
    mountedRef.current = true;
    console.log(`${DEBUG_PREFIX} Setting up event listeners`);
    
    // Listen for attendance updates
    const unsubscribeAttendance = eventBus.subscribe(EVENTS.ATTENDANCE_UPDATED, (data) => {
      console.log(`${DEBUG_PREFIX} Received ATTENDANCE_UPDATED event:`, data);
      
      if (mountedRef.current) {
        // Process data with force flag
        processData(true);
        
        // Update debug stats
        setDebug(prev => ({
          ...prev,
          eventCount: prev.eventCount + 1,
          lastUpdate: new Date().toISOString()
        }));
      }
    });
    
    // Also listen for dashboard updates
    const unsubscribeDashboard = eventBus.subscribe(EVENTS.DASHBOARD_DATA_UPDATED, (data) => {
      console.log(`${DEBUG_PREFIX} Received DASHBOARD_DATA_UPDATED event:`, data);
      
      if (mountedRef.current && data.type === 'attendance') {
        // Process data with force flag
        processData(true);
        
        // Update debug stats
        setDebug(prev => ({
          ...prev,
          eventCount: prev.eventCount + 1,
          lastUpdate: new Date().toISOString()
        }));
      }
    });
    
    return () => {
      mountedRef.current = false;
      unsubscribeAttendance();
      unsubscribeDashboard();
      console.log(`${DEBUG_PREFIX} Cleanup: Unsubscribed from events`);
    };
  }, [processData]);
  
  // Handle manual refresh
  const handleManualRefresh = () => {
    console.log(`${DEBUG_PREFIX} Manual refresh triggered`);
    setIsManualRefreshing(true);
    processData(true);
  };

  return (
    <div className="clocked-in-list card">
      <div className="card-header flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-500" />
          <h3>Clocked In ({clockedInUsers.length})</h3>
          <div className="text-sm text-gray-500">{formattedDate}</div>
        </div>
        <button 
          onClick={handleManualRefresh}
          disabled={isManualRefreshing}
          className="text-gray-400 hover:text-white p-1 rounded-full"
          title="Refresh clocked-in list"
        >
          <RefreshCw size={16} className={isManualRefreshing ? "animate-spin" : ""} />
        </button>
      </div>
      
      {clockedInUsers.length === 0 ? (
        <div className="empty-state">
          <p>No members clocked in for this date</p>
          <p className="text-xs text-gray-400 mt-1">Checked {debug.checked} users</p>
        </div>
      ) : (
        <div className="user-list">
          {clockedInUsers.map(user => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <div className="user-name">
                  {/* Use lowercase color to ensure CSS class naming consistency */}
                  {user.padrinoColor && (
                  <span className={`status-dot bg-${user.padrinoColor.toLowerCase()}`}></span>
                  )}
                  {user.name}
                </div>
                <div className="user-location">{user.location}</div>
              </div>
              <div className="user-clock-info">
                <div className={`clock-time ${user.colorClass || ''}`}>
                  {user.clockInTime || '(No time)'}
                </div>
                <StatusBadge clockInTime={user.clockInTime} />
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Debug info (visible in development only) */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="p-2 mt-3 border-t border-slate-700 text-xs text-slate-400">
          <details>
            <summary className="cursor-pointer">Debug Info</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>Checked: {debug.checked}</div>
              <div>Found: {debug.found}</div>
              <div>Events: {debug.eventCount}</div>
              <div>Last update: {new Date(debug.lastUpdate).toLocaleTimeString()}</div>
              <div className="col-span-2">
                Date: {effectiveDate} (Formats: {formatDateAlt(effectiveDate, 'MM/DD/YYYY')}, {formatDateAlt(effectiveDate, 'M/D/YYYY')})
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default ClockedInList;
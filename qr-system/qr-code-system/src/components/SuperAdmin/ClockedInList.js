import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DateUtils from './dateUtils';

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

const ClockedInList = ({ data, date }) => {
  const [clockedInUsers, setClockedInUsers] = useState([]);
  const [debug, setDebug] = useState({ checked: 0, found: 0 });
  const navigate = useNavigate();

  // Get today's date if date is not provided
  const effectiveDate = date || DateUtils.getCurrentDateISO();
  const formattedDate = effectiveDate ? DateUtils.formatDisplayDate(effectiveDate) : 'Today';

  // Process data to find clocked in users for the specified date
  useEffect(() => {
    if (!data) {
      console.log("ClockedInList: No data provided");
      setClockedInUsers([]);
      return;
    }

    // Track how many users we're checking and finding for debugging
    let checkedCount = 0;
    let foundCount = 0;
    const results = [];

    // Process each user to find who's clocked in
    Object.entries(data).forEach(([id, user]) => {
      if (!user || !user.profile) return;
      
      // Add ID to the user object
      user.id = id;
      checkedCount++;
      
      // Get all possible date formats for the target date
      const dateFormats = DateUtils.getAllDateFormats(effectiveDate);
      
      // Check for clocked in status across multiple structures
      let isClocked = false;
      let clockInTime = null;
      let clockOutTime = null;
      let onTime = false;
      let timestamp = null;
      
      // 1. First check attendance object with various date formats
      if (user.attendance) {
        for (const dateFormat of dateFormats) {
          if (!dateFormat) continue;
          
          const entry = user.attendance[dateFormat];
          if (!entry) continue;
          
          // Check for any field that indicates clocked in
          if (entry.clockedIn === true || entry.isClocked === true || 
              entry.checkedIn === true || entry.present === true) {
            isClocked = true;
            clockInTime = entry.time || entry.clockInTime || '';
            clockOutTime = entry.clockOutTime || null;
            onTime = entry.onTime === true;
            
            // If onTime is not explicitly set, determine based on time
            if (onTime === undefined && clockInTime) {
              try {
                const clockInTimeObj = new Date(`2000-01-01 ${clockInTime}`);
                const expectedTime = new Date(`2000-01-01 09:00`);
                onTime = clockInTimeObj <= expectedTime;
              } catch (e) {
                // If parsing fails, default to false
              }
            }
            
            break;
          }
        }
      }
      
      // 2. Then check clockInTimes object if not already found
      if (!isClocked && user.clockInTimes) {
        // Parse target date to compare with timestamps
        const targetDate = new Date(effectiveDate);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // Check each timestamp
        for (const ts in user.clockInTimes) {
          try {
            const timestampDate = new Date(parseInt(ts));
            const timestampDateStr = timestampDate.toISOString().split('T')[0];
            
            if (timestampDateStr === targetDateStr) {
              isClocked = true;
              clockInTime = user.clockInTimes[ts];
              clockOutTime = user.clockOutTimes?.[ts] || null;
              timestamp = ts;
              
              // Determine if on time
              try {
                const clockInTime9AM = new Date(`2000-01-01 ${clockInTime}`);
                const expectedTime = new Date(`2000-01-01 09:00`);
                onTime = clockInTime9AM <= expectedTime;
              } catch (e) {
                // If parsing fails, default to false
              }
              
              break;
            }
          } catch (e) {
            console.error('Error parsing timestamp:', e);
          }
        }
      }
      
      // 3. Also check for specific fields in the user object directly
      // (some implementations might set these at the user root level)
      if (!isClocked && (
          user.clockedIn === true || 
          user.isClocked === true || 
          user.checkedIn === true || 
          user.present === true)) {
        isClocked = true;
        clockInTime = user.clockInTime || user.time || '';
      }
      
      // If clocked in by any method, add to results
      if (isClocked) {
        foundCount++;
        
        // Determine status color
        let statusColor = 'text-emerald-500'; // default: on time
        if (clockInTime) {
          try {
            const clockInTime9AM = new Date(`2000-01-01 ${clockInTime}`);
            const expectedTime = new Date(`2000-01-01 09:00`);
            const lateTime = new Date(`2000-01-01 09:15`);
            
            if (clockInTime9AM > lateTime) {
              statusColor = 'text-red-500'; // very late
            } else if (clockInTime9AM > expectedTime) {
              statusColor = 'text-amber-500'; // slightly late
            }
          } catch (e) {
            // If parsing fails, keep default color
          }
        }
        
        results.push({
          id,
          name: getUserFullName(user),
          time: clockInTime || '',
          timestamp: timestamp || '',
          clockOutTime: clockOutTime || null,
          isOnTime: onTime,
          status: onTime ? 'On Time' : 'Late',
          colorClass: statusColor,
          padrinoColor: user.profile?.padrinoColor || 'blue',
          location: user.profile?.primaryLocation || 'Unknown'
        });
      }
    });
    
    // Sort results by name
    results.sort((a, b) => a.name.localeCompare(b.name));
    
    // Update state with results and debug info
    setClockedInUsers(results);
    setDebug({ checked: checkedCount, found: foundCount });
    
    // Log debug info
    console.log(`ClockedInList: Checked ${checkedCount} users, found ${foundCount} clocked in for date ${effectiveDate}`);
  }, [data, effectiveDate]);

  return (
    <div className="clocked-in-list card">
      <div className="card-header">
        <Clock className="h-5 w-5 text-green-500" />
        <h3>Clocked In ({clockedInUsers.length})</h3>
        <div className="text-sm text-gray-500">{formattedDate}</div>
      </div>
      
      {clockedInUsers.length === 0 ? (
        <div className="empty-state">
          <p>No members clocked in for this date</p>
          <p className="text-xs text-gray-400 mt-1">Checked {debug.checked} users</p>
        </div>
      ) : (
        <div className="user-list">
          {clockedInUsers.map(user => (
            <div 
              key={user.id} 
              className="user-item" 
              onClick={() => navigate(`/super-admin/users/${user.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="user-info">
                <div className="user-name">
                  <span className={`status-dot bg-${user.padrinoColor}`}></span>
                  {user.name}
                </div>
                <div className="user-location">{user.location}</div>
              </div>
              <div className="user-clock-info">
                <div className={`clock-time ${user.colorClass}`}>
                  {user.time || '(No time)'}
                </div>
                <StatusBadge clockInTime={user.time} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClockedInList;
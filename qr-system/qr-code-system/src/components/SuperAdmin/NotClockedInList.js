import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DateUtils from './dateUtils';
import moment from 'moment-timezone';

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

// Function to determine if user is clocked in, checking multiple possible field names and date formats
const isUserClockedIn = (user, targetDate) => {
  if (!user.attendance && !user.clockInTimes) return { isClocked: false, entry: null };
  
  // Get all possible date formats
  const dateFormats = DateUtils.getAllDateFormats(targetDate);
  
  // Check attendance object first
  if (user.attendance) {
    // Check if user is clocked in for any of the possible date formats
    for (const dateFormat of dateFormats) {
      if (!dateFormat) continue;
      
      const attendanceEntry = user.attendance[dateFormat];
      if (!attendanceEntry) continue;
      
      // If clockedIn is explicitly false, user has clocked out - return not clocked in
      if (attendanceEntry.clockedIn === false) {
        return { isClocked: false, entry: null };
      }
      
      // Check various possible field names that could indicate "clocked in" status
      if (attendanceEntry.clockedIn === true || 
          attendanceEntry.isClocked === true || 
          attendanceEntry.checkedIn === true || 
          attendanceEntry.present === true) {
        return { isClocked: true, entry: attendanceEntry };
      }
    }
    
    // FIXED: Check for new unique timestamp-based attendance keys
    Object.entries(user.attendance).forEach(([attendanceKey, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      
      // Check if this key is for the target date (starts with target date)
      if (attendanceKey.startsWith(targetDate) && attendanceKey.includes('_')) {
        // If clockedIn is explicitly false, user has clocked out
        if (entry.clockedIn === false) {
          return { isClocked: false, entry: null };
        }
        
        // Check if this is an active clock-in (status: 'clocked-in')
        if ((entry.clockedIn === true || entry.isClocked === true || 
             entry.checkedIn === true || entry.present === true) && 
            entry.status === 'clocked-in') {
          return { isClocked: true, entry: entry };
        }
      }
    });
  }
  
  // Then check clockInTimes directly (new format from the AttendanceSection)
  if (user.clockInTimes) {
    // FIXED: Use Chicago timezone for timestamp comparison
    const targetDateChicago = moment.tz(targetDate, 'America/Chicago');
    const targetDateStr = targetDateChicago.format('YYYY-MM-DD');
    
    // Check if any of the timestamps correspond to the target date
    for (const timestamp in user.clockInTimes) {
      try {
        // FIXED: Convert timestamp to Chicago timezone for comparison
        const timestampChicago = moment(parseInt(timestamp)).tz('America/Chicago');
        const timestampDateStr = timestampChicago.format('YYYY-MM-DD');
        
        if (timestampDateStr === targetDateStr) {
          // Check if there's a corresponding clock-out time
          if (user.clockOutTimes && user.clockOutTimes[timestamp]) {
            return { isClocked: false, entry: null }; // User has clocked out
          }
          
          return { 
            isClocked: true, 
            entry: {
              clockInTime: user.clockInTimes[timestamp],
              clockOutTime: user.clockOutTimes?.[timestamp] || null,
              timestamp: timestamp
            }
          };
        }
      } catch (e) {
        console.error('Error parsing timestamp:', e);
      }
    }
  }
  
  // Check direct user properties as fallback
  if (user.clockedIn === true || 
      user.isClocked === true || 
      user.checkedIn === true || 
      user.present === true) {
    return { 
      isClocked: true, 
      entry: {
        clockInTime: user.clockInTime || user.time || '',
        timestamp: null
      }
    };
  }
  
  // Check if user is explicitly clocked out via direct flags
  if (user.clockedIn === false) {
    return { isClocked: false, entry: null }; // User is explicitly clocked out
  }
  
  return { isClocked: false, entry: null };
};

// Function to find user's most recent activity
const getLastActivity = (user) => {
  // Check for stats.lastActive
  if (user.stats?.lastActive) {
    return new Date(user.stats.lastActive);
  }
  
  // Check for most recent attendance record
  if (user.attendance) {
    let latestDate = null;
    
    for (const dateStr in user.attendance) {
      try {
        // Try to parse the date from various formats
        const dateISO = DateUtils.parseToISO(dateStr);
        if (dateISO) {
          const date = new Date(dateISO);
          if (!latestDate || date > latestDate) {
            latestDate = date;
          }
        }
      } catch (e) {
        // Invalid date format, skip
      }
    }
    
    if (latestDate) return latestDate;
  }
  
  // Check for most recent clock-in time
  if (user.clockInTimes) {
    let latestTime = null;
    
    for (const timestamp in user.clockInTimes) {
      try {
        const time = new Date(parseInt(timestamp));
        if (!latestTime || time > latestTime) {
          latestTime = time;
        }
      } catch (e) {
        // Invalid timestamp, skip
      }
    }
    
    if (latestTime) return latestTime;
  }
  
  // No activity found
  return null;
};

const NotClockedInList = ({ data, date }) => {
  const navigate = useNavigate();
  
  // Get today's date if date is not provided
  const effectiveDate = date || DateUtils.getCurrentDateISO();
  
  // Filter users who are NOT clocked in for the specified date
  const notClockedInUsers = Object.entries(data || {})
    .filter(([_, user]) => {
      if (!user.profile) return false; // Skip users without profiles
      
      // Check if user is NOT clocked in
      const { isClocked } = isUserClockedIn(user, effectiveDate);
      return !isClocked;
    })
    .map(([id, user]) => {
      // Add ID to the user object for reference
      user.id = id;
      
      // Get last activity date
      const lastActiveDate = getLastActivity(user);
      
      return {
        id,
        name: getUserFullName(user),
        padrinoColor: user.profile?.padrinoColorCode || 'blue',
        location: user.profile?.primaryLocation || 'Unknown',
        lastActiveDate: lastActiveDate,
        lastActiveDaysAgo: lastActiveDate 
          ? Math.floor((new Date() - lastActiveDate) / (1000 * 60 * 60 * 24)) 
          : null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const formattedDate = effectiveDate ? DateUtils.formatDisplayDate(effectiveDate) : 'Today';

  return (
    <div className="not-clocked-in-list card">
      <div className="card-header">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <h3>Not Clocked In ({notClockedInUsers.length})</h3>
        <div className="text-sm text-gray-500">{formattedDate}</div>
      </div>
      
      {notClockedInUsers.length === 0 ? (
        <div className="empty-state">
          <p>Everyone is clocked in for this date!</p>
        </div>
      ) : (
        <div className="user-list">
          {notClockedInUsers.map(user => (
            <div 
              key={user.id} 
              className="user-item"
              onClick={() => navigate(`/super-admin/users/${user.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="user-info">
                <div className="user-name">
                  {user.padrinoColor && (
                    <span className={`status-dot bg-${user.padrinoColor.toLowerCase()}`}></span>
                  )}
                  {user.name}
                </div>
                <div className="user-location">{user.location}</div>
              </div>
              <div className={`last-active text-sm ${
                user.lastActiveDaysAgo > 7 ? 'text-red-400' : 
                user.lastActiveDaysAgo > 3 ? 'text-amber-400' : 'text-gray-400'
              }`}>
                {user.lastActiveDate ? (
                  <>
                    Last active: {DateUtils.formatDisplayDate(user.lastActiveDate).split(',')[0]}
                    {user.lastActiveDaysAgo > 0 && ` (${user.lastActiveDaysAgo}d ago)`}
                  </>
                ) : (
                  'No activity recorded'
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotClockedInList;
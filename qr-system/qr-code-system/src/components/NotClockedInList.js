import React from 'react';
import { format, isValid, parse } from 'date-fns';
import { AlertCircle } from 'lucide-react';
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

// Helper to get Chicago time (matching the QR Scanner)
const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

// Function to determine if user is clocked in, checking multiple possible field names and date formats
const isUserClockedIn = (user, targetDate) => {
  if (!user.attendance && !user.clockInTimes) return { isClocked: false, entry: null };
  
  // Generate possible date formats to check
  const possibleDateFormats = [
    targetDate, // YYYY-MM-DD (original format)
    formatDateAlt(targetDate, 'MM/DD/YYYY'),
    formatDateAlt(targetDate, 'M/D/YYYY')
  ];
  
  // Check attendance object first
  if (user.attendance) {
    // Check if user is clocked in for any of the possible date formats
    for (const dateFormat of possibleDateFormats) {
      const attendanceEntry = user.attendance[dateFormat];
      if (!attendanceEntry) continue;
      
      // Check various possible field names that could indicate "clocked in" status
      if (attendanceEntry.clockedIn === true) return { isClocked: true, entry: attendanceEntry };
      if (attendanceEntry.isClocked === true) return { isClocked: true, entry: attendanceEntry };
      if (attendanceEntry.checkedIn === true) return { isClocked: true, entry: attendanceEntry };
      if (attendanceEntry.present === true) return { isClocked: true, entry: attendanceEntry };
    }
  }
  
  // Then check clockInTimes directly (new format from the AttendanceSection)
  if (user.clockInTimes) {
    // Check if any of the timestamps correspond to today's date
    const today = new Date(targetDate);
    
    for (const timestamp in user.clockInTimes) {
      const timestampDate = new Date(parseInt(timestamp));
      
      // Compare just the date portion
      if (timestampDate.toISOString().split('T')[0] === today.toISOString().split('T')[0]) {
        return { 
          isClocked: true, 
          entry: {
            clockInTime: user.clockInTimes[timestamp],
            clockOutTime: user.clockOutTimes?.[timestamp] || null,
            timestamp: timestamp
          }
        };
      }
    }
  }
  
  return { isClocked: false, entry: null };
};

// Helper to format date in different formats
const formatDateAlt = (isoDate, formatStr) => {
  try {
    // Parse ISO date string (YYYY-MM-DD) into a Date object
    const dateObj = parse(isoDate, 'yyyy-MM-dd', new Date());
    
    if (!isValid(dateObj)) return null;
    
    // MM/DD/YYYY format
    if (formatStr === 'MM/DD/YYYY') {
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = dateObj.getDate().toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${month}/${day}/${year}`;
    }
    
    // M/D/YYYY format (no leading zeros)
    if (formatStr === 'M/D/YYYY') {
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const year = dateObj.getFullYear();
      return `${month}/${day}/${year}`;
    }
    
    return isoDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoDate;
  }
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
        const date = new Date(dateStr);
        if (isValid(date) && (!latestDate || date > latestDate)) {
          latestDate = date;
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
        if (isValid(time) && (!latestTime || time > latestTime)) {
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
  // Get today's date if date is not provided
  const effectiveDate = date || format(new Date(), 'yyyy-MM-dd');
  
  // Filter users who are NOT clocked in for the specified date
  const notClockedInUsers = Object.entries(data || {})
    .filter(([_, user]) => {
      if (!user.profile) return false; // Skip users without profiles
      
      // Check if user is NOT clocked in
      const { isClocked } = isUserClockedIn(user, effectiveDate);
      return !isClocked;
    })
    .map(([id, user]) => {
      // Add ID to the user object for name extraction
      user.id = id;
      
      // Get last activity date
      const lastActiveDate = getLastActivity(user);
      
      return {
        id,
        name: getUserFullName(user),
        padrinoColor: user.profile?.padrinoColor || 'blue',
        location: user.profile?.primaryLocation || 'Unknown',
        lastActiveDate: lastActiveDate,
        lastActiveDaysAgo: lastActiveDate 
          ? Math.floor((new Date() - lastActiveDate) / (1000 * 60 * 60 * 24)) 
          : null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const formattedDate = effectiveDate ? format(new Date(effectiveDate), 'MMMM d, yyyy') : 'Today';

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
            <div key={user.id} className="user-item">
              <div className="user-info">
                <div className="user-name">
                  <span className={`status-dot bg-${user.padrinoColor}`}></span>
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
                    Last active: {format(user.lastActiveDate, 'MMM d')}
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
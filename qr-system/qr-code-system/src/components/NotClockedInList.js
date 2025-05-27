import React, { useState, useEffect } from 'react';
import { format, isValid, parse } from 'date-fns';
import { AlertCircle } from 'lucide-react';

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

// Function to determine if user is clocked in, checking multiple possible field names and date formats
const isUserClockedIn = (user, targetDate) => {
  if (!user || (!user.attendance && !user.clockInTimes)) return { isClocked: false, entry: null };
  
  // Generate possible date formats to check
  const possibleDateFormats = [
    targetDate, // YYYY-MM-DD (original format)
    formatDateAlt(targetDate, 'MM/DD/YYYY'),
    formatDateAlt(targetDate, 'M/D/YYYY')
  ].filter(Boolean);
  
  // Check attendance object first
  if (user.attendance) {
    // Check all possible date formats
    for (const dateFormat of possibleDateFormats) {
      if (!dateFormat) continue;
      
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
    // Check if any of the timestamps correspond to the target date
    const targetDateObj = new Date(targetDate);
    const targetDateStr = targetDateObj.toISOString().split('T')[0];
    
    for (const timestamp in user.clockInTimes) {
      try {
        const timestampDate = new Date(parseInt(timestamp));
        const timestampDateStr = timestampDate.toISOString().split('T')[0];
        
        if (timestampDateStr === targetDateStr) {
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
  
  // Also check for specific fields in the user object directly
  if (user.clockedIn === true || user.isClocked === true || 
      user.checkedIn === true || user.present === true) {
    return { 
      isClocked: true, 
      entry: {
        clockInTime: user.clockInTime || user.time || null
      }
    };
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
  const [notClockedInUsers, setNotClockedInUsers] = useState([]);
  const [debug, setDebug] = useState({ checked: 0, notClocked: 0 });

  // Get today's date if date is not provided
  const effectiveDate = date || format(new Date(), 'yyyy-MM-dd');
  const formattedDate = effectiveDate ? format(new Date(effectiveDate), 'MMMM d, yyyy') : 'Today';

  useEffect(() => {
    if (!data) {
      console.log("NotClockedInList: No data provided");
      setNotClockedInUsers([]);
      return;
    }

    // Track how many users we're checking and finding for debugging
    let checkedCount = 0;
    let notClockedCount = 0;
    const results = [];

    // Filter users who are NOT clocked in for the specified date
    Object.entries(data).forEach(([id, user]) => {
      if (!user || !user.profile) return;
      
      // Add ID to the user object
      user.id = id;
      checkedCount++;
      
      // Check if user is NOT clocked in
      const { isClocked } = isUserClockedIn(user, effectiveDate);
      
      if (!isClocked) {
        notClockedCount++;
        
        // Get last activity date
        const lastActiveDate = getLastActivity(user);
        
        // Get location from multiple possible fields for consistent display
        const location = user.location || 
                        user.profile?.locationKey || 
                        user.profile?.primaryLocation || 
                        user.profile?.location || 
                        'Unknown';
                        
        results.push({
          id,
          name: getUserFullName(user),
          padrinoColor: user.profile?.padrinoColorCode?.toLowerCase() || 'gray',
          location: location,
          lastActiveDate: lastActiveDate,
          lastActiveDaysAgo: lastActiveDate 
            ? Math.floor((new Date() - lastActiveDate) / (1000 * 60 * 60 * 24)) 
            : null
        });
      }
    });
    
    // Sort results by name
    results.sort((a, b) => a.name.localeCompare(b.name));
    
    // Update state with results and debug info
    setNotClockedInUsers(results);
    setDebug({ checked: checkedCount, notClocked: notClockedCount });
    
    // Log debug info
    console.log(`NotClockedInList: Checked ${checkedCount} users, found ${notClockedCount} not clocked in`);
  }, [data, effectiveDate]);

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
          <p className="text-xs text-gray-400 mt-1">Checked {debug.checked} users</p>
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
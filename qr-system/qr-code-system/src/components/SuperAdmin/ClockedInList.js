import React from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

// Helper function to get user's full name from various possible fields
const getUserFullName = (user) => {
  const profile = user.profile || {};
  
  // Priority order for name fields
  // 1. First check if we have firstName + lastName
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  
  // 2. Then check if we have a dedicated name or displayName field
  if (profile.name) return profile.name;
  if (profile.displayName) return profile.displayName;
  if (profile.fullName) return profile.fullName;
  
  // 3. Then try firstName or lastName individually
  if (profile.firstName) return profile.firstName;
  if (profile.lastName) return profile.lastName;
  
  // 4. Last resort: use part of the user ID
  return `Unknown User (${user.id?.substring(0, 5) || 'N/A'})`;
};

const ClockedInList = ({ data, date }) => {
  // Filter users who are clocked in for the specified date
  const clockedInUsers = Object.entries(data || {})
    .filter(([_, user]) => {
      return user.attendance?.[date]?.clockedIn === true;
    })
    .map(([id, user]) => {
      // Add ID to the user object for name extraction
      user.id = id;
      
      return {
        id,
        name: getUserFullName(user),
        time: user.attendance?.[date]?.time || '',
        isOnTime: user.attendance?.[date]?.onTime === true,
        padrinoColor: user.profile?.padrinoColor || 'blue',
        location: user.profile?.primaryLocation || 'Unknown'
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const formattedDate = date ? format(new Date(date), 'MMMM d, yyyy') : 'Today';

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
        </div>
      ) : (
        <div className="user-list">
          {clockedInUsers.map(user => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <div className="user-name">
                  <span className={`status-dot bg-${user.padrinoColor}`}></span>
                  {user.name}
                </div>
                <div className="user-location">{user.location}</div>
              </div>
              <div className={`clock-time ${user.isOnTime ? 'text-green-500' : 'text-amber-500'}`}>
                {user.time || '(No time)'}
                {user.isOnTime ? ' ✓' : ' ⚠️'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClockedInList;
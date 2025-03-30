import React from 'react';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

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

const NotClockedInList = ({ data, date }) => {
  // Filter users who are NOT clocked in for the specified date
  const notClockedInUsers = Object.entries(data || {})
    .filter(([_, user]) => {
      // Check if the user has an active profile and is not clocked in for the date
      return user.profile && (!user.attendance || !user.attendance[date] || user.attendance[date].clockedIn !== true);
    })
    .map(([id, user]) => {
      // Add ID to the user object for name extraction
      user.id = id;
      
      return {
        id,
        name: getUserFullName(user),
        padrinoColor: user.profile?.padrinoColor || 'blue',
        location: user.profile?.primaryLocation || 'Unknown',
        lastActiveDate: user.stats?.lastActive || null
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const formattedDate = date ? format(new Date(date), 'MMMM d, yyyy') : 'Today';

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
              <div className="last-active text-gray-500 text-sm">
                {user.lastActiveDate ? (
                  <>Last active: {format(new Date(user.lastActiveDate), 'MMM d')}</>
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
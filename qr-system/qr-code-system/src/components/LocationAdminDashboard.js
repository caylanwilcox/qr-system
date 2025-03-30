import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { 
  Users, Calendar, Clock, RefreshCw, Filter, ChevronDown, 
  AlertCircle, CheckCircle, CalendarDays, MapPin, Building,
  User, Mail, Briefcase, ArrowUp, Search, X, Clock3, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import './LocationAdminDashboard.css';

// Status badge component with improved styling
const StatusBadge = ({ clockInTime }) => {
  if (!clockInTime) {
    return (
      <span className="badge badge-absent">
        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
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
        <span className="badge badge-late">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          Late
        </span>
      );
    }

    if (clockInTime9AM > expectedTime) {
      return (
        <span className="badge badge-slightly-late">
          <Clock3 className="w-3.5 h-3.5 mr-1.5" />
          Slightly Late
        </span>
      );
    }

    return (
      <span className="badge badge-on-time">
        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
        On Time
      </span>
    );
  } catch (e) {
    // If time parsing fails, just show a generic status
    return (
      <span className="badge badge-on-time">
        <Clock className="w-3.5 h-3.5 mr-1.5" />
        Present
      </span>
    );
  }
};

const LocationAdminDashboard = () => {
  const { adminLocations, hasAllLocations } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({});
  const [filteredUserData, setFilteredUserData] = useState({});
  const [activeLocation, setActiveLocation] = useState('all');
  const [attendanceSummary, setAttendanceSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch user data
  useEffect(() => {
    setLoading(true);
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setUserData({});
          setFilteredUserData({});
          setLoading(false);
          return;
        }

        // Filter users based on admin's location permissions
        const filteredData = {};
        
        Object.entries(data).forEach(([userId, user]) => {
          const userLocation = user.profile?.primaryLocation || '';
          
          // Include user if admin has access to all locations or to this specific location
          if (hasAllLocations || adminLocations.includes(userLocation)) {
            filteredData[userId] = user;
          }
        });
        
        setUserData(filteredData);
        updateFilteredData(filteredData, activeLocation, searchQuery);
        setLoading(false);
      } catch (error) {
        console.error("Error loading user data:", error);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [adminLocations, hasAllLocations]);

  // Update filtered data when active location or search changes
  useEffect(() => {
    updateFilteredData(userData, activeLocation, searchQuery);
  }, [activeLocation, userData, searchQuery]);

  // Calculate attendance summary
  useEffect(() => {
    if (Object.keys(filteredUserData).length === 0) {
      setAttendanceSummary({
        total: 0,
        present: 0,
        absent: 0,
        late: 0
      });
      return;
    }

    let totalUsers = Object.keys(filteredUserData).length;
    let presentCount = 0;
    let lateCount = 0;
    let slightlyLateCount = 0;
    
    Object.values(filteredUserData).forEach(user => {
      // Check different date formats
      const dateFormats = [
        selectedDate, 
        formatDateAlternative(selectedDate, 'MM/DD/YYYY'),
        formatDateAlternative(selectedDate, 'M/D/YYYY')
      ].filter(Boolean);
      
      let isClockedIn = false;
      let isLate = false;
      let isSlightlyLate = false;
      let clockInTimeValue = null;
      
      // Check attendance object
      if (user.attendance) {
        for (const dateFormat of dateFormats) {
          if (!dateFormat) continue;
          
          const entry = user.attendance[dateFormat];
          if (entry) {
            if (entry.clockedIn === true || entry.isClocked === true || 
                entry.checkedIn === true || entry.present === true) {
              isClockedIn = true;
              clockInTimeValue = entry.time || entry.clockInTime || '';
              
              // Check if they were late
              if (entry.onTime === false) {
                isLate = true;
              } else if (clockInTimeValue) {
                try {
                  const clockInTime = new Date(`2000-01-01 ${clockInTimeValue}`);
                  const expectedTime = new Date(`2000-01-01 09:00`);
                  const lateTime = new Date(`2000-01-01 09:15`);
                  
                  if (clockInTime > lateTime) {
                    isLate = true;
                  } else if (clockInTime > expectedTime) {
                    isSlightlyLate = true;
                  }
                } catch (e) {
                  // Ignore invalid time formats
                }
              }
              
              break;
            }
          }
        }
      }
      
      // Check clockInTimes object if not found yet
      if (!isClockedIn && user.clockInTimes) {
        const targetDate = new Date(selectedDate);
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        for (const timestamp in user.clockInTimes) {
          try {
            const timestampDate = new Date(parseInt(timestamp));
            const timestampDateStr = timestampDate.toISOString().split('T')[0];
            
            if (timestampDateStr === targetDateStr) {
              isClockedIn = true;
              clockInTimeValue = user.clockInTimes[timestamp];
              
              // Check if they were late
              if (clockInTimeValue) {
                try {
                  const clockInTime = new Date(`2000-01-01 ${clockInTimeValue}`);
                  const expectedTime = new Date(`2000-01-01 09:00`);
                  const lateTime = new Date(`2000-01-01 09:15`);
                  
                  if (clockInTime > lateTime) {
                    isLate = true;
                  } else if (clockInTime > expectedTime) {
                    isSlightlyLate = true;
                  }
                } catch (e) {
                  // Ignore invalid time formats
                }
              }
              
              break;
            }
          } catch (e) {
            // Ignore invalid timestamps
          }
        }
      }
      
      if (isClockedIn) {
        presentCount++;
        if (isLate) {
          lateCount++;
        }
        if (isSlightlyLate) {
          slightlyLateCount++;
        }
      }
    });
    
    setAttendanceSummary({
      total: totalUsers,
      present: presentCount,
      absent: totalUsers - presentCount,
      late: lateCount + slightlyLateCount
    });
    
  }, [filteredUserData, selectedDate]);

  // Helper function to format dates
  const formatDateAlternative = (isoDate, formatStr) => {
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

  // Filter users based on location and search query
  const updateFilteredData = (data, location, search = '') => {
    let filtered = {...data};
    
    // Filter by location if not "all"
    if (location !== 'all') {
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([_, user]) => {
          const userLocation = user.profile?.primaryLocation || '';
          return userLocation.toLowerCase() === location.toLowerCase();
        })
      );
    }
    
    // Apply search filter if there's a search query
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([_, user]) => {
          const name = user.profile?.name || '';
          const firstName = user.profile?.firstName || '';
          const lastName = user.profile?.lastName || '';
          const fullName = firstName && lastName ? `${firstName} ${lastName}` : '';
          const email = user.email || '';
          const department = user.profile?.department || '';
          
          return name.toLowerCase().includes(searchLower) || 
                 fullName.toLowerCase().includes(searchLower) ||
                 email.toLowerCase().includes(searchLower) ||
                 department.toLowerCase().includes(searchLower);
        })
      );
    }
    
    setFilteredUserData(filtered);
  };

  const handleLocationChange = (location) => {
    setActiveLocation(location);
    setShowLocationDropdown(false);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setShowDatePicker(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // Re-fetch data
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Get initials for avatar
  const getInitials = (user) => {
    if (!user) return 'U';
    
    // Try to get name from different possible fields
    const profile = user.profile || {};
    
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    }
    
    if (profile.name) {
      return profile.name.split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    
    if (profile.displayName) {
      return profile.displayName.split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    
    // If no name found, use first letter of email
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    
    return 'U';
  };

  // Get all available locations
  const getAvailableLocations = () => {
    const locations = new Set();
    
    if (hasAllLocations) {
      Object.values(userData).forEach(user => {
        const location = user.profile?.primaryLocation;
        if (location) {
          locations.add(location);
        }
      });
    } else {
      adminLocations.forEach(location => locations.add(location));
    }
    
    return ['all', ...Array.from(locations)].sort();
  };

  // Calculate rates
  const getAttendanceRate = () => {
    if (attendanceSummary.total === 0) return 0;
    return Math.round((attendanceSummary.present / attendanceSummary.total) * 100);
  };

  const getOnTimeRate = () => {
    if (attendanceSummary.present === 0) return 0;
    return Math.round(((attendanceSummary.present - attendanceSummary.late) / attendanceSummary.present) * 100);
  };

  // Check if user is clocked in and get their status
  const getUserAttendanceStatus = (user) => {
    const dateFormats = [
      selectedDate, 
      formatDateAlternative(selectedDate, 'MM/DD/YYYY'),
      formatDateAlternative(selectedDate, 'M/D/YYYY')
    ].filter(Boolean);
    
    // Check attendance object
    if (user.attendance) {
      for (const dateFormat of dateFormats) {
        if (!dateFormat) continue;
        
        const entry = user.attendance[dateFormat];
        if (entry && (entry.clockedIn === true || entry.isClocked === true || 
            entry.checkedIn === true || entry.present === true)) {
          
          // Check if they were late
          let status = 'on-time';
          const clockInTime = entry.time || entry.clockInTime || '';
          
          if (entry.onTime === false) {
            status = 'late';
          } else if (clockInTime) {
            try {
              const timeObj = new Date(`2000-01-01 ${clockInTime}`);
              const expectedTime = new Date(`2000-01-01 09:00`);
              const lateTime = new Date(`2000-01-01 09:15`);
              
              if (timeObj > lateTime) {
                status = 'late';
              } else if (timeObj > expectedTime) {
                status = 'slightly-late';
              }
            } catch (e) {
              // Ignore invalid time formats
            }
          }
          
          return { 
            present: true, 
            time: clockInTime,
            status: status
          };
        }
      }
    }
    
    // Check clockInTimes object
    if (user.clockInTimes) {
      const targetDate = new Date(selectedDate);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      for (const timestamp in user.clockInTimes) {
        try {
          const timestampDate = new Date(parseInt(timestamp));
          const timestampDateStr = timestampDate.toISOString().split('T')[0];
          
          if (timestampDateStr === targetDateStr) {
            const clockInTime = user.clockInTimes[timestamp];
            let status = 'on-time';
            
            if (clockInTime) {
              try {
                const timeObj = new Date(`2000-01-01 ${clockInTime}`);
                const expectedTime = new Date(`2000-01-01 09:00`);
                const lateTime = new Date(`2000-01-01 09:15`);
                
                if (timeObj > lateTime) {
                  status = 'late';
                } else if (timeObj > expectedTime) {
                  status = 'slightly-late';
                }
              } catch (e) {
                // Ignore invalid time formats
              }
            }
            
            return { 
              present: true, 
              time: clockInTime,
              status: status,
              timestamp: timestamp
            };
          }
        } catch (e) {
          // Ignore invalid timestamps
        }
      }
    }
    
    return { present: false };
  };

  // Get lists of users categorized by attendance status
  const getClockedInUsers = () => {
    return Object.entries(filteredUserData)
      .map(([id, user]) => {
        const status = getUserAttendanceStatus(user);
        return { id, ...user, attendance: status };
      })
      .filter(user => user.attendance.present)
      .sort((a, b) => {
        // Sort by status (on-time first, then slightly late, then late)
        const statusOrder = { 'on-time': 1, 'slightly-late': 2, 'late': 3 };
        const statusA = statusOrder[a.attendance.status] || 4;
        const statusB = statusOrder[b.attendance.status] || 4;
        
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        
        // Then sort by time if both have time
        if (a.attendance.time && b.attendance.time) {
          return a.attendance.time.localeCompare(b.attendance.time);
        }
        
        // Finally sort by name
        const nameA = a.profile?.name || a.email || '';
        const nameB = b.profile?.name || b.email || '';
        return nameA.localeCompare(nameB);
      });
  };

  const getNotClockedInUsers = () => {
    return Object.entries(filteredUserData)
      .map(([id, user]) => {
        const status = getUserAttendanceStatus(user);
        return { id, ...user, attendance: status };
      })
      .filter(user => !user.attendance.present)
      .sort((a, b) => {
        // Sort by name
        const nameA = a.profile?.name || a.email || '';
        const nameB = b.profile?.name || b.email || '';
        return nameA.localeCompare(nameB);
      });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker && !event.target.closest('.date-picker-container')) {
        setShowDatePicker(false);
      }
      
      if (showLocationDropdown && !event.target.closest('.location-dropdown-container')) {
        setShowLocationDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDatePicker, showLocationDropdown]);

  // Loading state
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <p className="text-white mt-4">Loading dashboard data...</p>
      </div>
    );
  }

  const clockedInUsers = getClockedInUsers();
  const notClockedInUsers = getNotClockedInUsers();

  return (
    <div className="dashboard-container">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Location Dashboard</h2>
              <p className="text-gray-300 mt-1">
                Viewing attendance for{' '}
                <span className="font-medium text-blue-400">
                  {activeLocation === 'all' ? 'all locations' : activeLocation}
                </span>{' '}
                on {format(new Date(selectedDate), 'MMMM d, yyyy')}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-full md:w-64">
                <div className="flex items-center bg-gray-700/50 backdrop-blur-md rounded-lg overflow-hidden border border-gray-600/30">
                  <div className="px-3 text-gray-400">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none py-2 px-2 text-white w-full focus:outline-none"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="px-3 text-gray-400 hover:text-gray-200"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Date picker */}
                <div className="relative date-picker-container">
                  <button 
                    className="dashboard-btn dashboard-btn-secondary flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDatePicker(!showDatePicker);
                      setShowLocationDropdown(false);
                    }}
                  >
                    <CalendarDays size={16} />
                    <span>{format(new Date(selectedDate), 'MMM d, yyyy')}</span>
                    <ChevronDown size={16} />
                  </button>
                  
                  {showDatePicker && (
                    <div className="absolute right-0 mt-2 bg-gray-800/90 backdrop-blur-lg border border-gray-600/50 rounded-lg shadow-lg p-4 z-30 w-64">
                      <label className="block text-sm text-gray-300 mb-2">Select Date:</label>
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={handleDateChange}
                        className="w-full bg-gray-700/80 border border-gray-600/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  )}
                </div>
                
                {/* Location filter */}
                <div className="relative location-dropdown-container">
                  <button 
                    className="dashboard-btn dashboard-btn-secondary flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLocationDropdown(!showLocationDropdown);
                      setShowDatePicker(false);
                    }}
                  >
                    <Filter size={16} />
                    <span>Location: {activeLocation === 'all' ? 'All' : activeLocation}</span>
                    <ChevronDown size={16} />
                  </button>
                  
                  {showLocationDropdown && (
                    <div className="absolute right-0 mt-2 bg-gray-800/90 backdrop-blur-lg border border-gray-600/50 rounded-lg shadow-lg overflow-hidden z-30 w-64">
                      <div className="max-h-60 overflow-y-auto py-1">
                        {getAvailableLocations().map(location => (
                          <button 
                            key={location} 
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600/50 transition-colors ${
                              activeLocation === location ? 'bg-blue-600/70 text-white' : 'text-gray-300'
                            }`}
                            onClick={() => handleLocationChange(location)}
                          >
                            {location === 'all' ? 'All Locations' : location}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Refresh button */}
                <button 
                  className="dashboard-btn dashboard-btn-primary flex items-center gap-2"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Stats cards - Fixed grid layout */}
          <div className="stats-grid">
            <div className="stat-card blue-accent">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Total Employees</h3>
                <p className="stat-value">{attendanceSummary.total}</p>
              </div>
            </div>
            
            <div className="stat-card green-accent">
              <div className="stat-icon">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Present Today</h3>
                <p className="stat-value">{attendanceSummary.present}</p>
                <p className="stat-subtitle">{getAttendanceRate()}% Attendance</p>
              </div>
            </div>
            
            <div className="stat-card red-accent">
              <div className="stat-icon">
                <AlertCircle size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Absent Today</h3>
                <p className="stat-value">{attendanceSummary.absent}</p>
              </div>
            </div>
            
            <div className="stat-card amber-accent">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">On Time Rate</h3>
                <p className="stat-value">{getOnTimeRate()}%</p>
                <p className="stat-subtitle">{attendanceSummary.late} late arrivals</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Attendance Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clocked In List */}
        <div className="list-container">
          <div className="list-header">
            <div className="list-header-icon bg-green-500/20 text-green-400">
              <CheckCircle size={22} />
            </div>
            <h3 className="list-title">Clocked In</h3>
            <span className="list-subtitle">{clockedInUsers.length}</span>
          </div>
          <div className="list-content">
            {clockedInUsers.length === 0 ? (
              <div className="list-empty">
                <div className="list-empty-icon">
                  <Users size={52} />
                </div>
                <p>No employees have clocked in today</p>
                <p className="text-sm text-gray-400 mt-1">Select a different date or location to view data</p>
              </div>
            ) : (
              clockedInUsers.map(user => (
                <div key={user.id} className="list-item">
                  <div className={`user-avatar ${
                    user.attendance.status === 'late' ? 'avatar-late' : 
                    user.attendance.status === 'slightly-late' ? 'avatar-late' : 'avatar-on-time'
                  }`}>
                    {getInitials(user)}
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.profile?.name || 
                       (user.profile?.firstName && user.profile?.lastName ? 
                        `${user.profile.firstName} ${user.profile.lastName}` : 'Unknown User')}
                    </div>
                    <div className="user-info">
                      <div className="user-info-item">
                        <MapPin size={14} className="user-info-icon" />
                        <span>{user.profile?.primaryLocation || 'No Location'}</span>
                      </div>
                      <div className="user-info-item">
                        <Briefcase size={14} className="user-info-icon" />
                        <span>{user.profile?.department || 'No Department'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="time-info">
                    <StatusBadge clockInTime={user.attendance.time} />
                    {user.attendance.time && (
                      <div className="text-base font-medium text-white mt-1.5">
                        {user.attendance.time}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Not Clocked In List */}
        <div className="list-container">
          <div className="list-header">
            <div className="list-header-icon bg-red-500/20 text-red-400">
              <AlertCircle size={22} />
            </div>
            <h3 className="list-title">Not Clocked In</h3>
            <span className="list-subtitle">{notClockedInUsers.length}</span>
          </div>
          <div className="list-content">
            {notClockedInUsers.length === 0 ? (
              <div className="list-empty">
                <div className="list-empty-icon">
                  <CheckCircle size={52} />
                </div>
                <p>All employees have clocked in today!</p>
                <p className="text-sm text-gray-400 mt-1">Perfect attendance achieved</p>
              </div>
            ) : (
              notClockedInUsers.map(user => (
                <div key={user.id} className="list-item">
                  <div className="user-avatar avatar-absent">
                    {getInitials(user)}
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.profile?.name || 
                       (user.profile?.firstName && user.profile?.lastName ? 
                        `${user.profile.firstName} ${user.profile.lastName}` : 'Unknown User')}
                    </div>
                    <div className="user-info">
                      <div className="user-info-item">
                        <Mail size={14} className="user-info-icon" />
                        <span>{user.email || 'No Email'}</span>
                      </div>
                      <div className="user-info-item">
                        <MapPin size={14} className="user-info-icon" />
                        <span>{user.profile?.primaryLocation || 'No Location'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="time-info">
                    <StatusBadge clockInTime={null} />
                    <div className="text-sm text-gray-400 mt-1.5">Not checked in</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationAdminDashboard;
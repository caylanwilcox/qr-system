import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// Add these styles to your CSS file
const cssStyles = `
  /* Location-specific metrics styles */
  .location-specific-metrics {
    margin-top: 1.5rem;
    padding: 1rem;
    background: rgba(30, 41, 59, 0.5);
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.1);
    backdrop-filter: blur(8px);
  }

  .metrics-title {
    font-size: 1rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 1rem;
  }

  .metrics-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .metric-card {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background: rgba(51, 65, 85, 0.4);
    border-radius: 0.375rem;
    border: 1px solid rgba(148, 163, 184, 0.1);
  }

  .metric-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 0.25rem;
    margin-right: 0.75rem;
    color: #60a5fa;
  }

  .metric-content {
    flex: 1;
  }

  .metric-label {
    font-size: 0.813rem;
    color: #94a3b8;
    margin-bottom: 0.25rem;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .metric-subtitle {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
  }
`;

// Status badge component
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
  const [allUserData, setAllUserData] = useState({}); // Store all accessible user data
  const [filteredUserData, setFilteredUserData] = useState({});
  const [activeLocation, setActiveLocation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for UI elements
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  
  // Store location information
  const [locationInfo, setLocationInfo] = useState({
    availableLocations: [],
    locationUserCount: {},
    userLocationMap: {} // Maps user IDs to their location
  });

  // Function to normalize location keys for comparison
  const normalizeLocationKey = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };

  // Get current date in ISO format (YYYY-MM-DD)
  const getCurrentDateISO = () => new Date().toISOString().split('T')[0];

  // Helper function to format dates for comparison
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

  // Helper to extract a user's location from various fields
  const extractUserLocation = (user) => {
    if (!user) return null;
    
    // Check all possible location fields
    const possibleLocations = [
      user.location,
      user.locationKey,
      user.profile?.location,
      user.profile?.locationKey,
      user.profile?.primaryLocation
    ];
    
    // Find the first non-empty location
    for (const loc of possibleLocations) {
      if (loc && typeof loc === 'string' && loc.trim() !== '') {
        return loc.trim();
      }
    }
    
    return null;
  };

  // Check if user belongs to a specific location
  const userBelongsToLocation = (user, location) => {
    if (location === 'all') return true;
    
    const userLocation = extractUserLocation(user);
    if (!userLocation) return false;
    
    return (
      userLocation === location || 
      normalizeLocationKey(userLocation) === normalizeLocationKey(location)
    );
  };

  // Check if user is clocked in and get their status for the selected date
  const getUserAttendanceStatus = useCallback((user) => {
    if (!user) return { present: false };
    
    const dateFormats = [
      selectedDate, 
      formatDateAlternative(selectedDate, 'MM/DD/YYYY'),
      formatDateAlternative(selectedDate, 'M/D/YYYY')
    ].filter(Boolean);
    
    // Check attendance object (standard format)
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
    
    // Also check direct date entries in user object
    for (const dateFormat of dateFormats) {
      if (!dateFormat || !user[dateFormat]) continue;
      
      const entry = user[dateFormat];
      if (entry && (entry.clockedIn === true || entry.isClocked === true || 
          entry.checkedIn === true || entry.present === true)) {
        
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
    
    // Check clockInTimes object (timestamp-based format)
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
    
    // Finally, check dailyAttendance array if present
    if (user.dailyAttendance && Array.isArray(user.dailyAttendance)) {
      // Try to find attendance entry for selected date
      const targetDate = new Date(selectedDate);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      for (const entry of user.dailyAttendance) {
        if (!entry.date) continue;
        
        // Handle various date formats
        let entryDateStr = entry.date;
        if (entryDateStr.includes('T')) {
          entryDateStr = entryDateStr.split('T')[0];
        }
        
        // Compare dates
        if (entryDateStr === targetDateStr || 
            entryDateStr === formatDateAlternative(selectedDate, 'MM/DD/YYYY') ||
            entryDateStr === formatDateAlternative(selectedDate, 'M/D/YYYY')) {
          
          if (entry.present || entry.clockedIn || entry.isClocked || entry.checkedIn) {
            const clockInTime = entry.time || entry.clockInTime || '';
            let status = 'on-time';
            
            if (entry.onTime === false || entry.late === true) {
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
    }
    
    return { present: false };
  }, [selectedDate]);

  // Calculate attendance metrics for the current view
  const calculateAttendanceMetrics = useCallback(() => {
    // Filter users based on active location
    const relevantUsers = activeLocation === 'all' 
      ? Object.values(allUserData)
      : Object.values(allUserData).filter(user => 
          userBelongsToLocation(user, activeLocation)
        );
    
    if (relevantUsers.length === 0) {
      return {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        onTime: 0,
        attendance: 0,
        onTimeRate: 0
      };
    }
    
    let present = 0;
    let absent = 0;
    let late = 0;
    let onTime = 0;
    
    // Check attendance status for each user
    relevantUsers.forEach(user => {
      const status = getUserAttendanceStatus(user);
      if (status.present) {
        present++;
        if (status.status === 'late' || status.status === 'slightly-late') {
          late++;
        } else {
          onTime++;
        }
      } else {
        absent++;
      }
    });
    
    // Calculate rates
    const total = present + absent;
    const attendance = total > 0 ? Math.round((present / total) * 100) : 0;
    const onTimeRate = present > 0 ? Math.round((onTime / present) * 100) : 0;
    
    return {
      total,
      present,
      absent,
      late,
      onTime,
      attendance,
      onTimeRate
    };
  }, [allUserData, activeLocation, getUserAttendanceStatus]);

  // Calculate service metrics (padrinos, orejas, apoyos)
  const calculateServiceMetrics = useCallback(() => {
    // Filter users based on active location
    const relevantUsers = activeLocation === 'all' 
      ? Object.values(allUserData)
      : Object.values(allUserData).filter(user => 
          userBelongsToLocation(user, activeLocation)
        );
    
    if (relevantUsers.length === 0) {
      return {
        totalCount: 0,
        activeCount: 0,
        padrinoCount: 0,
        orejaCount: 0,
        apoyoCount: 0
      };
    }
    
    let totalCount = relevantUsers.length;
    let activeCount = 0;
    let padrinoCount = 0;
    let orejaCount = 0;
    let apoyoCount = 0;
    
    // Calculate counts
    relevantUsers.forEach(user => {
      // Check status
      const profile = user.profile || {};
      const status = profile.status || user.status;
      if (status && status.toLowerCase() === 'active') {
        activeCount++;
      }
      
      // Check if padrino
      if (profile.padrino) {
        padrinoCount++;
      }
      
      // Check service
      const service = profile.service?.toUpperCase?.();
      if (service === 'RSG') {
        orejaCount++;
      } else if (service === 'COM') {
        apoyoCount++;
      }
    });
    
    return {
      totalCount,
      activeCount,
      padrinoCount,
      orejaCount,
      apoyoCount
    };
  }, [allUserData, activeLocation]);

  // Apply search filter
  const applySearchFilter = useCallback((users, searchTerm) => {
    if (!searchTerm.trim()) return users;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Filter by search term
    return Object.fromEntries(
      Object.entries(users).filter(([_, user]) => {
        const name = user.profile?.name || '';
        const firstName = user.profile?.firstName || '';
        const lastName = user.profile?.lastName || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : '';
        const email = user.email || '';
        const department = user.profile?.department || '';
        const service = user.profile?.service || '';
        
        return name.toLowerCase().includes(searchLower) || 
               fullName.toLowerCase().includes(searchLower) ||
               email.toLowerCase().includes(searchLower) ||
               department.toLowerCase().includes(searchLower) ||
               service.toLowerCase().includes(searchLower);
      })
    );
  }, []);

  // Fetch user data from Firebase
  useEffect(() => {
    setLoading(true);
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setAllUserData({});
          setFilteredUserData({});
          setLocationInfo({
            availableLocations: [],
            locationUserCount: {},
            userLocationMap: {}
          });
          setLoading(false);
          return;
        }

        // Process all users to determine which ones the admin has access to
        const accessibleData = {};
        const locationMap = {};
        const userLocationMap = {};
        
        Object.entries(data).forEach(([userId, user]) => {
          const userLocation = extractUserLocation(user);
          
          // Skip if no location found and not a super admin
          if (!userLocation && !hasAllLocations) return;
          
          // Check if admin has access to this user's location
          const hasAccess = hasAllLocations || 
                           adminLocations.some(adminLoc => 
                             adminLoc === userLocation || 
                             normalizeLocationKey(adminLoc) === normalizeLocationKey(userLocation)
                           );
          
          if (hasAccess) {
            // Add user to accessible data
            accessibleData[userId] = user;
            
            // Track location information
            if (userLocation) {
              if (!locationMap[userLocation]) {
                locationMap[userLocation] = 0;
              }
              locationMap[userLocation]++;
              userLocationMap[userId] = userLocation;
            }
          }
        });
        
        // Update state
        setAllUserData(accessibleData);
        
        // Filter by search if needed
        const searchFiltered = applySearchFilter(accessibleData, searchQuery);
        setFilteredUserData(searchFiltered);
        
        // Update location information
        setLocationInfo({
          availableLocations: Object.keys(locationMap).sort(),
          locationUserCount: locationMap,
          userLocationMap: userLocationMap
        });
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading user data:", error);
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [adminLocations, hasAllLocations, applySearchFilter, searchQuery]);

  // Handle location change
  const handleLocationChange = (location) => {
    setActiveLocation(location);
    setShowLocationDropdown(false);
  };

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setShowDatePicker(false);
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    // Re-apply search filter
    const searchFiltered = applySearchFilter(allUserData, searchQuery);
    setFilteredUserData(searchFiltered);
    setTimeout(() => setRefreshing(false), 500);
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
    return ['all', ...locationInfo.availableLocations];
  };

  // Get lists of users categorized by attendance status
  const getClockedInUsers = useCallback(() => {
    // Get relevant users for current location
    const locationUsers = activeLocation === 'all'
      ? filteredUserData
      : Object.fromEntries(
          Object.entries(filteredUserData).filter(([_, user]) => 
            userBelongsToLocation(user, activeLocation)
          )
        );
    
    return Object.entries(locationUsers)
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
  }, [filteredUserData, activeLocation, getUserAttendanceStatus]);

  const getNotClockedInUsers = useCallback(() => {
    // Get relevant users for current location
    const locationUsers = activeLocation === 'all'
      ? filteredUserData
      : Object.fromEntries(
          Object.entries(filteredUserData).filter(([_, user]) => 
            userBelongsToLocation(user, activeLocation)
          )
        );
    
    return Object.entries(locationUsers)
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
  }, [filteredUserData, activeLocation, getUserAttendanceStatus]);

  // Location-specific metrics component
  const LocationSpecificMetrics = () => {
    const serviceMetrics = calculateServiceMetrics();
    const { totalCount, activeCount, padrinoCount, orejaCount, apoyoCount } = serviceMetrics;
    
    // Only show this component if we have any data
    if (totalCount === 0) {
      return null;
    }
    
    return (
      <div className="location-specific-metrics">
        <div className="metrics-title">
          {activeLocation === 'all' 
            ? 'All Locations Members Summary' 
            : `${activeLocation} Members Summary`}
        </div>
        <div className="metrics-cards-grid">
          <div className="metric-card">
            <div className="metric-icon">
              <Users size={18} />
            </div>
            <div className="metric-content">
              <div className="metric-label">Total Members</div>
              <div className="metric-value">{totalCount}</div>
              {activeCount > 0 && (
                <div className="metric-subtitle">
                  {activeCount} Active ({Math.round((activeCount/totalCount) * 100)}%)
                </div>
              )}
            </div>
          </div>
          
          {padrinoCount > 0 && (
            <div className="metric-card">
              <div className="metric-icon">
                <Shield size={18} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Padrinos</div>
                <div className="metric-value">{padrinoCount}</div>
                <div className="metric-subtitle">
                  {Math.round((padrinoCount/totalCount) * 100)}% of members
                </div>
              </div>
            </div>
          )}
          
          {orejaCount > 0 && (
            <div className="metric-card">
              <div className="metric-icon">
                <User size={18} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Orejas (RSG)</div>
                <div className="metric-value">{orejaCount}</div>
                <div className="metric-subtitle">
                  {Math.round((orejaCount/totalCount) * 100)}% of members
                </div>
              </div>
            </div>
          )}
          
          {apoyoCount > 0 && (
            <div className="metric-card">
              <div className="metric-icon">
                <User size={18} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Apoyos (COM)</div>
                <div className="metric-value">{apoyoCount}</div>
                <div className="metric-subtitle">
                  {Math.round((apoyoCount/totalCount) * 100)}% of members
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
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

  // Compute lists of users
  const clockedInUsers = getClockedInUsers();
  const notClockedInUsers = getNotClockedInUsers();
  
  // Get attendance metrics
  const metrics = calculateAttendanceMetrics();

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
          
          {/* Additional Location-specific Metrics */}
          <LocationSpecificMetrics />
          
          {/* Stats cards - Fixed grid layout */}
          <div className="stats-grid">
            <div className="stat-card blue-accent">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Total Employees</h3>
                <p className="stat-value">{metrics.total}</p>
                {activeLocation !== 'all' && (
                  <p className="stat-subtitle">
                    {Object.keys(allUserData).length > 0 
                      ? `${Math.round((metrics.total / Object.keys(allUserData).length) * 100)}% of all employees`
                      : '0% of all employees'
                    }
                  </p>
                )}
              </div>
            </div>
            
            <div className="stat-card green-accent">
              <div className="stat-icon">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Present Today</h3>
                <p className="stat-value">{metrics.present}</p>
                <p className="stat-subtitle">{metrics.attendance}% Attendance</p>
              </div>
            </div>
            
            <div className="stat-card red-accent">
              <div className="stat-icon">
                <AlertCircle size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Absent Today</h3>
                <p className="stat-value">{metrics.absent}</p>
                {metrics.total > 0 && (
                  <p className="stat-subtitle">
                    {Math.round((metrics.absent / metrics.total) * 100)}% of {activeLocation === 'all' ? 'all' : activeLocation} employees
                  </p>
                )}
              </div>
            </div>
            
            <div className="stat-card amber-accent">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">On Time Rate</h3>
                <p className="stat-value">{metrics.onTimeRate}%</p>
                <p className="stat-subtitle">{metrics.late} late arrivals</p>
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
                        `${user.profile.firstName} ${user.profile.lastName}` : 
                        user.email || 'Unknown User')}
                    </div>
                    <div className="user-info">
                      <div className="user-info-item">
                        <MapPin size={14} className="user-info-icon" />
                        <span>
                          {extractUserLocation(user) || 'No Location'}
                        </span>
                      </div>
                      <div className="user-info-item">
                        <Briefcase size={14} className="user-info-icon" />
                        <span>{user.profile?.department || user.profile?.service || 'No Department'}</span>
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
                        `${user.profile.firstName} ${user.profile.lastName}` : 
                        user.email || 'Unknown User')}
                    </div>
                    <div className="user-info">
                      <div className="user-info-item">
                        <Mail size={14} className="user-info-icon" />
                        <span>{user.email || 'No Email'}</span>
                      </div>
                      <div className="user-info-item">
                        <MapPin size={14} className="user-info-icon" />
                        <span>
                          {extractUserLocation(user) || 'No Location'}
                        </span>
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
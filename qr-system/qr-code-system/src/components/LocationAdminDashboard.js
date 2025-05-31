import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { 
  Users, Calendar, Clock, RefreshCw, Filter, ChevronDown, 
  AlertCircle, CheckCircle, CalendarDays, MapPin, Building,
  User, Mail, Briefcase, ArrowUp, Search, X, Clock3, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import './LocationAdminDashboard.css';
import LocationMetricsGrid from './LocationMetricsGrid';
import { useAuth } from '../services/authContext'; // Import auth context to get current user

// Extract pure functions outside component to prevent recreation on render
const normalizeLocationKey = (text) => {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, '');
};

// Format dates for comparison - pure function
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

// Helper function to extract initials - pure function
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

// Status badge component - extracted for better reuse
const StatusBadge = ({ clockInTime, userData, date }) => {
  if (!clockInTime) {
    return (
      <span className="badge badge-absent">
        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
        Absent
      </span>
    );
  }

  // FIXED: Only calculate late status if user has scheduled events for this date
  let isLate = false;
  let isSlightlyLate = false;
  
  if (userData && date) {
    // Check if user has scheduled events for this date
    let hasScheduledEvents = false;
    
    if (userData.events) {
      Object.values(userData.events).forEach(eventTypeData => {
        if (eventTypeData && typeof eventTypeData === 'object') {
          Object.values(eventTypeData).forEach(eventData => {
            if (eventData && eventData.scheduled && eventData.date === date) {
              hasScheduledEvents = true;
            }
          });
        }
      });
    }
    
    // Only apply late logic if there are scheduled events
    if (hasScheduledEvents) {
      try {
        const clockInTime9AM = new Date(`2000-01-01 ${clockInTime}`);
        const expectedTime = new Date(`2000-01-01 09:00`);
        const lateTime = new Date(`2000-01-01 09:15`);

        if (clockInTime9AM > lateTime) {
          isLate = true;
        } else if (clockInTime9AM > expectedTime) {
          isSlightlyLate = true;
        }
      } catch (e) {
        // If time parsing fails, don't mark as late
        isLate = false;
        isSlightlyLate = false;
      }
    }
  }

  // Return status based on calculation
  if (isLate) {
    return (
      <span className="badge badge-late">
        <Clock className="w-3.5 h-3.5 mr-1.5" />
        Late
      </span>
    );
  }

  if (isSlightlyLate) {
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
};

// Optional Debug component - disabled by default in production
const DebugInfo = ({ enabled, allUserData, filteredUserData, activeLocation, adminLocations, hasAllLocations, context, currentUser }) => {
  if (!enabled) return null;
  
  const stats = {
    allUsers: Object.keys(allUserData || {}).length,
    filteredUsers: Object.keys(filteredUserData || {}).length,
    activeLocation,
    adminLocations,
    hasAllLocations,
    contextAvailable: !!context,
    contextKeys: context ? Object.keys(context) : [],
    currentUser: currentUser ? {
      id: currentUser.uid,
      email: currentUser.email,
      location: currentUser.profile?.primaryLocation || currentUser.profile?.locationKey || currentUser.location
    } : 'Not logged in'
  };
  
  return (
    <div style={{
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'lime',
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '400px',
      fontFamily: 'monospace',
      overflowY: 'auto',
      maxHeight: '500px'
    }}>
      <div>Debug Info:</div>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
    </div>
  );
};

const LocationAdminDashboard = () => {
  const navigate = useNavigate();
  
  // Get current user from auth context
  const { user: currentUser } = useAuth();
  
  // Get admin's location from user profile - extract as const to avoid recalculation
  const userLocation = useMemo(() => {
    return currentUser?.profile?.primaryLocation || 
           currentUser?.profile?.locationKey || 
           currentUser?.profile?.location ||
           currentUser?.location;
  }, [currentUser]);
  
  // Get context with fallback values
  const context = useOutletContext() || {};
  const adminLocations = context.adminLocations || [];
  const hasAllLocations = context.hasAllLocations || false;
  
  // Memoize admin locations to avoid recreating on each render
  const effectiveAdminLocations = useMemo(() => {
    const locations = adminLocations.length > 0 ? 
      [...adminLocations] : 
      ['Aurora', 'Elgin', 'Joliet', 'Wheeling']; // Default to some locations for testing
    
    // Add user's own location if it exists and isn't already in the list
    if (userLocation && !locations.includes(userLocation)) {
      locations.push(userLocation);
    }
    
    return locations;
  }, [adminLocations, userLocation]);
  
  // State declarations
  const [loading, setLoading] = useState(true);
  const [allUserData, setAllUserData] = useState({});
  const [filteredUserData, setFilteredUserData] = useState({});
  const [activeLocation, setActiveLocation] = useState('all'); // Default to all, will update based on userLocation
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationInfo, setLocationInfo] = useState({
    availableLocations: [],
    locationUserCount: {},
    userLocationMap: {}
  });

  // Set active location based on user location on mount
  useEffect(() => {
    if (userLocation) {
      setActiveLocation(userLocation);
    }
  }, [userLocation]);

  // Helper to extract a user's location - extracted as useCallback with no dependencies
  const extractUserLocation = useCallback((user) => {
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
  }, []);

  // Check if user belongs to a specific location - dependencies properly declared
  const userBelongsToLocation = useCallback((user, location) => {
    // If viewing all locations, check if admin has access to user's location
    if (location === 'all') {
      const userLocation = extractUserLocation(user);
      if (!userLocation && !hasAllLocations) return false;
      
      return hasAllLocations || effectiveAdminLocations.some(adminLoc => 
        adminLoc === userLocation || 
        normalizeLocationKey(adminLoc) === normalizeLocationKey(userLocation)
      );
    }
    
    // If filtering by specific location, check if it matches and admin has access
    const userLocation = extractUserLocation(user);
    if (!userLocation) return false;
    
    const locationMatch = userLocation === location || 
                         normalizeLocationKey(userLocation) === normalizeLocationKey(location);
    
    // Check if admin has access to this location
    const hasAccess = hasAllLocations || effectiveAdminLocations.some(adminLoc => 
      adminLoc === location || 
      normalizeLocationKey(adminLoc) === normalizeLocationKey(location)
    );
    
    return locationMatch && hasAccess;
  }, [effectiveAdminLocations, hasAllLocations, extractUserLocation]);

  // Helper function to check if user has scheduled events for a date
  const userHasScheduledEvents = useCallback((user, date) => {
    if (!user?.events || !date) return false;
    
    let hasScheduled = false;
    Object.values(user.events).forEach(eventTypeData => {
      if (eventTypeData && typeof eventTypeData === 'object') {
        Object.values(eventTypeData).forEach(eventData => {
          if (eventData && eventData.scheduled && eventData.date === date) {
            hasScheduled = true;
          }
        });
      }
    });
    return hasScheduled;
  }, []);

  // Check if user is clocked in - dependencies properly declared
  const getUserAttendanceStatus = useCallback((user) => {
    if (!user) return { present: false };
    
    const dateFormats = [
      selectedDate, 
      formatDateAlternative(selectedDate, 'MM/DD/YYYY'),
      formatDateAlternative(selectedDate, 'M/D/YYYY')
    ].filter(Boolean);

    // Helper function to determine status based on time and scheduled events
    const determineStatusFromTime = (clockInTime, user, date) => {
      if (!clockInTime) return 'on-time';
      
      // Only apply late logic if user has scheduled events
      const hasScheduledEvents = userHasScheduledEvents(user, date);
      if (!hasScheduledEvents) return 'on-time';
      
      try {
        const timeObj = new Date(`2000-01-01 ${clockInTime}`);
        const expectedTime = new Date(`2000-01-01 09:00`);
        const lateTime = new Date(`2000-01-01 09:15`);
        
        if (timeObj > lateTime) {
          return 'late';
        } else if (timeObj > expectedTime) {
          return 'slightly-late';
        }
        return 'on-time';
      } catch (e) {
        return 'on-time';
      }
    };

    // Check attendance object (standard format)
    if (user.attendance) {
      for (const dateFormat of dateFormats) {
        if (!dateFormat) continue;
        
        const entry = user.attendance[dateFormat];
        if (!entry) continue;
        
        // If clockedIn is explicitly false, user has clocked out - return not present
        if (entry.clockedIn === false) {
          return { present: false };
        }
        
        if (entry.clockedIn === true || entry.isClocked === true || 
            entry.checkedIn === true || entry.present === true) {
          
          // Check if they were late
          let status = 'on-time';
          const clockInTime = entry.time || entry.clockInTime || '';
          
          if (entry.onTime === false) {
            status = 'late';
          } else if (clockInTime) {
            status = determineStatusFromTime(clockInTime, user, dateFormat);
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
      if (!entry) continue;
      
      // If clockedIn is explicitly false, user has clocked out - return not present
      if (entry.clockedIn === false) {
        return { present: false };
      }
      
      if (entry.clockedIn === true || entry.isClocked === true || 
          entry.checkedIn === true || entry.present === true) {
        
        let status = 'on-time';
        const clockInTime = entry.time || entry.clockInTime || '';
        
        if (entry.onTime === false) {
          status = 'late';
        } else if (clockInTime) {
          status = determineStatusFromTime(clockInTime, user, dateFormat);
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
            // Check if there's a corresponding clock-out time
            if (user.clockOutTimes && user.clockOutTimes[timestamp]) {
              return { present: false }; // User has clocked out
            }
            
            const clockInTime = user.clockInTimes[timestamp];
            let status = 'on-time';
            
            if (clockInTime) {
              status = determineStatusFromTime(clockInTime, user, selectedDate);
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
    
    // Check if user is explicitly clocked out via direct flags
    if (user.clockedIn === false) {
      return { present: false }; // User is explicitly clocked out
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
          
          // If clockedIn is explicitly false, user has clocked out
          if (entry.clockedIn === false) {
            return { present: false };
          }
          
          if (entry.present || entry.clockedIn || entry.isClocked || entry.checkedIn) {
            const clockInTime = entry.time || entry.clockInTime || '';
            let status = 'on-time';
            
            if (entry.onTime === false || entry.late === true) {
              status = 'late';
            } else if (clockInTime) {
              status = determineStatusFromTime(clockInTime, user, selectedDate);
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
  }, [selectedDate, userHasScheduledEvents]);

  // Apply search filter - memoize this function
  const applySearchFilter = useCallback((users, searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) return users;
    
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

  // Check if admin can access this specific location
  const canAccessLocation = useCallback((location) => {
    if (hasAllLocations) return true;
    if (location === 'all') return true;
    
    // Check if it's the user's own location
    if (userLocation && (location === userLocation || 
        normalizeLocationKey(location) === normalizeLocationKey(userLocation))) {
      return true;
    }
    
    return effectiveAdminLocations.some(adminLoc => 
      adminLoc === location || 
      normalizeLocationKey(adminLoc) === normalizeLocationKey(location)
    );
  }, [effectiveAdminLocations, hasAllLocations, userLocation]);

  // Calculate attendance metrics - memoized to avoid recalculation
  const calculateAttendanceMetrics = useCallback(() => {
    // Filter users based on active location
    const relevantUsers = Object.values(filteredUserData).filter(user => 
      activeLocation === 'all' || userBelongsToLocation(user, activeLocation)
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
  }, [filteredUserData, activeLocation, getUserAttendanceStatus, userBelongsToLocation]);

  // Calculate service metrics - memoized to avoid recalculation
  const calculateServiceMetrics = useCallback(() => {
    // Filter users based on active location
    const relevantUsers = Object.values(filteredUserData).filter(user => 
      activeLocation === 'all' || userBelongsToLocation(user, activeLocation)
    );
    
    if (relevantUsers.length === 0) {
      return {
        totalCount: 0,
        activeCount: 0,
        padrinoCount: 0,
        padrinosBlue: 0,
        padrinosGreen: 0,
        padrinosOrange: 0,
        padrinosRed: 0,
        orejaCount: 0,
        apoyoCount: 0
      };
    }
    
    let totalCount = relevantUsers.length;
    let activeCount = 0;
    let padrinoCount = 0;
    let padrinosBlue = 0;
    let padrinosGreen = 0;
    let padrinosOrange = 0;
    let padrinosRed = 0;
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
        
        // Count by color
        const color = profile.padrinoColorCode?.toLowerCase?.();
        if (color === 'blue') padrinosBlue++;
        else if (color === 'green') padrinosGreen++;
        else if (color === 'orange') padrinosOrange++;
        else if (color === 'red') padrinosRed++;
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
      padrinosBlue,
      padrinosGreen,
      padrinosOrange,
      padrinosRed,
      orejaCount,
      apoyoCount
    };
  }, [filteredUserData, activeLocation, userBelongsToLocation]);

  // Get lists of users categorized by attendance status - memoized for performance
  const clockedInUsers = useMemo(() => {
    // Get relevant users for current location
    const locationUsers = Object.entries(filteredUserData)
      .filter(([_, user]) => 
        activeLocation === 'all' ? 
          userBelongsToLocation(user, 'all') :
          userBelongsToLocation(user, activeLocation)
      )
      .reduce((acc, [id, user]) => {
        acc[id] = user;
        return acc;
      }, {});
    
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
  }, [filteredUserData, activeLocation, getUserAttendanceStatus, userBelongsToLocation]);

  const notClockedInUsers = useMemo(() => {
    // Get relevant users for current location
    const locationUsers = Object.entries(filteredUserData)
      .filter(([_, user]) => 
        activeLocation === 'all' ? 
          userBelongsToLocation(user, 'all') :
          userBelongsToLocation(user, activeLocation)
      )
      .reduce((acc, [id, user]) => {
        acc[id] = user;
        return acc;
      }, {});
    
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
  }, [filteredUserData, activeLocation, getUserAttendanceStatus, userBelongsToLocation]);

  // Get all available locations - memoize this calculation
  const availableLocations = useMemo(() => {
    // Start with 'all' option
    const result = ['all'];
    
    // Add user's own location if it exists
    if (userLocation && !result.includes(userLocation)) {
      result.push(userLocation);
    }
    
    // Filter available locations to only those admin has access to
    const accessibleLocations = locationInfo.availableLocations.filter(loc => 
      hasAllLocations || loc === userLocation || effectiveAdminLocations.some(adminLoc => 
        adminLoc === loc || normalizeLocationKey(adminLoc) === normalizeLocationKey(loc)
      )
    );
    
    // Combine all unique locations
    return [...new Set([...result, ...accessibleLocations])];
  }, [locationInfo, userLocation, hasAllLocations, effectiveAdminLocations]);

  // Memoized attendance metrics
  const attendanceMetrics = useMemo(() => 
    calculateAttendanceMetrics(), 
    [calculateAttendanceMetrics]
  );
  
  // Memoized service metrics
  const serviceMetrics = useMemo(() => 
    calculateServiceMetrics(), 
    [calculateServiceMetrics]
  );

  // Fetch user data from Firebase - fixed with proper dependencies
  useEffect(() => {
    console.log("Data loading effect running");
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
          const extractedUserLocation = extractUserLocation(user);
          
          // Skip if no location found and not a super admin
          if (!extractedUserLocation && !hasAllLocations) {
            return;
          }
          
          // Check if user belongs to our location
          const isOurLocation = userLocation && (
            extractedUserLocation === userLocation || 
            normalizeLocationKey(extractedUserLocation) === normalizeLocationKey(userLocation)
          );
          
          // Check if admin has access to this user's location
          const hasAccess = hasAllLocations || isOurLocation || 
                           effectiveAdminLocations.some(adminLoc => 
                             adminLoc === extractedUserLocation || 
                             normalizeLocationKey(adminLoc) === normalizeLocationKey(extractedUserLocation)
                           );
          
          if (hasAccess) {
            // Add user to accessible data
            accessibleData[userId] = user;
            
            // Track location information
            if (extractedUserLocation) {
              if (!locationMap[extractedUserLocation]) {
                locationMap[extractedUserLocation] = 0;
              }
              locationMap[extractedUserLocation]++;
              userLocationMap[userId] = extractedUserLocation;
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
  }, [
    hasAllLocations, 
    userLocation, 
    effectiveAdminLocations, 
    searchQuery, 
    applySearchFilter, 
    extractUserLocation 
  ]);

  // Effect to close dropdowns when clicking outside
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

  // Handle location change
  const handleLocationChange = (location) => {
    // Only allow changing to locations the admin has access to
    if (canAccessLocation(location)) {
      setActiveLocation(location);
    } else {
      console.warn(`Cannot set location to ${location} - admin doesn't have access`);
    }
    setShowLocationDropdown(false);
  };

  // Handle date change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setShowDatePicker(false);
  };

  // Handle refresh - using batch updates to avoid unnecessary renders
  const handleRefresh = () => {
    setRefreshing(true);
    
    // Only update if search is active
    if (searchQuery.trim()) {
      const searchFiltered = applySearchFilter(allUserData, searchQuery);
      setFilteredUserData(searchFiltered);
    }
    
    // Simulate refresh with timer
    setTimeout(() => setRefreshing(false), 500);
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <p className="text-white mt-4">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Debug Info - Setting enabled to false will disable debugging information */}
      <DebugInfo 
        enabled={false} 
        allUserData={allUserData} 
        filteredUserData={filteredUserData} 
        activeLocation={activeLocation}
        adminLocations={effectiveAdminLocations}
        hasAllLocations={hasAllLocations}
        context={context}
        currentUser={currentUser}
      />
      
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
              <p className="text-xs text-gray-400 mt-1">
                Your Location: {userLocation || 'Not Set'} • 
                Access to: {hasAllLocations ? 'All Locations' : (
                  effectiveAdminLocations.length > 0 ? 
                  effectiveAdminLocations.join(', ') : 
                  'Demo Mode - All Locations Enabled'
                )}
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
                        {availableLocations.map(location => (
                          <button 
                            key={location} 
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600/50 transition-colors ${
                              activeLocation === location ? 'bg-blue-600/70 text-white' : 'text-gray-300'
                            } ${location === userLocation ? 'font-semibold' : ''}`}
                            onClick={() => handleLocationChange(location)}
                          >
                            {location === 'all' ? 'All Locations' : location}
                            {location === userLocation && ' (Your Location)'}
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
          
          {/* Clickable Metrics Grid */}
          <LocationMetricsGrid 
            serviceMetrics={serviceMetrics} 
            activeLocation={activeLocation}
            searchQuery={searchQuery}
          />
          
          {/* Stats cards - Fixed grid layout */}
          <div className="stats-grid">
            <div className="stat-card blue-accent">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Total Employees</h3>
                <p className="stat-value">{attendanceMetrics.total}</p>
                {activeLocation !== 'all' && Object.keys(allUserData).length > 0 && (
                  <p className="stat-subtitle">
                    {Math.round((attendanceMetrics.total / Object.keys(allUserData).length) * 100)}% of all employees
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
                <p className="stat-value">{attendanceMetrics.present}</p>
                <p className="stat-subtitle">{attendanceMetrics.attendance}% Attendance</p>
              </div>
            </div>
            
            <div className="stat-card red-accent">
              <div className="stat-icon">
                <AlertCircle size={24} />
              </div>
              <div className="stat-content">
                <h3 className="stat-title">Absent Today</h3>
                <p className="stat-value">{attendanceMetrics.absent}</p>
                {attendanceMetrics.total > 0 && (
                  <p className="stat-subtitle">
                    {Math.round((attendanceMetrics.absent / attendanceMetrics.total) * 100)}% of {activeLocation === 'all' ? 'all' : activeLocation} employees
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
                <p className="stat-value">{attendanceMetrics.onTimeRate}%</p>
                <p className="stat-subtitle">{attendanceMetrics.late} late arrivals</p>
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
                    <StatusBadge clockInTime={user.attendance.time} userData={user} date={selectedDate} />
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
                    <StatusBadge clockInTime={null} userData={user} date={selectedDate} />
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
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { useAuth } from '../../services/authContext';
import { database } from '../../services/firebaseConfig';
import { RefreshCw, X } from 'lucide-react';
import moment from 'moment-timezone';

// Components
import FilterControls from './FilterControls';
import StatsCards from './StatsCards';
import MonthlyChart from './MonthlyChart';
import EmployeeTable from './EmployeeTable';

const ReportsContainer = ({ locationFiltered = false }) => {
  const { user } = useAuth();
  
  // Core state
  const [employeeReports, setEmployeeReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [filteredMonthlyAttendance, setFilteredMonthlyAttendance] = useState([]);
  const [monthlyEmployeeData, setMonthlyEmployeeData] = useState({});
  const [missingEmployeeData, setMissingEmployeeData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [overallStats, setOverallStats] = useState({
    totalMembers: 0,
    totalClockIns: 0,
    avgAttendance: 0,
    activePadrinos: 0,
  });
  
  // Original attendance data
  const [rawAttendanceData, setRawAttendanceData] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Get Chicago time for date calculations
  const getChicagoDate = () => {
    return moment().tz('America/Chicago').format('YYYY-MM-DD');
  };

  // Convert timestamp to Chicago timezone date
  const timestampToChicagoDate = (timestamp) => {
    return moment(parseInt(timestamp)).tz('America/Chicago').format('YYYY-MM-DD');
  };

  // Fetch employee data with location filtering
  const fetchEmployeeData = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    
    try {
      // Get user location if locationFiltered is true
      const userLocation = locationFiltered && user && user.profile ? 
        (user.profile.locationKey || user.profile.primaryLocation) : null;
      
      const usersRef = ref(database, 'users');
      const globalAttendanceRef = ref(database, 'attendance');
      const eventTypesRef = ref(database, 'eventTypes');
      const deletedUsersRef = ref(database, 'deleted_users');

      // Fetch all users
      const users = await new Promise((resolve) =>
        onValue(usersRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );

      // Fetch deleted users
      const deletedUsers = await new Promise((resolve) =>
        onValue(deletedUsersRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );

      // Fetch global attendance data
      const globalAttendance = await new Promise((resolve) =>
        onValue(globalAttendanceRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );
      
      // Store raw attendance data
      setRawAttendanceData(globalAttendance);
      
      // Fetch event types
      const eventTypesData = await new Promise((resolve) =>
        onValue(eventTypesRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );
      
      // Process event types
      const eventTypesList = Object.entries(eventTypesData || {}).map(([id, data]) => ({
        id,
        name: data.name,
        displayName: data.displayName || data.name
      }));
      
      console.log("Fetched global attendance data:", globalAttendance);
      console.log("Fetched event types from database:", eventTypesList);

      // Filter users by location if needed
      const filteredUsers = locationFiltered && userLocation 
        ? Object.fromEntries(
            Object.entries(users).filter(([_, userData]) => {
              const userLoc = userData.location || 
                (userData.profile && (userData.profile.locationKey || userData.profile.primaryLocation));
              return userLoc && userLoc.toLowerCase() === userLocation.toLowerCase();
            })
          )
        : users;

      // Fetch individual user attendance records and combine with global data
      const combinedAttendanceData = await fetchCombinedAttendanceData(filteredUsers, globalAttendance);

      // Collect actual event types from attendance data
      const actualEventTypes = new Set();
      Object.values(combinedAttendanceData || {}).forEach(locationData => {
        Object.values(locationData || {}).forEach(dateData => {
          Object.values(dateData || {}).forEach(record => {
            if (record.eventType) {
              actualEventTypes.add(record.eventType);
            }
          });
        });
      });

      // Create event types list from actual data + database event types
      const allEventTypes = [...eventTypesList];
      
      // Helper function to normalize event type names for comparison
      const normalizeEventType = (eventType) => {
        return eventType.toLowerCase().replace(/[^a-z0-9]/g, '');
      };
      
      // Add event types found in actual data that aren't in the database
      Array.from(actualEventTypes).forEach(eventType => {
        const normalizedEventType = normalizeEventType(eventType);
        
        // Check if this event type already exists (case-insensitive, ignoring spaces/special chars)
        const existingType = allEventTypes.find(et => 
          normalizeEventType(et.id) === normalizedEventType || 
          normalizeEventType(et.name) === normalizedEventType ||
          normalizeEventType(et.displayName || '') === normalizedEventType
        );
        
        if (!existingType) {
          // Create a display name by capitalizing and formatting
          const displayName = eventType
            .split(/(?=[A-Z])|_|-/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          
          allEventTypes.push({
            id: eventType, // Use the original event type as the id/value
            name: eventType,
            displayName: displayName
          });
        } else {
          // If it exists in database but we have actual data, prefer the actual data format for the id
          // This ensures the dropdown value matches what's in the attendance records
          if (existingType.id !== eventType) {
            existingType.id = eventType;
            existingType.name = eventType;
          }
        }
      });
      
      setEventTypes(allEventTypes);
      console.log("Final event types:", allEventTypes);

      // Process data
      const reports = calculateEmployeeReports(filteredUsers, combinedAttendanceData);
      setEmployeeReports(reports);
      
      // Calculate monthly attendance data for chart
      const { monthlyData, missingEmployees, totalClockIns } = 
        calculateMonthlyAttendance(combinedAttendanceData, filteredUsers, deletedUsers, userLocation);
      
      console.log("Calculated monthly data:", monthlyData);
      console.log("Missing employees:", missingEmployees);
      console.log("Total Clock-ins:", totalClockIns);
      
      setMonthlyAttendance(monthlyData);
      setFilteredMonthlyAttendance(monthlyData);
      setMissingEmployeeData(missingEmployees);
      
      // Reset month selection when data refreshes
      setSelectedMonth(null);
      
      // Filter reports
      setFilteredReports(reports);

      // Update overall stats with the correct total clock-ins count
      updateStats(filteredUsers, reports, totalClockIns);
      
      setLoading(false);
      setTimeout(() => setRefreshing(false), 500);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationFiltered, user]);

  // Fetch and combine user-specific attendance records with global attendance data
  const fetchCombinedAttendanceData = async (users, globalAttendance) => {
    const combinedData = { ...globalAttendance };
    const allLocations = new Set();
    
    // Add locations from global attendance
    Object.keys(globalAttendance || {}).forEach(location => {
      if (location && location !== 'undefined' && location !== 'null') {
        allLocations.add(location);
      }
    });

    // Fetch all events to get scheduled times for late calculation
    const eventsRef = ref(database, 'events');
    const eventsSnapshot = await get(eventsRef);
    const allEvents = eventsSnapshot.exists() ? eventsSnapshot.val() : {};
    
    console.log("Fetched events for late calculation:", Object.keys(allEvents).length);

    // Process each user's individual attendance records
    for (const [userId, userData] of Object.entries(users || {})) {
      if (!userData || !userData.profile) continue;

      try {
        // Fetch user's individual attendance records
        const userAttendanceRef = ref(database, `users/${userId}/attendance`);
        const userAttendanceSnapshot = await get(userAttendanceRef);
        const userAttendance = userAttendanceSnapshot.exists() ? userAttendanceSnapshot.val() : {};

        // Fetch legacy clock times if no attendance records
        let legacyClockIns = {};
        let legacyClockOuts = {};
        
        if (Object.keys(userAttendance).length === 0) {
          const clockInRef = ref(database, `users/${userId}/clockInTimes`);
          const clockInSnapshot = await get(clockInRef);
          legacyClockIns = clockInSnapshot.exists() ? clockInSnapshot.val() : {};
          
          const clockOutRef = ref(database, `users/${userId}/clockOutTimes`);
          const clockOutSnapshot = await get(clockOutRef);
          legacyClockOuts = clockOutSnapshot.exists() ? clockOutSnapshot.val() : {};
        }

        // Process user attendance records
        Object.entries(userAttendance).forEach(([attendanceKey, record]) => {
          if (!record || typeof record !== 'object') return;

          // Extract date from the key or record
          let formattedDate;
          if (attendanceKey.includes('_')) {
            formattedDate = attendanceKey.split('_')[0];
          } else if (attendanceKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            formattedDate = attendanceKey;
          } else if (record.date) {
            formattedDate = record.date;
          } else if (record.clockInTimestamp) {
            formattedDate = timestampToChicagoDate(record.clockInTimestamp);
          } else {
            return;
          }

          // Validate date format
          if (!formattedDate || !formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return;
          }

          const location = record.locationName || record.location || userData.profile.locationKey || userData.profile.primaryLocation || 'unknown';
          allLocations.add(location);

          // Ensure location and date exist in combined data
          if (!combinedData[location]) {
            combinedData[location] = {};
          }
          if (!combinedData[location][formattedDate]) {
            combinedData[location][formattedDate] = {};
          }

          // Calculate if late based on event schedule or default time
          const isLate = calculateIsLate(record, formattedDate, allEvents);

          // Add this record to combined data
          const attendanceRecord = {
            userId,
            name: userData.profile.name || 'Unknown',
            position: userData.profile.position || 'Unknown',
            clockInTime: record.clockInTime,
            clockOutTime: record.clockOutTime,
            clockInTimestamp: record.clockInTimestamp,
            clockOutTimestamp: record.clockOutTimestamp,
            eventType: record.eventType || 'general',
            isLate: isLate, // Use calculated late status
            location,
            locationName: location,
            hoursWorked: record.hoursWorked,
            status: record.status || 'completed'
          };

          combinedData[location][formattedDate][userId] = attendanceRecord;
        });

        // Process legacy clock times
        Object.entries(legacyClockIns).forEach(([timestamp, clockInTime]) => {
          const formattedDate = timestampToChicagoDate(timestamp);
          const location = userData.profile.locationKey || userData.profile.primaryLocation || 'unknown';
          allLocations.add(location);

          if (!combinedData[location]) {
            combinedData[location] = {};
          }
          if (!combinedData[location][formattedDate]) {
            combinedData[location][formattedDate] = {};
          }

          // Check if we already have a record for this user on this date
          if (!combinedData[location][formattedDate][userId]) {
            // For legacy records, use the old logic as fallback
            const isLate = isLateTime(clockInTime);
            
            combinedData[location][formattedDate][userId] = {
              userId,
              name: userData.profile.name || 'Unknown',
              position: userData.profile.position || 'Unknown',
              clockInTime,
              clockOutTime: legacyClockOuts[timestamp] || null,
              clockInTimestamp: parseInt(timestamp),
              clockOutTimestamp: legacyClockOuts[timestamp] ? parseInt(timestamp) : null,
              eventType: 'general',
              isLate,
              location,
              locationName: location,
              status: legacyClockOuts[timestamp] ? 'completed' : 'incomplete'
            };
          }
        });

      } catch (error) {
        console.error(`Error fetching attendance for user ${userId}:`, error);
      }
    }

    // Set the list of all locations
    setLocations(Array.from(allLocations).sort());
    
    return combinedData;
  };

  // Calculate if a clock-in is late based on event schedule
  const calculateIsLate = (record, date, allEvents) => {
    try {
      if (!record.clockInTime) return false;

      // Find scheduled events for this date and event type
      const scheduledEvents = Object.values(allEvents).filter(event => {
        if (!event.start) return false;
        
        // Check if event is on the same date
        const eventDate = moment(event.start).tz('America/Chicago').format('YYYY-MM-DD');
        if (eventDate !== date) return false;
        
        // Check if event type matches (normalize for comparison)
        const normalizeEventType = (eventType) => {
          return eventType.toLowerCase().replace(/[^a-z0-9]/g, '');
        };
        
        const recordEventType = normalizeEventType(record.eventType || 'general');
        const eventEventType = normalizeEventType(event.eventType || event.category || 'general');
        
        return recordEventType === eventEventType;
      });

      if (scheduledEvents.length > 0) {
        // Use the earliest scheduled event time for this event type
        const earliestEvent = scheduledEvents.reduce((earliest, current) => {
          return moment(current.start).isBefore(moment(earliest.start)) ? current : earliest;
        });

        const scheduledTime = moment(earliestEvent.start).tz('America/Chicago');
        
        // Parse the clock-in time
        let clockInMoment;
        if (record.clockInTime.includes('AM') || record.clockInTime.includes('PM')) {
          // 12-hour format
          clockInMoment = moment.tz(`${date} ${record.clockInTime}`, 'YYYY-MM-DD h:mm A', 'America/Chicago');
        } else {
          // 24-hour format
          clockInMoment = moment.tz(`${date} ${record.clockInTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
        }

        // Consider late if clocked in after the scheduled start time
        return clockInMoment.isAfter(scheduledTime);
      } else {
        // No scheduled event found, person is on time since they're not late for any specific event
        return false;
      }
    } catch (error) {
      console.error('Error calculating late status:', error);
      // Fallback: if there's an error, consider them on time
      return false;
    }
  };

  // Calculate monthly attendance data for chart and find missing employees
  const calculateMonthlyAttendance = (attendance, users, deletedUsers, userLocation = null) => {
    const monthlyData = {};
    const employeesByMonth = {};
    const locationsByMonth = {};
    const eventsByMonth = {};
    const missingEmployees = {};
    const currentYear = new Date().getFullYear();
    let totalClockIns = 0;
    
    // Initialize with all months of the current year
    for (let i = 0; i < 12; i++) {
      const monthName = new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' });
      monthlyData[`${monthName}`] = { 
        month: monthName, 
        count: 0, 
        location: null, 
        eventTypes: {},
        employeeCount: 0
      };
      employeesByMonth[monthName] = new Set();
      locationsByMonth[monthName] = {};
      eventsByMonth[monthName] = {};
      missingEmployees[monthName] = [];
    }
    
    // Process attendance data
    Object.entries(attendance || {}).forEach(([locationName, locationData]) => {
      // Skip if we're filtering by location and this isn't the user's location
      if (userLocation && locationName.toLowerCase() !== userLocation.toLowerCase()) {
        return;
      }
      
      // Each locationData contains dates
      Object.entries(locationData || {}).forEach(([dateStr, dateData]) => {
        try {
          // Use Chicago timezone for date parsing
          const recordDate = moment.tz(dateStr, 'America/Chicago').toDate();
          
          // Only count current year
          if (!isNaN(recordDate.getTime()) && recordDate.getFullYear() === currentYear) {
            const month = recordDate.toLocaleString('default', { month: 'short' });
            
            // Count clock-in events for this date
            if (typeof dateData === 'object' && dateData !== null) {
              const clockInEvents = Object.values(dateData);
              
              // Each clock-in is counted
              clockInEvents.forEach(event => {
                // Ensure it's a valid clock-in event
                if (event && (event.clockInTime || event.clockInTimestamp)) {
                  // Increment the global clock-in counter
                  totalClockIns++;
                  
                  if (monthlyData[month]) {
                    monthlyData[month].count += 1;
                    
                    // Track location for this month
                    if (!locationsByMonth[month][locationName]) {
                      locationsByMonth[month][locationName] = 0;
                    }
                    locationsByMonth[month][locationName]++;
                    
                    // Track event type for this month
                    const eventType = event.eventType || 'unknown';
                    if (!eventsByMonth[month][eventType]) {
                      eventsByMonth[month][eventType] = 0;
                    }
                    eventsByMonth[month][eventType]++;
                    
                    // Add to the event types in the monthly data
                    if (!monthlyData[month].eventTypes[eventType]) {
                      monthlyData[month].eventTypes[eventType] = 0;
                    }
                    monthlyData[month].eventTypes[eventType]++;
                  }
                  
                  // Track which employees clocked in this month
                  if (event.userId) {
                    employeesByMonth[month].add(event.userId);
                    
                    // Check if this user exists in the users data
                    const userExists = users[event.userId] !== undefined;
                    
                    if (!userExists) {
                      // This might be a deleted user or missing data
                      const userData = {
                        userId: event.userId,
                        name: event.name || 'Unknown',
                        reason: 'User not found in active users',
                        eventData: { ...event }
                      };
                      
                      // Check if they're in deleted users
                      Object.values(deletedUsers || {}).forEach(deletedUser => {
                        if (deletedUser.profile && deletedUser.profile.id === event.userId) {
                          userData.name = deletedUser.profile.name || userData.name;
                          userData.reason = 'User was deleted';
                          userData.deletedUserData = { ...deletedUser.profile };
                        }
                      });
                      
                      // Add to missing employees for this month
                      missingEmployees[month].push(userData);
                    }
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error("Error processing date:", dateStr, error);
        }
      });
    });
    
    // For each month, find the most frequent location
    Object.keys(monthlyData).forEach(month => {
      let maxCount = 0;
      let mostFrequentLocation = null;
      
      Object.entries(locationsByMonth[month]).forEach(([loc, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentLocation = loc;
        }
      });
      
      monthlyData[month].location = mostFrequentLocation;
      monthlyData[month].missingEmployeeCount = missingEmployees[month].length;
      monthlyData[month].employeeCount = employeesByMonth[month].size;
    });
    
    // Round counts to whole numbers
    Object.values(monthlyData).forEach(month => {
      month.count = Math.round(month.count);
    });
    
    // Convert employee sets to arrays
    const employeeArraysByMonth = {};
    Object.entries(employeesByMonth).forEach(([month, employees]) => {
      employeeArraysByMonth[month] = Array.from(employees);
    });
    
    // Store the employee data by month for filtering
    setMonthlyEmployeeData(employeeArraysByMonth);
    
    // Convert to array and sort by month index
    return {
      monthlyData: Object.values(monthlyData).sort((a, b) => {
        const monthA = new Date(`${a.month} 1, ${currentYear}`).getMonth();
        const monthB = new Date(`${b.month} 1, ${currentYear}`).getMonth();
        return monthA - monthB;
      }),
      missingEmployees,
      totalClockIns
    };
  };

  // Calculate employee reports with proper attendance counting
  const calculateEmployeeReports = (users, attendance) => {
    const reports = [];

    // Process user data
    Object.entries(users || {}).forEach(([userId, userData]) => {
      if (userData && userData.profile) {
        const user = userData.profile;
        
        // Get stats from user profile for reference
        const userStats = userData.stats || {};
        let totalHours = userStats.totalHours || 0;
        let userLocation = user.primaryLocation || user.locationKey || user.location || 'unknown';
        let eventTypeStats = {};
        
        // Count actual attendance from combined attendance data
        const uniqueDates = new Set();
        const lateDates = new Set();
        
        Object.entries(attendance || {}).forEach(([location, locationData]) => {
          Object.entries(locationData || {}).forEach(([date, dateData]) => {
            if (dateData[userId]) {
              const record = dateData[userId];
              
              // Add unique date to set (this prevents counting multiple clock-ins on same day)
              uniqueDates.add(date);
              
              // Track if this date had any late clock-ins
              if (record.isLate) {
                lateDates.add(date);
              }
              
              // Track event type statistics
              const eventType = record.eventType || 'unknown';
              if (!eventTypeStats[eventType]) {
                eventTypeStats[eventType] = 0;
              }
              eventTypeStats[eventType]++;
              
              // Update user location if found in attendance
              if (userLocation === 'unknown' && record.location) {
                userLocation = record.location;
              }
            }
          });
        });
        
        // Use actual attendance count (unique days present)
        const daysPresent = uniqueDates.size;
        const daysLate = lateDates.size;
        
        // For daysAbsent, we can use stored stats as a reference, but it's not very reliable
        // since we don't have a definitive way to calculate expected days
        const daysAbsent = userStats.daysAbsent || 0;
        
        const daysOnTime = daysPresent - daysLate;

        reports.push({
          id: userId,
          name: user.name || 'Unknown',
          email: userData.email || user.email || '',
          daysPresent,
          daysAbsent,
          daysLate,
          daysOnTime,
          totalHours: totalHours.toFixed(2),
          onTimePercentage: calculatePercentage(daysOnTime, daysPresent),
          latePercentage: calculatePercentage(daysLate, daysPresent),
          attendancePercentage: calculatePercentage(daysPresent, daysPresent + daysAbsent),
          status: user.status || 'unknown',
          location: userLocation,
          role: user.role || 'employee',
          isPadrino: user.padrino === true || user.role === 'padrino',
          padrinoColor: user.padrinoColor,
          eventTypeStats // Track attendance by event type
        });
      }
    });

    return reports.sort((a, b) => b.daysPresent - a.daysPresent);
  };

  // Check if a time is considered late (after 9:00 AM)
  const isLateTime = (timeStr) => {
    try {
      if (!timeStr) return false;
      
      // Handle different time formats
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // 12-hour format
        const time = moment(timeStr, 'h:mm A');
        const lateTime = moment('9:00 AM', 'h:mm A');
        return time.isAfter(lateTime);
      } else {
        // 24-hour format
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          const hour = parseInt(timeParts[0]);
          const minute = parseInt(timeParts[1]);
          return hour > 9 || (hour === 9 && minute > 0);
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Update overall stats
  const updateStats = (users, reports, totalClockIns) => {
    // Filter for padrinos if we're doing padrino-specific reports
    const relevantReports = reports;
    const totalMembers = relevantReports.length;
    
    // Use the totalClockIns passed from calculateMonthlyAttendance
    // This ensures the total matches what's shown in the chart
    
    // Count active padrinos (users with padrino role or padrino=true and status=active)
    const activePadrinos = Object.values(users || {}).filter(user => 
      user.profile && 
      (user.profile.padrino === true || user.profile.role === 'padrino') && 
      user.profile.status === 'active'
    ).length;

    const avgAttendance =
      totalMembers > 0
        ? (
            relevantReports.reduce(
              (sum, report) =>
                sum + parseFloat(report.attendancePercentage || '0'),
              0
            ) / totalMembers
          ).toFixed(2)
        : '0.00';

    setOverallStats({
      totalMembers,
      totalClockIns: totalClockIns || 0,
      avgAttendance,
      activePadrinos,
    });
  };

  // Calculate percentage
  const calculatePercentage = (numerator, denominator) => {
    return denominator ? ((numerator / denominator) * 100).toFixed(2) : '0.00';
  };
  
  // Filter reports based on current filters
  const filterReports = useCallback(() => {
    // Start with all employee reports
    let filtered = employeeReports;
    
    // Helper function to normalize event type names for comparison (same as above)
    const normalizeEventType = (eventType) => {
      return eventType.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(report => 
        report.name.toLowerCase().includes(term) ||
        report.email.toLowerCase().includes(term) ||
        report.role.toLowerCase().includes(term) ||
        report.location.toLowerCase().includes(term)
      );
    }
    
    // Apply location filter if active
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(report => 
        report.location.toLowerCase() === selectedLocation.toLowerCase()
      );
    }
    
    // Apply event type filter if active
    if (selectedEventType !== 'all') {
      const normalizedSelectedType = normalizeEventType(selectedEventType);
      
      filtered = filtered.filter(report => {
        if (!report.eventTypeStats) return false;
        
        // Check if any of the user's event types match the selected one (normalized)
        return Object.keys(report.eventTypeStats).some(eventType => 
          normalizeEventType(eventType) === normalizedSelectedType
        );
      });
    }
    
    // Filter chart data for event type
    if (selectedEventType !== 'all') {
      const normalizedSelectedType = normalizeEventType(selectedEventType);
      
      // Filter monthly data to only show counts for the selected event type
      const filteredMonthly = monthlyAttendance.map(month => {
        // Sum all event types that match the normalized selected type
        let eventCount = 0;
        Object.entries(month.eventTypes || {}).forEach(([eventType, count]) => {
          if (normalizeEventType(eventType) === normalizedSelectedType) {
            eventCount += count;
          }
        });
        
        return {
          ...month,
          count: eventCount,
          // Keep other properties
        };
      });
      setFilteredMonthlyAttendance(filteredMonthly);
    } else {
      // Reset to show all event types
      setFilteredMonthlyAttendance(monthlyAttendance);
    }
    
    // If a month is selected, further filter by month
    if (selectedMonth) {
      const monthEmployees = monthlyEmployeeData[selectedMonth] || [];
      if (monthEmployees.length > 0) {
        filtered = filtered.filter(report => monthEmployees.includes(report.id));
        
        // Add missing employee placeholders if needed
        const missingData = missingEmployeeData[selectedMonth] || [];
        if (missingData.length > 0) {
          const placeholders = createPlaceholderEmployees(selectedMonth);
          
          // Only add placeholders that would pass the current filters
          const filteredPlaceholders = placeholders.filter(ph => {
            let passes = true;
            
            // Apply location filter
            if (selectedLocation !== 'all') {
              passes = passes && ph.location.toLowerCase() === selectedLocation.toLowerCase();
            }
            
            // We can't filter placeholders by event type since they don't have that data
            // But we'll include them if event type filter is active to avoid confusion
            
            return passes;
          });
          
          filtered = [...filtered, ...filteredPlaceholders];
        }
      } else {
        filtered = [];
      }
    }
    
    setFilteredReports(filtered);
  }, [employeeReports, searchTerm, selectedLocation, selectedEventType, selectedMonth, monthlyAttendance, monthlyEmployeeData, missingEmployeeData]);
  
  // Create placeholder employees for missing IDs
  const createPlaceholderEmployees = (month) => {
    if (!month) return [];
    
    const missingData = missingEmployeeData[month] || [];
    if (missingData.length === 0) return [];
    
    return missingData.map(missing => ({
      id: missing.userId,
      name: missing.name,
      email: '', 
      daysPresent: 1,
      daysAbsent: 0,
      daysLate: 0,
      daysOnTime: 1,
      onTimePercentage: '100.00',
      latePercentage: '0.00',
      attendancePercentage: '100.00',
      status: 'unknown',
      location: missing.eventData.location || 'unknown',
      role: 'unknown',
      isPadrino: false,
      isPlaceholder: true, // Mark this as a placeholder record
      reason: missing.reason || 'User data not found'
    }));
  };

  // Initial data fetch
  useEffect(() => {
    fetchEmployeeData();
  }, [fetchEmployeeData]);
  
  // Apply filters when any filter changes
  useEffect(() => {
    filterReports();
  }, [employeeReports, searchTerm, selectedLocation, selectedEventType, selectedMonth, monthlyAttendance, monthlyEmployeeData, missingEmployeeData]);
  
  // Handle clicking on a chart bar
  const handleBarClick = (data) => {
    // If clicking on the already selected month, clear the selection
    if (selectedMonth === data.month) {
      setSelectedMonth(null);
    } else {
      // Set the selected month
      setSelectedMonth(data.month);
      
      // Update location if this month has a location
      if (data.location && data.location !== 'null' && data.location !== 'unknown') {
        setSelectedLocation(data.location);
      }
    }
  };
  
  // Handler for Total Clock-ins card click - Reset filters
  const handleTotalClockInsClick = () => {
    // Reset all filters - similar to clear all filters 
    setSelectedMonth(null);
    // Keep location filter
    setSelectedEventType('all');
    setSearchTerm('');
    setFilteredMonthlyAttendance(monthlyAttendance);
    // Set filtered reports to all reports with just location filter
    if (selectedLocation !== 'all') {
      const locationFiltered = employeeReports.filter(report => 
        report.location.toLowerCase() === selectedLocation.toLowerCase()
      );
      setFilteredReports(locationFiltered);
    } else {
      setFilteredReports(employeeReports);
    }
  };
  
  // Clear all filters and reset to showing all employees
  const clearAllFilters = () => {
    setSelectedMonth(null);
    setSelectedLocation('all');
    setSelectedEventType('all');
    setSearchTerm('');
    setFilteredMonthlyAttendance(monthlyAttendance);
    setFilteredReports(employeeReports);
  };
  
  // Handle changing the location filter
  const handleLocationChange = (e) => {
    const location = e.target.value;
    setSelectedLocation(location);
    // The filterReports effect will automatically update
  };
  
  // Handle changing the event type filter
  const handleEventTypeChange = (e) => {
    const eventType = e.target.value;
    setSelectedEventType(eventType);
    // The filterReports effect will automatically update
  };
  
  // Handle refresh
  const handleRefresh = () => {
    fetchEmployeeData();
  };

  return (
    <div className="glass-container p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="chart-title text-3xl">Attendance Reports</h2>
        
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          {/* Clear filters button (only show when filters are active) */}
          {(selectedMonth || selectedLocation !== 'all' || selectedEventType !== 'all' || searchTerm) && (
            <button 
              onClick={clearAllFilters} 
              className="btn-outline flex items-center space-x-1 bg-blue-500/20"
            >
              <X size={16} />
              <span>Clear Filters</span>
            </button>
          )}
          
          {/* Refresh button */}
          <button 
            onClick={handleRefresh} 
            className="btn-outline flex items-center space-x-1"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>
      
      {/* Filter Controls */}
      <FilterControls
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        locations={locations}
        selectedLocation={selectedLocation}
        handleLocationChange={handleLocationChange}
        eventTypes={eventTypes}
        selectedEventType={selectedEventType}
        handleEventTypeChange={handleEventTypeChange}
      />

      {/* Stats Cards */}
      <StatsCards
        overallStats={overallStats}
        filteredReports={filteredReports}
        setFilteredReports={setFilteredReports}
        employeeReports={employeeReports}
        handleTotalClockInsClick={handleTotalClockInsClick}
      />
      
      {/* Monthly Attendance Chart */}
      <MonthlyChart
        monthlyAttendance={filteredMonthlyAttendance}
        selectedMonth={selectedMonth}
        handleBarClick={handleBarClick}
        clearMonthFilter={() => {
          setSelectedMonth(null);
        }}
      />

      {/* Loading state */}
      {loading && (
        <div className="glass-card p-6 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p>Loading attendance data...</p>
        </div>
      )}

      {/* Employee Table */}
      {!loading && (
        <EmployeeTable
          filteredReports={filteredReports}
          employeeReports={employeeReports}
          selectedMonth={selectedMonth}
          selectedLocation={selectedLocation}
          selectedEventType={selectedEventType}
        />
      )}
      
      {/* Debug information - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="glass-card p-4 mt-4 text-xs">
          <h3 className="font-semibold mb-2 text-base">Debug Information</h3>
          <p className="py-1">Selected month: {selectedMonth || "None"}</p>
          {selectedMonth && <p className="py-1">Unique employees in month: {(monthlyEmployeeData[selectedMonth] || []).length}</p>}
          <p className="py-1">Filtered employees shown: {filteredReports.length}</p>
          <p className="py-1">Total employees: {employeeReports.length}</p>
          <p className="py-1">Monthly attendance count: {filteredMonthlyAttendance.find(m => m.month === selectedMonth)?.count || "N/A"}</p>
          <p className="py-1">Total clock-ins: {overallStats.totalClockIns}</p>
          <p className="py-1">Sum of monthly clock-ins: {monthlyAttendance.reduce((sum, month) => sum + month.count, 0)}</p>
          <p className="py-1">Selected event type: {selectedEventType}</p>
          <p className="py-1">Selected location: {selectedLocation}</p>
          
          {selectedMonth && (missingEmployeeData[selectedMonth] || []).length > 0 && (
            <div className="mt-2">
              <p className="font-semibold">Missing Employees ({missingEmployeeData[selectedMonth].length}):</p>
              <div className="mt-1 max-h-32 overflow-y-auto">
                {missingEmployeeData[selectedMonth].map((missing, idx) => (
                  <div key={idx} className="text-xs py-1 border-t border-slate-700">
                    <span className="font-medium">{missing.name || 'Unknown'}</span> ({missing.userId}) - {missing.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsContainer;
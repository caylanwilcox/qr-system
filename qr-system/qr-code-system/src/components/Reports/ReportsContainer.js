import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { useAuth } from '../../services/authContext';
import { database } from '../../services/firebaseConfig';
import { RefreshCw, X } from 'lucide-react';

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

  // Fetch employee data with location filtering
  const fetchEmployeeData = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    
    try {
      // Get user location if locationFiltered is true
      const userLocation = locationFiltered && user && user.profile ? 
        (user.profile.locationKey || user.profile.primaryLocation) : null;
      
      const usersRef = ref(database, 'users');
      const attendanceRef = ref(database, 'attendance');
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

      // Fetch attendance data
      const attendance = await new Promise((resolve) =>
        onValue(attendanceRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );
      
      // Store raw attendance data
      setRawAttendanceData(attendance);
      
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
      setEventTypes(eventTypesList);
      
      console.log("Fetched attendance data:", attendance);
      console.log("Fetched event types:", eventTypesList);

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

      // Process data
      const reports = calculateEmployeeReports(filteredUsers, attendance);
      setEmployeeReports(reports);
      
      // Calculate monthly attendance data for chart
      const { monthlyData, missingEmployees, totalClockIns } = 
        calculateMonthlyAttendance(attendance, filteredUsers, deletedUsers, userLocation);
      
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
    
    // Track all unique locations
    const allLocations = new Set();
    
    // Process attendance data based on the complex data structure
    Object.entries(attendance || {}).forEach(([locationName, locationData]) => {
      // Skip if we're filtering by location and this isn't the user's location
      if (userLocation && locationName.toLowerCase() !== userLocation.toLowerCase()) {
        return;
      }
      
      // Add location to set of all locations
      if (locationName && locationName !== 'undefined' && locationName !== 'null') {
        allLocations.add(locationName);
      }
      
      // Each locationData contains dates
      Object.entries(locationData || {}).forEach(([dateStr, dateData]) => {
        try {
          const recordDate = new Date(dateStr);
          
          // Only count current year
          if (!isNaN(recordDate.getTime()) && recordDate.getFullYear() === currentYear) {
            const month = recordDate.toLocaleString('default', { month: 'short' });
            
            // Count clock-in events for this date
            // dateData could contain multiple user clock-ins or a single object
            if (typeof dateData === 'object' && dateData !== null) {
              // Check if it's an array or object structure
              const clockInEvents = Array.isArray(dateData) ? dateData : Object.values(dateData);
              
              // Each clock-in is counted
              clockInEvents.forEach(event => {
                // Ensure it's a valid clock-in event with clockInTime or equivalent field
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
                    // If not, they may be deleted or this is phantom data
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
                      let foundInDeletedUsers = false;
                      Object.values(deletedUsers || {}).forEach(deletedUser => {
                        if (deletedUser.profile && deletedUser.profile.id === event.userId) {
                          userData.name = deletedUser.profile.name || userData.name;
                          userData.reason = 'User was deleted';
                          userData.deletedUserData = { ...deletedUser.profile };
                          foundInDeletedUsers = true;
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
      
      // Add the missing employee count to the month data
      monthlyData[month].missingEmployeeCount = missingEmployees[month].length;
      monthlyData[month].employeeCount = employeesByMonth[month].size;
    });
    
    // Set the list of all locations
    setLocations(Array.from(allLocations).sort());
    
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

    // First gather all locations from attendance data
    const locationSet = new Set();
    Object.keys(attendance || {}).forEach(location => {
      if (location && location !== 'undefined' && location !== 'null') {
        locationSet.add(location);
      }
    });

    // Process user data
    Object.entries(users || {}).forEach(([userId, userData]) => {
      if (userData && userData.profile) {
        const user = userData.profile;
        
        // Start with zeroed stats
        let daysPresent = 0;
        let daysAbsent = 0;
        let daysLate = 0;
        let userLocation = user.primaryLocation || user.locationKey || 'unknown';
        let eventTypeStats = {};
        
        // Make sure we have a valid location
        if (userLocation === 'unknown' || !userLocation) {
          // Try to find location from attendance data
          Array.from(locationSet).some(location => {
            if (attendance[location]) {
              // Check each date for this user
              return Object.values(attendance[location]).some(dateData => {
                const events = Array.isArray(dateData) ? dateData : Object.values(dateData);
                return events.some(event => {
                  if (event && event.userId === userId) {
                    userLocation = location;
                    return true;
                  }
                  return false;
                });
              });
            }
            return false;
          });
        }
        
        // Calculate attendance
        Array.from(locationSet).forEach(location => {
          const locationAttendance = attendance[location];
          if (!locationAttendance) return;
          
          // Process attendance records for this location
          Object.entries(locationAttendance).forEach(([date, records]) => {
            try {
              const recordDate = new Date(date);
              
              // Count for the current year
              if (!isNaN(recordDate.getTime())) {
                const recordsArray = Array.isArray(records) ? records : Object.values(records);
                
                // Check if user was present on this day
                const userRecords = recordsArray.filter(record => 
                  record.userId === userId
                );
                
                if (userRecords.length > 0) {
                  // This is a confirmed clock-in for this user
                  daysPresent++;
                  
                  // Track event type statistics
                  userRecords.forEach(record => {
                    const eventType = record.eventType || 'unknown';
                    if (!eventTypeStats[eventType]) {
                      eventTypeStats[eventType] = 0;
                    }
                    eventTypeStats[eventType]++;
                    
                    // Check if they were late
                    if (record.late === true || 
                        (record.clockInTime && isLateTime(record.clockInTime))) {
                      daysLate++;
                    }
                  });
                  
                  // If location was discovered from attendance, update it
                  if (userLocation === 'unknown') {
                    userLocation = location;
                  }
                }
              }
            } catch (error) {
              console.error("Error processing date:", date, error);
            }
          });
        });
        
        // If no attendance data, use stats from profile if available
        if (daysPresent === 0) {
          const userStats = userData.stats || {};
          if (userStats.daysPresent > 0) {
            daysPresent = userStats.daysPresent || 0;
            daysAbsent = userStats.daysAbsent || 0;
            daysLate = userStats.daysLate || 0;
          }
        }
        
        const daysOnTime = daysPresent - daysLate;

        reports.push({
          id: userId,
          name: user.name || 'Unknown',
          email: userData.email || '',
          daysPresent,
          daysAbsent,
          daysLate,
          daysOnTime,
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
      // Try to parse the time string 
      const timeParts = timeStr.split(':');
      if (timeParts.length >= 2) {
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        
        // After 9:00 is considered late
        return hour > 9 || (hour === 9 && minute > 0);
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
  const filterReports = () => {
    // Start with all employee reports
    let filtered = employeeReports;
    
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
      filtered = filtered.filter(report => 
        report.eventTypeStats && report.eventTypeStats[selectedEventType]
      );
    }
    
    // Filter chart data for event type
    if (selectedEventType !== 'all') {
      // Filter monthly data to only show counts for the selected event type
      const filtered = monthlyAttendance.map(month => {
        const eventCount = month.eventTypes[selectedEventType] || 0;
        return {
          ...month,
          count: eventCount,
          // Keep other properties
        };
      });
      setFilteredMonthlyAttendance(filtered);
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
  };
  
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
  }, [employeeReports, searchTerm, selectedLocation, selectedEventType, selectedMonth]);
  
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
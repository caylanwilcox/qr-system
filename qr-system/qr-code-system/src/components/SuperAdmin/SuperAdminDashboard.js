// src/components/SuperAdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { eventBus, EVENTS } from '../../services/eventBus';
import './SuperAdminDashboard.css';
import moment from 'moment-timezone';

import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import ClockedInList from './ClockedInList';
import NotClockedInList from './NotClockedInList';
import DataFlowDebugger from '../debugging/DataFlowDebugger';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorUpdateStatus, setColorUpdateStatus] = useState(null);
  const [filteredData, setFilteredData] = useState({});
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);
  const [debug, setDebug] = useState({
    events: 0,
    lastEventTime: null,
    refreshCount: 0,
    dataTimestamp: null
  });
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const dataSnapshot = useRef(null);
  const isUpdatingColors = useRef(false);
  const DEBUG_PREFIX = '🔍 [SuperAdminDashboard]';

  const getCurrentDateISO = () => moment().tz('America/Chicago').format('YYYY-MM-DD');

  // Map from display name to internal location key
  const locationMap = {
    All: 'All',
    Aurora: 'aurora',
    Elgin: 'elgin',
    Joliet: 'joliet',
    Lyons: 'lyons',
    'West Chicago': 'westchicago',
    Wheeling: 'wheeling',
  };

  // Normalize location keys to handle case and formatting variations
  const normalizeLocationKey = useCallback((locationKey) => {
    if (!locationKey) return null;
    return locationKey.toLowerCase().replace(/\s+/g, '');
  }, []);

  // Calculate user color based on attendance stats
  const calculateUserColor = useCallback((profile, stats) => {
    const attendanceRate = stats?.attendanceRate || 0;
    const daysPresent = stats?.daysPresent || 0;

    if (daysPresent === 0) return 'blue';
    if (attendanceRate >= 90) return 'blue';
    if (attendanceRate >= 75) return 'green';
    if (attendanceRate >= 60) return 'orange';
    return 'blue';
  }, []);

  // Helper function to check if a user has clocked in with the correct date
  const hasClockInWithCorrectDate = useCallback((user, today) => {
    if (!user) return false;
    
    // Get today's date in the expected format
    const todayDate = new Date(today);
    const todayString = todayDate.toISOString().split('T')[0];
    
    // Method 1: Check attendance object with date as key (most reliable for clock-out status)
    if (user.attendance && user.attendance[todayString]) {
      const attendanceRecord = user.attendance[todayString];
      
      // If clockedIn is explicitly false, user has clocked out
      if (attendanceRecord.clockedIn === false) {
        console.log(`${DEBUG_PREFIX} User has clocked out on ${todayString}`);
        return false;
      }
      
      // If clockedIn is true, user is currently clocked in
      if (attendanceRecord.clockedIn === true || 
          attendanceRecord.isClocked === true || 
          attendanceRecord.checkedIn === true || 
          attendanceRecord.present === true) {
        return true;
      }
    }
    
    // FIXED: Method 1.5: Check for new unique timestamp-based attendance keys
    if (user.attendance) {
      let hasActiveClockin = false;
      Object.entries(user.attendance).forEach(([attendanceKey, record]) => {
        if (!record || typeof record !== 'object') return;
        
        // Check if this key is for today (starts with today's date)
        if (attendanceKey.startsWith(todayString) && attendanceKey.includes('_')) {
          // If this is an active clock-in (status: 'clocked-in')
          if ((record.clockedIn === true || record.isClocked === true || 
               record.checkedIn === true || record.present === true) && 
              record.status === 'clocked-in') {
            hasActiveClockin = true;
            console.log(`${DEBUG_PREFIX} User has active clock-in via unique key ${attendanceKey}`);
          }
        }
      });
      
      if (hasActiveClockin) return true;
    }
    
    // Method 2: Check clockInTimes object
    if (user.clockInTimes) {
      for (const timestamp in user.clockInTimes) {
        try {
          const date = new Date(parseInt(timestamp));
          const dateString = date.toISOString().split('T')[0];
          
          if (dateString === todayString) {
            // Check if there's a corresponding clock-out time
            if (user.clockOutTimes && user.clockOutTimes[timestamp]) {
              console.log(`${DEBUG_PREFIX} User has clocked out via clockOutTimes for timestamp ${timestamp}`);
              return false;
            }
            return true;
          }
        } catch (e) {
          console.error(`${DEBUG_PREFIX} Error parsing timestamp:`, e);
        }
      }
    }
    
    // Method 3: Check user events structure (where QR scanner writes data)
    if (user.events) {
      // Check all event types for attendance on the target date
      for (const [eventType, events] of Object.entries(user.events)) {
        if (!events || typeof events !== 'object') continue;
        
        for (const [eventId, eventData] of Object.entries(events)) {
          if (!eventData || typeof eventData !== 'object') continue;
          
          // Check if this event was attended on the target date
          if (eventData.attended === true && eventData.date === todayString) {
            console.log(`${DEBUG_PREFIX} User has attended ${eventType} event on ${todayString}`);
            return true;
          }
          
          // Also check if the event ID contains the target date (QR scanner format)
          if (eventData.attended === true && eventId.startsWith(todayString)) {
            console.log(`${DEBUG_PREFIX} User has QR scan attendance for ${eventType} on ${todayString}`);
            return true;
          }
        }
      }
    }
    
    // Method 4: Check clockedIn flag with date validation
    if (user.clockedIn === true) {
      // Check if clockedInDate matches
      if (user.clockedInDate === todayString) {
        return true;
      }
      
      // Check if clockedInTimestamp is from today
      if (user.clockedInTimestamp) {
        try {
          const clockedInDate = new Date(parseInt(user.clockedInTimestamp));
          const clockedInDateStr = clockedInDate.toISOString().split('T')[0];
          if (clockedInDateStr === todayString) {
            return true;
          }
        } catch (e) {
          console.error(`${DEBUG_PREFIX} Error parsing clockedInTimestamp:`, e);
        }
      }
    }
    
    // Method 5: Check if user is explicitly clocked out via direct flags
    if (user.clockedIn === false) {
      console.log(`${DEBUG_PREFIX} User is explicitly clocked out via direct flag`);
      return false;
    }
    
    return false;
  }, []);

  // Apply location and color filters to the user data
  const applyFilters = useCallback((data, locationKey, colorFilter) => {
    // Normalize location key for comparison
    const normalizedLocationKey = normalizeLocationKey(locationKey);
    
    // Log for debugging
    console.log(`${DEBUG_PREFIX} Applying filters:`, {
      locationKey,
      normalizedLocationKey,
      colorFilter, 
      dataSize: Object.keys(data || {}).length
    });
    
    const sampleLocations = Object.values(data || {}).slice(0, 5).map(user => {
      const userLoc = user.location || user.profile?.locationKey || user.profile?.primaryLocation;
      return {
        original: userLoc,
        normalized: normalizeLocationKey(userLoc)
      };
    });
    
    setDebug(prev => ({
      ...prev,
      activeLocationKey: locationKey,
      normalizedLocationKey,
      sampleLocations
    }));

    // Handle null data
    if (!data) {
      console.warn(`${DEBUG_PREFIX} applyFilters called with null data`);
      return {};
    }

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([_, user]) => {
        // Get user location from various possible fields
        const userLoc = user.location || user.profile?.locationKey || user.profile?.primaryLocation;
        const normalizedUserLoc = normalizeLocationKey(userLoc);
        
        // Match based on normalized location keys unless it's 'All'
        const locationMatch = 
          locationKey === 'All' || 
          normalizedLocationKey === 'all' ||
          normalizedUserLoc === normalizedLocationKey;
        
        // Match color filter if one is active
        const colorMatch = 
          !colorFilter || 
          (user.profile?.padrinoColorCode?.toLowerCase() === colorFilter && user.profile?.padrino);
        
        return locationMatch && colorMatch;
      })
    );
    
    console.log(`${DEBUG_PREFIX} Filter results:`, {
      inputSize: Object.keys(data).length,
      outputSize: Object.keys(filtered).length,
      locationKey,
      colorFilter
    });
    
    return filtered;
  }, [normalizeLocationKey]);

  // Process user data to calculate metrics
  const processMetrics = useCallback((data, locationKey) => {
    const today = getCurrentDateISO();
    console.log(`${DEBUG_PREFIX} Processing metrics for date:`, today);
    
    const metrics = {
      total: { clockedIn: 0, notClockedIn: 0, onTime: 0, late: 0 },
      perLocation: {},
      overview: {
        totalMembers: Object.keys(data || {}).length,
        totalPadrinos: 0,
        padrinosBlue: 0,
        padrinosGreen: 0,
        padrinosRed: 0,
        padrinosOrange: 0,
        totalOrejas: 0,
        totalApoyos: 0,
        monthlyAttendance: 0,
      },
      date: today,
      activeUsersCount: 0,
      activeUsers: { count: 0, byLocation: {} }
    };

    let totalPresentAll = 0;
    let totalDaysAll = 0;
    let activeUsersCount = 0;
    let clockedInCount = 0;
    let notClockedInCount = 0;

    // Check data validity
    if (!data) {
      console.warn(`${DEBUG_PREFIX} processMetrics called with null data`);
      return metrics;
    }

    // Set debug info for processed data
    setDebug(prev => ({
      ...prev,
      processedDataSize: Object.keys(data).length,
      locationKey,
      date: today
    }));

    console.log(`${DEBUG_PREFIX} Processing ${Object.keys(data).length} users for metrics`);

    Object.entries(data).forEach(([userId, user]) => {
      const { profile, stats, attendance } = user;
      if (!profile) {
        console.log(`${DEBUG_PREFIX} User ${userId} skipped: no profile`);
        return;
      }

      // Get location from various possible fields
      const loc = user.location || profile?.locationKey || profile?.primaryLocation || 'Unknown';
      const color = profile?.padrinoColorCode?.toLowerCase?.();
      const isPadrino = profile?.padrino;

      // Initialize location in metrics if not exists
      if (!metrics.perLocation[loc]) {
        metrics.perLocation[loc] = { clockedIn: 0, notClockedIn: 0, onTime: 0, late: 0 };
      }

      // Count padrinos by color
      if (isPadrino) {
        metrics.overview.totalPadrinos++;
        if (color === 'blue') metrics.overview.padrinosBlue++;
        if (color === 'green') metrics.overview.padrinosGreen++;
        if (color === 'orange') metrics.overview.padrinosOrange++;
        if (color === 'red') metrics.overview.padrinosRed++;
      }

      // Count service types
      const service = profile?.service?.toUpperCase?.();
      if (service === 'RSG') metrics.overview.totalOrejas++;
      if (service === 'COM') metrics.overview.totalApoyos++;

      // Check attendance for today
      const attend = attendance?.[today];
      
      // FIXED: Also check for new unique timestamp-based attendance keys
      let todayAttendanceRecord = attend;
      if (!todayAttendanceRecord && attendance) {
        // Look for attendance records that start with today's date
        Object.entries(attendance).forEach(([key, record]) => {
          if (key.startsWith(today) && key.includes('_') && record.status === 'clocked-in') {
            todayAttendanceRecord = record;
          }
        });
      }
      
      // Debug attendance info for this user
      const hasClockInTimes = !!user.clockInTimes;
      const hasAttendanceObj = !!user.attendance;
      const isDirectlyClockedIn = user.clockedIn === true || user.isClocked === true || 
                                  user.checkedIn === true || user.present === true;
      
      // Check for attendance using all methods
      const isClocked = (todayAttendanceRecord?.clockedIn === true) || isDirectlyClockedIn || hasClockInWithCorrectDate(user, today);
      
      // Log attendance info for debugging
      if (userId.includes('test') || Math.random() < 0.05) { // Log test users and 5% of others
        console.log(`${DEBUG_PREFIX} User ${userId} attendance check:`, {
          name: profile.name || 'Unknown',
          hasToday: !!todayAttendanceRecord,
          hasClockInTimes,
          hasAttendanceObj,
          isDirectlyClockedIn,
          isClocked
        });
      }

      if (isClocked) {
        metrics.total.clockedIn++;
        metrics.perLocation[loc].clockedIn++;
        clockedInCount++;
        
        // Check if on time
        let isOnTime = todayAttendanceRecord?.onTime;
        if (isOnTime === undefined && todayAttendanceRecord?.clockInTime) {
          // FIXED: Only determine late status if user has scheduled events for this date
          let hasScheduledEvents = false;
          
          if (user.events) {
            Object.values(user.events).forEach(eventTypeData => {
              if (eventTypeData && typeof eventTypeData === 'object') {
                Object.values(eventTypeData).forEach(eventData => {
                  if (eventData && eventData.scheduled && eventData.date === today) {
                    hasScheduledEvents = true;
                  }
                });
              }
            });
          }
          
          // Only apply late logic if there are scheduled events
          if (hasScheduledEvents) {
            try {
              const clockInTime9AM = new Date(`2000-01-01 ${todayAttendanceRecord.clockInTime}`);
              const expectedTime = new Date(`2000-01-01 09:00`);
              isOnTime = clockInTime9AM <= expectedTime;
            } catch (e) {
              console.warn(`${DEBUG_PREFIX} Error parsing time for ${userId}:`, e);
              isOnTime = true; // Default to on time if parsing fails
            }
          } else {
            // No scheduled events, user is always on time
            isOnTime = true;
          }
        }
        
        if (isOnTime) {
          metrics.total.onTime++;
          metrics.perLocation[loc].onTime++;
        } else {
          metrics.total.late++;
          metrics.perLocation[loc].late++;
        }
        
        activeUsersCount++;
      } else {
        metrics.total.notClockedIn++;
        metrics.perLocation[loc].notClockedIn++;
        notClockedInCount++;
      }

      // Calculate attendance statistics
      const daysPresent = stats?.daysPresent || 0;
      const daysAbsent = stats?.daysAbsent || 0;
      totalPresentAll += daysPresent;
      totalDaysAll += daysPresent + daysAbsent;
    });

    // Calculate monthly attendance percentage
    metrics.overview.monthlyAttendance = totalDaysAll > 0
      ? Math.round((totalPresentAll / totalDaysAll) * 100)
      : 0;

    // Set active user counts
    metrics.activeUsersCount = activeUsersCount;
    metrics.activeUsers.count = activeUsersCount;
    metrics.activeUsers.byLocation = Object.fromEntries(
      Object.entries(metrics.perLocation).map(([loc, data]) => [loc, data.clockedIn || 0])
    );
    
    console.log(`${DEBUG_PREFIX} Metrics calculated:`, {
      clockedIn: clockedInCount,
      notClockedIn: notClockedInCount,
      total: Object.keys(data).length,
      date: today
    });

    return metrics;
  }, [hasClockInWithCorrectDate]);

  // Update padrino colors based on attendance stats
  const updatePadrinoColors = useCallback(async (data) => {
    if (isUpdatingColors.current) return;
    isUpdatingColors.current = true;
    setColorUpdateStatus('updating');
    
    console.log(`${DEBUG_PREFIX} Starting padrino color updates`);

    const updates = {};
    let updateCount = 0;

    Object.entries(data || {}).forEach(([id, user]) => {
      const { profile, stats } = user;
      if (!profile) return;

      const newColor = profile.padrino && !profile.manualColorOverride
        ? calculateUserColor(profile, stats)
        : null;

      if (newColor !== null && profile.padrinoColorCode !== newColor) {
        updates[`users/${id}/profile/padrinoColor`] = newColor;
        updates[`users/${id}/profile/padrinoColorCode`] = newColor;
        updateCount++;
        console.log(`${DEBUG_PREFIX} User ${id} color update: ${profile.padrinoColorCode} -> ${newColor}`);
      } else if (!profile.padrino && profile.padrinoColorCode) {
        updates[`users/${id}/profile/padrinoColor`] = null;
        updates[`users/${id}/profile/padrinoColorCode`] = null;
        updateCount++;
        console.log(`${DEBUG_PREFIX} User ${id} color reset: ${profile.padrinoColorCode} -> null`);
      }
    });

    setDebug(prev => ({
      ...prev,
      colorUpdates: {
        count: updateCount,
        updates: Object.keys(updates).length > 0 ? Object.keys(updates).slice(0, 3) : []
      }
    }));

    if (Object.keys(updates).length > 0) {
      try {
        console.log(`${DEBUG_PREFIX} Applying ${Object.keys(updates).length} color updates to database`);
        await update(ref(database), updates);
        setColorUpdateStatus('success');
        console.log(`${DEBUG_PREFIX} Color updates applied successfully`);
      } catch (err) {
        console.error(`${DEBUG_PREFIX} Error updating colors:`, err);
        setColorUpdateStatus('error');
      }
    } else {
      console.log(`${DEBUG_PREFIX} No color updates needed`);
      setColorUpdateStatus('no-changes');
    }

    setTimeout(() => setColorUpdateStatus(null), 3000);
    isUpdatingColors.current = false;
  }, [calculateUserColor]);

  // Function to process the fetched dashboard data
  const processDashboardData = useCallback((data) => {
    try {
      if (!data) {
        setError('No user data available');
        setLoading(false);
        setIsManualRefreshing(false);
        return;
      }

      // Get location key from active tab
      const activeLocationKey = locationMap[activeTab];
      
      // Apply filters and process metrics
      const filtered = applyFilters(data, activeLocationKey, activeFilter);
      setFilteredData(filtered);
      
      // Process metrics using filtered data
      const calculatedMetrics = processMetrics(filtered, activeLocationKey);
      setMetrics(calculatedMetrics);
      
      // Update loading state
      setLoading(false);
      
      // Update debug info
      setDebug(prev => ({
        ...prev,
        refreshCount: prev.refreshCount + 1,
        dataTimestamp: new Date().toISOString()
      }));
      
      // Update padrino colors as needed (using original data)
      updatePadrinoColors(data);
    } catch (err) {
      console.error(`${DEBUG_PREFIX} Error processing data:`, err);
      setError('Error processing dashboard data');
      setLoading(false);
      setIsManualRefreshing(false);
    }
  }, [activeTab, activeFilter, applyFilters, processMetrics, updatePadrinoColors]);

  // Function to manually fetch dashboard data
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    if (!forceRefresh && dataSnapshot.current) {
      console.log(`${DEBUG_PREFIX} Using cached data snapshot`);
      processDashboardData(dataSnapshot.current);
      return;
    }
    
    console.log(`${DEBUG_PREFIX} Fetching fresh dashboard data`);
    setIsManualRefreshing(true);
    
    // Set loading state if this is initial load
    if (!dataSnapshot.current) {
      setLoading(true);
    }
    
    // Reset error state
    setError(null);
    
    // Firebase reference
    const usersRef = ref(database, 'users');
    
    // One-time fetch for manual refresh
    onValue(
      usersRef, 
      (snapshot) => {
        const data = snapshot.val();
        dataSnapshot.current = data;
        processDashboardData(data);
        setIsManualRefreshing(false);
      },
      (err) => {
        console.error(`${DEBUG_PREFIX} Firebase error:`, err);
        setError(`Error fetching data: ${err.message}`);
        setLoading(false);
        setIsManualRefreshing(false);
      },
      { onlyOnce: true }
    );
  }, [processDashboardData]);

  // Set up event listeners for real-time updates
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} Setting up event listeners`);
    
    // Listen for attendance updates
    const unsubscribeAttendance = eventBus.subscribe(EVENTS.ATTENDANCE_UPDATED, (data) => {
      console.log(`${DEBUG_PREFIX} Received ATTENDANCE_UPDATED event:`, data);
      
      // Force reload the data
      fetchDashboardData(true);
      
      // Update debug info
      setDebug(prev => ({
        ...prev,
        events: prev.events + 1,
        lastEventTime: new Date().toISOString()
      }));
    });
    
    // Listen for user data updates
    const unsubscribeUserData = eventBus.subscribe(EVENTS.USER_DATA_UPDATED, (data) => {
      console.log(`${DEBUG_PREFIX} Received USER_DATA_UPDATED event:`, data);
      
      // Force reload the data
      fetchDashboardData(true);
      
      // Update debug info
      setDebug(prev => ({
        ...prev,
        events: prev.events + 1,
        lastEventTime: new Date().toISOString()
      }));
    });
    
    // Clear on unmount
    return () => {
      unsubscribeAttendance();
      unsubscribeUserData();
      console.log(`${DEBUG_PREFIX} Unsubscribed from events`);
    };
  }, [fetchDashboardData]);

  // Load and process data when tab or filter changes
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} Tab or filter changed, reprocessing data`);
    
    // If we already have data, just reprocess it with new filters
    if (dataSnapshot.current) {
      processDashboardData(dataSnapshot.current);
    } else {
      // Otherwise fetch new data
      fetchDashboardData(true);
    }
  }, [activeTab, activeFilter, fetchDashboardData, processDashboardData]);

  // Set up real-time data subscription on initial load
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} Setting up initial data load`);
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      console.log(`${DEBUG_PREFIX} Initial data received`);
      const data = snapshot.val();
      dataSnapshot.current = data;
      processDashboardData(data);
    }, (err) => {
      console.error(`${DEBUG_PREFIX} Firebase error:`, err);
      setError(`Error fetching data: ${err.message}`);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      console.log(`${DEBUG_PREFIX} Unsubscribed from Firebase`);
    };
  }, [processDashboardData]);

  // Handle location tab click
  const handleTabClick = (tab) => {
    console.log(`${DEBUG_PREFIX} Tab clicked:`, tab);
    setActiveTab(tab);
    setActiveFilter(null); // Reset color filter when changing location
  };

  // Handle color filter click
  const handleColorClick = (color) => {
    console.log(`${DEBUG_PREFIX} Color filter clicked:`, color);
    setActiveFilter(prev => (prev === color ? null : color));
  };

  // Handle manual refresh
  const handleManualRefresh = () => {
    console.log(`${DEBUG_PREFIX} Manual refresh triggered`);
    fetchDashboardData(true);
  };

  // Handler to reset all padrinos to red and clear manualColorOverride
  const handleResetAllPadrinos = async () => {
    try {
      setColorUpdateStatus('updating');
      const usersRef = ref(database, 'users');
      const snapshot = await new Promise((resolve, reject) => {
        onValue(usersRef, resolve, { onlyOnce: true });
      });
      const users = snapshot.val();
      const updates = {};
      Object.entries(users || {}).forEach(([userId, user]) => {
        if (user.profile && user.profile.padrino) {
          updates[`users/${userId}/profile/padrinoColor`] = 'blue';
          updates[`users/${userId}/profile/padrinoColorCode`] = 'blue';
          updates[`users/${userId}/profile/manualColorOverride`] = false;
        }
      });
      await update(ref(database), updates);
      setColorUpdateStatus('success');
      fetchDashboardData(true);
    } catch (err) {
      setColorUpdateStatus('error');
      setError('Failed to reset padrinos: ' + err.message);
    }
  };

  // Show loading state
  if (loading) return (
    <div className="loading-overlay">
      <Loader2 className="animate-spin" />
      <p>Loading dashboard data...</p>
    </div>
  );

  // Show error state
  if (error) return (
    <div className="error-banner">
      <AlertCircle />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container relative">
      {/* Status notifications */}
      {colorUpdateStatus === 'success' && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded mb-4">
          Padrino colors updated successfully
        </div>
      )}
      {colorUpdateStatus === 'error' && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded mb-4">
          Error updating padrino colors
        </div>
      )}
      
      {/* Main dashboard layout */}
      <div className="dashboard-grid">
        <div className="quadrant quadrant-1">
          <LocationNav
            locationMap={locationMap}
            activeTab={activeTab}
            onTabClick={handleTabClick}
          />
          <MetricsGrid
            metrics={metrics}
            activeFilter={activeFilter}
            onColorClick={handleColorClick}
            activeTab={activeTab}
            locationMap={locationMap} // Pass locationMap to help with location handling
          />
        </div>
        <div className="quadrant quadrant-2 flex gap-4">
          <ClockedInList data={filteredData} date={metrics?.date} />
          <NotClockedInList data={filteredData} date={metrics?.date} />
        </div>
        
        {/* Debug information (remove in production) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="debug-info mt-8 text-xs text-gray-500 p-2 border border-gray-200 rounded">
            <details>
              <summary className="cursor-pointer font-bold">Debug Info:</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>Active Tab: {activeTab}</div>
                <div>Location Key: {locationMap[activeTab]}</div>
                <div>Active Filter: {activeFilter || 'None'}</div>
                <div>Filtered Users: {Object.keys(filteredData).length}</div>
                <div>Total Users: {dataSnapshot.current ? Object.keys(dataSnapshot.current).length : 0}</div>
                <div>Events Received: {debug.events}</div>
                <div>Last Event: {debug.lastEventTime ? new Date(debug.lastEventTime).toLocaleTimeString() : 'None'}</div>
                <div>Data Timestamp: {debug.dataTimestamp ? new Date(debug.dataTimestamp).toLocaleTimeString() : 'None'}</div>
                <div>Refresh Count: {debug.refreshCount}</div>
                <div className="col-span-2">
                  Color Updates: {debug.colorUpdates?.count || 0}
                </div>
                {debug.colorUpdates?.updates?.length > 0 && (
                  <div className="col-span-2">
                    Sample Updates: {debug.colorUpdates.updates.join(', ')}
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
      </div>
      
      {/* Add Event tracking debugger */}
      <DataFlowDebugger componentName="SuperAdminDashboard" />
    </div>
  );
};

export default SuperAdminDashboard;
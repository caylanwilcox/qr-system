import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import './SuperAdminDashboard.css';

import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import ClockedInList from './ClockedInList';
import NotClockedInList from './NotClockedInList';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorUpdateStatus, setColorUpdateStatus] = useState(null);
  const [filteredData, setFilteredData] = useState({});
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);
  const [debug, setDebug] = useState({});

  const dataSnapshot = useRef(null);
  const isUpdatingColors = useRef(false);

  const getCurrentDateISO = () => new Date().toISOString().split('T')[0];

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

    if (daysPresent === 0) return 'red';
    if (attendanceRate >= 90) return 'blue';
    if (attendanceRate >= 75) return 'green';
    if (attendanceRate >= 60) return 'orange';
    return 'red';
  }, []);

  // Apply location and color filters to the user data
  const applyFilters = useCallback((data, locationKey, colorFilter) => {
    // Normalize location key for comparison
    const normalizedLocationKey = normalizeLocationKey(locationKey);
    
    // Log for debugging
    const sampleLocations = Object.values(data).slice(0, 5).map(user => {
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

    return Object.fromEntries(
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
          (user.profile?.padrinoColor?.toLowerCase() === colorFilter && user.profile?.padrino);
        
        return locationMatch && colorMatch;
      })
    );
  }, [normalizeLocationKey]);

  // Update padrino colors based on attendance stats
  const updatePadrinoColors = useCallback(async (data) => {
    if (isUpdatingColors.current) return;
    isUpdatingColors.current = true;
    setColorUpdateStatus('updating');

    const updates = {};
    let updateCount = 0;

    Object.entries(data).forEach(([id, user]) => {
      const { profile, stats } = user;
      if (!profile) return;

      const newColor = profile.padrino && !profile.manualColorOverride
        ? calculateUserColor(profile, stats)
        : null;

      if (newColor !== null && profile.padrinoColor !== newColor) {
        updates[`users/${id}/profile/padrinoColor`] = newColor;
        updateCount++;
      } else if (!profile.padrino && profile.padrinoColor) {
        updates[`users/${id}/profile/padrinoColor`] = null;
        updateCount++;
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
        await update(ref(database), updates);
        setColorUpdateStatus('success');
      } catch (err) {
        console.error('Error updating colors:', err);
        setColorUpdateStatus('error');
      }
    } else {
      setColorUpdateStatus('no-changes');
    }

    setTimeout(() => setColorUpdateStatus(null), 3000);
    isUpdatingColors.current = false;
  }, [calculateUserColor]);

  // Process user data to calculate metrics
  const processMetrics = useCallback((data, locationKey) => {
    const today = getCurrentDateISO();
    const metrics = {
      total: { clockedIn: 0, notClockedIn: 0, onTime: 0, late: 0 },
      perLocation: {},
      overview: {
        totalMembers: Object.keys(data).length,
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

    // Set debug info for processed data
    setDebug(prev => ({
      ...prev,
      processedDataSize: Object.keys(data).length,
      locationKey,
      date: today
    }));

    Object.entries(data).forEach(([userId, user]) => {
      const { profile, stats, attendance } = user;
      if (!profile) return;

      // Get location from various possible fields
      const loc = user.location || profile?.locationKey || profile?.primaryLocation || 'Unknown';
      const color = profile?.padrinoColor?.toLowerCase?.();
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

      if (attend?.clockedIn) {
        metrics.total.clockedIn++;
        metrics.perLocation[loc].clockedIn++;
        attend.onTime ? metrics.total.onTime++ : metrics.total.late++;
        attend.onTime ? metrics.perLocation[loc].onTime++ : metrics.perLocation[loc].late++;
        activeUsersCount++;
      } else {
        metrics.total.notClockedIn++;
        metrics.perLocation[loc].notClockedIn++;
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

    return metrics;
  }, []);

  // Load and process data when tab or filter changes
  useEffect(() => {
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    
    // Log for debugging
    setDebug(prev => ({
      ...prev,
      loadingStarted: new Date().toISOString(),
      activeTab,
      activeFilter
    }));

    const unsubscribe = onValue(usersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setError('No user data available');
          setLoading(false);
          return;
        }

        // Store raw data for reference
        dataSnapshot.current = data;
        
        // Get location key from active tab
        const activeLocationKey = locationMap[activeTab];
        
        // Apply filters and process metrics
        const filtered = applyFilters(data, activeLocationKey, activeFilter);
        setFilteredData(filtered);
        
        // Process metrics using filtered data
        const calculatedMetrics = processMetrics(filtered, activeLocationKey);
        setMetrics(calculatedMetrics);
        
        setLoading(false);
        
        // Update padrino colors as needed (using original data)
        await updatePadrinoColors(data);
        
        // Log success for debugging
        setDebug(prev => ({
          ...prev,
          loadingCompleted: new Date().toISOString(),
          filteredDataSize: Object.keys(filtered).length,
          metricsCalculated: !!calculatedMetrics
        }));
      } catch (err) {
        console.error('Error processing data:', err);
        setError('Error processing dashboard data');
        setLoading(false);
        
        // Log error for debugging
        setDebug(prev => ({
          ...prev,
          error: err.message,
          errorStack: err.stack
        }));
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError(`Error fetching data: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, activeFilter, processMetrics, updatePadrinoColors, applyFilters]);

  // Handle location tab click
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setActiveFilter(null); // Reset color filter when changing location
  };

  // Handle color filter click
  const handleColorClick = (color) => {
    setActiveFilter(prev => (prev === color ? null : color));
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
    <div className="dashboard-container">
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
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info mt-8 text-xs text-gray-500 p-2 border border-gray-200 rounded">
            <h4 className="font-bold">Debug Info:</h4>
            <p>Active Tab: {activeTab}</p>
            <p>Location Key: {locationMap[activeTab]}</p>
            <p>Active Filter: {activeFilter || 'None'}</p>
            <p>Filtered Users: {Object.keys(filteredData).length}</p>
            <p>Total Metrics: {metrics ? JSON.stringify(metrics.total) : 'N/A'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
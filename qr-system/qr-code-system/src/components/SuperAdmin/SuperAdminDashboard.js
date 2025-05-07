import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

  // Remove the unused navigate import
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);

  const dataSnapshot = useRef(null);
  const isUpdatingColors = useRef(false);

  // Helper to get current date in ISO format (YYYY-MM-DD)
  const getCurrentDateISO = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Location mapping
  const locationMap = {
    All: 'All',
    Aurora: 'aurora',
    Elgin: 'Elgin',
    Joliet: 'Joliet',
    Lyons: 'Lyons',
    'West Chicago': 'westchicago',
    Wheeling: 'wheeling',
  };

  // Calculate user color based on attendance
  const calculateUserColor = useCallback((profile, stats) => {
    const attendanceRate = stats?.attendanceRate || 0;
    const daysPresent = stats?.daysPresent || 0;

    if (daysPresent === 0) return 'red';
    if (attendanceRate >= 90) return 'blue';
    if (attendanceRate >= 75) return 'green';
    if (attendanceRate >= 60) return 'orange';
    return 'red';
  }, []);

  // Apply location and color filters
  const applyFilters = useCallback((data, locationKey, colorFilter) => {
    return Object.fromEntries(
      Object.entries(data).filter(([_, user]) => {
        const locationMatch = locationKey === 'All' || user.profile?.primaryLocation === locationKey;
        const colorMatch = !colorFilter || (user.profile?.padrinoColor?.toLowerCase() === colorFilter && user.profile?.padrino);
        return locationMatch && colorMatch;
      })
    );
  }, []);

  // Update padrino colors based on attendance
  const updatePadrinoColors = useCallback(async (data) => {
    if (isUpdatingColors.current) return;
    isUpdatingColors.current = true;
    setColorUpdateStatus('updating');

    const updates = {};

    Object.entries(data).forEach(([id, user]) => {
      const { profile, stats } = user;
      if (!profile) return;
      if (profile.padrino && !profile.manualColorOverride) {
        const color = calculateUserColor(profile, stats);
        if (profile.padrinoColor !== color) {
          updates[`users/${id}/profile/padrinoColor`] = color;
        }
      } else if (!profile.padrino && profile.padrinoColor) {
        updates[`users/${id}/profile/padrinoColor`] = null;
      }
    });

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

    setTimeout(() => {
      setColorUpdateStatus(null);
    }, 3000);

    isUpdatingColors.current = false;
  }, [calculateUserColor]);

  // Process metrics based on filtered data
  const processMetrics = useCallback((data, locationKey) => {
    // Always use today's date
    const today = getCurrentDateISO();
    
    // Initialize metrics object
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
    };

    // Track totals for attendance calculations
    let totalPresentAll = 0;
    let totalDaysAll = 0;

    // Process each user to calculate metrics
    Object.entries(data).forEach(([_, user]) => {
      const { profile, stats, attendance } = user;
      if (!profile) return;
      
      // Get user location and attributes
      const loc = profile?.primaryLocation || 'Unknown';
      const color = profile?.padrinoColor?.toLowerCase?.();
      const isPadrino = profile?.padrino;
      
      // Initialize location metrics if not exists
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
      
      // Process attendance for today
      const attend = attendance?.[today];
      
      if (attend?.clockedIn) {
        metrics.total.clockedIn++;
        metrics.perLocation[loc].clockedIn++;
        
        if (attend.onTime) {
          metrics.total.onTime++;
          metrics.perLocation[loc].onTime++;
        } else {
          metrics.total.late++;
          metrics.perLocation[loc].late++;
        }
      } else {
        metrics.total.notClockedIn++;
        metrics.perLocation[loc].notClockedIn++;
      }
      
      // Add to attendance totals
      const daysPresent = stats?.daysPresent || 0;
      const daysAbsent = stats?.daysAbsent || 0;
      totalPresentAll += daysPresent;
      totalDaysAll += daysPresent + daysAbsent;
    });

    // Calculate monthly attendance percentage
    if (totalDaysAll > 0) {
      metrics.overview.monthlyAttendance = (totalPresentAll / totalDaysAll) * 100;
    }

    return metrics;
  }, []);

  // Main effect to fetch and process data
  useEffect(() => {
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setError('No user data available');
          setLoading(false);
          return;
        }

        // Store the raw data
        dataSnapshot.current = data;
        
        // Apply location and color filters
        const activeLocationKey = locationMap[activeTab];
        const filteredResult = applyFilters(data, activeLocationKey, activeFilter);
        
        // Set filtered data and calculate metrics
        setFilteredData(filteredResult);
        setMetrics(processMetrics(filteredResult, activeLocationKey));
        setLoading(false);

        // Update padrino colors in the background
        await updatePadrinoColors(data);
      } catch (err) {
        console.error('Error processing data:', err);
        setError('Error processing dashboard data');
        setLoading(false);
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError(`Error fetching data: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, activeFilter, processMetrics, updatePadrinoColors, applyFilters, locationMap]);

  // Handle location tab change
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setActiveFilter(null);
  };

  // Handle color filter change
  const handleColorClick = (color) => {
    setActiveFilter((prev) => (prev === color ? null : color));
  };

  // Loading and error states
  if (loading) return (
    <div className="loading-overlay">
      <Loader2 className="animate-spin" />
      <p>Loading dashboard data...</p>
    </div>
  );
  
  if (error) return (
    <div className="error-banner">
      <AlertCircle />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
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

      <div className="dashboard-grid">
        {/* Quadrant 1 */}
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
          />
        </div>

        {/* Quadrant 2 */}
        <div className="quadrant quadrant-2 flex gap-4">
          <ClockedInList data={filteredData} date={metrics?.date} />
          <NotClockedInList data={filteredData} date={metrics?.date} />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
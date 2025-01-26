'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import './SuperAdminDashboard.css';

// Import child components
import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import TimeFilter from './TimeFilter';
import AttendanceMetrics from './AttendanceMetrics';
import EmployeeList from './EmployeeList';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);
  const [timeFilter, setTimeFilter] = useState({
    type: '24h',
    dateRange: { start: '', end: '' },
  });

  // Location mapping
  const locationMap = {
    All: 'All',
    Aurora: 'Aurora',
    Elgin: 'Agua Viva Elgin R7',
    Joliet: 'Agua Viva Joliet',
    Lyons: 'Agua Viva Lyons',
    'West Chicago': 'Agua Viva West Chicago',
    Wheeling: 'Agua Viva Wheeling',
    Retreat: 'Retreat',
  };

  // Utility to calculate attendance rate
  const calculateAttendanceRate = (stats) => {
    if (!stats) return 0;
    const total = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
    return total > 0 ? (((stats.daysPresent || 0) / total) * 100).toFixed(1) : 0;
  };
// Utility to calculate fraction as a percentage
const calculateFraction = useCallback((numerator, denominator) => {<AttendanceMetrics
  metrics={metrics}
  calculateFraction={calculateFraction} // Ensure this is passed correctly
/>

  if (!denominator) return 0;
  const result = (numerator / denominator) * 100;
  return isNaN(result) ? 0 : result;
}, []);

  // Utility to calculate on-time rate
  const calculateOnTimeRate = (stats) => {
    if (!stats || !stats.daysPresent) return 0;
    const onTime = stats.daysPresent - (stats.daysLate || 0);
    return ((onTime / stats.daysPresent) * 100).toFixed(1);
  };

  // Handle tab click
  const handleTabClick = useCallback((tabName) => {
    setActiveTab(tabName);
    setActiveFilter(null);
  }, []);

  // Handle color filter toggle
  const handleColorClick = useCallback((color) => {
    setActiveFilter((prevFilter) => (prevFilter === color ? null : color));
  }, []);

  // Handle time filter changes
  const handleTimeFilterChange = useCallback((type) => {
    setTimeFilter((prev) => ({
      ...prev,
      type,
      dateRange: type === '24h' ? { start: '', end: '' } : prev.dateRange,
    }));
  }, []);

  const handleDateRangeChange = useCallback((field, value) => {
    setTimeFilter((prev) => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value },
    }));
  }, []);

  // Process metrics
  const processMetrics = useCallback(
    (data, activeLocation) => {
      const metricsObj = {
        total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
        perLocation: {},
        overview: {
          totalMembers: 0,
          padrinosBlue: 0,
          padrinosGreen: 0,
          padrinosRed: 0,
          padrinosOrange: 0,
          totalOrejas: 0,
          totalApoyos: 0,
          monthlyAttendance: 0,
        },
      };
  
      const locationMatch = (userLocation, targetLocation) => {
        if (targetLocation === 'All') return true;
        return userLocation === targetLocation;
      };
  
      Object.entries(data).forEach(([, user]) => {
        if (!user) return;
  
        // Only process if location matches
        if (!locationMatch(user.location, activeLocation)) return;
  
        // Count padrinos by color for matched location
        const color = user.padrinoColor?.toLowerCase();
        if (color === 'blue') metricsObj.overview.padrinosBlue++;
        if (color === 'green') metricsObj.overview.padrinosGreen++;
        if (color === 'red') metricsObj.overview.padrinosRed++;
        if (color === 'orange') metricsObj.overview.padrinosOrange++;
  
        // Process active members
        if (user.status?.toLowerCase() === 'active') {
          metricsObj.overview.totalMembers++;
  
          const location = user.location || 'Unknown';
          if (!metricsObj.perLocation[location]) {
            metricsObj.perLocation[location] = {
              notClockedIn: 0,
              clockedIn: 0,
              onTime: 0,
              late: 0,
            };
          }
  
          // Process attendance data
          const lastClockIn = user.stats?.lastClockIn;
          if (lastClockIn) {
            const isLate = user.stats?.daysLate > 0;
            metricsObj.total.clockedIn++;
            metricsObj.perLocation[location].clockedIn++;
            if (isLate) {
              metricsObj.total.late++;
              metricsObj.perLocation[location].late++;
            } else {
              metricsObj.total.onTime++;
              metricsObj.perLocation[location].onTime++;
            }
          } else {
            metricsObj.total.notClockedIn++;
            metricsObj.perLocation[location].notClockedIn++;
          }
  
          if (user.service?.toUpperCase() === 'RSG') metricsObj.overview.totalOrejas++;
          if (user.service?.toUpperCase() === 'COM') metricsObj.overview.totalApoyos++;
  
          const stats = user.stats || {};
          const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
          if (totalDays > 0) {
            metricsObj.overview.monthlyAttendance += ((stats.daysPresent || 0) / totalDays) * 100;
          }
        }
      });
  
      if (metricsObj.overview.totalMembers > 0) {
        metricsObj.overview.monthlyAttendance /= metricsObj.overview.totalMembers;
      }
  
      return metricsObj;
    },
    []

  );

  // Fetch data from Firebase
  useEffect(() => {
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) throw new Error('No user data available');

        const activeKey = locationMap[activeTab];
        const filteredData =
          activeKey === 'All'
            ? data
            : Object.fromEntries(Object.entries(data).filter(([, user]) => user.location === activeKey));

        const metrics = processMetrics(filteredData, activeKey);
        setMetrics(metrics);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [activeTab, processMetrics]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Quadrant 1: Location Navigation and Metrics */}
        <div className="quadrant quadrant-1">
          <LocationNav locationMap={locationMap} activeTab={activeTab} onTabClick={handleTabClick} />
          <MetricsGrid metrics={metrics} activeFilter={activeFilter} onColorClick={handleColorClick} />
        </div>

        {/* Quadrant 2: Time Filter and Attendance Metrics */}
        <div className="quadrant quadrant-2">
          <TimeFilter
            timeFilter={timeFilter}
            onTimeFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />
<AttendanceMetrics
  metrics={metrics}
  calculateFraction={calculateFraction} // Ensure this is passed correctly
/>
        </div>

        {/* Quadrant 3: Employee List */}
        <div className="quadrant quadrant-3">
<EmployeeList colorFilter={activeFilter} />        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

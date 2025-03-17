import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import './SuperAdminDashboard.css';

// Child components
import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import TimeFilter from './TimeFilter';
import AttendanceMetrics from './AttendanceMetrics';
import EmployeeList from './EmployeeList';

const SuperAdminDashboard = () => {
  // ---------------------------
  // 1) Local State
  // ---------------------------
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);

  // Example time filter object (24h or date range)
  const [timeFilter, setTimeFilter] = useState({
    type: '24h',
    dateRange: { start: '', end: '' },
  });

  // For example, your location tabs
  const locationMap = {
    All: 'All',
    Aurora: 'Aurora',
    Elgin: 'Elgin',
    Joliet: 'Joliet',
    Lyons: 'Lyons',
    'West Chicago': 'West Chicago',
    Wheeling: 'Wheeling',
    Retreat: 'Retreat',
  };

  // ---------------------------
  // 2) Utility Functions
  // ---------------------------
  // A simple fraction -> percentage (e.g., attendance rates)
  const calculateFraction = useCallback((numerator, denominator) => {
    if (!denominator) return 0;
    const result = (numerator / denominator) * 100;
    return isNaN(result) ? 0 : result;
  }, []);

  // ---------------------------
  // 3) Handlers
  // ---------------------------
  const handleTabClick = useCallback((tabName) => {
    setActiveTab(tabName);
    setActiveFilter(null); // reset color filter
  }, []);

  const handleColorClick = useCallback((color) => {
    // Toggle the color filter
    setActiveFilter((prevFilter) => (prevFilter === color ? null : color));
  }, []);

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

  // ---------------------------
  // 4) processMetrics
  //    (Adapts to nested "profile" & "stats")
  // ---------------------------
  const processMetrics = useCallback((data, activeLocation) => {
    const metricsObj = {
      total: {
        notClockedIn: 0,
        clockedIn: 0,
        onTime: 0,
        late: 0,
      },
      perLocation: {},
      overview: {
        totalMembers: data ? Object.keys(data).length : 0,
        padrinosBlue: 0,
        padrinosGreen: 0,
        padrinosRed: 0,
        padrinosOrange: 0,
        totalOrejas: 0,
        totalApoyos: 0,
        monthlyAttendance: 0,
      },
    };
  
    // Helper: check if a user is in the correct location
    const locationMatch = (userLocation, targetLocation) => {
      if (targetLocation === 'All') return true;
      return userLocation === targetLocation;
    };
  
    // Track group-level attendance totals
    let totalPresentAll = 0;
    let totalDaysAll = 0;
  
    Object.entries(data).forEach(([userId, userRecord]) => {
      if (!userRecord) return;
  
      const { profile, stats } = userRecord;
      if (!profile) return; // skip if no profile at all
  
      // Extract relevant fields
      const userLocation = profile.primaryLocation || 'Unknown';
      const color = profile.padrinoColor?.toLowerCase?.() || '';
      const lastClockIn = stats?.lastClockIn;
      const daysPresent = stats?.daysPresent || 0;
      const daysAbsent = stats?.daysAbsent || 0;
      const daysLate = stats?.daysLate || 0;
      const service = profile.service?.toUpperCase?.();
  
      // (1) Filter by location
      if (!locationMatch(userLocation, activeLocation)) return;
  
      // (2) Count padrinos by color
      if (color === 'blue')   metricsObj.overview.padrinosBlue++;
      if (color === 'green')  metricsObj.overview.padrinosGreen++;
      if (color === 'red')    metricsObj.overview.padrinosRed++;
      if (color === 'orange') metricsObj.overview.padrinosOrange++;
  
      // (3) Initialize location-based counters if missing
      if (!metricsObj.perLocation[userLocation]) {
        metricsObj.perLocation[userLocation] = {
          notClockedIn: 0,
          clockedIn: 0,
          onTime: 0,
          late: 0,
        };
      }
  
      // If there's a valid `lastClockIn`, count user as clockedIn
      if (lastClockIn) {
        metricsObj.total.clockedIn++;
        metricsObj.perLocation[userLocation].clockedIn++;
  
        if (daysLate > 0) {
          metricsObj.total.late++;
          metricsObj.perLocation[userLocation].late++;
        } else {
          metricsObj.total.onTime++;
          metricsObj.perLocation[userLocation].onTime++;
        }
      } else {
        metricsObj.total.notClockedIn++;
        metricsObj.perLocation[userLocation].notClockedIn++;
      }
  
      // (4) Service-based counts (e.g., RSG => Orejas, COM => Apoyos)
      if (service === 'RSG') metricsObj.overview.totalOrejas++;
      if (service === 'COM') metricsObj.overview.totalApoyos++;
  
      // (5) Group-level attendance from daysPresent/daysAbsent
      const totalDays = daysPresent + daysAbsent;
      totalPresentAll += daysPresent;
      totalDaysAll += totalDays;
    });
  
    // Final group attendance ratio
    if (totalDaysAll > 0) {
      metricsObj.overview.monthlyAttendance = (totalPresentAll / totalDaysAll) * 100;
    } else {
      metricsObj.overview.monthlyAttendance = 0;
    }
  
    return metricsObj;
  }, []);
  
  // ---------------------------
  // 5) Fetch from Firebase
  // ---------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) throw new Error('No user data available');

        // Filter data if needed
        const activeKey = locationMap[activeTab];
        const filteredData =
          activeKey === 'All'
            ? data
            : Object.fromEntries(
                Object.entries(data).filter(([, userRecord]) =>
                  (userRecord.profile?.primaryLocation || 'Unknown') === activeKey
                )
              );

        // Process it
        const processedMetrics = processMetrics(filteredData, activeKey);
        setMetrics(processedMetrics);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [activeTab, processMetrics]);

  // ---------------------------
  // 6) Render
  // ---------------------------
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
          <LocationNav
            locationMap={locationMap}
            activeTab={activeTab}
            onTabClick={handleTabClick}
          />
          <MetricsGrid
            metrics={metrics}
            activeFilter={activeFilter}
            onColorClick={handleColorClick}
          />
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
            calculateFraction={calculateFraction}
          />
        </div>

        {/* Quadrant 3: Employee List */}
        <div className="quadrant quadrant-3">
          <EmployeeList colorFilter={activeFilter} />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

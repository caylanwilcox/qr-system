import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import './SuperAdminDashboard.css';

// Child components
import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import TimeFilter from './TimeFilter';
import ClockedInList from './ClockedInList';
import NotClockedInList from './NotClockedInList';

const SuperAdminDashboard = () => {
  // ---------------------------
  // 1) Local State
  // ---------------------------
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorUpdateStatus, setColorUpdateStatus] = useState(null);
  const [filteredData, setFilteredData] = useState({});

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
    Aurora: 'aurora',
    Elgin: 'Elgin',
    Joliet: 'Joliet',
    Lyons: 'Lyons',
    'West Chicago': 'westchicago',
    Wheeling: 'wheeling',
  };

  // ---------------------------
  // 2) Utility Functions
  // ---------------------------
  const calculateFraction = useCallback((numerator, denominator) => {
    if (typeof numerator !== 'number' || typeof denominator !== 'number') {
      console.error('calculateFraction: Numerator and denominator must be numbers', { numerator, denominator });
      return null;  // clearly indicates calculation failed
    }
  
    if (denominator === 0) {
      console.error('calculateFraction: Cannot divide by zero', { numerator, denominator });
      return null;  // again, clearly indicates issue
    }
  
    return (numerator / denominator) * 100;
  }, []);
  

  // Calculate color for a user based on their metrics
  const calculateUserColor = useCallback((profile, stats) => {
    if (!stats) return 'blue'; // Default color
    
    // Color assignment logic - modify as needed based on your business rules
    const attendanceRate = stats.attendanceRate || 0;
    const daysPresent = stats.daysPresent || 0;
    
    if (daysPresent === 0) {
      return 'red';
    } else if (attendanceRate >= 90) {
      return 'green';
    } else if (attendanceRate >= 70) {
      return 'blue';
    } else if (attendanceRate >= 50) {
      return 'orange';
    } else {
      return 'red';
    }
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

  // Function to update padrino colors for all users
  const updatePadrinoColors = useCallback(async (userData) => {
    try {
      setColorUpdateStatus('updating');
      
      // Create batch updates object
      const updates = {};
      
      // Assign colors based on rules
      Object.entries(userData).forEach(([userId, userRecord]) => {
        if (!userRecord || !userRecord.profile) return;
        
        const { profile, stats } = userRecord;
        const color = calculateUserColor(profile, stats);
        
        // Only update if different from current value
        if (profile.padrinoColor !== color) {
          updates[`users/${userId}/profile/padrinoColor`] = color;
        }
      });
      
      // Execute the batch update
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
        console.log(`Updated padrinoColor for ${Object.keys(updates).length} users`);
        setColorUpdateStatus('success');
      } else {
        console.log('No color updates needed');
        setColorUpdateStatus('no-changes');
      }
    } catch (error) {
      console.error('Error updating padrinoColor:', error);
      setColorUpdateStatus('error');
    }
  }, [calculateUserColor]);

  // ---------------------------
  // 4) processMetrics
  //    (Adapts to nested "profile" & "stats")
  // ---------------------------
  const processMetrics = useCallback((data, activeLocation) => {
    // Get today's date for comparison
    const today = new Date().toISOString().split('T')[0];
    
    // Use the timeFilter to determine the relevant date
    const relevantDate = timeFilter.type === 'range' && timeFilter.dateRange.end 
      ? timeFilter.dateRange.end 
      : today;
    
    console.log(`Processing metrics for date: ${relevantDate}`);
    
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
      // Store the relevant date for reference in attendance filtering
      date: relevantDate
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
  
      const { profile, stats, attendance } = userRecord;
      if (!profile) return; // skip if no profile at all
  
      // Extract relevant fields
      const userLocation = profile.primaryLocation || 'Unknown';
      
      // Get color from profile or calculate it if missing
      let color = profile.padrinoColor?.toLowerCase?.();
      if (!color) {
        color = calculateUserColor(profile, stats)?.toLowerCase?.() || '';
      }
      
      // Check if user attended on the relevant date
      // This assumes you have a structure like: attendance[date] = { clockedIn: true, onTime: true }
      const dateAttendance = attendance?.[relevantDate];
      const isClockInToday = Boolean(dateAttendance?.clockedIn);
      const isOnTime = Boolean(dateAttendance?.onTime);
      
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
  
      // Count attendance for the relevant date specifically
      if (isClockInToday) {
        metricsObj.total.clockedIn++;
        metricsObj.perLocation[userLocation].clockedIn++;
  
        if (isOnTime) {
          metricsObj.total.onTime++;
          metricsObj.perLocation[userLocation].onTime++;
        } else {
          metricsObj.total.late++;
          metricsObj.perLocation[userLocation].late++;
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
  }, [calculateUserColor, timeFilter]);
  
  // ---------------------------
  // 5) Fetch from Firebase
  // ---------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) throw new Error('No user data available');

        // Update padrino colors on each data fetch (per render)
        await updatePadrinoColors(data);

        // Filter data if needed
        const activeKey = locationMap[activeTab];
        const filteredUserData =
          activeKey === 'All'
            ? data
            : Object.fromEntries(
                Object.entries(data).filter(([, userRecord]) =>
                  (userRecord.profile?.primaryLocation || 'Unknown') === activeKey
                )
              );

        // Store filtered data for the attendance lists
        setFilteredData(filteredUserData);
        
        // Process it
        const processedMetrics = processMetrics(filteredUserData, activeKey);
        
        // If we're using a date range, add the end date to metrics for reference
        if (timeFilter.type === 'range' && timeFilter.dateRange.end) {
          processedMetrics.date = timeFilter.dateRange.end;
        }
        
        setMetrics(processedMetrics);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [activeTab, processMetrics, updatePadrinoColors, timeFilter]);

  // ---------------------------
  // 6) Render
  // ---------------------------
  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading dashboard data...</p>
        {colorUpdateStatus === 'updating' && (
          <p className="mt-1 text-sm text-gray-500">Updating padrino colors...</p>
        )}
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
          {/* Add TimeFilter component here for date selection */}
          <TimeFilter
            timeFilter={timeFilter}
            onTimeFilterChange={handleTimeFilterChange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>

        {/* Quadrant 2: Two side-by-side lists */}
        <div className="quadrant quadrant-2 flex gap-4">
          <ClockedInList
            data={filteredData}
            date={metrics?.date || ''}
          />
          <NotClockedInList
            data={filteredData}
            date={metrics?.date || ''}
          />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
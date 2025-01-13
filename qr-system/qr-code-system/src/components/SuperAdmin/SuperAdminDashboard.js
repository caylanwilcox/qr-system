// src/components/SuperAdminDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, get, off } from "firebase/database";
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle, CheckCircle2, Clock, User } from 'lucide-react';

const LOCATIONS = {
  "All": "All",
  "Aurora": "Aurora",
  "Elgin": "Agua Viva Elgin R7",
  "Joliet": "Agua Viva Joliet",
  "Lyons": "Agua Viva Lyons",
  "West Chicago": "Agua Viva West Chicago",
  "Wheeling": "Agua Viva Wheeling"
};

const UPDATE_INTERVAL = 30000; // 30 seconds

const SuperAdminDashboard = () => {
  const [dashboardState, setDashboardState] = useState({
    metrics: {
      total: { clockedIn: 0, totalMembers: 0 },
      perLocation: {},
      employees: []
    },
    loading: true,
    error: null,
    activeTab: "All",
    timeFilter: {
      type: '24h',
      dateRange: { 
        start: new Date().toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
      }
    }
  });

  const { metrics, loading, error, activeTab, timeFilter } = dashboardState;

  const getDateRange = useCallback(() => {
    if (timeFilter.type === '24h') {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    }
    return timeFilter.dateRange;
  }, [timeFilter]);

  const calculateMetrics = useCallback(async (attendanceData, usersData) => {
    const dateRange = getDateRange();
    const metrics = {
      total: { clockedIn: 0, totalMembers: 0 },
      perLocation: {},
      employees: []
    };

    // Initialize location metrics
    Object.values(LOCATIONS).forEach(location => {
      if (location !== "All") {
        const activeUsers = Object.values(usersData || {}).filter(user => 
          user.status === 'active' && 
          user.location === location
        ).length;

        metrics.perLocation[location] = {
          clockedIn: 0,
          totalMembers: activeUsers
        };
      }
    });

    metrics.total.totalMembers = Object.values(usersData || {}).filter(
      user => user.status === 'active'
    ).length;

    const clockedInUsers = [];
    
    const processAttendance = (location, date, dayData) => {
      if (date >= dateRange.start && date <= dateRange.end) {
        Object.entries(dayData).forEach(([userId, attendance]) => {
          const user = usersData[userId];
          if (user && user.status === 'active') {
            clockedInUsers.push({
              id: userId,
              name: attendance.name,
              position: attendance.position || user.position,
              location: location,
              clockInTime: attendance.clockInTime,
              clockOutTime: attendance.clockOutTime,
              date: date
            });

            if (metrics.perLocation[location]) {
              metrics.perLocation[location].clockedIn++;
              metrics.total.clockedIn++;
            }
          }
        });
      }
    };

    // Process attendance data
    Object.entries(attendanceData || {}).forEach(([location, locationData]) => {
      if (location === "Agua Viva") {
        // Handle nested structure
        Object.entries(locationData).forEach(([subLocation, subLocationData]) => {
          Object.entries(subLocationData).forEach(([date, dayData]) => {
            processAttendance(subLocation, date, dayData);
          });
        });
      } else {
        // Handle direct location data
        Object.entries(locationData).forEach(([date, dayData]) => {
          processAttendance(location, date, dayData);
        });
      }
    });

    metrics.employees = clockedInUsers.sort((a, b) => 
      new Date(b.clockInTime) - new Date(a.clockInTime)
    );

    return metrics;
  }, [getDateRange]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [attendanceSnapshot, usersSnapshot] = await Promise.all([
        get(ref(database, 'attendance')),
        get(ref(database, 'users'))
      ]);

      const metrics = await calculateMetrics(
        attendanceSnapshot.val() || {},
        usersSnapshot.val() || {}
      );

      return metrics;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }, [calculateMetrics]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const updateDashboard = async () => {
      if (!isMounted) return;
      
      try {
        const metrics = await fetchDashboardData();
        if (isMounted) {
          setDashboardState(prev => ({
            ...prev,
            metrics,
            loading: false,
            error: null
          }));
        }
      } catch (error) {
        if (isMounted) {
          setDashboardState(prev => ({
            ...prev,
            error: error.message,
            loading: false
          }));
        }
      }

      if (isMounted) {
        timeoutId = setTimeout(updateDashboard, UPDATE_INTERVAL);
      }
    };

    setDashboardState(prev => ({ ...prev, loading: true }));
    updateDashboard();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      off(ref(database, "attendance"));
      off(ref(database, "users"));
    };
  }, [fetchDashboardData, timeFilter]); // Added timeFilter dependency

  const filteredEmployees = useMemo(() => {
    return metrics.employees
      .filter(employee => {
        if (activeTab === "All") return true;
        return employee.location === LOCATIONS[activeTab];
      });
  }, [metrics.employees, activeTab]);

  const locationMetrics = useMemo(() => {
    return activeTab === "All" ? metrics.total : metrics.perLocation[LOCATIONS[activeTab]];
  }, [metrics.total, metrics.perLocation, activeTab]);

  const handleTimeFilterChange = (type) => {
    setDashboardState(prev => ({
      ...prev,
      timeFilter: {
        type,
        dateRange: type === '24h' ? getDateRange() : prev.timeFilter.dateRange
      }
    }));
  };

  const handleDateRangeChange = (field, value) => {
    setDashboardState(prev => ({
      ...prev,
      timeFilter: {
        ...prev.timeFilter,
        dateRange: { ...prev.timeFilter.dateRange, [field]: value }
      }
    }));
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {error && (
        <div className="error-banner">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="dashboard-grid">
        <div className="quadrant quadrant-2">
          <nav className="quadrant-nav">
            <ul>
              {Object.keys(LOCATIONS).map((tabName) => (
                <li
                  key={tabName}
                  onClick={() => setDashboardState(prev => ({...prev, activeTab: tabName}))}
                  className={`nav-item ${activeTab === tabName ? 'active' : ''}`}
                >
                  {tabName}
                </li>
              ))}
            </ul>
          </nav>

          <div className="filter-options">
            <button 
              onClick={() => handleTimeFilterChange('24h')}
              className={`filter-btn ${timeFilter.type === '24h' ? 'active' : ''}`}
            >
              <Clock className="h-4 w-4 mr-2" />
              Last 24 Hours
            </button>
            <button 
              onClick={() => handleTimeFilterChange('range')}
              className={`filter-btn ${timeFilter.type === 'range' ? 'active' : ''}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Date Range
            </button>
            
            {timeFilter.type === 'range' && (
              <div className="date-range-inputs">
                <input
                  type="date"
                  value={timeFilter.dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="date-input"
                  max={timeFilter.dateRange.end || undefined}
                />
                <input
                  type="date"
                  value={timeFilter.dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="date-input"
                  min={timeFilter.dateRange.start || undefined}
                />
              </div>
            )}
          </div>

          <div className="quadrant-inside">
            <div className="metrics-grid grid-cols-2">
              <div className="metric-box">
                <h3>Clocked In</h3>
                <div className="metric-content">
                  <p className="metric-number success">
                    {locationMetrics?.clockedIn || 0}
                  </p>
                </div>
              </div>

              <div className="metric-box">
                <h3>Total Active Users</h3>
                <div className="metric-content">
                  <p className="metric-number large text-blue-400">
                    {locationMetrics?.totalMembers || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="quadrant quadrant-3">
          <h3 className="rank-header">Attendance History</h3>
          <div className="employees-list overflow-auto max-h-[calc(100vh-240px)]">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <div key={`${employee.id}-${employee.clockInTime}`} 
                  className="bg-opacity-20 bg-gray-800 backdrop-blur-sm rounded-lg shadow-sm p-4 mb-3 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-500 bg-opacity-20 p-2 rounded-full">
                        <User className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{employee.name}</h4>
                        <p className="text-sm text-gray-300">
                          {employee.location.replace('Agua Viva ', '')} • {employee.position}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-300">
                        {new Date(employee.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-white">
                        {new Date(employee.clockInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {employee.clockOutTime && (
                        <div className="text-sm text-gray-300">
                          Out: {new Date(employee.clockOutTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                No attendance records for this period
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
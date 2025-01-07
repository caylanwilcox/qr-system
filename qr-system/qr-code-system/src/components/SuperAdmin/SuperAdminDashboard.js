import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue } from "firebase/database";
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle, CheckCircle2, Clock, User, TrendingUp, TrendingDown } from 'lucide-react';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
    perLocation: {},
    employees: [],
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("All");
  const [timeFilter, setTimeFilter] = useState({
    type: '24h',
    dateRange: { start: '', end: '' }
  });

  const locationMap = {
    "All": "All",
    "Aurora": "Aurora",
    "Elgin": "Agua Viva Elgin R7",
    "Joliet": "Agua Viva Joliet",
    "Lyons": "Agua Viva Lyons",
    "West Chicago": "Agua Viva West Chicago",
    "Wheeling": "Agua Viva Wheeling",
    "Retreat": "Retreat",

  };

  const calculateFraction = useCallback((numerator, denominator) => {
    if (!denominator) return 0;
    const result = (numerator / denominator) * 100;
    return isNaN(result) ? 0 : result;
  }, []);

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setError(null);
  };

  const handleTimeFilterChange = (type) => {
    setTimeFilter(prev => ({
      ...prev,
      type,
      dateRange: type === '24h' ? { start: '', end: '' } : prev.dateRange
    }));
  };

  const handleDateRangeChange = (field, value) => {
    setTimeFilter(prev => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value }
    }));
  };

  const validateDateRange = useCallback(() => {
    const { start, end } = timeFilter.dateRange;
    if (timeFilter.type === 'range' && (!start || !end)) {
      throw new Error('Please select both start and end dates');
    }
    if (start && end && new Date(start) > new Date(end)) {
      throw new Error('Start date must be before end date');
    }
  }, [timeFilter]);

  const processAttendanceMetrics = useCallback((data, metrics) => {
    Object.entries(data).forEach(([location, locationData]) => {
      if (!locationData) return;

      metrics.perLocation[location] = {
        notClockedIn: 0,
        clockedIn: 0,
        onTime: 0,
        late: 0
      };

      Object.values(locationData).forEach((record) => {
        // Update location metrics
        if (record.present) {
          metrics.perLocation[location].clockedIn++;
          metrics.total.clockedIn++;
          
          if (record.onTime) {
            metrics.perLocation[location].onTime++;
            metrics.total.onTime++;
          } else {
            metrics.perLocation[location].late++;
            metrics.total.late++;
          }
        } else {
          metrics.perLocation[location].notClockedIn++;
          metrics.total.notClockedIn++;
        }
      });
    });
    return metrics;
  }, []);

  const isWithinTimeFilter = useCallback((timestamp) => {
    if (!timestamp) return false;
    
    if (timeFilter.type === '24h') {
      const now = new Date();
      return now - new Date(timestamp) <= 24 * 60 * 60 * 1000;
    }
    
    if (timeFilter.type === 'range') {
      const date = new Date(timestamp);
      return date >= new Date(timeFilter.dateRange.start) &&
             date <= new Date(timeFilter.dateRange.end);
    }
    
    return false;
  }, [timeFilter]);

  useEffect(() => {
    let isMounted = true;
    const attendanceRef = ref(database, "attendance");
    const usersRef = ref(database, "users");
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        validateDateRange();
        
        // Fetch users data
        const unsubscribeUsers = onValue(usersRef, (snapshot) => {
          if (!isMounted) return;
          
          const usersData = snapshot.val();
          const employeeList = [];

          if (usersData) {
            Object.entries(usersData).forEach(([userId, userData]) => {
              if (!userData || !userData.name || userData.status?.toLowerCase() !== 'active') return;

              const stats = userData.stats || {};
              const currentLocation = userData.locationHistory?.[0]?.locationId || 'Unknown';
              
              employeeList.push({
                id: userId,
                name: userData.name,
                position: userData.position || 'Member',
                location: currentLocation,
                stats: {
                  daysPresent: stats.daysPresent || 0,
                  daysAbsent: stats.daysAbsent || 0,
                  daysLate: stats.daysLate || 0,
                  rank: stats.rank || 0,
                  rankChange: stats.lastRankChange ? {
                    direction: stats.lastRankChange.direction,
                    date: new Date(stats.lastRankChange.date)
                  } : null,
                  attendanceRate: stats.daysPresent && (stats.daysPresent + stats.daysAbsent) > 0
                    ? ((stats.daysPresent / (stats.daysPresent + stats.daysAbsent)) * 100).toFixed(1)
                    : 0,
                  onTimeRate: stats.daysPresent > 0
                    ? (((stats.daysPresent - stats.daysLate) / stats.daysPresent) * 100).toFixed(1)
                    : 0
                }
              });
            });
          }

          setMetrics(prev => ({
            ...prev,
            employees: employeeList
          }));
        });

        // Fetch attendance data
        const unsubscribeAttendance = onValue(attendanceRef, (snapshot) => {
          if (!isMounted) return;
          
          try {
            const data = snapshot.val();
            if (!data) throw new Error("No attendance data available");

            const metrics = {
              total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
              perLocation: {},
            };

            const activeDatabaseKey = locationMap[activeTab];
            const filteredData = activeDatabaseKey === "All" 
              ? data 
              : { [activeDatabaseKey]: data[activeDatabaseKey] };

            processAttendanceMetrics(filteredData, metrics);

            setMetrics(prev => ({
              ...prev,
              total: metrics.total,
              perLocation: metrics.perLocation,
            }));
            setError(null);
          } catch (error) {
            console.error("Error processing attendance data:", error);
            setError(error.message);
          } finally {
            setLoading(false);
          }
        });

        return () => {
          unsubscribeUsers();
          unsubscribeAttendance();
        };
      } catch (error) {
        if (isMounted) {
          setError(error.message);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [activeTab, timeFilter, processAttendanceMetrics, isWithinTimeFilter, validateDateRange, locationMap]);

  const filteredEmployees = useMemo(() => {
    return metrics.employees.filter(employee => {
      if (activeTab === "All") return true;
      return employee.location === locationMap[activeTab];
    });
  }, [metrics.employees, activeTab, locationMap]);

  const locationMetrics = activeTab === "All" ? null : metrics.perLocation[locationMap[activeTab]];

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
              {Object.keys(locationMap).map((tabName) => (
                <li
                  key={tabName}
                  onClick={() => handleTabClick(tabName)}
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
            <div className="metric-box total-absent">
              <h3>{activeTab === "All" ? "Total Absent" : `${activeTab} - Total Absent`}</h3>
              <div className="metric-content">
                <p className="metric-number large warning">
                  {activeTab === "All" 
                    ? metrics.total.notClockedIn 
                    : locationMetrics?.notClockedIn || 0}
                </p>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-box">
                <h3>Total Present</h3>
                <div className="metric-content">
                  <p className="metric-number success">
                    {activeTab === "All" 
                      ? metrics.total.clockedIn 
                      : locationMetrics?.clockedIn || 0}
                  </p>
                </div>
              </div>
              
              <div className="metric-box">
                <h3>% On Time</h3>
                <div className="metric-content">
                  <p className="metric-number success">
                    {calculateFraction(
                      activeTab === "All" ? metrics.total.onTime : locationMetrics?.onTime || 0,
                      activeTab === "All" ? metrics.total.clockedIn : locationMetrics?.clockedIn || 0
                    ).toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="metric-box">
                <h3>% Late</h3>
                <div className="metric-content">
                  <p className="metric-number warning">
                    {calculateFraction(
                      activeTab === "All" ? metrics.total.late : locationMetrics?.late || 0,
                      activeTab === "All" ? metrics.total.clockedIn : locationMetrics?.clockedIn || 0
                    ).toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="metric-box">
                <h3>% Present</h3>
                <div className="metric-content">
                  <p className="metric-number success">
                    {calculateFraction(
                      activeTab === "All" ? metrics.total.clockedIn : locationMetrics?.clockedIn || 0,
                      activeTab === "All"
                        ? metrics.total.clockedIn + metrics.total.notClockedIn
                        : (locationMetrics?.clockedIn || 0) + (locationMetrics?.notClockedIn || 0)
                    ).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="quadrant quadrant-3">
          <h3 className="rank-header">Active Employees</h3>
          <div className="employees-list overflow-auto max-h-[calc(100vh-240px)]">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} 
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
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-300">Attendance</div>
                      <div className={`text-sm font-bold ${
                        Number(employee.stats.attendanceRate) >= 75 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {employee.stats.attendanceRate}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-300">On Time</div>
                      <div className={`text-sm font-bold ${
                        Number(employee.stats.onTimeRate) >= 90 ? 'text-green-400' :
                        Number(employee.stats.onTimeRate) >= 75 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {employee.stats.onTimeRate}%
                      </div>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm font-medium text-gray-300">Rank</div>
                      <div className="flex items-center justify-end space-x-1">
                        <span className="text-sm font-bold text-white">
                          {employee.stats.rank}
                        </span>
                        {employee.stats.rankChange && 
                         new Date().getTime() - employee.stats.rankChange.date.getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                          employee.stats.rankChange.direction === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard
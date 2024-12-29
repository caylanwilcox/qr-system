import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue } from "firebase/database";
import { database } from '../services/firebaseConfig';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
    perLocation: {},
    rankingUp: [],
    ranksByLocation: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("All");
  const [timeFilter, setTimeFilter] = useState({
    type: '24h',
    dateRange: { start: '', end: '' }
  });
  const [isDataFetched, setIsDataFetched] = useState(false);

  const locationMap = {
    "All": "All",
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
    // Reset error state when changing tabs
    setError(null);
  };

  const handleTimeFilterChange = (type) => {
    setTimeFilter(prev => ({
      ...prev,
      type,
      // Reset date range when switching to 24h
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

  const processEmployeeMetrics = useCallback((employee, location, metrics) => {
    try {
      if (employee.daysScheduledPresent > 0 || employee.daysScheduledMissed > 0) {
        // Update total metrics
        metrics.total.notClockedIn += employee.daysScheduledMissed || 0;
        metrics.total.clockedIn += employee.daysScheduledPresent || 0;
        metrics.total.onTime += employee.daysOnTime || 0;
        metrics.total.late += employee.daysLate || 0;

        // Update per-location metrics
        metrics.perLocation[location] = metrics.perLocation[location] || {
          notClockedIn: 0,
          clockedIn: 0,
          onTime: 0,
          late: 0
        };
        metrics.perLocation[location].notClockedIn += employee.daysScheduledMissed || 0;
        metrics.perLocation[location].clockedIn += employee.daysScheduledPresent || 0;
        metrics.perLocation[location].onTime += employee.daysOnTime || 0;
        metrics.perLocation[location].late += employee.daysLate || 0;
      }

      if (employee.rankUp) {
        metrics.rankingUp.push({ name: employee.name, location });
      }

      if (employee.position) {
        metrics.ranksByLocation[location] = metrics.ranksByLocation[location] || {};
        metrics.ranksByLocation[location][employee.position] =
          (metrics.ranksByLocation[location][employee.position] || 0) + 1;
      }

    } catch (error) {
      console.error(`Error processing metrics for employee in ${location}:`, error);
      throw new Error(`Failed to process employee metrics for ${location}`);
    }
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
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        validateDateRange();
        
        const unsubscribe = onValue(attendanceRef, (snapshot) => {
          if (!isMounted) return;
          
          try {
            const data = snapshot.val();
            if (!data) throw new Error("No attendance data available");

            const metrics = {
              total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
              perLocation: {},
              rankingUp: [],
              ranksByLocation: {},
            };

            const activeDatabaseKey = locationMap[activeTab];
            const filteredData = activeDatabaseKey === "All" 
              ? data 
              : { [activeDatabaseKey]: data[activeDatabaseKey] };

            Object.entries(filteredData).forEach(([location, locationData]) => {
              if (!locationData) return;

              Object.values(locationData).forEach((employee) => {
                if (isWithinTimeFilter(employee.clockInTime)) {
                  processEmployeeMetrics(employee, location, metrics);
                }
              });
            });

            setMetrics(metrics);
            setIsDataFetched(true);
            setError(null);
          } catch (error) {
            console.error("Error processing attendance data:", error);
            setError(error.message);
          } finally {
            setLoading(false);
          }
        }, (error) => {
          console.error("Database error:", error);
          if (isMounted) {
            setError("Failed to connect to the database. Please try again later.");
            setLoading(false);
          }
        });

        return () => {
          unsubscribe();
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
  }, [activeTab, timeFilter, processEmployeeMetrics, isWithinTimeFilter, validateDateRange, locationMap]);

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
                <h3>Total Clocked In</h3>
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
          <h3 className="rank-header">Employee Rankings</h3>
          <div className="employee-ranks">
            {Object.entries(metrics.ranksByLocation).map(([location, ranks]) => (
              <div key={location} className="location-rank-card">
                <h4>{location}</h4>
                <div className="rank-stats">
                  <div className="rank-item">
                    <span className="rank-label">Junior:</span>
                    <span className="rank-value">{ranks.junior || 0}</span>
                  </div>
                  <div className="rank-item">
                    <span className="rank-label">Intermediate:</span>
                    <span className="rank-value">{ranks.intermediate || 0}</span>
                  </div>
                  <div className="rank-item">
                    <span className="rank-label">Senior:</span>
                    <span className="rank-value">{ranks.senior || 0}</span>
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

export default Dashboard;
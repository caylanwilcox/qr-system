import React, { useState, useEffect } from 'react';
import { ref, onValue } from "firebase/database"; 
import { database } from '../services/firebaseConfig'; 
import './Dashboard.css';
import AttendanceChart from './AttendanceChart';

const Dashboard = () => {
  const [totalNotClockedIn, setTotalNotClockedIn] = useState(0);
  const [totalClockedIn, setTotalClockedIn] = useState(0);
  const [onTimeFraction, setOnTimeFraction] = useState(0);
  const [lateFraction, setLateFraction] = useState(0);
  const [presentFraction, setPresentFraction] = useState(0);
  const [rankingUpEmployees, setRankingUpEmployees] = useState([]);
  const [employeeRanksByLocation, setEmployeeRanksByLocation] = useState({});
  const [perLocationMetrics, setPerLocationMetrics] = useState({});
  const [activeTab, setActiveTab] = useState("All");
  const [is24Hours, setIs24Hours] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const locationMap = {
    "All": "All",
    "Elgin": "Agua Viva Elgin R7",
    "Joliet": "Agua Viva Joliet",
    "Lyons": "Agua Viva Lyons",
    "West Chicago": "Agua Viva West Chicago",
    "Wheeling": "Agua Viva Wheeling",
    "Retreat": "Retreat", // Add Retreat here
    
  };

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  const calculateFraction = (numerator, denominator) => (denominator ? numerator / denominator : 0);

  const processEmployeeMetrics = (employee, location, metrics) => {
    if (employee.daysScheduledPresent > 0 || employee.daysScheduledMissed > 0) {
      // Update total metrics
      metrics.total.notClockedIn += employee.daysScheduledMissed || 0;
      metrics.total.clockedIn += employee.daysScheduledPresent || 0;
      metrics.total.onTime += employee.daysOnTime || 0;
      metrics.total.late += employee.daysLate || 0;

      // Update per-location metrics
      metrics.perLocation[location].notClockedIn += employee.daysScheduledMissed || 0;
      metrics.perLocation[location].clockedIn += employee.daysScheduledPresent || 0;
      metrics.perLocation[location].onTime += employee.daysOnTime || 0;
      metrics.perLocation[location].late += employee.daysLate || 0;
    }

    if (employee.rankUp) {
      metrics.rankingUp.push(employee.name);
    }

    if (employee.position) {
      metrics.ranksByLocation[location][employee.position] =
        (metrics.ranksByLocation[location][employee.position] || 0) + 1;
    }
  };

  const safelyUpdateState = (metrics) => {
    const { total, perLocation, rankingUp, ranksByLocation } = metrics;

    setTotalNotClockedIn(total.notClockedIn);
    setTotalClockedIn(total.clockedIn);
    setOnTimeFraction(calculateFraction(total.onTime, total.clockedIn));
    setLateFraction(calculateFraction(total.late, total.clockedIn));
    setPresentFraction(calculateFraction(total.clockedIn, total.notClockedIn + total.clockedIn));
    setRankingUpEmployees([...new Set(rankingUp)]); // Remove duplicates
    setEmployeeRanksByLocation(ranksByLocation);
    setPerLocationMetrics(perLocation);
  };

  const isWithinLast24Hours = (timestamp) => {
    const now = new Date();
    return is24Hours && now - timestamp <= 24 * 60 * 60 * 1000;
  };

  const isWithinDateRange = (timestamp) => {
    return !is24Hours &&
      dateRange.start &&
      dateRange.end &&
      timestamp >= new Date(dateRange.start) &&
      timestamp <= new Date(dateRange.end);
  };

  useEffect(() => {
    const attendanceRef = ref(database, "attendance");
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) throw new Error("No data available");

        const metrics = {
          total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
          perLocation: {},
          rankingUp: [],
          ranksByLocation: {},
        };

        const activeDatabaseKey = locationMap[activeTab] || null;
        const filteredData =
          activeDatabaseKey === "All" ? data : { [activeDatabaseKey]: data[activeDatabaseKey] };
        
        Object.entries(filteredData).forEach(([location, locationData]) => {
          if (!metrics.ranksByLocation[location]) {
            metrics.ranksByLocation[location] = { junior: 0, intermediate: 0, senior: 0 };
          }
          if (!metrics.perLocation[location]) {
            metrics.perLocation[location] = { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 };
          }

          Object.values(locationData).forEach((employee) => {
            const employeeTimestamp = new Date(employee.clockInTime);

            if (isWithinLast24Hours(employeeTimestamp) || isWithinDateRange(employeeTimestamp)) {
              processEmployeeMetrics(employee, location, metrics);
            }
          });
        });

        safelyUpdateState(metrics);
      } catch (error) {
        console.error("Error processing attendance data:", error);
      }
    });

    return () => unsubscribe();
  }, [is24Hours, dateRange, activeTab]);

  const getPerLocationFraction = (locationMetrics, numeratorKey, denominatorKey) => {
    const numerator = locationMetrics?.[numeratorKey] || 0;
    const denominator = locationMetrics?.[denominatorKey] || 0;
    return calculateFraction(numerator, denominator);
  };

  const perLocationPresentFraction = (locationMetrics) => {
    const clockedIn = locationMetrics?.clockedIn || 0;
    const notClockedIn = locationMetrics?.notClockedIn || 0;
    return calculateFraction(clockedIn, clockedIn + notClockedIn);
  };

  const locationMetrics = activeTab === "All" ? null : perLocationMetrics[locationMap[activeTab]] || {};

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Quadrant 2 (Top Left) */}
        <div className="quadrant quadrant-2">
          <nav className="quadrant-nav">
            <ul>
              {["All", "Elgin", "Joliet", "Lyons", "West Chicago", "Wheeling", "Retreat"].map((tabName) => (
                <li
                  key={tabName}
                  onClick={() => handleTabClick(tabName)}
                  className={activeTab === tabName ? "active" : ""}
                >
                  {tabName}
                </li>
              ))}
            </ul>
          </nav>

          <div className="filter-options">
            <button onClick={() => setIs24Hours(true)} className={is24Hours ? 'active' : ''}>
              Last 24 Hours
            </button>
            <button onClick={() => setIs24Hours(false)} className={!is24Hours ? 'active' : ''}>
              Date Range
            </button>
            {!is24Hours && (
              <div className="date-range-inputs">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="quadrant-inside">
            {activeTab === "All" ? (
              <div className="metric-box available-agents">
                <h3>Total Absent</h3>
                <div className="metric-content">
                  <p className="metric-number large orange">{totalNotClockedIn}</p>
                </div>
              </div>
            ) : (
              <div className="metric-box available-agents">
                <h3>{activeTab} - Total Absent</h3>
                <div className="metric-content">
                  <p className="metric-number large orange">{locationMetrics?.notClockedIn || 0}</p>
                </div>
              </div>
            )}

            <div className="remaining-metrics">
              <div className="metric-box">
                <h3>Total Clocked In</h3>
                <div className="metric-content">
                  <p className="metric-number green">{activeTab === "All" ? totalClockedIn : locationMetrics?.clockedIn || 0}</p>
                </div>
              </div>
              <div className="metric-box">
                <h3>% On Time</h3>
                <div className="metric-content">
                  <p className="metric-number green">
                    {activeTab === "All"
                      ? (onTimeFraction * 100).toFixed(2)
                      : (calculateFraction(locationMetrics.onTime, locationMetrics.clockedIn) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="metric-box">
                <h3>% Late</h3>
                <div className="metric-content">
                  <p className="metric-number orange">
                    {activeTab === "All"
                      ? (lateFraction * 100).toFixed(2)
                      : (calculateFraction(locationMetrics.late, locationMetrics.clockedIn) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="metric-box">
                <h3>% Present</h3>
                <div className="metric-content">
                  <p className="metric-number green">
                    {activeTab === "All"
                      ? (presentFraction * 100).toFixed(2)
                      : (perLocationPresentFraction(locationMetrics) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

   

        <div className="quadrant quadrant-3 full-height">
          <h3 className="employee-ranks-header">Rank</h3>
          <div className="employee-ranks">
            {Object.keys(employeeRanksByLocation).map((location) => (
              <div key={location} className="location-rank">
                <h4>{location}</h4>
                <p>Junior: {employeeRanksByLocation[location].junior}</p>
                <p>Intermediate: {employeeRanksByLocation[location].intermediate}</p>
                <p>Senior: {employeeRanksByLocation[location].senior}</p>
              </div>
            ))}
          </div>
        </div>

      
        
    
      </div>
    </div>
  );
};

export default Dashboard;

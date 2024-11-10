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
  const [rankingUpEmployees, setRankingUpEmployees] = useState([]);
  const [employeeRanksByLocation, setEmployeeRanksByLocation] = useState({});
  const [activeTab, setActiveTab] = useState("All");

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  useEffect(() => {
    const attendanceRef = ref(database, 'attendance');
    onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let notClockedIn = 0;
        let clockedIn = 0;
        let onTime = 0;
        let late = 0;
        const rankingUp = [];
        const ranksByLocation = {};

        Object.keys(data).forEach((location) => {
          const locationData = data[location];
          if (!ranksByLocation[location]) {
            ranksByLocation[location] = { junior: 0, intermediate: 0, senior: 0 };
          }
          
          Object.values(locationData).forEach((employee) => {
            if (!employee.clockedIn) {
              notClockedIn++;
            } else {
              clockedIn++;
              if (employee.onTime) {
                onTime++;
              } else {
                late++;
              }
            }

            if (employee.rankUp) {
              rankingUp.push(employee.name);
            }

            if (employee.rank) {
              ranksByLocation[location][employee.rank]++;
            }
          });
        });

        setTotalNotClockedIn(notClockedIn);
        setTotalClockedIn(clockedIn);
        setOnTimeFraction(onTime / clockedIn);
        setLateFraction(late / clockedIn);
        setRankingUpEmployees(rankingUp);
        setEmployeeRanksByLocation(ranksByLocation);
      }
    });
  }, []);

  // Filter data based on activeTab
  const filteredData = activeTab === "All" ? null : employeeRanksByLocation[activeTab] || {};

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

          <div className="quadrant-inside">
            {/* Display based on the selected tab */}
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
                  <p className="metric-number large orange">{filteredData?.notClockedIn || 0}</p>
                </div>
              </div>
            )}

            <div className="remaining-metrics">
              <div className="metric-box">
                <h3>Total Clocked In</h3>
                <div className="metric-content">
                  <p className="metric-number green">{filteredData?.clockedIn || totalClockedIn}</p>
                </div>
              </div>
              <div className="metric-box">
                <h3>% On Time</h3>
                <div className="metric-content">
                  <p className="metric-number green">{((filteredData?.onTime || onTimeFraction) * 100).toFixed(2)}%</p>
                </div>
              </div>
              <div className="metric-box">
                <h3>% Late</h3>
                <div className="metric-content">
                  <p className="metric-number orange">{((filteredData?.late || lateFraction) * 100).toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quadrant 1 (Top Right) */}
        <div className="quadrant quadrant-1">
          <div className="large-box">
            <h3>Employee Skill Levels Distribution</h3>
            <AttendanceChart />
          </div>
        </div>

        {/* Quadrant 3 (Bottom Left) */}
        <div className="quadrant quadrant-3 full-height">
          <h3 className="employee-ranks-header">Employee Ranks Per Location</h3>
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

        {/* Quadrant 4 (Bottom Right) */}
        <div className="quadrant quadrant-4">
          <div className="chart-box">
            <h3>Employees Ranking Up This Week</h3>
            <div className="employee-list">
              {rankingUpEmployees.map((employee, index) => (
                <div key={index} className="employee">
                  <span>{employee}</span>
                  <span className="rank">Rank Up!</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

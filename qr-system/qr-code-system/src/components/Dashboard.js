import React from 'react';
import './Dashboard.css';
import AttendanceChart from './AttendanceChart'; // Import the new chart component

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Quadrant 2 (Top Left) */}
        <div className="quadrant quadrant-2">
          <div className="metric-box available-agents">
            <h3>Available Agents</h3>
            <div className="metric-content">
              <p className="metric-number large green">1</p>
            </div>
          </div>
          
          <div className="remaining-metrics">
            <div className="metric-box">
              <h3>Average Handling Time</h3>
              <div className="metric-content">
                <p className="metric-number green">03:45</p>
              </div>
            </div>
            <div className="metric-box">
              <h3>Answered Calls</h3>
              <div className="metric-content">
                <p className="metric-number">6</p>
              </div>
            </div>
            <div className="metric-box">
              <h3>Average Wait Time</h3>
              <div className="metric-content">
                <p className="metric-number orange">01:48</p>
              </div>
            </div>
            <div className="metric-box">
              <h3>Abandon Rate</h3>
              <div className="metric-content">
                <p className="metric-number green">6%</p>
              </div>
            </div>
          </div>
        </div>

       {/* Quadrant 1 (Top Right) */}
<div className="quadrant quadrant-1">
  <div className="large-box">
    <h3>SLA Month to Date</h3>
    <AttendanceChart />
  </div>
</div>


        {/* Quadrant 3 (Bottom Left) */}
        <div className="quadrant quadrant-3">
          <h3>Highest Ranking Employees</h3>
          <div className="employee-list">
            <div className="employee">
              <span>Mike Novak</span>
              <span className="rank">Rank: A+</span>
            </div>
            <div className="employee">
              <span>Jennifer Mata</span>
              <span className="rank">Rank: A</span>
            </div>
            {/* Add more employee listings as needed */}
          </div>
        </div>

        {/* Quadrant 4 (Bottom Right) */}
        <div className="quadrant quadrant-4">
          <div className="chart-box">
            <h3>Company Attendance Assessment</h3>
            <div className="chart-placeholder">[CSAT Chart Here]</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

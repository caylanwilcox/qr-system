// src/components/EmployeeProfile/StatsSection.js
import React from 'react';
import PropTypes from 'prop-types';
import { Activity, Clock, Calendar, TrendingUp } from 'lucide-react';

const getScoreClass = (score) => {
  if (score >= 95) return 'score-perfect';
  if (score >= 85) return 'score-high';
  if (score >= 75) return 'score-good';
  if (score >= 65) return 'score-medium';
  if (score >= 55) return 'score-below';
  if (score >= 45) return 'score-poor';
  return 'score-critical';
};

const StatsSection = ({ stats }) => {
  const statItems = [
    {
      icon: <Activity size={20} />,
      title: 'Attendance Rate',
      value: `${stats.attendanceRate}%`,
      scoreClass: getScoreClass(stats.attendanceRate),
      period: 'Last 30 Days'
    },
    {
      icon: <Clock size={20} />,
      title: 'On-Time Rate',
      value: `${stats.punctualityRate}%`,
      scoreClass: getScoreClass(stats.punctualityRate),
      period: 'Last 30 Days'
    },
    {
      icon: <Calendar size={20} />,
      title: 'Total Hours',
      value: `${stats.totalHours}h`,
      period: 'Month to Date'
    },
    {
      icon: <TrendingUp size={20} />,
      title: 'Average Hours/Day',
      value: `${stats.avgHoursPerDay}h`,
      period: 'Last 30 Days'
    }
  ];

  return (
    <div className="section glass-panel">
      <div className="section-header">
        <h2 className="section-title">Performance Statistics</h2>
      </div>
      <div className="stats-grid">
        {statItems.map((stat, index) => (
          <div key={index} className="stat-card glass-panel">
            <div className="stat-header">
              {stat.icon}
              <h3>{stat.title}</h3>
            </div>
            <p className={`stats-value ${stat.scoreClass || ''}`}>
              {stat.value}
            </p>
            <span className="stats-period">{stat.period}</span>
            {stat.scoreClass && (
              <div className={`trend-indicator ${stat.scoreClass}`}>
                {parseFloat(stat.value) >= 75 ? 'Good' : 
                 parseFloat(stat.value) >= 50 ? 'Average' : 'Needs Improvement'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Additional Stats and Trends */}
      <div className="trends-section">
        <div className="monthly-comparison glass-panel">
          <h4>Monthly Comparison</h4>
          <div className="comparison-grid">
            <div className="comparison-item">
              <span>Previous Month</span>
              <strong>{stats.previousMonthHours || '0'}h</strong>
            </div>
            <div className="comparison-item">
              <span>Current Month</span>
              <strong>{stats.totalHours}h</strong>
            </div>
            <div className="comparison-item">
              <span>Change</span>
              <strong className={
                stats.hoursChange > 0 ? 'text-green-500' : 
                stats.hoursChange < 0 ? 'text-red-500' : ''
              }>
                {stats.hoursChange > 0 ? '+' : ''}
                {stats.hoursChange || '0'}%
              </strong>
            </div>
          </div>
        </div>

        <div className="attendance-insights glass-panel">
          <h4>Quick Insights</h4>
          <div className="insights-list">
            {/* Perfect Attendance Streak */}
            {stats.perfectStreak > 0 && (
              <div className="insight-item">
                <Activity size={16} />
                <span>
                  {stats.perfectStreak} day{stats.perfectStreak !== 1 ? 's' : ''} perfect attendance streak
                </span>
              </div>
            )}
            
            {/* Early Arrival Rate */}
            {stats.earlyArrivalRate && (
              <div className="insight-item">
                <Clock size={16} />
                <span>
                  Arrives early {stats.earlyArrivalRate}% of the time
                </span>
              </div>
            )}

            {/* Most Active Day */}
            {stats.mostActiveDay && (
              <div className="insight-item">
                <Calendar size={16} />
                <span>
                  Most active on {stats.mostActiveDay}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

StatsSection.propTypes = {
  stats: PropTypes.shape({
    attendanceRate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    punctualityRate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    totalHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    avgHoursPerDay: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    previousMonthHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hoursChange: PropTypes.number,
    perfectStreak: PropTypes.number,
    earlyArrivalRate: PropTypes.number,
    mostActiveDay: PropTypes.string,
  }).isRequired,
};

export default StatsSection;
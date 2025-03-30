'use client';

import React from 'react';
import { useNavigate } from 'react-router-dom';

const AttendanceMetrics = ({ metrics, calculateFraction, timeFilter }) => {
  const navigate = useNavigate();

  // Safely calculate the on-time percentage
  const calculateOnTimePercentage = () => {
    if (!metrics || !metrics.total || !metrics.total.clockedIn) return '0.0';
    const result = calculateFraction(metrics.total.onTime, metrics.total.clockedIn);
    return result !== null ? result.toFixed(1) : '0.0';
  };

  // Simplified date handling - use the date directly from metrics
  const getFilterDate = () => {
    if (!metrics || !metrics.date) {
      // Fallback to today only if no date in metrics
      return new Date().toISOString().split('T')[0];
    }
    return metrics.date;
  };

  // Handler for absent users
  const handleAbsentClick = () => {
    const date = getFilterDate();
    console.log(`Filtering for absent employees on date: ${date}`);
    console.log(`Metrics shows ${metrics.total.notClockedIn} absent employees`);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'absent', 
        date: date,
        count: metrics.total.notClockedIn // Pass the expected count for debugging
      } 
    });
  };

  // Handler for present users
  const handlePresentClick = () => {
    const date = getFilterDate();
    console.log(`Filtering for present employees on date: ${date}`);
    console.log(`Metrics shows ${metrics.total.clockedIn} present employees`);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'present', 
        date: date,
        count: metrics.total.clockedIn // Pass the expected count for debugging
      } 
    });
  };

  // Handler for late users
  const handleLateClick = () => {
    const date = getFilterDate();
    console.log(`Filtering for late employees on date: ${date}`);
    console.log(`Metrics shows ${metrics.total.late} late employees`);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'late', 
        date: date,
        count: metrics.total.late // Pass the expected count for debugging
      } 
    });
  };

  // Handler for on-time users
  const handleOnTimeClick = () => {
    const date = getFilterDate();
    console.log(`Filtering for on-time employees on date: ${date}`);
    console.log(`Metrics shows ${metrics.total.onTime} on-time employees`);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'onTime', 
        date: date,
        count: metrics.total.onTime // Pass the expected count for debugging
      } 
    });
  };

  // Debug logging when metrics change
  React.useEffect(() => {
    if (metrics) {
      console.log('AttendanceMetrics received updated metrics');
    }
  }, [metrics]);

  if (!metrics || !metrics.total) {
    return <div className="attendance-metrics">Loading metrics...</div>;
  }

  return (
    <div className="attendance-metrics">
      <div 
        className="metric-box total-absent"
        style={{ cursor: 'pointer' }}
        onClick={handleAbsentClick}
      >
        <h3>Faltantes Totales</h3>
        <p className="metric-number warning">{metrics.total.notClockedIn}</p>
      </div>
      
      <div className="metrics-subgrid">
        <div 
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={handlePresentClick}
        >
          <h3>Presentes Totales</h3>
          <p className="metric-number success">
            {metrics.total.clockedIn}
          </p>
        </div>
        
        <div 
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={handleLateClick}
        >
          <h3>Tardes</h3>
          <p className="metric-number warning">
            {metrics.total.late}
          </p>
        </div>
        
        <div 
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={handleOnTimeClick}
        >
          <h3>% A Tiempo</h3>
          <p className="metric-number success">
            {calculateOnTimePercentage()}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMetrics;
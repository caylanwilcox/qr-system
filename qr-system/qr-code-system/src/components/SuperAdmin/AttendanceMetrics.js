'use client';
import React from 'react';

const AttendanceMetrics = ({ metrics, calculateFraction, onMetricClick }) => {
  return (
    <div className="attendance-metrics">
      {/* Faltantes Totales => clickable */}
      <div
        className="metric-box total-absent"
        style={{ cursor: 'pointer' }}
        onClick={onMetricClick}
      >
        <h3>Faltantes Totales</h3>
        <p className="metric-number warning">{metrics.total.notClockedIn}</p>
      </div>

      <div className="metrics-subgrid">
        <div
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={onMetricClick}
        >
          <h3>Presentes Totales</h3>
          <p className="metric-number success">
            {metrics.total.clockedIn}
          </p>
        </div>

        <div
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={onMetricClick}
        >
          <h3>Tardes</h3>
          <p className="metric-number warning">
            {metrics.total.late}
          </p>
        </div>

        <div
          className="metric-box"
          style={{ cursor: 'pointer' }}
          onClick={onMetricClick}
        >
          <h3>% A Tiempo</h3>
          <p className="metric-number success">
            {calculateFraction(metrics.total.onTime, metrics.total.clockedIn).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMetrics;

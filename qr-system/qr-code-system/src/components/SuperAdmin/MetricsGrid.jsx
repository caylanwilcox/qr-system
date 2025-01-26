'use client';
import React from 'react';
import './MetricsGrid.css'; // or reuse SuperAdminDashboard.css

function MetricsGrid({
  metrics,
  activeFilter,
  handleColorClick
}) {
  return (
    <div className="metrics-grid">
      <div className="metric-box">
        <h3>TOTAL DE MIEMBROS DEL GRUPO</h3>
        <p className="metric-number">{metrics.overview.totalMembers}</p>
      </div>

      <div className="metric-box padrinos-box">
        <h3>TOTAL DE PADRINOS POR RANKING</h3>
        <div className="padrinos-grid">
          <div
            className={`padrino-item blue ${activeFilter === 'padrinosBlue' ? 'active' : ''}`}
            onClick={() => handleColorClick('padrinosBlue')}
          >
            <span>Blue</span>
            <span>{metrics.overview.padrinosBlue}</span>
          </div>
          <div
            className={`padrino-item green ${activeFilter === 'padrinosGreen' ? 'active' : ''}`}
            onClick={() => handleColorClick('padrinosGreen')}
          >
            <span>Green</span>
            <span>{metrics.overview.padrinosGreen}</span>
          </div>
          <div
            className={`padrino-item red ${activeFilter === 'padrinosRed' ? 'active' : ''}`}
            onClick={() => handleColorClick('padrinosRed')}
          >
            <span>Red</span>
            <span>{metrics.overview.padrinosRed}</span>
          </div>
          <div
            className={`padrino-item orange ${activeFilter === 'padrinosOrange' ? 'active' : ''}`}
            onClick={() => handleColorClick('padrinosOrange')}
          >
            <span>Orange</span>
            <span>{metrics.overview.padrinosOrange}</span>
          </div>
        </div>
      </div>

      <div className="metric-box">
        <h3>TOTAL DE OREJAS</h3>
        <p className="metric-number">{metrics.overview.totalOrejas}</p>
      </div>

      <div className="metric-box">
        <h3>TOTAL DE APOYOS</h3>
        <p className="metric-number">{metrics.overview.totalApoyos}</p>
      </div>

      <div className="metric-box">
        <h3>PROMEDIO DE ASISTENCIA MENSUAL</h3>
        <p className="metric-number">{metrics.overview.monthlyAttendance.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export default MetricsGrid;

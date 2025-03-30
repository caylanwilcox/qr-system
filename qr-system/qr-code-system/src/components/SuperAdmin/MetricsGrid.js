'use client';

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MetricsGrid.css'; // optional if you need custom classes

const MetricsGrid = ({ metrics, activeFilter, onColorClick }) => {
  const navigate = useNavigate();

  // Handlers for different metric types
  const handleTotalMembersClick = () => {
    // Navigate to employee list with all members filter
    navigate('/employee-list', { state: { filter: 'all' } });
  };

  const handleOrejasClick = () => {
    // Navigate to employee list with Orejas filter
    navigate('/employee-list', { state: { filter: 'RSG' } });
  };

  const handleApoyosClick = () => {
    // Navigate to employee list with Apoyos filter
    navigate('/employee-list', { state: { filter: 'COM' } });
  };

  return (
    <div className="metrics-grid">
      {/* Metric Card: Total Members (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleTotalMembersClick}
      >
        <h3 className="metric-title">TOTAL DE MIEMBROS DEL GRUPO</h3>
        <p className="metric-number">{metrics.overview.totalMembers}</p>
      </div>

      {/* Metric Card: Padrinos (partially clickable for color filters, as before) */}
      <div className="metric-box padrinos-box">
        <h3 className="metric-title">TOTAL DE PADRINOS POR RANKING</h3>
        <div className="padrinos-grid">
          <div
            className={`padrino-item blue ${
              activeFilter === 'padrinosBlue' ? 'active' : ''
            }`}
            onClick={() => onColorClick('padrinosBlue')}
          >
            <span>Blue</span>
            <span>{metrics.overview.padrinosBlue}</span>
          </div>
          <div
            className={`padrino-item green ${
              activeFilter === 'padrinosGreen' ? 'active' : ''
            }`}
            onClick={() => onColorClick('padrinosGreen')}
          >
            <span>Green</span>
            <span>{metrics.overview.padrinosGreen}</span>
          </div>
          <div
            className={`padrino-item red ${
              activeFilter === 'padrinosRed' ? 'active' : ''
            }`}
            onClick={() => onColorClick('padrinosRed')}
          >
            <span>Red</span>
            <span>{metrics.overview.padrinosRed}</span>
          </div>
          <div
            className={`padrino-item orange ${
              activeFilter === 'padrinosOrange' ? 'active' : ''
            }`}
            onClick={() => onColorClick('padrinosOrange')}
          >
            <span>Orange</span>
            <span>{metrics.overview.padrinosOrange}</span>
          </div>
        </div>
      </div>

      {/* Metric Card: Orejas (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleOrejasClick}
      >
        <h3 className="metric-title">TOTAL DE OREJAS</h3>
        <p className="metric-number">{metrics.overview.totalOrejas}</p>
      </div>

      {/* Metric Card: Apoyos (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleApoyosClick}
      >
        <h3 className="metric-title">TOTAL DE APOYOS</h3>
        <p className="metric-number">{metrics.overview.totalApoyos}</p>
      </div>
    </div>
  );
};

export default MetricsGrid;
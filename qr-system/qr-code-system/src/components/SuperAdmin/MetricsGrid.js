import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MetricsGrid.css'; // optional if you need custom classes

const MetricsGrid = ({ metrics, activeFilter, onColorClick, activeTab }) => {
  const navigate = useNavigate();
  
  // Handlers for different metric types that respects current location filter
  const handleTotalMembersClick = () => {
    // Navigate to employee list with current location as filter
    // If we have a color filter active, pass that too
    navigate('/employee-list', { 
      state: { 
        filter: activeFilter ? `padrinos${activeFilter}` : 'all',
        location: activeTab !== 'All' ? activeTab : null
      } 
    });
  };
  
  const handleOrejasClick = () => {
    // Navigate to employee list with Orejas filter and current location
    // If there's a color filter active, include it as well
    navigate('/employee-list', { 
      state: { 
        filter: 'RSG',
        location: activeTab !== 'All' ? activeTab : null,
        color: activeFilter || null  // Pass color filter separately
      } 
    });
  };
  
  const handleApoyosClick = () => {
    // Navigate to employee list with Apoyos filter and current location
    // If there's a color filter active, include it as well
    navigate('/employee-list', { 
      state: { 
        filter: 'COM',
        location: activeTab !== 'All' ? activeTab : null,
        color: activeFilter || null  // Pass color filter separately
      } 
    });
  };
  
  // Add null check for metrics to prevent errors
  if (!metrics || !metrics.overview) {
    return <div className="metrics-grid">Loading metrics...</div>;
  }
  
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
      
      {/* Metric Card: Padrinos (partially clickable for color filters) */}
      <div className="metric-box padrinos-box">
        <h3 className="metric-title">TOTAL DE PADRINOS POR RANKING</h3>
        <div className="total-padrinos">Total: {metrics.overview.totalPadrinos || 0}</div>
        <div className="padrinos-grid">
          <div
            className={`padrino-item blue ${activeFilter === 'blue' ? 'active' : ''}`}
            onClick={() => onColorClick('blue')}
          >
            <span>Blue</span>
            <span>{metrics.overview.padrinosBlue}</span>
          </div>
          <div
            className={`padrino-item green ${activeFilter === 'green' ? 'active' : ''}`}
            onClick={() => onColorClick('green')}
          >
            <span>Green</span>
            <span>{metrics.overview.padrinosGreen}</span>
          </div>
          <div
            className={`padrino-item orange ${activeFilter === 'orange' ? 'active' : ''}`}
            onClick={() => onColorClick('orange')}
          >
            <span>Orange</span>
            <span>{metrics.overview.padrinosOrange}</span>
          </div>
          <div
            className={`padrino-item red ${activeFilter === 'red' ? 'active' : ''}`}
            onClick={() => onColorClick('red')}
          >
            <span>Red</span>
            <span>{metrics.overview.padrinosRed}</span>
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
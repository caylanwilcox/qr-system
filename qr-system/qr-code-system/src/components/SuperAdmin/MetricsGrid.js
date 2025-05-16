import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MetricsGrid.css';

const MetricsGrid = ({ metrics, activeFilter, onColorClick, activeTab, locationMap }) => {
  const navigate = useNavigate();
  
  // Get the location key to pass to navigation
  const getLocationParam = () => {
    if (!activeTab || activeTab === 'All') return null;
    
    // Use the locationMap to get the correct key format
    const locationKey = locationMap?.[activeTab] || activeTab.toLowerCase().replace(/\s+/g, '');
    
    // Debug what's being passed
    console.log("MetricsGrid sending location:", locationKey);
    
    return locationKey;
  };
  
  // Handle click on Total Members box
  const handleTotalMembersClick = () => {
    const locationParam = getLocationParam();
    
    // Match the exact format that EmployeeList expects
    navigate('/employee-list', { 
      state: { 
        filter: activeFilter ? `padrinos${activeFilter}` : 'all',
        location: locationParam
      } 
    });
    
    console.log("Navigating to employee list with:", {
      filter: activeFilter ? `padrinos${activeFilter}` : 'all',
      location: locationParam
    });
  };
  
  // Handle click on Orejas box
  const handleOrejasClick = () => {
    const locationParam = getLocationParam();
    
    // Match the exact format that EmployeeList expects
    navigate('/employee-list', { 
      state: { 
        filter: 'RSG',
        location: locationParam,
        color: activeFilter || null
      } 
    });
    
    console.log("Navigating to RSG employee list with:", {
      filter: 'RSG',
      location: locationParam,
      color: activeFilter || null
    });
  };
  
  // Handle click on Apoyos box
  const handleApoyosClick = () => {
    const locationParam = getLocationParam();
    
    // Match the exact format that EmployeeList expects
    navigate('/employee-list', { 
      state: { 
        filter: 'COM',
        location: locationParam,
        color: activeFilter || null
      } 
    });
    
    console.log("Navigating to COM employee list with:", {
      filter: 'COM',
      location: locationParam,
      color: activeFilter || null
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
            style={{ cursor: 'pointer' }}
          >
            <span>Blue</span>
            <span>{metrics.overview.padrinosBlue}</span>
          </div>
          <div
            className={`padrino-item green ${activeFilter === 'green' ? 'active' : ''}`}
            onClick={() => onColorClick('green')}
            style={{ cursor: 'pointer' }}
          >
            <span>Green</span>
            <span>{metrics.overview.padrinosGreen}</span>
          </div>
          <div
            className={`padrino-item orange ${activeFilter === 'orange' ? 'active' : ''}`}
            onClick={() => onColorClick('orange')}
            style={{ cursor: 'pointer' }}
          >
            <span>Orange</span>
            <span>{metrics.overview.padrinosOrange}</span>
          </div>
          <div
            className={`padrino-item red ${activeFilter === 'red' ? 'active' : ''}`}
            onClick={() => onColorClick('red')}
            style={{ cursor: 'pointer' }}
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
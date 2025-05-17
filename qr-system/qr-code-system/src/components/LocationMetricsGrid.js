import React from 'react';
import { useNavigate } from 'react-router-dom';

// LocationMetricsGrid component for the LocationAdminDashboard
const LocationMetricsGrid = ({ serviceMetrics, activeLocation, searchQuery }) => {
  const navigate = useNavigate();
  
  // Handler for Total Members click
  const handleTotalMembersClick = () => {
    console.log("Navigating to employee list with location:", activeLocation);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'all',
        location: activeLocation !== 'all' ? activeLocation : null,
        searchQuery: searchQuery || null
      },
      replace: true
    });
  };
  
  // Handler for Padrinos total click
  const handlePadrinosClick = () => {
    console.log("Navigating to all padrinos list with location:", activeLocation);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'padrinos',
        location: activeLocation !== 'all' ? activeLocation : null,
        searchQuery: searchQuery || null
      },
      replace: true
    });
  };
  
  // Handlers for specific padrino colors
  const handlePadrinoColorClick = (color) => {
    console.log(`Navigating to ${color} padrinos list with location:`, activeLocation);
    
    navigate('/employee-list', { 
      state: { 
        filter: `padrinos${color}`, // This format is expected by EmployeeList
        location: activeLocation !== 'all' ? activeLocation : null,
        searchQuery: searchQuery || null
      },
      replace: true
    });
  };
  
  // Handler for Orejas click
  const handleOrejasClick = () => {
    console.log("Navigating to orejas list with location:", activeLocation);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'RSG',
        location: activeLocation !== 'all' ? activeLocation : null,
        searchQuery: searchQuery || null
      },
      replace: true
    });
  };
  
  // Handler for Apoyos click
  const handleApoyosClick = () => {
    console.log("Navigating to apoyos list with location:", activeLocation);
    
    navigate('/employee-list', { 
      state: { 
        filter: 'COM',
        location: activeLocation !== 'all' ? activeLocation : null,
        searchQuery: searchQuery || null
      },
      replace: true
    });
  };
  
  // Add null check for serviceMetrics to prevent errors
  if (!serviceMetrics) {
    return <div className="metrics-grid">Loading metrics...</div>;
  }
  
  const { 
    totalCount, 
    activeCount, 
    padrinoCount, 
    padrinosBlue, 
    padrinosGreen, 
    padrinosOrange, 
    padrinosRed, 
    orejaCount, 
    apoyoCount 
  } = serviceMetrics;
  
  return (
    <div className="metrics-grid">
      {/* Metric Card: Total Members (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleTotalMembersClick}
        data-testid="total-members-card"
      >
        <h3 className="metric-title">TOTAL DE MIEMBROS DEL GRUPO</h3>
        <p className="metric-number">{totalCount}</p>
        <p className="metric-subtitle">
          {activeLocation !== 'all' ? `Location: ${activeLocation}` : 'All Locations'}
          {activeCount > 0 && ` • ${activeCount} Active (${Math.round((activeCount/totalCount) * 100)}%)`}
        </p>
      </div>
      
      {/* Metric Card: Padrinos */}
      <div className="metric-box padrinos-box">
        <h3 className="metric-title">TOTAL DE PADRINOS POR RANKING</h3>
        <div 
          className="total-padrinos" 
          onClick={handlePadrinosClick} 
          style={{ cursor: 'pointer' }}
          data-testid="total-padrinos"
        >
          Total: {padrinoCount || 0}
        </div>
        <div className="padrinos-grid">
          <div
            className="padrino-item blue"
            onClick={() => handlePadrinoColorClick('blue')}
            style={{ cursor: 'pointer' }}
            data-testid="padrino-blue"
          >
            <span>Blue</span>
            <span>{padrinosBlue || 0}</span>
          </div>
          <div
            className="padrino-item green"
            onClick={() => handlePadrinoColorClick('green')}
            style={{ cursor: 'pointer' }}
            data-testid="padrino-green"
          >
            <span>Green</span>
            <span>{padrinosGreen || 0}</span>
          </div>
          <div
            className="padrino-item orange"
            onClick={() => handlePadrinoColorClick('orange')}
            style={{ cursor: 'pointer' }}
            data-testid="padrino-orange"
          >
            <span>Orange</span>
            <span>{padrinosOrange || 0}</span>
          </div>
          <div
            className="padrino-item red"
            onClick={() => handlePadrinoColorClick('red')}
            style={{ cursor: 'pointer' }}
            data-testid="padrino-red"
          >
            <span>Red</span>
            <span>{padrinosRed || 0}</span>
          </div>
        </div>
      </div>
      
      {/* Metric Card: Orejas (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleOrejasClick}
        data-testid="total-orejas"
      >
        <h3 className="metric-title">TOTAL DE OREJAS</h3>
        <p className="metric-number">{orejaCount}</p>
        <p className="metric-subtitle">
          {totalCount > 0 && orejaCount > 0 && 
            `${Math.round((orejaCount/totalCount) * 100)}% of members`
          }
        </p>
      </div>
      
      {/* Metric Card: Apoyos (clickable) */}
      <div
        className="metric-box"
        style={{ cursor: 'pointer' }}
        onClick={handleApoyosClick}
        data-testid="total-apoyos"
      >
        <h3 className="metric-title">TOTAL DE APOYOS</h3>
        <p className="metric-number">{apoyoCount}</p>
        <p className="metric-subtitle">
          {totalCount > 0 && apoyoCount > 0 &&
            `${Math.round((apoyoCount/totalCount) * 100)}% of members`
          }
        </p>
      </div>
    </div>
  );
};

export default LocationMetricsGrid;
'use client';
import React from 'react';
// Optionally: import './LocationNav.css';

const LocationNav = ({ locationMap, activeTab, onTabClick }) => {
  return (
    <nav className="location-nav">
      <ul>
        {Object.keys(locationMap).map((location) => (
          <li
            key={location}
            onClick={() => onTabClick(location)}
            className={`nav-item ${activeTab === location ? 'active' : ''}`}
          >
            {location}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default LocationNav;

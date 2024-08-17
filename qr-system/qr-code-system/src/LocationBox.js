import React from 'react';
import './LocationBox.css';

const LocationBox = ({ location, analytics, onViewDetails }) => {
  console.log('Rendering LocationBox for:', location, analytics); // Log props

  return (
    <div className="location-box">
      <h2>{location}</h2>
      <div className="analytics-details">
        <p><strong>Total Employees:</strong> {analytics.totalEmployees || 'N/A'}</p>
        <p><strong>Total Clocked In:</strong> {analytics.totalClockedIn || 'N/A'}</p>
        <p><strong>Total Late:</strong> {analytics.totalLate || 'N/A'}</p>
        <p><strong>Average Attendance:</strong> {analytics.averageAttendance || 'N/A'}</p>
      </div>
      <button onClick={onViewDetails} className="details-link">
        View Employee Details
      </button>
    </div>
  );
};

export default LocationBox;

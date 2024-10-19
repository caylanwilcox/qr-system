import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons'; // Import the gear icon
import Scanner from './Scanner'; // Assuming Scanner component is correctly implemented
import './QRScannerPage.css'; // Enhanced CSS

const QrScannerPage = () => {
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [mode, setMode] = useState('clock-in'); // Default mode is 'clock-in'
  const [settingsVisible, setSettingsVisible] = useState(false); // Manage visibility of settings
  const [employeeInfo, setEmployeeInfo] = useState(null); // Employee info after clock-in

  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ];

  // Toggle settings visibility
  const toggleSettingsVisibility = () => {
    setSettingsVisible(!settingsVisible);
  };

  // Handle mode switch (clock-in/clock-out)
  const handleModeSwitch = (newMode) => {
    setMode(newMode);
  };

  // Simulate clock-in action by fetching employee data and displaying it
  const handleClockIn = (employee) => {
    const clockInTime = new Date();
    setEmployeeInfo({
      name: employee.name,
      photo: employee.photo, // Path to employee photo
      clockInTime: clockInTime.toLocaleString(),
    });
    setMessage(`Clocked in successfully at ${clockInTime.toLocaleTimeString()}`);
  };

  return (
    <div className="admin-container">
      <header className="Admin-header">
        <h1>QR Code Scanner</h1>
      </header>

      {/* Gear Icon to toggle settings */}
      <div className="gear-icon" onClick={toggleSettingsVisibility}>
        <FontAwesomeIcon icon={faCog} size="2x" />
      </div>

      {/* Scanner Settings - Populated when the gear icon is clicked */}
      {settingsVisible && (
        <div className="scanner-settings">
          <h2>Employee Attendance Settings</h2>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="location-dropdown"
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <div className="button-group">
            <button onClick={() => handleModeSwitch('clock-in')}>Switch to Clock In</button>
            <button onClick={() => handleModeSwitch('clock-out')}>Switch to Clock Out</button>
          </div>

          <p>Current Mode: {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}</p>
        </div>
      )}

      {/* QR Code Scanner and Employee Information */}
      <div className="scanner-container">
        <div className="qr-circle">
          <Scanner setMessage={setMessage} location={location} mode={mode} onClockIn={handleClockIn} />
        </div>
      </div>

      <div className="message-container">
        <p>{message}</p> {/* Display scanner message */}
      </div>

      {/* Employee Information after clock-in */}
      {employeeInfo && (
        <div className="employee-info-container">
          <div className="employee-img-container">
            <img src={employeeInfo.photo} alt="Employee" className="employee-img" />
          </div>
          <div className="employee-details">
            <h2>{employeeInfo.name}</h2>
            <p>Clocked in at: {employeeInfo.clockInTime}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default QrScannerPage;

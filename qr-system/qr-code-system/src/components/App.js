import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons'; // Import the gear icon
import Admin from './Admin';
import EmployeeList from './EmployeeList';
import EmployeeDetails from './EmployeeDetails';
import Scanner from './Scanner';
import QrBadge from './QrBadge';
import './App.css';
import photo from './download.png'
function App() {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('clock-in'); // Default mode is 'clock-in'
  const [location, setLocation] = 
  
  
  
  
  
  
  
useState(''); // Add location state
  const [theme, setTheme] = useState('light'); // Add theme state for light/dark mode
  const [settingsVisible, setSettingsVisible] = useState(false); // Manage visibility of settings
  
  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling'
  ]; // Predefined list of locations

  const handleModeSwitch = (newMode) => {
    console.log(`Switching to mode: ${newMode}`);
    setMode(newMode);
  };

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const toggleSettingsVisibility = () => {
    setSettingsVisible(!settingsVisible);
  };

  useEffect(() => {
    console.log('Received location in Scanner:', location); // Ensure this logs the correct location whenever it changes
  }, [location]);

  return (
    <Router>
      <div className={`App ${theme}`}>
        <nav className="nav">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/admin">Admin</Link></li>
            <li><Link to="/qrbadge">Generate QR Badge</Link></li> {/* Add new link for QR Badge */}
          </ul>
       
        </nav>

        {/* Gear Icon */}
        <div className="gear-icon" onClick={toggleSettingsVisibility}>
          <FontAwesomeIcon icon={faCog} size="2x" />
        </div>

        {/* Scanner Settings - Populated when the gear icon is clicked */}
        {settingsVisible && (
          <div className="scanner-settings">
            <header className="App-header">
              <h1>Employee Attendance Settings</h1>
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  console.log('Selected location:', e.target.value); // This should log the selected location
                }}
                className="location-dropdown"
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <div>
                <button onClick={() => handleModeSwitch('clock-in')}>Switch to Clock In</button>
                <button onClick={() => handleModeSwitch('clock-out')}>Switch to Clock Out</button>
                <p>Current Mode: {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}</p>
              </div>
            </header>
          </div>
        )}

        {/* Scanner Container */}
        <div className="scanner-container">
          <img src={photo}></img>
          <div id="qr-reader" className="qr-circle">
            <Scanner setMessage={setMessage} mode={mode} location={location} /> {/* Pass location prop */}
          </div>
        </div>

        {/* Message Container */}
        <div className="message-container">
          <p>{message}</p> {/* Message is now a sibling component to the scanner container */}
        </div>

        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/qrbadge" element={<QrBadge />} /> {/* Route for QR Badge */}
          <Route path="/location/:location" element={<EmployeeList />} /> {/* Route for employee list */}
          <Route path="/location/:location/:employeeId" element={<EmployeeDetails />} /> {/* Route for employee details */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;

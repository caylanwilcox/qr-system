import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import QRCodeGenerator from './QRCodeGenerator';
import Scanner from './Scanner';
import Admin from './Admin';
import './App.css';

function App() {
  const [employeeId, setEmployeeId] = useState('12345');
  const [location, setLocation] = useState('Office');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('clock-in'); // Default mode is 'clock-in'

  const qrCodeValue = `${employeeId}|${location}`;

  const handleModeSwitch = (newMode) => {
    console.log(`Switching to mode: ${newMode}`);
    setMode(newMode);
  };

  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/admin">Admin</Link></li>
          </ul>
        </nav>
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <header className="App-header">
                  <h1>Employee Attendance QR Code</h1>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="Enter Employee ID"
                  />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter Location"
                  />
                  <QRCodeGenerator value={qrCodeValue} />
                  <div>
                    <button onClick={() => handleModeSwitch('clock-in')}>Switch to Clock In</button>
                    <button onClick={() => handleModeSwitch('clock-out')}>Switch to Clock Out</button>
                    <p>Current Mode: {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}</p>
                  </div>
                  <Scanner setMessage={setMessage} mode={mode} />
                  <p>{message}</p>
                </header>
              </div>
            }
          />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

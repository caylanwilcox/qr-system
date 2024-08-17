import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Scanner from './Scanner';
import Admin from './Admin';
import QrBadge from './QrBadge'; // Import the new QR Badge component
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('clock-in'); // Default mode is 'clock-in'
  const [location, setLocation] = useState('Office'); // Add location state

  const handleModeSwitch = (newMode) => {
    console.log(`Switching to mode: ${newMode}`);
    setMode(newMode);
  };

  return (
    <Router>
      <div className="App">
        <nav className='nav'>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/admin">Admin</Link></li>
            <li><Link to="/qrbadge">Generate QR Badge</Link></li> {/* Add new link for QR Badge */}
          </ul>
        </nav>
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <header className="App-header">
                  <h1>Employee Attendance</h1>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter Location"
                  />
                  <div>
                    <button onClick={() => handleModeSwitch('clock-in')}>Switch to Clock In</button>
                    <button onClick={() => handleModeSwitch('clock-out')}>Switch to Clock Out</button>
                    <p>Current Mode: {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}</p>
                  </div>
                  <Scanner setMessage={setMessage} mode={mode} location={location} /> {/* Pass location prop */}
                  <p>{message}</p>
                </header>
              </div>
            }
          />
          <Route path="/admin" element={<Admin />} />
          <Route path="/qrbadge" element={<QrBadge />} /> {/* Add new route for QR Badge */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;

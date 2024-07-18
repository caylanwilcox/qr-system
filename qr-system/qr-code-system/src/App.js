import React, { useState } from 'react';
import QRCodeGenerator from './QRCodeGenerator';
import Scanner from './Scanner';
import './App.css';

function App() {
  const [employeeId, setEmployeeId] = useState('12345');
  const [location, setLocation] = useState('Office');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('clock-in'); // Default mode is 'clock-in'

  const qrCodeValue = `${employeeId}|${location}`;

  return (
    <div className="App">
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
          <button onClick={() => setMode('clock-in')}>Switch to Clock In</button>
          <button onClick={() => setMode('clock-out')}>Switch to Clock Out</button>
          <p>Current Mode: {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}</p>
        </div>
        <Scanner setMessage={setMessage} mode={mode} />
        <p>{message}</p>
      </header>
    </div>
  );
}

export default App;

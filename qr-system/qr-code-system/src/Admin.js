import React, { useState } from 'react';
import Table from './Table';
import './Admin.css';

const Admin = () => {
  const [location, setLocation] = useState('Office');

  return (
    <div className="admin-container">
      <header className="Admin-header">
        <h1>Admin - Attendance Management</h1>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter Location"
        />
        <Table location={location} />
      </header>
    </div>
  );
};

export default Admin;

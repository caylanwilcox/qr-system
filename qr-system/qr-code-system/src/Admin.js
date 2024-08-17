import React, { useState, useEffect } from 'react';
import Table from './Table';
import EmployeeDetails from './EmployeeDetails';
import './Admin.css';

const Admin = () => {
  const [location, setLocation] = useState('Office');
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3003/attendance')
      .then(response => response.json())
      .then(data => {
        const formattedData = Object.keys(data).map(employeeId => ({
          employeeId,
          days: data[employeeId].days,
          rank: data[employeeId].rank,
          location: data[employeeId].location
        }));
        setAttendanceData(formattedData);
      })
      .catch(error => console.error('Error fetching attendance data:', error));
  }, [location]);

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
        <Table
          attendanceData={attendanceData.filter(employee => employee.location === location)}
          onSelectEmployee={setSelectedEmployee}
        />
        {selectedEmployee && <EmployeeDetails employeeId={selectedEmployee} />}
      </header>
    </div>
  );
};

export default Admin;

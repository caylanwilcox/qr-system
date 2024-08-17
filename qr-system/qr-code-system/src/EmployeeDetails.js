import React, { useState, useEffect } from 'react';
import './EmployeeDetails.css';

const EmployeeDetails = ({ employeeId }) => {
  const [attendanceDetails, setAttendanceDetails] = useState({});

  useEffect(() => {
    if (employeeId) {
      fetch(`http://localhost:3003/attendance?employeeId=${employeeId}`)
        .then(response => response.json())
        .then(data => {
          setAttendanceDetails(data);
        })
        .catch(error => console.error('Error fetching attendance details:', error));
    }
  }, [employeeId]);

  if (!employeeId) {
    return <div className="employee-details-container">Select an employee to see details.</div>;
  }

  return (
    <div className="employee-details-container">
      <h2>Attendance Details for {employeeId}</h2>
      <table>
        <thead>
          <tr>
            <th>Clock In Time</th>
            <th>Clock Out Time</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {attendanceDetails.clockins && attendanceDetails.clockins.map((entry, index) => (
            <tr key={index}>
              <td>{entry.clockInTime}</td>
              <td>{attendanceDetails.clockouts[index]?.clockOutTime || 'N/A'}</td>
              <td>{entry.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="attendance-summary">
        <h3>Total Days Attended: {attendanceDetails.days}</h3>
        <h3>Rank: {attendanceDetails.rank}</h3>
      </div>
    </div>
  );
};

export default EmployeeDetails;

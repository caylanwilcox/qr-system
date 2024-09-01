import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './EmployeeDetails.css';

const EmployeeDetails = () => {
  const { employeeId } = useParams(); // Get employeeId from the URL
  const [attendanceDetails, setAttendanceDetails] = useState({
    records: [],
    days: 0,
    rank: ''
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (employeeId) {
      fetch(`http://localhost:3003/attendance?employeeId=${employeeId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("Fetched attendance details data:", data);

          // Validate data structure
          if (!data || !Array.isArray(data)) {
            throw new Error('Invalid data format received');
          }

          // Group the clock-ins and clock-outs by day
          const records = data.reduce((acc, clockin) => {
            const date = clockin.clockInTime.split(' ')[0];
            let record = acc.find(r => r.date === date);
            if (!record) {
              record = { date, clockInTime: clockin.clockInTime, clockOutTime: 'N/A', location: clockin.location };
              acc.push(record);
            } else if (clockin.clockOutTime) {
              record.clockOutTime = clockin.clockOutTime;
            }
            return acc;
          }, []);

          const uniqueDays = new Set(records.map(record => record.date));
          const daysAttended = uniqueDays.size;

          setAttendanceDetails({
            records,
            days: daysAttended,
            rank: records[0]?.rank || 'Unknown'
          });
        })
        .catch(error => {
          console.error('Error fetching attendance details:', error);
          setError(error.message);
        });
    }
  }, [employeeId]);

  if (error) {
    return <p>Error fetching attendance details: {error}</p>;
  }

  if (!employeeId) {
    return <div className="employee-details-container">Select an employee to see details.</div>;
  }

  return (
    <div className="employee-details-container">
      <h2>Attendance Details for {employeeId}</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Clock In Time</th>
            <th>Clock Out Time</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {attendanceDetails.records.map((entry, index) => (
            <tr key={index}>
              <td>{entry.date}</td>
              <td>{entry.clockInTime}</td>
              <td>{entry.clockOutTime || 'N/A'}</td>
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

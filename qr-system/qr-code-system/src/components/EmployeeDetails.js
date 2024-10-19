import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './EmployeeDetails.css';

const EmployeeDetails = () => {
  const { employeeId } = useParams(); // Get employeeId from the URL
  const [attendanceDetails, setAttendanceDetails] = useState({
    records: [],
    days: 0,
    rank: 'Unknown'
  });
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState(null); // Track any errors

  useEffect(() => {
    if (employeeId) {
      const fetchAttendanceDetails = async () => {
        try {
          const response = await fetch(`https://qr-system-1cea7-default-rtdb.firebaseio.com/attendance.json?orderBy="employeeId"&equalTo="${employeeId}"`);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          console.log("Fetched attendance details data:", data);

          // Validate data structure
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format received');
          }

          // Flatten the object into an array of attendance records
          const recordsArray = Object.values(data);

          // Group the clock-ins and clock-outs by day
          const records = recordsArray.reduce((acc, clockin) => {
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

          // Get unique days attended
          const uniqueDays = new Set(records.map(record => record.date));
          const daysAttended = uniqueDays.size;

          // Assuming rank is somehow included in the employee's first record
          const rank = records[0]?.rank || 'Unknown';

          setAttendanceDetails({
            records,
            days: daysAttended,
            rank
          });
          setLoading(false);
        } catch (error) {
          console.error('Error fetching attendance details:', error);
          setError(error.message);
          setLoading(false);
        }
      };

      fetchAttendanceDetails();
    }
  }, [employeeId]);

  if (loading) {
    return <p>Loading attendance details...</p>;
  }

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

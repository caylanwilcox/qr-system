import React, { useState, useEffect } from 'react';
import './Table.css';

const Table = ({ location }) => {
  const [attendanceData, setAttendanceData] = useState([]);

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

  const filteredData = attendanceData.filter(employee => employee.location === location);

  return (
    <div className="table-container">
      <h2>Attendance for {location}</h2>
      <table>
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Days Attended</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((employee, index) => (
            <tr key={index}>
              <td>{employee.employeeId}</td>
              <td>{employee.days}</td>
              <td>{employee.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;

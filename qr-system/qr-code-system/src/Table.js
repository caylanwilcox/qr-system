import React from 'react';
import './Table.css';

const Table = ({ attendanceData, onSelectEmployee }) => {
  return (
    <div className="table-container">
      <h2>Employee List</h2>
      <table>
        <thead className='EmployeeHead'>
          <tr>
            <th>Employee ID</th>
            <th>Days Attended</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {attendanceData.map((employee, index) => (
            <tr key={index} onClick={() => onSelectEmployee(employee.employeeId)}>
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

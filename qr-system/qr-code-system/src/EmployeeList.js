import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EmployeeDetails from './EmployeeDetails';
import './EmployeeList.css';

const EmployeeList = () => {
  const { location } = useParams(); // Get the location from the URL
  const [employeeList, setEmployeeList] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3003/attendance')
      .then(response => response.json())
      .then(data => {
        // Filter employees by location
        const filteredData = Object.keys(data)
          .filter(employeeId => data[employeeId].location === location)
          .map(employeeId => ({
            employeeId,
            ...data[employeeId]
          }));
        setEmployeeList(filteredData);
      })
      .catch(error => console.error('Error fetching employee list:', error));
  }, [location]);

  if (employeeList.length === 0) {
    return <div>No employees found for this location.</div>;
  }

  return (
    <div className="employee-list-container">
      <h2>Employee List for {location}</h2>
      <ul className="employee-list">
        {employeeList.map(employee => (
          <li key={employee.employeeId} onClick={() => setSelectedEmployee(employee.employeeId)}>
            {employee.employeeId} - {employee.name || 'No Name'}
          </li>
        ))}
      </ul>
      {selectedEmployee && <EmployeeDetails employeeId={selectedEmployee} />}
    </div>
  );
};

export default EmployeeList;

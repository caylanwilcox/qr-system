import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './EmployeeList.css';

const EmployeeList = () => {
  const { location } = useParams(); // Get the location from the URL
  const [employeeList, setEmployeeList] = useState([]);
  const [loading, setLoading] = useState(true); // Track loading state
  const [error, setError] = useState(null); // Track any errors

  useEffect(() => {
    const fetchEmployeeList = async () => {
      try {
        const response = await fetch(`http://localhost:3003/attendance?location=${location}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Fetched data for location:', data); // Log fetched data for debugging

        // Transform data to include clock-in/out status
        const employeeData = data.map(employee => {
          const clockOut = data.find(item => item.employeeId === employee.employeeId && item.clockOutTime);
          return {
            employeeId: employee.employeeId,
            name: employee.name || 'No Name',
            clockInOutStatus: clockOut ? 'Clocked Out' : 'In Progress'
          };
        });

        if (Array.isArray(employeeData)) {
          setEmployeeList(employeeData);
        } else {
          setEmployeeList([]); // Set to an empty array if data is not an array
          setError('Unexpected data format received from server.');
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching employee list:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchEmployeeList();
  }, [location]);

  if (loading) {
    return <p>Loading employee list...</p>;
  }

  if (error) {
    return <p>Error fetching employee list: {error}</p>;
  }

  if (employeeList.length === 0) {
    return <p>No employees found for this location.</p>;
  }

  return (
    <div className="employee-list-container">
      <h2>Employee List for {location}</h2>
      <ul className="employee-list">
        {employeeList.map(employee => (
          <li key={employee.employeeId} className="employee-item">
            <Link to={`/location/${location}/${employee.employeeId}`} style={{ color: 'black', textDecoration: 'none' }}>
              <p><strong>Name:</strong> {employee.name}</p>
              <p><strong>ID:</strong> {employee.employeeId}</p>
              <p><strong>Status:</strong> {employee.clockInOutStatus}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EmployeeList;

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './EmployeeProfile.css';  // Import the CSS file

const EmployeeProfile = () => {
  const { employeeId } = useParams(); // Get employeeId from the URL
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch employee data based on employeeId from Firebase
    const fetchEmployeeDetails = async () => {
      try {
        const response = await fetch(`https://qr-system-1cea7-default-rtdb.firebaseio.com/attendance/${employeeId}.json`);
        const data = await response.json();
        setEmployeeDetails(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching employee details:', error);
      }
    };

    fetchEmployeeDetails();
  }, [employeeId]);

  if (loading) {
    return <p>Loading employee details...</p>;
  }

  if (!employeeDetails) {
    return <p>No employee details found for {employeeId}</p>;
  }

  return (
    <div>
      <h1>Employee Profile: {employeeDetails.name}</h1>
      <p>Employee ID: {employeeId}</p>
      <p>Clock In: {employeeDetails.clockInTime}</p>
      <p>Clock Out: {employeeDetails.clockOutTime}</p>
      {/* Add more employee details here */}
    </div>
  );
};

export default EmployeeProfile;

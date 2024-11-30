// AddUser.jsx
import React, { useState } from 'react';
import { database } from '../services/firebaseConfig';
import { ref, set } from 'firebase/database';
import './AddUser.css';

const AddUser = () => {
  const [employeeData, setEmployeeData] = useState({
    name: '',
    position: 'junior',
    location: 'Agua Viva Elgin R7',
    email: '',
    phone: '',
    startDate: '',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const locationOptions = [
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Lyons',
    'Agua Viva West Chicago',
    'Agua Viva Wheeling',
  ];
  const positionOptions = ['junior', 'intermediate', 'senior'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmployeeData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Generate a unique employee ID
      const newEmployeeId = `employee_${Date.now()}`;

      // Reference to the specific location under attendance
      const employeeRef = ref(
        database,
        `attendance/${employeeData.location}/${newEmployeeId}`
      );

      // Initialize attendance data with default values
      const initialAttendanceData = {
        name: employeeData.name,
        position: employeeData.position,
        email: employeeData.email,
        phone: employeeData.phone,
        startDate: employeeData.startDate,
        assignedDates: [],
        clockInTime: null,
        clockOutTime: null,
        daysLate: 0,
        daysOnTime: 0,
        daysScheduledMissed: 0,
        daysScheduledPresent: 0,
        totalDays: 0,
      };

      // Set the new employee data in Firebase
      await set(employeeRef, initialAttendanceData);

      setSuccessMessage('Employee added successfully!');
      // Reset the form
      setEmployeeData({
        name: '',
        position: 'junior',
        location: 'Agua Viva Elgin R7',
        email: '',
        phone: '',
        startDate: '',
      });
    } catch (error) {
      console.error('Error adding new employee:', error);
      setErrorMessage('Failed to add employee. Please try again.');
    }
  };

  return (
    <div className="add-employee-container">
      <h2>Add New Employee</h2>
      <form className="add-employee-form" onSubmit={handleSubmit}>
        {successMessage && <div className="success-message">{successMessage}</div>}
        {errorMessage && <div className="error-message">{errorMessage}</div>}
        <div className="form-group">
          <label htmlFor="name">Full Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={employeeData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter full name"
          />
        </div>
        <div className="form-group">
          <label htmlFor="position">Position:</label>
          <select
            id="position"
            name="position"
            value={employeeData.position}
            onChange={handleInputChange}
          >
            {positionOptions.map((position) => (
              <option key={position} value={position}>
                {position.charAt(0).toUpperCase() + position.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="location">Location:</label>
          <select
            id="location"
            name="location"
            value={employeeData.location}
            onChange={handleInputChange}
          >
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={employeeData.email}
            onChange={handleInputChange}
            required
            placeholder="Enter email address"
          />
        </div>
        <div className="form-group">
          <label htmlFor="phone">Phone Number:</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={employeeData.phone}
            onChange={handleInputChange}
            required
            placeholder="Enter phone number"
          />
        </div>
        <div className="form-group">
          <label htmlFor="startDate">Start Date:</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            value={employeeData.startDate}
            onChange={handleInputChange}
            required
          />
        </div>
        <button type="submit" className="add-employee-button">
          Add Employee
        </button>
      </form>
    </div>
  );
};

export default AddUser;

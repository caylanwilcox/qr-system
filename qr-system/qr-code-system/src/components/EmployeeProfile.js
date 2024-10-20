import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './EmployeeProfile.css';  // Import the CSS file
import { database } from '../services/firebaseConfig'; // Your Firebase configuration file
import { ref, get, update } from 'firebase/database';

const EmployeeProfile = () => {
  const { employeeId } = useParams(); // Get employeeId from the URL
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendarValue, setCalendarValue] = useState(new Date());
  const [newPosition, setNewPosition] = useState('');
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [assignedDates, setAssignedDates] = useState([]);

  useEffect(() => {
    // Fetch employee data based on employeeId from Firebase
    const fetchEmployeeDetails = async () => {
      try {
        const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
        const snapshot = await get(employeeRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setEmployeeDetails(data);
          setAssignedDates(data.assignedDates || []);
        } else {
          console.error('No data available');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching employee details:', error);
        setLoading(false);
      }
    };

    fetchEmployeeDetails();
  }, [employeeId]);

  const handleReassign = async () => {
    if (!newPosition || !newScheduleDate) {
      alert('Please enter both a new position and schedule date.');
      return;
    }

    try {
      const updatedDetails = {
        ...employeeDetails,
        position: newPosition,
        assignedDates: [...assignedDates, newScheduleDate],
      };

      const employeeRef = ref(database, `attendance/Agua Viva Elgin R7/${employeeId}`);
      await update(employeeRef, updatedDetails);

      setEmployeeDetails(updatedDetails);
      setAssignedDates([...assignedDates, newScheduleDate]);
      alert('Employee reassigned successfully.');
    } catch (error) {
      console.error('Error updating employee details:', error);
    }
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const formattedDate = date.toISOString().split('T')[0];
      if (assignedDates.includes(formattedDate)) {
        return 'react-calendar__tile--assigned';
      }
    }
    return null;
  };

  const onTileClick = (value) => {
    const formattedDate = value.toISOString().split('T')[0];
    if (assignedDates.includes(formattedDate)) {
      alert(`Assigned on ${formattedDate}`);
    } else {
      setCalendarValue(value); // Just select the date without assignment
    }
  };

  if (loading) {
    return <p>Loading employee details...</p>;
  }

  if (!employeeDetails) {
    return <p>No employee details found for {employeeId}</p>;
  }

  return (
    <div className="employee-profile-container">
      <div className="employee-profile-header">
        <div className="header-content">
          <img 
            src={employeeDetails.profilePicture || 'default-profile.png'}
            alt={`${employeeDetails.name}'s profile`}
            className="profile-picture"
          />
          <div className="header-text">
            <h1>{employeeDetails.name}</h1>
            <p><strong>Employee ID:</strong> {employeeId}</p>
          </div>
        </div>
      </div>
      <div className="employee-profile-details">
        <div className="employee-info">
          <h2>Details</h2>
          <p><strong>Rank:</strong> {employeeDetails.rank || 'N/A'}</p>
          <p><strong>Position:</strong> {employeeDetails.position || 'N/A'}</p>
          <p><strong>Email:</strong> {employeeDetails.email || 'N/A'}</p>
          <p><strong>Phone:</strong> {employeeDetails.phone || 'N/A'}</p>
          <h2>Attendance</h2>
          <p><strong>Clock In:</strong> {employeeDetails.clockInTime || 'N/A'}</p>
          <p><strong>Clock Out:</strong> {employeeDetails.clockOutTime || 'N/A'}</p>
        </div>
        <div className="employee-schedule">
          <h2>Schedule & Reassign</h2>
          <Calendar
            onChange={setCalendarValue}
            value={calendarValue}
            tileClassName={tileClassName}
            onClickDay={onTileClick}
          />
          <div className="reassign-section">
            <h3>Reassign Employee</h3>
            <label htmlFor="newPosition">New Position:</label>
            <input 
              type="text" 
              id="newPosition" 
              value={newPosition} 
              onChange={(e) => setNewPosition(e.target.value)}
              placeholder="Enter new position" 
            />
            <label htmlFor="newSchedule">New Schedule Date:</label>
            <input 
              type="date" 
              id="newSchedule" 
              value={newScheduleDate}
              onChange={(e) => setNewScheduleDate(e.target.value)}
            />
            <button className="reassign-button" onClick={handleReassign}>Reassign</button>
          </div>
          <div className="upcoming-schedule">
            <h3>Upcoming Schedule</h3>
            <ul>
              {assignedDates.sort().map((date) => (
                <li key={date}>{date}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;

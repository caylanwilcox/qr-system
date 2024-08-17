import React, { useState, useEffect } from 'react';
import Table from './Table';
import EmployeeDetails from './EmployeeDetails';
import './LocationAnalytics.css';

const LocationAnalytics = () => {
  const [locations, setLocations] = useState([
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling'
  ]);

  const [analyticsData, setAnalyticsData] = useState({});
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3003/locationAnalytics')
      .then(response => response.json())
      .then(data => {
        setAnalyticsData(data);
      })
      .catch(error => console.error('Error fetching analytics data:', error));
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetch('http://localhost:3003/attendance')
        .then(response => response.json())
        .then(data => {
          const filteredData = Object.keys(data).map(employeeId => ({
            employeeId,
            days: data[employeeId].days,
            rank: data[employeeId].rank,
            location: data[employeeId].location
          })).filter(employee => employee.location === selectedLocation);
          
          setAttendanceData(filteredData);
        })
        .catch(error => console.error('Error fetching attendance data:', error));
    }
  }, [selectedLocation]);

  return (
    <div className="location-analytics-container">
      {locations.map(location => (
        <div
          key={location}
          className="location-box"
          onClick={() => setSelectedLocation(location)}
        >
          <h2>{location}</h2>
          <div className="analytics-details">
            <p>Total Clocked In: {analyticsData[location]?.totalClockedIn || 'N/A'}</p>
            <p>Total Late: {analyticsData[location]?.totalLate || 'N/A'}</p>
            <p>Average Attendance: {analyticsData[location]?.averageAttendance || 'N/A'}</p>
          </div>
        </div>
      ))}

      {selectedLocation && (
        <div className="location-details">
          <h2>Employee List for {selectedLocation}</h2>
          <Table
            attendanceData={attendanceData}
            onSelectEmployee={setSelectedEmployee}
          />
          {selectedEmployee && <EmployeeDetails employeeId={selectedEmployee} />}
        </div>
      )}
    </div>
  );
};

export default LocationAnalytics;

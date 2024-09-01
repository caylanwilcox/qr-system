import React, { useState, useEffect } from 'react';
import LocationBox from './LocationBox';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

const Admin = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling'
  ];
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const allLocationsData = await Promise.all(
          locations.map(async (location) => {
            const response = await fetch(`http://localhost:3003/attendance?location=${location}`);
            if (!response.ok) {
              throw new Error(`Error fetching data for location ${location}: ${response.statusText}`);
            }
            const data = await response.json();
            return { location, data };
          })
        );

        setAttendanceData(allLocationsData);

        const analytics = allLocationsData.reduce((acc, { location, data }) => {
          acc[location] = calculateLocationAnalytics(data);
          return acc;
        }, {});

        setLocationAnalytics(analytics);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
      }
    };

    fetchAttendanceData();
  }, []);

  const calculateLocationAnalytics = (data) => {
    const totalEmployees = data.length;
    const totalClockedIn = data.filter(employee => employee.clockInTime).length;
    const totalLate = data.filter(employee => employee.status === 'In Progress').length;
    
    // Calculate attendance percentage
    const averageAttendance = totalEmployees > 0 
      ? ((totalClockedIn / totalEmployees) * 100).toFixed(2) + '%' 
      : 'N/A';

    return {
      totalEmployees,
      totalClockedIn,
      averageAttendance,
      totalLate,
    };
  };

  const handleViewDetails = (location) => {
    navigate(`/location/${location}`);
  };

  return (
    <div className="admin-container">
      <header className="Admin-header">
        <h1>Admin - Attendance Management</h1>
      </header>
      <div className="dashboard-grid">
        {locations.map(location => (
          <LocationBox
            key={location}
            location={location}
            analytics={locationAnalytics[location] || {}}
            onViewDetails={() => handleViewDetails(location)}
          />
        ))}
      </div>
    </div>
  );
};

export default Admin;

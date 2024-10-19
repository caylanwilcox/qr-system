import React, { useState, useEffect } from 'react';
import { ref, onValue } from "firebase/database";
import { database } from '../services/firebaseConfig'; // Firebase configuration
import './Admin.css'; // Optional styles

const AttendanceDashboard = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ];

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const allLocationsData = await Promise.all(
          locations.map(async (location) => {
            const locationRef = ref(database, `attendance/${location}`);
            const dataSnapshot = await new Promise((resolve) => {
              onValue(locationRef, (snapshot) => {
                resolve(snapshot);
              });
            });

            const data = dataSnapshot.val();
            return { location, data: data ? Object.values(data) : [] };
          })
        );

        setAttendanceData(allLocationsData);

        const analytics = allLocationsData.reduce((acc, { location, data }) => {
          acc[location] = calculateLocationAnalytics(data);
          return acc;
        }, {});
        setLocationAnalytics(analytics);
      } catch (error) {
        console.error('Error fetching attendance data from Firebase:', error);
      }
    };

    fetchAttendanceData();
  }, []);

  const calculateLocationAnalytics = (data) => {
    const totalEmployees = data.length;
    const totalClockedIn = data.filter((employee) => employee.clockInTime).length;
    const averageAttendance = totalEmployees > 0
      ? ((totalClockedIn / totalEmployees) * 100).toFixed(2) + '%'
      : 'N/A';
    return {
      totalEmployees,
      totalClockedIn,
      averageAttendance,
    };
  };

  return (
    <div className="dashboard-grid">
      <h1>Attendance Dashboard</h1>
      {locations.map((location) => (
        <div key={location} className="location-box">
          <h2>{location}</h2>
          <p>Total Employees: {locationAnalytics[location]?.totalEmployees || 'N/A'}</p>
          <p>Average Attendance: {locationAnalytics[location]?.averageAttendance || 'N/A'}</p>
        </div>
      ))}
    </div>
  );
};

export default AttendanceDashboard;

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ref, onValue } from "firebase/database"; // Firebase Realtime Database methods
import { database } from '../services/firebaseConfig'; // Your Firebase configuration file
import './Admin.css';

const Admin = () => {
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const [topEmployees, setTopEmployees] = useState([]); // For tracking top-performing employees
  const navigate = useNavigate();
  const location = useLocation();

  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ];

  useEffect(() => {
    const fetchLocationAnalytics = async () => {
      try {
        // Fetch attendance data for each location from Firebase
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

        // Calculate analytics for each location
        const analytics = allLocationsData.reduce((acc, { location, data }) => {
          acc[location] = calculateLocationAnalytics(data);
          return acc;
        }, {});

        setLocationAnalytics(analytics);

        // Get top-performing employees across all locations (example logic)
        const topPerformers = calculateTopEmployees(allLocationsData);
        setTopEmployees(topPerformers);
      } catch (error) {
        console.error('Error fetching location analytics:', error);
      }
    };

    fetchLocationAnalytics();
  }, []);

  // Calculate attendance analytics for each location
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

  // Example logic for finding top-performing employees based on attendance
  const calculateTopEmployees = (allLocationsData) => {
    let topEmployees = [];
    allLocationsData.forEach(({ data }) => {
      const highPerformers = data.filter((employee) => employee.attendanceLevel === 'high');
      topEmployees = [...topEmployees, ...highPerformers];
    });
    return topEmployees;
  };

  // Set dynamic page title based on the current path
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/admin/manage-employees':
        return 'Manage Employees';
      case '/admin/reports':
        return 'Attendance Reports';
      case '/admin/settings':
        return 'Settings';
      case '/admin/qr-scanner':
        return 'QR Code Scanner';
      default:
        return 'Dashboard Overview';
    }
  };

  const isDashboard = location.pathname === '/admin';

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <h2>Admin Panel</h2>
        <ul className="admin-nav">
          <li><Link to="/admin" className={isDashboard ? 'active' : ''}>Dashboard Overview</Link></li>
          <li><Link to="/admin/manage-employees">Manage Employees</Link></li>
          <li><Link to="/admin/reports">Attendance Reports</Link></li>
          <li><Link to="/admin/settings">Settings</Link></li>
          <li><Link to="/admin/qr-scanner">QR Code Scanner</Link></li>
        </ul>
      </div>

      <div className="admin-content">
        <div className="admin-header">
          <h1>{getPageTitle()}</h1>
        </div>

        {isDashboard ? (
          <div className="dashboard-grid">
            {/* Overall KPIs */}
            <div className="dashboard-summary">
              <h2>Company Overview</h2>
              <p>Total Employees: {Object.values(locationAnalytics).reduce((acc, loc) => acc + loc.totalEmployees, 0)}</p>
              <p>Average Attendance: {calculateCompanyAverage(locationAnalytics)}</p>
            </div>

            {/* Location-specific data */}
            {locations.map((location) => (
              <div className="dashboard-location-data" key={location}>
                <h2>{location}</h2>
                <p>Total Employees: {locationAnalytics[location]?.totalEmployees || 'N/A'}</p>
                <p>Average Attendance: {locationAnalytics[location]?.averageAttendance || 'N/A'}</p>
              </div>
            ))}

            {/* Top Employees section */}
            <div className="dashboard-top-employees">
              <h2>Top Performing Employees</h2>
              {topEmployees.length > 0 ? (
                <ul>
                  {topEmployees.map((employee, index) => (
                    <li key={index}>
                      {employee.name} - Attendance Level: {employee.attendanceLevel}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No top performers found.</p>
              )}
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
};

// Helper function to calculate company-wide average attendance
const calculateCompanyAverage = (locationAnalytics) => {
  const totalLocations = Object.keys(locationAnalytics).length;
  if (totalLocations === 0) return 'N/A';

  const totalAttendance = Object.values(locationAnalytics).reduce((acc, loc) => {
    const attendance = parseFloat(loc.averageAttendance) || 0;
    return acc + attendance;
  }, 0);

  return (totalAttendance / totalLocations).toFixed(2) + '%';
};

export default Admin;

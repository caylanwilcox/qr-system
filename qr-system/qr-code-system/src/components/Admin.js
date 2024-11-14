import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ref, onValue } from "firebase/database";
import { database } from '../services/firebaseConfig';
import './Admin.css';
import Dashboard from './Dashboard';
import logo from '../logo.svg';

const Admin = () => {
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const [topEmployees, setTopEmployees] = useState([]);
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
        const allLocationsData = await Promise.all(
          locations.map(async (location) => {
            const locationRef = ref(database, `attendance/${location}`);
            const dataSnapshot = await new Promise((resolve) => {
              onValue(locationRef, (snapshot) => resolve(snapshot));
            });
            const data = dataSnapshot.val();
            return { location, data: data ? Object.values(data) : [] };
          })
        );

        const analytics = allLocationsData.reduce((acc, { location, data }) => {
          acc[location] = calculateLocationAnalytics(data);
          return acc;
        }, {});

        setLocationAnalytics(analytics);

        const topPerformers = calculateTopEmployees(allLocationsData);
        setTopEmployees(topPerformers);
      } catch (error) {
        console.error('Error fetching location analytics:', error);
      }
    };

    fetchLocationAnalytics();
  }, []);

  const calculateLocationAnalytics = (data) => {
    const totalEmployees = data.length;
    const totalClockedIn = data.filter((employee) => employee.clockInTime).length;
    const averageAttendance = totalEmployees > 0
      ? ((totalClockedIn / totalEmployees) * 100).toFixed(2) + '%'
      : 'N/A';
    return { totalEmployees, totalClockedIn, averageAttendance };
  };

  const calculateTopEmployees = (allLocationsData) => {
    let topEmployees = [];
    allLocationsData.forEach(({ data }) => {
      const highPerformers = data.filter((employee) => employee.attendanceLevel === 'high');
      topEmployees = [...topEmployees, ...highPerformers];
    });
    return topEmployees;
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/admin/manage-employees': return 'Manage Employees';
      case '/admin/reports': return 'Attendance Reports';
      case '/admin/settings': return 'Settings';
      case '/admin/qr-scanner': return 'QR Code Scanner';
      default: return 'Agua Viva United States';
    }
  };

  const isDashboard = location.pathname === '/admin';

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <img src={logo} alt="logo" className="logo" />
        <h2>Admin Panel</h2>
        <ul className="admin-nav">
          <li><Link to="/admin" className={isDashboard ? 'active' : ''}>Dashboard Overview</Link></li>
          <li><Link to="/admin/manage-employees">Manage Employees</Link></li>
          <li><Link to="/admin/reports">Attendance Reports</Link></li>
          <li><Link to="/admin/settings">Settings</Link></li>
          <li><Link to="/admin/qr-scanner">QR Code Scanner</Link></li>
          <li><Link to="/">Logout</Link></li>
        </ul>
      </div>

      <div className="admin-content">
        <div className="admin-header">
          <h1>{getPageTitle()}</h1>
        </div>

        {isDashboard ? (
          <Dashboard
            locationAnalytics={locationAnalytics}
            topEmployees={topEmployees}
            locations={locations}
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
};

export default Admin;

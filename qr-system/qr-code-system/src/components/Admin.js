import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ref, onValue } from "firebase/database";
import { Calendar as CalendarIcon } from 'lucide-react';

import { database } from '../services/firebaseConfig';
import './Admin.css';
import Dashboard from './Dashboard';
import logo from './logo.png';
import {
  Home,
  Users,
  FileText,
  Settings,
  CalendarDays,
  Calendar,
  QrCode,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const Admin = () => {
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const [topEmployees, setTopEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const locations = [
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ];
  const navItems = [
    { path: '/admin', icon: <Home size={24} />, text: 'Dashboard Overview' },
    { path: '/admin/manage-employees', icon: <Users size={24} />, text: 'Manage Employees' },
    { path: '/admin/scheduler', icon: <Calendar size={24} />, text: 'Schedule Manager' }, // Add scheduler nav item
    { path: '/admin/reports', icon: <FileText size={24} />, text: 'Attendance Reports' },
    { path: '/admin/settings', icon: <Settings size={24} />, text: 'Settings' },
    { path: '/admin/qr-scanner', icon: <QrCode size={24} />, text: 'QR Code Scanner' },
  ];
  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  useEffect(() => {
    const fetchLocationAnalytics = async () => {
      setLoading(true);
      try {
        const allLocationsData = await Promise.all(
          locations.map(async (location) => {
            const locationRef = ref(database, `attendance/${location}`);
            return new Promise((resolve) => {
              onValue(locationRef, (snapshot) => {
                const data = snapshot.val();
                resolve({ location, data: data ? Object.values(data) : [] });
              }, (error) => {
                console.error(`Error fetching data for ${location}:`, error);
                resolve({ location, data: [] });
              });
            });
          })
        );

        const analytics = allLocationsData.reduce((acc, { location, data }) => {
          acc[location] = calculateLocationAnalytics(data);
          return acc;
        }, {});

        setLocationAnalytics(analytics);
        setTopEmployees(calculateTopEmployees(allLocationsData));
        setError(null);
      } catch (error) {
        console.error('Error fetching location analytics:', error);
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchLocationAnalytics();

    return () => {
      locations.forEach(location => {
        const locationRef = ref(database, `attendance/${location}`);
        onValue(locationRef, () => {});
      });
    };
  }, []);

  const calculateLocationAnalytics = (data) => {
    const totalEmployees = data.length;
    const totalClockedIn = data.filter((employee) => employee.clockInTime).length;
    const averageAttendance = totalEmployees > 0
      ? ((totalClockedIn / totalEmployees) * 100).toFixed(2) + '%'
      : '0%';
    return { totalEmployees, totalClockedIn, averageAttendance };
  };

  const calculateTopEmployees = (allLocationsData) => {
    let topEmployees = [];
    allLocationsData.forEach(({ location, data }) => {
      const highPerformers = data
        .filter((employee) => employee.attendanceLevel === 'high')
        .map(employee => ({
          ...employee,
          location
        }));
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
      case '/admin/scheduler': return 'Schedule Manager';
      default: return 'Dashboard Overview';
    }
  };

  const renderContent = () => {
    if (error) {
      return <div className="error-message">{error}</div>;
    }

    if (loading) {
      return <div className="loading-message">Loading data...</div>;
    }

    if (location.pathname === '/admin') {
      return (
        <Dashboard
          locationAnalytics={locationAnalytics}
          topEmployees={topEmployees}
          locations={locations}
        />
      );
    }

    return <Outlet />;
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="logo" className="sidebar-logo" />
          <h2>Admin Panel</h2>
          <button className="toggle-sidebar" onClick={toggleSidebar}>
            {isSidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.text}</span>
                </Link>
              </li>
            ))}
            <li className="logout-item">
              <Link to="/">
                <span className="nav-icon"><LogOut size={24} /></span>
                <span className="nav-text">Logout</span>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className={`admin-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>        <header className="main-header">
          <h1>{getPageTitle()}</h1>
        </header>
        <div className="main-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Admin;
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { ref, onValue } from "firebase/database";
import { format } from 'date-fns';
import { database } from '../../services/firebaseConfig';
import './SuperAdmin.css'; // Consider renaming to SuperAdmin.css
import Dashboard from './SuperAdminDashboard';
import logo from '../logo.png';
import {
  Home, Users, FileText, Settings, Calendar, QrCode,
  LogOut, ChevronLeft, ChevronRight, Building, UserPlus
} from 'lucide-react';

const SuperAdmin = () => {
  const [locationAnalytics, setLocationAnalytics] = useState({});
  const [topEmployees, setTopEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekWeather, setWeekWeather] = useState([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const locations = [
    'Aurora', 'Agua Viva Lyons', 'Agua Viva',
    'Agua Viva Elgin R7', 'Agua Viva Joliet', 'Agua Viva Wheeling',
  ];

  const navItems = [
    { path: '/super-admin', icon: <Home size={24} />, text: 'Dashboard Overview' },
    { path: '/super-admin/manage-admins', icon: <UserPlus size={24} />, text: 'Manage Admins' },
    { path: '/super-admin/manage-employees', icon: <Users size={24} />, text: 'Manage Employees' },
    { path: '/super-admin/scheduler', icon: <Calendar size={24} />, text: 'Schedule Manager' },
    { path: '/super-admin/reports', icon: <FileText size={24} />, text: 'Attendance Reports' },
    { path: '/super-admin/settings', icon: <Settings size={24} />, text: 'Settings' },
    { path: '/super-admin/qr-scanner', icon: <QrCode size={24} />, text: 'QR Code Scanner' },
  ];
  useEffect(() => {
    const locationRefs = []; // Track refs
    const unsubscribes = []; // Track cleanup functions
  
    const mockWeatherData = () => {
      const today = new Date();
      const week = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        return {
          day: format(date, 'EEE'),
          temp: Math.floor(Math.random() * (85 - 65) + 65),
          date: format(date, 'yyyy-MM-dd')
        };
      });
      setWeekWeather(week);
    };
  
    const fetchLocationAnalytics = async () => {
      setLoading(true);
      try {
        const allLocationsData = await Promise.all(
          locations.map(async (location) => {
            const locationRef = ref(database, `attendance/${location}`);
            locationRefs.push(locationRef); // Store ref
  
            return new Promise((resolve) => {
              const unsubscribe = onValue(locationRef, (snapshot) => {
                const data = snapshot.val();
                resolve({ location, data: data ? Object.values(data) : [] });
              }, (error) => {
                console.error(`Error fetching data for ${location}:`, error);
                resolve({ location, data: [] });
              });
              unsubscribes.push(unsubscribe); // Store unsubscribe function
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
    mockWeatherData();
  
    // Cleanup
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
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
        .map(employee => ({ ...employee, location }));
      topEmployees = [...topEmployees, ...highPerformers];
    });
    return topEmployees;
  };

  const getPageTitle = () => {
    const titles = {
      '/super-admin/locations': 'Manage Locations',
      '/super-admin/manage-admins': 'Manage Administrators',
      '/super-admin/manage-employees': 'Manage Employees',
      '/super-admin/reports': 'Attendance Reports',
      '/super-admin/settings': 'Settings',
      '/super-admin/qr-scanner': 'QR Code Scanner',
      '/super-admin/scheduler': 'Schedule Manager',
    };
    return titles[location.pathname] || 'Super Admin Dashboard';
  };

  const renderContent = () => {
    if (error) return <div className="error-message">{error}</div>;
    if (loading) return <div className="loading-message">Loading data...</div>;
    return location.pathname === '/super-admin' 
      ? <Dashboard locationAnalytics={locationAnalytics} topEmployees={topEmployees} locations={locations} />
      : <Outlet />;
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="logo" className="sidebar-logo" />
          <h2>Super Admin</h2>
          <button className="toggle-sidebar" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul>
            {navItems.map((item) => (
              <li key={item.path}>
                <Link to={item.path} className={location.pathname === item.path ? 'active' : ''}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.text}</span>
                </Link>
              </li>
            ))}
            <li className="logout-item">
              <Link to="/login">
                <span className="nav-icon"><LogOut size={24} /></span>
                <span className="nav-text">Logout</span>
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className={`admin-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="main-header">
          <div className="header-content">
            <h1>{getPageTitle()}</h1>
            <span className="current-date">{format(new Date(), 'MMMM d, yyyy')}</span>
          </div>
        </header>
        <div className="main-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default SuperAdmin;
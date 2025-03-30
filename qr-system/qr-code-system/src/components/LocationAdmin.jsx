import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../services/authContext';
import './SuperAdmin/SuperAdmin.css'; // Reuse the SuperAdmin CSS
import logo from './logo.png';
import {
  Home, Users, FileText, Settings, Calendar, QrCode,
  LogOut, ChevronLeft, ChevronRight, User, Shield
} from 'lucide-react';

const LocationAdmin = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get user information from auth context
  const { user } = useAuth();

  // Ensure user is loaded
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // If no user, show loading
  if (!user) {
    return (
      <div className="loading-overlay">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Determine available locations for this admin
  const adminLocations = user?.managementPermissions?.managedLocations || [];
  const hasAllLocations = adminLocations.includes('*');

  const navItems = [
    { path: '/location-admin', icon: <Home size={24} />, text: 'Dashboard Overview' },
    { path: '/location-admin/manage-employees', icon: <Users size={24} />, text: 'Manage Employees' },
    { path: '/location-admin/scheduler', icon: <Calendar size={24} />, text: 'Schedule Manager' },
    { path: '/location-admin/reports', icon: <FileText size={24} />, text: 'Attendance Reports' },
    { path: '/location-admin/settings', icon: <Settings size={24} />, text: 'Settings' },
    { path: '/location-admin/qr-scanner', icon: <QrCode size={24} />, text: 'QR Code Scanner' },
    { path: '/location-admin/add-user', icon: <User size={24} />, text: 'Add User' },
  ];

  const getPageTitle = () => {
    const titles = {
      '/location-admin/manage-employees': 'Manage Employees',
      '/location-admin/reports': 'Attendance Reports',
      '/location-admin/settings': 'Settings',
      '/location-admin/qr-scanner': 'QR Code Scanner',
      '/location-admin/scheduler': 'Schedule Manager',
      '/location-admin/add-user': 'Add User',
      '/location-admin/users': 'Employee Profile',
      '/location-admin/stats': 'Attendance Statistics',
    };
    
    // Check if we're on a user profile page
    if (location.pathname.includes('/location-admin/users/')) {
      return 'Employee Profile';
    }
    
    // Check if we're on a stats page
    if (location.pathname.includes('/location-admin/stats/')) {
      return 'Attendance Statistics';
    }
    
    return titles[location.pathname] || 'Location Admin Dashboard';
  };

  // Format role for display
  const formatRole = (role) => {
    if (!role) return 'Unknown';
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Function to render role badge with appropriate styling
  const getRoleBadge = (role) => {
    if (!role) return null;
    
    const roleLower = role.toLowerCase();
    let badgeClass = 'role-badge';
    
    if (roleLower.includes('super')) {
      badgeClass += ' super-admin-badge';
    } else if (roleLower.includes('admin')) {
      badgeClass += ' admin-badge';
    } else {
      badgeClass += ' employee-badge';
    }
    
    return <span className={badgeClass}>{formatRole(role)}</span>;
  };

  // Function to format the locations list
  const formatLocations = (permissions) => {
    if (!permissions || !permissions.managedLocations) return 'None';
    
    const locations = permissions.managedLocations;
    if (locations.includes('*')) return 'All Locations';
    
    return locations.join(', ');
  };

  // Function to format the departments list
  const formatDepartments = (permissions) => {
    if (!permissions || !permissions.managedDepartments) return 'None';
    
    const departments = permissions.managedDepartments;
    if (departments.includes('*')) return 'All Departments';
    
    return departments.join(', ');
  };

  // Handle logout
  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="logo" className="sidebar-logo" />
          <h2>Location Admin</h2>
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
              <button onClick={handleLogout} className="logout-button">
                <span className="nav-icon"><LogOut size={24} /></span>
                <span className="nav-text">Logout</span>
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <main className={`admin-main ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="main-header">
          <div className="header-content">
            <h1>{getPageTitle()}</h1>
            <div className="header-right">
              <span className="current-date">{format(new Date(), 'MMMM d, yyyy')}</span>
              
              {/* User information dropdown */}
              <div className="user-info-container">
                <button 
                  className="user-info-button" 
                  onClick={() => setShowUserInfo(!showUserInfo)}
                  aria-label="Toggle user information"
                >
                  {user ? (
                    <div className="user-button-content">
                      <User size={20} />
                      <span className="user-name">{user.profile?.name || user.email}</span>
                      {getRoleBadge(user.role)}
                    </div>
                  ) : (
                    <Shield size={20} />
                  )}
                </button>
                
                {/* Dropdown with detailed user permissions */}
                {showUserInfo && user && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <h3>{user.profile?.name || 'User'}</h3>
                      <p className="user-email">{user.email}</p>
                      {getRoleBadge(user.role)}
                    </div>
                    
                    <div className="user-permissions">
                      <h4>Permissions</h4>
                      
                      <div className="permission-item">
                        <span className="permission-label">Locations:</span>
                        <span className="permission-value">
                          {formatLocations(user.managementPermissions)}
                        </span>
                      </div>
                      
                      <div className="permission-item">
                        <span className="permission-label">Departments:</span>
                        <span className="permission-value">
                          {formatDepartments(user.managementPermissions)}
                        </span>
                      </div>
                      
                      <Link to="/account-settings" className="settings-link">
                        <Settings size={16} />
                        <span>Account Settings</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="main-content">
          {location.pathname === '/location-admin' ? (
            // Render dashboard directly instead of importing it to avoid circular dependencies
            // Pass props required by the dashboard component
            <Outlet context={{ adminLocations, hasAllLocations }} />
          ) : (
            <Outlet context={{ adminLocations, hasAllLocations }} />
          )}
        </div>
      </main>
    </div>
  );
};

export default LocationAdmin;
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './services/PrivateRoute';
import AuthProvider from './services/authContext';
import { SchedulerProvider } from './components/Scheduler/context/SchedulerContext';
import './components/App.css';
import './index.css';
import './components/glass-theme.css';


// Scheduler Module
import Scheduler from './components/Scheduler/SchedulerContainer';

// Admin Module - Main components
import SuperAdmin from './components/SuperAdmin/SuperAdmin';
import LocationAdminDashboard from './components/LocationAdminDashboard';
import ManageEmployees from './components/ManageEmployees';
import Reports from './components/Reports';
import Settings from './components/Settings';
import AddUser from './components/AddUser';
import AccountSettings from './components/AccountSettings';
import QRScannerPage from './components/QRScannerPage';
import EmployeeProfile from './components/EmployeeProfile/EmployeeProfile';
import ClearAndAddEmployees from './components/clearAndAddEmployees';
import ManageAdmins from './components/ManageAdmins';
// Core components that need lazy loading
const Login = React.lazy(() => import('./components/Login'));
const Profile = React.lazy(() => import('./components/Profile'));
const UserDashboard = React.lazy(() => import('./components/UserDashboard'));
const NotFound = React.lazy(() => import('./components/NotFound'));

function App() {
  return (
    <AuthProvider>
      <SchedulerProvider>
        <Router>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />

              {/* Super Admin Routes */}
              <Route
                path="/super-admin/*"
                element={
                  <PrivateRoute requiredRole="SUPER_ADMIN">
                    <SuperAdmin />
                  </PrivateRoute>
                }
              >
                <Route path="manage-employees" element={<ManageEmployees />} />
                <Route path="manage-admins" element={<ManageAdmins />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="add-user" element={<AddUser />} />
                <Route path="scheduler" element={<Scheduler />} />
                <Route path="update-employees" element={<ClearAndAddEmployees />} />
                <Route path="account-settings" element={<AccountSettings />} />
                <Route path="qr-scanner" element={<QRScannerPage />} />
                <Route path="users/:employeeId" element={<EmployeeProfile />} />
              </Route>

              {/* Location Admin Routes */}
              <Route
                path="/location-admin/*"
                element={
                  <PrivateRoute requiredRole="ADMIN">
                    <LocationAdminDashboard />
                  </PrivateRoute>
                }
              >
                <Route path="employees" element={<ManageEmployees />} />
                <Route path="scheduler" element={<Scheduler />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="account-settings" element={<AccountSettings />} />
                <Route path="qr-scanner" element={<QRScannerPage />} />
              </Route>

              {/* Employee Routes */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute requiredRole="EMPLOYEE">
                    <UserDashboard />
                  </PrivateRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <PrivateRoute requiredRole="EMPLOYEE">
                    <Profile />
                  </PrivateRoute>
                }
              />

              {/* Shared Routes */}
              <Route
                path="/account-settings"
                element={
                  <PrivateRoute>
                    <AccountSettings />
                  </PrivateRoute>
                }
              />

              {/* Not Found Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </SchedulerProvider>
    </AuthProvider>
  );
}

export default App;
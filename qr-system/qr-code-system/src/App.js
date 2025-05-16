import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './services/PrivateRoute';
import AuthProvider, { useAuth } from './services/authContext';
import { SchedulerProvider } from './components/Scheduler/context/SchedulerContext';
import './components/App.css';
import './index.css';
import './components/glass-theme.css';
import EmployeeListPage from './components/EmployeeListPage';

/* Direct imports */
import Scheduler from './components/Scheduler/SchedulerContainer';
import SuperAdmin from './components/SuperAdmin/SuperAdmin';
import LocationAdmin from './components/LocationAdmin';
import LocationAdminDashboard from './components/LocationAdminDashboard';
import ManageEmployees from './components/ManageEmployees';
import ManageAdmins from './components/ManageAdmins';
import Reports from './components/Reports';
import Settings from './components/Settings';
import AddUser from './components/AddUser';
import AccountSettings from './components/AccountSettings';
import QRScannerPage from './components/QRScannerPage';
import EmployeeProfile from './components/EmployeeProfile/EmployeeProfile';
import StatDetails from './components/SuperAdmin/StatDetails';
import UserProfile from './components/UserProfile/UserDashboard';
import UserDashboard from './components/UserProfile/UserDashboard';

/* Lazy imports */
const Login = React.lazy(() => import('./components/Login'));
const NotFound = React.lazy(() => import('./components/NotFound'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

// The main app content that renders after auth is initialized
function AppContent() {
  const { loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="employee-list" element={<EmployeeListPage />} />

        {/* Employee Routes */}
        <Route path="/dashboard" element={<PrivateRoute requiredRole="EMPLOYEE"><UserDashboard /></PrivateRoute>} />

        {/* Super Admin Routes */}
        <Route path="/super-admin/*" element={<PrivateRoute requiredRole="SUPER_ADMIN"><SuperAdmin /></PrivateRoute>}>
          <Route path="manage-employees" element={<ManageEmployees />} />
          <Route path="manage-admins" element={<ManageAdmins />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="add-user" element={<AddUser />} />
          <Route path="scheduler" element={
            <SchedulerProvider>
              <Scheduler />
            </SchedulerProvider>
          } />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="qr-scanner" element={<QRScannerPage />} />
          <Route path="users/:employeeId" element={<EmployeeProfile />} />
          <Route path="stats/:status" element={<StatDetails />} />
        </Route>

        {/* Location Admin Routes - FIXED to properly use LocationAdmin as parent */}
        <Route path="/location-admin/*" element={<PrivateRoute requiredRole="ADMIN"><LocationAdmin /></PrivateRoute>}>
          <Route index element={<LocationAdminDashboard />} />
          <Route path="manage-employees" element={<ManageEmployees locationFiltered={true} />} />
          <Route path="reports" element={<Reports locationFiltered={true} />} />
          <Route path="settings" element={<Settings />} />
          <Route path="add-user" element={<AddUser locationRestricted={true} />} />
          <Route path="scheduler" element={
            <SchedulerProvider locationFiltered={true}>
              <Scheduler />
            </SchedulerProvider>
          } />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="qr-scanner" element={<QRScannerPage />} />
          <Route path="users/:employeeId" element={<EmployeeProfile locationRestricted={true} />} />
          <Route path="stats/:status" element={<StatDetails locationFiltered={true} />} />
        </Route>

        {/* Shared Routes */}
        <Route path="/account-settings" element={<PrivateRoute><AccountSettings /></PrivateRoute>} />

        {/* Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
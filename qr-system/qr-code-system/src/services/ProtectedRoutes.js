// src/routes/ProtectedRoutes.js
import React from 'react';
import { Route, Navigate, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { SchedulerProvider } from '../components/Scheduler/context/SchedulerContext';

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
  </div>
);

// Auth wrapper component that verifies role permissions
const AuthGuard = ({ children, requiredRole }) => {
  const { user, loading, hasRequiredRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth state is being determined
  if (loading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect based on user's role if they don't have the required role
  if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
    switch (user.role.toLowerCase()) {
      case 'super_admin':
        return <Navigate to="/super-admin" replace />;
      case 'admin':
        return <Navigate to="/location-admin" replace />;
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  // User is authenticated and authorized
  return children;
};

// Component for routes that need the Scheduler context
const SchedulerRoute = ({ element, requiredRole }) => {
  const location = useLocation();
  
  return (
    <AuthGuard requiredRole={requiredRole}>
      <SchedulerProvider>
        {element}
      </SchedulerProvider>
    </AuthGuard>
  );
};

// Component for regular protected routes (without Scheduler context)
const ProtectedRoute = ({ element, requiredRole }) => (
  <AuthGuard requiredRole={requiredRole}>
    {element}
  </AuthGuard>
);

// Main component that sets up all protected routes
const ProtectedRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      
      {/* Employee routes */}
      <Route 
        path="/dashboard" 
        element={<ProtectedRoute element={<DashboardPage />} requiredRole="employee" />} 
      />
      <Route 
        path="/profile" 
        element={<ProtectedRoute element={<ProfilePage />} requiredRole="employee" />} 
      />
      
      {/* Scheduler routes for employees */}
      <Route 
        path="/my-schedule" 
        element={<SchedulerRoute element={<EmployeeSchedulePage />} requiredRole="employee" />} 
      />

      {/* Admin routes */}
      <Route 
        path="/location-admin" 
        element={<ProtectedRoute element={<LocationAdminPage />} requiredRole="admin" />} 
      />
      <Route 
        path="/user-management" 
        element={<ProtectedRoute element={<UserManagementPage />} requiredRole="admin" />} 
      />
      
      {/* Scheduler routes for admins */}
      <Route 
        path="/scheduler" 
        element={<SchedulerRoute element={<SchedulerPage />} requiredRole="admin" />} 
      />
      <Route 
        path="/events/:eventId" 
        element={<SchedulerRoute element={<EventDetailsPage />} requiredRole="admin" />} 
      />
      
      {/* Super Admin routes */}
      <Route 
        path="/super-admin" 
        element={<ProtectedRoute element={<SuperAdminDashboard />} requiredRole="super_admin" />} 
      />
      <Route 
        path="/system-settings" 
        element={<ProtectedRoute element={<SystemSettingsPage />} requiredRole="super_admin" />} 
      />
      
      {/* Catch-all route - redirect to appropriate dashboard based on role */}
      <Route 
        path="*" 
        element={<AuthRedirect />} 
      />
    </Routes>
  );
};

// Component to redirect users based on their role
const AuthRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Redirect based on role
  switch (user.role.toLowerCase()) {
    case 'super_admin':
      return <Navigate to="/super-admin" replace />;
    case 'admin':
      return <Navigate to="/location-admin" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
};

// Placeholder components - replace with your actual components
const LoginPage = () => <div>Login Page</div>;
const RegisterPage = () => <div>Register Page</div>;
const ForgotPasswordPage = () => <div>Forgot Password Page</div>;
const DashboardPage = () => <div>Employee Dashboard</div>;
const ProfilePage = () => <div>User Profile</div>;
const EmployeeSchedulePage = () => <div>My Schedule</div>;
const LocationAdminPage = () => <div>Location Admin Dashboard</div>;
const UserManagementPage = () => <div>User Management</div>;
const SchedulerPage = () => <div>Scheduler</div>;
const EventDetailsPage = () => <div>Event Details</div>;
const SuperAdminDashboard = () => <div>Super Admin Dashboard</div>;
const SystemSettingsPage = () => <div>System Settings</div>;

export default ProtectedRoutes;
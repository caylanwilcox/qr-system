import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

/**
 * Enhanced PrivateRoute component that handles authentication and role-based access
 * @param {Object} props 
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {string} [props.requiredRole] - Optional role requirement
 * @returns {React.ReactNode}
 */
const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading, hasRequiredRole } = useAuth();
  const location = useLocation();

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements if specified
  if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
    // Redirect based on user's role
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'super_admin':
        return <Navigate to="/super-admin" replace />;
      case 'ADMIN':
      case 'admin':
        return <Navigate to="/location-admin" replace />;
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  // User is authenticated and has required permissions, render children
  return children;
};

export default PrivateRoute;
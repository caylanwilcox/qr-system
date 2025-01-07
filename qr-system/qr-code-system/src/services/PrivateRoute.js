import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

const PrivateRoute = ({ children, requiredRole }) => {
  const { user, loading, hasRequiredRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRequiredRole(user.role, requiredRole)) {
    // Redirect based on user's role
    switch (user.role) {
      case 'SUPER_ADMIN':
        return <Navigate to="/super-admin" replace />;
      case 'ADMIN':
        return <Navigate to="/location-admin" replace />;
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default PrivateRoute;
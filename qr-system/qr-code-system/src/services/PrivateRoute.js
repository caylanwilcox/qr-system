import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './authContext';  // Make sure this path is correct

const PrivateRoute = ({ children, requiredRole }) => {
  const { user } = useContext(AuthContext);

  // If the user is not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If the user does not have the required role, redirect to login or access-denied
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" />;
  }

  // If the user is authenticated and has the required role, allow access
  return children;
};

export default PrivateRoute;

// src/components/Scheduler/context/hooks/useAuthState.js
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../services/authContext';

export const useAuthState = () => {
  const auth = useAuth();
  const user = auth?.user;
  const userProfile = user?.profile;
  const adminPermissions = user?.managementPermissions;

  // Check if a user can manage a specific location
  const canManageLocation = (locationName) => {
    if (!locationName || !userProfile) return false;
    
    // Super admins can manage all locations
    if (userProfile.role === 'super_admin') return true;
    
    // Check if admin can manage this location
    if (userProfile.role === 'admin' && adminPermissions) {
      return adminPermissions.managedLocations?.[locationName] === true;
    }
    
    // Regular employees can't manage locations
    return false;
  };

  return {
    currentUser: user,
    userProfile,
    adminPermissions,
    canManageLocation
  };
};
//src/services/authContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult,
  updatePassword, 
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, database } from './firebaseConfig';
import { resolveRole, hasRoleAtLeast } from '../utils/roles';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Management permissions for an admin or super admin, or null. If the entry
// can't be read (the database rules refuse a login that has no role claim
// yet), the person still signs in, with no managed locations.
async function loadManagementPermissions(uid, role) {
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'super_admin';
  const isAdmin = role === 'ADMIN' || role === 'admin';
  if (!isSuperAdmin && !isAdmin) return null;

  let snapshot = null;
  try {
    snapshot = await get(ref(database, `managementStructure/${uid}`));
  } catch (error) {
    console.error('Could not read management permissions:', error);
  }
  if (snapshot && snapshot.exists()) {
    const mgmtData = snapshot.val();
    return {
      role: mgmtData.role || role.toLowerCase(),
      managedLocations: mgmtData.managedLocations ? Object.keys(mgmtData.managedLocations) : [],
      managedDepartments: mgmtData.managedDepartments ? Object.keys(mgmtData.managedDepartments) : []
    };
  }
  if (isSuperAdmin) {
    // A super admin without an entry manages everything ('*' means all).
    return { role: 'super_admin', managedLocations: ['*'], managedDepartments: ['*'] };
  }
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [managementPermissions, setManagementPermissions] = useState(null);

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await getIdTokenResult(userCredential.user);
      
      // Get additional user data from the database
      const userRef = ref(database, `users/${userCredential.user.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      // Get role from profile if it exists, otherwise from claims or default
      // Normalized so stored spellings like "super-admin" still match.
      const userRole = resolveRole(userData?.profile?.role, idTokenResult.claims.role);
      const permissions = await loadManagementPermissions(userCredential.user.uid, userRole);

      const userWithRole = {
        ...userCredential.user,
        role: userRole,
        // Screens like the Scheduler read profile.role, so normalize it too.
        profile: { ...(userData?.profile || {}), role: userRole },
        managementPermissions: permissions
      };

      // Set the user now, so the page the login screen opens next doesn't
      // send them back to /login while the auth listener is still loading.
      setManagementPermissions(permissions);
      setUser(userWithRole);
      return userWithRole;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign out function
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setManagementPermissions(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Reauthenticate the user (required before changing password)
  const reauthenticateUser = async (currentPassword) => {
    try {
      if (!auth.currentUser) {
        throw new Error('No user is logged in');
      }
      
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(auth.currentUser, credential);
      return true;
    } catch (error) {
      console.error('Reauthentication error:', error);
      throw error;
    }
  };

  // Change user password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      // First reauthenticate
      await reauthenticateUser(currentPassword);
      
      // Then update password
      await updatePassword(auth.currentUser, newPassword);
      
      return true;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  };

  // Check if user has required role
  const hasRequiredRole = (userRole, requiredRole) => {
    return hasRoleAtLeast(userRole, requiredRole);
  };

  // Check if user can manage a location
  const canManageLocation = (location) => {
    if (!user || !user.managementPermissions) return false;
    
    // Super admin can manage all locations
    if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin') return true;
    
    // Special wildcard permission
    if (user.managementPermissions.managedLocations.includes('*')) return true;
    
    // Check specific location
    return user.managementPermissions.managedLocations.includes(location);
  };

  // Check if user can manage a department
  const canManageDepartment = (department) => {
    if (!user || !user.managementPermissions) return false;
    
    // Super admin can manage all departments
    if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin') return true;
    
    // Special wildcard permission
    if (user.managementPermissions.managedDepartments.includes('*')) return true;
    
    // Check specific department
    return user.managementPermissions.managedDepartments.includes(department);
  };

  // Get all locations that the current user can manage
  const getManagedLocations = async () => {
    if (!user) return [];
    
    try {
      // Super admin can manage all locations
      if (user.role === 'SUPER_ADMIN' || user.role === 'super_admin') {
        // First try to get locations from a dedicated locations node if it exists
        const locationsRef = ref(database, 'locations');
        const locationsSnapshot = await get(locationsRef);
        
        if (locationsSnapshot.exists()) {
          const locationsData = locationsSnapshot.val();
          // Convert to array if it's an object
          return Array.isArray(locationsData) 
            ? locationsData 
            : Object.keys(locationsData);
        }
        
        // If no dedicated locations node, extract from user profiles
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          const uniqueLocations = new Set();
          
          Object.values(usersData).forEach(userData => {
            if (userData.profile) {
              const location = userData.profile.primaryLocation || userData.profile.location;
              if (location) {
                uniqueLocations.add(location);
              }
            }
          });
          
          return Array.from(uniqueLocations).sort();
        }
        
        return [];
      }
      
      // Regular admin - get managed locations from permissions
      if (user.managementPermissions?.managedLocations) {
        return user.managementPermissions.managedLocations.filter(loc => loc !== '*');
      }
      
      return [];
    } catch (error) {
      console.error('Error getting managed locations:', error);
      return [];
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get custom claims and database data
          const [tokenResult, userSnapshot] = await Promise.all([
            // Fresh token on every load, so a role claim changed on the server
            // reaches the database rules without waiting up to an hour.
            // If only the network fails, the cached token is used; any other
            // error (disabled or expired login) still signs the user out.
            getIdTokenResult(firebaseUser, true).catch((error) => {
              if (error?.code === 'auth/network-request-failed') return getIdTokenResult(firebaseUser);
              throw error;
            }),
            get(ref(database, `users/${firebaseUser.uid}`))
          ]);

          const userData = userSnapshot.val();
          // Normalized so stored spellings like "super-admin" still match.
          const role = resolveRole(userData?.profile?.role, tokenResult.claims.role);
          const permissions = await loadManagementPermissions(firebaseUser.uid, role);

          setManagementPermissions(permissions);
          setUser({
            ...firebaseUser,
            role,
            // Screens like the Scheduler read profile.role, so normalize it too.
            profile: { ...(userData?.profile || {}), role },
            managementPermissions: permissions
          });
        } else {
          setUser(null);
          setManagementPermissions(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setManagementPermissions(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    signIn,
    signOut: handleSignOut,
    hasRequiredRole,
    canManageLocation,
    canManageDepartment,
    managementPermissions,
    getManagedLocations,
    changePassword,
    reauthenticateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
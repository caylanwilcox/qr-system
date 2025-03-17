import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, database } from './firebaseConfig';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const ROLE_HIERARCHY = {
  SUPER_ADMIN: 3,
  super_admin: 3, // Support lowercase version
  ADMIN: 2,
  admin: 2, // Support lowercase version
  EMPLOYEE: 1,
  employee: 1 // Support lowercase version
};

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
      const userRole = userData?.profile?.role || idTokenResult.claims.role || 'EMPLOYEE';
      
      // Get management permissions if admin or super_admin
      let permissions = null;
      if (userRole === 'SUPER_ADMIN' || userRole === 'super_admin' || 
          userRole === 'ADMIN' || userRole === 'admin') {
        const mgmtRef = ref(database, `managementStructure/${userCredential.user.uid}`);
        const mgmtSnapshot = await get(mgmtRef);
        
        if (mgmtSnapshot.exists()) {
          const mgmtData = mgmtSnapshot.val();
          permissions = {
            role: mgmtData.role || userRole.toLowerCase(),
            managedLocations: mgmtData.managedLocations ? Object.keys(mgmtData.managedLocations) : [],
            managedDepartments: mgmtData.managedDepartments ? Object.keys(mgmtData.managedDepartments) : []
          };
        } else if (userRole === 'SUPER_ADMIN' || userRole === 'super_admin') {
          // Super admin without explicit permissions can manage everything
          // This ensures super admin works even without management structure entry
          permissions = {
            role: 'super_admin',
            managedLocations: ['*'], // Special wildcard meaning "all locations"
            managedDepartments: ['*'] // Special wildcard meaning "all departments"
          };
        }
      }

      const userWithRole = {
        ...userCredential.user,
        role: userRole,
        profile: userData?.profile || {},
        managementPermissions: permissions
      };

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

  // Check if user has required role
  const hasRequiredRole = (userRole, requiredRole) => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
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

  // NEW FUNCTION: Get all locations that the current user can manage
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
            getIdTokenResult(firebaseUser),
            get(ref(database, `users/${firebaseUser.uid}`))
          ]);

          const userData = userSnapshot.val();
          const role = userData?.profile?.role || tokenResult.claims.role || 'EMPLOYEE';
          
          // Get management permissions if admin or super_admin
          let permissions = null;
          if (role === 'SUPER_ADMIN' || role === 'super_admin' || 
              role === 'ADMIN' || role === 'admin') {
            const mgmtRef = ref(database, `managementStructure/${firebaseUser.uid}`);
            const mgmtSnapshot = await get(mgmtRef);
            
            if (mgmtSnapshot.exists()) {
              const mgmtData = mgmtSnapshot.val();
              permissions = {
                role: mgmtData.role || role.toLowerCase(),
                managedLocations: mgmtData.managedLocations ? Object.keys(mgmtData.managedLocations) : [],
                managedDepartments: mgmtData.managedDepartments ? Object.keys(mgmtData.managedDepartments) : []
              };
            } else if (role === 'SUPER_ADMIN' || role === 'super_admin') {
              // Super admin without explicit permissions can manage everything
              permissions = {
                role: 'super_admin',
                managedLocations: ['*'], // Special wildcard for all locations
                managedDepartments: ['*'] // Special wildcard for all departments
              };
            }
          }
          
          setManagementPermissions(permissions);
          setUser({
            ...firebaseUser,
            role,
            profile: userData?.profile || {},
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
    getManagedLocations // Add the new function
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
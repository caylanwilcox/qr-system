// src/services/authService.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  getIdTokenResult
} from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
import { auth, database } from './firebaseConfig';

/**
 * Register a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {Object} profileData - Additional profile data
 * @returns {Promise<Object>} - The registered user data
 */
export const registerUser = async (email, password, profileData = {}) => {
  try {
    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Add additional profile data to the database
    const userRef = ref(database, `users/${user.uid}`);
    await set(userRef, {
      profile: {
        ...profileData,
        email,
        createdAt: new Date().toISOString(),
        role: profileData.role || 'employee', // Default role
      },
      stats: {
        lastLogin: new Date().toISOString(),
      }
    });
    
    console.log('User registered successfully:', user.uid);
    return user;
  } catch (error) {
    console.error('Error registering user:', error.message);
    throw error; // Rethrow to handle in the UI
  }
};

/**
 * Log in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<Object>} - The logged in user with profile data
 */
export const loginUser = async (email, password) => {
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get custom claims and additional user data
    const tokenResult = await getIdTokenResult(user);
    
    // Get profile data from the database
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);
    let userData = snapshot.exists() ? snapshot.val() : {};
    
    // Get management permissions if admin/super_admin
    let managementPermissions = null;
    const role = userData?.profile?.role?.toLowerCase?.() || '';
    
    if (role === 'admin' || role === 'super_admin' || role === 'super-admin') {
      const mgmtRef = ref(database, `managementStructure/${user.uid}`);
      const mgmtSnapshot = await get(mgmtRef);
      
      if (mgmtSnapshot.exists()) {
        const mgmtData = mgmtSnapshot.val();
        managementPermissions = {
          role: mgmtData.role || role,
          managedLocations: mgmtData.managedLocations ? Object.keys(mgmtData.managedLocations) : [],
          managedDepartments: mgmtData.managedDepartments ? Object.keys(mgmtData.managedDepartments) : []
        };
      } else if (role === 'super_admin' || role === 'super-admin') {
        // Super admin without explicit permissions can manage everything
        managementPermissions = {
          role: 'super_admin',
          managedLocations: ['*'], // Special wildcard meaning "all locations"
          managedDepartments: ['*'] // Special wildcard meaning "all departments"
        };
      }
    }
    
    // Update last login time
    const updates = {
      'stats/lastLogin': new Date().toISOString()
    };
    
    await update(userRef, updates);
    
    // Combine everything into a complete user object
    const completeUser = {
      ...user,
      role: userData?.profile?.role || 'employee',
      profile: userData?.profile || {},
      stats: userData?.stats || {},
      managementPermissions
    };
    
    console.log('User logged in successfully:', user.uid);
    return completeUser;
  } catch (error) {
    console.error('Error logging in user:', error.code, error.message);
    
    // Provide more specific error messages based on Firebase error codes
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account exists with this email address.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many login attempts. Please try again later or reset your password.');
    } else {
      throw error; // Rethrow to handle in the UI
    }
  }
};

/**
 * Log out the current user
 * @returns {Promise<void>}
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log('User logged out successfully');
  } catch (error) {
    console.error('Error logging out user:', error.message);
    throw error; // Rethrow to handle in the UI
  }
};

/**
 * Get the current authenticated user with profile data
 * @returns {Promise<Object|null>} - The current user or null if not authenticated
 */
export const getCurrentUser = async () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        resolve(null);
        return;
      }
      
      try {
        // Get profile data from the database
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.exists() ? snapshot.val() : {};
        
        // Get management permissions if admin/super_admin
        let managementPermissions = null;
        const role = userData?.profile?.role?.toLowerCase?.() || '';
        
        if (role === 'admin' || role === 'super_admin' || role === 'super-admin') {
          const mgmtRef = ref(database, `managementStructure/${user.uid}`);
          const mgmtSnapshot = await get(mgmtRef);
          
          if (mgmtSnapshot.exists()) {
            const mgmtData = mgmtSnapshot.val();
            managementPermissions = {
              role: mgmtData.role || role,
              managedLocations: mgmtData.managedLocations ? Object.keys(mgmtData.managedLocations) : [],
              managedDepartments: mgmtData.managedDepartments ? Object.keys(mgmtData.managedDepartments) : []
            };
          } else if (role === 'super_admin' || role === 'super-admin') {
            // Super admin without explicit permissions can manage everything
            managementPermissions = {
              role: 'super_admin',
              managedLocations: ['*'], // Special wildcard for all locations
              managedDepartments: ['*'] // Special wildcard for all departments
            };
          }
        }
        
        // Combine everything into a complete user object
        const completeUser = {
          ...user,
          role: userData?.profile?.role || 'employee',
          profile: userData?.profile || {},
          stats: userData?.stats || {},
          managementPermissions
        };
        
        resolve(completeUser);
      } catch (error) {
        console.error('Error getting current user:', error);
        reject(error);
      }
    }, reject);
  });
};

/**
 * Send a password reset email
 * @param {string} email - The email address to send the reset link to
 * @returns {Promise<void>}
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent');
  } catch (error) {
    console.error('Error sending password reset:', error.message);
    throw error; // Rethrow to handle in the UI
  }
};

/**
 * Update a user's profile in the database
 * @param {string} userId - The user's ID
 * @param {Object} profileData - The profile data to update
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = ref(database, `users/${userId}/profile`);
    await update(userRef, {
      ...profileData,
      updatedAt: new Date().toISOString()
    });
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error.message);
    throw error; // Rethrow to handle in the UI
  }
};
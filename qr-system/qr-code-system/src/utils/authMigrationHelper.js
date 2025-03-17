// src/utils/authMigrationHelper.js
import { ref, get, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';

/**
 * Updates the AuthContext with permissions from managementStructure
 * @param {Object} user - The current user object from AuthContext
 * @returns {Promise<Object>} - Enhanced user object with permissions
 */
export const enhanceUserWithManagementPermissions = async (user) => {
  if (!user) return null;
  
  try {
    // Get user management structure
    const managementRef = ref(database, `managementStructure/${user.uid}`);
    const managementSnapshot = await get(managementRef);
    
    // If no management structure, return original user
    if (!managementSnapshot.exists()) {
      return user;
    }
    
    const managementData = managementSnapshot.val();
    const managedLocations = Object.keys(managementData.managedLocations || {});
    const managedDepartments = Object.keys(managementData.managedDepartments || {});
    
    // Return enhanced user
    return {
      ...user,
      managementPermissions: {
        ...managementData,
        managedLocations,
        managedDepartments
      }
    };
  } catch (error) {
    console.error("Error enhancing user with management permissions:", error);
    return user;
  }
};

/**
 * Adapts the user management data for backwards compatibility
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export const adaptUserManagementForBackwardsCompatibility = async (userId) => {
  try {
    // Get user profile
    const userRef = ref(database, `users/${userId}/profile`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) {
      console.error("User profile not found for backwards compatibility");
      return;
    }
    
    const userProfile = userSnapshot.val();
    
    // If managedBy is already a user ID (not a location), skip
    if (userProfile.managedBy && userProfile.managedBy.includes('-')) {
      console.log("User already has a compatible managedBy field");
      return;
    }
    
    // Get management structure to find an admin for this location
    const managementRef = ref(database, 'managementStructure');
    const managementSnapshot = await get(managementRef);
    
    if (!managementSnapshot.exists()) {
      console.error("No management structure found");
      return;
    }
    
    const managementData = managementSnapshot.val();
    const userLocation = userProfile.primaryLocation || userProfile.location;
    
    if (!userLocation) {
      console.error("User has no location");
      return;
    }
    
    // Find an admin who manages this location
    let adminId = null;
    Object.entries(managementData).forEach(([id, data]) => {
      if (data.managedLocations && data.managedLocations[userLocation]) {
        // Prefer the first admin found (who is not super_admin)
        if (!adminId || (data.role !== 'super_admin' && managementData[adminId].role === 'super_admin')) {
          adminId = id;
        }
      }
    });
    
    if (!adminId) {
      console.error(`No admin found for location: ${userLocation}`);
      return;
    }
    
    // Update user's profile with adminId in managedBy for backwards compatibility
    const updates = {};
    
    // Keep the location in managedByLocation and use adminId in managedBy
    updates[`users/${userId}/profile/managedByLocation`] = userProfile.managedBy;
    updates[`users/${userId}/profile/managedBy`] = adminId;
    
    await update(ref(database), updates);
    console.log(`Updated user ${userId} for backwards compatibility`);
  } catch (error) {
    console.error("Error adapting user management:", error);
  }
};

/**
 * Run migration check for a specific user
 * @param {Object} user - The current user
 * @returns {Promise<void>}
 */
export const checkAndMigrateUserManagement = async (user) => {
  if (!user) return;
  
  try {
    // Get user profile
    const userRef = ref(database, `users/${user.uid}/profile`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) return;
    
    const userProfile = userSnapshot.val();
    
    // If user has a managedBy field that is a location (not a user ID)
    if (userProfile.managedBy && !userProfile.managedBy.includes('-')) {
      console.log("User needs migration for backwards compatibility");
      await adaptUserManagementForBackwardsCompatibility(user.uid);
    }
  } catch (error) {
    console.error("Error checking user management migration:", error);
  }
};
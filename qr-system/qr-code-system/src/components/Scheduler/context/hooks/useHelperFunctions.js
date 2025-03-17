// src/components/Scheduler/context/hooks/useHelperFunctions.js
import { startOfDay, endOfDay } from 'date-fns';
import { ref, get } from 'firebase/database';
import { database } from '../../../../services/firebaseConfig';

export const useHelperFunctions = ({ currentUser, userProfile, adminPermissions }, { events }) => {
  
  // Get events for a specific day
  const getEventsForDay = (selectedDate) => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= start && eventDate <= end;
    });
  };

  // Get events for a specific location
  const getEventsForLocation = (location) => {
    return events.filter(event => event.location === location);
  };

  // Get users that can be managed by this admin
  const getManageableUsers = async () => {
    if (!currentUser) return [];
    
    try {
      console.log("Getting manageable users for admin:", currentUser.uid);
      
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const allUsers = snapshot.val();
      
      // For super admins, return all users
      if (userProfile?.role === 'super_admin') {
        const users = Object.entries(allUsers)
          .filter(([_, userData]) => userData.profile)
          .map(([id, userData]) => ({
            id,
            name: userData.profile?.name,
            ...userData.profile
          }));
          
        console.log(`Super admin can manage ${users.length} users`);
        return users;
      }
      
      // For regular admins, filter by their managed locations and departments
      if (userProfile?.role === 'admin' && adminPermissions) {
        const users = Object.entries(allUsers)
          .filter(([id, userData]) => {
            if (!userData.profile) return false;
            
            const userLocation = userData.profile.primaryLocation || userData.profile.location;
            const userDepartment = userData.profile.department;
            
            const canManageLocation = adminPermissions.managedLocations?.[userLocation];
            const canManageDepartment = !userDepartment || 
                                        adminPermissions.managedDepartments?.[userDepartment];
            
            return canManageLocation && canManageDepartment;
          })
          .map(([id, userData]) => ({
            id,
            name: userData.profile?.name,
            ...userData.profile
          }));
          
        console.log(`Admin can manage ${users.length} users`);
        return users;
      }
      
      // Regular employees should only see themselves or their team
      return [];
    } catch (error) {
      console.error('Error fetching manageable users:', error);
      return [];
    }
  };

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
    getEventsForDay,
    getEventsForLocation,
    getManageableUsers,
    canManageLocation
  };
};
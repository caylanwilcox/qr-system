// src/components/Scheduler/context/hooks/useLocationState.js
import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../../../services/firebaseConfig';

export const useLocationState = () => {
  const [locations, setLocations] = useState([]);

  // Fetch locations from database
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Try to get locations from dedicated locations node
        const locationsRef = ref(database, 'locations');
        const snapshot = await get(locationsRef);
        
        if (snapshot.exists()) {
          const locationsData = snapshot.val();
          // Handle if locations is an array or an object with keys
          const locationsArray = Array.isArray(locationsData) 
            ? locationsData 
            : Object.keys(locationsData);
          
          setLocations(locationsArray.sort());
          return;
        }
        
        // Fallback to extracting locations from user profiles
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
          
          setLocations(Array.from(uniqueLocations).sort());
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };
    
    fetchLocations();
  }, []);

  return {
    locations
  };
};

// Add a default export as well
export default useLocationState;
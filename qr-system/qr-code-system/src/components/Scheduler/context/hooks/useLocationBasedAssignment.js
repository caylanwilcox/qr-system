/**
 * Assigns an event to all users in a specific location with robust error handling
 * @param {string} eventId - The ID of the event to assign
 * @param {string} locationName - The name of the location
 * @returns {Promise<object>} - Results of the assignment process
 */
const assignEventToLocation = async (eventId, locationName) => {
    if (!eventId || !locationName) {
      console.error("Missing eventId or locationName");
      return { success: false, message: "Missing required information for assignment" };
    }
  
    try {
      console.log(`Assigning event ${eventId} to all users in location ${locationName}`);
      
      // 1. Verify the event exists
      const eventRef = ref(database, `events/${eventId}`);
      const eventSnapshot = await get(eventRef);
      
      if (!eventSnapshot.exists()) {
        console.error(`Event ${eventId} not found`);
        return { success: false, message: `Event not found: ${eventId}` };
      }
      
      // 2. Get all users
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        console.error("No users found in database");
        return { success: false, message: "No users found in database" };
      }
      
      const usersData = usersSnapshot.val();
      
      // 3. Filter users by location - CASE INSENSITIVE matching
      const targetLocation = locationName.toLowerCase().trim();
      
      const usersInLocation = Object.entries(usersData)
        .filter(([_, userData]) => {
          const userLocationRaw = userData.profile?.primaryLocation || userData.profile?.location || '';
          const userLocation = userLocationRaw.toLowerCase().trim();
          return userLocation === targetLocation;
        })
        .map(([userId, userData]) => ({
          userId,
          name: userData.profile?.name || 'Unknown User',
          hasSchedule: Boolean(userData.schedule)
        }));
      
      console.log(`Found ${usersInLocation.length} users in location "${locationName}"`);
      
      if (usersInLocation.length === 0) {
        console.warn(`No users found in location: ${locationName}`);
        return { success: false, message: `No users found in location: ${locationName}` };
      }
      
      // 4. Create batch updates for all necessary operations
      const mainUpdates = {};
      
      // Add event to participants collection
      mainUpdates[`events/${eventId}/participants`] = usersInLocation.reduce((acc, user) => {
        acc[user.userId] = true;
        return acc;
      }, {});
      
      // Track successful assignments
      const results = {
        success: true,
        assigned: [],
        errors: [],
        usersMissingSchedule: []
      };
      
      // 5. Process each user individually to handle errors better
      for (const user of usersInLocation) {
        try {
          if (!user.hasSchedule) {
            // Create schedule node first if it doesn't exist
            results.usersMissingSchedule.push(user.userId);
            const scheduleRef = ref(database, `users/${user.userId}/schedule`);
            await set(scheduleRef, { [eventId]: true });
            results.assigned.push(user.userId);
          } else {
            // Add to batch update if schedule exists
            mainUpdates[`users/${user.userId}/schedule/${eventId}`] = true;
            results.assigned.push(user.userId);
          }
        } catch (error) {
          console.error(`Error assigning event to user ${user.userId}:`, error);
          results.errors.push({ userId: user.userId, error: error.message });
        }
      }
      
      // 6. Execute the main batch update if there are updates to apply
      if (Object.keys(mainUpdates).length > 0) {
        try {
          await update(ref(database), mainUpdates);
          console.log("Main batch update completed successfully");
        } catch (error) {
          console.error("Error in main batch update:", error);
          results.batchUpdateError = error.message;
          results.success = results.assigned.length > 0; // At least one successful assignment
        }
      }
      
      // 7. Add metadata to the event
      const metadataUpdates = {
        [`events/${eventId}/assignedToLocationAt`]: new Date().toISOString(),
        [`events/${eventId}/assignedToLocation`]: locationName,
        [`events/${eventId}/updatedAt`]: new Date().toISOString()
      };
      
      try {
        await update(ref(database), metadataUpdates);
      } catch (error) {
        console.error("Error updating event metadata:", error);
        results.metadataError = error.message;
      }
      
      return results;
    } catch (error) {
      console.error(`Error in assignEventToLocation:`, error);
      return { 
        success: false, 
        message: `Assignment failed: ${error.message}` 
      };
    }
  };
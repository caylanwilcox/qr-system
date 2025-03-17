// src/components/Scheduler/context/hooks/useDebugFunctions.js
import { ref, get, update } from "firebase/database";
import { database } from "../../../../services/firebaseConfig";

export const useDebugFunctions = (eventHandlers, authState) => {
  const { handleCreateEvent, assignToLocation } = eventHandlers;
  const { currentUser } = authState;
  
  // Check a user's schedule
  const checkUserSchedule = async (userId) => {
    try {
      const targetUserId = userId || currentUser?.uid;
      if (!targetUserId) {
        console.error("No user ID provided");
        return;
      }
      
      const userScheduleRef = ref(database, `users/${targetUserId}/schedule`);
      const snapshot = await get(userScheduleRef);
      
      if (snapshot.exists()) {
        console.log(`Schedule for user ${targetUserId}:`, snapshot.val());
        return snapshot.val();
      } else {
        console.log(`No schedule found for user ${targetUserId}`);
        return null;
      }
    } catch (error) {
      console.error("Error checking user schedule:", error);
      return null;
    }
  };

  // Create a test event for Aurora location
  const addTestEventForAurora = () => {
    const testEvent = {
      title: "Test Event at Aurora",
      description: "This is a test event at the Aurora location",
      location: "Aurora",
      start: new Date(),
      end: new Date(new Date().getTime() + 60 * 60 * 1000),
      isUrgent: false
    };
    
    handleCreateEvent(testEvent)
      .then(eventId => {
        if (eventId && assignToLocation) {
          console.log(`Test event created with ID: ${eventId}`);
          return assignToLocation(eventId, "Aurora");
        }
      })
      .then(result => {
        if (result) {
          console.log("Successfully assigned to Aurora users");
        }
      })
      .catch(error => {
        console.error("Error in test event creation:", error);
      });
  };

  return {
    checkUserSchedule,
    addTestEventForAurora
  };
};

export default useDebugFunctions;
// remove-scheduled-events.js
// Run this script to remove all scheduled events from the database

// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin using service account
// You'll need to fill in your service account details here
const serviceAccount = {
  "type": "service_account",
  "project_id": "qr-system-1cea7",
"private_key_id": "cccb9e75c7a15ffa6e4d9904967c99cf0f1b2a60",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCbK1xS5W949f6m\nc7lIDv5ygXX/HMYHLQ0VlaNxj/zlBILpDj4w/YvwcFgEAixvovd9jif5ddraSZf/\nXGEww1ap8XuQic1lWfFo/WAUzgCd9weCiHpFtx6L363uVUrekzGwdaHciUOQ3ulJ\nCsNB52GRIc3Z8eCTU+CpVWgq4/kNyamwuvmTOnRPveINnYbbd3OKwRHeoS1nUPX3\nMkmfJbeXIFkKZxMwG1Iocz9VKrVhvA/s6fBDS8FGPCDtkU4f9SaMsKLtSMq6ek3P\n1Z+iZ6gjzL/ZytT4jkLyG44Il7yHa9Zz6tUZ8kVcFpoJD0VCRvc4kKxapw6FF6EY\nF2rwv5UfAgMBAAECggEALPEWmOXd7u1kt4Yd/FpnZPfNGroVOv/X4dAI2jvndddk\nKScYaS0OanHHdEXC5ASR5PoW5uA1JnMZRHtXpP12rNsFvFvFMx0lWBDG0s/FivsA\n4FQyAd4jSUTcRgLLIAMG6cJwQoU5Hg0KCT9GRWDEN/pP+lddgZ5SHAliFcYYnN6/\nXT+LQZVaP3ba2EcgTldTYaR1rvi2aUjxnHSqtSfb5PCKiS94iIvjqDEhxp18qA7s\nCF5w7k0+qYe7A9K2a1Q3zamzHAdHC3v8imfT6vJW0QEstUGz8ppBo0KL0tIvFxBj\nAKHXSp98va2wlQRDGC/PvfwuaV2zZIw/49guQl3HgQKBgQDYtRJTPKCd/2x7jCjp\n6HQMpn4AfBOvxtlKy9s0DUtRvSVi++SkVJGp4skavXMiv28aCTrCC4f8TM2iKTrk\nQ+tlClEqb4W+va3nYjax3btxrbDdA2BeFc8gSrjQqzgQ9jC6mU+RIAhgz/026iNZ\navkvoDB/YncZxQ2K3wS+X41RgQKBgQC3TeArDbd6Chc6RGM6OelldmTOujEBp/Km\nSdY8Wn0kgPtP6Nc6ezWNAC04w/2iFSBWkNJX5v1kcFHBEUGsnKllxgeNnYLqgMDG\nLed03mU1NY3tf/P+Uq19ynE0BEzIeROJn3SX1nW0p0F8mfGT1WBhAq/BiiPgB/L9\n0Tk3z6j2nwKBgBu++0yq+4mfNX2QEYD5YTppasKXIFImLJYWCcfdV+JsTEgjJkAg\nD9JnlgYVcZNmXUxBGEPWBCA6mS2FB+RICfCS5JeBVed5E7YHbidR03kXmwiBMSp6\nsl1ZE9arxW7uhoitrnFPX6M9nhcU3VfKiYMeiHcW3VbwUu6P5WSWiVqBAoGAZTxi\nWQTbV1BpYanRb5/6UiogJLhaRoLeFY7j/jMvuFBv+8Mp00em3LfDQf2kf7bRRF35\nfci6G5WY4VtJfS6MtAO5ujHK0v7G+OzzTu1g0hFA0HGBbO12memLueHCElokOzbQ\nqucr3Nke5tUSwcXv08QrE2XayGk7f4jk4/kRZRsCgYEAwodRQYLPuGhhEV/EBD6W\nUHHOtEnv6pw3MmbZXNGMHkXXnBKwWuE0lNLJqlvru6yA2E9jMiEI1r9XNqiEKw2A\nT3QrFkAmtXZoUls/lXljcrXdTUfMmcp5SLAeu9297i9LLCmELZVOBf+oVKFCu+Ut\nSseQwsSZ+LvJKW3vXFTIijI=\n-----END PRIVATE KEY-----\n",  "client_email": "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",
  "client_email": "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",

};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
});

// Get database reference
const database = admin.database();

// Define the standardized event types for organized scanning
const EVENT_TYPES = {
  WORKSHOPS: 'workshops',
  MEETINGS: 'meetings',
  HACIENDAS: 'haciendas',
  JUNTA_HACIENDA: 'juntaHacienda',
  GESTION: 'gestion'
};

// Main function to remove scheduled events
async function removeScheduledEvents() {
  console.log('Starting removal of all scheduled events...');
  const updates = {};
  let eventsProcessed = 0;
  let usersProcessed = 0;
  let eventsRemoved = 0;
  let userEventsRemoved = 0;
  
  try {
    // 1. First, scan and mark events for removal in the events collection
    console.log('Scanning main events collection...');
    const eventsRef = database.ref('events');
    const eventsSnapshot = await eventsRef.once('value');
    
    if (eventsSnapshot.exists()) {
      const eventsData = eventsSnapshot.val();
      console.log(`Found ${Object.keys(eventsData).length} events`);
      
      for (const [eventId, eventData] of Object.entries(eventsData)) {
        eventsProcessed++;
        
        // Mark for removal: Set event to null to remove it
        updates[`events/${eventId}`] = null;
        eventsRemoved++;
        
        console.log(`Event ${eventId}: "${eventData.title}" marked for removal`);
      }
    } else {
      console.log('No events found in database');
    }
    
    // 2. Now find and remove scheduled events from user records
    console.log('Scanning user events...');
    const usersRef = database.ref('users');
    const usersSnapshot = await usersRef.once('value');
    
    if (usersSnapshot.exists()) {
      const usersData = usersSnapshot.val();
      console.log(`Found ${Object.keys(usersData).length} users`);
      
      for (const [userId, userData] of Object.entries(usersData)) {
        usersProcessed++;
        
        if (!userData.events) {
          console.log(`User ${userId} has no events, skipping`);
          continue;
        }
        
        // Clear user's schedule entirely
        if (userData.schedule) {
          updates[`users/${userId}/schedule`] = null;
        }
        
        // For each user, check all standard categories and remove events
        for (const category of Object.values(EVENT_TYPES)) {
          if (!userData.events[category]) continue;
          
          // Count events found
          const categoryEventCount = Object.keys(userData.events[category]).length;
          userEventsRemoved += categoryEventCount;
          
          // Remove all events in this category
          updates[`users/${userId}/events/${category}`] = null;
          
          console.log(`Removing ${categoryEventCount} ${category} events for user ${userId}`);
        }
        
        // Also check for any events in non-standard categories
        for (const [eventCategory, eventData] of Object.entries(userData.events)) {
          if (Object.values(EVENT_TYPES).includes(eventCategory)) {
            // Skip standard categories we already processed
            continue;
          }
          
          if (!eventData || typeof eventData !== 'object') continue;
          
          // Count and remove events in this non-standard category
          const nonStandardEventCount = Object.keys(eventData).length;
          userEventsRemoved += nonStandardEventCount;
          
          // Remove this category completely
          updates[`users/${userId}/events/${eventCategory}`] = null;
          console.log(`Removing ${nonStandardEventCount} events from non-standard category '${eventCategory}' for user ${userId}`);
        }
      }
    } else {
      console.log('No users found in database');
    }
    
    // Apply all updates
    if (Object.keys(updates).length > 0) {
      console.log(`Applying ${Object.keys(updates).length} database updates...`);
      await database.ref().update(updates);
      console.log('Events removal completed successfully');
    } else {
      console.log('No events to remove');
    }
    
    // Summary
    console.log(`
    ========= EVENT REMOVAL SUMMARY =========
    Events processed: ${eventsProcessed}
    Events removed:   ${eventsRemoved}
    Users processed:  ${usersProcessed}
    User events removed: ${userEventsRemoved}
    Total updates:    ${Object.keys(updates).length}
    ==========================================
    `);
    
  } catch (error) {
    console.error('Error removing events:', error);
  }
}

// Run the removal process
removeScheduledEvents()
  .then(() => {
    console.log('Event removal script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
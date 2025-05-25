// remove-scheduled-events.js
// Run this script to remove all scheduled events from the database

// Import Firebase Admin SDK
const admin = require('firebase-admin');
require('dotenv').config({ path: '../.env' });

// Initialize Firebase Admin using environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
};

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID', 
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n📝 Please create a .env file in the project root with your Firebase credentials.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
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
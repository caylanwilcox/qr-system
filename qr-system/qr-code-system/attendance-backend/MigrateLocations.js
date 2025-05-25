const admin = require("firebase-admin");
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

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.database();

// Normalize text to a key - same function used in your original code
const normalizeLocationKey = (text) => {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/\s+/g, '');
};

// Format display name - same function used in your original code
const formatDisplayName = (text) => {
  if (!text) return '';
  return text.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Extract locations from users
async function extractLocationsFromUsers() {
  try {
    console.log("Starting location extraction from users...");
    
    // Get all users
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      console.log("No users found in database!");
      return [];
    }
    
    const usersData = snapshot.val();
    console.log(`Found ${Object.keys(usersData).length} users in database`);
    
    // Extract all unique locations
    const locationSet = new Set();
    const locationDetails = new Map(); // To recreate the locations node if needed
    
    Object.entries(usersData).forEach(([userId, userData]) => {
      if (userData && userData.profile) {
        // Try all possible location fields
        const possibleLocations = [
          userData.location,
          userData.locationKey,
          userData.profile.location,
          userData.profile.locationKey, 
          userData.profile.primaryLocation
        ];
        
        let locationValue = null;
        let locationKey = null;
        
        // Find the first non-empty location
        for (const loc of possibleLocations) {
          if (loc && typeof loc === 'string' && loc.trim() !== '') {
            if (locationKey === null) {
              locationValue = formatDisplayName(loc.trim());
              locationKey = normalizeLocationKey(loc.trim());
              
              // Add to our set of unique locations
              locationSet.add(locationValue);
              
              // Store location details for potential recreation
              if (!locationDetails.has(locationKey)) {
                locationDetails.set(locationKey, {
                  name: locationValue,
                  key: locationKey,
                  active: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }
        }
      }
    });
    
    const uniqueLocations = Array.from(locationSet).sort();
    console.log(`Extracted ${uniqueLocations.length} unique locations from user profiles:`, uniqueLocations);
    
    // Also return the detailed location data for potential recreation of the locations node
    return { 
      uniqueLocations, 
      locationDetails: Object.fromEntries(locationDetails.entries())
    };
  } catch (error) {
    console.error("Error extracting locations from users:", error);
    return { uniqueLocations: [], locationDetails: {} };
  }
}

// Restore locationsList from extracted locations
async function restoreLocationsList(uniqueLocations) {
  try {
    console.log("Restoring locationsList...");
    
    // Update locationsList
    const locationsListRef = db.ref('locationsList');
    await locationsListRef.set(uniqueLocations);
    
    console.log("locationsList restored successfully!");
    return true;
  } catch (error) {
    console.error("Error restoring locationsList:", error);
    return false;
  }
}

// Check and potentially restore the locations node
async function checkAndRestoreLocations(locationDetails) {
  try {
    console.log("Checking locations node...");
    
    // Get current locations data
    const locationsRef = db.ref('locations');
    const snapshot = await locationsRef.once('value');
    
    if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
      console.log("locations node is empty or missing. Restoring from extracted data...");
      
      // Create location entries for each location
      for (const [key, details] of Object.entries(locationDetails)) {
        await db.ref(`locations/${key}`).set(details);
      }
      
      console.log(`Restored ${Object.keys(locationDetails).length} locations to the locations node`);
    } else {
      console.log("locations node exists and has data. No need to restore.");
    }
    
    return true;
  } catch (error) {
    console.error("Error checking/restoring locations node:", error);
    return false;
  }
}

// Create a backup of current database state
async function createBackup() {
  try {
    console.log("Creating backup...");
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    
    // Backup locationsList
    const locationsListRef = db.ref('locationsList');
    const locationsListSnapshot = await locationsListRef.once('value');
    if (locationsListSnapshot.exists()) {
      await db.ref(`backups/locationsList_${timestamp}`).set(locationsListSnapshot.val());
      console.log(`locationsList backed up to backups/locationsList_${timestamp}`);
    }
    
    // Backup locations
    const locationsRef = db.ref('locations');
    const locationsSnapshot = await locationsRef.once('value');
    if (locationsSnapshot.exists()) {
      await db.ref(`backups/locations_${timestamp}`).set(locationsSnapshot.val());
      console.log(`locations backed up to backups/locations_${timestamp}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error creating backup:", error);
    return false;
  }
}

// Main function to run the recovery process
async function recoverFromUsers() {
  try {
    // First create backup
    await createBackup();
    
    // Extract locations from users
    const { uniqueLocations, locationDetails } = await extractLocationsFromUsers();
    
    if (uniqueLocations.length === 0) {
      console.log("No locations found in user profiles. Recovery not possible.");
      return false;
    }
    
    // Restore locationsList
    await restoreLocationsList(uniqueLocations);
    
    // Check and potentially restore locations node
    await checkAndRestoreLocations(locationDetails);
    
    console.log("Recovery process completed successfully!");
    return true;
  } catch (error) {
    console.error("Error in recovery process:", error);
    return false;
  }
}

// Run the recovery process
recoverFromUsers()
  .then(success => {
    if (success) {
      console.log("Recovery completed successfully!");
    } else {
      console.log("Recovery encountered issues. Check the logs for details.");
    }
    process.exit(0);
  })
  .catch(error => {
    console.error("Fatal error in recovery process:", error);
    process.exit(1);
  });
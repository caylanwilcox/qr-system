const admin = require("firebase-admin");

// Use your existing service account
const serviceAccount = {
  type: "service_account",
  project_id: "qr-system-1cea7",
  private_key_id: "14ad13ff505798e18917023a7de21bff80386377",
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFamWAJUrHYeM0\n6LdmkmRom3zfzyS+Y7ES6bFsjYab7/5k4SPKipDfxPIK9JPU3eUV0vxAFTmAXy7T\nApF39FgoKm8DhFCBNUbjTmjmQSw1+vt5OlF68Lj9d9hl1b6RJgQkr7ZBgoJTdx4E\neUHCCscu29IIdlOTt4mqkGfPysadc/aLBhBEJeEQs9sQYMghHcYDx3X51f7EdS+J\ntbqGoEIXy7lW0u4LhJMcGkKK0mK/bOxLi3QsNeA7CkCsCSt34xXngn8WJgvZSB5E\ngSr9FxQTTxpbSFHFBhoePHXO2Zql70ZOcERi8yMiwCI/KuspBrhyFDRMC12kpo/q\n5CUGACcvAgMBAAECggEAGL90G/K7g2/SWMv3pHnORo1/blsnDbWs+WRRuVGrQe8o\nYqMVUTW6YE2YfiZs8IQkohjB8JKjPmQwQtmRPOAPu8aeBhXXNcC6XefIH11PhTDX\nx48NBIQa3K43yC8EZb5wnzIRKfiKDUaN0nJqUOtNpE0q8PlMaY8vndyJIbPCNEig\nifv2hI2f1FIgjr3fDYQzqT684OiZnNytAw75fY4BjrYVfWGNik7aUXwNyTUOq5s2\nkQDGHi196cpwCPYE7Jf2vKHyaudTOVwfGQJEimZNWJ5VXIG4RNjdEIR+ceUJvWJp\nbe0rNvledDdiwrtVWJrqRtATanlVf1SnQJZJ+7kLgQKBgQDmljfQ+Gl/lHjZFZsP\nNuKKaGc8b2jZOCsjjsYmGEQPniOHqlhThzHcd1zwDkcnvwek83EHBa8o4qMSsvlp\n3I3sKSJdomQiPT4PmXMQf4wnAGON1BX1dWA8gpU4B8sbgeTVymGnpYFPCjeCYOs9\nT8jfQMs7rU8c8uRA15NerbYcbwKBgQDbLEkzA1twyVpRIUh52xm4Tj4UeKvIYtO8\nfS9biYl1b7pn7fcpsOFIMQ/l6sBPZAHfezBr6n4842BB0dxQkgebIGom+N7bLpBC\na7ys+9wYaNaRiho6nrJXwO8zhjKaB3ELdBhMcloHmxau/MsA2a4ZyQXttRMQt+yL\nLPF9lgGBQQKBgQDZ4bugI/pb6Qk/5yB7gdsR+ZEDFCq4hlCM6s3lFSzKrRzZhmar\nlqXQsqEI3BT0Q5ePj9CPWBmowm5grujp1NPuAPhODbIcgE3yI4cMYdkmyUFItMyD\nAYQL6T/ij8qllVmLgg5AgSzsaLUG51mgt5ERE4J2Q07sBb8UXh8MaYwY1QKBgQCK\njmGsLUgmcjR1q5vc5UVKPbSDTpISuV9v/pfsv3M12a83OroREjApalLJn/F5fxis\nBn3jCzhJF9lnYttr2BWU3RYekyCX4cTzKJb7qLFIgSZ8lZjlTCQk0+SkZwcgVuoB\nOqCN25DM1B+v+kH/xJ2K0Ym878cgv5V7mqsEIMvMwQKBgGNlfrKrLrcHiMQvegx+\nRnNXlLFHLNUzNJoTGgt/SxZYFOjUOaKpHDcrnvE40ciskktIXN1ipaIvUVyaDwTc\n9ZU9ndz0cpupK45dWWzx070ddbWwwB16MQNjCi3T+7d0KZ8HLOZaWTQ5VdeERkPR\nhYO57PTsaw0oJBWhPy2naEWb\n-----END PRIVATE KEY-----\n`,
  client_email: "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",
  client_id: "118105325590848927895",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fqxwu%40qr-system-1cea7.iam.gserviceaccount.com"
};

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
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
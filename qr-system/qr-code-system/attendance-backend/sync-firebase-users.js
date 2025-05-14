// sync-firebase-users.js
// This script synchronizes users between Firebase Auth and Realtime Database
// and resets all passwords to "AV2025!"

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK with your service account
// Replace with the path to your service account key file
const serviceAccount = require('./path-to-your-serviceaccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project-id.firebaseio.com' // Replace with your Firebase project URL
});

const auth = admin.auth();
const db = admin.database();
const NEW_PASSWORD = 'AV2025!';

// Counters and tracking variables
const stats = {
  dbUsers: 0,
  authUsers: 0,
  passwordUpdated: 0,
  authCreated: 0,
  dbCreated: 0,
  errors: []
};

// Logger function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  if (isError) {
    console.error(logMessage);
    fs.appendFileSync('sync-errors.log', logMessage + '\n');
  } else {
    console.log(logMessage);
  }
  
  // Also write to a full log
  fs.appendFileSync('sync-full.log', logMessage + '\n');
}

// Initialize log files
fs.writeFileSync('sync-errors.log', '');
fs.writeFileSync('sync-full.log', '');

// Step 1: Get all database users
async function getDatabaseUsers() {
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val() || {};
    stats.dbUsers = Object.keys(users).length;
    log(`Found ${stats.dbUsers} users in the database`);
    return users;
  } catch (error) {
    log(`Error fetching database users: ${error.message}`, true);
    return {};
  }
}

// Step 2: Get all Firebase Auth users
async function getAuthUsers() {
  try {
    const authUsers = {};
    let nextPageToken;
    
    do {
      // Get users page by page (1000 at a time)
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      
      // Store users by UID for easy lookup
      listUsersResult.users.forEach(user => {
        authUsers[user.uid] = user;
      });
      
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    stats.authUsers = Object.keys(authUsers).length;
    log(`Found ${stats.authUsers} users in Firebase Authentication`);
    return authUsers;
  } catch (error) {
    log(`Error fetching Auth users: ${error.message}`, true);
    return {};
  }
}

// Step 3: Create a user in Firebase Auth
async function createAuthUser(uid, email) {
  try {
    if (!email || !email.includes('@')) {
      // Generate a fake but valid email if none exists
      email = `user_${uid}@tempmail.av`;
      log(`Using generated email ${email} for user ${uid}`);
    }
    
    const user = await auth.createUser({
      uid: uid,
      email: email,
      password: NEW_PASSWORD,
      emailVerified: true
    });
    
    stats.authCreated++;
    log(`Created new Auth user for ${uid} with email ${email}`);
    return true;
  } catch (error) {
    log(`Failed to create Auth user for ${uid}: ${error.message}`, true);
    stats.errors.push({ type: 'create-auth', uid, error: error.message });
    return false;
  }
}

// Step 4: Create a user in the database
async function createDatabaseUser(uid, authUser) {
  try {
    const userRef = db.ref(`users/${uid}`);
    
    // Create a basic profile based on Auth data
    await userRef.set({
      profile: {
        uid: uid,
        email: authUser.email || `user_${uid}@tempmail.av`,
        name: authUser.displayName || `User ${uid}`,
        password: NEW_PASSWORD,
        role: 'employee',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    });
    
    stats.dbCreated++;
    log(`Created database record for Auth user ${uid}`);
    return true;
  } catch (error) {
    log(`Failed to create database user for ${uid}: ${error.message}`, true);
    stats.errors.push({ type: 'create-db', uid, error: error.message });
    return false;
  }
}

// Step 5: Update password in Firebase Auth
async function updateAuthPassword(uid) {
  try {
    await auth.updateUser(uid, {
      password: NEW_PASSWORD
    });
    
    stats.passwordUpdated++;
    log(`Updated Auth password for user ${uid}`);
    return true;
  } catch (error) {
    log(`Failed to update Auth password for ${uid}: ${error.message}`, true);
    stats.errors.push({ type: 'update-auth', uid, error: error.message });
    return false;
  }
}

// Step 6: Update password in the database
async function updateDatabasePassword(uid) {
  try {
    await db.ref(`users/${uid}/profile`).update({
      password: NEW_PASSWORD
    });
    
    log(`Updated database password for user ${uid}`);
    return true;
  } catch (error) {
    log(`Failed to update database password for ${uid}: ${error.message}`, true);
    stats.errors.push({ type: 'update-db', uid, error: error.message });
    return false;
  }
}

// Main function to synchronize users and reset passwords
async function syncUsersAndResetPasswords() {
  try {
    log('Starting user synchronization and password reset process');
    
    // Get all users from both systems
    const dbUsers = await getDatabaseUsers();
    const authUsers = await getAuthUsers();
    
    // Track all unique UIDs
    const allUids = new Set([
      ...Object.keys(dbUsers),
      ...Object.keys(authUsers)
    ]);
    
    log(`Processing ${allUids.size} unique users across both systems`);
    
    // Process each user
    for (const uid of allUids) {
      const dbUser = dbUsers[uid];
      const authUser = authUsers[uid];
      
      log(`\nProcessing user ${uid}`);
      
      // Case 1: User exists in both systems
      if (dbUser && authUser) {
        log(`User ${uid} exists in both Auth and Database`);
        
        // Update passwords in both systems
        await updateAuthPassword(uid);
        await updateDatabasePassword(uid);
      }
      // Case 2: User exists only in the database
      else if (dbUser && !authUser) {
        log(`User ${uid} exists only in Database, creating Auth record`);
        
        // Create in Auth and update database password
        const email = dbUser.profile?.email;
        await createAuthUser(uid, email);
        await updateDatabasePassword(uid);
      }
      // Case 3: User exists only in Auth
      else if (!dbUser && authUser) {
        log(`User ${uid} exists only in Auth, creating Database record`);
        
        // Create in database and update Auth password
        await createDatabaseUser(uid, authUser);
        await updateAuthPassword(uid);
      }
    }
    
    // Final verification
    const updatedDbUsers = await getDatabaseUsers();
    const updatedAuthUsers = await getAuthUsers();
    
    log('\n===== SYNCHRONIZATION SUMMARY =====');
    log(`Initial counts: ${stats.dbUsers} database users, ${stats.authUsers} Auth users`);
    log(`Final counts: ${Object.keys(updatedDbUsers).length} database users, ${Object.keys(updatedAuthUsers).length} Auth users`);
    log(`Created ${stats.authCreated} new Auth users`);
    log(`Created ${stats.dbCreated} new database records`);
    log(`Updated ${stats.passwordUpdated} Auth passwords`);
    log(`Encountered ${stats.errors.length} errors`);
    
    // Check if systems are in sync
    if (Object.keys(updatedDbUsers).length === Object.keys(updatedAuthUsers).length) {
      log('\n✅ SUCCESS: Firebase Auth and Database users are now synchronized!');
      log(`All passwords have been reset to: ${NEW_PASSWORD}`);
    } else {
      log('\n⚠️ WARNING: User counts still don\'t match. Review the logs for details.', true);
    }
    
    // Write detailed error report if needed
    if (stats.errors.length > 0) {
      log('\nSee error details in sync-errors.log');
    }
    
    log('Process completed');
  } catch (error) {
    log(`Fatal error in synchronization process: ${error.message}`, true);
  }
}

// Run the script
syncUsersAndResetPasswords()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
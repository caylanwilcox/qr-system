const admin = require("firebase-admin");
require('dotenv').config({ path: '../.env' });

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

const auth = admin.auth();
const db = admin.database();

// Function to update user's Firebase Auth credentials
async function updateUserAuth(userId, updates) {
  try {
    console.log(`Updating Firebase Auth for user: ${userId}`);
    console.log('Updates:', updates);
    
    // Check if user exists in Firebase Auth
    let userExists = false;
    try {
      await auth.getUser(userId);
      userExists = true;
      console.log('✅ User exists in Firebase Auth');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️ User not found in Firebase Auth');
        userExists = false;
      } else {
        throw error;
      }
    }
    
    if (!userExists && updates.email) {
      // Create new user
      console.log('Creating new Firebase Auth user...');
      const userRecord = await auth.createUser({
        uid: userId,
        email: updates.email,
        password: updates.password || 'AV2025!',
        displayName: updates.displayName,
        emailVerified: true
      });
      console.log('✅ Created new Firebase Auth user:', userRecord.uid);
    } else if (userExists) {
      // Update existing user
      console.log('Updating existing Firebase Auth user...');
      await auth.updateUser(userId, updates);
      console.log('✅ Updated Firebase Auth user');
    }
    
    // Update database link
    await db.ref(`users/${userId}/profile/authUid`).set(userId);
    console.log('✅ Updated database authUid link');
    
    return true;
  } catch (error) {
    console.error('❌ Error updating Firebase Auth:', error);
    throw error;
  }
}

// Function to sync a user from database to Firebase Auth
async function syncUserToAuth(userId) {
  try {
    console.log(`\n=== Syncing user ${userId} ===`);
    
    // Get user from database
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
      throw new Error(`User ${userId} not found in database`);
    }
    
    const userData = snapshot.val();
    const profile = userData.profile || {};
    
    console.log('User data from database:');
    console.log('- Name:', profile.name || userData.name);
    console.log('- Email:', profile.email);
    console.log('- Role:', profile.role);
    
    if (!profile.email) {
      throw new Error('No email found for user');
    }
    
    // Prepare updates for Firebase Auth
    const authUpdates = {
      email: profile.email,
      displayName: profile.name || userData.name,
      emailVerified: true
    };
    
    if (profile.password) {
      authUpdates.password = profile.password;
    }
    
    // Update Firebase Auth
    await updateUserAuth(userId, authUpdates);
    
    console.log('✅ User sync completed successfully');
    return true;
    
  } catch (error) {
    console.error(`❌ Error syncing user ${userId}:`, error.message);
    return false;
  }
}

// Main function to sync all admin users
async function syncAdminUsers() {
  try {
    console.log('=== SYNCING ADMIN USERS TO FIREBASE AUTH ===\n');
    
    // Get all users from database
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('No users found in database');
      return;
    }
    
    const users = snapshot.val();
    const adminUsers = [];
    
    // Find admin users
    Object.entries(users).forEach(([userId, userData]) => {
      const profile = userData.profile || {};
      const role = profile.role || userData.role;
      
      if (role && (role.includes('admin') || role.includes('ADMIN'))) {
        adminUsers.push({
          id: userId,
          name: profile.name || userData.name,
          email: profile.email,
          role: role
        });
      }
    });
    
    console.log(`Found ${adminUsers.length} admin users:`);
    adminUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - ${user.role}`);
    });
    
    console.log('\nSyncing admin users to Firebase Auth...\n');
    
    let successCount = 0;
    for (const user of adminUsers) {
      const success = await syncUserToAuth(user.id);
      if (success) successCount++;
    }
    
    console.log(`\n=== SYNC COMPLETED ===`);
    console.log(`Successfully synced: ${successCount}/${adminUsers.length} admin users`);
    
    if (successCount === adminUsers.length) {
      console.log('✅ All admin users can now update other users through the Personal Info section');
    } else {
      console.log('⚠️ Some users failed to sync. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Error syncing admin users:', error);
  }
}

// Run the sync
if (require.main === module) {
  syncAdminUsers()
    .then(() => {
      console.log('\nScript completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { syncUserToAuth, updateUserAuth }; 
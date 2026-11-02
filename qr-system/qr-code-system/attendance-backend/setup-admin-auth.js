const admin = require("firebase-admin");
require('dotenv').config({ path: '../.env' });

// Use your existing service account
// Service-account credentials come from environment variables (see .env.example). Never commit them.
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
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
  console.error('Missing FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL. Add them to .env (see .env.example).');
  process.exit(1);
}

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
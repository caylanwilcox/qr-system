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

const auth = admin.auth();
const db = admin.database();

// Sonia's User ID and details
const SONIA_DB_ID = "3f924a61-1ea3-4212-b4f4-249ff234648b";
const SUPER_ADMIN_ROLE = "super_admin"; // Using super_admin as the role for consistency
const NEW_PASSWORD = "AV2025!";

// Step 1: Get Sonia's database record to extract her details
async function getSoniaDatabaseRecord() {
  try {
    console.log(`Fetching Sonia's database record with ID: ${SONIA_DB_ID}`);
    
    const userRef = db.ref(`users/${SONIA_DB_ID}`);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
      throw new Error(`Database user not found with ID: ${SONIA_DB_ID}`);
    }
    
    const userData = snapshot.val();
    const name = userData.profile?.name || userData.name || "Sonia";
    const email = userData.profile?.email;
    
    console.log(`Found Sonia's record in database: ${name}`);
    console.log(`Email from database: ${email || 'None found'}`);
    
    if (!email) {
      throw new Error('No email found in Sonia\'s database record');
    }
    
    return {
      name,
      email,
      userData
    };
  } catch (error) {
    console.error(`Error getting Sonia's database record: ${error.message}`);
    throw error;
  }
}

// Step 2: Check if Sonia already exists in Firebase Auth
async function checkExistingAuthUser(email) {
  try {
    console.log(`Checking if user with email ${email} exists in Auth...`);
    
    try {
      const userRecord = await auth.getUserByEmail(email);
      console.log(`User exists in Auth with UID: ${userRecord.uid}`);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('User does not exist in Auth');
        return null;
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error checking existing Auth user: ${error.message}`);
    return null;
  }
}

// Step 3: Create or update Auth user
async function createOrUpdateAuthUser(soniaDetails, existingUser) {
  try {
    let authUserId;
    
    if (existingUser) {
      // Update existing user
      console.log(`Updating existing Auth user: ${existingUser.uid}`);
      
      await auth.updateUser(existingUser.uid, {
        displayName: soniaDetails.name,
        password: NEW_PASSWORD,
        emailVerified: true
      });
      
      authUserId = existingUser.uid;
      console.log(`Updated existing Auth user with ID: ${authUserId}`);
    } else {
      // Create new user
      console.log(`Creating new Auth user for ${soniaDetails.name}`);
      
      // Try with the database ID first
      try {
        const newUserRecord = await auth.createUser({
          uid: SONIA_DB_ID, // Try to use the same UID as the database
          email: soniaDetails.email,
          password: NEW_PASSWORD,
          displayName: soniaDetails.name,
          emailVerified: true
        });
        
        authUserId = newUserRecord.uid;
        console.log(`Created new Auth user with ID: ${authUserId}`);
      } catch (uidError) {
        // If using the same UID fails, create with a new UID
        if (uidError.code === 'auth/uid-already-exists') {
          console.log(`UID ${SONIA_DB_ID} already exists in Auth but with a different email. Creating with a new UID.`);
          
          const newUserRecord = await auth.createUser({
            email: soniaDetails.email,
            password: NEW_PASSWORD,
            displayName: soniaDetails.name,
            emailVerified: true
          });
          
          authUserId = newUserRecord.uid;
          console.log(`Created new Auth user with new ID: ${authUserId}`);
        } else {
          throw uidError;
        }
      }
    }
    
    // Set custom claims for super admin access
    await auth.setCustomUserClaims(authUserId, {
      admin: true,
      superAdmin: true,
      role: SUPER_ADMIN_ROLE
    });
    
    console.log(`Set custom claims for ${authUserId} - Role: ${SUPER_ADMIN_ROLE}`);
    
    return authUserId;
  } catch (error) {
    console.error(`Error creating/updating Auth user: ${error.message}`);
    throw error;
  }
}

// Step 4: Update Sonia's database record with super admin role
async function updateDatabaseRecord(authUserId) {
  try {
    console.log(`Updating Sonia's database record with super admin role and Auth UID`);
    
    // Update the profile
    await db.ref(`users/${SONIA_DB_ID}/profile`).update({
      role: SUPER_ADMIN_ROLE,
      password: NEW_PASSWORD,
      authUid: authUserId,
      updatedAt: new Date().toISOString()
    });
    
    // Also update role at root level if it exists
    const userRef = db.ref(`users/${SONIA_DB_ID}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    
    if (userData.hasOwnProperty('role')) {
      await userRef.update({
        role: SUPER_ADMIN_ROLE
      });
    }
    
    console.log(`Database record updated with super admin role and Auth UID: ${authUserId}`);
    return true;
  } catch (error) {
    console.error(`Error updating database record: ${error.message}`);
    throw error;
  }
}

// Step 5: Setup management structure for super admin
async function setupManagementStructure() {
  try {
    console.log(`Setting up management structure for super admin with ID: ${SONIA_DB_ID}`);
    
    const mgmtData = {
      role: SUPER_ADMIN_ROLE,
      managedLocations: {
        "*": true // Wildcard for all locations
      },
      managedDepartments: {
        "*": true // Wildcard for all departments
      }
    };
    
    await db.ref(`managementStructure/${SONIA_DB_ID}`).set(mgmtData);
    
    console.log('Management structure updated for super admin access');
    return true;
  } catch (error) {
    console.error(`Error setting up management structure: ${error.message}`);
    // Don't throw - this step is optional
    return false;
  }
}

// Step 6: Verify all changes
async function verifyChanges(authUserId) {
  try {
    // Verify Auth user
    const authUser = await auth.getUser(authUserId);
    console.log('\nVerifying Auth user:');
    console.log(`- Firebase Auth UID: ${authUserId}`);
    console.log(`- Email verified: ${authUser.emailVerified ? '✓' : '✗'}`);
    console.log(`- Custom claims role: ${authUser.customClaims?.role === SUPER_ADMIN_ROLE ? '✓' : '✗'}`);
    console.log(`- Custom claims superAdmin: ${authUser.customClaims?.superAdmin === true ? '✓' : '✗'}`);
    
    // Verify Database record
    const dbUser = await db.ref(`users/${SONIA_DB_ID}`).once('value');
    const userData = dbUser.val();
    console.log('\nVerifying Database record:');
    console.log(`- Database ID: ${SONIA_DB_ID}`);
    console.log(`- Role in profile: ${userData.profile?.role === SUPER_ADMIN_ROLE ? '✓' : '✗'}`);
    console.log(`- Auth UID link: ${userData.profile?.authUid === authUserId ? '✓' : '✗'}`);
    
    if (userData.hasOwnProperty('role')) {
      console.log(`- Root level role: ${userData.role === SUPER_ADMIN_ROLE ? '✓' : '✗'}`);
    }
    
    // Verify Management structure
    const mgmt = await db.ref(`managementStructure/${SONIA_DB_ID}`).once('value');
    const mgmtData = mgmt.val();
    console.log('\nVerifying Management structure:');
    console.log(`- Role: ${mgmtData?.role === SUPER_ADMIN_ROLE ? '✓' : '✗'}`);
    console.log(`- All locations access: ${mgmtData?.managedLocations?.['*'] ? '✓' : '✗'}`);
    console.log(`- All departments access: ${mgmtData?.managedDepartments?.['*'] ? '✓' : '✗'}`);
    
    return {
      auth: authUser.customClaims?.role === SUPER_ADMIN_ROLE && authUser.customClaims?.superAdmin === true,
      database: userData.profile?.role === SUPER_ADMIN_ROLE && userData.profile?.authUid === authUserId,
      management: mgmtData?.role === SUPER_ADMIN_ROLE && mgmtData?.managedLocations?.['*'] === true
    };
  } catch (error) {
    console.error(`Error verifying changes: ${error.message}`);
    return { auth: false, database: false, management: false };
  }
}

// Main function
async function makeSoniaSuperUser() {
  console.log('=== STARTING PROCESS TO MAKE SONIA A SUPER USER ===');
  
  try {
    // Step 1: Get Sonia's database record
    const soniaDetails = await getSoniaDatabaseRecord();
    
    // Step 2: Check if Sonia exists in Auth
    const existingAuthUser = await checkExistingAuthUser(soniaDetails.email);
    
    // Step 3: Create or update Auth user
    const authUserId = await createOrUpdateAuthUser(soniaDetails, existingAuthUser);
    
    // Step 4: Update Sonia's database record
    await updateDatabaseRecord(authUserId);
    
    // Step 5: Setup management structure
    await setupManagementStructure();
    
    // Step 6: Verify all changes
    const verification = await verifyChanges(authUserId);
    
    // Print summary
    console.log('\n=== SUPER USER SETUP SUMMARY ===');
    console.log(`Name: ${soniaDetails.name}`);
    console.log(`Database ID: ${SONIA_DB_ID}`);
    console.log(`Auth User ID: ${authUserId}`);
    console.log(`Email: ${soniaDetails.email}`);
    console.log(`Password: ${NEW_PASSWORD}`);
    console.log(`Role: ${SUPER_ADMIN_ROLE}`);
    
    console.log('\nVerification Results:');
    console.log(`- Auth User: ${verification.auth ? 'SUCCESSFUL ✓' : 'FAILED ✗'}`);
    console.log(`- Database User: ${verification.database ? 'SUCCESSFUL ✓' : 'FAILED ✗'}`);
    console.log(`- Management Structure: ${verification.management ? 'SUCCESSFUL ✓' : 'FAILED ✗'}`);
    
    if (verification.auth && verification.database && verification.management) {
      console.log('\n✅ SUPER USER SETUP COMPLETED SUCCESSFULLY');
      console.log(`Sonia can now log in with:`);
      console.log(`- Email: ${soniaDetails.email}`);
      console.log(`- Password: ${NEW_PASSWORD}`);
      console.log('And has super admin privileges across the entire system');
    } else {
      console.log('\n⚠️ SETUP PARTIALLY COMPLETED');
      console.log('Some verification checks failed. Please review the logs.');
    }
    
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error);
  }
  
  console.log('\n=== PROCESS COMPLETED ===');
}

// Run the script
makeSoniaSuperUser()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
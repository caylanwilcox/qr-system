// Load environment variables from .env file
require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using the service account
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// Initialize the admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASE_URL
  });
}

// Function to set super admin role
async function setInitialSuperAdmin(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'SUPER_ADMIN'
    });

    // Update user record in Realtime Database
    await admin.database().ref(`users/${user.uid}`).update({
      role: 'SUPER_ADMIN',
      updatedAt: admin.database.ServerValue.TIMESTAMP
    });

    console.log(`Successfully set super admin role for user: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting super admin role:', error);
    process.exit(1);
  }
}

// Replace with your email
const userEmail = 'caylanwilcox@gmail.com'; // Replace with your actual email
setInitialSuperAdmin(userEmail);
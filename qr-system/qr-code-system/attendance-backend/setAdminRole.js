// Load environment variables from .env file
require("dotenv").config();
const admin = require("firebase-admin");

// Create a service account object using the environment variables
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Convert newline characters correctly
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// Initialize Firebase Admin SDK using the credentials from environment variables
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  console.log("Firebase Admin already initialized.");
}

// Helper function to set the admin role
const setAdminRole = async (uid) => {
  try {
    // Get the user's existing custom claims
    const user = await admin.auth().getUser(uid);

    if (user.customClaims && user.customClaims.role === "admin") {
      console.log(`User with UID ${uid} already has admin privileges.`);
      return;
    }

    // Set custom user claims to grant the 'admin' role
    await admin.auth().setCustomUserClaims(uid, { role: "admin" });
    console.log(`Successfully set admin role for user: ${uid}`);
  } catch (error) {
    console.error("Error setting admin role:", error.message);
  }
};

// Set the UID of the user you want to make an admin
const uid = process.env.ADMIN_UID || "pRqX754hpig38yK2YiahOW34O1y2"; // Replace with actual UID or environment variable
setAdminRole(uid);

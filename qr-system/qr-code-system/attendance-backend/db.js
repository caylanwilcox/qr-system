require('dotenv').config({ path: '/Users/it/code/qr-system/qr-system/qr-code-system/.env' });

console.log("Database URL from env:", process.env.REACT_APP_FIREBASE_DATABASE_URL);
console.log("Project ID from env:", process.env.PROJECT_ID);

const admin = require('firebase-admin');

// Ensure required environment variables exist
const requiredEnvVars = [
  "REACT_APP_FIREBASE_DATABASE_URL",
  "PROJECT_ID",
  "PRIVATE_KEY",
  "CLIENT_EMAIL"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is not defined`);
    process.exit(1);
  }
}

// Initialize Firebase Admin SDK using Service Account
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.TYPE || "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // Convert `\n` back to actual newlines
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    universe_domain: process.env.UNIVERSE_DOMAIN
  };

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    });
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    process.exit(1);
  }
}

const db = admin.database();
const auth = admin.auth();

module.exports = { db, auth };
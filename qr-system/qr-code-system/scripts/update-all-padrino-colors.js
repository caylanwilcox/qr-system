// scripts/update-all-padrino-colors.js
// Run with: node scripts/update-all-padrino-colors.js

const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

// Import the padrino color calculator from the frontend codebase
const { calculatePadrinoColor } = require(path.resolve(__dirname, '../src/components/utils/padrinoColorCalculator.js'));

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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com",
});

const db = admin.database();

async function updateAllPadrinoColors() {
  try {
    console.log('--- UPDATING ALL PADRINO COLORS ---');
    const usersRef = db.ref('users');
    const usersSnapshot = await usersRef.once('value');
    const updates = {};
    usersSnapshot.forEach(userSnap => {
      const userId = userSnap.key;
      const user = userSnap.val();
      if (user.profile && user.profile.padrino) {
        updates[`users/${userId}/profile/padrinoColor`] = 'blue';
        updates[`users/${userId}/profile/padrinoColorCode`] = 'blue';
      }
    });
    await db.ref().update(updates);
    console.log('All padrino colors updated.');
    process.exit(0);
  } catch (error) {
    console.error('Error updating padrino colors:', error);
    process.exit(1);
  }
}

updateAllPadrinoColors(); 
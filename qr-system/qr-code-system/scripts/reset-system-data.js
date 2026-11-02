// scripts/reset-system-data.js
// Run with: node scripts/reset-system-data.js

const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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

async function resetSystemData() {
  try {
    console.log('--- RESETTING ATTENDANCE DATA ---');
    await db.ref('attendance').remove();
    console.log('Attendance data cleared.');

    console.log('--- RESETTING EVENT DATA ---');
    await db.ref('events').remove();
    console.log('Event data cleared.');

    console.log('--- RESETTING DELETED USER BACKUPS ---');
    await db.ref('deleted_users').remove();
    console.log('Deleted user backups cleared.');

    console.log('--- RESETTING USER DATA (schedules, attendance, events, statistics, stats, padrinoColor) ---');
    const usersRef = db.ref('users');
    const usersSnapshot = await usersRef.once('value');
    const updates = {};
    usersSnapshot.forEach(userSnap => {
      const userId = userSnap.key;
      const user = userSnap.val();
      // Clear schedule, attendance, clockInTimes, events, statistics, stats
      updates[`users/${userId}/schedule`] = null;
      updates[`users/${userId}/attendance`] = null;
      updates[`users/${userId}/clockInTimes`] = null;
      updates[`users/${userId}/events`] = null;
      updates[`users/${userId}/statistics`] = null;
      updates[`users/${userId}/stats`] = null;
      // Set padrinoColor and padrinoColorCode to blue and clear manualColorOverride if padrino is true
      if (user.profile && user.profile.padrino) {
        updates[`users/${userId}/profile/padrinoColor`] = 'blue';
        updates[`users/${userId}/profile/padrinoColorCode`] = 'blue';
        updates[`users/${userId}/profile/manualColorOverride`] = false;
      }
    });
    await db.ref().update(updates);
    console.log('User schedules, attendance, events, statistics, stats cleared and all padrinos set to blue.');

    console.log('--- RESET COMPLETE ---');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting system data:', error);
    process.exit(1);
  }
}

resetSystemData(); 
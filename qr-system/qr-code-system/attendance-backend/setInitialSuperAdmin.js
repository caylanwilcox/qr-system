const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const admin = require('firebase-admin');

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
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});

async function updateUserSettings(email, newPassword) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    // Update password
    await admin.auth().updateUser(user.uid, {
      password: newPassword
    });

    // Set custom claims for super-admin
    await admin.auth().setCustomUserClaims(user.uid, {
      superAdmin: true,
      admin: true,
      role: 'SUPER_ADMIN'
    });

    // Update role and location in database
    await admin.database().ref(`users/${user.uid}`).update({
      role: 'SUPER_ADMIN',
      location: 'aurora',
      status: 'active',
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      customClaims: {
        superAdmin: true,
        admin: true,
        role: 'SUPER_ADMIN'
      }
    });

    console.log(`Updated settings for user: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Update specific user
updateUserSettings('caylanwilcox@gmail.com', 'Isaiah27');
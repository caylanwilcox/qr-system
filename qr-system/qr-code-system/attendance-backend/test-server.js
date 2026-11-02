const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = express();
const PORT = 3003;

// Firebase Admin setup
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

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

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

// Middleware
app.use(express.json());
app.use(cors());

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ success: true, message: 'Server is working!' });
});

// Real admin endpoint with Firebase Admin functionality
app.post('/api/admin/update-user-auth', async (req, res) => {
  console.log('=== ADMIN ENDPOINT HIT ===');
  console.log('Request body:', req.body);
  
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Missing or invalid token format' 
      });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    console.log('✅ ID Token received, length:', idToken.length);
    
    // Verify the token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      console.log('✅ Token verified for user:', decodedToken.uid);
    } catch (error) {
      console.error("❌ Error verifying ID token:", error);
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Invalid token' 
      });
    }
    
    // Get request data
    const { userId, updates } = req.body;
    
    if (!userId) {
      console.log('❌ Missing userId');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: User ID is required' 
      });
    }

    if (!updates || typeof updates !== 'object') {
      console.log('❌ Invalid updates object');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: Updates must be an object' 
      });
    }
    
    // Filter out undefined/null values and format updates object
    const validUpdates = Object.entries(updates)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
      
    if (Object.keys(validUpdates).length === 0) {
      console.log('❌ No valid updates provided');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: No valid updates provided' 
      });
    }
    
    console.log('✅ Processing admin update for user:', userId, 'with updates:', validUpdates);
    
    // Use the updateUserAuth function
    try {
      await updateUserAuth(userId, validUpdates);
      
      console.log('🎉 Successfully updated user auth:', userId);
      
      return res.status(200).json({
        success: true,
        message: 'User authentication updated successfully',
        userId
      });
    } catch (updateError) {
      console.error("❌ Error updating auth user:", updateError);
      return res.status(500).json({
        success: false,
        message: `Error updating user: ${updateError.message}`
      });
    }
  } catch (error) {
    console.error("❌ Server error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Server is ready to receive requests');
});

// Keep alive
setInterval(() => {
  console.log('Server still running...', new Date().toISOString());
}, 10000);

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 
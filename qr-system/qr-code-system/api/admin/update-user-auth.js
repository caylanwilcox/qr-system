// api/admin/update-user-auth.js
import admin from 'firebase-admin';

// Initialize Firebase Admin (same as your existing code)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "qr-system-1cea7",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "14ad13ff505798e18917023a7de21bff80386377",
  private_key: (process.env.FIREBASE_PRIVATE_KEY || 
    `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFamWAJUrHYeM0\n6LdmkmRom3zfzyS+Y7ES6bFsjYab7/5k4SPKipDfxPIK9JPU3eUV0vxAFTmAXy7T\nApF39FgoKm8DhFCBNUbjTmjmQSw1+vt5OlF68Lj9d9hl1b6RJgQkr7ZBgoJTdx4E\neUHCCscu29IIdlOTt4mqkGfPysadc/aLBhBEJeEQs9sQYMghHcYDx3X51f7EdS+J\ntbqGoEIXy7lW0u4LhJMcGkKK0mK/bOxLi3QsNeA7CkCsCSt34xXngn8WJgvZSB5E\ngSr9FxQTTxpbSFHFBhoePHXO2Zql70ZOcERi8yMiwCI/KuspBrhyFDRMC12kpo/q\n5CUGACcvAgMBAAECggEAGL90G/K7g2/SWMv3pHnORo1/blsnDbWs+WRRuVGrQe8o\nYqMVUTW6YE2YfiZs8IQkohjB8JKjPmQwQtmRPOAPu8aeBhXXNcC6XefIH11PhTDX\nx48NBIQa3K43yC8EZb5wnzIRKfiKDUaN0nJqUOtNpE0q8PlMaY8vndyJIbPCNEig\nifv2hI2f1FIgjr3fDYQzqT684OiZnNytAw75fY4BjrYVfWGNik7aUXwNyTUOq5s2\nkQDGHi196cpwCPYE7Jf2vKHyaudTOVwfGQJEimZNWJ5VXIG4RNjdEIR+ceUJvWJp\nbe0rNvledDdiwrtVWJrqRtATanlVf1SnQJZJ+7kLgQKBgQDmljfQ+Gl/lHjZFZsP\nNuKKaGc8b2jZOCsjjsYmGEQPniOHqlhThzHcd1zwDkcnvwek83EHBa8o4qMSsvlp\n3I3sKSJdomQiPT4PmXMQf4wnAGON1BX1dWA8gpU4B8sbgeTVymGnpYFPCjeCYOs9\nT8jfQMs7rU8c8uRA15NerbYcbwKBgQDbLEkzA1twyVpRIUh52xm4Tj4UeKvIYtO8\nfS9biYl1b7pn7fcpsOFIMQ/l6sBPZAHfezBr6n4842BB0dxQkgebIGom+N7bLpBC\na7ys+9wYaNaRiho6nrJXwO8zhjKaB3ELdBhMcloHmxau/MsA2a4ZyQXttRMQt+yL\nLPF9lgGBQQKBgQDZ4bugI/pb6Qk/5yB7gdsR+ZEDFCq4hlCM6s3lFSzKrRzZhmar\nlqXQsqEI3BT0Q5ePj9CPWBmowm5grujp1NPuAPhODbIcgE3yI4cMYdkmyUFItMyD\nAYQL6T/ij8qllVmLgg5AgSzsaLUG51mgt5ERE4J2Q07sBb8UXh8MaYwY1QKBgQCK\njmGsLUgmcjR1q5vc5UVKPbSDTpISuV9v/pfsv3M12a83OroREjApalLJn/F5fxis\nBn3jCzhJF9lnYttr2BWU3RYekyCX4cTzKJb7qLFIgSZ8lZjlTCQk0+SkZwcgVuoB\nOqCN25DM1B+v+kH/xJ2K0Ym878cgv5V7mqsEIMvMwQKBgGNlfrKrLrcHiMQvegx+\nRnNXlLFHLNUzNJoTGgt/SxZYFOjUOaKpHDcrnvE40ciskktIXN1ipaIvUVyaDwTc\n9ZU9ndz0cpupK45dWWzx070ddbWwwB16MQNjCi3T+7d0KZ8HLOZaWTQ5VdeERkPR\nhYO57PTsaw0oJBWhPy2naEWb\n-----END PRIVATE KEY-----\n`).replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",
  client_id: process.env.FIREBASE_CLIENT_ID || "118105325590848927895",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fqxwu%40qr-system-1cea7.iam.gserviceaccount.com"
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    console.log("🚀 Initializing Firebase Admin SDK...");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://qr-system-1cea7-default-rtdb.firebaseio.com"
    });
    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase admin initialization error:", error);
  }
}

const auth = admin.auth();
const db = admin.database();

// Export as default function for Vercel Serverless Functions
export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n🔄 [${requestId}] === NEW REQUEST START ===`);
  console.log(`📥 [${requestId}] Method: ${req.method}`);
  console.log(`📥 [${requestId}] URL: ${req.url}`);

  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight handled`);
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log(`🔐 [${requestId}] Starting authentication verification...`);
    
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [${requestId}] Missing or invalid auth header`);
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Missing or invalid token format' 
      });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    console.log(`🎫 [${requestId}] ID Token received (length: ${idToken.length})`);
    
    // Verify the token and check if user has admin privileges
    let decodedToken;
    try {
      console.log(`🔍 [${requestId}] Verifying ID token with Firebase Auth...`);
      decodedToken = await auth.verifyIdToken(idToken);
      console.log(`✅ [${requestId}] Token verified successfully for user: ${decodedToken.uid}`);
      
      // Check if user has admin or super_admin role from database
      console.log(`🔍 [${requestId}] Checking user role in database...`);
      const userRef = db.ref(`users/${decodedToken.uid}`);
      const userSnapshot = await userRef.once('value');
      const userData = userSnapshot.val();
      
      if (!userData) {
        console.log(`❌ [${requestId}] User data not found in database`);
        return res.status(404).json({ 
          success: false, 
          message: 'User not found in database' 
        });
      }
      
      // Check multiple possible role locations
      const possibleRoles = [
        userData?.profile?.role,
        userData?.role,
        userData?.profile?.userRole,
        userData?.userRole
      ];
      
      const userRole = possibleRoles
        .find(role => role && typeof role === 'string')
        ?.toLowerCase();
      
      console.log(`🎭 [${requestId}] User role: ${userRole || 'No role found'}`);
      
      // Check if user has admin privileges from either database or token claims
      const hasAdminFromToken = decodedToken.admin === true || decodedToken.superAdmin === true;
      const hasAdminFromRole = userRole && (userRole.includes('admin') || userRole === 'super_admin');
      const hasAdminPrivileges = hasAdminFromToken || hasAdminFromRole;
      
      if (!hasAdminPrivileges) {
        console.log(`❌ [${requestId}] Access denied - insufficient privileges`);
        return res.status(403).json({ 
          success: false, 
          message: 'Forbidden: Admin privileges required' 
        });
      }
      
      console.log(`✅ [${requestId}] User has sufficient admin privileges`);
      
    } catch (tokenError) {
      console.error(`❌ [${requestId}] Error verifying ID token:`, tokenError.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Invalid token' 
      });
    }
    
    // Get request data
    const { userId, updates } = req.body;
    console.log(`📋 [${requestId}] Processing update for user: ${userId}`);
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: User ID is required' 
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: Updates must be an object' 
      });
    }
    
    // Filter out undefined/null values
    const validUpdates = Object.entries(updates)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
      
    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: No valid updates provided' 
      });
    }

    // Check if user exists in Firebase Auth
    let userExists = true;
    try {
      await auth.getUser(userId);
      console.log(`✅ [${requestId}] User exists in Firebase Auth`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userExists = false;
        console.log(`ℹ️ [${requestId}] User does not exist in Firebase Auth`);
      } else {
        throw error;
      }
    }
    
    // Create or update user in Firebase Auth
    if (!userExists) {
      // Get user data from database for creation
      const userRef = db.ref(`users/${userId}`);
      const userSnapshot = await userRef.once('value');
      const userData = userSnapshot.val();
      
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found in database'
        });
      }
      
      // Create user
      const createData = {
        uid: userId,
        email: validUpdates.email || userData.profile?.email || userData.email,
        displayName: validUpdates.displayName || userData.profile?.name || userData.name || '',
        password: validUpdates.password || 'AV2025!',
        emailVerified: true
      };
      
      const userRecord = await auth.createUser(createData);
      console.log(`✅ [${requestId}] Created new auth user: ${userRecord.uid}`);
      
      // Set custom claims based on database role
      const userRole = userData.profile?.role || userData.role;
      if (userRole) {
        const claims = { role: userRole.toLowerCase() };
        
        if (userRole.toLowerCase().includes('admin')) {
          claims.admin = true;
          if (userRole.toLowerCase().includes('super')) {
            claims.superAdmin = true;
          }
        }
        
        await auth.setCustomUserClaims(userId, claims);
        console.log(`✅ [${requestId}] Custom claims set`);
      }
      
      // Link auth user in database
      await db.ref(`users/${userId}/profile/authUid`).set(userId);
      
      return res.status(201).json({
        success: true,
        message: 'User created in authentication system',
        userId: userRecord.uid
      });
    } else {
      // Update existing user
      await auth.updateUser(userId, validUpdates);
      console.log(`✅ [${requestId}] Auth user updated successfully`);
      
      // Update custom claims if role is included
      if (updates.role) {
        const claims = { role: updates.role.toLowerCase() };
        
        if (updates.role.toLowerCase().includes('admin')) {
          claims.admin = true;
          if (updates.role.toLowerCase().includes('super')) {
            claims.superAdmin = true;
          }
        }
        
        await auth.setCustomUserClaims(userId, claims);
        console.log(`✅ [${requestId}] Custom claims updated`);
      }
      
      // Maintain database auth link
      await db.ref(`users/${userId}/profile/authUid`).set(userId);
      
      const finalUserRecord = await auth.getUser(userId);
      
      return res.status(200).json({
        success: true,
        message: 'User authentication updated successfully',
        userId,
        loginCredentials: {
          email: finalUserRecord.email,
          passwordChanged: !!validUpdates.password,
          emailVerified: finalUserRecord.emailVerified
        }
      });
    }
  } catch (error) {
    console.error(`💥 [${requestId}] Server error:`, error.message);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  } finally {
    console.log(`🏁 [${requestId}] === REQUEST END ===\n`);
  }
}
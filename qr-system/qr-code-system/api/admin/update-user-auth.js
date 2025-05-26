// api/admin/update-user-auth.js
// Enhanced debug version with comprehensive logging

import admin from 'firebase-admin';

// Use environment variables for production security
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

// Initialize Firebase Admin SDK with debug logging
if (!admin.apps.length) {
  try {
    console.log("🚀 [DEBUG] Initializing Firebase Admin SDK...");
    console.log("🔧 [DEBUG] Project ID:", serviceAccount.project_id);
    console.log("🔧 [DEBUG] Client Email:", serviceAccount.client_email);
    console.log("🔧 [DEBUG] Using environment variables:", {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasDatabaseUrl: !!process.env.FIREBASE_DATABASE_URL
    });
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://qr-system-1cea7-default-rtdb.firebaseio.com"
    });
    console.log("✅ [DEBUG] Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ [DEBUG] Firebase admin initialization error:", error);
    console.error("❌ [DEBUG] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
} else {
  console.log("♻️ [DEBUG] Firebase Admin already initialized, using existing instance");
}

const auth = admin.auth();
const db = admin.database();

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n🔄 [DEBUG:${requestId}] === NEW REQUEST START ===`);
  console.log(`📥 [DEBUG:${requestId}] Method: ${req.method}`);
  console.log(`📥 [DEBUG:${requestId}] URL: ${req.url}`);
  console.log(`📥 [DEBUG:${requestId}] Headers:`, {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? `Bearer ${req.headers.authorization.substring(0, 20)}...` : 'Not provided',
    'user-agent': req.headers['user-agent']
  });

  // Handle CORS with debug logging
  console.log(`🌐 [DEBUG:${requestId}] Setting CORS headers...`);
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    console.log(`✅ [DEBUG:${requestId}] CORS preflight handled`);
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log(`❌ [DEBUG:${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log(`🔐 [DEBUG:${requestId}] Starting authentication verification...`);
    
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [DEBUG:${requestId}] Missing or invalid auth header:`, authHeader ? 'Present but malformed' : 'Not present');
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Missing or invalid token format' 
      });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    console.log(`🎫 [DEBUG:${requestId}] ID Token received (first 20 chars): ${idToken.substring(0, 20)}...`);
    console.log(`🎫 [DEBUG:${requestId}] ID Token length: ${idToken.length}`);
    
    // Verify the token and check if user has admin privileges
    let decodedToken;
    try {
      console.log(`🔍 [DEBUG:${requestId}] Verifying ID token with Firebase Auth...`);
      decodedToken = await auth.verifyIdToken(idToken);
      console.log(`✅ [DEBUG:${requestId}] Token verified successfully`);
      console.log(`👤 [DEBUG:${requestId}] Decoded token info:`, {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        auth_time: new Date(decodedToken.auth_time * 1000).toISOString(),
        iat: new Date(decodedToken.iat * 1000).toISOString(),
        exp: new Date(decodedToken.exp * 1000).toISOString(),
        firebase: decodedToken.firebase,
        customClaims: decodedToken.admin || decodedToken.role ? {
          admin: decodedToken.admin,
          role: decodedToken.role,
          superAdmin: decodedToken.superAdmin
        } : 'None'
      });
      
      // Check if user has admin or super_admin role
      console.log(`🔍 [DEBUG:${requestId}] Checking user role in database...`);
      const userRef = db.ref(`users/${decodedToken.uid}`);
      const userSnapshot = await userRef.once('value');
      const userData = userSnapshot.val();
      
      console.log(`👤 [DEBUG:${requestId}] User data from database:`, {
        exists: !!userData,
        profile: userData?.profile ? {
          name: userData.profile.name,
          email: userData.profile.email,
          role: userData.profile.role,
          authUid: userData.profile.authUid
        } : 'No profile found',
        rootLevel: {
          name: userData?.name,
          email: userData?.email,
          role: userData?.role
        }
      });
      
      const userRole = userData?.profile?.role?.toLowerCase() || userData?.role?.toLowerCase();
      console.log(`🎭 [DEBUG:${requestId}] User role (normalized): ${userRole || 'No role found'}`);
      
      if (!userRole || (!userRole.includes('admin') && userRole !== 'super_admin')) {
        console.log(`❌ [DEBUG:${requestId}] Access denied - insufficient privileges`);
        console.log(`❌ [DEBUG:${requestId}] Required: admin or super_admin, Found: ${userRole || 'none'}`);
        return res.status(403).json({ 
          success: false, 
          message: 'Forbidden: Admin privileges required' 
        });
      }
      
      console.log(`✅ [DEBUG:${requestId}] User has sufficient privileges: ${userRole}`);
      
    } catch (tokenError) {
      console.error(`❌ [DEBUG:${requestId}] Error verifying ID token:`, {
        message: tokenError.message,
        code: tokenError.code,
        stack: tokenError.stack
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Invalid token' 
      });
    }
    
    // Get request data
    console.log(`📋 [DEBUG:${requestId}] Processing request body...`);
    const { userId, updates } = req.body;
    console.log(`📋 [DEBUG:${requestId}] Request data:`, {
      userId,
      updates: updates ? Object.keys(updates).reduce((acc, key) => {
        acc[key] = key === 'password' ? '[REDACTED]' : updates[key];
        return acc;
      }, {}) : 'Not provided'
    });
    
    if (!userId) {
      console.log(`❌ [DEBUG:${requestId}] Missing userId in request`);
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: User ID is required' 
      });
    }

    if (!updates || typeof updates !== 'object') {
      console.log(`❌ [DEBUG:${requestId}] Invalid updates object:`, typeof updates);
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
      
    console.log(`🔧 [DEBUG:${requestId}] Valid updates after filtering:`, {
      ...validUpdates,
      password: validUpdates.password ? '[REDACTED]' : undefined
    });
      
    if (Object.keys(validUpdates).length === 0) {
      console.log(`❌ [DEBUG:${requestId}] No valid updates after filtering`);
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: No valid updates provided' 
      });
    }

    console.log(`🔄 [DEBUG:${requestId}] Updating user ${userId} with valid updates`);
    
    // Check if user exists in Firebase Auth
    let userExists = true;
    let existingUserRecord = null;
    try {
      console.log(`🔍 [DEBUG:${requestId}] Checking if user exists in Firebase Auth...`);
      existingUserRecord = await auth.getUser(userId);
      console.log(`✅ [DEBUG:${requestId}] User exists in Auth:`, {
        uid: existingUserRecord.uid,
        email: existingUserRecord.email,
        displayName: existingUserRecord.displayName,
        emailVerified: existingUserRecord.emailVerified,
        disabled: existingUserRecord.disabled,
        creationTime: existingUserRecord.metadata.creationTime,
        lastSignInTime: existingUserRecord.metadata.lastSignInTime,
        customClaims: existingUserRecord.customClaims
      });
    } catch (error) {
      console.log(`🔍 [DEBUG:${requestId}] User check error:`, {
        code: error.code,
        message: error.message
      });
      if (error.code === 'auth/user-not-found') {
        userExists = false;
        console.log(`ℹ️ [DEBUG:${requestId}] User does not exist in Firebase Auth, will create new user`);
      } else {
        console.error(`❌ [DEBUG:${requestId}] Unexpected error checking user:`, error);
        throw error;
      }
    }
    
    // If user doesn't exist in Auth, create them
    if (!userExists) {
      try {
        console.log(`👤 [DEBUG:${requestId}] Creating new user in Firebase Auth...`);
        
        // Get user from database to provide fallback values
        const userRef = db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();
        
        console.log(`📋 [DEBUG:${requestId}] Database user data for fallback:`, {
          exists: !!userData,
          profile: userData?.profile,
          rootData: {
            name: userData?.name,
            email: userData?.email
          }
        });
        
        if (!userData) {
          console.log(`❌ [DEBUG:${requestId}] User not found in database either`);
          return res.status(404).json({
            success: false,
            message: 'User not found in database'
          });
        }
        
        // Create user in Auth
        const createData = {
          uid: userId,
          email: validUpdates.email || userData.profile?.email || userData.email,
          displayName: validUpdates.displayName || userData.profile?.name || userData.name || '',
          password: validUpdates.password || 'AV2025!',
          emailVerified: true
        };
        
        console.log(`🔧 [DEBUG:${requestId}] Creating user with data:`, {
          ...createData,
          password: '[REDACTED]'
        });
        
        const userRecord = await auth.createUser(createData);
        console.log(`✅ [DEBUG:${requestId}] Created new auth user:`, {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified
        });
        
        // Set custom claims based on database role
        const userRole = userData.profile?.role || userData.role;
        if (userRole) {
          const claims = {
            role: userRole.toLowerCase()
          };
          
          if (userRole.toLowerCase().includes('admin')) {
            claims.admin = true;
            if (userRole.toLowerCase().includes('super')) {
              claims.superAdmin = true;
            }
          }
          
          console.log(`🎭 [DEBUG:${requestId}] Setting custom claims:`, claims);
          await auth.setCustomUserClaims(userId, claims);
          console.log(`✅ [DEBUG:${requestId}] Custom claims set successfully`);
        }
        
        // Update database to link the auth user
        console.log(`🔗 [DEBUG:${requestId}] Linking auth user in database...`);
        await db.ref(`users/${userId}/profile/authUid`).set(userId);
        console.log(`✅ [DEBUG:${requestId}] Database link created`);
        
        console.log(`🎉 [DEBUG:${requestId}] User creation completed successfully`);
        return res.status(201).json({
          success: true,
          message: 'User created in authentication system',
          userId: userRecord.uid
        });
      } catch (createError) {
        console.error(`❌ [DEBUG:${requestId}] Error creating auth user:`, {
          message: createError.message,
          code: createError.code,
          stack: createError.stack
        });
        return res.status(500).json({
          success: false,
          message: `Error creating user: ${createError.message}`
        });
      }
    }
    
    // Update existing user in Firebase Auth
    try {
      console.log(`🔄 [DEBUG:${requestId}] Updating existing user in Firebase Auth...`);
      console.log(`🔧 [DEBUG:${requestId}] Update payload:`, {
        ...validUpdates,
        password: validUpdates.password ? '[REDACTED]' : undefined
      });
      
      await auth.updateUser(userId, validUpdates);
      console.log(`✅ [DEBUG:${requestId}] Auth user updated successfully`);
      
      // If role is included in updates, update custom claims
      if (updates.role) {
        const claims = {
          role: updates.role.toLowerCase()
        };
        
        if (updates.role.toLowerCase().includes('admin')) {
          claims.admin = true;
          if (updates.role.toLowerCase().includes('super')) {
            claims.superAdmin = true;
          }
        }
        
        console.log(`🎭 [DEBUG:${requestId}] Updating custom claims:`, claims);
        await auth.setCustomUserClaims(userId, claims);
        console.log(`✅ [DEBUG:${requestId}] Custom claims updated successfully`);
      }
      
      // Ensure the authUid link is maintained in the database
      console.log(`🔗 [DEBUG:${requestId}] Maintaining database auth link...`);
      await db.ref(`users/${userId}/profile/authUid`).set(userId);
      console.log(`✅ [DEBUG:${requestId}] Database auth link maintained`);
      
      console.log(`🎉 [DEBUG:${requestId}] User update completed successfully`);
      return res.status(200).json({
        success: true,
        message: 'User authentication updated successfully',
        userId
      });
    } catch (updateError) {
      console.error(`❌ [DEBUG:${requestId}] Error updating auth user:`, {
        message: updateError.message,
        code: updateError.code,
        stack: updateError.stack
      });
      return res.status(500).json({
        success: false,
        message: `Error updating user: ${updateError.message}`
      });
    }
  } catch (error) {
    console.error(`💥 [DEBUG:${requestId}] Unexpected server error:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  } finally {
    console.log(`🏁 [DEBUG:${requestId}] === REQUEST END ===\n`);
  }
}
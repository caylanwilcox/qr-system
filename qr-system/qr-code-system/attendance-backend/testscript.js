// Test script to verify login credentials work
// Run this in your browser console or create a separate test page

import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// Your Firebase config (replace with your actual config)
const firebaseConfig = {
  // Your config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Test login function
async function testLogin(email, password) {
  console.log(`🧪 Testing login with email: ${email}`);
  console.log(`🧪 Testing login with password: ${password ? '[PROVIDED]' : '[NOT PROVIDED]'}`);
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Login successful!');
    console.log('👤 User info:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified
    });
    
    // Get ID token to check custom claims
    const idToken = await user.getIdToken();
    const tokenPayload = JSON.parse(atob(idToken.split('.')[1]));
    console.log('🎫 Token claims:', {
      admin: tokenPayload.admin,
      role: tokenPayload.role,
      superAdmin: tokenPayload.superAdmin
    });
    
    return { success: true, user };
  } catch (error) {
    console.error('❌ Login failed:', {
      code: error.code,
      message: error.message
    });
    
    // Specific error handling
    switch (error.code) {
      case 'auth/user-not-found':
        console.log('🔍 User not found - check if email is correct');
        break;
      case 'auth/wrong-password':
        console.log('🔑 Wrong password - check if password was actually updated');
        break;
      case 'auth/invalid-email':
        console.log('📧 Invalid email format');
        break;
      case 'auth/user-disabled':
        console.log('🚫 User account is disabled');
        break;
      case 'auth/too-many-requests':
        console.log('⏰ Too many failed attempts - wait before trying again');
        break;
      default:
        console.log('❓ Unknown error:', error.code);
    }
    
    return { success: false, error };
  }
}

// Usage examples:
// testLogin('user@example.com', 'newPassword123');
// testLogin('user@example.com', 'AV2025!');

// You can also test multiple credentials
async function testMultipleCredentials(testCases) {
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.description} ---`);
    await testLogin(testCase.email, testCase.password);
    
    // Sign out after each test
    try {
      await auth.signOut();
      console.log('🚪 Signed out');
    } catch (e) {
      console.log('⚠️ Sign out error:', e.message);
    }
  }
}

// Example usage:
/*
testMultipleCredentials([
  {
    description: 'Original credentials',
    email: 'user@example.com',
    password: 'originalPassword'
  },
  {
    description: 'Updated credentials',
    email: 'user@example.com', 
    password: 'newPassword123'
  },
  {
    description: 'Default password',
    email: 'user@example.com',
    password: 'AV2025!'
  }
]);
*/

// Manual test function you can call directly
window.testFirebaseLogin = testLogin;
window.testMultipleLogins = testMultipleCredentials;

console.log('🔧 Login test functions loaded!');
console.log('Use: testFirebaseLogin("email@example.com", "password")');
console.log('Or: testMultipleLogins([...testCases])'); 
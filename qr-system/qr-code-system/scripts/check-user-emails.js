// scripts/check-user-emails.js
// Utility script to check for users with invalid email addresses

import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // Load credentials from environment or service account file
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;
    
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://qr-system-1cea7-default-rtdb.firebaseio.com'
    });
  } else {
    console.error('Firebase credentials not found. Please set FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    process.exit(1);
  }
}

const db = admin.database();

// Email validation function
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

async function checkUserEmails() {
  console.log('Checking user emails...\n');
  
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    
    if (!users) {
      console.log('No users found in database.');
      return;
    }
    
    const results = {
      total: 0,
      valid: 0,
      invalid: 0,
      missing: 0,
      invalidUsers: [],
      missingUsers: [],
      duplicates: []
    };
    
    const emailMap = new Map(); // To track duplicates
    
    console.log('Analyzing user emails...\n');
    
    for (const [userId, userData] of Object.entries(users)) {
      results.total++;
      
      const email = userData.profile?.email;
      const userName = userData.profile?.name || userData.profile?.firstName + ' ' + userData.profile?.lastName || 'Unknown';
      
      if (!email) {
        results.missing++;
        results.missingUsers.push({
          id: userId,
          name: userName,
          location: userData.profile?.primaryLocation || userData.profile?.location || 'Unknown'
        });
        continue;
      }
      
      if (!isValidEmail(email)) {
        results.invalid++;
        results.invalidUsers.push({
          id: userId,
          name: userName,
          email: email,
          location: userData.profile?.primaryLocation || userData.profile?.location || 'Unknown'
        });
        continue;
      }
      
      // Check for duplicates
      const normalizedEmail = email.trim().toLowerCase();
      if (emailMap.has(normalizedEmail)) {
        results.duplicates.push({
          email: normalizedEmail,
          users: [emailMap.get(normalizedEmail), { id: userId, name: userName }]
        });
      } else {
        emailMap.set(normalizedEmail, { id: userId, name: userName });
      }
      
      results.valid++;
    }
    
    // Print summary
    console.log('=== EMAIL ANALYSIS SUMMARY ===');
    console.log(`Total users: ${results.total}`);
    console.log(`Valid emails: ${results.valid} (${((results.valid / results.total) * 100).toFixed(1)}%)`);
    console.log(`Invalid emails: ${results.invalid} (${((results.invalid / results.total) * 100).toFixed(1)}%)`);
    console.log(`Missing emails: ${results.missing} (${((results.missing / results.total) * 100).toFixed(1)}%)`);
    console.log(`Duplicate emails: ${results.duplicates.length}`);
    console.log('');
    
    // Show users with invalid emails
    if (results.invalidUsers.length > 0) {
      console.log('=== USERS WITH INVALID EMAILS ===');
      results.invalidUsers.forEach(user => {
        console.log(`${user.name} (${user.location}) - ${user.email} [ID: ${user.id}]`);
      });
      console.log('');
    }
    
    // Show users with missing emails
    if (results.missingUsers.length > 0 && results.missingUsers.length <= 20) {
      console.log('=== USERS WITH MISSING EMAILS ===');
      results.missingUsers.forEach(user => {
        console.log(`${user.name} (${user.location}) [ID: ${user.id}]`);
      });
      console.log('');
    } else if (results.missingUsers.length > 20) {
      console.log(`=== USERS WITH MISSING EMAILS (showing first 20 of ${results.missingUsers.length}) ===`);
      results.missingUsers.slice(0, 20).forEach(user => {
        console.log(`${user.name} (${user.location}) [ID: ${user.id}]`);
      });
      console.log(`... and ${results.missingUsers.length - 20} more`);
      console.log('');
    }
    
    // Show duplicate emails
    if (results.duplicates.length > 0) {
      console.log('=== DUPLICATE EMAILS ===');
      results.duplicates.forEach(dup => {
        console.log(`${dup.email}:`);
        dup.users.forEach(user => {
          console.log(`  - ${user.name} [ID: ${user.id}]`);
        });
      });
      console.log('');
    }
    
    // Save detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.total,
        valid: results.valid,
        invalid: results.invalid,
        missing: results.missing,
        duplicates: results.duplicates.length
      },
      invalidUsers: results.invalidUsers,
      missingUsers: results.missingUsers,
      duplicateEmails: results.duplicates
    };
    
    const fileName = `email-report-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(fileName, JSON.stringify(reportData, null, 2));
    console.log(`Detailed report saved to: ${fileName}`);
    
    // Recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    if (results.invalid > 0) {
      console.log(`• Fix ${results.invalid} users with invalid email addresses`);
    }
    if (results.missing > 0) {
      console.log(`• Add email addresses for ${results.missing} users`);
    }
    if (results.duplicates.length > 0) {
      console.log(`• Resolve ${results.duplicates.length} duplicate email addresses`);
    }
    
    const emailableUsers = results.valid - results.duplicates.length;
    console.log(`• ${emailableUsers} users can receive emails safely`);
    
    if (results.invalid > 0 || results.missing > 0) {
      console.log('\nFor bulk email blasts, consider:');
      console.log('• Filtering out users with invalid/missing emails before sending');
      console.log('• Using smaller batch sizes (5-10 emails at a time)');
      console.log('• Adding delays between batches to respect rate limits');
    }
    
  } catch (error) {
    console.error('Error checking user emails:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkUserEmails(); 
<<<<<<< HEAD
=======
// reset-attendance-data.js
// Run this script to remove all attendance data from the database
// This includes global attendance records and user profile attendance data

// Import required modules
const admin = require('firebase-admin');
require('dotenv').config({ path: '../.env' });

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID', 
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n📝 Please create a .env file in the project root with your Firebase credentials.');
  console.error('   You can use .env.example as a template.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

// Get database reference
const database = admin.database();

// Main function to reset all attendance data
async function resetAttendanceData() {
  console.log('🔄 Starting attendance data reset...');
  const updates = {};
  let globalAttendanceRecords = 0;
  let usersProcessed = 0;
  let userAttendanceRecords = 0;
  let clockInTimesRemoved = 0;
  let attendanceStatsReset = 0;
  
  try {
    // 1. Remove all global attendance records
    console.log('📊 Scanning global attendance collection...');
    const attendanceRef = database.ref('attendance');
    const attendanceSnapshot = await attendanceRef.once('value');
    
    if (attendanceSnapshot.exists()) {
      const attendanceData = attendanceSnapshot.val();
      
      // Count total records across all locations and dates
      for (const [location, locationData] of Object.entries(attendanceData)) {
        if (typeof locationData === 'object' && locationData !== null) {
          for (const [date, dateData] of Object.entries(locationData)) {
            if (typeof dateData === 'object' && dateData !== null) {
              globalAttendanceRecords += Object.keys(dateData).length;
            }
          }
        }
      }
      
      console.log(`Found ${globalAttendanceRecords} global attendance records`);
      
      // Remove entire attendance collection
      updates['attendance'] = null;
      console.log('✅ Global attendance collection marked for removal');
    } else {
      console.log('ℹ️  No global attendance records found');
    }
    
    // 2. Reset user attendance data
    console.log('👥 Scanning user profiles...');
    const usersRef = database.ref('users');
    const usersSnapshot = await usersRef.once('value');
    
    if (usersSnapshot.exists()) {
      const usersData = usersSnapshot.val();
      console.log(`Found ${Object.keys(usersData).length} users`);
      
      for (const [userId, userData] of Object.entries(usersData)) {
        usersProcessed++;
        let userUpdated = false;
        
        // Reset clockedIn status
        if (userData.clockedIn !== undefined) {
          updates[`users/${userId}/clockedIn`] = false;
          userUpdated = true;
        }
        
        // Remove clockInTimes
        if (userData.clockInTimes) {
          const clockInCount = Object.keys(userData.clockInTimes).length;
          clockInTimesRemoved += clockInCount;
          updates[`users/${userId}/clockInTimes`] = null;
          userUpdated = true;
          console.log(`  📅 User ${userId}: Removing ${clockInCount} clock-in times`);
        }
        
        // Remove attendance records
        if (userData.attendance) {
          const attendanceCount = Object.keys(userData.attendance).length;
          userAttendanceRecords += attendanceCount;
          updates[`users/${userId}/attendance`] = null;
          userUpdated = true;
          console.log(`  📋 User ${userId}: Removing ${attendanceCount} attendance records`);
        }
        
        // Reset attendance-related stats
        if (userData.stats) {
          const statsToReset = {
            'lastClockIn': null,
            'lastClockOut': null,
            'daysPresent': 0,
            'daysAbsent': 0,
            'daysLate': 0,
            'totalHours': 0
          };
          
          let hasStatsToReset = false;
          for (const [statKey, resetValue] of Object.entries(statsToReset)) {
            if (userData.stats[statKey] !== undefined) {
              updates[`users/${userId}/stats/${statKey}`] = resetValue;
              hasStatsToReset = true;
            }
          }
          
          if (hasStatsToReset) {
            attendanceStatsReset++;
            userUpdated = true;
            console.log(`  📈 User ${userId}: Resetting attendance statistics`);
          }
        }
        
        // Remove location history if it exists
        if (userData.locationHistory) {
          updates[`users/${userId}/locationHistory`] = null;
          userUpdated = true;
          console.log(`  📍 User ${userId}: Removing location history`);
        }
        
        if (userUpdated) {
          console.log(`  ✅ User ${userId}: Attendance data reset`);
        } else {
          console.log(`  ℹ️  User ${userId}: No attendance data to reset`);
        }
      }
    } else {
      console.log('ℹ️  No users found in database');
    }
    
    // 3. Apply all updates
    if (Object.keys(updates).length > 0) {
      console.log(`\n🔄 Applying ${Object.keys(updates).length} database updates...`);
      await database.ref().update(updates);
      console.log('✅ Attendance data reset completed successfully');
    } else {
      console.log('ℹ️  No attendance data to reset');
    }
    
    // 4. Summary
    console.log(`
    ========= ATTENDANCE RESET SUMMARY =========
    Global attendance records removed: ${globalAttendanceRecords}
    Users processed:                   ${usersProcessed}
    User attendance records removed:   ${userAttendanceRecords}
    Clock-in times removed:            ${clockInTimesRemoved}
    User stats reset:                  ${attendanceStatsReset}
    Total database updates:            ${Object.keys(updates).length}
    ============================================
    `);
    
    console.log('🎉 Attendance data reset completed successfully!');
    console.log('📝 Note: User profiles, events, and other non-attendance data remain intact.');
    
  } catch (error) {
    console.error('❌ Error resetting attendance data:', error);
    throw error;
  }
}

// Confirmation prompt
function confirmReset() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('⚠️  WARNING: This will permanently delete ALL attendance data!');
    console.log('📋 This includes:');
    console.log('   - Global attendance records (attendance collection)');
    console.log('   - User clock-in times and attendance records');
    console.log('   - User attendance statistics');
    console.log('   - User location history');
    console.log('');
    console.log('✅ This will NOT affect:');
    console.log('   - User profiles and basic information');
    console.log('   - Event schedules and event data');
    console.log('   - System settings and configurations');
    console.log('');
    
    rl.question('Are you sure you want to proceed? (type "YES" to confirm): ', (answer) => {
      rl.close();
      resolve(answer === 'YES');
    });
  });
}

// Run the reset process with confirmation
async function main() {
  try {
    const confirmed = await confirmReset();
    
    if (!confirmed) {
      console.log('❌ Reset cancelled by user');
      process.exit(0);
    }
    
    await resetAttendanceData();
    console.log('✅ Attendance reset script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main(); 
>>>>>>> be894cc (d)

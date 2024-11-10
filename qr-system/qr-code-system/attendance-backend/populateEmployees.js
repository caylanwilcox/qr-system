// Required imports for Firebase Admin SDK
const admin = require('firebase-admin');
const moment = require('moment-timezone');

// Initialize Firebase Admin SDK using service account
const serviceAccount = require('./serviceAccountKey.json'); // Path to your service account key file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://qr-system-1cea7-default-rtdb.firebaseio.com',  // Your Firebase Realtime Database URL
});

// Get Firebase Admin Database reference for server-side usage
const database = admin.database();

// Populate Employee Data and Scheduling Module
async function populateEmployeeData() {
  try {
    console.log('Starting to populate employee data...');

    // Clear existing attendance and schedule data
    const attendanceRef = database.ref('attendance');
    const scheduleRef = database.ref('schedule');
    await attendanceRef.remove();
    await scheduleRef.remove();
    console.log('Cleared all existing attendance and schedule data.');

    // List of locations including Retreat
    const locations = [
      'Agua Viva Elgin R7',
      'Agua Viva Joliet',
      'Agua Viva Lyons',
      'Agua Viva West Chicago',
      'Agua Viva Wheeling',
      'Retreat' // Newly added location
    ];

    // Dummy employee names
    const employeeNames = [
      'Alice Johnson',
      'Bob Smith',
      'Charlie Brown',
      'Diana Prince',
      'Ethan Hunt',
      'Fiona Gallagher',
      'George Clooney',
      'Hannah Montana',
      'Ian Somerhalder',
      'Julia Roberts'
    ];

    // Generate random employees and schedules for each location
    for (const location of locations) {
      const locationAttendanceRef = database.ref(`attendance/${location}`);
      const locationScheduleRef = database.ref(`schedule/${location}`);

      for (let i = 0; i < employeeNames.length; i++) {
        let employeeName = employeeNames[i];
        let employeeId = `Employee${i + 1}_${location.replace(/\s+/g, '_')}`;

        // Create attendance history for the past 3 days
        let attendanceHistory = {};
        for (let d = 0; d < 3; d++) {
          let date = moment().subtract(d, 'days').format('YYYY-MM-DD');
          let clockInTime = null;
          let clockOutTime = null;
          let onTime = false;
          let rankUp = Math.random() < 0.3; // Randomly determine if rank-up

          if (d === 0 && i === 0) {
            // Employee 1: Clocked in on time
            clockInTime = '08:00 AM';
            clockOutTime = '04:00 PM';
            onTime = true;
          } else if (d === 0 && i === 1) {
            // Employee 2: Clocked in late
            clockInTime = '08:30 AM';
            clockOutTime = '04:00 PM';
            onTime = false;
          } else if (d === 0 && i === 2) {
            // Employee 3: Did not show up
            clockInTime = null;
            clockOutTime = null;
          } else {
            // Other employees: Random clock-in times
            clockInTime = moment().subtract(d, 'days').set({ hour: 8, minute: Math.floor(Math.random() * 30) }).tz('America/Chicago').format('hh:mm:ss A');
            clockOutTime = moment().subtract(d, 'days').set({ hour: 16 }).tz('America/Chicago').format('hh:mm:ss A');
            onTime = Math.random() > 0.5;
          }

          attendanceHistory[date] = {
            clockInTime: clockInTime,
            clockOutTime: clockOutTime,
            onTime: onTime,
            rankUp: rankUp
          };
        }

        // Push attendance data
        await locationAttendanceRef.child(employeeId).set({
          name: employeeName,
          attendanceHistory: attendanceHistory
        });

        // Create a schedule for each employee for the next 3 days
        for (let d = 0; d < 3; d++) {
          let date = moment().add(d, 'days').format('YYYY-MM-DD');
          await locationScheduleRef.push({
            employeeId: employeeId,
            date: date,
            expectedClockIn: '08:00 AM',
            expectedClockOut: '04:00 PM'
          });
        }
      }
      console.log(`Successfully populated employee data and schedule for location: ${location}`);
    }

    console.log('Employee data and schedules populated successfully.');
  } catch (error) {
    console.error('Error populating employee data:', error);
  }
}

// Run the function
populateEmployeeData().then(() => {
  console.log('Script finished executing.');
  process.exit(0);
}).catch((error) => {
  console.error('Error executing script:', error);
  process.exit(1);
});

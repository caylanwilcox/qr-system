// Required imports for Express.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment-timezone');
const admin = require('firebase-admin'); // Firebase Admin SDK for server-side operations

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://qr-system-1cea7-default-rtdb.firebaseio.com', // Your Firebase Realtime Database URL
});

// Get Firebase Admin Database reference for server-side usage
const database = admin.database();

// Create the server app
const app = express();
const PORT = process.env.PORT || 3003;

app.use(bodyParser.json());
app.use(cors());

/**
 * Endpoint to clock-in an employee.
 * Expects employeeId, name, and location in the query parameters.
 */
app.get('/clock-in', async (req, res) => {
  const { employeeId, name, location } = req.query;
  console.log('Clock-in request received:', { employeeId, name, location });

  // Validate request parameters
  if (!employeeId || !location || !name) {
    console.log(`Invalid parameters: employeeId=${employeeId}, name=${name}, location=${location}`);
    return res.status(400).send('Employee ID, name, and location are required');
  }

  // Generate clock-in time using moment.js with timezone support
  const clockInTime = moment().tz('America/Chicago').format('YYYY-MM-DD HH:mm:ss');

  try {
    // Dynamically reference the correct location path in Firebase Admin SDK
    const ref = database.ref(`attendance/${location}/${employeeId}`);
    
    // Update clock-in data in the database
    await ref.update({
      employeeId,
      name,
      clockInTime
    });

    // Log and send confirmation response
    console.log(`Employee ${name} (${employeeId}) clocked in at location ${location} at ${clockInTime}`);
    res.send(`Employee ${name} clocked in at ${clockInTime} at location ${location}`);
  } catch (error) {
    console.error('Error clocking in:', error);
    res.status(500).send('Error clocking in');
  }
});

/**
 * Endpoint to fetch attendance records.
 * Can filter by location and/or employeeId if provided in the query parameters.
 */
app.get('/attendance', async (req, res) => {
  const { location, employeeId } = req.query;

  // Validate location is provided
  if (!location) {
    return res.status(400).send('Location is required');
  }

  try {
    // Reference the correct location in Firebase Admin SDK
    const ref = database.ref(`attendance/${location}`);
    let snapshot = await ref.once('value');
    let data = snapshot.val();

    let attendance = Object.values(data || {});

    // Filter by employeeId if provided
    if (employeeId) {
      attendance = attendance.filter(record => record.employeeId === employeeId);
    }

    console.log(`Filtered data for location "${location}" and employeeId "${employeeId}":`, attendance);

    // Return empty array if no records found
    if (attendance.length === 0) {
      console.log(`No records found for location: ${location} and employeeId: ${employeeId}`);
      return res.json([]);
    }

    // Return the filtered attendance data
    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).send('Error fetching attendance');
  }
});

/**
 * Endpoint to calculate absentees based on scheduled shifts.
 * This endpoint will iterate over all attendance records to check if employees missed their shifts.
 */
app.post('/mark-absentees', async (req, res) => {
  try {
    // Reference to all attendance records
    const ref = database.ref('attendance');
    let snapshot = await ref.once('value');
    let attendanceData = snapshot.val();

    const currentTime = moment().tz('America/Chicago');

    // Iterate through each location
    Object.keys(attendanceData || {}).forEach(location => {
      const employees = attendanceData[location];

      // Iterate through each employee
      Object.keys(employees).forEach(employeeId => {
        const employee = employees[employeeId];
        const { shiftStartTime, shiftEndTime, clockInTime } = employee;

        // Only proceed if shift timings are present
        if (shiftStartTime && shiftEndTime) {
          const shiftEnd = moment.tz(`${currentTime.format('YYYY-MM-DD')} ${shiftEndTime}`, 'America/Chicago');
          
          // If the shift is over and no clockInTime, mark as absent
          if (!clockInTime && currentTime.isAfter(shiftEnd)) {
            console.log(`Employee ${employee.name} (${employeeId}) at location ${location} is marked as absent.`);

            // Update employee record to indicate absence
            const employeeRef = database.ref(`attendance/${location}/${employeeId}`);
            employeeRef.update({
              absent: true,
              absentMarkedAt: currentTime.format('YYYY-MM-DD HH:mm:ss')
            });
          }
        }
      });
    });

    res.send('Absentees marked successfully.');
  } catch (error) {
    console.error('Error marking absentees:', error);
    res.status(500).send('Error marking absentees');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Required imports for Express.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const moment = require('moment-timezone');
const admin = require('firebase-admin');  // Firebase Admin SDK for server-side operations

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://qr-system-1cea7-default-rtdb.firebaseio.com',  // Your Firebase Realtime Database URL
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
  const clockInTime = moment().tz('America/Chicago').format('YYYY-MM-DD hh:mm:ss A');

  try {
    // Dynamically reference the correct location path in Firebase Admin SDK
    const ref = database.ref(`attendance/${location}`);
    
    // Push the new clock-in data to the correct location in the database
    await ref.push({
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

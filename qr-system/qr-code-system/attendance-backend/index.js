// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// Check if the DATABASE_URL is properly loaded
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not defined. Make sure .env file is properly loaded and DATABASE_URL is set.');
  process.exit(1);
}

// Create a service account object using environment variables
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
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});

// Get Firebase Admin Database reference
const database = admin.database();

// Create the server app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(cors());

// Logging middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

/**
 * Clock-in/Clock-out endpoint
 */
app.post('/clock-in', async (req, res) => {
  try {
    const { employeeId, location, mode, name, timestamp } = req.body;
    const formattedTime = moment(timestamp).unix();
    const employeeRef = database.ref(`attendance/${location}/${employeeId}`);
    const employeeData = await employeeRef.once('value').then((snapshot) => snapshot.val());

    if (!employeeData) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const activeShift = employeeData.clockInTimes && !employeeData.clockOutTimes;
    const assignedDates = employeeData.assignedDates || [];

    // Prevent duplicate clock-ins
    if (mode === 'clock-in' && activeShift) {
      return res.status(400).json({
        success: false,
        message: "Cannot clock in. Please clock out first.",
      });
    }

    // Check if clocking in after the assigned time
    const today = moment().format("YYYY-MM-DD");
    const assignedToday = assignedDates.find((date) => date.startsWith(today));
    if (assignedToday) {
      const assignedTime = moment(assignedToday, "YYYY-MM-DD HH:mm");
      if (moment().isAfter(assignedTime)) {
        return res.status(400).json({
          success: false,
          message: "Clock-in must occur before the assigned schedule time.",
        });
      }
    }

    // Process Clock-In
    if (mode === 'clock-in') {
      await employeeRef.update({
        [`clockInTimes/${formattedTime}`]: formattedTime,
      });
      return res.json({ success: true, message: "Clocked in successfully!" });
    }

    // Process Clock-Out
    if (mode === 'clock-out') {
      const lastClockIn = Object.keys(employeeData.clockInTimes || {}).pop();
      const duration = formattedTime - lastClockIn;
      await employeeRef.update({
        [`clockOutTimes/${formattedTime}`]: formattedTime,
        [`shiftDurations/${lastClockIn}`]: duration,
      });
      return res.json({ success: true, message: `Clocked out successfully! Shift duration: ${duration} seconds.` });
    }

    res.status(400).json({ success: false, message: "Invalid mode." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
});

// Test endpoint
app.post('/test', (req, res) => {
  console.log('Test endpoint hit:', req.body);
  res.json({ success: true, message: 'Test successful!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

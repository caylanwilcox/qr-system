// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// Check if the DATABASE_URL is properly loaded
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not defined. Make sure .env file is properly loaded and DATABASE_URL is set.');
  process.exit(1); // Stop execution
}

// Create a service account object using environment variables
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // Convert newline characters correctly
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// Initialize Firebase Admin SDK using the credentials from environment variables
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL, // Use the database URL from the environment variables
});

// Get Firebase Admin Database reference for server-side usage
const database = admin.database();

// Create the server app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware Setup
app.use(express.json()); // Parse incoming JSON requests
app.use(cors()); // Enable CORS for cross-origin requests

// Logging Middleware
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

/**
 * Endpoint to clock-in or clock-out an employee.
 * Expects employeeId, location, mode, name, and timestamp in the request body.
 */
app.post('/clock-in', async (req, res) => {
  try {
    const { employeeId, location, mode, name, timestamp } = req.body;

    console.log('Clock-in/out request received:', { employeeId, location, mode, name, timestamp });

    // Validate input parameters
    if (!employeeId || !location || !mode || !timestamp) {
      console.error('Invalid parameters received:', { employeeId, location, mode, timestamp });
      return res.status(400).json({ success: false, message: 'All parameters (employeeId, location, mode, timestamp) are required' });
    }

    // Use Unix timestamp as a key to avoid special character issues
    const formattedTime = moment(timestamp).unix();
    console.log('Formatted time (safe for Firebase key):', formattedTime);

    // Reference to the employee's data in Firebase
    const employeeRef = database.ref(`attendance/${location}/${employeeId}`);
    let employeeData;

    try {
      console.log('Fetching employee data from Firebase...');
      employeeData = await employeeRef.once('value').then(snapshot => snapshot.val());

      if (!employeeData) {
        console.error(`Employee with ID ${employeeId} not found at location ${location}`);
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      console.log('Employee data received:', employeeData);

      if (mode === 'clock-in') {
        console.log('Attempting to clock in the employee...');

        // Update the employee record with clock-in information
        const updatedData = {
          [`clockInTimes.${formattedTime}`]: formattedTime, // Clock-in times recorded with Unix timestamp
          lastLocation: location,
          name: name, // Optional: if you want to keep updating the employee's name in the record
          totalDays: (employeeData.totalDays || 0) + 1, // Increment the total days
          daysOnTime: (employeeData.daysOnTime || 0) + 1, // Assuming this clock-in is on-time
        };

        console.log('Data to be updated in Firebase:', updatedData);

        // Try to perform the update in Firebase
        await employeeRef.update(updatedData);

        console.log(`Employee ${employeeData.name} (${employeeId}) clocked in at ${formattedTime} at ${location}`);
        return res.json({
          success: true,
          message: `Employee ${employeeData.name} clocked in at ${formattedTime} at location ${location}`,
          employeeName: employeeData.name,
          employeePhoto: employeeData.photo || '',
        });
      } else if (mode === 'clock-out') {
        console.log('Attempting to clock out the employee...');

        // Update the employee record with clock-out information
        const updatedData = {
          [`clockOutTimes.${formattedTime}`]: formattedTime, // Clock-out times recorded under Unix timestamp
        };

        console.log('Data to be updated in Firebase:', updatedData);

        await employeeRef.update(updatedData);

        console.log(`Employee ${employeeData.name} (${employeeId}) clocked out at ${formattedTime} at ${location}`);
        return res.json({
          success: true,
          message: `Employee ${employeeData.name} clocked out at ${formattedTime} at location ${location}`,
        });
      } else {
        console.error('Invalid mode specified:', mode);
        return res.status(400).json({ success: false, message: 'Invalid mode specified' });
      }

    } catch (error) {
      console.error('Error while fetching or updating employee data:', error);
      return res.status(500).json({ success: false, message: 'Error accessing or updating employee data', error: error.message });
    }
  } catch (error) {
    console.error('Unexpected error during clock-in/out process:', error);
    return res.status(500).json({ success: false, message: 'Unexpected server error during clock-in/out' });
  }
});


// Dummy Test Endpoint to verify server connectivity
app.post('/test', (req, res) => {
  console.log('Test endpoint hit. Request body:', req.body);
  res.json({ success: true, message: 'Test endpoint is working!' });
});

// Endpoint for Firebase-independent testing
app.post('/simulate-clock-in', (req, res) => {
  console.log('Simulated clock-in request received:', req.body);
  return res.json({ success: true, message: 'Simulated clock-in success!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

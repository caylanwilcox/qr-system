// Load environment variables from .env file
require('dotenv').config({ path: '/Users/it/code/qr-system/qr-system/qr-code-system/.env' });

console.log("Database URL from env:", process.env.REACT_APP_FIREBASE_DATABASE_URL);

const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
const admin = require('firebase-admin');

// Check if the FIREBASE_DATABASE_URL is properly loaded
if (!process.env.REACT_APP_FIREBASE_DATABASE_URL) {
  console.error('Error: REACT_APP_FIREBASE_DATABASE_URL environment variable is not defined. Make sure .env file is properly loaded and REACT_APP_FIREBASE_DATABASE_URL is set.');
  process.exit(1);
}

// Create a service account object using environment variables
const serviceAccount = {
  type: process.env.TYPE || "service_account",
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // Convert `\n` back to actual newlines
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
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
 * Process attendance records by month
 */
const processAttendanceRecords = (clockInTimes = {}, clockOutTimes = {}, shiftDurations = {}) => {
  const recordsByMonth = {};
  
  // Process each clock-in record
  Object.entries(clockInTimes).forEach(([timestamp, clockIn]) => {
    const date = moment.unix(clockIn);
    const monthYear = date.format('YYYY-MM');
    
    if (!recordsByMonth[monthYear]) {
      recordsByMonth[monthYear] = [];
    }
    
    const clockOut = clockOutTimes[timestamp];
    const duration = shiftDurations[timestamp];
    const hoursWorked = duration ? (duration / 3600).toFixed(2) : null;
    
    recordsByMonth[monthYear].push({
      date: date.format('YYYY-MM-DD'),
      fullDate: date.format('MMMM D, YYYY'),
      dayOfWeek: date.format('dddd'),
      clockIn: date.format('h:mm:ss A'),
      clockOut: clockOut ? moment.unix(clockOut).format('h:mm:ss A') : null,
      hoursWorked,
      timestamp: parseInt(timestamp),
      status: clockOut ? 'Completed' : 'In Progress'
    });
  });

  // Sort months and records
  const sortedMonths = Object.keys(recordsByMonth).sort().reverse();
  sortedMonths.forEach(month => {
    recordsByMonth[month].sort((a, b) => b.timestamp - a.timestamp);
  });

  return { months: sortedMonths, records: recordsByMonth };
};

/**
 * Process assigned dates by month
 */
const processAssignedDates = (dates = []) => {
  const datesByMonth = {};
  const now = moment();
  
  dates.forEach(dateStr => {
    if (!dateStr) return; // Skip empty dates
    
    const date = moment(dateStr, "YYYY-MM-DD HH:mm");
    if (!date.isValid()) return; // Skip invalid dates
    
    const monthYear = date.format('YYYY-MM');
    
    if (!datesByMonth[monthYear]) {
      datesByMonth[monthYear] = [];
    }
    
    // Determine status based on current time
    const status = date.isSame(now, 'day') ? 'Today' : 
                   date.isBefore(now, 'day') ? 'Past' : 'Upcoming';
    
    datesByMonth[monthYear].push({
      date: dateStr,
      fullDate: date.format('MMMM D, YYYY'),
      dayOfWeek: date.format('dddd'),
      time: date.format('h:mm A'),
      status,
      isPast: date.isBefore(now, 'day')
    });
  });

  // Sort months and dates
  const sortedMonths = Object.keys(datesByMonth).sort();
  sortedMonths.forEach(month => {
    datesByMonth[month].sort((a, b) => moment(a.date).diff(moment(b.date)));
  });

  return { months: sortedMonths, dates: datesByMonth };
};

/**
 * Get employee data endpoint
 */
app.get('/api/employees/:location/:employeeId', async (req, res) => {
  try {
    const { location, employeeId } = req.params;
    const employeeRef = database.ref(`attendance/${location}/${employeeId}`);
    const snapshot = await employeeRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const data = snapshot.val();
    
    // Process attendance and schedule data
    const attendance = processAttendanceRecords(
      data.clockInTimes, 
      data.clockOutTimes,
      data.shiftDurations
    );
    const schedule = processAssignedDates(data.assignedDates);

    // Calculate attendance statistics
    const currentMonth = moment().format('YYYY-MM');
    const currentMonthRecords = attendance.records[currentMonth] || [];
    const totalHoursThisMonth = currentMonthRecords.reduce((total, record) => {
      return total + (record.hoursWorked ? parseFloat(record.hoursWorked) : 0);
    }, 0);

    res.json({
      success: true,
      data: {
        employeeDetails: {
          name: data.name,
          position: data.position,
          rank: data.rank,
          email: data.email,
          phone: data.phone
        },
        attendance,
        schedule,
        statistics: {
          totalHoursThisMonth: totalHoursThisMonth.toFixed(2),
          totalShiftsThisMonth: currentMonthRecords.length,
          upcomingShifts: schedule.dates[currentMonth]?.filter(d => d.status === 'Upcoming').length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee data:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
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

    // Check for active shift
    const clockInTimes = employeeData.clockInTimes || {};
    const clockOutTimes = employeeData.clockOutTimes || {};
    const lastClockInTimestamp = Object.keys(clockInTimes).pop();
    const hasActiveShift = lastClockInTimestamp && 
                          !clockOutTimes[lastClockInTimestamp];

    // Prevent duplicate clock-ins
    if (mode === 'clock-in' && hasActiveShift) {
      return res.status(400).json({
        success: false,
        message: "Cannot clock in. Please clock out first.",
      });
    }

    // Check if clocking in after the assigned time
    const today = moment().format("YYYY-MM-DD");
    const assignedDates = employeeData.assignedDates || [];
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
      return res.json({ 
        success: true, 
        message: "Clocked in successfully!",
        timestamp: formattedTime
      });
    }

    // Process Clock-Out
    if (mode === 'clock-out') {
      if (!hasActiveShift) {
        return res.status(400).json({
          success: false,
          message: "No active shift found to clock out from.",
        });
      }

      const duration = formattedTime - lastClockInTimestamp;
      await employeeRef.update({
        [`clockOutTimes/${lastClockInTimestamp}`]: formattedTime,
        [`shiftDurations/${lastClockInTimestamp}`]: duration,
      });
      
      const hoursWorked = (duration / 3600).toFixed(2);
      return res.json({ 
        success: true, 
        message: `Clocked out successfully! Shift duration: ${hoursWorked} hours.`,
        timestamp: formattedTime,
        duration: duration,
        hoursWorked: hoursWorked
      });
    }

    res.status(400).json({ success: false, message: "Invalid mode." });
  } catch (error) {
    console.error('Clock-in/out error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
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
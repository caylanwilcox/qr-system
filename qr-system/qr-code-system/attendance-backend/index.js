//attendance-backend/index.js// Load environment variables from .env file
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
  type: "service_account",
  project_id: "qr-system-1cea7",
  private_key_id: "14ad13ff505798e18917023a7de21bff80386377",
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFamWAJUrHYeM0\n6LdmkmRom3zfzyS+Y7ES6bFsjYab7/5k4SPKipDfxPIK9JPU3eUV0vxAFTmAXy7T\nApF39FgoKm8DhFCBNUbjTmjmQSw1+vt5OlF68Lj9d9hl1b6RJgQkr7ZBgoJTdx4E\neUHCCscu29IIdlOTt4mqkGfPysadc/aLBhBEJeEQs9sQYMghHcYDx3X51f7EdS+J\ntbqGoEIXy7lW0u4LhJMcGkKK0mK/bOxLi3QsNeA7CkCsCSt34xXngn8WJgvZSB5E\ngSr9FxQTTxpbSFHFBhoePHXO2Zql70ZOcERi8yMiwCI/KuspBrhyFDRMC12kpo/q\n5CUGACcvAgMBAAECggEAGL90G/K7g2/SWMv3pHnORo1/blsnDbWs+WRRuVGrQe8o\nYqMVUTW6YE2YfiZs8IQkohjB8JKjPmQwQtmRPOAPu8aeBhXXNcC6XefIH11PhTDX\nx48NBIQa3K43yC8EZb5wnzIRKfiKDUaN0nJqUOtNpE0q8PlMaY8vndyJIbPCNEig\nifv2hI2f1FIgjr3fDYQzqT684OiZnNytAw75fY4BjrYVfWGNik7aUXwNyTUOq5s2\nkQDGHi196cpwCPYE7Jf2vKHyaudTOVwfGQJEimZNWJ5VXIG4RNjdEIR+ceUJvWJp\nbe0rNvledDdiwrtVWJrqRtATanlVf1SnQJZJ+7kLgQKBgQDmljfQ+Gl/lHjZFZsP\nNuKKaGc8b2jZOCsjjsYmGEQPniOHqlhThzHcd1zwDkcnvwek83EHBa8o4qMSsvlp\n3I3sKSJdomQiPT4PmXMQf4wnAGON1BX1dWA8gpU4B8sbgeTVymGnpYFPCjeCYOs9\nT8jfQMs7rU8c8uRA15NerbYcbwKBgQDbLEkzA1twyVpRIUh52xm4Tj4UeKvIYtO8\nfS9biYl1b7pn7fcpsOFIMQ/l6sBPZAHfezBr6n4842BB0dxQkgebIGom+N7bLpBC\na7ys+9wYaNaRiho6nrJXwO8zhjKaB3ELdBhMcloHmxau/MsA2a4ZyQXttRMQt+yL\nLPF9lgGBQQKBgQDZ4bugI/pb6Qk/5yB7gdsR+ZEDFCq4hlCM6s3lFSzKrRzZhmar\nlqXQsqEI3BT0Q5ePj9CPWBmowm5grujp1NPuAPhODbIcgE3yI4cMYdkmyUFItMyD\nAYQL6T/ij8qllVmLgg5AgSzsaLUG51mgt5ERE4J2Q07sBb8UXh8MaYwY1QKBgQCK\njmGsLUgmcjR1q5vc5UVKPbSDTpISuV9v/pfsv3M12a83OroREjApalLJn/F5fxis\nBn3jCzhJF9lnYttr2BWU3RYekyCX4cTzKJb7qLFIgSZ8lZjlTCQk0+SkZwcgVuoB\nOqCN25DM1B+v+kH/xJ2K0Ym878cgv5V7mqsEIMvMwQKBgGNlfrKrLrcHiMQvegx+\nRnNXlLFHLNUzNJoTGgt/SxZYFOjUOaKpHDcrnvE40ciskktIXN1ipaIvUVyaDwTc\n9ZU9ndz0cpupK45dWWzx070ddbWwwB16MQNjCi3T+7d0KZ8HLOZaWTQ5VdeERkPR\nhYO57PTsaw0oJBWhPy2naEWb\n-----END PRIVATE KEY-----\n`,
  client_email: "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",
  client_id: "118105325590848927895",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fqxwu%40qr-system-1cea7.iam.gserviceaccount.com"
};

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://qr-system-1cea7-default-rtdb.firebaseio.com",
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    process.exit(1);
  }
} else {
  console.log("Firebase Admin already initialized");
}

// Get Firebase Admin Database reference
const database = admin.database();

// Helper functions for database operations (since we're using admin SDK)
const ref = (path) => database.ref(path);
const get = (ref) => ref.once('value');
const update = (ref, updates) => ref.update(updates);

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
// Modify your server-side clock-in endpoint to handle event attendance
/**
 * Clock-in/Clock-out endpoint
 */
app.post('/clock-in', async (req, res) => {
  try {
    const { employeeId, location, mode, name, barcodeData } = req.body;
    const timestamp = Date.now();
    const formattedTime = Math.floor(timestamp / 1000); // Convert to Unix timestamp
    
    // Get current time in Chicago timezone
    const now = moment().tz('America/Chicago');
    const today = now.format('YYYY-MM-DD'); // YYYY-MM-DD
    
    // Reference to the employee data
    const employeeRef = ref(database, `users/${employeeId}`);
    const employeeSnapshot = await get(employeeRef);
    const employeeData = employeeSnapshot.val();

    if (!employeeData) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    // Updates object for Firebase
    const updates = {};
    
    // Process Clock-In
    if (mode === 'clock-in') {
      // Basic clock-in data
      updates[`users/${employeeId}/stats/lastClockIn`] = now.toISOString();
      updates[`users/${employeeId}/activityLog/clockIns/${timestamp}`] = {
        timestamp: now.toISOString(),
        location,
        barcodeData: barcodeData || null
      };
      
      // Increment days present if this is the first clock-in today
      const lastClockInDate = employeeData.stats?.lastClockIn
        ? moment.tz(employeeData.stats.lastClockIn, 'America/Chicago').format('YYYY-MM-DD')
        : null;
        
      // Only count as a new day if last clock-in wasn't today
      if (lastClockInDate !== today) {
        const daysPresent = (employeeData.stats?.daysPresent || 0) + 1;
        updates[`users/${employeeId}/stats/daysPresent`] = daysPresent;
        
        // Check if late (after 9:00 AM)
        const currentHour = now.hour();
        const currentMinute = now.minute();
        const isLate = currentHour >= 9 && currentMinute > 0;
        
        if (isLate) {
          // Increment days late counter
          const daysLate = (employeeData.stats?.daysLate || 0) + 1;
          updates[`users/${employeeId}/stats/daysLate`] = daysLate;
          updates[`users/${employeeId}/activityLog/clockIns/${timestamp}/isLate`] = true;
        }
      }
      
      // Add to location history if location changed
      const currentLocation = employeeData.locationHistory && employeeData.locationHistory.length > 0
        ? employeeData.locationHistory[0]
        : null;
      
      if (!currentLocation || currentLocation.locationId !== location) {
        // Update location history (keep older entries)
        const locationHistory = employeeData.locationHistory || [];
        locationHistory.unshift({
          locationId: location,
          date: now.toISOString()
        });
        
        updates[`users/${employeeId}/location`] = location;
        updates[`users/${employeeId}/locationHistory`] = locationHistory.slice(0, 10); // Keep only the 10 most recent
      }
      
      // Process scheduled events for today to mark attendance
      let eventsUpdated = [];
      
      // Check each event type based on StatsSection categories
      const eventTypes = ['workshops', 'meetings', 'haciendas', 'juntaHacienda', 'gestion'];
      
      // Process each event type
      for (const eventType of eventTypes) {
        // Skip if user doesn't have events of this type
        if (!employeeData.events || !employeeData.events[eventType]) continue;
        
        // Get all events of this type for the user
        const eventsOfType = employeeData.events[eventType];
        
        // Loop through each event
        for (const [eventId, eventData] of Object.entries(eventsOfType)) {
          // Only process events that are scheduled for today and not yet marked as attended
          if (eventData.scheduled && !eventData.attended) {
            // For Haciendas (weekend retreats), check if today falls within the event dates
            if (eventType === 'haciendas' && eventData.endDate) {
              const startDate = moment.tz(eventData.date, 'America/Chicago');
              const endDate = moment.tz(eventData.endDate, 'America/Chicago');
              
              // If today is between start and end dates inclusive
              if (now.isBetween(startDate, endDate, 'day', '[]')) {
                updates[`users/${employeeId}/events/${eventType}/${eventId}/attended`] = true;
                updates[`users/${employeeId}/events/${eventType}/${eventId}/attendedAt`] = now.toISOString();
                
                eventsUpdated.push({
                  type: eventType,
                  id: eventId,
                  name: eventData.title || 'Hacienda'
                });
              }
            } 
            // Standard same-day attendance for other event types
            else {
              // Get event date in Chicago timezone
              const eventDate = moment.tz(eventData.date, 'America/Chicago');
              const eventDateStr = eventDate.format('YYYY-MM-DD');
              
              // Check if event is scheduled for today
              if (eventDateStr === today) {
                // Mark as attended (based on same-day attendance rule)
                updates[`users/${employeeId}/events/${eventType}/${eventId}/attended`] = true;
                updates[`users/${employeeId}/events/${eventType}/${eventId}/attendedAt`] = now.toISOString();
                
                // Also update the event's participants list
                if (eventData.eventId) {
                  updates[`events/${eventData.eventId}/participants/${employeeId}`] = true;
                }
                
                eventsUpdated.push({
                  type: eventType,
                  id: eventId,
                  name: eventData.title || 'Untitled Event'
                });
              }
            }
          }
        }
      }
      
      // Apply all updates to database
      await update(ref(database), updates);
      
      return res.json({ 
        success: true, 
        message: "Clocked in successfully!",
        timestamp: formattedTime,
        eventsUpdated: eventsUpdated.length > 0 ? eventsUpdated : null
      });
    }
    
    // Process Clock-Out
    if (mode === 'clock-out') {
      // Check if user has clocked in
      if (!employeeData.stats?.lastClockIn) {
        return res.status(400).json({
          success: false,
          message: "You must clock in before clocking out.",
        });
      }
      
      // Calculate hours worked during this session
      const lastClockIn = moment.tz(employeeData.stats.lastClockIn, 'America/Chicago');
      const hoursWorked = now.diff(lastClockIn, 'hours', true); // Get decimal hours
      
      // Update total hours
      const totalHours = (employeeData.stats?.totalHours || 0) + hoursWorked;
      updates[`users/${employeeId}/stats/totalHours`] = totalHours;
      
      // Update last clock out
      updates[`users/${employeeId}/stats/lastClockOut`] = now.toISOString();
      
      // Add clock-out record
      updates[`users/${employeeId}/activityLog/clockOuts/${timestamp}`] = {
        timestamp: now.toISOString(),
        location,
        hoursWorked: hoursWorked.toFixed(2),
        barcodeData: barcodeData || null
      };
      
      // Update database
      await update(ref(database), updates);
      
      return res.json({ 
        success: true, 
        message: `Clocked out successfully! Shift duration: ${hoursWorked.toFixed(2)} hours.`,
        timestamp: formattedTime,
        hoursWorked: hoursWorked.toFixed(2)
      });
    }
    
    return res.status(400).json({ success: false, message: "Invalid mode." });
  } catch (error) {
    console.error('Clock-in/out error:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
});

// Add a new endpoint to mark employees as absent for scheduled events
app.post('/mark-absent', async (req, res) => {
  try {
    const { employeeId, eventType, eventId, adminId } = req.body;
    
    if (!employeeId || !eventType || !eventId) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields."
      });
    }
    
    // Get the event data
    const eventRef = ref(database, `users/${employeeId}/events/${eventType}/${eventId}`);
    const eventSnapshot = await eventRef.once('value');
    
    if (!eventSnapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        message: "Event not found for this employee."
      });
    }
    
    const eventData = eventSnapshot.val();
    
    // Only allow marking as absent if the event is scheduled and not already marked
    if (!eventData.scheduled) {
      return res.status(400).json({ 
        success: false, 
        message: "Event is not scheduled for this employee."
      });
    }
    
    if (eventData.attended) {
      return res.status(400).json({ 
        success: false, 
        message: "Employee already attended this event."
      });
    }
    
    // Mark as absent
    const now = new Date();
    const updates = {
      [`users/${employeeId}/events/${eventType}/${eventId}/attended`]: false,
      [`users/${employeeId}/events/${eventType}/${eventId}/markedAbsent`]: true,
      [`users/${employeeId}/events/${eventType}/${eventId}/absentMarkedAt`]: now.toISOString(),
      [`users/${employeeId}/events/${eventType}/${eventId}/absentMarkedBy`]: adminId || null
    };
    
    // Update database
    await update(ref(database), updates);
    
    return res.json({ 
      success: true, 
      message: "Employee marked as absent for this event."
    });
  } catch (error) {
    console.error('Mark absent error:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error.", 
      error: error.message 
    });
  }
});

// Add an endpoint to process attendance for all scheduled events at the end of the day
app.post('/process-attendance', async (req, res) => {
  try {
    const { date, adminId } = req.body;
    
    // Use provided date or default to today
    const targetDate = date || moment().tz('America/Chicago').format('YYYY-MM-DD');
    const now = moment().tz('America/Chicago');
    
    // Get all users
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    
    if (!usersSnapshot.exists()) {
      return res.json({ 
        success: true, 
        message: "No users found.",
        processed: 0
      });
    }
    
    // Get all events to check end times
    const eventsRef = ref(database, 'events');
    const eventsSnapshot = await get(eventsRef);
    const allEvents = eventsSnapshot.exists() ? eventsSnapshot.val() : {};
    
    const users = usersSnapshot.val();
    const updates = {};
    let processedCount = 0;
    let meetingsProcessed = 0;
    
    // Process each user
    for (const [userId, userData] of Object.entries(users)) {
      // Skip if user has no events
      if (!userData.events) continue;
      
      // Get event types for this user
      const eventTypes = Object.keys(userData.events);
      
      // Process each event type
      for (const eventType of eventTypes) {
        // Skip if user has no events of this type
        if (!userData.events[eventType]) continue;
        
        // Get all events of this type
        const events = userData.events[eventType];
        
        // Process each event
        for (const [eventId, eventData] of Object.entries(events)) {
          // Skip if not scheduled or already marked
          if (!eventData.scheduled || eventData.attended === true || eventData.markedAbsent === true) continue;
          
          // Special processing for meetings with time windows
          if (eventType === 'meetings' && eventData.eventId && allEvents[eventData.eventId]) {
            const fullEventData = allEvents[eventData.eventId];
            const eventEnd = moment(fullEventData.end).tz('America/Chicago');
            
            // Only mark absent if the meeting has ended
            if (now.isAfter(eventEnd)) {
              updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = false;
              updates[`users/${userId}/events/${eventType}/${eventId}/markedAbsent`] = true;
              updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedAt`] = now.toISOString();
              updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedBy`] = adminId || 'system';
              
              // Also update the event participant record
              updates[`events/${eventData.eventId}/participants/${userId}/attended`] = false;
              updates[`events/${eventData.eventId}/participants/${userId}/markedAbsent`] = true;
              
              meetingsProcessed++;
              processedCount++;
            }
            continue;
          }
          
          // For other event types, use standard date check
          const eventDate = moment(eventData.date).tz('America/Chicago');
          const eventDateStr = eventDate.format('YYYY-MM-DD');
          
          if (eventDateStr === targetDate) {
            // Mark as absent since event passed without attendance
            updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = false;
            updates[`users/${userId}/events/${eventType}/${eventId}/markedAbsent`] = true;
            updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedAt`] = now.toISOString();
            updates[`users/${userId}/events/${eventType}/${eventId}/absentMarkedBy`] = adminId || 'system';
            
            // Update event record if eventId exists
            if (eventData.eventId) {
              updates[`events/${eventData.eventId}/participants/${userId}/attended`] = false;
              updates[`events/${eventData.eventId}/participants/${userId}/markedAbsent`] = true;
            }
            
            processedCount++;
          }
        }
      }
    }
    
    // Apply all updates if any
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
    
    return res.json({ 
      success: true, 
      message: "Attendance processing completed.",
      processed: processedCount,
      meetingsProcessed: meetingsProcessed,
      date: targetDate
    });
  } catch (error) {
    console.error('Process attendance error:', error);
    return res.status(500).json({ 
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

// Import the auth update function
// const { updateUserAuth } = require('./setup-admin-auth');

// Function to update user's Firebase Auth credentials (same as in setup script)
async function updateUserAuth(userId, updates) {
  try {
    console.log(`Updating Firebase Auth for user: ${userId}`);
    console.log('Updates:', updates);
    
    // Check if user exists in Firebase Auth
    let userExists = false;
    try {
      await admin.auth().getUser(userId);
      userExists = true;
      console.log('✅ User exists in Firebase Auth');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️ User not found in Firebase Auth');
        userExists = false;
      } else {
        throw error;
      }
    }
    
    if (!userExists && updates.email) {
      // Create new user
      console.log('Creating new Firebase Auth user...');
      const userRecord = await admin.auth().createUser({
        uid: userId,
        email: updates.email,
        password: updates.password || 'AV2025!',
        displayName: updates.displayName,
        emailVerified: true
      });
      console.log('✅ Created new Firebase Auth user:', userRecord.uid);
    } else if (userExists) {
      // Update existing user
      console.log('Updating existing Firebase Auth user...');
      await admin.auth().updateUser(userId, updates);
      console.log('✅ Updated Firebase Auth user');
    }
    
    // Update database link
    await database.ref(`users/${userId}/profile/authUid`).set(userId);
    console.log('✅ Updated database authUid link');
    
    return true;
  } catch (error) {
    console.error('❌ Error updating Firebase Auth:', error);
    throw error;
  }
}

// Admin endpoint to update user authentication
app.post('/api/admin/update-user-auth', async (req, res) => {
  console.log('=== ADMIN ENDPOINT HIT ===');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid auth header');
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Missing or invalid token format' 
      });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    console.log('✅ ID Token received, length:', idToken.length);
    
    // Verify the token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('✅ Token verified for user:', decodedToken.uid);
    } catch (error) {
      console.error("❌ Error verifying ID token:", error);
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized: Invalid token' 
      });
    }
    
    // Get request data
    const { userId, updates } = req.body;
    
    if (!userId) {
      console.log('❌ Missing userId');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: User ID is required' 
      });
    }

    if (!updates || typeof updates !== 'object') {
      console.log('❌ Invalid updates object');
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
      
    if (Object.keys(validUpdates).length === 0) {
      console.log('❌ No valid updates provided');
      return res.status(400).json({ 
        success: false, 
        message: 'Bad request: No valid updates provided' 
      });
    }
    
    console.log('✅ Processing admin update for user:', userId, 'with updates:', validUpdates);
    
    // Use the new updateUserAuth function
    try {
      await updateUserAuth(userId, validUpdates);
      
      console.log('🎉 Successfully updated user auth:', userId);
      
      return res.status(200).json({
        success: true,
        message: 'User authentication updated successfully',
        userId
      });
    } catch (updateError) {
      console.error("❌ Error updating auth user:", updateError);
      return res.status(500).json({
        success: false,
        message: `Error updating user: ${updateError.message}`
      });
    }
  } catch (error) {
    console.error("❌ Server error:", error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Add error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
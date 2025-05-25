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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// src/pages/api/attendance.js
import { initAdmin } from '../../components/utils/firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const admin = await initAdmin();
    const { employeeId, locationId, mode } = req.body;
    
    // Verify the Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    await admin.auth().verifyIdToken(idToken);

    if (!employeeId || !locationId || !mode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = admin.database();
    const now = new Date();
    const timestamp = now.toISOString();
    const attendanceDate = timestamp.split('T')[0];

    // Get user data - match the exact path from your database
    const userSnap = await db.ref(`users/${employeeId}`).once('value');
    const userData = userSnap.val();

    if (!userData) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Verify user's status is active
    if (userData.status !== 'active') {
      return res.status(400).json({ 
        error: 'Employee is not active',
        userData
      });
    }

    // Check if location matches user's assigned location
    if (userData.location && userData.location !== locationId) {
      return res.status(400).json({ 
        error: 'Employee is not assigned to this location',
        userData
      });
    }

    // Check today's attendance - match the exact path structure
    const attendanceRef = db.ref(`attendance/${locationId}/${attendanceDate}/${employeeId}`);
    const attendanceSnap = await attendanceRef.once('value');
    const attendance = attendanceSnap.val();

    if (mode === 'clock-in') {
      if (attendance?.clockInTime) {
        return res.status(400).json({ 
          error: 'Already clocked in',
          userData
        });
      }

      const newAttendance = {
        clockInTime: timestamp,
        name: userData.name,
        position: userData.position || 'Member',
        userId: employeeId,
        location: locationId
      };

      // Update locationHistory
      const locationHistory = {
        changedBy: 'system',
        date: timestamp,
        locationId: locationId
      };

      // Transaction to update attendance, stats, and location history
      const updates = {
        [`attendance/${locationId}/${attendanceDate}/${employeeId}`]: newAttendance,
        [`users/${employeeId}/stats/daysPresent`]: (userData.stats?.daysPresent || 0) + 1,
        [`users/${employeeId}/stats/lastClockIn`]: timestamp
      };

      // Add to location history if it's a new location
      if (userData.locationHistory) {
        updates[`users/${employeeId}/locationHistory/${userData.locationHistory.length}`] = locationHistory;
      } else {
        updates[`users/${employeeId}/locationHistory`] = [locationHistory];
      }

      await db.ref().update(updates);

      return res.status(200).json({
        message: `Welcome ${userData.name}! Clock-in successful.`,
        type: 'clockIn',
        userData
      });

    } else if (mode === 'clock-out') {
      if (!attendance?.clockInTime) {
        return res.status(400).json({ 
          error: 'Not clocked in',
          userData
        });
      }

      if (attendance.clockOutTime) {
        return res.status(400).json({ 
          error: 'Already clocked out',
          userData
        });
      }

      const clockInTime = new Date(attendance.clockInTime);
      const hoursWorked = ((now - clockInTime) / (1000 * 60 * 60)).toFixed(2);

      // Update with all required fields matching your database structure
      const updates = {
        [`attendance/${locationId}/${attendanceDate}/${employeeId}/clockOutTime`]: timestamp,
        [`attendance/${locationId}/${attendanceDate}/${employeeId}/hoursWorked`]: hoursWorked,
        [`users/${employeeId}/stats/totalHours`]: (userData.stats?.totalHours || 0) + parseFloat(hoursWorked),
        [`users/${employeeId}/stats/lastClockOut`]: timestamp
      };

      await db.ref().update(updates);

      return res.status(200).json({
        message: `Goodbye ${userData.name}! Clock-out successful.`,
        type: 'clockOut',
        userData,
        hoursWorked
      });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error('Attendance API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// src/components/utils/firebase-admin.js
import admin from 'firebase-admin';

export async function initAdmin() {
  if (admin.apps.length) return admin;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "qr-system-1cea7",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
  });

  return admin;
}
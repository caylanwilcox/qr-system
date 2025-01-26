// src/services/attendanceService.js
import { auth, database } from './firebaseConfig';
import { ref, get, update, set } from 'firebase/database';

class AttendanceService {
  async recordAttendance(employeeId, location) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      
      // First, verify the employee exists and get their data
      const userRef = ref(database, `users/${employeeId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        throw new Error('Employee not found');
      }

      const userData = userSnapshot.val();
      const now = new Date().toISOString();
      const attendanceDate = now.split('T')[0];
      
      // Update user's location
      await this._updateUserLocation(employeeId, location, userData);

      // Record attendance via API
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          locationId: location,
          employeeId,
          timestamp: now
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record attendance');
      }

      // Return formatted response with user data
      return {
        ...data,
        userData: {
          name: userData.name,
          photo: userData.photo || null,
          position: userData.position || 'Member'
        }
      };
    } catch (error) {
      console.error('Attendance recording error:', error);
      throw error;
    }
  }

  // Using underscore prefix as a convention for "private" methods
  async _updateUserLocation(userId, locationId, userData) {
    const userRef = ref(database, `users/${userId}`);
    const now = new Date().toISOString();
    
    const locationHistory = userData.locationHistory || [];
    locationHistory.unshift({
      locationId,
      date: now,
      changedBy: 'system'
    });

    await update(userRef, {
      location: locationId,
      locationHistory: locationHistory.slice(0, 10)
    });
  }

  async getAttendanceStatus(employeeId, location) {
    const date = new Date().toISOString().split('T')[0];
    const attendanceRef = ref(database, `attendance/${location}/${date}/${employeeId}`);
    const snapshot = await get(attendanceRef);
    return snapshot.val();
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
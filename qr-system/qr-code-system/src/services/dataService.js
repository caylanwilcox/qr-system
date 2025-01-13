// src/services/dataService.js
import { ref, get } from 'firebase/database';
import { database } from './firebaseConfig';
import { cacheService, CACHE_CONFIG } from './cacheService';

class DataService {
  async fetchUsers(forceRefresh = false) {
    const { key, expiry } = CACHE_CONFIG.STATIC.users;
    
    if (!forceRefresh) {
      const cachedUsers = await cacheService.get(key);
      if (cachedUsers) return cachedUsers;
    }

    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    const users = snapshot.val();

    await cacheService.set(key, users, expiry);
    return users;
  }

  async fetchAttendance() {
    const { key, expiry } = CACHE_CONFIG.DYNAMIC.attendance;
    
    // For attendance, we'll use cache but with a very short expiry
    const cachedAttendance = await cacheService.get(key);
    if (cachedAttendance) return cachedAttendance;

    const attendanceRef = ref(database, 'attendance');
    const snapshot = await get(attendanceRef);
    const attendance = snapshot.val();

    await cacheService.set(key, attendance, expiry);
    return attendance;
  }

  async fetchDashboardData(activeTab = 'All') {
    const cacheKey = `${CACHE_CONFIG.DYNAMIC.dashboard.key}_${activeTab}`;
    const { expiry } = CACHE_CONFIG.DYNAMIC.dashboard;

    // Check cache first
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) return cachedData;

    // If no cache, fetch all required data
    const [attendanceData, usersData, eventsData] = await Promise.all([
      this.fetchAttendance(),
      this.fetchUsers(),
      this.fetchEvents()
    ]);

    const dashboardData = {
      attendance: attendanceData,
      users: usersData,
      events: eventsData
    };

    // Cache the combined data
    await cacheService.set(cacheKey, dashboardData, expiry);
    return dashboardData;
  }

  async fetchEvents() {
    const eventsRef = ref(database, 'events');
    const snapshot = await get(eventsRef);
    return snapshot.val();
  }

  // Utility method to clear all caches
  async clearCaches() {
    return await cacheService.clear();
  }

  // Method to clear specific cache
  async clearCache(key) {
    return await cacheService.remove(key);
  }
}

export const dataService = new DataService();
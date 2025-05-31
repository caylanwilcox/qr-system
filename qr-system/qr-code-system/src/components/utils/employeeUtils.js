/**
 * Employee data processing and calculation utilities
 */

/**
 * Formats raw clock in/out timestamp data into structured attendance records
 * @param {Object} clockInTimes - Object with timestamps as keys and clock-in times as values
 * @param {Object} clockOutTimes - Object with timestamps as keys and clock-out times as values
 * @returns {Array} Sorted array of attendance records
 */
export const formatAttendanceRecords = (clockInTimes = {}, clockOutTimes = {}) => {
    const records = [];
    
    for (const timestamp in clockInTimes) {
      const date = new Date(parseInt(timestamp));
      const clockIn = clockInTimes[timestamp];
      const clockOut = clockOutTimes[timestamp];
      
      // Calculate hours worked if both clock in and out times exist
      let hoursWorked = null;
      if (clockIn && clockOut) {
        const millisWorked = clockOut - clockIn;
        hoursWorked = (millisWorked / (1000 * 60 * 60)).toFixed(2);
      }
      
      records.push({
        timestamp: parseInt(timestamp),
        date: date.toISOString().split('T')[0],
        clockInTime: clockIn ? new Date(clockIn).toLocaleTimeString() : null,
        clockOutTime: clockOut ? new Date(clockOut).toLocaleTimeString() : null,
        hoursWorked
      });
    }
  
    // Sort records with most recent first
    return records.sort((a, b) => b.timestamp - a.timestamp);
  };
  
  /**
   * Calculates attendance and performance statistics for an employee
   * @param {Array} records - Array of attendance records
   * @returns {Object} Calculated statistics
   */
  export const calculateStats = (records) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Filter for recent records only
    const recentRecords = records.filter(record => 
      new Date(record.date) >= thirtyDaysAgo
    );
  
    const total = recentRecords.length;
    
    // Return default stats if no records exist
    if (total === 0) {
      return {
        attendanceRate: 0,
        punctualityRate: 0,
        totalHours: 0,
        avgHoursPerDay: 0,
        previousMonthHours: 0,
        hoursChange: 0,
        perfectStreak: 0,
        earlyArrivalRate: 0,
        mostActiveDay: ''
      };
    }
  
    // Calculate attendance metrics
    const attended = recentRecords.filter(r => r.clockInTime).length;
    
    // Check punctuality - FIXED: Only apply late logic when user has scheduled events
    const onTime = recentRecords.filter(r => {
      if (!r.clockInTime) return false;
      
      // FIXED: Only consider late if user had scheduled events for that day
      // For now, we'll assume they're on time unless we have specific event data
      // This should be enhanced in the future to check actual event schedules
      
      // Check if user had any events scheduled for this day
      // This is a conservative approach - without event data, assume on time
      if (r.hasScheduledEvents === false) {
        return true; // Always on time if no scheduled events
      }
      
      // If we have specific late/onTime flags from the attendance system, use them
      if (r.isLate !== undefined) {
        return !r.isLate;
      }
      
      if (r.onTime !== undefined) {
        return r.onTime;
      }
      
      // Default fallback: assume on time (conservative approach)
      // This prevents false late markings when we don't have complete data
      return true;
    }).length;
  
    // Calculate total hours worked
    const totalHours = recentRecords.reduce((sum, r) => 
      sum + (r.hoursWorked ? parseFloat(r.hoursWorked) : 0), 0
    );
  
    // Calculate previous month's hours
    const sixtyDaysAgo = new Date(thirtyDaysAgo);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);
    
    const previousMonthRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= sixtyDaysAgo && recordDate < thirtyDaysAgo;
    });
  
    const previousMonthHours = previousMonthRecords.reduce((sum, r) => 
      sum + (r.hoursWorked ? parseFloat(r.hoursWorked) : 0), 0
    );
  
    // Calculate hours change percentage
    const hoursChange = previousMonthHours ? 
      (((totalHours - previousMonthHours) / previousMonthHours) * 100).toFixed(1) : 
      0;
  
    // Calculate perfect attendance streak (days with >= 7.5 hours)
    let perfectStreak = 0;
    for (let i = 0; i < recentRecords.length; i++) {
      if (recentRecords[i].clockInTime && recentRecords[i].hoursWorked >= 7.5) {
        perfectStreak++;
      } else {
        break;
      }
    }
  
    // Determine most active day of the week
    const dayCount = recentRecords.reduce((acc, record) => {
      const day = new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' });
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
  
    const mostActiveDay = Object.entries(dayCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  
    // Return calculated statistics
    return {
      attendanceRate: ((attended / total) * 100).toFixed(1),
      punctualityRate: ((onTime / attended) * 100).toFixed(1),
      totalHours: totalHours.toFixed(1),
      avgHoursPerDay: (totalHours / attended).toFixed(1),
      previousMonthHours: previousMonthHours.toFixed(1),
      hoursChange,
      perfectStreak,
      earlyArrivalRate: ((onTime / total) * 100).toFixed(1),
      mostActiveDay
    };
  };
  
  /**
   * Formats and filters scheduled dates, removing past dates
   * @param {Array} dates - Array of date strings
   * @returns {Array} Formatted and filtered schedule objects
   */
  export const formatScheduledDates = (dates) => {
    const today = new Date().setHours(0, 0, 0, 0);
    
    return (dates || [])
      .filter(date => new Date(date).setHours(0, 0, 0, 0) >= today)
      .map(date => ({
        date,
        time: "09:00",
        status: "scheduled"
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };
  
  /**
   * Formats employee data for ID card display
   * @param {Object} employee - Employee data object
   * @returns {Object} Formatted employee data for ID card
   */
  export const formatEmployeeIdCard = (employee) => {
    return {
      name: employee.name || 'N/A',
      position: employee.position || 'N/A',
      department: employee.department || 'N/A',
      location: employee.location || 'N/A',
      employeeId: employee.id || 'N/A',
      joinDate: employee.joinDate ? new Date(employee.joinDate).toLocaleDateString() : 'N/A',
      status: employee.status || 'inactive',
      photoUrl: employee.photoUrl || null
    };
  };
  
  /**
   * Validates employee data
   * @param {Object} data - Employee data to validate
   * @returns {Object} Validation result with errors if any
   */
  export const validateEmployeeData = (data) => {
    const errors = {};
    
    if (!data.name?.trim()) {
      errors.name = 'Name is required';
    }
    
    if (!data.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!data.phone?.trim()) {
      errors.phone = 'Phone number is required';
    }
    
    if (!data.position?.trim()) {
      errors.position = 'Position is required';
    }
    
    if (!data.department?.trim()) {
      errors.department = 'Department is required';
    }
    
    if (!data.location?.trim()) {
      errors.location = 'Location is required';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };
  
  /**
   * Generates employee schedule statistics
   * @param {Array} scheduledDates - Array of scheduled dates
   * @param {Array} attendanceRecords - Array of attendance records
   * @returns {Object} Schedule statistics
   */
  export const calculateScheduleStats = (scheduledDates, attendanceRecords) => {
    const totalScheduled = scheduledDates.length;
    if (totalScheduled === 0) {
      return {
        scheduledCount: 0,
        completedCount: 0,
        completionRate: 0,
        upcomingCount: 0
      };
    }
  
    const now = new Date();
    const completed = scheduledDates.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate < now;
    }).length;
  
    const upcoming = scheduledDates.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate >= now;
    }).length;
  
    return {
      scheduledCount: totalScheduled,
      completedCount: completed,
      completionRate: ((completed / totalScheduled) * 100).toFixed(1),
      upcomingCount: upcoming
    };
  };
// src/services/employeeService.js

const moment = require('moment-timezone');

const processAttendanceRecords = (clockInTimes = {}, clockOutTimes = {}, shiftDurations = {}) => {
  const recordsByMonth = {};
  
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
      timestamp: parseInt(timestamp)
    });
  });

  const sortedMonths = Object.keys(recordsByMonth).sort().reverse();
  sortedMonths.forEach(month => {
    recordsByMonth[month].sort((a, b) => b.timestamp - a.timestamp);
  });

  return { months: sortedMonths, records: recordsByMonth };
};

const processAssignedDates = (dates = []) => {
  const datesByMonth = {};
  const now = moment();
  
  dates.forEach(dateStr => {
    const date = moment(dateStr, "YYYY-MM-DD HH:mm");
    const monthYear = date.format('YYYY-MM');
    
    if (!datesByMonth[monthYear]) {
      datesByMonth[monthYear] = [];
    }
    
    const status = date.isSame(now, 'day') ? 'Today' : 
                   date.isBefore(now, 'day') ? 'Past' : 'Upcoming';
    
    datesByMonth[monthYear].push({
      date: dateStr,
      fullDate: date.format('MMMM D, YYYY'),
      dayOfWeek: date.format('dddd'),
      time: date.format('h:mm A'),
      status
    });
  });

  const sortedMonths = Object.keys(datesByMonth).sort();
  sortedMonths.forEach(month => {
    datesByMonth[month].sort((a, b) => moment(a.date).diff(moment(b.date)));
  });

  return { months: sortedMonths, dates: datesByMonth };
};

module.exports = {
  processAttendanceRecords,
  processAssignedDates
};
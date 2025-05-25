// src/utils/dateUtils.js
import moment from 'moment-timezone';

/**
 * Format a date safely, returning the fallback if the date is invalid
 * @param {string|Date} date - The date to format
 * @param {string} format - The moment format string
 * @param {string} fallback - Fallback text if date is invalid
 * @returns {string} - Formatted date or fallback
 */
export const safeFormatDate = (date, format = 'MMM D, YYYY', fallback = 'Unknown') => {
  if (!date) return fallback;
  const momentDate = moment(date);
  return momentDate.isValid() ? momentDate.format(format) : fallback;
};

/**
 * Format hours worked to display with appropriate precision
 * @param {number} hours - Hours worked
 * @returns {string} - Formatted hours
 */
export const formatHours = (hours) => {
  if (hours === undefined || hours === null || isNaN(hours)) return 'N/A';
  
  // For small values, show more precision
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  
  // For larger values, round to 1 decimal place
  return `${hours.toFixed(1)} hrs`;
};

/**
 * Get the current time in Chicago timezone
 * @returns {moment} - Moment object with Chicago timezone
 */
export const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

/**
 * Check if a date is today in Chicago timezone
 * @param {string|Date} date - Date to check
 * @returns {boolean} - True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  const today = getChicagoTime().format('YYYY-MM-DD');
  return moment(date).tz('America/Chicago').format('YYYY-MM-DD') === today;
};

/**
 * Convert a timestamp to a readable time string
 * @param {number} timestamp - Timestamp in milliseconds
 * @param {string} format - Moment format string
 * @returns {string} - Formatted time string
 */
export const timestampToTime = (timestamp, format = 'h:mm A') => {
  if (!timestamp) return 'N/A';
  return moment(timestamp).format(format);
};

/**
 * Calculate the difference between two dates in hours
 * @param {string|Date} start - Start date
 * @param {string|Date} end - End date
 * @returns {number|null} - Hours difference or null if invalid
 */
export const calculateHoursBetween = (start, end) => {
  if (!start || !end) return null;
  
  const startMoment = moment(start);
  const endMoment = moment(end);
  
  if (!startMoment.isValid() || !endMoment.isValid()) return null;
  
  // Calculate difference in milliseconds and convert to hours
  const diffMs = endMoment.diff(startMoment);
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return diffHours;
};

/**
 * Format date in Chicago timezone
 * @param {string|Date} date - Date to format
 * @param {string} format - Moment format string
 * @returns {string} - Formatted date string
 */
export const formatChicagoDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '';
  return moment(date).tz('America/Chicago').format(format);
};

/**
 * Check if today is within a date range
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {boolean} - True if today is in range
 */
export const isTodayInDateRange = (startDate, endDate) => {
  if (!startDate) return false;
  
  const today = getChicagoTime();
  const start = moment(startDate).tz('America/Chicago');
  
  // If no end date, just check if start date is today
  if (!endDate) {
    return start.isSame(today, 'day');
  }
  
  const end = moment(endDate).tz('America/Chicago');
  
  // Check if today is between start and end
  return today.isSameOrAfter(start, 'day') && today.isSameOrBefore(end, 'day');
};
// src/utils/dateUtils.js
import moment from 'moment-timezone';

/**
 * Safe date formatting function that handles invalid dates
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Moment format string
 * @param {string} defaultValue - Value to return if date is invalid
 * @returns {string} Formatted date or default value
 */
export const safeFormatDate = (date, format = 'MMMM D, YYYY h:mm A', defaultValue = 'N/A') => {
  if (!date) return defaultValue;
  
  try {
    const momentDate = moment(date);
    if (!momentDate.isValid()) return defaultValue;
    return momentDate.tz('America/Chicago').format(format);
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return defaultValue;
  }
};

/**
 * Safely calculate time difference between two dates
 * @param {Date|string|number} start - Start date
 * @param {Date|string|number} end - End date
 * @param {string} unit - Unit for difference (hours, minutes, etc)
 * @param {number} defaultValue - Default value if calculation fails
 * @returns {number} Time difference or default value
 */
export const safeTimeDifference = (start, end, unit = 'hours', defaultValue = 0) => {
  if (!start || !end) return defaultValue;
  
  try {
    const startMoment = moment(start);
    const endMoment = moment(end);
    
    if (!startMoment.isValid() || !endMoment.isValid()) return defaultValue;
    
    const diff = endMoment.diff(startMoment, unit);
    
    // Return default if result is not a finite number
    return isFinite(diff) ? diff : defaultValue;
  } catch (error) {
    console.error('Error calculating time difference:', error, { start, end });
    return defaultValue;
  }
};

/**
 * Format a duration in hours (adds 'h' suffix and handles invalid values)
 * @param {number|string} hours - Hours to format
 * @param {string} defaultValue - Default value if hours is invalid
 * @returns {string} Formatted duration string
 */
export const formatHours = (hours, defaultValue = '0h') => {
  if (hours === undefined || hours === null) return defaultValue;
  
  const numHours = parseFloat(hours);
  if (isNaN(numHours) || !isFinite(numHours)) return defaultValue;
  
  return `${numHours.toFixed(1)}h`;
};

/**
 * Get current time in Chicago timezone
 * @returns {moment.Moment} Current time in Chicago
 */
export const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

/**
 * Enhanced version of formatChicagoDate to handle errors
 * @param {Date|string} date - The date to format
 * @param {string} format - The format string
 * @returns {string} Formatted date string or fallback
 */
export const formatChicagoDate = (date, format = 'MMMM D, YYYY h:mm A') => {
  return safeFormatDate(date, format);
};
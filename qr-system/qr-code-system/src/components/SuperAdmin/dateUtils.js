// DateUtils.js
import { format, parse, isValid } from 'date-fns';
import moment from 'moment-timezone';

// Consistent date formatting functions to use across the application
const DateUtils = {
  // Get the current date in ISO format (YYYY-MM-DD) - FIXED: Use Chicago timezone
  getCurrentDateISO: () => {
    return moment().tz('America/Chicago').format('YYYY-MM-DD');
  },

  // Get a date X days ago in ISO format - FIXED: Use Chicago timezone
  getDateDaysAgoISO: (days) => {
    return moment().tz('America/Chicago').subtract(days, 'days').format('YYYY-MM-DD');
  },

  // Format a date for display (e.g., "May 7, 2025") - FIXED: Use Chicago timezone
  formatDisplayDate: (isoDate) => {
    if (!isoDate) return '';
    try {
      // FIXED: Use Chicago timezone to prevent date shifting
      return moment.tz(isoDate, 'America/Chicago').format('MMMM D, YYYY');
    } catch (error) {
      console.error('Error formatting date:', error);
      return isoDate;
    }
  },

  // Format a date from ISO to other formats
  formatDateAlt: (isoDate, formatStr) => {
    try {
      if (!isoDate) return null;
      
      // Parse the ISO date (YYYY-MM-DD)
      const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return null;
      
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      
      // MM/DD/YYYY format (with leading zeroes)
      if (formatStr === 'MM/DD/YYYY') {
        return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
      }
      
      // M/D/YYYY format (without leading zeroes)
      if (formatStr === 'M/D/YYYY') {
        return `${month}/${day}/${year}`;
      }
      
      return isoDate;
    } catch (error) {
      console.error('Error formatting date:', error);
      return null;
    }
  },

  // Generate all possible date format variations for a given ISO date
  getAllDateFormats: (isoDate) => {
    return [
      isoDate, // YYYY-MM-DD (original format)
      DateUtils.formatDateAlt(isoDate, 'MM/DD/YYYY'), // MM/DD/YYYY
      DateUtils.formatDateAlt(isoDate, 'M/D/YYYY')    // M/D/YYYY
    ].filter(Boolean); // Remove any null values
  },

  // Check if a date is within a specified range
  isDateInRange: (date, startDate, endDate) => {
    if (!date || !startDate || !endDate) return false;
    
    try {
      const dateObj = new Date(date);
      const startObj = new Date(startDate);
      const endObj = new Date(endDate);
      
      return dateObj >= startObj && dateObj <= endObj;
    } catch (error) {
      console.error('Error checking date range:', error);
      return false;
    }
  },

  // Get Chicago time (matching the QR Scanner)
  getChicagoTime: () => {
    return moment().tz('America/Chicago');
  },

  // Parse date from various formats to ISO
  parseToISO: (dateString) => {
    if (!dateString) return null;
    
    // If already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Try MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      const [month, day, year] = dateString.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // If parsing fails, return null
    return null;
  }
};

export default DateUtils;
// src/utils/eventUtils.js
import moment from 'moment-timezone';

/**
 * Constants for event types that match StatsSection categories
 */
export const EVENT_TYPES = {
  WORKSHOPS: 'workshops',         // PO Workshops (Monthly)
  MEETINGS: 'meetings',           // PO Group Meetings
  HACIENDAS: 'haciendas',         // Haciendas (weekend retreats)
  JUNTA_HACIENDA: 'juntaHacienda', // Junta de Hacienda
  GESTION: 'gestion'              // Gestion
};

/**
 * UI Display names for event types
 */
export const EVENT_TYPE_DISPLAY_NAMES = {
  [EVENT_TYPES.WORKSHOPS]: 'PO Workshop (Monthly)',
  [EVENT_TYPES.MEETINGS]: 'PO Group Meeting',
  [EVENT_TYPES.HACIENDAS]: 'Hacienda',
  [EVENT_TYPES.JUNTA_HACIENDA]: 'Junta de Hacienda',
  [EVENT_TYPES.GESTION]: 'Gestion'
};

/**
 * Constants for locations (cities without the "Agua Viva" prefix)
 */
export const LOCATIONS = [
  'West Chicago',
  'Lyons',
  'Aurora',
  'Elgin R7',
  'Joliet',
  'Wheeling',
];

/**
 * Comprehensive mapping from UI event types to database categories
 */
export const EVENT_TYPE_TO_CATEGORY_MAP = {
  // Workshop variations
  'workshop': EVENT_TYPES.WORKSHOPS,
  'workshops': EVENT_TYPES.WORKSHOPS,
  'PO Workshop (Monthly)': EVENT_TYPES.WORKSHOPS,
  'po workshop': EVENT_TYPES.WORKSHOPS,
  'po workshop (monthly)': EVENT_TYPES.WORKSHOPS,
  'po workshops': EVENT_TYPES.WORKSHOPS,
  
  // Meeting variations
  'meeting': EVENT_TYPES.MEETINGS,
  'meetings': EVENT_TYPES.MEETINGS,
  'PO Group Meeting': EVENT_TYPES.MEETINGS,
  'po group meeting': EVENT_TYPES.MEETINGS,
  'po meeting': EVENT_TYPES.MEETINGS,
  
  // Hacienda variations
  'hacienda': EVENT_TYPES.HACIENDAS,
  'haciendas': EVENT_TYPES.HACIENDAS,
  'Hacienda': EVENT_TYPES.HACIENDAS,
  
  // Junta variations
  'juntaHacienda': EVENT_TYPES.JUNTA_HACIENDA,
  'Junta de Hacienda': EVENT_TYPES.JUNTA_HACIENDA,
  'junta de hacienda': EVENT_TYPES.JUNTA_HACIENDA,
  
  // Gestion variations
  'gestion': EVENT_TYPES.GESTION,
  'Gestion': EVENT_TYPES.GESTION
};

/**
 * Function to normalize any event type to standard category
 * @param {string} eventType - The event type to normalize
 * @returns {string} Standardized event type category
 */
export const normalizeEventType = (eventType) => {
  if (!eventType) return EVENT_TYPES.HACIENDAS; // Default if no event type
  
  // Convert to lowercase for case-insensitive matching
  const lowerType = typeof eventType === 'string' ? eventType.toLowerCase().trim() : '';
  
  // Check exact match first
  if (EVENT_TYPE_TO_CATEGORY_MAP[eventType]) {
    return EVENT_TYPE_TO_CATEGORY_MAP[eventType];
  }
  
  // Try case-insensitive match
  if (EVENT_TYPE_TO_CATEGORY_MAP[lowerType]) {
    return EVENT_TYPE_TO_CATEGORY_MAP[lowerType];
  }
  
  // Check for partial matches if no exact match
  if (lowerType.includes('workshop')) return EVENT_TYPES.WORKSHOPS;
  if (lowerType.includes('meeting')) return EVENT_TYPES.MEETINGS;
  if (lowerType.includes('junta')) return EVENT_TYPES.JUNTA_HACIENDA;
  if (lowerType.includes('hacienda') && !lowerType.includes('junta')) return EVENT_TYPES.HACIENDAS;
  if (lowerType.includes('gestion')) return EVENT_TYPES.GESTION;
  
  // Default to haciendas if no match
  return EVENT_TYPES.HACIENDAS;
};

/**
 * Get current time in Chicago timezone
 * @returns {moment.Moment} Current time in Chicago
 */
export const getChicagoTime = () => {
  return moment().tz('America/Chicago');
};

/**
 * Format a date for display using Chicago timezone
 * @param {Date|string} date - The date to format
 * @param {string} format - The format string (default: 'MMMM D, YYYY h:mm A')
 * @returns {string} Formatted date string
 */
export const formatChicagoDate = (date, format = 'MMMM D, YYYY h:mm A') => {
  if (!date) return '';
  return moment(date).tz('America/Chicago').format(format);
};

/**
 * Check if an event is scheduled for today in Chicago timezone
 * @param {Object} eventData - The event data object
 * @returns {boolean} True if event is scheduled for today
 */
export const isEventToday = (eventData) => {
  if (!eventData || !eventData.date) return false;
  
  const today = getChicagoTime().format('YYYY-MM-DD');
  const eventDate = moment.tz(eventData.date, 'America/Chicago').format('YYYY-MM-DD');
  
  return eventDate === today;
};

/**
 * Check if today falls within a date range (for haciendas)
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string 
 * @returns {boolean} True if today is between start and end dates inclusive
 */
export const isTodayInDateRange = (startDate, endDate) => {
  if (!startDate) return false;
  
  const today = getChicagoTime();
  const start = moment.tz(startDate, 'America/Chicago');
  const end = endDate ? moment.tz(endDate, 'America/Chicago') : start;
  
  return today.isBetween(start, end, 'day', '[]'); // [] means inclusive
};

/**
 * Calculate attendance percentage for event type
 * @param {Array} events - Array of event objects
 * @returns {number} Attendance percentage (0-100)
 */
export const calculateAttendancePercentage = (events = []) => {
  // Only consider scheduled events
  const scheduledEvents = events.filter(e => e.scheduled);
  
  if (scheduledEvents.length === 0) return 0;
  
  const attendedCount = scheduledEvents.filter(e => e.attended).length;
  return (attendedCount / scheduledEvents.length * 100).toFixed(1);
};

/**
 * Create a valid event object with Chicago timezone dates
 * @param {Object} eventData - Raw event data
 * @returns {Object} Formatted event object
 */
export const createEventObject = (eventData) => {
  const now = getChicagoTime();
  
  // Ensure start and end dates are in Chicago timezone
  const start = eventData.start ? 
    (eventData.start instanceof Date ? 
      moment(eventData.start).tz('America/Chicago').toISOString() : 
      eventData.start) : 
    now.toISOString();
    
  const end = eventData.end ? 
    (eventData.end instanceof Date ? 
      moment(eventData.end).tz('America/Chicago').toISOString() : 
      eventData.end) : 
    moment.tz(start, 'America/Chicago').add(1, 'hour').toISOString();
  
  // Normalize event type to standard category
  const originalType = eventData.eventType || 'hacienda';
  const normalizedType = normalizeEventType(originalType);
  
  return {
    ...eventData,
    title: eventData.title || 'Untitled Event',
    start: start,
    end: end,
    eventType: normalizedType,            // Use the standardized category
    originalEventType: originalType,      // Keep the original for reference
    displayName: EVENT_TYPE_DISPLAY_NAMES[normalizedType] || 'Other',
    createdAt: eventData.createdAt || now.toISOString()
  };
};

/**
 * Process multiple scheduled events for a user (for batch operations)
 * @param {string} userId - User ID
 * @param {Object} userData - User data including events
 * @returns {Object} Object with updates to apply and list of updated events
 */
export const processScheduledEvents = (userId, userData) => {
  if (!userId || !userData || !userData.events) {
    return { updates: {}, eventsUpdated: [] };
  }
  
  const updates = {};
  const eventsUpdated = [];
  const now = getChicagoTime();
  const today = now.format('YYYY-MM-DD');
  
  // Process each event type
  Object.entries(userData.events).forEach(([eventType, eventsOfType]) => {
    // Skip if not a valid event type object
    if (!eventsOfType || typeof eventsOfType !== 'object') return;
    
    // Process each event in this category
    Object.entries(eventsOfType).forEach(([eventId, eventData]) => {
      // Only process scheduled but not attended events
      if (!eventData.scheduled || eventData.attended) return;
      
      // Check if hacienda with date range
      if (eventType === EVENT_TYPES.HACIENDAS && eventData.endDate) {
        // Check if today falls in the date range
        if (isTodayInDateRange(eventData.date, eventData.endDate)) {
          updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = true;
          updates[`users/${userId}/events/${eventType}/${eventId}/attendedAt`] = now.toISOString();
          
          eventsUpdated.push({
            type: eventType,
            id: eventId,
            name: eventData.title || 'Hacienda'
          });
        }
      } 
      // Standard same-day check for other event types
      else {
        const eventDate = moment.tz(eventData.date, 'America/Chicago').format('YYYY-MM-DD');
        
        if (eventDate === today) {
          updates[`users/${userId}/events/${eventType}/${eventId}/attended`] = true;
          updates[`users/${userId}/events/${eventType}/${eventId}/attendedAt`] = now.toISOString();
          
          // Also update participants if event ID exists
          if (eventData.eventId) {
            updates[`events/${eventData.eventId}/participants/${userId}`] = true;
          }
          
          eventsUpdated.push({
            type: eventType,
            id: eventId,
            name: eventData.title || 'Untitled Event'
          });
        }
      }
    });
  });
  
  return { updates, eventsUpdated };
};
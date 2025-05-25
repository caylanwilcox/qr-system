// src/utils/eventUtils.js - Complete with createEventObject function
import { ref, get } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import moment from 'moment-timezone';

// Set default timezone for consistency
moment.tz.setDefault('America/Chicago');

// Default event types
export const EVENT_TYPES = {
  GESTION: 'GESTION',
  HACIENDAS: 'HACIENDAS',
  WORKSHOPS: 'WORKSHOPS',
  MEETINGS: 'MEETINGS',
  JUNTAHACIENDA: 'JUNTAHACIENDA'
};

// Display names for event types
export const EVENT_TYPE_DISPLAY_NAMES = {
  GESTION: 'Gestion',
  HACIENDAS: 'Hacienda',
  WORKSHOPS: 'Workshop',
  MEETINGS: 'Meeting',
  JUNTAHACIENDA: 'Junta de Hacienda'
};

// Map event types to categories
export const EVENT_TYPE_TO_CATEGORY_MAP = {
  GESTION: 'gestion',
  HACIENDAS: 'haciendas',
  WORKSHOPS: 'workshops',
  MEETINGS: 'meetings',
  JUNTAHACIENDA: 'juntaHacienda'
};

// Default locations
export const LOCATIONS = [
  'Aurora',
  'Elgin',
  'Joliet',
  'Lyons',
  'West Chicago',
  'Wheeling'
];

/**
 * Create a new event object with default values
 * @param {Object} eventData - Event data
 * @returns {Object} - Event object with default values
 */
export const createEventObject = (eventData = {}) => {
  const now = moment().tz('America/Chicago');
  const startHour = eventData.allDay ? 0 : 9; // Default to 9am if not all day
  const endHour = eventData.allDay ? 23 : startHour + 1; // Default to 1 hour duration
  
  // Generate a default start/end time if not provided
  const defaultStart = now.clone().startOf('day').add(startHour, 'hours').toISOString();
  const defaultEnd = now.clone().startOf('day').add(endHour, 'hours').toISOString();
  
  return {
    id: eventData.id || `event-${Date.now()}`,
    title: eventData.title || 'New Event',
    start: eventData.start || defaultStart,
    end: eventData.end || defaultEnd,
    description: eventData.description || '',
    location: eventData.location || 'Aurora', // Default location
    eventType: eventData.eventType || EVENT_TYPES.MEETINGS,
    allDay: eventData.allDay || false,
    isUrgent: eventData.isUrgent || false,
    recurring: eventData.recurring || false,
    recurringPattern: eventData.recurringPattern || null,
    createdAt: eventData.createdAt || new Date().toISOString(),
    createdBy: eventData.createdBy || 'system',
    participants: eventData.participants || {},
    category: eventData.category || 'meetings',
    status: eventData.status || 'active',
    // Include any other props from eventData
    ...eventData
  };
};

/**
 * Load system codes from the database
 * This refreshes the default constants with the latest values from the database
 * @returns {Promise<Object>} - Object containing system codes
 */
export const loadSystemCodes = async () => {
  try {
    // Get event types
    const eventTypesRef = ref(database, 'eventTypes');
    const eventTypesSnapshot = await get(eventTypesRef);
    
    let EVENT_TYPES_LOADED = { ...EVENT_TYPES };
    let EVENT_TYPE_DISPLAY_NAMES_LOADED = { ...EVENT_TYPE_DISPLAY_NAMES };
    let EVENT_TYPE_TO_CATEGORY_MAP_LOADED = { ...EVENT_TYPE_TO_CATEGORY_MAP };
    
    if (eventTypesSnapshot.exists()) {
      const eventTypesData = eventTypesSnapshot.val();
      
      // Process event types
      Object.entries(eventTypesData).forEach(([id, et]) => {
        if (et.active !== false) { // Only include active event types
          const name = et.name.toUpperCase();
          EVENT_TYPES_LOADED[name] = name;
          EVENT_TYPE_DISPLAY_NAMES_LOADED[name] = et.displayName || name;
          EVENT_TYPE_TO_CATEGORY_MAP_LOADED[name] = et.name.toLowerCase();
        }
      });
    }
    
    // Get locations
    const locationsRef = ref(database, 'locations');
    const locationsSnapshot = await get(locationsRef);
    
    let LOCATIONS_LOADED = [...LOCATIONS];
    
    if (locationsSnapshot.exists()) {
      const locationsData = locationsSnapshot.val();
      LOCATIONS_LOADED = Object.values(locationsData)
        .filter(loc => loc.active !== false) // Only include active locations
        .map(loc => loc.name)
        .filter(Boolean); // Filter out undefined/null
    }
    
    // If empty, try the locationsList
    if (LOCATIONS_LOADED.length === 0) {
      const locationsListRef = ref(database, 'locationsList');
      const locationsListSnapshot = await get(locationsListRef);
      
      if (locationsListSnapshot.exists()) {
        const locationsListData = locationsListSnapshot.val();
        if (Array.isArray(locationsListData) && locationsListData.length > 0) {
          LOCATIONS_LOADED = locationsListData;
        }
      }
    }
    
    return {
      EVENT_TYPES: EVENT_TYPES_LOADED,
      EVENT_TYPE_DISPLAY_NAMES: EVENT_TYPE_DISPLAY_NAMES_LOADED,
      EVENT_TYPE_TO_CATEGORY_MAP: EVENT_TYPE_TO_CATEGORY_MAP_LOADED,
      LOCATIONS: LOCATIONS_LOADED
    };
  } catch (error) {
    console.error('Error loading system codes:', error);
    
    // Return default values if there's an error
    return {
      EVENT_TYPES,
      EVENT_TYPE_DISPLAY_NAMES,
      EVENT_TYPE_TO_CATEGORY_MAP,
      LOCATIONS
    };
  }
};

/**
 * Normalize event type to a standard format
 * @param {string} eventType - Event type string
 * @returns {string} - Normalized event type
 */
export const normalizeEventType = (eventType) => {
  if (!eventType) return '';
  
  // Convert to uppercase and remove spaces
  const normalized = eventType.toUpperCase().replace(/\s+/g, '');
  
  // Handle special cases
  if (normalized.includes('JUNTA') && normalized.includes('HACIENDA')) {
    return 'JUNTAHACIENDA';
  }
  
  return normalized;
};

/**
 * Get current time in Chicago timezone
 * @returns {moment} - Moment object with Chicago timezone
 */
export const getChicagoTime = () => {
  return moment().tz('America/Chicago');
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
 * Check if an event is scheduled for today
 * @param {Object} event - Event object
 * @returns {boolean} - True if event is today
 */
export const isEventToday = (event) => {
  if (!event) return false;
  
  const today = getChicagoTime().format('YYYY-MM-DD');
  
  // Check start date if available
  if (event.start) {
    return moment(event.start).tz('America/Chicago').format('YYYY-MM-DD') === today;
  }
  
  // Check date directly if available
  if (event.date) {
    return moment(event.date).tz('America/Chicago').format('YYYY-MM-DD') === today;
  }
  
  return false;
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
// src/components/QRSCANNER/QRScannerPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, X, CheckCircle, AlertCircle, ExternalLink, LogOut, LogIn } from 'lucide-react';
import { ref, get, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { useAuth } from '../../services/authContext';
import { eventBus, EVENTS } from '../../services/eventBus';
import { useNavigate } from 'react-router-dom';
import Scanner from './Scanner';
import SettingsPanel from './SettingsPanel';
import moment from 'moment-timezone';
import {
  normalizeEventType,
  splitOpenClockIns,
  pickOpenClockIn,
  sharedPathFor,
  staleClockInUpdates,
  findEventsToMarkAttended,
  composeClockInUpdates,
  composeClockOutUpdates
} from '../../utils/attendanceRules';

// Shared attendance copies of forgotten clock-ins that exist. Writing a status
// to a copy that doesn't exist would create a stray partial record.
async function existingSharedPaths(userId, staleRecords) {
  try {
    const paths = staleRecords.map((item) => sharedPathFor(item, userId)).filter(Boolean);
    const snapshots = await Promise.all(paths.map((path) => get(ref(database, path))));
    return paths.filter((_, index) => snapshots[index].exists());
  } catch (error) {
    console.error('🔍 Could not check shared attendance records:', error);
    return [];
  }
}

/**
 * Main QR Scanner page component with Clock-In and Clock-Out support
 * FIXED VERSION - Addresses dashboard compatibility and clock-in issues
 */
const QRScannerPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Basic state
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('');
  const [mode, setMode] = useState('clock-in'); // 'clock-in' or 'clock-out'
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  
  // Settings state
  const [locations, setLocations] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [eventTypeDisplayNames, setEventTypeDisplayNames] = useState({});
  const [meetingTypes] = useState([]);
  const [selectedMeeting, setSelectedMeetting] = useState('');
  const [scheduledEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Refs to track current state for callbacks
  const currentStateRef = useRef({ location: '', eventType: '', mode: 'clock-in' });
  // Set synchronously on scan. The isProcessing state lags a render behind,
  // which let two quick scans of the same badge both get through.
  const processingRef = useRef(false);

  console.log('🔍 QRScannerPage render - current state:', { location, eventType, mode, isProcessing });
  
  // Update ref whenever state changes
  useEffect(() => {
    currentStateRef.current = { location, eventType, mode };
    console.log('🔍 State update - Location:', location, 'EventType:', eventType, 'Mode:', mode);
  }, [location, eventType, mode]);

  // Initialize app on component mount
  useEffect(() => {
    console.log('🔍 useEffect running - loadSystemSettings');
    
    const loadSystemSettings = async () => {
      try {
        // Load locations
        const locationsRef = ref(database, 'locations');
        const locationsSnapshot = await get(locationsRef);
        if (locationsSnapshot.exists()) {
          const locationsData = locationsSnapshot.val();
          console.log('Raw locations data from Firebase:', locationsData);
          
          const locationsList = Object.entries(locationsData).map(([key, value]) => {
            if (typeof value === 'object' && value !== null && value.name) {
              return value.name;
            }
            if (typeof value === 'string') {
              return value;
            }
            return key;
          }).filter(loc => loc && typeof loc === 'string');
          
          console.log('Processed locations list:', locationsList);
          setLocations(locationsList);
        } else {
          console.log('No locations found in database, using defaults');
          setLocations(['Aurora', 'Elgin', 'Chicago']);
        }

        // Load event types
        const eventTypesRef = ref(database, 'eventTypes');
        const eventTypesSnapshot = await get(eventTypesRef);
        if (eventTypesSnapshot.exists()) {
          const types = {};
          const displayNames = {};
          
          console.log('🔍 Raw event types from Firebase:', eventTypesSnapshot.val());
          
          Object.entries(eventTypesSnapshot.val()).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              const eventTypeName = value.name || value.key || key;
              types[key] = eventTypeName;
              displayNames[eventTypeName] = value.displayName || eventTypeName;
              
              const normalized = eventTypeName.toLowerCase().replace(/\s+/g, '');
              displayNames[normalized] = value.displayName || eventTypeName;
            } else if (typeof value === 'string') {
              types[key] = value;
              displayNames[value] = value;
              
              const normalized = value.toLowerCase().replace(/\s+/g, '');
              displayNames[normalized] = value;
            }
          });
          
          // Add common display names
          const commonNames = {
            'juntahacienda': 'Junta Hacienda',
            'junta_hacienda': 'Junta Hacienda', 
            'JUNTA_HACIENDA': 'Junta Hacienda',
            'meetings': 'Meetings',
            'workshops': 'Workshops',
            'haciendas': 'Haciendas',
            'gestion': 'Gestion'
          };
          
          Object.entries(commonNames).forEach(([key, value]) => {
            if (!displayNames[key]) {
              displayNames[key] = value;
            }
          });
          
          console.log('🔍 Processed event types:', types);
          console.log('🔍 Event type display names:', displayNames);
          
          setEventTypes(types);
          setEventTypeDisplayNames(displayNames);
          
          console.log('🔍 Event types loaded');
        } else {
          // Default event types
          const defaultTypes = {
            'general': 'GENERAL',
            'juntahacienda': 'juntahacienda',
            'meeting': 'MEETING',
            'training': 'TRAINING'
          };
          
          const defaultDisplayNames = {
            'GENERAL': 'General Meeting',
            'general': 'General Meeting',
            'juntahacienda': 'Junta Hacienda',
            'MEETING': 'Meeting',
            'meeting': 'Meeting',
            'TRAINING': 'Training',
            'training': 'Training'
          };
          
          setEventTypes(defaultTypes);
          setEventTypeDisplayNames(defaultDisplayNames);
        }
        
        setMessage('System loaded. Ready to scan.');
      } catch (error) {
        console.error('Error loading system settings:', error);
        setMessage('Failed to load system settings. Please refresh.');
      }
    };

    loadSystemSettings();
  }, []);

  // FIXED: Process clock-in with unique record creation - no overwriting
  const processClockIn = useCallback(async (userId, userData, now, timestamp, currentDate, formattedTime, currentLocation, currentEventType) => {
    console.log('🔍 Processing clock-in');
    
    // FIXED: Use Chicago timezone for time calculations
    const chicagoNow = moment().tz('America/Chicago');
    
    // FIXED: Determine if the user is late based on scheduled events for today
    let isLate = false;
    
    // Check if user has any scheduled events for today
    const hasScheduledEventsToday = checkUserHasScheduledEventsToday(userData, currentDate);
    
    if (hasScheduledEventsToday) {
      // Check user's personal events for scheduled times
      isLate = checkLateBasedOnUserEvents(userData, currentDate, chicagoNow);
      
      console.log('🔍 User has scheduled events today, late status:', isLate);
    } else {
      // No scheduled events, user cannot be late
      isLate = false;
      console.log('🔍 User has no scheduled events today, marking as on time');
    }
    
    const locationValue = typeof currentLocation === 'object' ? (currentLocation.name || currentLocation.key || 'Unknown') : currentLocation;
    const locationKey = locationValue.toLowerCase().replace(/\s+/g, '');
    const eventTypeValue = typeof currentEventType === 'object' ? (currentEventType.name || 'Unknown') : currentEventType;
    const userName = typeof userData.name === 'object' ? 'Unknown User' : (userData.name || 'Unknown User');
    const position = userData.profile?.position || 'Member';

    // One open clock-in at a time. Forgotten clock-ins from earlier days are
    // closed as missed below instead of blocking the person forever.
    const { openToday, stale } = splitOpenClockIns(userData.attendance, currentDate);
    if (openToday.length > 0) {
      const since = openToday[0].record.clockInTime;
      throw new Error(`${userName} is already clocked in${since ? ` since ${since}` : ''}. Use Clock Out to end that shift first.`);
    }

    // Normalize event type for consistent storage
    const normalizedEventType = normalizeEventType(eventTypeValue);
    console.log('🔍 Normalized Event Type:', normalizedEventType);
    
    // CRITICAL FIX: Create unique attendance record key using timestamp to prevent overwriting
    const uniqueAttendanceKey = `${currentDate}_${timestamp}`;
    
    console.log('🔍 Creating attendance key:', {
      currentDate,
      timestamp,
      uniqueAttendanceKey,
      chicagoTime: chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'),
      utcTime: new Date().toISOString()
    });
    
    // Update user record
    const userUpdates = {};
    
    // CRITICAL FIX: Set clockedIn status properly
    userUpdates['clockedIn'] = true;
    userUpdates['clockedInDate'] = currentDate;
    userUpdates['clockedInTimestamp'] = timestamp;
    userUpdates[`clockInTimes/${timestamp}`] = formattedTime;
    
    // CRITICAL FIX: Only increment stats if this is the first clock-in of the day
    // Check existing attendance for today first
    const todayAttendanceExists = userData.attendance && Object.keys(userData.attendance).some(key => 
      key.startsWith(currentDate)
    );
    
    if (!todayAttendanceExists) {
      userUpdates['stats/daysPresent'] = (userData.stats?.daysPresent || 0) + 1;
      
      if (isLate) {
        userUpdates['stats/daysLate'] = (userData.stats?.daysLate || 0) + 1;
      }
    }
    
    userUpdates['stats/lastClockIn'] = chicagoNow.toISOString(); // FIXED: Use Chicago timezone
    
    // CRITICAL FIX: Use unique key that creates separate entries for each clock-in
    userUpdates[`attendance/${uniqueAttendanceKey}/clockedIn`] = true;
    userUpdates[`attendance/${uniqueAttendanceKey}/clockInTime`] = formattedTime;
    userUpdates[`attendance/${uniqueAttendanceKey}/isLate`] = isLate;
    userUpdates[`attendance/${uniqueAttendanceKey}/onTime`] = !isLate;
    userUpdates[`attendance/${uniqueAttendanceKey}/location`] = locationKey;
    userUpdates[`attendance/${uniqueAttendanceKey}/locationName`] = locationValue;
    userUpdates[`attendance/${uniqueAttendanceKey}/eventType`] = eventTypeValue;
    userUpdates[`attendance/${uniqueAttendanceKey}/clockInTimestamp`] = timestamp;
    userUpdates[`attendance/${uniqueAttendanceKey}/date`] = currentDate;
    userUpdates[`attendance/${uniqueAttendanceKey}/status`] = 'clocked-in';
    
    // Record in events section
    const eventId = `${currentDate}-${timestamp}`;
    userUpdates[`events/${normalizedEventType}/${eventId}/attended`] = true;
    userUpdates[`events/${normalizedEventType}/${eventId}/attendedAt`] = chicagoNow.toISOString(); // FIXED: Use Chicago timezone
    userUpdates[`events/${normalizedEventType}/${eventId}/date`] = currentDate;
    userUpdates[`events/${normalizedEventType}/${eventId}/title`] = `${eventTypeDisplayNames[eventTypeValue] || eventTypeValue} - Clock In`;
    userUpdates[`events/${normalizedEventType}/${eventId}/scheduled`] = true;
    userUpdates[`events/${normalizedEventType}/${eventId}/location`] = locationKey;
    userUpdates[`events/${normalizedEventType}/${eventId}/eventType`] = normalizedEventType;
    
    // ENHANCED: Update any assigned statistics for today's events to mark as clocked in
    if (userData.statistics) {
      Object.entries(userData.statistics).forEach(([statEventId, statEntry]) => {
        if (statEntry && 
            statEntry.date === currentDate && 
            statEntry.status === 'assigned' && 
            !statEntry.clockedIn) {
          
          // Check if this statistic matches our event type
          const statEventType = statEntry.eventType?.toLowerCase().replace(/[_\s-]/g, '');
          const currentEventType = normalizedEventType.toLowerCase().replace(/[_\s-]/g, '');
          
          if (statEventType === currentEventType || 
              statEventType === 'general' || 
              currentEventType === 'generalmeeting') {
            
            console.log(`🔍 Updating assigned statistic ${statEventId} to clocked in`);
            userUpdates[`statistics/${statEventId}/clockedIn`] = true;
            userUpdates[`statistics/${statEventId}/clockInTime`] = formattedTime;
            userUpdates[`statistics/${statEventId}/status`] = 'completed';
            userUpdates[`statistics/${statEventId}/attendedAt`] = chicagoNow.toISOString();
          }
        }
      });
    }
    
    // Close forgotten clock-ins from earlier days.
    Object.assign(userUpdates, staleClockInUpdates(stale, timestamp));

    // Scheduled events this scan should mark attended: events the user is a
    // participant in, running today, with the scanned event type.
    let attendedEventIds = [];
    try {
      const scheduledIds = Object.keys(userData.schedule || {});
      const snapshots = await Promise.all(scheduledIds.map((id) => get(ref(database, `events/${id}`))));
      const scheduledEvents = snapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => ({ id: snapshot.key, data: snapshot.val() }));
      attendedEventIds = findEventsToMarkAttended({
        events: scheduledEvents,
        userId,
        dateStr: currentDate,
        eventType: eventTypeValue,
        locationKey
      });
    } catch (error) {
      // The clock-in still goes ahead; the event can be marked by hand.
      console.error('🔍 Could not check scheduled events:', error);
    }

    // The shared attendance record that Reports reads.
    const globalAttendanceData = {
      userId,
      name: userName,
      position,
      location: locationKey,
      locationName: locationValue,
      clockInTime: chicagoNow.toISOString(),
      clockInTimestamp: timestamp,
      isLate,
      status: 'clocked-in',
      eventType: normalizedEventType
    };

    // One atomic write: the user's record, the shared record and event
    // attendance all save together or not at all.
    const updates = composeClockInUpdates({
      userId,
      userUpdates,
      sharedPath: `attendance/${locationKey}/${currentDate}/${userId}`,
      sharedRecord: globalAttendanceData,
      attendedEventIds,
      attendedAt: chicagoNow.toISOString(),
      staleSharedPaths: await existingSharedPaths(userId, stale)
    });

    console.log('🔍 Clock-in updates to be applied:', updates);

    try {
      await update(ref(database), updates);
      console.log('🔍 Clock-in updates applied successfully');
    } catch (error) {
      console.error('🔍 Error applying clock-in updates:', error);
      throw error;
    }

    // Set employee info for display
    setEmployeeInfo({
      ...userData,
      userId,
      name: userName,
      position: position,
      clockInTime: formattedTime,
      clockInTimestamp: timestamp,
      isLate: isLate,
      selectedEventType: eventTypeValue,
      selectedEventDisplayName: eventTypeDisplayNames[eventTypeValue] || eventTypeValue,
      mode: 'clock-in',
      attendanceKey: uniqueAttendanceKey
    });
    
    // Emit events
    emitClockEvents(userId, locationKey, locationValue, chicagoNow.toDate(), 'clock-in', isLate, normalizedEventType, eventId); // FIXED: Use Chicago timezone
    
    const notes = [];
    if (attendedEventIds.length > 0) {
      notes.push(`Marked attended for ${attendedEventIds.length} scheduled event(s).`);
    }
    if (stale.length > 0) {
      notes.push(`${stale.length} earlier clock-in(s) without a clock-out were marked missed.`);
    }
    setMessage(`Successfully clocked in: ${userName}. ${notes.join(' ')}`.trim());
  }, [eventTypeDisplayNames]);

  // FIXED: Process clock-out with unique record creation - no overwriting
  const processClockOut = useCallback(async (userId, userData, now, timestamp, currentDate, formattedTime, currentLocation) => {
    console.log('🔍 Processing clock-out');
    
    // FIXED: Use Chicago timezone for time calculations
    const chicagoNow = moment().tz('America/Chicago');
    
    // CRITICAL FIX: Find the most recent clock-in for today that hasn't been clocked out
    let mostRecentClockInKey = null;
    let mostRecentClockIn = null;
    let clockInTimestamp = null;
    
    // Today's open clock-in, or one from last night if the shift crossed midnight.
    const { open, stale } = pickOpenClockIn(userData.attendance, currentDate, timestamp);
    if (open) {
      mostRecentClockInKey = open.key;
      mostRecentClockIn = open.record;
      clockInTimestamp = mostRecentClockIn.clockInTimestamp;
    }
    
    // If no active clock-in found, check if user is marked as clocked in
    if (!mostRecentClockInKey && userData.clockedIn === true && userData.clockedInDate === currentDate) {
      // Create a clock-out record even without finding the exact clock-in
      clockInTimestamp = userData.clockedInTimestamp || (timestamp - (8 * 60 * 60 * 1000)); // Default to 8 hours ago
    }
    
    const userName = typeof userData.name === 'object' ? 'Unknown User' : (userData.name || 'Unknown User');

    if (!clockInTimestamp) {
      // Nothing open today. A clock-in from an earlier day that was never
      // closed is marked missed, so the person isn't stuck "clocked in".
      const staleFlag = userData.clockedIn === true
        && Boolean(userData.clockedInDate)
        && userData.clockedInDate < currentDate;
      if (stale.length > 0 || staleFlag) {
        const fixes = composeClockOutUpdates({
          userId,
          userUpdates: { ...staleClockInUpdates(stale, timestamp), clockedIn: false },
          sharedPath: null,
          staleSharedPaths: await existingSharedPaths(userId, stale)
        });
        await update(ref(database), fixes);
        setMessage(`No clock-in found today for ${userName}. An earlier clock-in that was never closed is now marked missed. Please clock in first.`);
        return;
      }
      throw new Error('No active clock-in found for today. Please clock in first.');
    }
    
    const locationValue = typeof currentLocation === 'object' ? (currentLocation.name || currentLocation.key || 'Unknown') : currentLocation;
    const locationKey = locationValue.toLowerCase().replace(/\s+/g, '');
    const position = userData.profile?.position || 'Member';

    // Calculate hours worked
    const hoursWorked = (timestamp - clockInTimestamp) / (1000 * 60 * 60);
    console.log(`🔍 Calculated hours worked: ${hoursWorked.toFixed(2)}`);
    
    // Update user record
    const userUpdates = {};
    
    // CRITICAL FIX: Set clocked out status properly
    userUpdates['clockedIn'] = false;
    userUpdates['clockedOut'] = true;
    userUpdates['clockedOutDate'] = currentDate;
    userUpdates['clockedOutTimestamp'] = timestamp;
    userUpdates[`clockOutTimes/${timestamp}`] = formattedTime;
    
    // Update stats
    userUpdates['stats/lastClockOut'] = chicagoNow.toISOString(); // FIXED: Use Chicago timezone
    if (hoursWorked > 0) {
      userUpdates['stats/totalHours'] = (userData.stats?.totalHours || 0) + hoursWorked;
    }
    
    // CRITICAL FIX: Update the specific clock-in record to mark it as clocked out
    if (mostRecentClockInKey) {
      userUpdates[`attendance/${mostRecentClockInKey}/clockedOut`] = true;
      userUpdates[`attendance/${mostRecentClockInKey}/clockOutTime`] = formattedTime;
      userUpdates[`attendance/${mostRecentClockInKey}/clockOutTimestamp`] = timestamp;
      userUpdates[`attendance/${mostRecentClockInKey}/hoursWorked`] = hoursWorked.toFixed(2);
      userUpdates[`attendance/${mostRecentClockInKey}/status`] = 'completed';
      // IMPORTANT: Keep clockedIn as false to indicate clocked out
      userUpdates[`attendance/${mostRecentClockInKey}/clockedIn`] = false;
      console.log(`🔍 Updated attendance record: ${mostRecentClockInKey}`);
    } else {
      // If no specific clock-in found, create a new clock-out only record
      const uniqueAttendanceKey = `${currentDate}_${timestamp}_out`;
      userUpdates[`attendance/${uniqueAttendanceKey}/clockedOut`] = true;
      userUpdates[`attendance/${uniqueAttendanceKey}/clockOutTime`] = formattedTime;
      userUpdates[`attendance/${uniqueAttendanceKey}/clockOutTimestamp`] = timestamp;
      userUpdates[`attendance/${uniqueAttendanceKey}/location`] = locationKey;
      userUpdates[`attendance/${uniqueAttendanceKey}/locationName`] = locationValue;
      userUpdates[`attendance/${uniqueAttendanceKey}/clockedIn`] = false;
      userUpdates[`attendance/${uniqueAttendanceKey}/date`] = currentDate;
      userUpdates[`attendance/${uniqueAttendanceKey}/status`] = 'clock-out-only';
      userUpdates[`attendance/${uniqueAttendanceKey}/hoursWorked`] = hoursWorked.toFixed(2);
      console.log(`🔍 Created clock-out only record: ${uniqueAttendanceKey}`);
    }
    
    // Close forgotten clock-ins from earlier days too.
    Object.assign(userUpdates, staleClockInUpdates(stale, timestamp));

    // One atomic write for the user's record and the shared record. The shared
    // record lives under the clock-in's own location and date, which can
    // differ from the scanner's current location.
    const updates = composeClockOutUpdates({
      userId,
      userUpdates,
      sharedPath: open ? sharedPathFor(open, userId, locationKey) : null,
      clockOut: {
        time: chicagoNow.toISOString(),
        timestamp,
        hoursWorked: hoursWorked.toFixed(2)
      },
      staleSharedPaths: await existingSharedPaths(userId, stale)
    });

    console.log('🔍 Clock-out updates to be applied:', updates);
    
    try {
      await update(ref(database), updates);
      console.log('🔍 Clock-out updates applied successfully');
    } catch (error) {
      console.error('🔍 Error applying clock-out updates:', error);
      throw error;
    }
    
    // Set employee info for display
    setEmployeeInfo({
      ...userData,
      userId,
      name: userName,
      position: position,
      clockOutTime: formattedTime,
      clockOutTimestamp: timestamp,
      hoursWorked: hoursWorked.toFixed(2),
      mode: 'clock-out',
      attendanceKey: mostRecentClockInKey
    });
    
    // Emit events
    emitClockEvents(userId, locationKey, locationValue, chicagoNow.toDate(), 'clock-out', false); // FIXED: Use Chicago timezone
    
    
    setMessage(`Successfully clocked out: ${userName}. Hours worked: ${hoursWorked.toFixed(2)}`);
  }, []);

  // FIXED: Enhanced event emission with error handling
  const emitClockEvents = (userId, locationKey, locationValue, now, type, isLate = false, eventType = null, eventId = null) => {
    console.log('🔍 Emitting clock events:', { userId, type, locationKey, eventType });
    
    try {
      eventBus.emit(EVENTS.ATTENDANCE_UPDATED, {
        userId,
        location: locationKey,
        locationName: locationValue,
        timestamp: now.toISOString(),
        type: type,
        isLate: isLate
      });
      
      eventBus.emit(EVENTS.USER_DATA_UPDATED, {
        userId,
        field: 'attendance',
        timestamp: now.toISOString()
      });
      
      if (eventType && eventId) {
        eventBus.emit(EVENTS.EVENT_UPDATED, {
          userId,
          eventId,
          eventType: eventType,
          status: 'attended',
          timestamp: now.toISOString()
        });
      }
      
      eventBus.emit(EVENTS.DASHBOARD_DATA_UPDATED, {
        location: locationKey,
        timestamp: now.toISOString()
      });
      
      console.log('🔍 All clock events emitted successfully');
    } catch (error) {
      console.error('🔍 Error emitting events:', error);
    }
  };

  // FIXED: Handle successful scan with enhanced validation
  const handleScan = useCallback(async (scannedCode) => {
    const currentLocation = currentStateRef.current.location;
    const currentEventType = currentStateRef.current.eventType;
    const currentMode = currentStateRef.current.mode;
    
    console.log('🔍 Scan attempt with current state:', { 
      scannedCode, 
      currentLocation, 
      currentEventType,
      currentMode,
      processing: processingRef.current
    });

    // CRITICAL FIX: Validate inputs more thoroughly
    if (processingRef.current) {
      console.log('🔍 Scan blocked: Already processing');
      setMessage('Processing in progress...');
      return;
    }
    
    if (!scannedCode || !scannedCode.trim()) {
      console.log('🔍 Scan blocked: No code detected');
      setMessage('No code detected');
      return;
    }

    if (!currentLocation || !currentLocation.trim()) {
      console.log('🔍 Scan blocked: No location selected');
      setMessage('Please select a location first');
      return;
    }

    // For clock-in mode, event type is required
    if (currentMode === 'clock-in' && (!currentEventType || !currentEventType.trim())) {
      console.log('🔍 Scan blocked: No event type selected for clock-in');
      setMessage('Please select an event type for clock-in');
      return;
    }

    console.log('🔍 Scan proceeding with:', { location: currentLocation, eventType: currentEventType, mode: currentMode });
    processingRef.current = true;
    setIsProcessing(true);
    setMessage(`Processing ${currentMode}...`);

    try {
      const userId = scannedCode.trim();
      
      console.log('🔍 Looking up user:', userId);
      
      // Check if user exists and is active
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      let userData = {};
      
      if (userSnapshot.exists()) {
        userData = userSnapshot.val();
        console.log('🔍 User found in users path');
      } else {
        // Try to get user data from employees path
        const employeeRef = ref(database, `employees/${userId}`);
        const employeeSnapshot = await get(employeeRef);
        
        if (employeeSnapshot.exists()) {
          userData = employeeSnapshot.val();
          console.log('🔍 User found in employees path');
        } else {
          console.log('🔍 User not found in either path');
          throw new Error('User not found in the system');
        }
      }
      
      // CRITICAL FIX: Better validation of user data
      if (!userData || typeof userData !== 'object') {
        throw new Error('Invalid user data retrieved');
      }
      
      // Check if user is active
      const deletedUsersRef = ref(database, `deleted_users`);
      const deletedSnapshot = await get(deletedUsersRef);
      
      if (deletedSnapshot.exists()) {
        const deletedUsers = deletedSnapshot.val();
        const isDeleted = Object.keys(deletedUsers).some(key => key.includes(userId));
        
        if (isDeleted) {
          throw new Error('User account is inactive or deleted');
        }
      }
      
      // FIXED: Get current timestamp and date using Chicago timezone consistently
      const chicagoNow = moment().tz('America/Chicago');
      const now = chicagoNow.toDate(); // Convert to Date object for compatibility
      const timestamp = chicagoNow.valueOf(); // Use Chicago timezone moment for timestamp
      const currentDate = chicagoNow.format('YYYY-MM-DD'); // Chicago timezone date
      const formattedTime = chicagoNow.format('hh:mm A'); // Chicago timezone time
      
      console.log('🔍 Processing timestamp:', { 
        timestamp, 
        currentDate, 
        formattedTime, 
        chicagoTime: chicagoNow.format(),
        utcTime: new Date().toISOString()
      });
      
      // Process based on mode
      if (currentMode === 'clock-in') {
        await processClockIn(userId, userData, now, timestamp, currentDate, formattedTime, currentLocation, currentEventType);
      } else {
        await processClockOut(userId, userData, now, timestamp, currentDate, formattedTime, currentLocation);
      }
      
    } catch (error) {
      console.error('🔍 Scan error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [processClockIn, processClockOut]);

  // Debug function to test timezone calculations
  const debugTimezone = () => {
    const chicagoNow = moment().tz('America/Chicago');
    const utcNow = moment().utc();
    const localNow = moment();
    
    console.log('=== TIMEZONE DEBUG ===');
    console.log('Chicago time:', chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('Chicago date:', chicagoNow.format('YYYY-MM-DD'));
    console.log('UTC time:', utcNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('UTC date:', utcNow.format('YYYY-MM-DD'));
    console.log('Local time:', localNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('Local date:', localNow.format('YYYY-MM-DD'));
    console.log('Timestamp (Chicago):', chicagoNow.valueOf());
    console.log('Timestamp (UTC):', utcNow.valueOf());
    console.log('======================');
    
    setMessage(`Debug: Chicago date is ${chicagoNow.format('YYYY-MM-DD')}, UTC date is ${utcNow.format('YYYY-MM-DD')}`);
  };

  // Handle mode switch
  const handleModeSwitch = (newMode) => {
    console.log('🔍 Mode switch:', newMode);
    setMode(newMode);
    setEmployeeInfo(null); // Clear previous scan result
    setMessage(`Switched to ${newMode} mode`);
  };

  // Handle location selection
  const handleLocationChange = (selectedLocation) => {
    console.log('🔍 Location change:', selectedLocation);
    setLocation(selectedLocation);
    setMessage(`Location set to: ${selectedLocation}`);
  };
  
  // Handle event type selection
  const handleEventTypeChange = (selectedValue) => {
    console.log('🔍 Event type selection:', selectedValue);
    setEventType(selectedValue);
    const displayName = eventTypeDisplayNames[selectedValue] || selectedValue;
    setMessage(`Event type set to: ${displayName}`);
  };
  
  // Placeholder functions for settings panel
  const handleReloadCodes = () => {
    console.log('🔄 Reloading system codes...');
    setMessage('System codes reloaded');
  };

  const handleShowScheduledEvents = () => {
    console.log('📅 Showing scheduled events...');
    setMessage('Showing scheduled events');
  };

  const forceRefreshEvents = () => {
    console.log('🔄 Force refreshing events...');
    setMessage('Events refreshed');
  };

  const handleEventSelection = (event) => {
    console.log('📅 Event selected:', event);
    setSelectedEvent(event);
  };
  
  // Close settings panel
  const handleSettingsClose = () => {
    console.log('🔍 Settings close');
    setSettingsVisible(false);
    
    setTimeout(() => {
      const currentLocation = currentStateRef.current.location;
      const currentEventType = currentStateRef.current.eventType;
      const currentMode = currentStateRef.current.mode;
      
      if (!currentLocation) {
        setMessage('Please select a location before scanning');
      } else if (currentMode === 'clock-in' && !currentEventType) {
        setMessage('Please select an event type for clock-in');
      } else {
        const modeText = currentMode === 'clock-in' ? 'Clock In' : 'Clock Out';
        const eventText = currentMode === 'clock-in' && currentEventType 
          ? ` with event type: ${eventTypeDisplayNames[currentEventType] || currentEventType}` 
          : '';
        setMessage(`Ready to ${modeText} at location: ${currentLocation}${eventText}`);
      }
    }, 100);
  };

  // Helper function to check if user has scheduled events for a given date
  const checkUserHasScheduledEventsToday = (userData, dateStr) => {
    if (!userData || !dateStr) return false;
    
    // Check user's events structure
    if (userData.events) {
      const eventTypes = ['workshops', 'meetings', 'haciendas', 'juntaHacienda', 'gestion', 'generalmeeting'];
      
      for (const eventType of eventTypes) {
        if (userData.events[eventType]) {
          const events = userData.events[eventType];
          
          for (const [, eventData] of Object.entries(events)) {
            if (eventData && eventData.scheduled) {
              // Check if event is for today
              if (eventData.date) {
                const eventDate = moment(eventData.date).tz('America/Chicago').format('YYYY-MM-DD');
                if (eventDate === dateStr) {
                  return true;
                }
              }
              
              // Check for multi-day events (like haciendas)
              if (eventData.endDate) {
                const startDate = moment(eventData.date).tz('America/Chicago');
                const endDate = moment(eventData.endDate).tz('America/Chicago');
                const checkDate = moment(dateStr).tz('America/Chicago');
                
                if (checkDate.isBetween(startDate, endDate, 'day', '[]')) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    
    // Check user's statistics for assigned events on this specific date
    if (userData.statistics) {
      for (const [eventId, statEntry] of Object.entries(userData.statistics)) {
        if (statEntry && statEntry.date === dateStr && statEntry.status === 'assigned') {
          console.log(`🔍 User has assigned event for ${dateStr}: ${eventId}`);
          return true;
        }
      }
    }
    
    // FIXED: Remove the problematic schedule check that was always returning true
    // The schedule object should be checked more carefully with actual event data
    // For now, we only check events and statistics which have proper date information
    
    return false;
  };

  // Helper function to check if user is late based on their scheduled events
  const checkLateBasedOnUserEvents = (userData, dateStr, clockInMoment) => {
    if (!userData || !dateStr || !clockInMoment) return false;
    
    let earliestEventTime = null;
    
    // Check user's personal events for scheduled times
    if (userData.events) {
      const eventTypes = ['workshops', 'meetings', 'haciendas', 'juntaHacienda', 'gestion', 'generalmeeting'];
      
      for (const eventType of eventTypes) {
        if (userData.events[eventType]) {
          const events = userData.events[eventType];
          
          for (const [eventId, eventData] of Object.entries(events)) {
            if (eventData && eventData.scheduled) {
              // Check if event is for today
              if (eventData.date) {
                const eventDate = moment(eventData.date).tz('America/Chicago').format('YYYY-MM-DD');
                if (eventDate === dateStr) {
                  
                  // FIXED: Check if the event has a specific time component
                  let eventTime = null;
                  
                  // Check if eventData has a specific start time
                  if (eventData.start) {
                    eventTime = moment(eventData.start).tz('America/Chicago');
                  } else if (eventData.time) {
                    // If there's a time field, combine it with the date
                    eventTime = moment.tz(`${dateStr} ${eventData.time}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
                  } else if (eventData.startTime) {
                    // If there's a startTime field, combine it with the date
                    eventTime = moment.tz(`${dateStr} ${eventData.startTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
                  } else {
                    // If only date is available, check if it contains time info
                    const dateTime = moment(eventData.date).tz('America/Chicago');
                    const timeComponent = dateTime.format('HH:mm');
                    
                    // Skip events that default to midnight (00:00) as they likely don't have real time info
                    if (timeComponent === '00:00') {
                      console.log(`🔍 Skipping event ${eventId} - no specific time (defaults to midnight)`);
                      continue;
                    }
                    
                    eventTime = dateTime;
                  }
                  
                  // Only use events with meaningful times (not midnight unless explicitly set)
                  if (eventTime && eventTime.isValid()) {
                    const timeComponent = eventTime.format('HH:mm');
                    if (timeComponent !== '00:00' || eventData.allDay === false) {
                      if (!earliestEventTime || eventTime.isBefore(earliestEventTime)) {
                        earliestEventTime = eventTime;
                        console.log(`🔍 Found valid scheduled event at ${eventTime.format('HH:mm')} for event ${eventId}`);
                      }
                    } else {
                      console.log(`🔍 Skipping event ${eventId} at midnight - likely missing time component`);
                    }
                  }
                }
              }
              
              // Check for multi-day events (like haciendas) - but only if they have meaningful times
              if (eventData.endDate) {
                const startDate = moment(eventData.date).tz('America/Chicago');
                const endDate = moment(eventData.endDate).tz('America/Chicago');
                const checkDate = moment(dateStr).tz('America/Chicago');
                
                if (checkDate.isBetween(startDate, endDate, 'day', '[]')) {
                  // For multi-day events, check if start has a meaningful time
                  const timeComponent = startDate.format('HH:mm');
                  if (timeComponent !== '00:00' || eventData.allDay === false) {
                    if (!earliestEventTime || startDate.isBefore(earliestEventTime)) {
                      earliestEventTime = startDate;
                      console.log(`🔍 Found valid multi-day event at ${startDate.format('HH:mm')}`);
                    }
                  } else {
                    console.log(`🔍 Skipping multi-day event at midnight - likely missing time component`);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Check statistics for assigned events
    if (userData.statistics) {
      for (const [, statEntry] of Object.entries(userData.statistics)) {
        if (statEntry && statEntry.date === dateStr && statEntry.status === 'assigned') {
          // If we have event data with scheduled time, use it
          if (statEntry.eventTime) {
            const eventTime = moment.tz(`${dateStr} ${statEntry.eventTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
            if (eventTime.isValid()) {
              if (!earliestEventTime || eventTime.isBefore(earliestEventTime)) {
                earliestEventTime = eventTime;
                console.log(`🔍 Found valid statistics event at ${eventTime.format('HH:mm')}`);
              }
            }
          } else if (statEntry.startTime) {
            const eventTime = moment.tz(`${dateStr} ${statEntry.startTime}`, 'YYYY-MM-DD HH:mm', 'America/Chicago');
            if (eventTime.isValid()) {
              if (!earliestEventTime || eventTime.isBefore(earliestEventTime)) {
                earliestEventTime = eventTime;
                console.log(`🔍 Found valid statistics event with startTime at ${eventTime.format('HH:mm')}`);
              }
            }
          }
        }
      }
    }
    
    // If we found scheduled events with specific times, compare clock-in time to earliest event time
    if (earliestEventTime) {
      const isLate = clockInMoment.isAfter(earliestEventTime);
      console.log(`🔍 Comparing clock-in ${clockInMoment.format('HH:mm')} to earliest event ${earliestEventTime.format('HH:mm')}: ${isLate ? 'LATE' : 'ON TIME'}`);
      return isLate;
    }
    
    // No scheduled events with specific times found, default to not late
    console.log(`🔍 No scheduled events with specific times found for ${dateStr}, marking as on time`);
    return false;
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 bg-opacity-75 backdrop-blur-xl p-8">
      <header className="text-4xl text-white text-center font-bold mb-8">
        QR Code Scanner
      </header>

      <div className="fixed top-8 right-8">
        <button
          onClick={() => setSettingsVisible(!settingsVisible)}
          className="text-white hover:rotate-90 transition-transform duration-300"
        >
          {settingsVisible ? <X size={24} /> : <Settings size={24} />}
        </button>
      </div>

      {settingsVisible && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl font-semibold">Scanner Settings</h3>
              <button
                onClick={() => setSettingsVisible(false)}
                className="text-white hover:bg-slate-700 p-1 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <SettingsPanel
              location={location}
              setLocation={handleLocationChange}
              locations={locations}
              eventType={eventType}
              eventTypes={eventTypes}
              eventTypeDisplayNames={eventTypeDisplayNames}
              handleEventTypeChange={handleEventTypeChange}
              meetingTypes={meetingTypes}
              selectedMeeting={selectedMeeting}
              setSelectedMeeting={setSelectedMeetting}
              scheduledEvents={scheduledEvents}
              selectedEvent={selectedEvent}
              handleEventSelection={handleEventSelection}
              mode={mode}
              handleModeSwitch={handleModeSwitch}
              handleReloadCodes={handleReloadCodes}
              handleShowScheduledEvents={handleShowScheduledEvents}
              forceRefreshEvents={forceRefreshEvents}
            />
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSettingsClose}
                className="flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Apply Settings
              </button>
              <button
                onClick={() => setSettingsVisible(false)}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {!location && (
        <div className="bg-amber-600 bg-opacity-20 border border-amber-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-500">
              Please select a location in Settings before scanning
            </span>
          </div>
        </div>
      )}

      {!eventType && location && mode === 'clock-in' && (
        <div className="bg-amber-600 bg-opacity-20 border border-amber-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-500">
              Please select an event type in Settings for clock-in
            </span>
          </div>
        </div>
      )}

      <Scanner 
        onScan={handleScan} 
        location={location} 
        eventType={eventType}
        mode={mode}
        isProcessing={isProcessing} 
      />

      <div className="max-w-lg mx-auto mb-6 flex flex-col gap-3">
        {/* Mode and Settings Display */}
        {location && (mode === 'clock-out' || (mode === 'clock-in' && eventType)) && (
          <div className="p-4 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg flex flex-col">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${
                mode === 'clock-in' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {mode === 'clock-in' ? <LogIn size={14} /> : <LogOut size={14} />}
                {mode === 'clock-in' ? 'Clock In Mode' : 'Clock Out Mode'}
              </span>
              <span className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white">
                {location}
              </span>
              {mode === 'clock-in' && eventType && (
                <span className="px-3 py-1 rounded-lg text-sm bg-orange-600 text-white">
                  {eventTypeDisplayNames[eventType] || eventType}
                </span>
              )}
            </div>
            <div className="text-center text-white text-opacity-70 text-sm">
              Scan QR code or ID to {mode === 'clock-in' ? 'clock in' : 'clock out'}
            </div>
          </div>
        )}
        
        <button
          onClick={() => setSettingsVisible(true)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white flex items-center justify-center gap-2 transition"
        >
          <Settings size={18} />
          {location && (mode === 'clock-out' || (mode === 'clock-in' && eventType)) ? 'Change Settings' : 'Configure Scanner'}
        </button>
        
        <button
          onClick={() => {
            if (user?.role === 'super_admin' || user?.role === 'SUPER_ADMIN') {
              navigate('/super-admin');
            } else if (user?.role === 'admin' || user?.role === 'ADMIN') {
              navigate('/location-admin');
            } else {
              navigate('/dashboard');
            }
          }}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition"
        >
          <ExternalLink size={18} />
          View Dashboard
        </button>
        
        {/* Debug button - remove after testing */}
        <button
          onClick={debugTimezone}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center justify-center gap-2 transition text-sm"
        >
          🐛 Debug Timezone
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`${
          message.includes('Success') || message.includes('Ready to') || message.includes('clocked out')
            ? 'bg-green-500 bg-opacity-20 border-green-500' 
            : message.includes('Error') || message.includes('Failed')
              ? 'bg-red-500 bg-opacity-20 border-red-500'
              : 'bg-white bg-opacity-10 border-white border-opacity-20'
        } border rounded-lg p-4 mb-4 text-white max-w-lg mx-auto text-center`}>
          {(message.includes('Success') || message.includes('clocked out')) && <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />}
          {message.includes('Error') && <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />}
          {message}
        </div>
      )}

      {/* Employee Info Display */}
      {employeeInfo && (
        <div className={`${
          employeeInfo.mode === 'clock-in' 
            ? 'bg-green-600 bg-opacity-20 border-green-500' 
            : 'bg-blue-600 bg-opacity-20 border-blue-500'
        } border rounded-lg p-4 mb-4 max-w-lg mx-auto`}>
          <div className="text-center">
            {employeeInfo.mode === 'clock-in' ? (
              <LogIn className="w-8 h-8 text-green-400 mx-auto mb-2" />
            ) : (
              <LogOut className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            )}
            <h3 className="text-white text-lg font-semibold">
              {typeof employeeInfo.name === 'object' ? 'User' : employeeInfo.name}
            </h3>
            <p className="text-white text-opacity-70">
              {employeeInfo.profile?.position || employeeInfo.position || 'Member'}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-white text-opacity-70 text-sm">
                Location: {location}
              </p>
              {employeeInfo.mode === 'clock-in' && (
                <>
                  <p className="text-white text-opacity-70 text-sm">
                    Event: {employeeInfo.selectedEventDisplayName || 'General'}
                  </p>
                  <p className="text-white text-opacity-70 text-sm">
                    Clock In Time: {employeeInfo.clockInTime}
                  </p>
                  {employeeInfo.isLate && (
                    <p className="text-red-400 text-sm font-semibold">
                      Late Arrival
                    </p>
                  )}
                </>
              )}
              {employeeInfo.mode === 'clock-out' && (
                <>
                  <p className="text-white text-opacity-70 text-sm">
                    Clock Out Time: {employeeInfo.clockOutTime}
                  </p>
                  <p className="text-white text-opacity-70 text-sm">
                    Hours Worked: {employeeInfo.hoursWorked}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;
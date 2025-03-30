import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  X,
  Calendar,
  Clock,
  CheckCircle,
  Users,
  ChevronRight
} from 'lucide-react';
import {
  ref,
  set,
  get,
  update,
  remove,
  // query, orderByChild, equalTo,  <-- If you're not using them, feel free to remove
} from 'firebase/database';
import { database } from '../services/firebaseConfig';
import Scanner from './Scanner';
import moment from 'moment-timezone';

import {
  EVENT_TYPES,
  EVENT_TYPE_DISPLAY_NAMES,
  EVENT_TYPE_TO_CATEGORY_MAP,
  LOCATIONS,
  normalizeEventType,
  getChicagoTime,
  isEventToday,
  isTodayInDateRange,
  formatChicagoDate
} from '../utils/eventUtils';

const QRScannerPage = () => {
  // Basic state
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [mode, setMode] = useState('clock-in');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Event tracking state
  // Use a plural key (e.g. EVENT_TYPES.HACIENDAS) as the default
  const [eventType, setEventType] = useState(EVENT_TYPES.HACIENDAS);
  const [selectedMeeting, setSelectedMeeting] = useState('');
  const [scheduledEvents, setScheduledEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [attendanceUpdated, setAttendanceUpdated] = useState(false);

  // User events state
  const [userEvents, setUserEvents] = useState({
    [EVENT_TYPES.WORKSHOPS]: [],
    [EVENT_TYPES.MEETINGS]: [],
    [EVENT_TYPES.HACIENDAS]: [],
    [EVENT_TYPES.JUNTA_HACIENDA]: [],
    [EVENT_TYPES.GESTION]: []
  });
  const [pendingEvents, setPendingEvents] = useState([]);
  const [showUserEvents, setShowUserEvents] = useState(false);
  const [allLocationsEvents, setAllLocationsEvents] = useState([]);

  const modeRef = useRef(mode);

  // Possible meeting subtypes
  const meetingTypes = [
    'PADRINOS Y OREJAS',
    'GENERAL',
    'INICIANDO EL CAMINO',
    'CIRCULO DE RECUPERACION',
    'TRIBUNA',
    'SEGUIMIENTO',
    'CIRCULO DE ESTUDIO',
    'NOCHE DE GUERRO'
  ];

  const normalizeLocationForComparison = (locationStr) =>
    locationStr ? locationStr.toLowerCase().trim() : '';

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  Fetching & Processing User Events
  // ─────────────────────────────────────────────────────────────────────────────

  // Function to fetch user's pending events
  const fetchUserEvents = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);

      if (!userSnapshot.exists()) return;

      const userData = userSnapshot.val();
      if (!userData.events) return;

      // Process each event type
      const processedEvents = {};
      let pendingEventsArr = [];

      for (const [eventCategory, eventsOfType] of Object.entries(
        userData.events
      )) {
        // Skip if not a recognized category
        if (
          !eventsOfType ||
          typeof eventsOfType !== 'object' ||
          !Object.values(EVENT_TYPES).includes(eventCategory)
        ) {
          continue;
        }

        // Convert object to array with IDs included
        const eventsArray = Object.entries(eventsOfType).map(([id, eData]) => ({
          ...eData,
          id,
          userId,
          eventType: eventCategory
        }));

        // Store in processed events
        processedEvents[eventCategory] = eventsArray;

        // Add pending events (scheduled but not attended) to the pending list
        const pendingForType = eventsArray.filter(
          (e) => e.scheduled && !e.attended && !e.markedAbsent
        );

        pendingEventsArr = [...pendingEventsArr, ...pendingForType];
      }

      // Update state with processed events
      setUserEvents(processedEvents);

      // Sort pending events by date
      pendingEventsArr.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA - dateB;
      });

      setPendingEvents(pendingEventsArr);

      // If we have pending events, show the user events panel
      if (pendingEventsArr.length > 0) {
        setShowUserEvents(true);
      }

      // Also fetch events from all locations for this user
      fetchAllLocationsEvents(userId);

      return { processedEvents, pendingEvents: pendingEventsArr };
    } catch (error) {
      console.error('Error fetching user events:', error);
      setErrors((prev) => [...prev, `Failed to load user events: ${error.message}`]);
      return null;
    }
  }, []);

  // Function to fetch events from all locations for a user
  const fetchAllLocationsEvents = async (userId) => {
    if (!userId) return;

    try {
      const allLocs = LOCATIONS.map((loc) => normalizeLocationForComparison(loc));
      const today = getChicagoTime().format('YYYY-MM-DD');
      const allLocationEvents = [];

      // Search through all known locations
      for (const loc of allLocs) {
        // Regular events
        const attendancePath = `attendance/${loc}/${today}`;
        const attendanceRefDB = ref(database, attendancePath);
        const attendanceSnapshot = await get(attendanceRefDB);

        if (attendanceSnapshot.exists()) {
          const records = attendanceSnapshot.val();
          for (const key in records) {
            const record = records[key];
            if (record.userId === userId) {
              allLocationEvents.push({
                ...record,
                id: key,
                location: loc,
                source: attendancePath
              });
            }
          }
        }

        // Meeting events
        for (const mType of meetingTypes) {
          const meetingPath = `attendance/${loc}/meetings/${mType}/${today}`;
          const meetingRefDB = ref(database, meetingPath);
          const meetingSnapshot = await get(meetingRefDB);

          if (meetingSnapshot.exists()) {
            const records = meetingSnapshot.val();
            for (const key in records) {
              const record = records[key];
              if (record.userId === userId) {
                allLocationEvents.push({
                  ...record,
                  id: key,
                  location: loc,
                  meetingType: mType,
                  source: meetingPath
                });
              }
            }
          }
        }
      }

      setAllLocationsEvents(allLocationEvents);
      return allLocationEvents;
    } catch (error) {
      console.error('Error fetching events from all locations:', error);
      return [];
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Fetch Scheduled Events (global "events" node)
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchScheduledEvents();
  }, [location]);

  const fetchScheduledEvents = async () => {
    try {
      const today = getChicagoTime().format('YYYY-MM-DD');
      const eventsRefDB = ref(database, 'events');
      const eventsSnapshot = await get(eventsRefDB);

      if (!eventsSnapshot.exists()) {
        setScheduledEvents([]);
        return;
      }

      const events = [];

      // Filter events manually
      eventsSnapshot.forEach((childSnapshot) => {
        const eventData = childSnapshot.val();
        const eventLocation = normalizeLocationForComparison(eventData.location);

        // If no location is selected, include everything; otherwise filter by location
        if (!location || eventLocation === normalizeLocationForComparison(location)) {
          // Compare dates in Chicago time
          const eventDate = moment(eventData.start).tz('America/Chicago');
          const eventDateStr = eventDate.format('YYYY-MM-DD');

          // Include events for today
          if (eventDateStr === today) {
            events.push({
              id: childSnapshot.key,
              ...eventData,
              start: new Date(eventData.start),
              end: eventData.end ? new Date(eventData.end) : null
            });
          }
          // Special check for multi-day Haciendas (weekend retreats):
          else if (
            eventData.eventType === EVENT_TYPES.HACIENDAS ||
            normalizeEventType(eventData.eventType) === EVENT_TYPES.HACIENDAS
          ) {
            const startDate = moment(eventData.start).tz('America/Chicago');
            const endDate = eventData.end
              ? moment(eventData.end).tz('America/Chicago')
              : startDate;
            const todayDate = moment.tz(today, 'America/Chicago');

            if (todayDate.isBetween(startDate, endDate, 'day', '[]')) {
              events.push({
                id: childSnapshot.key,
                ...eventData,
                start: new Date(eventData.start),
                end: eventData.end ? new Date(eventData.end) : null
              });
            }
          }
        }
      });

      // Sort by start time
      events.sort((a, b) => a.start - b.start);
      setScheduledEvents(events);

      // If only one event, auto-select it
      if (events.length === 1) {
        const single = events[0];
        setSelectedEvent(single);

        // If the event's type is recognized, use that
        const mappedEventType =
          single.eventType && EVENT_TYPE_TO_CATEGORY_MAP[single.eventType]
            ? single.eventType
            : EVENT_TYPES.HACIENDAS;

        setEventType(mappedEventType);

        if (mappedEventType === EVENT_TYPES.MEETINGS && single.meetingType) {
          setSelectedMeeting(single.meetingType);
        }
      } else if (events.length > 1) {
        setShowEventSelector(true);
      }
    } catch (error) {
      console.error('Error fetching scheduled events:', error);
      setErrors((prev) => [...prev, `Failed to load scheduled events: ${error.message}`]);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Updating User Location & Event Attendance
  // ─────────────────────────────────────────────────────────────────────────────

  const updateUserLocation = async (userId, userData, normalizedLocation) => {
    const userRefDB = ref(database, `users/${userId}`);
    const now = getChicagoTime().toISOString();

    const locationHistory = userData.locationHistory || [];
    locationHistory.unshift({
      locationId: normalizedLocation,
      date: now,
      changedBy: 'system'
    });

    await update(userRefDB, {
      location: normalizedLocation,
      locationHistory: locationHistory.slice(0, 10)
    });
  };

  const updateEventAttendance = async (userId, userData, eventId, eventTypeCategory) => {
    try {
      if (!eventId || !eventTypeCategory) return false;

      const now = getChicagoTime().toISOString();
      const eventRefDB = ref(database, `users/${userId}/events/${eventTypeCategory}/${eventId}`);
      const eventSnapshot = await get(eventRefDB);

      if (!eventSnapshot.exists()) {
        // Create event entry
        await set(eventRefDB, {
          date: now,
          attended: true,
          attendedAt: now,
          scheduled: true
        });
      } else {
        // Update existing
        await update(eventRefDB, {
          attended: true,
          attendedAt: now,
          scheduled: true
        });
      }

      // Also update participants list in the global "events" node
      const eventParticipantsRef = ref(database, `events/${eventId}/participants/${userId}`);
      await set(eventParticipantsRef, true);

      return true;
    } catch (error) {
      console.error('Error updating event attendance:', error);
      return false;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Handling UI Steps for Pending Events & Location
  // ─────────────────────────────────────────────────────────────────────────────

  const handleLocationSelected = async () => {
    if (!location) {
      setMessage('Please select a location first');
      return;
    }

    // If we were waiting on a location to clock into a pending event
    if (employeeInfo?.pendingEvent) {
      await handlePendingEventClockIn(employeeInfo.pendingEvent);
    }
    // Otherwise, just re-process the scan with the chosen location
    else if (employeeInfo?.userId) {
      await handleScan(employeeInfo.userId);
    }
  };

  const handlePendingEventClockIn = async (event) => {
    let usedLocation = location;

    // If no location selected, attempt to use event location
    if (!usedLocation) {
      if (event.location) {
        usedLocation = event.location;
        setLocation(usedLocation);
      } else {
        // Show location selector
        setEmployeeInfo({
          name: event.title || 'Event Check-in',
          userId: event.userId,
          needsLocation: true,
          pendingEvent: event
        });
        setMessage('Please select a location for check-in');
        return;
      }
    }

    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const userRefDB = ref(database, `users/${event.userId}`);
      const userSnapshot = await get(userRefDB);
      if (!userSnapshot.exists()) {
        throw new Error('User data not found');
      }

      const userData = userSnapshot.val();
      const now = getChicagoTime();
      const attendanceDate = now.format('YYYY-MM-DD');
      const normalizedLocation = usedLocation.toLowerCase().trim();

      if (!normalizedLocation) {
        throw new Error('Location is required for attendance');
      }

      const clockInTimestamp = Date.now();
      const eventCategory = event.eventType;
      let attendancePath = '';

      // Meetings store is different
      if (eventCategory === EVENT_TYPES.MEETINGS) {
        attendancePath = `attendance/${normalizedLocation}/meetings/${
          event.meetingType || 'GENERAL'
        }/${attendanceDate}/${clockInTimestamp}`;
      } else {
        attendancePath = `attendance/${normalizedLocation}/${attendanceDate}/${clockInTimestamp}`;
      }

      // Create attendance record
      await set(ref(database, attendancePath), {
        clockInTime: now.toISOString(),
        clockInTimestamp,
        name: userData.name || 'Unknown Employee',
        position: userData.position || userData.profile?.position || 'Member',
        userId: event.userId,
        location: normalizedLocation,
        eventType: eventCategory,
        eventId: event.id,
        eventTitle: event.title || 'Event',
        attended: true,
        attendedAt: now.toISOString()
      });

      // Update event as attended
      await update(
        ref(database, `users/${event.userId}/events/${eventCategory}/${event.id}`),
        {
          attended: true,
          attendedAt: now.toISOString()
        }
      );

      // If this event is associated with a global event node
      if (event.eventId) {
        await update(ref(database, `events/${event.eventId}/participants/${event.userId}`), {
          attended: true,
          attendedAt: now.toISOString()
        });
      }

      // Refresh user events
      await fetchUserEvents(event.userId);

      setMessage(`Attendance recorded for ${event.title || 'event'}`);
      setAttendanceUpdated(true);
    } catch (error) {
      console.error('Error recording attendance:', error);
      setErrors((prev) => [
        ...prev,
        `Failed to record attendance: ${error.message}`
      ]);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Handling the Actual QR/Barcode Scan
  // ─────────────────────────────────────────────────────────────────────────────

  const handleScan = async (scannedCode) => {
    if (isProcessing || !scannedCode) {
      setMessage(!scannedCode ? 'No code detected' : 'Processing in progress...');
      return;
    }

    setIsProcessing(true);
    setAttendanceUpdated(false);

    try {
      const employeeId = scannedCode.trim();
      const now = getChicagoTime();
      const attendanceDate = now.format('YYYY-MM-DD');

      const userRefDB = ref(database, `users/${employeeId}`);
      const userSnapshot = await get(userRefDB);

      if (!userSnapshot.exists()) {
        throw new Error(`Employee ID not found: ${employeeId}`);
      }

      const userData = userSnapshot.val();

      // Ensure user has a name at root level
      let employeeName = userData.name;
      if (!employeeName && userData.profile?.name) {
        employeeName = userData.profile.name;
        await update(userRefDB, { name: employeeName });
      } else if (!employeeName) {
        // Fallback
        employeeName = `Employee ${employeeId.substring(0, 6)}`;
        await update(userRefDB, { name: employeeName });
      }
      userData.name = employeeName;

      // Auto-activate user if not active
      if (!userData.status || userData.status !== 'active') {
        await update(userRefDB, { status: 'active' });
        userData.status = 'active';
      }

      // If no location is selected, ask for it
      if (!location) {
        setEmployeeInfo({
          name: userData.name,
          photo: userData.photo || '',
          position: userData.position || 'Member',
          userId: employeeId,
          needsLocation: true
        });
        setMessage('Please select a location to record attendance');
        setIsProcessing(false);
        return;
      }

      // Normalized location
      const normalizedLocation = location.toLowerCase().trim();
      const operationTimestamp = Date.now();

      // Determine path for attendance
      const isMeeting = eventType === EVENT_TYPES.MEETINGS;
      let attendanceRefDB = null;

      if (isMeeting) {
        attendanceRefDB = ref(
          database,
          `attendance/${normalizedLocation}/meetings/${selectedMeeting || 'GENERAL'}/${attendanceDate}/${operationTimestamp}`
        );
      } else {
        attendanceRefDB = ref(
          database,
          `attendance/${normalizedLocation}/${attendanceDate}/${operationTimestamp}`
        );
      }

      // Update user’s location
      await updateUserLocation(employeeId, userData, normalizedLocation);

      // Determine final event category (which is the same as `eventType` if we’re using the plural keys)
      let eventCategory = eventType;
      let targetEventId = selectedEvent?.id;

      // If we have a pre-selected event, override
      if (selectedEvent) {
        const mappedCategory = selectedEvent.eventType;
        eventCategory = mappedCategory || EVENT_TYPES.HACIENDAS;
        targetEventId = selectedEvent.id;
      }

      // Clock-in vs clock-out
      if (modeRef.current === 'clock-in') {
        await handleClockIn(
          userData,
          employeeId,
          attendanceRefDB,
          now.toISOString(),
          normalizedLocation
        );

        // If we had a specific event selected, mark as attended
        if (targetEventId) {
          const attended = await updateEventAttendance(
            employeeId,
            userData,
            targetEventId,
            eventCategory
          );
          setAttendanceUpdated(attended);
        }
      } else {
        await handleClockOut(
          userData,
          employeeId,
          attendanceRefDB,
          now.toISOString()
        );
      }

      // Finally, reload user events
      await fetchUserEvents(employeeId);
    } catch (error) {
      console.error('Operation error:', error);
      setErrors((prev) => [...prev, error.message]);
      setMessage(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Clock-In & Clock-Out Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleClockIn = async (
    userData,
    employeeId,
    attendanceRefDB,
    now,
    normalizedLocation
  ) => {
    try {
      // Validate the time
      let validatedNow = now;
      if (!moment(now).isValid()) {
        validatedNow = moment().tz('America/Chicago').toISOString();
      }

      const clockInTimestamp = Date.now();
      // Path to store the record (avoid collisions by including timestamp)
      const attendanceRecordPath = `${attendanceRefDB
        .toString()
        .split('attendance/')[1]}/${clockInTimestamp}`;
      const uniqueAttendanceRef = ref(database, `attendance/${attendanceRecordPath}`);

      // Also store in user's "clockInTimes" for day-by-day usage
      const clockInTimeRef = ref(
        database,
        `users/${employeeId}/clockInTimes/${clockInTimestamp}`
      );

      // Time portion for clockInTimes
      const nowDate = new Date(validatedNow);
      const timeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(
        nowDate.getMinutes()
      ).padStart(2, '0')}`;

      // Build the new attendance record
      const attendanceData = {
        clockInTime: validatedNow,
        clockInTimestamp,
        name: userData.name || 'Unknown Employee',
        position: userData.position || userData.profile?.position || 'Member',
        userId: employeeId,
        location: normalizedLocation,
        eventType, // The global state eventType (plural)
        ...(eventType === EVENT_TYPES.MEETINGS && selectedMeeting
          ? { meetingType: selectedMeeting }
          : {}),
        ...(selectedEvent
          ? {
              eventId: selectedEvent.id,
              eventTitle: selectedEvent.title || 'Unnamed Event'
            }
          : {})
      };

      // Perform multiple updates
      const updates = {};

      // 1) The main attendance record
      updates[
        uniqueAttendanceRef.toString().replace(database.app.options.databaseURL, '')
      ] = attendanceData;

      // 2) The clockInTimes for the user
      updates[`users/${employeeId}/clockInTimes/${clockInTimestamp}`] = timeStr;

      // Ensure stats exist
      if (!userData.stats) {
        updates[`users/${employeeId}/stats`] = {
          daysPresent: 1,
          daysAbsent: 0,
          daysLate: 0,
          totalHours: 0,
          onTimeRate: 100,
          attendanceRate: 100
        };
      } else {
        const currentDaysPresent = userData.stats.daysPresent || 0;
        updates[`users/${employeeId}/stats/daysPresent`] = currentDaysPresent + 1;

        // Recalculate attendance rate
        const daysAbsent = userData.stats.daysAbsent || 0;
        const totalDays = currentDaysPresent + 1 + daysAbsent;
        const attendanceRate = totalDays > 0 ? ((currentDaysPresent + 1) / totalDays) * 100 : 100;
        updates[`users/${employeeId}/stats/attendanceRate`] = attendanceRate;

        // Check for tardiness (after 9:15am)
        const cTime = new Date(validatedNow);
        const hours = cTime.getHours();
        const minutes = cTime.getMinutes();
        const isLate = hours > 9 || (hours === 9 && minutes > 15);

        if (isLate) {
          const currentDaysLate = userData.stats.daysLate || 0;
          updates[`users/${employeeId}/stats/daysLate`] = currentDaysLate + 1;

          // On-Time Rate
          const newDaysLate = currentDaysLate + 1;
          const newOnTimeRate =
            (currentDaysPresent + 1 - newDaysLate) / (currentDaysPresent + 1) * 100;
          updates[`users/${employeeId}/stats/onTimeRate`] = newOnTimeRate;
        }
      }

      // Commit all updates
      await update(ref(database), updates);

      // Process scheduled events
      await processScheduledEvents(employeeId, userData);

      setEmployeeInfo({
        name: userData.name,
        photo: userData.photo || '',
        position: userData.position || (userData.profile?.position || 'Member'),
        clockInTime: moment(validatedNow).format('MMMM D, YYYY h:mm:ss A'),
        eventTitle: selectedEvent?.title,
        userId: employeeId
      });
      setMessage(`Welcome ${userData.name}! Clock-in successful`);
    } catch (error) {
      console.error('Error during clock-in:', error);
      throw error;
    }
  };

  const handleClockOut = async (userData, employeeId, attendanceRefDB, now) => {
    try {
      let validatedNow = now;
      if (!moment(now).isValid()) {
        validatedNow = moment().tz('America/Chicago').toISOString();
      }

      const currentDate = getChicagoTime().format('YYYY-MM-DD');
      console.log(`Searching for open clock-in for ${userData.name} on ${currentDate}`);

      // 1) Check user's clockInTimes for an open clock-in (without matching clockOutTimes)
      const clockInRefDB = ref(database, `users/${employeeId}/clockInTimes`);
      const clockOutRefDB = ref(database, `users/${employeeId}/clockOutTimes`);
      const [clockInSnapshot, clockOutSnapshot] = await Promise.all([
        get(clockInRefDB),
        get(clockOutRefDB)
      ]);

      const clockInTimes = clockInSnapshot.exists() ? clockInSnapshot.val() : {};
      const clockOutTimes = clockOutSnapshot.exists() ? clockOutSnapshot.val() : {};

      let latestClockInTimestamp = null;
      let latestClockInTime = null;

      for (const timestamp in clockInTimes) {
        const hasClockOut = clockOutTimes && clockOutTimes[timestamp];
        if (!hasClockOut) {
          const dateObj = new Date(parseInt(timestamp));
          if (!isNaN(dateObj.getTime())) {
            const dateStr = dateObj.toISOString().split('T')[0];
            const yday = getChicagoTime().subtract(1, 'day').format('YYYY-MM-DD');

            if (dateStr === currentDate || dateStr === yday) {
              if (
                !latestClockInTimestamp ||
                parseInt(timestamp) > parseInt(latestClockInTimestamp)
              ) {
                latestClockInTimestamp = timestamp;
                latestClockInTime = clockInTimes[timestamp];
              }
            }
          }
        }
      }

      // 2) If we still haven't found an open record, look in the attendance nodes
      let attendanceNodeRef = null;
      let attendanceNodeRecord = null;

      if (!latestClockInTimestamp) {
        const normalizedLocation = location ? location.toLowerCase().trim() : '';
        if (normalizedLocation) {
          // If eventType is "meetings" => path with /meetings/ else normal
          const dayPath =
            eventType === EVENT_TYPES.MEETINGS
              ? `attendance/${normalizedLocation}/meetings/${selectedMeeting || 'GENERAL'}/${currentDate}`
              : `attendance/${normalizedLocation}/${currentDate}`;

          const attendanceDayRefDB = ref(database, dayPath);
          const attendanceDaySnapshot = await get(attendanceDayRefDB);

          if (attendanceDaySnapshot.exists()) {
            const records = attendanceDaySnapshot.val();
            for (const key in records) {
              const record = records[key];
              if (record.userId === employeeId && record.clockInTime && !record.clockOutTime) {
                if (
                  !attendanceNodeRecord ||
                  new Date(record.clockInTime) > new Date(attendanceNodeRecord.clockInTime)
                ) {
                  attendanceNodeRecord = record;
                  attendanceNodeRef = ref(database, `${dayPath}/${key}`);
                  latestClockInTimestamp = record.clockInTimestamp || parseInt(key);
                  latestClockInTime = new Date(record.clockInTime).toISOString();
                }
              }
            }
          }
        }

        // Always search all locations for possible missed clock-ins
        const yday = getChicagoTime().subtract(1, 'day').format('YYYY-MM-DD');
        const datesToCheck = [currentDate, yday];

        const allLocationsRefDB = ref(database, 'attendance');
        const allLocationsSnapshot = await get(allLocationsRefDB);
        if (allLocationsSnapshot.exists()) {
          const allLocs = allLocationsSnapshot.val();

          for (const loc in allLocs) {
            for (const dateToCheck of datesToCheck) {
              // Check normal attendance
              const locationDayPath = `attendance/${loc}/${dateToCheck}`;
              const locationDayRefDB = ref(database, locationDayPath);
              const locDaySnap = await get(locationDayRefDB);
              if (locDaySnap.exists()) {
                const records = locDaySnap.val();
                for (const key in records) {
                  const record = records[key];
                  if (record.userId === employeeId && record.clockInTime && !record.clockOutTime) {
                    const recTime = new Date(record.clockInTime);
                    if (!isNaN(recTime.getTime())) {
                      if (
                        !attendanceNodeRecord ||
                        recTime > new Date(attendanceNodeRecord.clockInTime)
                      ) {
                        attendanceNodeRecord = record;
                        attendanceNodeRef = ref(database, `${locationDayPath}/${key}`);
                        latestClockInTimestamp = record.clockInTimestamp || parseInt(key);
                        latestClockInTime = recTime.toISOString();
                      }
                    }
                  }
                }
              }

              // Check for meeting-based attendance
              if (allLocs[loc]?.meetings) {
                const meetingsNode = allLocs[loc].meetings;
                for (const mType in meetingsNode) {
                  const meetingDayPath = `attendance/${loc}/meetings/${mType}/${dateToCheck}`;
                  const meetingDayRefDB = ref(database, meetingDayPath);
                  const meetDaySnap = await get(meetingDayRefDB);
                  if (meetDaySnap.exists()) {
                    const records = meetDaySnap.val();
                    for (const key in records) {
                      const record = records[key];
                      if (
                        record.userId === employeeId &&
                        record.clockInTime &&
                        !record.clockOutTime
                      ) {
                        const recTime = new Date(record.clockInTime);
                        if (!isNaN(recTime.getTime())) {
                          if (
                            !attendanceNodeRecord ||
                            recTime > new Date(attendanceNodeRecord.clockInTime)
                          ) {
                            attendanceNodeRecord = record;
                            attendanceNodeRef = ref(database, `${meetingDayPath}/${key}`);
                            latestClockInTimestamp = record.clockInTimestamp || parseInt(key);
                            latestClockInTime = recTime.toISOString();
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (!latestClockInTimestamp && !attendanceNodeRef) {
        throw new Error(
          `No open clock-in record found for ${userData.name} today or yesterday`
        );
      }

      // Calculate hours worked
      let lastClockIn;
      try {
        lastClockIn = latestClockInTime
          ? new Date(latestClockInTime)
          : attendanceNodeRecord?.clockInTime
          ? new Date(attendanceNodeRecord.clockInTime)
          : null;

        if (!lastClockIn || isNaN(lastClockIn.getTime())) {
          console.error('Invalid clock-in time:', latestClockInTime);
          lastClockIn = new Date(new Date(validatedNow).getTime() - 60 * 60 * 1000);
        }
      } catch (e) {
        console.error('Error parsing clock-in time:', e);
        lastClockIn = new Date(new Date(validatedNow).getTime() - 60 * 60 * 1000);
      }

      let currentTime = new Date(validatedNow);
      if (isNaN(currentTime.getTime())) {
        console.error('Invalid current time:', validatedNow);
        currentTime = new Date();
      }

      let hoursWorked =
        (currentTime.getTime() - lastClockIn.getTime()) / (1000 * 60 * 60);
      if (isNaN(hoursWorked) || !isFinite(hoursWorked)) {
        hoursWorked = 1.0;
      }
      hoursWorked = Math.max(0.1, Math.min(24, hoursWorked));

      const updates = {};
      const nowDate = new Date(validatedNow);
      const timeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(
        nowDate.getMinutes()
      ).padStart(2, '0')}`;

      // Update the attendance record if found
      if (attendanceNodeRef) {
        const attendanceRecordPath = attendanceNodeRef
          .toString()
          .replace(database.app.options.databaseURL, '');
        updates[`${attendanceRecordPath}/clockOutTime`] = validatedNow;
        updates[`${attendanceRecordPath}/hoursWorked`] = hoursWorked.toFixed(2);
      }

      if (latestClockInTimestamp) {
        // Mirror in the user's "clockOutTimes"
        updates[`users/${employeeId}/clockOutTimes/${latestClockInTimestamp}`] = timeStr;
      }

      // Update stats
      const statsRefDB = ref(database, `users/${employeeId}/stats`);
      const statsSnapshot = await get(statsRefDB);
      const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
      let currentTotalHours = currentStats.totalHours || 0;
      if (typeof currentTotalHours !== 'number' || isNaN(currentTotalHours)) {
        currentTotalHours = 0;
      }
      const newTotalHours = currentTotalHours + hoursWorked;

      updates[`users/${employeeId}/stats/totalHours`] = newTotalHours;
      updates[`users/${employeeId}/stats/lastClockOut`] = validatedNow;

      // Activity log
      updates[`users/${employeeId}/activityLog/clockOuts/${Date.now()}`] = {
        timestamp: validatedNow,
        hoursWorked: hoursWorked.toFixed(2)
      };

      await update(ref(database), updates);

      const formattedNow = moment(validatedNow).format('MMMM D, YYYY h:mm:ss A');
      setEmployeeInfo({
        name: userData.name,
        photo: userData.photo || '',
        position: userData.position || 'Member',
        clockOutTime: formattedNow,
        hoursWorked: hoursWorked.toFixed(2),
        userId: employeeId
      });

      setMessage(`Goodbye ${userData.name}! Clock-out successful`);
      setTimeout(() => {
        setEmployeeInfo(null);
      }, 5000);
    } catch (error) {
      console.error('Error during clock-out:', error);
      throw error;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Scheduling / Creating New Events on the Fly
  // ─────────────────────────────────────────────────────────────────────────────

  const processScheduledEvents = async (employeeId, userData) => {
    const normalizedLocation = location.toLowerCase().trim();

    // If no events object, initialize
    if (!userData.events) {
      console.log('Initializing events structure for user', employeeId);
      await update(ref(database, `users/${employeeId}`), {
        events: {
          workshops: {},
          meetings: {},
          haciendas: {},
          juntaHacienda: {},
          gestion: {}
        }
      });
      userData.events = {
        workshops: {},
        meetings: {},
        haciendas: {},
        juntaHacienda: {},
        gestion: {}
      };
    }

    const now = getChicagoTime();
    const today = now.format('YYYY-MM-DD');
    const updates = {};
    const eventsUpdated = [];

    const allEventCats = Object.keys(EVENT_TYPE_TO_CATEGORY_MAP).map(
      (k) => EVENT_TYPE_TO_CATEGORY_MAP[k]
    );

    // If we had a specifically selectedEvent, mark it attended
    if (selectedEvent) {
      console.log('Using selected event:', selectedEvent.id);
      const eventCategory =
        EVENT_TYPE_TO_CATEGORY_MAP[selectedEvent.eventType] || EVENT_TYPES.HACIENDAS;

      updates[
        `users/${employeeId}/events/${eventCategory}/${selectedEvent.id}/attended`
      ] = true;
      updates[
        `users/${employeeId}/events/${eventCategory}/${selectedEvent.id}/attendedAt`
      ] = now.toISOString();

      // Also update global "events" node
      updates[`events/${selectedEvent.id}/participants/${employeeId}/attended`] = true;
      updates[`events/${selectedEvent.id}/participants/${employeeId}/attendedAt`] =
        now.toISOString();

      eventsUpdated.push({
        type: eventCategory,
        id: selectedEvent.id,
        name: selectedEvent.title || 'Event'
      });
    } else {
      // Based on the chosen radio button
      const eventCategory = eventType;

      // See if there's already a scheduled event for today
      let foundEvent = false;
      if (userData.events[eventCategory]) {
        for (const [eId, eData] of Object.entries(userData.events[eventCategory])) {
          if (eData.scheduled && !eData.attended && !eData.markedAbsent) {
            const eDate = moment(eData.date).tz('America/Chicago').format('YYYY-MM-DD');
            if (eDate === today) {
              // Mark it as attended
              updates[`users/${employeeId}/events/${eventCategory}/${eId}/attended`] = true;
              updates[`users/${employeeId}/events/${eventCategory}/${eId}/attendedAt`] =
                now.toISOString();

              // Update participants if global event node exists
              if (eData.eventId) {
                updates[`events/${eData.eventId}/participants/${employeeId}/attended`] = true;
                updates[`events/${eData.eventId}/participants/${employeeId}/attendedAt`] =
                  now.toISOString();
              }

              eventsUpdated.push({
                type: eventCategory,
                id: eId,
                name: eData.title || 'Event'
              });
              foundEvent = true;
              break;
            }
          }
        }
      }

      // If none was found, create a new one
      if (!foundEvent) {
        console.log(`Creating new ${eventCategory} event for today`);
        const newEventId = `${eventCategory}-${today}-${now.format('HHmmss')}`;

        updates[`users/${employeeId}/events/${eventCategory}/${newEventId}`] = {
          date: now.toISOString(),
          attended: true,
          attendedAt: now.toISOString(),
          scheduled: true,
          // Title can show your eventType in user-friendly form
          title: EVENT_TYPE_DISPLAY_NAMES[eventCategory] || eventCategory,
          // **Important**: store the final plural event type
          eventType: eventCategory,
          location: normalizedLocation
        };

        eventsUpdated.push({
          type: eventCategory,
          id: newEventId,
          name: EVENT_TYPE_DISPLAY_NAMES[eventCategory] || eventCategory
        });
      }

      // Check other scheduled events for today across all categories
      for (const cat of allEventCats) {
        if (!userData.events[cat]) continue;
        const userEventsOfCat = userData.events[cat];

        for (const [evId, evData] of Object.entries(userEventsOfCat)) {
          if (evData.scheduled && !evData.attended && !evData.markedAbsent) {
            const evDate = moment(evData.date).tz('America/Chicago').format('YYYY-MM-DD');

            // For "meetings," check if clock-in time is within event's time window
            if (cat === EVENT_TYPES.MEETINGS && evData.eventId) {
              try {
                const eventRefDB = ref(database, `events/${evData.eventId}`);
                const eventSnap = await get(eventRefDB);
                if (eventSnap.exists()) {
                  const fullEventData = eventSnap.val();
                  const eStart = moment(fullEventData.start).tz('America/Chicago');
                  const eEnd = moment(fullEventData.end).tz('America/Chicago');

                  if (evDate === today && now.isBetween(eStart, eEnd, null, '[]')) {
                    updates[`users/${employeeId}/events/${cat}/${evId}/attended`] = true;
                    updates[`users/${employeeId}/events/${cat}/${evId}/attendedAt`] =
                      now.toISOString();

                    updates[`events/${evData.eventId}/participants/${employeeId}/attended`] = true;
                    updates[`events/${evData.eventId}/participants/${employeeId}/attendedAt`] =
                      now.toISOString();

                    eventsUpdated.push({
                      type: cat,
                      id: evId,
                      name: evData.title || fullEventData.title || 'Meeting'
                    });
                  }
                }
              } catch (err) {
                console.error(`Error checking meeting details for ${evId}:`, err);
              }
            }
            // Check "haciendas" that might span multiple days
            else if (cat === EVENT_TYPES.HACIENDAS && evData.endDate) {
              const startDate = moment(evData.date).tz('America/Chicago');
              const endDate = moment(evData.endDate).tz('America/Chicago');
              if (now.isBetween(startDate, endDate, 'day', '[]')) {
                updates[`users/${employeeId}/events/${cat}/${evId}/attended`] = true;
                updates[`users/${employeeId}/events/${cat}/${evId}/attendedAt`] =
                  now.toISOString();
                eventsUpdated.push({
                  type: cat,
                  id: evId,
                  name: evData.title || 'Hacienda'
                });
              }
            }
            // Otherwise, standard same-day check
            else if (evDate === today) {
              updates[`users/${employeeId}/events/${cat}/${evId}/attended`] = true;
              updates[`users/${employeeId}/events/${cat}/${evId}/attendedAt`] = now.toISOString();

              if (evData.eventId) {
                updates[`events/${evData.eventId}/participants/${employeeId}/attended`] = true;
                updates[`events/${evData.eventId}/participants/${employeeId}/attendedAt`] =
                  now.toISOString();
              }

              eventsUpdated.push({
                type: cat,
                id: evId,
                name: evData.title || 'Untitled Event'
              });
            }
          }
        }
      }
    }

    // Commit if any updates
    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
      console.log(`Updated ${eventsUpdated.length} events for ${userData.name || employeeId}`);
    }

    return { updated: eventsUpdated.length, events: eventsUpdated };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Mode & Event Type Switching
  // ─────────────────────────────────────────────────────────────────────────────

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setMessage(
      `Switched to ${newMode === 'clock-in' ? 'Clock In' : 'Clock Out'} mode`
    );
    setEmployeeInfo(null);
  };

  // If the user changes the radio button to pick an event type
  const handleEventTypeChange = (type) => {
    setEventType(type);
    // If you need to reset meeting type or do something else, you can:
    if (type !== EVENT_TYPES.MEETINGS) {
      setSelectedMeeting('');
    }
  };

  const handleEventSelection = (ev) => {
    setSelectedEvent(ev);
    // If the selected event has an eventType that is recognized, use it
    const mappedEventType =
      ev.eventType && EVENT_TYPE_TO_CATEGORY_MAP[ev.eventType]
        ? ev.eventType
        : EVENT_TYPES.HACIENDAS;

    setEventType(mappedEventType);

    if (mappedEventType === EVENT_TYPES.MEETINGS && ev.meetingType) {
      setSelectedMeeting(ev.meetingType);
    }
    setShowEventSelector(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Utility Methods for Formatting
  // ─────────────────────────────────────────────────────────────────────────────

  const formatEventTime = (date) => {
    if (!date) return '';
    return moment(date).tz('America/Chicago').format('h:mm A');
  };

  // Turn eventType into a display string
  const getEventTypeDisplayName = (type) => {
    if (Object.values(EVENT_TYPES).includes(type)) {
      return EVENT_TYPE_DISPLAY_NAMES[type] || type;
    }
    const normalized = normalizeEventType(type);
    return EVENT_TYPE_DISPLAY_NAMES[normalized] || normalized;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full bg-slate-900 bg-opacity-75 backdrop-blur-xl p-8">
      <header className="text-4xl text-white text-center font-bold mb-8">
        QR Code Scanner
      </header>

      {/* Settings Toggle */}
      <div className="fixed top-8 right-8">
        <button
          onClick={() => setSettingsVisible(!settingsVisible)}
          className="text-white hover:rotate-90 transition-transform duration-300"
        >
          {settingsVisible ? <X size={24} /> : <Settings size={24} />}
        </button>
      </div>

      {/* Settings Panel */}
      {settingsVisible && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl p-8 mb-8 max-w-lg mx-auto backdrop-blur-md">
          <h2 className="text-white text-xl mb-6">Scanner Settings</h2>

          {/* Location Selector */}
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-3 text-base bg-black bg-opacity-5 border border-white border-opacity-10 rounded-lg text-white mb-6 cursor-pointer"
          >
            <option value="">All Locations (select location after scan)</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc} className="bg-slate-900 text-white">
                {loc}
              </option>
            ))}
          </select>

          {/* Show scheduled events if any */}
          {scheduledEvents.length > 0 && (
            <div className="mb-6">
              <h3 className="text-white text-md mb-2">Scheduled Events Today:</h3>
              <div className="max-h-40 overflow-y-auto">
                {scheduledEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleEventSelection(ev)}
                    className={`p-3 mb-2 rounded-lg cursor-pointer transition ${
                      selectedEvent?.id === ev.id
                        ? 'bg-blue-500 bg-opacity-30 border border-blue-500 border-opacity-50'
                        : 'bg-black bg-opacity-20 border border-white border-opacity-10 hover:bg-opacity-30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{ev.title}</span>
                      <span className="text-white text-opacity-70 text-sm">
                        {formatEventTime(ev.start)}
                      </span>
                    </div>
                    <div className="text-white text-opacity-70 text-sm">
                      Type: {ev.eventType || 'Regular'}
                      {ev.location && ` | ${ev.location}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If no single scheduled event was auto-selected (or user wants manual override) */}
          {(!scheduledEvents.length || !selectedEvent) && (
            <>
              <div className="flex flex-wrap gap-4 justify-center mb-6">
                {/* Create a radio button for every recognized event type */}
                {Object.values(EVENT_TYPES).map((et) => (
                  <label
                    className="flex items-center gap-2 text-white cursor-pointer"
                    key={et}
                  >
                    <input
                      type="radio"
                      name="eventType"
                      value={et}
                      checked={eventType === et}
                      onChange={() => handleEventTypeChange(et)}
                      className="w-4 h-4"
                    />
                    {EVENT_TYPE_DISPLAY_NAMES[et] || et}
                  </label>
                ))}
              </div>

              {/* If "meetings" is selected, show a dropdown for meeting type */}
              {eventType === EVENT_TYPES.MEETINGS && (
                <select
                  value={selectedMeeting}
                  onChange={(e) => setSelectedMeeting(e.target.value)}
                  className="w-full p-3 text-base bg-black bg-opacity-5 border border-white border-opacity-10 rounded-lg text-white mb-6 cursor-pointer"
                >
                  <option value="">Select Meeting Type</option>
                  {meetingTypes.map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {/* Clock-In / Clock-Out Buttons */}
          <div className="flex gap-4 justify-center mb-4">
            <button
              onClick={() => handleModeSwitch('clock-in')}
              className={`px-6 py-3 text-base rounded-lg transition-all ${
                mode === 'clock-in'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500 bg-opacity-20 border border-blue-500 border-opacity-30 text-blue-400'
              }`}
            >
              Clock In
            </button>
            <button
              onClick={() => handleModeSwitch('clock-out')}
              className={`px-6 py-3 text-base rounded-lg transition-all ${
                mode === 'clock-out'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-500 bg-opacity-20 border border-blue-500 border-opacity-30 text-blue-400'
              }`}
            >
              Clock Out
            </button>
          </div>
        </div>
      )}

      {/* If a single scheduled event is chosen, display it */}
      {selectedEvent && (
        <div className="bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-20 rounded-lg p-4 mb-6 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white text-lg font-semibold">{selectedEvent.title}</h3>
              <p className="text-white text-opacity-70 text-sm">
                <Clock className="inline-block mr-1 h-4 w-4" />{' '}
                {formatEventTime(selectedEvent.start)}
                {selectedEvent.end && ` - ${formatEventTime(selectedEvent.end)}`}
              </p>
              {selectedEvent.location && (
                <p className="text-white text-opacity-70 text-sm">
                  <Users className="inline-block mr-1 h-4 w-4" /> {selectedEvent.location}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-white text-opacity-70 hover:text-opacity-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* User's scheduled/pending events */}
      {pendingEvents.length > 0 && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-4 mb-6 max-w-lg mx-auto">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowUserEvents(!showUserEvents)}
          >
            <h3 className="text-white text-md font-semibold">
              Pending Events ({pendingEvents.length})
            </h3>
            <ChevronRight
              size={20}
              className={`text-white transition-transform ${
                showUserEvents ? 'rotate-90' : ''
              }`}
            />
          </div>

          {showUserEvents && (
            <div className="mt-4 max-h-48 overflow-y-auto">
              {pendingEvents.map((ev) => (
                <div
                  key={`${ev.eventType}-${ev.id}`}
                  className="bg-slate-800 rounded-lg p-3 mb-2 flex justify-between items-center"
                >
                  <div>
                    <div className="text-white">{ev.title || 'Untitled Event'}</div>
                    <div className="text-xs text-white text-opacity-60 flex items-center gap-1">
                      <Calendar size={12} />
                      {formatChicagoDate(ev.date, 'MMM D, YYYY')}
                    </div>
                    <div className="mt-1 inline-block px-2 py-1 bg-slate-700 rounded-full text-xs text-white text-opacity-70">
                      {getEventTypeDisplayName(ev.eventType)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePendingEventClockIn(ev);
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Check In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Scanner Component */}
      <Scanner onScan={handleScan} location={location} isProcessing={isProcessing} />

      {/* Message Banner */}
      {message && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-4 mb-4 text-center text-white max-w-lg mx-auto">
          {message}
        </div>
      )}

      {/* Employee Info after scanning */}
      {employeeInfo && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl p-8 mt-8 max-w-lg mx-auto flex flex-col items-center backdrop-blur-md">
          <div className="mb-6">
            <img
              src={employeeInfo.photo || '/api/placeholder/120/120'}
              alt="Employee"
              className="w-32 h-32 rounded-full object-cover border-3 border-blue-500 border-opacity-30 bg-black bg-opacity-20"
            />
          </div>
          <div className="text-center">
            <h2 className="text-2xl text-white mb-2">{employeeInfo.name}</h2>
            <p className="text-white text-opacity-70 mb-2">{employeeInfo.position}</p>

            {employeeInfo.needsLocation && (
              <div className="mt-4 mb-4">
                <p className="text-white text-opacity-70 mb-2">Please select a location:</p>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full p-3 text-base bg-black bg-opacity-5 border border-white border-opacity-10 rounded-lg text-white mb-4 cursor-pointer"
                >
                  <option value="">Select Location</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc} className="bg-slate-900 text-white">
                      {loc}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLocationSelected}
                  disabled={!location}
                  className={`px-4 py-2 rounded-md ${
                    location ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 cursor-not-allowed'
                  } text-white transition`}
                >
                  Continue with Check-In
                </button>
              </div>
            )}

            {employeeInfo.clockInTime && (
              <p className="text-white text-opacity-70">
                Clocked in at: {employeeInfo.clockInTime}
              </p>
            )}

            {employeeInfo.clockOutTime && (
              <div>
                <p className="text-white text-opacity-70">
                  Clocked out at: {employeeInfo.clockOutTime}
                </p>
                <p className="text-white text-opacity-70 mt-2">
                  Hours worked: {employeeInfo.hoursWorked} hours
                </p>
              </div>
            )}

            {attendanceUpdated && selectedEvent && (
              <div className="mt-4 bg-green-500 bg-opacity-20 border border-green-500 border-opacity-30 p-3 rounded-lg flex items-center justify-center gap-2">
                <CheckCircle className="text-green-400 h-5 w-5" />
                <span className="text-green-400">
                  Attendance recorded for {selectedEvent.title}
                </span>
              </div>
            )}

            {/* Button to view scheduled events */}
            {employeeInfo.userId && !employeeInfo.needsLocation && (
              <button
                onClick={() => fetchUserEvents(employeeInfo.userId)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                View Scheduled Events
              </button>
            )}
          </div>
        </div>
      )}

      {/* If multiple events found, user must pick one */}
      {showEventSelector && scheduledEvents.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl font-semibold">Select Event</h3>
              <button onClick={() => setShowEventSelector(false)} className="text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-white text-opacity-70 mb-4">
              Multiple events found for today. Please select an event to track attendance.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scheduledEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => handleEventSelection(ev)}
                  className="p-4 rounded-lg bg-slate-700 hover:bg-slate-600 cursor-pointer transition"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-white font-medium">{ev.title}</h4>
                    <span className="text-white text-opacity-70">
                      {formatEventTime(ev.start)}
                    </span>
                  </div>
                  <p className="text-white text-opacity-70 text-sm">
                    {ev.eventType || 'Regular'}
                    {ev.location && ` | ${ev.location}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Render any errors */}
      {errors.length > 0 && (
        <div className="max-w-lg mx-auto mt-4">
          {errors.map((err, idx) => (
            <p key={idx} className="text-red-400 text-sm mb-1">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;

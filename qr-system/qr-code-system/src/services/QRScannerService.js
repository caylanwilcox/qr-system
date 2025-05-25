/**
 * src/services/QRScannerService.js
 *
 * QR Scanner Service
 * Factory function for QR scanning operations: clock-in, clock-out, and event attendance.
 */
import { ref, get } from 'firebase/database';
import { database } from './firebaseConfig';
import moment from 'moment-timezone';
import { attendanceService } from './attendanceService';

const QRScannerService = (
  setMessage,
  setEmployeeInfo,
  setErrors,
  setAttendanceUpdated,
  setUserEvents,
  setPendingEvents,
  setScheduledEvents,
  setAllLocationsEvents,
  user,
  debug = false,
  initialLocation = null
) => {
  let location = initialLocation;
  const log = (...args) => debug && console.log('[QRService]', ...args);

  // --- API Methods ---

  const setLocation = (newLocation) => {
    location = newLocation;
    log('Location set:', location);
  };

  const handleClockIn = async (userId, locationKey) => {
    log('ClockIn:', userId, 'at', locationKey);
    try {
      const res = await attendanceService.recordAttendance(userId, locationKey);
      if (!res.success) throw new Error(res.message);

      const userData = await _fetchUser(userId);
      await _loadPendingEvents(userId, locationKey);

      setEmployeeInfo({
        userId,
        name: userData.profile?.name || 'Unknown',
        position: userData.profile?.position || 'Member',
        clockedIn: true,
        clockInTime: moment().toISOString()
      });
      setAttendanceUpdated(true);
      setMessage(`${userData.profile?.name || 'User'} clocked in`);
      return res;
    } catch (err) {
      log('ClockIn error:', err);
      setErrors(prev => [...prev, err.message]);
      setMessage(err.message);
      throw err;
    }
  };

  const handleClockOut = async (userId, locationKey) => {
    log('ClockOut:', userId, 'at', locationKey);
    try {
      const res = await attendanceService.recordClockOut(userId, locationKey);
      if (!res.success) throw new Error(res.message);

      const userData = await _fetchUser(userId);
      setEmployeeInfo({
        userId,
        name: userData.profile?.name || 'Unknown',
        position: userData.profile?.position || 'Member',
        clockedIn: false,
        clockOutTime: moment().toISOString()
      });
      setAttendanceUpdated(true);
      setMessage(`${userData.profile?.name || 'User'} clocked out`);
      return res;
    } catch (err) {
      log('ClockOut error:', err);
      setErrors(prev => [...prev, err.message]);
      setMessage(err.message);
      throw err;
    }
  };

  const handlePendingEventClockIn = async ({ id, eventType, userId, location: eventLoc, title }) => {
    log('EventCheckIn:', id, 'for', userId);
    try {
      const loc = eventLoc || location;
      if (!loc) throw new Error('Location required');

      const res = await attendanceService.markEventAttendance(
        userId,
        id,
        eventType,
        loc
      );
      if (!res.success) throw new Error(res.message);

      const userData = await _fetchUser(userId);
      setEmployeeInfo({
        userId,
        name: userData.profile?.name || 'Unknown',
        position: userData.profile?.position || 'Member',
        clockedIn: true,
        attendedEvent: title || 'Event',
        eventId: id,
        eventType
      });
      setAttendanceUpdated(true);
      setMessage(`${userData.profile?.name || 'User'} attended ${title || id}`);
      return res;
    } catch (err) {
      log('EventCheckIn error:', err);
      setErrors(prev => [...prev, err.message]);
      setMessage(err.message);
      throw err;
    }
  };

  const fetchScheduledEvents = async (locationKey, evtType) => {
    log('FetchScheduledEvents:', locationKey, evtType);
    const events = await attendanceService.fetchScheduledEvents(locationKey, evtType);
    setScheduledEvents(events);
    setAllLocationsEvents(events);
    return events;
  };

  const fetchUserEvents = async (userId) => {
    log('FetchUserEvents:', userId);
    const userRef = ref(database, `users/${userId}`);
    const snap = await get(userRef);
    if (!snap.exists()) throw new Error('User not found');
    const data = snap.val().events || {};
    setUserEvents(data);
    return data;
  };

  // --- Internal Helpers ---

  const _fetchUser = async (userId) => {
    const userRef = ref(database, `users/${userId}`);
    const snap = await get(userRef);
    if (!snap.exists()) throw new Error(`User ${userId} not found`);
    return snap.val();
  };

  const _loadPendingEvents = async (userId, locationKey) => {
    log('FetchPendingEvents:', userId);
    const today = moment().format('YYYY-MM-DD');
    const snap = await get(ref(database, `users/${userId}/events`));
    const data = snap.exists() ? snap.val() : {};
    const list = [];
    Object.entries(data).forEach(([cat, evts]) => {
      Object.entries(evts).forEach(([eid, e]) => {
        if (e.scheduled && !e.attended) {
          if (moment(e.date).format('YYYY-MM-DD') === today &&
              (e.location === locationKey || e.location === 'All Locations')) {
            list.push({
              id: eid,
              userId,
              title: e.title,
              date: e.date,
              time: e.time,
              eventType: cat,
              location: e.location
            });
          }
        }
      });
    });
    setPendingEvents(list);
    return list;
  };

  // --- Exposed API ---
  return {
    setLocation,
    handleClockIn,
    handleClockOut,
    handlePendingEventClockIn,
    fetchScheduledEvents,
    fetchUserEvents,
    getMeetingTypes: () => ['Regular', 'Special', 'Board']
  };
};

export default QRScannerService;

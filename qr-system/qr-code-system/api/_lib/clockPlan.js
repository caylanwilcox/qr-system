// What a clock-in or clock-out writes, worked out from the user's record.
// No database access here: api/attendance/scan.js loads the data, holds the
// per-person lock, and saves the result as one atomic update.
// The logic is the QR scanner page's, moved to the server unchanged.
import { HttpError } from './auth.js';
import {
  normalizeEventType,
  splitOpenClockIns,
  pickOpenClockIn,
  sharedPathFor,
  staleClockInUpdates,
  findEventsToMarkAttended,
  composeClockInUpdates,
  composeClockOutUpdates,
  hasScheduledEventsToday,
  isLateForScheduledEvents,
} from '../../src/utils/attendanceRules.js';

const HOUR_MS = 60 * 60 * 1000;

const userName = (userData) =>
  (typeof userData.name === 'string' && userData.name) ||
  (typeof userData.profile?.name === 'string' && userData.profile.name) ||
  'Unknown User';

const positionOf = (userData) => userData.profile?.position || 'Member';

// Location key the scanner has always stored: lowercase, spaces removed.
export const locationKeyOf = (location) => location.toLowerCase().replace(/\s+/g, '');

const timesOf = (now) => ({
  timestamp: now.valueOf(),
  currentDate: now.format('YYYY-MM-DD'),
  formattedTime: now.format('hh:mm A'),
  iso: now.toISOString(),
});

// Shared copies of forgotten clock-ins that exist (writing to one that doesn't
// would create a stray partial record).
const existingStalePaths = (stale, userId, existingShared) =>
  stale.map((item) => sharedPathFor(item, userId)).filter((path) => path && existingShared.has(path));

// Assigned per-user statistics for today that a clock-in completes.
function completedStatistics(userData, currentDate, normalizedEventType, formattedTime, iso) {
  const updates = {};
  const current = normalizedEventType.toLowerCase().replace(/[_\s-]/g, '');
  Object.entries(userData.statistics || {}).forEach(([statId, entry]) => {
    if (!entry || entry.date !== currentDate || entry.status !== 'assigned' || entry.clockedIn) return;
    const type = entry.eventType?.toLowerCase().replace(/[_\s-]/g, '');
    if (type === current || type === 'general' || current === 'generalmeeting') {
      updates[`statistics/${statId}/clockedIn`] = true;
      updates[`statistics/${statId}/clockInTime`] = formattedTime;
      updates[`statistics/${statId}/status`] = 'completed';
      updates[`statistics/${statId}/attendedAt`] = iso;
    }
  });
  return updates;
}

export function planClockIn({ userId, userData, now, location, eventType, eventTypeLabel, scheduledEvents, existingShared }) {
  const { timestamp, currentDate, formattedTime, iso } = timesOf(now);
  const name = userName(userData);
  const position = positionOf(userData);
  const locationKey = locationKeyOf(location);

  // One open clock-in at a time. Forgotten clock-ins from earlier days are
  // closed as missed instead of blocking the person forever.
  const { openToday, stale } = splitOpenClockIns(userData.attendance, currentDate);
  if (openToday.length > 0) {
    const since = openToday[0].record.clockInTime;
    throw new HttpError(409, `${name} is already clocked in${since ? ` since ${since}` : ''}. Use Clock Out to end that shift first.`);
  }

  const isLate = hasScheduledEventsToday(userData, currentDate)
    ? isLateForScheduledEvents(userData, currentDate, now)
    : false;
  const normalizedEventType = normalizeEventType(eventType);
  const attendanceKey = `${currentDate}_${timestamp}`;
  const eventId = `${currentDate}-${timestamp}`;
  const firstToday = !Object.keys(userData.attendance || {}).some((key) => key.startsWith(currentDate));

  const userUpdates = {
    clockedIn: true,
    clockedInDate: currentDate,
    clockedInTimestamp: timestamp,
    [`clockInTimes/${timestamp}`]: formattedTime,
    'stats/lastClockIn': iso,
    [`attendance/${attendanceKey}/clockedIn`]: true,
    [`attendance/${attendanceKey}/clockInTime`]: formattedTime,
    [`attendance/${attendanceKey}/isLate`]: isLate,
    [`attendance/${attendanceKey}/onTime`]: !isLate,
    [`attendance/${attendanceKey}/location`]: locationKey,
    [`attendance/${attendanceKey}/locationName`]: location,
    [`attendance/${attendanceKey}/eventType`]: eventType,
    [`attendance/${attendanceKey}/clockInTimestamp`]: timestamp,
    [`attendance/${attendanceKey}/date`]: currentDate,
    [`attendance/${attendanceKey}/status`]: 'clocked-in',
    // The scanner's own per-scan event entry (kept as it was).
    [`events/${normalizedEventType}/${eventId}/attended`]: true,
    [`events/${normalizedEventType}/${eventId}/attendedAt`]: iso,
    [`events/${normalizedEventType}/${eventId}/date`]: currentDate,
    [`events/${normalizedEventType}/${eventId}/title`]: `${eventTypeLabel || eventType} - Clock In`,
    [`events/${normalizedEventType}/${eventId}/scheduled`]: true,
    [`events/${normalizedEventType}/${eventId}/location`]: locationKey,
    [`events/${normalizedEventType}/${eventId}/eventType`]: normalizedEventType,
    ...completedStatistics(userData, currentDate, normalizedEventType, formattedTime, iso),
    ...staleClockInUpdates(stale, timestamp),
  };
  // Stats count days, so only the first clock-in of the day adds to them.
  if (firstToday) {
    userUpdates['stats/daysPresent'] = (userData.stats?.daysPresent || 0) + 1;
    if (isLate) userUpdates['stats/daysLate'] = (userData.stats?.daysLate || 0) + 1;
  }

  const attendedEventIds = findEventsToMarkAttended({
    events: scheduledEvents,
    userId,
    dateStr: currentDate,
    eventType,
    locationKey,
  });

  const updates = composeClockInUpdates({
    userId,
    userUpdates,
    sharedPath: `attendance/${locationKey}/${currentDate}/${userId}`,
    sharedRecord: {
      userId,
      name,
      position,
      location: locationKey,
      locationName: location,
      clockInTime: iso,
      clockInTimestamp: timestamp,
      isLate,
      status: 'clocked-in',
      eventType: normalizedEventType,
    },
    attendedEventIds,
    attendedAt: iso,
    staleSharedPaths: existingStalePaths(stale, userId, existingShared),
  });

  const notes = [];
  if (attendedEventIds.length > 0) notes.push(`Marked attended for ${attendedEventIds.length} scheduled event(s).`);
  if (stale.length > 0) notes.push(`${stale.length} earlier clock-in(s) without a clock-out were marked missed.`);

  return {
    updates,
    result: {
      mode: 'clock-in',
      message: `Successfully clocked in: ${name}. ${notes.join(' ')}`.trim(),
      name,
      position,
      clockInTime: formattedTime,
      isLate,
      attendanceKey,
      locationKey,
      eventType: normalizedEventType,
      eventId,
      attendedEvents: attendedEventIds.length,
      staleClosed: stale.length,
    },
  };
}

export function planClockOut({ userId, userData, now, location, existingShared }) {
  const { timestamp, currentDate, formattedTime, iso } = timesOf(now);
  const name = userName(userData);
  const position = positionOf(userData);

  // Today's open clock-in, or one from last night if the shift crossed midnight.
  const { open, stale } = pickOpenClockIn(userData.attendance, currentDate, timestamp);
  let clockInTimestamp = open ? open.record.clockInTimestamp : null;

  // Flag-only fallback: marked clocked in today but no record found.
  if (!open && userData.clockedIn === true && userData.clockedInDate === currentDate) {
    clockInTimestamp = userData.clockedInTimestamp || timestamp - 8 * HOUR_MS;
  }

  if (!clockInTimestamp) {
    // Nothing open today. A clock-in from an earlier day that was never
    // closed is marked missed, so the person isn't stuck "clocked in".
    const staleFlag = userData.clockedIn === true && Boolean(userData.clockedInDate) && userData.clockedInDate < currentDate;
    if (stale.length === 0 && !staleFlag) {
      throw new HttpError(409, 'No active clock-in found for today. Please clock in first.');
    }
    return {
      updates: composeClockOutUpdates({
        userId,
        userUpdates: { ...staleClockInUpdates(stale, timestamp), clockedIn: false },
        sharedPath: null,
        staleSharedPaths: existingStalePaths(stale, userId, existingShared),
      }),
      result: {
        mode: 'stale-closed',
        message: `No clock-in found today for ${name}. An earlier clock-in that was never closed is now marked missed. Please clock in first.`,
        name,
        staleClosed: stale.length,
      },
    };
  }

  const locationKey = locationKeyOf(location);
  const hours = (timestamp - clockInTimestamp) / HOUR_MS;
  const hoursWorked = hours.toFixed(2);

  const userUpdates = {
    clockedIn: false,
    clockedOut: true,
    clockedOutDate: currentDate,
    clockedOutTimestamp: timestamp,
    [`clockOutTimes/${timestamp}`]: formattedTime,
    'stats/lastClockOut': iso,
    ...staleClockInUpdates(stale, timestamp),
  };
  if (hours > 0) userUpdates['stats/totalHours'] = (userData.stats?.totalHours || 0) + hours;

  let attendanceKey = open ? open.key : null;
  if (open) {
    Object.assign(userUpdates, {
      [`attendance/${attendanceKey}/clockedOut`]: true,
      [`attendance/${attendanceKey}/clockOutTime`]: formattedTime,
      [`attendance/${attendanceKey}/clockOutTimestamp`]: timestamp,
      [`attendance/${attendanceKey}/hoursWorked`]: hoursWorked,
      [`attendance/${attendanceKey}/status`]: 'completed',
      [`attendance/${attendanceKey}/clockedIn`]: false,
    });
  } else {
    // No record to close: keep a clock-out-only record, as before.
    attendanceKey = `${currentDate}_${timestamp}_out`;
    Object.assign(userUpdates, {
      [`attendance/${attendanceKey}/clockedOut`]: true,
      [`attendance/${attendanceKey}/clockOutTime`]: formattedTime,
      [`attendance/${attendanceKey}/clockOutTimestamp`]: timestamp,
      [`attendance/${attendanceKey}/location`]: locationKey,
      [`attendance/${attendanceKey}/locationName`]: location,
      [`attendance/${attendanceKey}/clockedIn`]: false,
      [`attendance/${attendanceKey}/date`]: currentDate,
      [`attendance/${attendanceKey}/status`]: 'clock-out-only',
      [`attendance/${attendanceKey}/hoursWorked`]: hoursWorked,
    });
  }

  const updates = composeClockOutUpdates({
    userId,
    userUpdates,
    // The shared record lives under the clock-in's own location and date.
    sharedPath: open ? sharedPathFor(open, userId, locationKey) : null,
    clockOut: { time: iso, timestamp, hoursWorked },
    staleSharedPaths: existingStalePaths(stale, userId, existingShared),
  });

  return {
    updates,
    result: {
      mode: 'clock-out',
      message: `Successfully clocked out: ${name}. Hours worked: ${hoursWorked}`,
      name,
      position,
      clockOutTime: formattedTime,
      hoursWorked,
      attendanceKey,
      locationKey,
      staleClosed: stale.length,
    },
  };
}

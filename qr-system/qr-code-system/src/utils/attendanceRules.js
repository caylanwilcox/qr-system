// Pure attendance rules shared by the QR scanner. No database access here,
// so the rules can be unit-tested.
import moment from 'moment-timezone';

export const TIMEZONE = 'America/Chicago';

// Aliases the scanner has always applied to event types before storing them.
const EVENT_TYPE_ALIASES = {
  general: 'generalmeeting',
  generalmeeting: 'generalmeeting',
  juntahacienda: 'juntahacienda',
  junta_hacienda: 'juntahacienda',
  juntadehacienda: 'juntahacienda',
  meeting: 'meetings',
  meetings: 'meetings',
  workshop: 'workshops',
  workshops: 'workshops',
  hacienda: 'haciendas',
  haciendas: 'haciendas',
  gestion: 'gestion',
};

// Only the alias table's own entries, never inherited names like "constructor"
// (event types now arrive over the network, at the scan endpoint).
const aliasFor = (key) =>
  Object.prototype.hasOwnProperty.call(EVENT_TYPE_ALIASES, key) ? EVENT_TYPE_ALIASES[key] : key;

// The scanner's storage key for an event type (unchanged behavior).
export function normalizeEventType(value) {
  if (typeof value !== 'string') return '';
  return aliasFor(value.toLowerCase().replace(/\s+/g, ''));
}

// Looser match for comparing types across screens: "HACIENDAS",
// "haciendas" and "Junta de Hacienda" / "JUNTA_HACIENDA" all compare equal.
export function sameEventType(a, b) {
  const compact = (value) => aliasFor(normalizeEventType(value).replace(/[^a-z0-9]/g, ''));
  const left = compact(a);
  return left !== '' && left === compact(b);
}

function isOpen(record) {
  return Boolean(record) && record.status === 'clocked-in' && record.clockedIn === true;
}

function recordDate(key, record) {
  return (record && record.date) || String(key).slice(0, 10);
}

// Open clock-ins split into today's and earlier days' ("stale") records.
// Each list is sorted newest first.
export function splitOpenClockIns(attendance, currentDate) {
  const openToday = [];
  const stale = [];
  Object.entries(attendance || {}).forEach(([key, record]) => {
    if (!isOpen(record)) return;
    const date = recordDate(key, record);
    if (date === currentDate) openToday.push({ key, record });
    else if (date < currentDate) stale.push({ key, record });
  });
  const newestFirst = (a, b) => (b.record.clockInTimestamp || 0) - (a.record.clockInTimestamp || 0);
  return { openToday: openToday.sort(newestFirst), stale: stale.sort(newestFirst) };
}

// Longest shift a clock-out will close across midnight. Ten hours lets an
// 11:30 pm clock-in be closed in the early morning, while a clock-out
// forgotten at 9 pm still counts as missed the next morning.
export const MAX_SHIFT_MS = 10 * 60 * 60 * 1000;

// For clock-out: the open clock-in to close, and the forgotten ones to mark
// missed. Today's newest open record wins; otherwise a recent one from an
// earlier day (a shift past midnight). Clock-in uses splitOpenClockIns
// instead, so a forgotten shift never blocks the next clock-in.
export function pickOpenClockIn(attendance, currentDate, now, maxShiftMs = MAX_SHIFT_MS) {
  const { openToday, stale } = splitOpenClockIns(attendance, currentDate);
  if (openToday.length > 0) return { open: openToday[0], stale };
  const recent = stale.find(
    ({ record }) => record.clockInTimestamp && now - record.clockInTimestamp <= maxShiftMs
  );
  if (!recent) return { open: null, stale };
  return { open: recent, stale: stale.filter((item) => item !== recent) };
}

// Path of the shared attendance/{loc}/{date}/{uid} copy of a user's record.
export function sharedPathFor({ key, record }, userId, fallbackLocation) {
  const location = (record && record.location) || fallbackLocation;
  if (!location) return null;
  return `attendance/${location}/${recordDate(key, record)}/${userId}`;
}

// Updates (relative to users/{uid}) that close forgotten clock-ins from
// earlier days. Hours stay unset because the real clock-out time is unknown.
export function staleClockInUpdates(stale, timestamp) {
  const updates = {};
  stale.forEach(({ key }) => {
    updates[`attendance/${key}/status`] = 'missed-clock-out';
    updates[`attendance/${key}/clockedIn`] = false;
    updates[`attendance/${key}/autoClosedAt`] = timestamp;
  });
  return updates;
}

// True when the event runs on dateStr (YYYY-MM-DD) in Chicago time,
// including multi-day events. Times without an offset are read as Chicago
// time, as the browser did; the server runs in UTC.
export function eventCoversDate(event, dateStr, timezone = TIMEZONE) {
  if (!event || !event.start) return false;
  const start = moment.tz(event.start, timezone);
  if (!start.isValid()) return false;
  const end = event.end ? moment.tz(event.end, timezone) : start;
  const first = start.format('YYYY-MM-DD');
  const last = end.isValid() ? end.format('YYYY-MM-DD') : first;
  return first <= dateStr && dateStr <= (last < first ? first : last);
}

// --- Late check (moved unchanged from the QR scanner page) ---
// Dates without an offset are read as Chicago time. The scanner used to run
// in a Chicago browser; the server runs in UTC, where a plain moment(value)
// would shift those times by 5-6 hours.
const inZone = (value, timezone) => moment.tz(value, timezone);

// The per-user event lists the late check has always looked at.
const LATE_CHECK_EVENT_TYPES = ['workshops', 'meetings', 'haciendas', 'juntaHacienda', 'gestion', 'generalmeeting'];

function scheduledUserEvents(userData) {
  const result = [];
  if (!userData || !userData.events) return result;
  LATE_CHECK_EVENT_TYPES.forEach((type) => {
    Object.values(userData.events[type] || {}).forEach((eventData) => {
      if (eventData && eventData.scheduled) result.push(eventData);
    });
  });
  return result;
}

const assignedStatsOn = (userData, dateStr) =>
  Object.values((userData && userData.statistics) || {}).filter(
    (entry) => entry && entry.date === dateStr && entry.status === 'assigned'
  );

const isOnDate = (eventData, dateStr, timezone) =>
  Boolean(eventData.date) && inZone(eventData.date, timezone).format('YYYY-MM-DD') === dateStr;

const spansDate = (eventData, dateStr, timezone) =>
  Boolean(eventData.endDate) &&
  inZone(dateStr, timezone).isBetween(inZone(eventData.date, timezone), inZone(eventData.endDate, timezone), 'day', '[]');

// True when the user has a scheduled event (or an assigned statistic) on dateStr.
export function hasScheduledEventsToday(userData, dateStr, timezone = TIMEZONE) {
  if (!userData || !dateStr) return false;
  const scheduled = scheduledUserEvents(userData).some(
    (eventData) => isOnDate(eventData, dateStr, timezone) || spansDate(eventData, dateStr, timezone)
  );
  return scheduled || assignedStatsOn(userData, dateStr).length > 0;
}

// Start time of a scheduled event on dateStr. null means the event has only a
// date (midnight), and the late check skips that event entirely.
function eventStartOn(eventData, dateStr, timezone) {
  if (eventData.start) return inZone(eventData.start, timezone);
  if (eventData.time) return moment.tz(`${dateStr} ${eventData.time}`, 'YYYY-MM-DD HH:mm', timezone);
  if (eventData.startTime) return moment.tz(`${dateStr} ${eventData.startTime}`, 'YYYY-MM-DD HH:mm', timezone);
  const dateTime = inZone(eventData.date, timezone);
  return dateTime.format('HH:mm') === '00:00' ? null : dateTime;
}

// Midnight counts as "no time given" unless the event says it isn't all-day.
const hasRealTime = (time, eventData) =>
  time.isValid() && (time.format('HH:mm') !== '00:00' || eventData.allDay === false);

// Late means clocking in after the earliest scheduled start time on dateStr.
// With no scheduled times that day, nobody is late.
export function isLateForScheduledEvents(userData, dateStr, clockInMoment, timezone = TIMEZONE) {
  if (!userData || !dateStr || !clockInMoment) return false;
  const starts = [];

  scheduledUserEvents(userData).forEach((eventData) => {
    if (isOnDate(eventData, dateStr, timezone)) {
      const time = eventStartOn(eventData, dateStr, timezone);
      if (time === null) return;
      if (hasRealTime(time, eventData)) starts.push(time);
    }
    if (spansDate(eventData, dateStr, timezone)) {
      const start = inZone(eventData.date, timezone);
      if (hasRealTime(start, eventData)) starts.push(start);
    }
  });

  assignedStatsOn(userData, dateStr).forEach((entry) => {
    const clock = entry.eventTime || entry.startTime;
    if (!clock) return;
    const time = moment.tz(`${dateStr} ${clock}`, 'YYYY-MM-DD HH:mm', timezone);
    if (time.isValid()) starts.push(time);
  });

  if (starts.length === 0) return false;
  const earliest = starts.reduce((a, b) => (b.isBefore(a) ? b : a));
  return clockInMoment.isAfter(earliest);
}

const compactLocation = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// Event-type names by eventTypes key. The Scheduler saves an event's type as
// its key (e.g. "et-1"); the scanner sends the type's name, read the same way.
export function eventTypeNamesByKey(eventTypes) {
  const names = {};
  Object.entries(eventTypes || {}).forEach(([key, value]) => {
    if (typeof value === 'string') names[key] = value;
    else if (value && typeof value === 'object') names[key] = value.name || value.key || key;
  });
  return names;
}

// IDs of the scheduled events a clock-in should mark attended: events the
// user is a participant in, running today, with the scanned event type.
// An event's type may be a name or an eventTypes key (resolved through
// `eventTypeNames`). `category` is not compared: the Scheduler always saves
// the default "meetings" there. When several match, the ones at the scanned
// location win.
export function findEventsToMarkAttended({
  events, userId, dateStr, eventType, locationKey, eventTypeNames = {}, timezone = TIMEZONE,
}) {
  const matches = (events || []).filter(({ data }) => {
    const participant = data && data.participants ? data.participants[userId] : undefined;
    if (participant === undefined || participant === null) return false;
    if (typeof participant === 'object' && participant.attended === true) return false;
    if (!eventCoversDate(data, dateStr, timezone)) return false;
    const typeName = Object.prototype.hasOwnProperty.call(eventTypeNames, data.eventType)
      ? eventTypeNames[data.eventType]
      : undefined;
    return [data.eventType, typeName, data.originalEventType].some((type) =>
      sameEventType(eventType, type)
    );
  });
  const here = compactLocation(locationKey);
  if (matches.length > 1 && here) {
    const atLocation = matches.filter(({ data }) => compactLocation(data.location) === here);
    if (atLocation.length > 0) return atLocation.map(({ id }) => id);
  }
  return matches.map(({ id }) => id);
}

const markMissed = (updates, paths) => {
  paths.forEach((path) => {
    updates[`${path}/status`] = 'missed-clock-out';
  });
};

// The single multi-path update for a clock-in: the user's record, the shared
// copy, event attendance, and shared copies of forgotten clock-ins.
export function composeClockInUpdates({
  userId, userUpdates, sharedPath, sharedRecord, attendedEventIds = [], attendedAt, staleSharedPaths = [],
}) {
  const updates = { ...prefixKeys(userUpdates, `users/${userId}/`), [sharedPath]: sharedRecord };
  attendedEventIds.forEach((eventId) => {
    const participantPath = `events/${eventId}/participants/${userId}`;
    updates[`${participantPath}/assigned`] = true;
    updates[`${participantPath}/attended`] = true;
    updates[`${participantPath}/attendedAt`] = attendedAt;
  });
  markMissed(updates, staleSharedPaths);
  return updates;
}

// The single multi-path update for a clock-out. sharedPath is null when the
// clock-in has no shared copy to close.
export function composeClockOutUpdates({ userId, userUpdates, sharedPath, clockOut, staleSharedPaths = [] }) {
  const updates = prefixKeys(userUpdates, `users/${userId}/`);
  if (sharedPath) {
    updates[`${sharedPath}/clockOutTime`] = clockOut.time;
    updates[`${sharedPath}/clockOutTimestamp`] = clockOut.timestamp;
    updates[`${sharedPath}/hoursWorked`] = clockOut.hoursWorked;
    updates[`${sharedPath}/status`] = 'completed';
  }
  markMissed(updates, staleSharedPaths);
  return updates;
}

export function prefixKeys(updates, prefix) {
  const result = {};
  Object.entries(updates).forEach(([key, value]) => {
    result[`${prefix}${key}`] = value;
  });
  return result;
}

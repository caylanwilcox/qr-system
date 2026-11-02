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

// The scanner's storage key for an event type (unchanged behavior).
export function normalizeEventType(value) {
  if (typeof value !== 'string') return '';
  const key = value.toLowerCase().replace(/\s+/g, '');
  return EVENT_TYPE_ALIASES[key] || key;
}

// Looser match for comparing types across screens: "HACIENDAS",
// "haciendas" and "Junta de Hacienda" / "JUNTA_HACIENDA" all compare equal.
export function sameEventType(a, b) {
  const compact = (value) => {
    const key = normalizeEventType(value).replace(/[^a-z0-9]/g, '');
    return EVENT_TYPE_ALIASES[key] || key;
  };
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
// including multi-day events.
export function eventCoversDate(event, dateStr, timezone = TIMEZONE) {
  if (!event || !event.start) return false;
  const start = moment(event.start).tz(timezone);
  if (!start.isValid()) return false;
  const end = event.end ? moment(event.end).tz(timezone) : start;
  const first = start.format('YYYY-MM-DD');
  const last = end.isValid() ? end.format('YYYY-MM-DD') : first;
  return first <= dateStr && dateStr <= (last < first ? first : last);
}

const compactLocation = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// IDs of the scheduled events a clock-in should mark attended: events the
// user is a participant in, running today, with the scanned event type.
// When several match, the ones at the scanned location win.
export function findEventsToMarkAttended({ events, userId, dateStr, eventType, locationKey, timezone = TIMEZONE }) {
  const matches = (events || []).filter(({ data }) => {
    const participant = data && data.participants ? data.participants[userId] : undefined;
    if (participant === undefined || participant === null) return false;
    if (typeof participant === 'object' && participant.attended === true) return false;
    if (!eventCoversDate(data, dateStr, timezone)) return false;
    return [data.eventType, data.category, data.originalEventType].some((type) =>
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

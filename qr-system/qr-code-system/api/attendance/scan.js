// api/attendance/scan.js
// Clock in or clock out from the QR scanner. Admin login required (the
// scanner page is admin-only).
//
// Two scans of the same badge can arrive at once, from one device or two.
// A short per-person lock (scanLocks/{userId}, taken with a transaction)
// makes the second scan wait its turn, so it sees the first scan's result
// instead of creating a second clock-in. Just before saving, the scan checks
// it still holds its own lock (a stalled scan whose lock expired gives up
// instead of saving stale data). The lock is released in the same atomic
// update that saves the scan, and expires on its own if this function dies
// part-way.
import crypto from 'crypto';
import moment from 'moment-timezone';
import { getAdmin } from '../_lib/firebaseAdmin.js';
import { HttpError, requireAdmin, sendError, isValidId } from '../_lib/auth.js';
import { planClockIn, planClockOut, locationKeyOf } from '../_lib/clockPlan.js';
import {
  TIMEZONE,
  normalizeEventType,
  splitOpenClockIns,
  sharedPathFor,
  eventTypeNamesByKey,
} from '../../src/utils/attendanceRules.js';

export const SCAN_LOCK_MS = 30 * 1000;
const MODES = ['clock-in', 'clock-out'];
// Characters a database key can't hold, plus control characters.
const unsafeKey = (value) =>
  /[.#$[\]/]/.test(value) || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

function label(value, field, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string' || value.trim() === '' || value.length > 100) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return value.trim();
}

function parseScan(body) {
  const input = body && typeof body === 'object' ? body : {};
  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!isValidId(userId)) throw new HttpError(400, 'This QR code is not a valid member badge');
  if (!MODES.includes(input.mode)) throw new HttpError(400, 'mode must be clock-in or clock-out');

  const location = label(input.location, 'location', { required: true });
  if (unsafeKey(locationKeyOf(location))) throw new HttpError(400, 'Invalid location');

  const clockIn = input.mode === 'clock-in';
  const eventType = label(input.eventType, 'event type', { required: clockIn });
  if (clockIn && (normalizeEventType(eventType) === '' || unsafeKey(normalizeEventType(eventType)))) {
    throw new HttpError(400, 'Invalid event type');
  }
  const eventTypeLabel = label(input.eventTypeLabel, 'event type label', { required: false });

  return { userId, mode: input.mode, location, eventType, eventTypeLabel };
}

// Returns this scan's lock id.
async function acquireScanLock(db, userId, callerUid, nowMs) {
  const id = crypto.randomUUID();
  const result = await db.ref(`scanLocks/${userId}`).transaction((current) => {
    if (current && typeof current.at === 'number' && nowMs - current.at < SCAN_LOCK_MS) return undefined;
    return { at: nowMs, by: callerUid, id };
  });
  if (!result.committed) {
    throw new HttpError(409, 'This badge is already being processed. Wait a moment and scan again.');
  }
  return id;
}

// Right before saving: is the lock still ours? Renewing it means no other
// scan can take it in the moment before the save releases it.
async function confirmScanLock(db, userId, id) {
  const result = await db.ref(`scanLocks/${userId}`).transaction((current) => {
    if (!current || current.id !== id) return undefined;
    return { ...current, at: Date.now() };
  });
  if (!result.committed) {
    throw new HttpError(409, 'This scan took too long and was not saved. Please scan again.');
  }
}

// On failure, release the lock only if it is still ours.
async function releaseScanLock(db, userId, id) {
  await db
    .ref(`scanLocks/${userId}`)
    .transaction((current) => (current && current.id === id ? null : undefined))
    .catch(() => {});
}

// Deleted members keep a backup under deleted_users/{userId}_{timestamp}.
async function isDeleted(db, userId) {
  const snapshot = await db
    .ref('deleted_users')
    .orderByKey()
    .startAt(`${userId}_`)
    .endAt(`${userId}_\uf8ff`)
    .limitToFirst(1)
    .once('value');
  return snapshot.exists();
}

// Shared attendance copies of forgotten clock-ins that exist. If the check
// fails, the scan still goes ahead and those copies are left as they are.
async function existingSharedPaths(db, userId, attendance, currentDate) {
  try {
    const paths = splitOpenClockIns(attendance, currentDate)
      .stale.map((item) => sharedPathFor(item, userId))
      .filter(Boolean);
    const snapshots = await Promise.all(paths.map((path) => db.ref(path).once('value')));
    return new Set(paths.filter((_, index) => snapshots[index].exists()));
  } catch (error) {
    console.error('[attendance-scan] could not check shared attendance copies', error);
    return new Set();
  }
}

// The scheduled events on the user's calendar, for marking attendance, plus
// the event-type names by key (the Scheduler saves a type's key, the scanner
// sends its name). If they can't be read, the clock-in still goes ahead (as
// it always has) and the event can be marked by hand.
async function loadScheduledEvents(db, schedule) {
  const none = { scheduledEvents: [], eventTypeNames: {} };
  try {
    const ids = Object.keys(schedule || {});
    if (ids.length === 0) return none;
    const [snapshots, types] = await Promise.all([
      Promise.all(ids.map((id) => db.ref(`events/${id}`).once('value'))),
      db.ref('eventTypes').once('value'),
    ]);
    return {
      scheduledEvents: snapshots
        .map((snapshot, index) => ({ id: ids[index], data: snapshot.val() }))
        .filter((event) => event.data),
      eventTypeNames: eventTypeNamesByKey(types.val()),
    };
  } catch (error) {
    console.error('[attendance-scan] could not read scheduled events', error);
    return none;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const caller = await requireAdmin(req);
    const scan = parseScan(req.body);
    const db = getAdmin().database();
    const now = moment().tz(TIMEZONE);

    const lockId = await acquireScanLock(db, scan.userId, caller.uid, now.valueOf());
    try {
      const userData = (await db.ref(`users/${scan.userId}`).once('value')).val();
      if (!userData || typeof userData !== 'object') throw new HttpError(404, 'User not found in the system');
      if (await isDeleted(db, scan.userId)) throw new HttpError(409, 'User account is inactive or deleted');

      const currentDate = now.format('YYYY-MM-DD');
      const existingShared = await existingSharedPaths(db, scan.userId, userData.attendance, currentDate);
      const plan =
        scan.mode === 'clock-in'
          ? planClockIn({
              ...scan,
              userData,
              now,
              existingShared,
              ...(await loadScheduledEvents(db, userData.schedule)),
            })
          : planClockOut({ ...scan, userData, now, existingShared });

      // One atomic write: the scan, every copy it touches, and the lock release.
      await confirmScanLock(db, scan.userId, lockId);
      await db.ref().update({ ...plan.updates, [`scanLocks/${scan.userId}`]: null });
      console.log(`[attendance-scan] ${caller.uid} ${plan.result.mode} ${scan.userId}`);
      return res.status(200).json({ success: true, ...plan.result });
    } catch (error) {
      await releaseScanLock(db, scan.userId, lockId);
      throw error;
    }
  } catch (error) {
    return sendError(res, error, 'attendance-scan');
  }
}

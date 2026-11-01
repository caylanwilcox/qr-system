// Unit tests for the data-pipeline fixes. Synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { normalizeRole, hasRoleAtLeast, resolveRole } from '../../src/utils/roles.js';
import { buildParticipantUpdates } from '../../src/utils/eventParticipants.js';
import {
  normalizeEventType,
  sameEventType,
  splitOpenClockIns,
  staleClockInUpdates,
  eventCoversDate,
  findEventsToMarkAttended,
  prefixKeys,
  pickOpenClockIn,
  sharedPathFor,
  composeClockInUpdates,
  composeClockOutUpdates,
  MAX_SHIFT_MS,
  hasScheduledEventsToday,
  isLateForScheduledEvents,
  TIMEZONE,
} from '../../src/utils/attendanceRules.js';
import moment from 'moment-timezone';
import {
  profileToForm,
  locationOptions,
  buildProfileUpdates,
} from '../../src/components/EmployeeProfile/profileForm.js';

const require = createRequire(import.meta.url);
const reset = require('../../scripts/reset-system-data.js');

// Multi-path updates fail if one path is inside another.
function assertNoNestedPaths(updates) {
  const keys = Object.keys(updates);
  keys.forEach((a) => keys.forEach((b) => {
    assert.ok(a === b || !b.startsWith(`${a}/`), `${b} is inside ${a}`);
  }));
}

// --- roles ---------------------------------------------------------------

test('normalizeRole reads every stored spelling', () => {
  assert.equal(normalizeRole('super-admin'), 'super_admin');
  assert.equal(normalizeRole('SUPER_ADMIN'), 'super_admin');
  assert.equal(normalizeRole('Super Admin'), 'super_admin');
  assert.equal(normalizeRole('superadmin'), 'super_admin');
  assert.equal(normalizeRole('EMPLOYEE'), 'employee');
  assert.equal(normalizeRole('admin'), 'admin');
  assert.equal(normalizeRole('boss'), null);
  assert.equal(normalizeRole(null), null);
});

test('hasRoleAtLeast lets a hyphenated super admin into super admin pages', () => {
  assert.equal(hasRoleAtLeast('super-admin', 'SUPER_ADMIN'), true);
  assert.equal(hasRoleAtLeast('admin', 'SUPER_ADMIN'), false);
  assert.equal(hasRoleAtLeast('admin', 'EMPLOYEE'), true);
  assert.equal(hasRoleAtLeast('unknown', 'EMPLOYEE'), false);
  assert.equal(hasRoleAtLeast('admin', undefined), false);
});

test('resolveRole: a stored role wins over a stale login claim', () => {
  assert.equal(resolveRole('employee', 'admin'), 'employee', 'demoted admin');
  assert.equal(resolveRole('regular', 'admin'), 'employee', 'unknown stored role is employee');
  assert.equal(resolveRole(undefined, 'admin'), 'admin', 'nothing stored: use the claim');
  assert.equal(resolveRole('', 'super-admin'), 'super_admin');
  assert.equal(resolveRole(null, null), 'employee');
});

// --- event participants ---------------------------------------------------

test('re-saving participants keeps existing attendance', () => {
  const existing = { 'uid-a': { assigned: true, assignedAt: 'x', attended: true, attendedAt: 'y' } };
  const { updates, added, removed } = buildParticipantUpdates({
    eventId: 'ev1', existing, nextIds: ['uid-a', 'uid-b'], changedBy: 'admin-1', now: 'NOW',
  });
  assert.equal('events/ev1/participants/uid-a' in updates, false, 'existing participant untouched');
  assert.deepEqual(updates['events/ev1/participants/uid-b'], { assigned: true, assignedAt: 'NOW', attended: false });
  assert.equal(updates['users/uid-a/schedule/ev1'], true);
  assert.equal(updates['users/uid-b/schedule/ev1'], true);
  assert.deepEqual(added, ['uid-b']);
  assert.deepEqual(removed, []);
  assert.equal('events/ev1/participants' in updates, false, 'never replaces the whole node');
  assertNoNestedPaths(updates);
});

test('removed participants lose their entry and calendar link', () => {
  const { updates, removed } = buildParticipantUpdates({
    eventId: 'ev1', existing: { 'uid-a': true, 'uid-c': { assigned: true } }, nextIds: ['uid-a'], changedBy: 'admin-1', now: 'NOW',
  });
  assert.equal(updates['events/ev1/participants/uid-c'], null);
  assert.equal(updates['users/uid-c/schedule/ev1'], null);
  assert.deepEqual(removed, ['uid-c']);
  assertNoNestedPaths(updates);
});

test('an event with no participants adds everyone', () => {
  const { added } = buildParticipantUpdates({ eventId: 'ev1', existing: null, nextIds: ['uid-a', 'uid-b'], now: 'NOW' });
  assert.deepEqual(added, ['uid-a', 'uid-b']);
});

// --- attendance rules -----------------------------------------------------

test('normalizeEventType keeps the scanner storage keys', () => {
  assert.equal(normalizeEventType('General'), 'generalmeeting');
  assert.equal(normalizeEventType('JUNTA_HACIENDA'), 'juntahacienda');
  assert.equal(normalizeEventType('Junta de Hacienda'), 'juntahacienda');
  assert.equal(normalizeEventType('HACIENDAS'), 'haciendas');
});

test('sameEventType ignores case and punctuation', () => {
  assert.equal(sameEventType('haciendas', 'HACIENDAS'), true);
  assert.equal(sameEventType('juntaHacienda', 'Junta de Hacienda'), true);
  assert.equal(sameEventType('GENERAL_MEETING', 'general'), true);
  assert.equal(sameEventType('gestion', 'workshops'), false);
  assert.equal(sameEventType('', ''), false);
});

const attendance = {
  '2026-11-01_200': { status: 'clocked-in', clockedIn: true, clockInTimestamp: 200, date: '2026-11-01' },
  '2026-11-01_100': { status: 'completed', clockedIn: false, clockInTimestamp: 100, date: '2026-11-01' },
  '2026-11-01_300_out': { status: 'clock-out-only', clockedIn: false, date: '2026-11-01' },
  '2026-10-30_50': { status: 'clocked-in', clockedIn: true, clockInTimestamp: 50, date: '2026-10-30' },
  '2026-10-31_60': { status: 'clocked-in', clockedIn: true, clockInTimestamp: 60 },
};

test('splitOpenClockIns finds today and stale open records only', () => {
  const { openToday, stale } = splitOpenClockIns(attendance, '2026-11-01');
  assert.deepEqual(openToday.map((r) => r.key), ['2026-11-01_200']);
  assert.deepEqual(stale.map((r) => r.key), ['2026-10-31_60', '2026-10-30_50'], 'newest first; date from key when missing');
  assert.deepEqual(splitOpenClockIns(undefined, '2026-11-01'), { openToday: [], stale: [] });
});

test('staleClockInUpdates marks forgotten clock-ins missed', () => {
  const updates = staleClockInUpdates([{ key: '2026-10-30_50' }], 999);
  assert.deepEqual(updates, {
    'attendance/2026-10-30_50/status': 'missed-clock-out',
    'attendance/2026-10-30_50/clockedIn': false,
    'attendance/2026-10-30_50/autoClosedAt': 999,
  });
});

test('eventCoversDate uses Chicago time, not UTC', () => {
  // 9 pm Chicago on Nov 1 is already Nov 2 in UTC.
  assert.equal(eventCoversDate({ start: '2026-11-02T03:00:00Z' }, '2026-11-01'), true);
  assert.equal(eventCoversDate({ start: '2026-11-02T03:00:00Z' }, '2026-11-02'), false);
  assert.equal(eventCoversDate({ start: '2026-10-30T15:00:00Z', end: '2026-11-02T15:00:00Z' }, '2026-11-01'), true, 'multi-day');
  assert.equal(eventCoversDate({}, '2026-11-01'), false);
});

test('findEventsToMarkAttended picks today\'s matching events the user is in', () => {
  const today = '2026-11-01T15:00:00Z';
  const events = [
    { id: 'match', data: { start: today, eventType: 'HACIENDAS', participants: { u1: { assigned: true, attended: false } } } },
    { id: 'bare-true', data: { start: today, eventType: 'haciendas', participants: { u1: true } } },
    { id: 'by-category', data: { start: today, eventType: 'other', category: 'Haciendas', participants: { u1: { assigned: true } } } },
    { id: 'already', data: { start: today, eventType: 'haciendas', participants: { u1: { attended: true } } } },
    { id: 'not-in-it', data: { start: today, eventType: 'haciendas', participants: { u2: true } } },
    { id: 'other-day', data: { start: '2026-11-05T15:00:00Z', eventType: 'haciendas', participants: { u1: true } } },
    { id: 'other-type', data: { start: today, eventType: 'workshops', participants: { u1: true } } },
  ];
  const ids = findEventsToMarkAttended({ events, userId: 'u1', dateStr: '2026-11-01', eventType: 'haciendas' });
  assert.deepEqual(ids, ['match', 'bare-true', 'by-category']);
});

test('two same-type events today: the scanned location wins', () => {
  const today = '2026-11-01T15:00:00Z';
  const participants = { u1: { assigned: true } };
  const events = [
    { id: 'aurora', data: { start: today, eventType: 'haciendas', location: 'Aurora', participants } },
    { id: 'joliet', data: { start: today, eventType: 'haciendas', location: 'Joliet', participants } },
  ];
  const pick = (locationKey, list = events) =>
    findEventsToMarkAttended({ events: list, userId: 'u1', dateStr: '2026-11-01', eventType: 'haciendas', locationKey });
  assert.deepEqual(pick('joliet'), ['joliet']);
  assert.deepEqual(pick('elgin'), ['aurora', 'joliet'], 'no location match: keep both');
  assert.deepEqual(pick('elgin', [events[0]]), ['aurora'], 'a single match is marked wherever it is');
});

test('pickOpenClockIn: a shift past midnight is still open', () => {
  const now = Date.UTC(2026, 10, 1, 6, 10); // 12:10 am Chicago
  const lastNight = now - 40 * 60 * 1000;
  const records = {
    '2026-10-31_a': { status: 'clocked-in', clockedIn: true, clockInTimestamp: lastNight, date: '2026-10-31' },
    '2026-10-29_b': { status: 'clocked-in', clockedIn: true, clockInTimestamp: now - 3 * 24 * 3600 * 1000, date: '2026-10-29' },
  };
  const { open, stale } = pickOpenClockIn(records, '2026-11-01', now);
  assert.equal(open.key, '2026-10-31_a');
  assert.deepEqual(stale.map((r) => r.key), ['2026-10-29_b']);

  const later = lastNight + MAX_SHIFT_MS + 1;
  const tooOld = pickOpenClockIn(records, '2026-11-01', later);
  assert.equal(tooOld.open, null);
  assert.equal(tooOld.stale.length, 2);

  // Forgot to clock out at 9 pm; scanning out at 9 am is 12 hours later: missed.
  const forgotten = { '2026-10-31_c': { status: 'clocked-in', clockedIn: true, clockInTimestamp: 0, date: '2026-10-31' } };
  assert.equal(pickOpenClockIn(forgotten, '2026-11-01', 12 * 3600 * 1000).open, null);

  const today = pickOpenClockIn(attendance, '2026-11-01', 1000);
  assert.equal(today.open.key, '2026-11-01_200', "today's open record wins");
});

test('sharedPathFor uses the record\'s own location and date', () => {
  const item = { key: '2026-10-30_50', record: { location: 'joliet' } };
  assert.equal(sharedPathFor(item, 'u1'), 'attendance/joliet/2026-10-30/u1');
  assert.equal(sharedPathFor({ key: '2026-10-30_50', record: {} }, 'u1'), null);
  assert.equal(sharedPathFor({ key: '2026-10-30_50', record: {} }, 'u1', 'aurora'), 'attendance/aurora/2026-10-30/u1');
});

test('the composed clock-in update is one valid multi-path write', () => {
  const updates = composeClockInUpdates({
    userId: 'u1',
    userUpdates: {
      clockedIn: true,
      'attendance/2026-11-01_9/status': 'clocked-in',
      ...staleClockInUpdates([{ key: '2026-10-30_50' }], 9),
    },
    sharedPath: 'attendance/joliet/2026-11-01/u1',
    sharedRecord: { status: 'clocked-in' },
    attendedEventIds: ['ev1'],
    attendedAt: 'T',
    staleSharedPaths: ['attendance/joliet/2026-10-30/u1'],
  });
  assert.equal(updates['users/u1/clockedIn'], true);
  assert.equal(updates['users/u1/attendance/2026-10-30_50/status'], 'missed-clock-out');
  assert.deepEqual(updates['attendance/joliet/2026-11-01/u1'], { status: 'clocked-in' });
  assert.equal(updates['events/ev1/participants/u1/attended'], true);
  assert.equal(updates['attendance/joliet/2026-10-30/u1/status'], 'missed-clock-out');
  assertNoNestedPaths(updates);
});

test('the composed clock-out update closes the shared copy at its own path', () => {
  const updates = composeClockOutUpdates({
    userId: 'u1',
    userUpdates: { clockedIn: false, 'attendance/2026-10-31_a/status': 'completed' },
    sharedPath: 'attendance/joliet/2026-10-31/u1',
    clockOut: { time: 'T', timestamp: 5, hoursWorked: '0.67' },
    staleSharedPaths: ['attendance/aurora/2026-10-29/u1'],
  });
  assert.equal(updates['attendance/joliet/2026-10-31/u1/status'], 'completed');
  assert.equal(updates['attendance/joliet/2026-10-31/u1/hoursWorked'], '0.67');
  assert.equal(updates['attendance/aurora/2026-10-29/u1/status'], 'missed-clock-out');
  assertNoNestedPaths(updates);
  const flagOnly = composeClockOutUpdates({ userId: 'u1', userUpdates: { clockedIn: false }, sharedPath: null });
  assert.deepEqual(flagOnly, { 'users/u1/clockedIn': false });
});

test('prefixKeys roots relative paths', () => {
  assert.deepEqual(prefixKeys({ a: 1, 'b/c': 2 }, 'users/u1/'), { 'users/u1/a': 1, 'users/u1/b/c': 2 });
});

// --- profile form ----------------------------------------------------------

const locations = [{ key: 'joliet', name: 'Joliet' }, { key: 'westchicago', name: 'West Chicago' }];

test('profileToForm fills location even without primaryLocation', () => {
  assert.equal(profileToForm({ locationKey: 'joliet', location: 'Joliet' }).location, 'joliet');
  assert.equal(profileToForm({ location: 'West Chicago' }).location, 'westchicago');
  assert.equal(profileToForm({}, 'joliet').location, 'joliet');
  assert.equal(profileToForm(undefined).location, '');
});

test('saving an unchanged form writes nothing', () => {
  const profile = { name: 'A', email: 'a@example.com', locationKey: 'joliet', location: 'Joliet', role: 'admin', status: 'active' };
  const baseline = profileToForm(profile, 'joliet');
  assert.deepEqual(buildProfileUpdates({ userId: 'u1', formData: { ...baseline }, baseline, locations }), {});
});

test('saving writes only changed fields', () => {
  const baseline = profileToForm({ name: 'A', phone: '1', locationKey: 'joliet', role: 'admin' }, 'joliet');
  const updates = buildProfileUpdates({
    userId: 'u1', formData: { ...baseline, phone: '2', name: 'B' }, baseline, locations,
  });
  assert.deepEqual(updates, {
    'users/u1/profile/phone': '2',
    'users/u1/profile/name': 'B',
    'users/u1/name': 'B',
  });
});

test('a location change writes key and name in the AddNewEmployee shape', () => {
  const baseline = profileToForm({ locationKey: 'joliet' }, 'joliet');
  const updates = buildProfileUpdates({ userId: 'u1', formData: { ...baseline, location: 'westchicago' }, baseline, locations });
  assert.deepEqual(updates, {
    'users/u1/location': 'westchicago',
    'users/u1/profile/locationKey': 'westchicago',
    'users/u1/profile/location': 'West Chicago',
  });
});

test('a blank or unknown location is never written', () => {
  const baseline = profileToForm({ locationKey: 'joliet' }, 'joliet');
  for (const location of ['', 'Agua Viva Joliet']) {
    const updates = buildProfileUpdates({ userId: 'u1', formData: { ...baseline, location }, baseline, locations });
    assert.deepEqual(updates, {}, `location "${location}"`);
  }
  // No location list loaded (employee dashboard): nothing is written either.
  const updates = buildProfileUpdates({ userId: 'u1', formData: { ...baseline, location: 'westchicago' }, baseline, locations: [] });
  assert.deepEqual(updates, {});
});

test('locationOptions keeps an unlisted stored location visible', () => {
  const options = locationOptions(locations, { location: 'Agua Viva Lyons' });
  assert.deepEqual(options.at(-1), { key: 'aguavivalyons', name: 'Agua Viva Lyons (not in location list)' });
  assert.deepEqual(locationOptions([], { location: 'Joliet' }), [{ key: 'joliet', name: 'Joliet' }]);
  assert.equal(locationOptions(locations, { locationKey: 'joliet' }).length, 2);
});

// --- reset script ------------------------------------------------------------

const resetData = {
  attendance: { joliet: {} },
  events: { e1: {}, e2: {} },
  deleted_users: null,
  users: {
    u1: { profile: { padrino: true, padrinoColor: 'red' }, clockedIn: true, clockOutTimes: { 1: 'x' }, stats: {} },
    u2: { profile: {}, schedule: { e1: true } },
  },
};

test('buildResetUpdates clears clock flags so nobody stays clocked in', () => {
  const updates = reset.buildResetUpdates(resetData.users);
  for (const field of ['clockedIn', 'clockOutTimes', 'clockedInDate', 'activityLog', 'attendance', 'schedule']) {
    assert.equal(updates[`users/u1/${field}`], null, field);
  }
  assert.equal(updates.attendance, null);
  assert.equal(updates.events, null);
  assert.equal(updates['users/u1/profile/padrinoColor'], 'blue');
  assert.equal('users/u2/profile/padrinoColor' in updates, false);
  assertNoNestedPaths(updates);
});

test('buildBackup holds everything the reset removes', () => {
  const backup = reset.buildBackup(resetData);
  assert.deepEqual(backup.events, resetData.events);
  assert.equal(backup.deleted_users, null);
  assert.deepEqual(backup.users.u1.clockOutTimes, { 1: 'x' });
  assert.equal(backup.users.u1.profile.padrinoColor, 'red');
  assert.deepEqual(backup.users.u2, { schedule: { e1: true } });
});

test('summarize and confirmation guard', () => {
  const lines = reset.summarize(resetData);
  assert.ok(lines.includes('events: 2 entries deleted'));
  assert.ok(lines.includes('users/*/clockedIn: cleared on 1 users'));
  assert.equal(reset.confirmationMatches(' qr-system-1cea7 ', 'qr-system-1cea7'), true);
  assert.equal(reset.confirmationMatches('yes', 'qr-system-1cea7'), false);
  assert.equal(reset.confirmationMatches('', ''), false);
});

test('reset refuses a database from another project', () => {
  const ok = 'https://qr-system-1cea7-default-rtdb.firebaseio.com';
  assert.equal(reset.databaseMatchesProject(ok, 'qr-system-1cea7'), true);
  assert.equal(reset.databaseMatchesProject('https://qr-system-1cea7.firebaseio.com', 'qr-system-1cea7'), true);
  assert.equal(reset.databaseMatchesProject('https://qr-system-1cea7x-default-rtdb.firebaseio.com', 'qr-system-1cea7'), false);
  assert.equal(reset.databaseMatchesProject('https://other-default-rtdb.firebaseio.com', 'qr-system-1cea7'), false);
  assert.equal(reset.databaseMatchesProject('not a url', 'qr-system-1cea7'), false);
  assert.equal(reset.databaseMatchesProject(ok, ''), false);
});

// --- Late check (moved from the scanner page to run on the server) ---
const chicago = (value) => moment.tz(value, 'YYYY-MM-DD HH:mm', TIMEZONE);
const withEvents = (events) => ({ events: { workshops: events } });

test('late check reads times without an offset as Chicago time, as the scanner did', () => {
  const user = withEvents({ w1: { scheduled: true, date: '2026-11-02T09:00' } });
  assert.equal(hasScheduledEventsToday(user, '2026-11-02'), true);
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 08:50')), false);
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 09:30')), true);
});

test('late check honors explicit offsets and uses the earliest start of the day', () => {
  const user = withEvents({
    w1: { scheduled: true, date: '2026-11-02T16:00:00.000Z' }, // 10:00 Chicago
    w2: { scheduled: true, date: '2026-11-02T13:00' },
  });
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 09:59')), false);
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 10:01')), true);
});

test('a date-only event counts as scheduled but never makes anyone late', () => {
  const user = withEvents({ w1: { scheduled: true, date: '2026-11-02' } });
  assert.equal(hasScheduledEventsToday(user, '2026-11-02'), true);
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 23:00')), false);
});

test('multi-day events count on every day they span; unscheduled entries are ignored', () => {
  const user = withEvents({
    h1: { scheduled: true, date: '2026-11-01T08:00', endDate: '2026-11-03T18:00' },
    w2: { scheduled: false, date: '2026-11-02T07:00' },
  });
  assert.equal(hasScheduledEventsToday(user, '2026-11-02'), true);
  assert.equal(hasScheduledEventsToday(user, '2026-11-04'), false);
  assert.equal(isLateForScheduledEvents(user, '2026-11-01', chicago('2026-11-01 07:30')), false);
  assert.equal(isLateForScheduledEvents(user, '2026-11-01', chicago('2026-11-01 08:30')), true);
  // Existing behavior, kept unchanged by the move: on later days of a
  // multi-day event the scanner compares with the first day's start, so any
  // clock-in counts as late. Fixing that is a separate, deliberate change.
  assert.equal(isLateForScheduledEvents(user, '2026-11-02', chicago('2026-11-02 07:30')), true);
});

// Tests for database.rules.json, run against the local database emulator:
//   npm run test:rules
// Needs the Firebase CLI and Java. Uses a demo project, so it can never
// reach the real database. Synthetic data only.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-qr-rules';
if (!HOST) throw new Error('Run with `npm run test:rules` so the database emulator is running.');
if (!PROJECT.startsWith('demo-')) throw new Error('Refusing to run against a non-demo project.');
const NAMESPACE = `${PROJECT}-default-rtdb`;

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

// An unsigned ID token; the emulator accepts these, the real database never does.
function idToken(uid, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    firebase: { sign_in_provider: 'password', identities: {} },
    ...claims,
  })}.`;
}

const PEOPLE = {
  super: idToken('super1', { role: 'super_admin', admin: true, superAdmin: true }),
  admin: idToken('admin1', { role: 'admin', admin: true }),
  legacyClaim: idToken('legacy1', { role: 'SUPER-ADMIN' }),
  unsynced: idToken('unsynced1'), // database role admin, no claims yet
  employee: idToken('emp1', { role: 'employee' }),
  lookalike: idToken('emp2', { role: 'administrator' }),
  newcomer: idToken('fresh1'), // has a login, no database record yet
};

async function request(method, path, { as, body } = {}) {
  const url = new URL(`http://${HOST}/${path}.json`);
  url.searchParams.set('ns', NAMESPACE);
  const headers = { 'Content-Type': 'application/json' };
  if (as === 'owner') headers.Authorization = 'Bearer owner';
  else if (as) url.searchParams.set('auth', PEOPLE[as]);
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  await response.text();
  return response.status;
}

const allowed = async (promise, label) => assert.equal(await promise, 200, `${label} should be allowed`);
const denied = async (promise, label) => assert.equal(await promise, 401, `${label} should be denied`);
const read = (as, path) => request('GET', path, { as });
const set = (as, path, body) => request('PUT', path, { as, body });
const patch = (as, path, body) => request('PATCH', path, { as, body });

beforeEach(async () => {
  await set('owner', '', {
    users: {
      emp1: { name: 'E', location: 'aurora', profile: { name: 'E', role: 'employee', phone: '1', status: 'active' }, stats: { daysPresent: 2 } },
      emp2: { profile: { role: 'employee' } },
      unsynced1: { profile: { role: 'admin' } },
      admin1: { profile: { role: 'admin' } },
    },
    events: { ev1: { title: 'T', location: 'aurora', participants: { emp1: { assigned: true } } } },
    eventTypes: { workshops: { name: 'Workshops' } },
    locations: { aurora: { name: 'Aurora', key: 'aurora' } },
    managementStructure: { admin1: { managedLocations: { aurora: true } } },
    attendance: { aurora: { '2026-11-01': { emp1: { status: 'completed' } } } },
    userCredentials: { emp1: { secret: 'x' } },
  });
});

test('signed-out visitors can read and write nothing', async () => {
  for (const path of ['', 'users', 'users/emp1', 'events', 'locations', 'eventTypes']) {
    await denied(read(null, path), `read ${path || 'root'}`);
  }
  await denied(set(null, 'users/emp1/profile/phone', '2'), 'write phone');
});

test('employees read their own record and the shared lists, nothing else', async () => {
  await allowed(read('employee', 'users/emp1'), 'own record');
  await allowed(read('employee', 'events'), 'events (dashboard stats)');
  await allowed(read('employee', 'events/ev1'), 'one event (schedule)');
  await allowed(read('employee', 'eventTypes'), 'event types');
  await allowed(read('employee', 'locations'), 'locations');
  for (const path of ['', 'users', 'users/emp2', 'managementStructure', 'attendance', 'userCredentials']) {
    await denied(read('employee', path), `read ${path || 'root'}`);
  }
});

test('employees can edit their own contact details, as the dashboard does', async () => {
  await allowed(patch('employee', 'users/emp1/profile', { phone: '2' }), 'phone');
  await allowed(patch('employee', 'users/emp1/profile', { emergencyContact: 'K', emergencyPhone: '3' }), 'emergency contact');
  await allowed(
    patch('employee', '', {
      'users/emp1/profile/name': 'E2',
      'users/emp1/name': 'E2',
      'users/emp1/profile/email': 'e2@example.com',
      'users/emp1/email': 'e2@example.com',
      'users/emp1/profile/authUid': 'emp1',
      'users/emp1/profile/updatedAt': '2026-11-01T00:00:00.000Z',
    }),
    'Personal Info save'
  );
  await allowed(patch('employee', 'users/emp1', { 'stats/lastLogin': '2026-11-01T00:00:00.000Z' }), 'last login');
});

test('employees cannot raise their own access or change their records', async () => {
  const attempts = {
    'users/emp1/profile/role': 'super_admin',
    'users/emp1/role': 'admin',
    'users/emp1/userRole': 'super_admin',
    'users/emp1/profile/userRole': 'super_admin',
    'users/emp1/profile/status': 'inactive',
    'users/emp1/profile/padrino': true,
    'users/emp1/location': 'joliet',
    'users/emp1/stats/daysPresent': 99,
    'users/emp1/clockedIn': true,
    'users/emp1/attendance/2026-11-01_1/status': 'completed',
    'users/emp1/profile/authUid': 'someone-else',
    'users/emp2/profile/phone': '9',
    'managementStructure/emp1/managedLocations/aurora': true,
    'attendance/aurora/2026-11-01/emp1/status': 'clocked-in',
    'events/ev1/participants/emp1/attended': true,
  };
  for (const [path, value] of Object.entries(attempts)) {
    await denied(set('employee', path, value), path);
  }
  // One forbidden path sinks the whole multi-path update.
  await denied(patch('employee', '', { 'users/emp1/profile/phone': '5', 'users/emp1/profile/role': 'admin' }), 'mixed update');
  await denied(set('employee', 'users/emp1', { profile: { name: 'E' } }), 'replacing the existing record');
});

test('a new login may create its own basic record, but never with a role', async () => {
  const basic = {
    profile: { email: 'f@example.com', status: 'active', name: 'f', createdAt: '2026-11-01T00:00:00.000Z' },
    stats: { lastLogin: '2026-11-01T00:00:00.000Z' },
  };
  await denied(set('newcomer', 'users/fresh1', { ...basic, profile: { ...basic.profile, role: 'admin' } }), 'with profile.role');
  await denied(set('newcomer', 'users/fresh1', { ...basic, role: 'admin' }), 'with a root role');
  // The server also reads these older role fields, so they must be refused too.
  await denied(set('newcomer', 'users/fresh1', { ...basic, userRole: 'super_admin' }), 'with a root userRole');
  await denied(set('newcomer', 'users/fresh1', { ...basic, profile: { ...basic.profile, userRole: 'super_admin' } }), 'with profile.userRole');
  await denied(set('newcomer', 'users/fresh1', { ...basic, profile: { ...basic.profile, status: 'admin' } }), 'with a made-up status');
  await denied(set('newcomer', 'users/fresh1', { ...basic, stats: { lastLogin: 'x', daysPresent: 50 } }), 'with stats');
  await denied(set('newcomer', 'users/fresh1', { ...basic, attendance: { a: { status: 'completed' } } }), 'with attendance');
  await denied(set('newcomer', 'users/emp1', basic), "someone else's record");
  await allowed(set('newcomer', 'users/fresh1', basic), 'Login.js basic record');
  await denied(set('newcomer', 'users/fresh1', basic), 'second create once the record exists');
});

test('admins and super admins (by login claim) can read and write everything', async () => {
  for (const who of ['admin', 'super', 'legacyClaim']) {
    await allowed(read(who, ''), `${who} reads root`);
    await allowed(set(who, 'attendance/aurora/2026-11-02/emp1', { status: 'clocked-in' }), `${who} writes attendance`);
    await allowed(set(who, 'users/emp1/profile/role', 'employee'), `${who} writes a role`);
    await allowed(set(who, 'managementStructure/admin1/managedLocations/joliet', true), `${who} writes management`);
    await allowed(set(who, 'events/ev2', { title: 'New' }), `${who} creates an event`);
    await allowed(set(who, 'users/emp1/profile/status', 'inactive'), `${who} changes a status`);
    await allowed(set(who, 'users/emp1/attendance/2026-11-02_1', { status: 'completed' }), `${who} edits attendance`);
    await allowed(set(who, 'users/new9', { profile: { role: 'employee', padrino: true }, stats: { daysPresent: 0 } }), `${who} writes a whole record`);
  }
});

test('admin access needs the login claim, not just a database role', async () => {
  // Run scripts/sync-role-claims.js --apply before deploying these rules.
  await denied(read('unsynced', 'users'), 'database-role admin without claims');
  await denied(read('lookalike', 'users'), '"administrator" is not a role');
});

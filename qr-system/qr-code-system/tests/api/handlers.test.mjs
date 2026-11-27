// Behavior tests for the /api functions, run with: npm run test:api
// firebase-admin and nodemailer are replaced with in-memory fakes (see register-fakes.mjs).
import './register-fakes.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

Object.assign(process.env, {
  FIREBASE_PROJECT_ID: 'test',
  FIREBASE_CLIENT_EMAIL: 'test@example.com',
  FIREBASE_PRIVATE_KEY: 'test',
  FIREBASE_DATABASE_URL: 'https://example.invalid',
});

const { default: updateUserAuth } = await import('../../api/admin/update-user-auth.js');
const { default: createUser } = await import('../../api/admin/create-user.js');
const { default: scan } = await import('../../api/attendance/scan.js');
const { default: moment } = await import('moment-timezone');
const { default: sendEventNotifications } = await import('../../api/send-event-notifications.js');

beforeEach(() => {
  globalThis.__fake = {
    calls: [],
    mails: [],
    // ID token -> decoded token (custom claims appear at the top level)
    tokens: {
      super: { uid: 'super1', role: 'super_admin', admin: true, superAdmin: true },
      admin: { uid: 'admin1', role: 'admin', admin: true },
      employee: { uid: 'emp1', role: 'employee' },
      legacyAdmin: { uid: 'legacyAdmin' }, // no role claim yet
      legacyEmployee: { uid: 'legacyEmp' }, // no role claim yet
      escalated: { uid: 'sneaky', role: 'employee' }, // edited own database role
    },
    authUsers: {
      emp1: { uid: 'emp1', email: 'emp1@example.com', customClaims: { role: 'employee' } },
      emp2: { uid: 'emp2', email: 'emp2@example.com', customClaims: { role: 'employee', other: 1 } },
      admin2: { uid: 'admin2', email: 'admin2@example.com', customClaims: { role: 'admin', admin: true } },
      super1: { uid: 'super1', email: 'super@example.com', customClaims: { role: 'super_admin', admin: true, superAdmin: true } },
    },
    db: {
      users: {
        admin1: { profile: { role: 'admin', locationKey: 'aurora' } },
        legacyAdmin: { profile: { role: 'Admin', locationKey: 'elgin' } },
        legacyEmp: { profile: { role: 'employee' } },
        sneaky: { profile: { role: 'super_admin' } },
        emp1: { location: 'aurora', profile: { role: 'employee', email: 'emp1@example.com' } },
        emp2: { location: 'joliet', profile: { role: 'employee', email: 'emp2@example.com' } },
        admin2: { location: 'aurora', profile: { role: 'admin' } },
        dbOnly: { location: 'Aurora', profile: { role: 'employee', email: 'new@example.com', name: 'New' } },
        e1: { profile: { email: 'e1@example.com' } },
        e2: { profile: { email: 'E1@example.com ' } },
        e3: { profile: { email: 'not-an-email' } },
      },
      managementStructure: {
        admin1: { role: 'admin', managedLocations: { Aurora: true } },
        admin2: { role: 'admin', managedLocations: { aurora: true } },
      },
      locations: {
        aurora: { name: 'Aurora', key: 'aurora' },
        joliet: { name: 'Joliet', key: 'joliet' },
        lyons: { name: 'Agua Viva Lyons', key: 'lyons' },
      },
    },
  };
});

const fake = () => globalThis.__fake;
const findCall = (name) => fake().calls.find((call) => call[0] === name);

async function call(handler, token, body, method = 'POST') {
  const res = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end() { return this; },
  };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
}

const resetPassword = (token, userId) =>
  call(updateUserAuth, token, { userId, updates: { password: 'secret12' } });

// --- update-user-auth: who may call it ---
test('rejects missing and invalid tokens', async () => {
  assert.equal((await call(updateUserAuth, null, { userId: 'emp1', updates: { displayName: 'x' } })).statusCode, 401);
  assert.equal((await call(updateUserAuth, 'bogus', { userId: 'emp1', updates: { displayName: 'x' } })).statusCode, 401);
});

test('rejects employees, including one who edited their own database role', async () => {
  assert.equal((await resetPassword('employee', 'emp2')).statusCode, 403);
  assert.equal((await resetPassword('escalated', 'super1')).statusCode, 403);
  assert.equal((await resetPassword('legacyEmployee', 'emp1')).statusCode, 403);
});

test('location admin cannot touch admins or users at other locations', async () => {
  assert.equal((await resetPassword('admin', 'super1')).statusCode, 403);
  assert.equal((await resetPassword('admin', 'admin2')).statusCode, 403);
  assert.equal((await resetPassword('admin', 'emp2')).statusCode, 403);
});

test('only super admins can change roles', async () => {
  const res = await call(updateUserAuth, 'admin', { userId: 'emp1', updates: { role: 'super_admin' } });
  assert.equal(res.statusCode, 403);
});

// --- update-user-auth: what it changes ---
test('admin updates an employee at their location; unlisted fields are dropped', async () => {
  const res = await call(updateUserAuth, 'admin', {
    userId: 'emp1',
    updates: { password: 'secret12', disabled: true, emailVerified: false, role: '' },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(findCall('updateUser')[2], { password: 'secret12' });
  assert.equal(findCall('setClaims'), undefined);
});

test('admin without role claims falls back to database role until the fallback is disabled', async () => {
  fake().db.users.emp1.location = 'elgin';
  const body = { userId: 'emp1', updates: { displayName: 'Y' } };
  assert.equal((await call(updateUserAuth, 'legacyAdmin', body)).statusCode, 200);

  process.env.ALLOW_DB_ROLE_FALLBACK = 'false';
  try {
    assert.equal((await call(updateUserAuth, 'legacyAdmin', body)).statusCode, 403);
  } finally {
    delete process.env.ALLOW_DB_ROLE_FALLBACK;
  }
});

test('super admin role change keeps unrelated claims', async () => {
  const res = await call(updateUserAuth, 'super', { userId: 'emp2', updates: { role: 'ADMIN' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(findCall('setClaims')[2], { other: 1, role: 'admin', admin: true });
});

test('creating a login without a password uses a random one that is never returned', async () => {
  const first = await call(updateUserAuth, 'admin', { userId: 'dbOnly', updates: { displayName: 'New' } });
  assert.equal(first.statusCode, 201, JSON.stringify(first.body));
  assert.equal(first.body.passwordResetRequired, true);
  const { password } = findCall('createUser')[1];
  assert.ok(password.length >= 24);
  assert.equal(JSON.stringify(first.body).includes(password), false);
});

test('rejects bad input', async () => {
  const cases = [
    { userId: 'emp2', updates: { role: 'god' } },
    { userId: 'emp1/../x', updates: { displayName: 'x' } },
    { userId: 'emp1', updates: { password: '123' } },
    { userId: 'emp1', updates: { email: 'nope' } },
    { userId: 'emp1', updates: [] },
    { userId: 'emp1', updates: { disabled: true } },
  ];
  for (const body of cases) {
    assert.equal((await call(updateUserAuth, 'super', body)).statusCode, 400, JSON.stringify(body));
  }
});

test('server errors return a generic message', async () => {
  fake().db = null;
  const res = await call(updateUserAuth, 'super', { userId: 'emp1', updates: { displayName: 'x' } });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Server error');
});

test('OPTIONS returns 204 and other methods 405', async () => {
  assert.equal((await call(updateUserAuth, null, null, 'OPTIONS')).statusCode, 204);
  assert.equal((await call(updateUserAuth, null, null, 'GET')).statusCode, 405);
});

// --- update-user-auth: role changes keep the stored role in step ---
test('promotion sets the claim and the stored role together', async () => {
  const res = await call(updateUserAuth, 'super', { userId: 'emp2', updates: { role: 'admin' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(fake().db.users.emp2.profile.role, 'admin');
  assert.equal(fake().db.managementStructure.emp2, undefined, 'no empty management entry');
});

test('demotion stores employee and removes the management entry', async () => {
  const res = await call(updateUserAuth, 'super', { userId: 'admin2', updates: { role: 'employee' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(findCall('setClaims')[2], { role: 'employee' });
  assert.equal(fake().db.users.admin2.profile.role, 'employee');
  assert.equal(fake().db.managementStructure.admin2, undefined);
  assert.deepEqual(findCall('revokeTokens'), ['revokeTokens', 'admin2'], 'old admin sessions end');
});

test('promotion does not sign the user out', async () => {
  await call(updateUserAuth, 'super', { userId: 'emp2', updates: { role: 'admin' } });
  assert.equal(findCall('revokeTokens'), undefined);
});

test('promotion to super admin keeps the managed locations', async () => {
  fake().authUsers.admin1 = { uid: 'admin1', email: 'a1@example.com', customClaims: { role: 'admin', admin: true } };
  const res = await call(updateUserAuth, 'super', { userId: 'admin1', updates: { role: 'super-admin' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(fake().db.users.admin1.profile.role, 'super_admin');
  assert.deepEqual(fake().db.managementStructure.admin1, { role: 'super_admin', managedLocations: { Aurora: true } });
});

test('a role change for a user with no login does not create one', async () => {
  const res = await call(updateUserAuth, 'super', { userId: 'dbOnly', updates: { role: 'admin' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(findCall('createUser'), undefined);
  assert.equal(fake().db.users.dbOnly.profile.role, 'admin');
});

// --- create-user ---
const newMember = (overrides = {}) => ({
  email: 'member@example.com',
  password: 'temp-pass-1',
  name: 'New Member',
  role: 'employee',
  locationKey: 'aurora',
  status: 'active',
  position: 'Member',
  emergencyContact: { name: 'Kin', phone: '555' },
  ...overrides,
});
const createdUid = () => findCall('createUser') && Object.keys(fake().authUsers).find((uid) => uid.startsWith('new'));

test('create-user: requires an admin', async () => {
  assert.equal((await call(createUser, null, newMember())).statusCode, 401);
  assert.equal((await call(createUser, 'employee', newMember())).statusCode, 403);
  assert.equal(findCall('createUser'), undefined);
});

test('create-user: location admin creates an employee at their location in one write', async () => {
  const res = await call(createUser, 'admin', newMember({ role: 'Employee', padrino: true, padrinoColor: 'Green' }));
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const uid = res.body.userId;
  const record = fake().db.users[uid];
  assert.equal(record.location, 'aurora');
  assert.equal(record.profile.locationKey, 'aurora');
  assert.equal(record.profile.location, 'Aurora');
  assert.equal(record.profile.role, 'employee');
  assert.equal(record.profile.padrinoColor, 'green');
  assert.equal(record.profile.padrinoColorCode, 'green', 'the lists read padrinoColorCode');
  assert.equal(record.profile.password, undefined);
  assert.deepEqual(fake().db.locations.aurora.activeUsers[uid], { position: 'Member' });
  assert.equal(fake().db.managementStructure[uid], undefined);
  assert.deepEqual(findCall('setClaims').slice(1), [uid, { role: 'employee' }]);
  assert.equal(fake().calls.filter((c) => c[0] === 'dbUpdate').length, 1);
  assert.equal(JSON.stringify(res.body).includes('temp-pass-1'), false);
});

test('create-user: location admin cannot create admins or members elsewhere', async () => {
  assert.equal((await call(createUser, 'admin', newMember({ role: 'admin' }))).statusCode, 403);
  assert.equal((await call(createUser, 'admin', newMember({ locationKey: 'joliet' }))).statusCode, 403);
  assert.equal(findCall('createUser'), undefined);
});

test('create-user: super admin creates a super admin with all locations', async () => {
  const res = await call(createUser, 'super', newMember({ role: 'super_admin', locationKey: 'joliet' }));
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const entry = fake().db.managementStructure[res.body.userId];
  assert.deepEqual(entry.managedLocations, { '*': true });
  assert.equal(entry.role, 'super_admin');
});

test('create-user: accepts a location name without spaces and stores the real key', async () => {
  const res = await call(createUser, 'super', newMember({ locationKey: 'aguavivalyons' }));
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const record = fake().db.users[res.body.userId];
  assert.equal(record.location, 'lyons');
  assert.equal(record.profile.location, 'Agua Viva Lyons');
});

test('create-user: a taken email returns 409 and writes nothing', async () => {
  const res = await call(createUser, 'super', newMember({ email: 'EMP1@example.com' }));
  assert.equal(res.statusCode, 409);
  assert.equal(findCall('dbUpdate'), undefined);
});

test('create-user: a failed database write removes the new login', async () => {
  fake().failUpdate = true;
  const res = await call(createUser, 'super', newMember());
  assert.equal(res.statusCode, 500);
  const removed = findCall('deleteUser');
  assert.ok(removed, 'login was rolled back');
  assert.equal(fake().authUsers[removed[1]], undefined);
  assert.equal(createdUid(), undefined);
});

test('create-user: rejects bad input', async () => {
  const cases = [
    newMember({ email: 'nope' }),
    newMember({ password: '123' }),
    newMember({ role: 'god' }),
    newMember({ locationKey: 'aurora/../users' }),
    newMember({ locationKey: 'nowhere' }),
    newMember({ name: { first: 'x' } }),
    newMember({ name: '' }),
  ];
  for (const body of cases) {
    assert.equal((await call(createUser, 'super', body)).statusCode, 400, JSON.stringify(body));
  }
  assert.equal(findCall('createUser'), undefined);
});

// --- send-event-notifications ---
const event = {
  title: '<script>x</script>Junta',
  location: 'Aurora "Hall"',
  description: 'line1\n<b>line2</b>',
  start: '2026-11-05',
  end: '2026-11-05',
};

test('email: requires an admin', async () => {
  assert.equal((await call(sendEventNotifications, null, { event, participantIds: ['e1'] })).statusCode, 401);
  assert.equal((await call(sendEventNotifications, 'employee', { event, participantIds: ['e1'] })).statusCode, 403);
});

test('email: escapes event text, de-duplicates addresses, returns counts only', async () => {
  const res = await call(sendEventNotifications, 'admin', { event, participantIds: ['e1', 'e2', 'e3', 'e1'] });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(fake().mails.length, 1);
  const { html } = fake().mails[0];
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;') && html.includes('&lt;b&gt;line2') && html.includes('<br>'));
  assert.equal(JSON.stringify(res.body).includes('@'), false);
});

test('email: rejects too many recipients, bad ids and non-text fields', async () => {
  const tooMany = Array.from({ length: 501 }, (_, i) => `u${i}`);
  assert.equal((await call(sendEventNotifications, 'admin', { event, participantIds: tooMany })).statusCode, 400);
  assert.equal((await call(sendEventNotifications, 'admin', { event, participantIds: ['../x'] })).statusCode, 400);
  const objectTitle = { event: { title: { a: 1 } }, participantIds: ['e1'] };
  assert.equal((await call(sendEventNotifications, 'admin', objectTitle)).statusCode, 400);
});

// --- attendance scan ---
const chicagoNow = () => moment().tz('America/Chicago');
const today = () => chicagoNow().format('YYYY-MM-DD');
const yesterday = () => chicagoNow().subtract(1, 'day').format('YYYY-MM-DD');
const clockIn = (token = 'admin', overrides = {}) =>
  call(scan, token, { userId: 'emp1', mode: 'clock-in', location: 'Aurora', eventType: 'workshops', eventTypeLabel: 'Workshops', ...overrides });
const clockOut = (token = 'admin', overrides = {}) =>
  call(scan, token, { userId: 'emp1', mode: 'clock-out', location: 'Aurora', ...overrides });
const records = () => Object.entries(fake().db.users.emp1.attendance || {});

test('scan: requires an admin and takes no lock otherwise', async () => {
  assert.equal((await clockIn(null)).statusCode, 401);
  assert.equal((await clockIn('employee')).statusCode, 403);
  assert.equal(findCall('dbTransaction'), undefined);
});

test('scan: clock-in saves the record, the shared copy and the lock release in one write', async () => {
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.mode, 'clock-in');
  const [[key, record]] = records();
  assert.ok(key.startsWith(`${today()}_`));
  assert.equal(record.status, 'clocked-in');
  assert.equal(record.location, 'aurora');
  assert.equal(fake().db.attendance.aurora[today()].emp1.status, 'clocked-in');
  assert.equal(fake().db.users.emp1.stats.daysPresent, 1);
  assert.equal(fake().db.scanLocks?.emp1, undefined, 'lock released');
  assert.equal(fake().calls.filter((c) => c[0] === 'dbUpdate').length, 1);
});

test('scan: a second clock-in is refused while the first is open', async () => {
  assert.equal((await clockIn()).statusCode, 200);
  const second = await clockIn();
  assert.equal(second.statusCode, 409);
  assert.match(second.body.message, /already clocked in/);
  assert.equal(records().length, 1);
  assert.equal(fake().db.scanLocks?.emp1, undefined, 'lock released after the refusal');
});

test('scan: two simultaneous clock-ins create one record', async () => {
  const results = await Promise.all([clockIn(), clockIn('super')]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(records().length, 1);
});

test('scan: a lock held by another scan is respected; an expired one is taken', async () => {
  fake().db.scanLocks = { emp1: { at: Date.now(), by: 'other' } };
  const blocked = await clockIn();
  assert.equal(blocked.statusCode, 409);
  assert.match(blocked.body.message, /already being processed/);
  assert.deepEqual(fake().db.scanLocks.emp1.by, 'other', "someone else's lock is left alone");

  fake().db.scanLocks.emp1.at = Date.now() - 60 * 1000;
  assert.equal((await clockIn()).statusCode, 200);
});

test('scan: clock-out closes the open record and its shared copy', async () => {
  await clockIn();
  const res = await clockOut();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.mode, 'clock-out');
  const [[, record]] = records();
  assert.equal(record.status, 'completed');
  assert.equal(typeof record.hoursWorked, 'string');
  assert.equal(fake().db.attendance.aurora[today()].emp1.status, 'completed');
  assert.equal(fake().db.users.emp1.clockedIn, false);
});

test('scan: clock-out with nothing open is refused', async () => {
  const res = await clockOut();
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /No active clock-in/);
});

test('scan: a clock-in forgotten yesterday is marked missed, in both copies', async () => {
  const key = `${yesterday()}_1`;
  fake().db.users.emp1.attendance = {
    [key]: { status: 'clocked-in', clockedIn: true, clockInTimestamp: 1, date: yesterday(), location: 'aurora' },
  };
  fake().db.attendance = { aurora: { [yesterday()]: { emp1: { status: 'clocked-in' } } } };
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.staleClosed, 1);
  assert.equal(fake().db.users.emp1.attendance[key].status, 'missed-clock-out');
  assert.equal(fake().db.attendance.aurora[yesterday()].emp1.status, 'missed-clock-out');
});

test('scan: clock-in marks the matching scheduled event attended', async () => {
  fake().db.users.emp1.schedule = { ev1: true, ev2: true };
  fake().db.events = {
    ev1: { start: chicagoNow().toISOString(), eventType: 'Workshops', participants: { emp1: { assigned: true, attended: false } } },
    ev2: { start: chicagoNow().toISOString(), eventType: 'haciendas', participants: { emp1: { assigned: true } } },
  };
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendedEvents, 1);
  assert.equal(fake().db.events.ev1.participants.emp1.attended, true);
  assert.equal(fake().db.events.ev2.participants.emp1.attended, undefined);
});

test('scan: a Scheduler event (type saved as its key) is marked attended; the default category is not matched', async () => {
  fake().db.eventTypes = { 'et-1': { name: 'Workshops' }, 'et-4': { name: 'MEETINGS' } };
  fake().db.users.emp1.schedule = { ev1: true };
  fake().db.events = {
    ev1: { start: chicagoNow().toISOString(), eventType: 'et-1', category: 'meetings', participants: { emp1: { assigned: true, attended: false } } },
  };
  const meeting = await clockIn('admin', { eventType: 'MEETINGS' });
  assert.equal(meeting.statusCode, 200, JSON.stringify(meeting.body));
  assert.equal(meeting.body.attendedEvents, 0, 'a meetings scan must not mark the workshop');
  assert.equal(fake().db.events.ev1.participants.emp1.attended, false);
});

test('scan: clocking in after the scheduled start is late, and counted once', async () => {
  fake().db.users.emp1.schedule = { ev1: true };
  fake().db.events = {
    // Started at midnight today, so any clock-in today is after it.
    ev1: { start: chicagoNow().startOf('day').toISOString(), allDay: false, eventType: 'Workshops', participants: { emp1: { assigned: true, attended: false } } },
  };
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendedEvents, 1);
  assert.equal(res.body.isLate, true);
  const [[, record]] = records();
  assert.equal(record.isLate, true);
  assert.equal(record.onTime, false);
  assert.equal(fake().db.attendance.aurora[today()].emp1.isLate, true);
  assert.equal(fake().db.users.emp1.stats.daysLate, 1);
});

test('scan: clocking in before the scheduled start is on time', async () => {
  fake().db.users.emp1.schedule = { ev1: true };
  fake().db.events = {
    ev1: { start: chicagoNow().endOf('day').toISOString(), allDay: false, eventType: 'Workshops', participants: { emp1: { assigned: true, attended: false } } },
  };
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendedEvents, 1);
  assert.equal(res.body.isLate, false);
  assert.equal(fake().db.users.emp1.stats.daysLate || 0, 0);
});

test('scan: the Scheduler event key matches the scanned type name', async () => {
  fake().db.eventTypes = { 'et-1': { name: 'Workshops' } };
  fake().db.users.emp1.schedule = { ev1: true };
  fake().db.events = {
    ev1: { start: chicagoNow().toISOString(), eventType: 'et-1', category: 'meetings', participants: { emp1: { assigned: true, attended: false } } },
  };
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendedEvents, 1);
  assert.equal(fake().db.events.ev1.participants.emp1.attended, true);
});

test('scan: unknown, deleted and malformed badges are refused', async () => {
  assert.equal((await clockIn('admin', { userId: 'ghost' })).statusCode, 404);
  fake().db.deleted_users = { 'emp1_2026-01-01T00-00-00_000Z': { name: 'x' } };
  assert.equal((await clockIn()).statusCode, 409);
  for (const overrides of [
    { userId: 'emp1/../admin1' },
    { mode: 'teleport' },
    { location: '' },
    { location: 'au.rora' },
    { eventType: '' },
    { eventType: { a: 1 } },
  ]) {
    assert.equal((await clockIn('admin', overrides)).statusCode, 400, JSON.stringify(overrides));
  }
  assert.equal(fake().db.scanLocks?.emp1, undefined);
});

test('scan: a failed save releases the lock and reports a server error', async () => {
  fake().failUpdate = true;
  const res = await clockIn();
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Server error');
  assert.equal(fake().db.scanLocks?.emp1, undefined);
  assert.equal(records().length, 0);
});

test('scan: a scan that lost its lock saves nothing and leaves the new lock alone', async () => {
  // While this scan reads the user record, its lock expires and another scan takes it.
  fake().onRead = (path) => {
    if (path === 'users/emp1') fake().db.scanLocks.emp1 = { at: Date.now(), by: 'other', id: 'other-scan' };
  };
  const res = await clockIn();
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /took too long/);
  assert.equal(records().length, 0);
  assert.equal(fake().db.scanLocks.emp1.id, 'other-scan');
});

test('scan: clock-in still goes ahead when scheduled events cannot be read', async () => {
  fake().db.users.emp1.schedule = { ev1: true };
  fake().failReadPrefix = 'events/';
  const res = await clockIn();
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.attendedEvents, 0);
  assert.equal(records().length, 1);
});

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
      managementStructure: { admin1: { managedLocations: { Aurora: true } } },
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

// api/admin/create-user.js
// Creates a member: the login, its role claim, and the database record, in
// that order. The browser used to create the login itself, which signed the
// admin out and saved the rest of the record as the new user.
// Super admins can create any role. Location admins can create employees at
// the locations they manage.
import { getAdmin } from '../_lib/firebaseAdmin.js';
import { HttpError, requireAdmin, sendError, isValidId, normalizeRole, isAdminRole, claimsForRole } from '../_lib/auth.js';
import { callerLocationScope, scopeIncludes } from '../_lib/scope.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PADRINO_COLORS = ['blue', 'green', 'orange', 'red'];

// Optional text field: trimmed string, '' when missing. Non-text is rejected.
function text(value, field, max = 200) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${field} is too long`);
  return trimmed;
}

function parseRequest(body, caller) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const email = text(input.email, 'email', 254);
  const name = text(input.name, 'name');
  const password = typeof input.password === 'string' ? input.password : '';
  const role = normalizeRole(input.role);
  const locationKey = text(input.locationKey, 'locationKey', 128);

  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Invalid email address');
  if (!name) throw new HttpError(400, 'Name is required');
  if (password.length < 6 || password.length > 128) {
    throw new HttpError(400, 'Password must be 6-128 characters');
  }
  if (!role) throw new HttpError(400, 'Unknown role');
  if (role !== 'employee' && caller.role !== 'super_admin') {
    throw new HttpError(403, 'Only a super admin can create admins');
  }
  if (!isValidId(locationKey)) throw new HttpError(400, 'A valid location is required');

  const contact = input.emergencyContact && typeof input.emergencyContact === 'object' ? input.emergencyContact : {};
  const padrino = input.padrino === true;
  const padrinoColor = text(input.padrinoColor, 'padrinoColor', 20).toLowerCase();

  return {
    email,
    name,
    password,
    role,
    locationKey,
    status: text(input.status, 'status', 40) || 'active',
    position: text(input.position, 'position') || 'Member',
    department: text(input.department, 'department'),
    service: text(input.service, 'service'),
    phone: text(input.phone, 'phone', 40),
    emergencyContact: {
      name: text(contact.name, 'emergencyContact.name'),
      phone: text(contact.phone, 'emergencyContact.phone', 40),
    },
    padrino,
    padrinoColor: PADRINO_COLORS.includes(padrinoColor) ? padrinoColor : 'blue',
  };
}

const compactName = (value) => (typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : '');

// The location must exist. Older screens send the location's name with the
// spaces removed ("aguavivalyons") rather than its key, so match that too.
async function resolveLocation(db, requestedKey) {
  const exact = (await db.ref(`locations/${requestedKey}`).once('value')).val();
  if (exact) return { key: requestedKey, name: (exact && exact.name) || requestedKey };

  const all = (await db.ref('locations').once('value')).val() || {};
  const match = Object.entries(all).find(
    ([, value]) => value && typeof value === 'object' && compactName(value.name) === requestedKey.toLowerCase()
  );
  if (!match) throw new HttpError(400, 'Unknown location');
  return { key: match[0], name: match[1].name };
}

// Same record shape the Add New Employee form has always saved.
export function buildUserRecord(request, location, now) {
  return {
    location: location.key,
    locationHistory: [{ changedBy: 'migration', date: now, locationKey: location.key, locationName: location.name }],
    name: request.name,
    profile: {
      department: request.department,
      email: request.email,
      emergencyContact: request.emergencyContact,
      joinDate: now,
      location: location.name,
      locationKey: location.key,
      managedBy: '',
      name: request.name,
      phone: request.phone,
      position: request.position,
      role: request.role,
      service: request.service,
      status: request.status,
      notes: '',
      ...(request.padrino ? { padrino: true, padrinoColor: request.padrinoColor } : {}),
    },
    stats: { attendanceRate: 0, daysAbsent: 0, daysLate: 0, daysPresent: 0, onTimeRate: 0, totalHours: 0 },
    status: request.status,
  };
}

// The record and its links, in one atomic write.
export function buildCreateUpdates(uid, request, location, now) {
  const updates = { [`users/${uid}`]: buildUserRecord(request, location, now) };
  if (isAdminRole(request.role)) {
    updates[`managementStructure/${uid}`] = {
      role: request.role,
      managedLocations: request.role === 'super_admin' ? { '*': true } : { [location.key]: true },
      managedDepartments: { '*': true },
    };
  }
  if (request.status === 'active') {
    updates[`locations/${location.key}/activeUsers/${uid}`] = { position: request.position };
  }
  return updates;
}

const AUTH_ERRORS = {
  'auth/email-already-exists': [409, 'This email is already registered. Please use a different email.'],
  'auth/invalid-email': [400, 'Invalid email address'],
  'auth/invalid-password': [400, 'Password must be at least 6 characters'],
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const caller = await requireAdmin(req);
    const request = parseRequest(req.body, caller);

    const admin = getAdmin();
    const auth = admin.auth();
    const db = admin.database();

    const location = await resolveLocation(db, request.locationKey);
    const scope = await callerLocationScope(db, caller);
    if (!scopeIncludes(scope, location.key) && !scopeIncludes(scope, location.name)) {
      throw new HttpError(403, 'This location is outside the locations you manage');
    }

    let created;
    try {
      created = await auth.createUser({ email: request.email, password: request.password, displayName: request.name });
    } catch (error) {
      const known = AUTH_ERRORS[error.code];
      if (known) throw new HttpError(known[0], known[1]);
      throw error;
    }

    const uid = created.uid;
    try {
      await auth.setCustomUserClaims(uid, claimsForRole(request.role));
      await db.ref().update(buildCreateUpdates(uid, request, location, new Date().toISOString()));
    } catch (error) {
      // Undo the login so the admin can simply try again.
      await auth.deleteUser(uid).catch((cleanupError) => {
        console.error(`[create-user] could not remove half-created login ${uid}`, cleanupError);
      });
      throw error;
    }

    console.log(`[create-user] ${caller.uid} created ${uid} (${request.role}) at ${location.key}`);
    return res.status(201).json({ success: true, userId: uid, message: 'User created' });
  } catch (error) {
    return sendError(res, error, 'create-user');
  }
}

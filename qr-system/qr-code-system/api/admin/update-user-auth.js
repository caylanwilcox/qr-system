// api/admin/update-user-auth.js
// Lets an admin change another user's login (email, password, display name), or
// create the login when the user exists only in the database.
// Super admins can also change roles. Location admins can only manage employees
// at their own locations.
import crypto from 'crypto';
import { getAdmin } from '../_lib/firebaseAdmin.js';
import {
  HttpError,
  requireAdmin,
  sendError,
  isValidId,
  normalizeRole,
  isAdminRole,
  roleFromClaims,
  roleFromUserRecord,
  claimsForRole,
} from '../_lib/auth.js';
import { callerLocationScope, scopeIncludes, userLocations } from '../_lib/scope.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6; // Firebase Auth minimum
const MAX_PASSWORD_LENGTH = 128;

// Only these login fields can be changed here. Anything else in `updates`
// (disabled, emailVerified, phoneNumber, ...) is ignored.
function pickLoginUpdates(updates) {
  const result = {};
  for (const field of ['email', 'password', 'displayName']) {
    const value = updates[field];
    if (typeof value === 'string' && value.trim() !== '') {
      result[field] = field === 'password' ? value : value.trim();
    }
  }
  if (result.email && (result.email.length > 254 || !EMAIL_PATTERN.test(result.email))) {
    throw new HttpError(400, 'Invalid email address');
  }
  if (
    result.password &&
    (result.password.length < MIN_PASSWORD_LENGTH || result.password.length > MAX_PASSWORD_LENGTH)
  ) {
    throw new HttpError(400, `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`);
  }
  if (result.displayName && result.displayName.length > 200) {
    throw new HttpError(400, 'Display name is too long');
  }
  return result;
}

// Validates the request body. Only super admins may change roles.
function parseRequest(body, caller) {
  const { userId, updates } = body || {};
  if (!isValidId(userId)) throw new HttpError(400, 'A valid userId is required');
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new HttpError(400, 'updates must be an object');
  }

  const loginUpdates = pickLoginUpdates(updates);
  const roleRequested = updates.role !== undefined && updates.role !== null && updates.role !== '';
  const newRole = roleRequested ? normalizeRole(updates.role) : null;
  if (roleRequested && !newRole) throw new HttpError(400, 'Unknown role');
  if (newRole && caller.role !== 'super_admin') {
    throw new HttpError(403, 'Only a super admin can change roles');
  }
  if (Object.keys(loginUpdates).length === 0 && !newRole) {
    throw new HttpError(400, 'No valid updates provided');
  }
  return { userId, loginUpdates, newRole };
}

// Super admins can manage anyone. Other admins can manage only non-admin users at a
// location they manage (managementStructure) or at their own location.
async function assertCanManage(db, caller, targetData, targetClaims) {
  if (caller.role === 'super_admin') return;

  const targetIsAdmin =
    isAdminRole(roleFromClaims(targetClaims || {})) || isAdminRole(roleFromUserRecord(targetData));
  if (targetIsAdmin) {
    throw new HttpError(403, "Only a super admin can change another admin's login");
  }

  const scope = await callerLocationScope(db, caller);
  if (!userLocations(targetData).some((location) => scopeIncludes(scope, location))) {
    throw new HttpError(403, 'This user is outside the locations you manage');
  }
}

// Loads the target's database record and login account (either may be missing, not both).
async function loadTarget(auth, db, userId) {
  const targetData = (await db.ref(`users/${userId}`).once('value')).val();
  let targetUser = null;
  try {
    targetUser = await auth.getUser(userId);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  if (!targetUser && !targetData) throw new HttpError(404, 'User not found');
  return { targetData, targetUser };
}

// Database writes that go with a role change. The browser reads the stored
// role first, so it must change together with the login claim. Employees
// manage nothing, so their managementStructure entry is removed. An admin's
// entry keeps its locations; only its role label is updated, and only when
// the entry exists (an empty entry would hide a super admin's "all locations").
async function roleRecordUpdates(db, userId, role) {
  const updates = { [`users/${userId}/profile/role`]: role };
  if (!isAdminRole(role)) {
    updates[`managementStructure/${userId}`] = null;
  } else if ((await db.ref(`managementStructure/${userId}`).once('value')).val()) {
    updates[`managementStructure/${userId}/role`] = role;
  }
  return updates;
}

// The user exists only in the database and only the role changes: there is
// no login to update, so only the stored role is written.
async function changeStoredRole(db, { userId, newRole }) {
  await db.ref().update(await roleRecordUpdates(db, userId, newRole));
  return {
    status: 200,
    summary: `changed the stored role to ${newRole}`,
    body: { success: true, message: 'Role updated', userId, role: newRole },
  };
}

// The user exists only in the database: create their login.
async function createLogin(auth, db, { userId, targetData, loginUpdates, newRole }) {
  const email = loginUpdates.email || targetData.profile?.email || targetData.email;
  if (!email) throw new HttpError(400, 'This user has no email address');

  const passwordGenerated = !loginUpdates.password;
  await auth.createUser({
    uid: userId,
    email,
    displayName: loginUpdates.displayName || targetData.profile?.name || targetData.name || '',
    // No shared default password: if none was given, use a random one nobody knows.
    password: loginUpdates.password || crypto.randomBytes(24).toString('base64url'),
    emailVerified: true,
  });

  const role = newRole || roleFromUserRecord(targetData);
  if (role) await auth.setCustomUserClaims(userId, claimsForRole(role));
  await db.ref().update({
    [`users/${userId}/profile/authUid`]: userId,
    ...(newRole ? await roleRecordUpdates(db, userId, newRole) : {}),
  });

  return {
    status: 201,
    summary: 'created a login',
    body: {
      success: true,
      message: passwordGenerated
        ? 'Login created. Use Reset Password to give this user a password.'
        : 'Login created.',
      userId,
      passwordResetRequired: passwordGenerated,
    },
  };
}

const ROLE_RANK = { employee: 1, admin: 2, super_admin: 3 };

// The user already has a login: apply the allowed changes.
async function updateLogin(auth, db, { userId, targetUser, targetData, loginUpdates, newRole }) {
  if (Object.keys(loginUpdates).length > 0) {
    await auth.updateUser(userId, loginUpdates);
  }
  let demoted = false;
  if (newRole) {
    const previousRole = roleFromClaims(targetUser.customClaims || {}) || roleFromUserRecord(targetData) || 'employee';
    demoted = ROLE_RANK[newRole] < ROLE_RANK[previousRole];
    // Keep unrelated claims; replace the role flags.
    const { role: _oldRole, admin: _oldAdmin, superAdmin: _oldSuper, ...otherClaims } =
      targetUser.customClaims || {};
    await auth.setCustomUserClaims(userId, { ...otherClaims, ...claimsForRole(newRole) });
  }
  await db.ref().update({
    [`users/${userId}/profile/authUid`]: userId,
    ...(newRole ? await roleRecordUpdates(db, userId, newRole) : {}),
  });
  // Less access than before: sign them out everywhere, so the old token
  // (which still carries the higher role) can't be refreshed. Done after the
  // claim and stored role agree, so a failure here leaves nothing mismatched.
  if (demoted) await auth.revokeRefreshTokens(userId);

  const updatedUser = await auth.getUser(userId);
  const changed = [...Object.keys(loginUpdates), ...(newRole ? ['role'] : [])].join(', ');
  return {
    status: 200,
    summary: `updated (${changed})`,
    body: {
      success: true,
      message: 'User authentication updated successfully',
      userId,
      loginCredentials: {
        email: updatedUser.email,
        passwordChanged: Boolean(loginUpdates.password),
        emailVerified: updatedUser.emailVerified,
      },
    },
  };
}

export default async function handler(req, res) {
  // The app calls this endpoint from the same origin, so no CORS headers are sent.
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

    const { targetData, targetUser } = await loadTarget(auth, db, request.userId);
    await assertCanManage(db, caller, targetData, targetUser?.customClaims);

    const roleOnly = Object.keys(request.loginUpdates).length === 0;
    let result;
    if (targetUser) result = await updateLogin(auth, db, { ...request, targetUser, targetData });
    else if (roleOnly) result = await changeStoredRole(db, request);
    else result = await createLogin(auth, db, { ...request, targetData });

    console.log(`[update-user-auth] ${caller.uid} ${result.summary} for ${request.userId}`);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return sendError(res, error, 'update-user-auth');
  }
}

// Login and role checks shared by the /api functions.
import { getAdmin } from './firebaseAdmin.js';

export const ROLES = ['employee', 'admin', 'super_admin'];
const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// "SUPER_ADMIN", "super-admin", "Super Admin" -> "super_admin". Unknown roles -> null.
export function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const value = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'superadmin') return 'super_admin';
  return ROLES.includes(value) ? value : null;
}

export const isAdminRole = (role) => ADMIN_ROLES.has(role);

// Database keys used as user IDs (Firebase uids / push IDs).
export const isValidId = (id) => typeof id === 'string' && ID_PATTERN.test(id);

// Role from the login token's custom claims, which only the server can set.
export function roleFromClaims(claims = {}) {
  if (claims.superAdmin === true) return 'super_admin';
  const role = normalizeRole(claims.role);
  if (role) return role;
  if (claims.admin === true) return 'admin';
  return null;
}

// Role stored in the database. Browsers can currently write this field, so it is
// only a fallback until every user has role claims (see scripts/sync-role-claims.js).
export function roleFromUserRecord(userData) {
  const candidates = [
    userData?.profile?.role,
    userData?.role,
    userData?.profile?.userRole,
    userData?.userRole,
  ];
  for (const candidate of candidates) {
    const role = normalizeRole(candidate);
    if (role) return role;
  }
  return null;
}

// Claim shape the frontend already reads (authContext.js uses claims.role).
export function claimsForRole(role) {
  return {
    role,
    ...(isAdminRole(role) ? { admin: true } : {}),
    ...(role === 'super_admin' ? { superAdmin: true } : {}),
  };
}

// Set ALLOW_DB_ROLE_FALLBACK=false once scripts/sync-role-claims.js has been run.
const dbRoleFallbackEnabled = () => process.env.ALLOW_DB_ROLE_FALLBACK !== 'false';

// Verifies the Firebase ID token from the Authorization header and requires an admin role.
// Claims win whenever present; the database role is used only for users with no role claim.
export async function requireAdmin(req) {
  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized');

  const admin = getAdmin();
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(header.slice('Bearer '.length));
  } catch {
    throw new HttpError(401, 'Unauthorized');
  }

  let role = roleFromClaims(decoded);
  if (!role && dbRoleFallbackEnabled()) {
    const snapshot = await admin.database().ref(`users/${decoded.uid}`).once('value');
    role = roleFromUserRecord(snapshot.val());
    if (isAdminRole(role)) {
      console.warn(
        `[auth] ${decoded.uid} authorized as ${role} from the database role (no role claim). ` +
          'Run scripts/sync-role-claims.js.'
      );
    }
  }

  if (!isAdminRole(role)) throw new HttpError(403, 'Forbidden: admin access required');
  return { uid: decoded.uid, role };
}

// Sends a JSON error without leaking internal details to the browser.
export function sendError(res, error, context) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error(`[${context}]`, error);
  return res.status(500).json({ success: false, message: 'Server error' });
}

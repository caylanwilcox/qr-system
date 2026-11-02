// Canonical user roles. normalizeRole mirrors api/_lib/auth.js so the browser
// and the server read every stored spelling ("super-admin", "SUPER_ADMIN",
// "Super Admin") the same way.

export const ROLES = Object.freeze({
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const RANK = { employee: 1, admin: 2, super_admin: 3 };

export function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const value = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'superadmin') return ROLES.SUPER_ADMIN;
  return RANK[value] ? value : null;
}

// The app's role for a user. A stored database role always wins, and one we
// don't recognize means employee. The login claim is used only when no role
// is stored, so a stale claim can't keep a demoted admin's access.
export function resolveRole(storedRole, claimRole) {
  if (typeof storedRole === 'string' && storedRole.trim() !== '') {
    return normalizeRole(storedRole) || ROLES.EMPLOYEE;
  }
  return normalizeRole(claimRole) || ROLES.EMPLOYEE;
}

// True when userRole is at least requiredRole. Unknown roles never pass.
export function hasRoleAtLeast(userRole, requiredRole) {
  const have = RANK[normalizeRole(userRole)] || 0;
  const need = RANK[normalizeRole(requiredRole)] || 0;
  return need > 0 && have >= need;
}

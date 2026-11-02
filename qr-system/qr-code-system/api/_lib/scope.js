// Which locations a caller may manage. Shared by the /api/admin functions.

// "Agua Viva Lyons" / "Aurora" / "aurora" are stored inconsistently; compare loosely.
export const normalizeLocation = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

export const userLocations = (userData) =>
  [userData?.location, userData?.profile?.locationKey, userData?.profile?.location]
    .map(normalizeLocation)
    .filter(Boolean);

// Super admins manage every location. Other admins manage the locations in
// managementStructure plus their own location.
// managementStructure and user locations are browser-writable by admins, so
// this is defense in depth rather than the final control.
export async function callerLocationScope(db, caller) {
  if (caller.role === 'super_admin') return { all: true, locations: new Set() };

  const [managedSnap, callerSnap] = await Promise.all([
    db.ref(`managementStructure/${caller.uid}/managedLocations`).once('value'),
    db.ref(`users/${caller.uid}`).once('value'),
  ]);
  const managed = managedSnap.val() || {};
  if (managed['*']) return { all: true, locations: new Set() };

  const locations = new Set([
    ...Object.keys(managed).filter((key) => managed[key]).map(normalizeLocation),
    ...userLocations(callerSnap.val()),
  ]);
  locations.delete('');
  return { all: false, locations };
}

export const scopeIncludes = (scope, location) =>
  scope.all || scope.locations.has(normalizeLocation(location));

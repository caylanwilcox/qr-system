// Which events an admin's Scheduler shows, on top of the ones they're assigned to.
// Super admins see every event. Admins see events at the locations they manage
// ('*' means all of them), events for "All Locations", and events they created.

import { normalizeRole, ROLES } from './roles.js';

export const ALL_LOCATIONS = 'All Locations';

// Location names are stored as "Aurora", "aurora" and "Westchicago", so compare
// them without case or spaces.
export function locationKey(value) {
  return typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : '';
}

// managedLocations comes as a list from the login (['Aurora']) or as the
// stored object ({ Aurora: true }); both work here.
export function managesLocation(managedLocations, location) {
  const list = Array.isArray(managedLocations)
    ? managedLocations
    : Object.keys(managedLocations || {}).filter((name) => managedLocations[name]);
  if (list.includes('*')) return true;
  const wanted = locationKey(location);
  return wanted !== '' && list.some((name) => locationKey(name) === wanted);
}

export function canSeeManagedEvent(eventData, { role, managedLocations, userId } = {}) {
  if (!eventData) return false;
  const normalized = normalizeRole(role);
  if (normalized === ROLES.SUPER_ADMIN) return true;
  if (normalized !== ROLES.ADMIN) return false;
  if (userId && eventData.createdBy === userId) return true;
  if (eventData.location === ALL_LOCATIONS) return true;
  return managesLocation(managedLocations, eventData.location);
}

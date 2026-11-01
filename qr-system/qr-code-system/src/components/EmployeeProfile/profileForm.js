// Maps a stored user record to the Personal Info form, and the edited form
// back to database updates. Saving writes only the fields that changed, so a
// stale form can't undo role or status changes made elsewhere.

const normalizeLocationKey = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

// The user's location key: profile.locationKey first, then the stored names.
export function locationKeyFor(profile, rootLocation) {
  const p = profile || {};
  return p.locationKey || normalizeLocationKey(p.location) || normalizeLocationKey(rootLocation) || '';
}

export function profileToForm(profile, rootLocation) {
  const p = profile || {};
  return {
    name: p.name || '',
    username: p.username || '',
    email: p.email || '',
    phone: p.phone || '',
    position: p.position || '',
    department: p.department || '',
    location: locationKeyFor(p, rootLocation),
    joinDate: p.joinDate || '',
    role: p.role || 'employee',
    status: p.status || 'inactive',
    emergencyContact: p.emergencyContact || '',
    emergencyPhone: p.emergencyPhone || '',
    notes: p.notes || '',
    padrino: p.padrino ?? false,
    padrinoColor: p.padrinoColorCode || 'blue',
    padrinoColorCode: p.padrinoColorCode || 'blue',
    service: p.service || '',
    password: '',
  };
}

// Options for the location menu: the real locations, plus the user's stored
// location when it isn't one of them, so the menu never shows it as blank.
export function locationOptions(locations, profile, rootLocation) {
  const options = (locations || []).map(({ key, name }) => ({ key, name }));
  const current = locationKeyFor(profile, rootLocation);
  if (current && !options.some((option) => option.key === current)) {
    const label = (profile && profile.location) || rootLocation || current;
    const loaded = options.length > 0;
    options.push({ key: current, name: loaded ? `${label} (not in location list)` : label });
  }
  return options;
}

const sameValue = (a, b) =>
  typeof a === 'object' || typeof b === 'object'
    ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
    : a === b;

export function buildProfileUpdates({ userId, formData, baseline, locations }) {
  const base = `users/${userId}`;
  const before = baseline || {};
  const updates = {};

  Object.entries(formData || {}).forEach(([key, value]) => {
    if (key === 'password' || key === 'location') return;
    if (value === undefined || value === null) return;
    if (sameValue(value, before[key])) return;
    updates[`${base}/profile/${key}`] = value;
    // Older screens still read name and email from the top of the record.
    if (key === 'name' || key === 'email') updates[`${base}/${key}`] = value;
  });

  // Location is saved only when picked from the real location list, in the
  // shape AddNewEmployee uses: key at the root and in profile.locationKey,
  // display name in profile.location.
  const key = formData ? formData.location : '';
  const match = (locations || []).find((location) => location.key === key);
  if (match && key !== before.location) {
    updates[`${base}/location`] = match.key;
    updates[`${base}/profile/locationKey`] = match.key;
    updates[`${base}/profile/location`] = match.name;
  }

  return updates;
}

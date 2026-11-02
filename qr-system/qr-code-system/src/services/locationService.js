import { ref, get } from 'firebase/database';
import { database } from './firebaseConfig';

// Active locations from the database as [{ key, name }], sorted by name.
// Throws when the read fails, so callers show an error instead of guessing
// a hardcoded list (guessed names are how mismatched locations got saved).
export async function fetchLocations() {
  const snapshot = await get(ref(database, 'locations'));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val())
    .filter(([, value]) => value && value.active !== false)
    .map(([key, value]) => ({ key, name: value.name || key }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

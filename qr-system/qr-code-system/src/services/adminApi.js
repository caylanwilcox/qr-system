// Calls to the server endpoints in /api that need the signed-in admin's login.
// Writes that need trust (creating members, changing roles, clock in/out)
// go through these instead of writing to the database from the browser.
import { auth } from './firebaseConfig';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function callApi(path, body) {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'You are signed out. Please sign in again.');
  const idToken = await user.getIdToken();

  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, 'Could not reach the server. Check the connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.message || `Request failed (${response.status})`);
  }
  return data;
}

export const createMember = (member) => callApi('/api/admin/create-user', member);

// Sets the login claim and the stored role together. Super admins only.
export const setUserRole = (userId, role) =>
  callApi('/api/admin/update-user-auth', { userId, updates: { role } });

// mode is 'clock-in' or 'clock-out'.
export const recordScan = ({ userId, mode, location, eventType, eventTypeLabel }) =>
  callApi('/api/attendance/scan', { userId, mode, location, eventType, eventTypeLabel });

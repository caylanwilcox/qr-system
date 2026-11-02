import { auth } from './firebaseConfig';

/**
 * Sends event notification emails to participants. Requires a signed-in admin.
 * @param {Object} event - The event details (title, date, location, description, etc.)
 * @param {string[]} participantIds - Array of user IDs to notify
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendEventNotifications(event, participantIds) {
  try {
    if (!auth.currentUser) {
      return { success: false, message: 'You must be signed in to send notifications.' };
    }
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/send-event-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ event, participantIds })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, message: error.message };
  }
} 
/**
 * Sends event notification emails to participants.
 * @param {Object} event - The event details (title, date, location, description, etc.)
 * @param {string[]} participantIds - Array of user IDs to notify
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendEventNotifications(event, participantIds) {
  try {
    const response = await fetch('/api/send-event-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, participantIds })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, message: error.message };
  }
} 
// Builds the multi-path update for saving an event's participant list.
// Existing participants are left untouched, so their attendance survives a
// re-save. New people are added as assigned (not attended), and people who
// were removed lose both their participant entry and their calendar link.

export function buildParticipantUpdates({ eventId, existing, nextIds, changedBy, now }) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const next = new Set(nextIds || []);
  const updates = {};
  const added = [];

  for (const uid of next) {
    if (!Object.prototype.hasOwnProperty.call(current, uid)) {
      updates[`events/${eventId}/participants/${uid}`] = {
        assigned: true,
        assignedAt: now,
        attended: false,
      };
      added.push(uid);
    }
    updates[`users/${uid}/schedule/${eventId}`] = true;
  }

  const removed = Object.keys(current).filter((uid) => !next.has(uid));
  for (const uid of removed) {
    updates[`events/${eventId}/participants/${uid}`] = null;
    updates[`users/${uid}/schedule/${eventId}`] = null;
  }

  updates[`events/${eventId}/updatedBy`] = changedBy || null;
  updates[`events/${eventId}/updatedAt`] = now;

  return { updates, added, removed };
}

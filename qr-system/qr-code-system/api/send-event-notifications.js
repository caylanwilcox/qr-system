// api/send-event-notifications.js
// Emails participants that they were scheduled for an event. Admins only.
import nodemailer from 'nodemailer';
import { getAdmin } from './_lib/firebaseAdmin.js';
import { HttpError, requireAdmin, sendError, isValidId } from './_lib/auth.js';

// Above the current org size (~370 users); stops the endpoint being used for mass mail.
const MAX_RECIPIENTS = 500;

const port = parseInt(process.env.SMTP_PORT || '465', 10);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection pooling for bulk emails
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateLimit: 10, // Max 10 emails per second
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => typeof email === 'string' && EMAIL_PATTERN.test(email.trim());

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

// Event fields are user-entered text: limit length, and keep newlines out of one-line fields.
function cleanText(value, maxLength, { singleLine = true } = {}) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, 'Event fields must be text');
  }
  let text = String(value).trim();
  if (singleLine) text = text.replace(/[\r\n]+/g, ' ');
  return text.slice(0, maxLength);
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}-${d.getFullYear()}`;
}

// Sends in batches to avoid SMTP rate limits. Returns counts only.
async function sendEmailsBatch(emails, subject, html, batchSize = 10) {
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (email) => {
        try {
          await transporter.sendMail({ from: process.env.SMTP_USER, to: email, subject, html });
          sent += 1;
        } catch (error) {
          failed += 1;
          console.error('[send-event-notifications] send failed:', error.message);
        }
      })
    );

    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed };
}

// Validates the request body and cleans the user-entered event text.
function parseRequest(body) {
  const { event, participantIds } = body || {};
  if (!event || typeof event !== 'object' || !Array.isArray(participantIds)) {
    throw new HttpError(400, 'Missing event or participantIds');
  }
  const ids = [...new Set(participantIds)];
  if (ids.length === 0 || ids.length > MAX_RECIPIENTS) {
    throw new HttpError(400, `participantIds must have 1-${MAX_RECIPIENTS} entries`);
  }
  if (!ids.every(isValidId)) throw new HttpError(400, 'Invalid participant id');

  return {
    ids,
    title: cleanText(event.title, 200) || 'an event',
    location: cleanText(event.location, 200) || 'TBD',
    description: cleanText(event.description, 2000, { singleLine: false }),
    dateRange: `${formatDate(event.start)} - ${formatDate(event.end)}`,
  };
}

// Returns the distinct, valid email addresses for the given user IDs.
async function lookupEmails(db, ids) {
  const emails = await Promise.all(
    ids.map(async (id) => {
      try {
        const email = (await db.ref(`users/${id}/profile/email`).once('value')).val();
        return isValidEmail(email) ? email.trim().toLowerCase() : null;
      } catch (error) {
        console.error('[send-event-notifications] email lookup failed:', error.message);
        return null;
      }
    })
  );
  return [...new Set(emails.filter(Boolean))];
}

// Every user-entered value is HTML-escaped before it goes into the email body.
function buildEmail({ title, location, description, dateRange }) {
  const descriptionHtml = description
    ? escapeHtml(description).replace(/\n/g, '<br>')
    : 'No description provided.';
  return {
    subject: `You have been scheduled for: ${title}`,
    html: `
      <h2>Event Scheduled</h2>
      <p>You have been scheduled for <strong>${escapeHtml(title)}</strong> on <strong>${escapeHtml(dateRange)}</strong> at <strong>${escapeHtml(location)}</strong>.</p>
      <p><strong>Description:</strong> ${descriptionHtml}</p>
      <hr>
      <p><small>This is an automated message from the QR System.</small></p>
    `,
  };
}

export default async function handler(req, res) {
  // The app calls this endpoint from the same origin, so no CORS headers are sent.
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const caller = await requireAdmin(req);
    const request = parseRequest(req.body);
    const { ids } = request;

    const uniqueEmails = await lookupEmails(getAdmin().database(), ids);
    if (uniqueEmails.length === 0) {
      throw new HttpError(404, 'No valid emails found for participants.');
    }

    const { subject, html } = buildEmail(request);
    const batchSize = uniqueEmails.length > 50 ? 5 : 10;
    const { sent, failed } = await sendEmailsBatch(uniqueEmails, subject, html, batchSize);

    console.log(
      `[send-event-notifications] ${caller.uid} notified ${ids.length} participants: ${sent} sent, ${failed} failed`
    );
    return res.status(200).json({
      success: true,
      message: `Email blast completed. ${sent} emails sent successfully, ${failed} failed.`,
      details: {
        totalParticipants: ids.length,
        uniqueEmails: uniqueEmails.length,
        sent,
        failed,
      },
    });
  } catch (error) {
    return sendError(res, error, 'send-event-notifications');
  }
}

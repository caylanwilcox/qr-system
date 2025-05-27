import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();

const port = parseInt(process.env.SMTP_PORT || '465', 10);
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { event, participantIds } = req.body;
  if (!event || !participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({ success: false, message: 'Missing event or participantIds' });
  }

  try {
    // Fetch user emails
    const userSnapshots = await Promise.all(
      participantIds.map(id => db.ref(`users/${id}/profile/email`).once('value'))
    );
    const emails = userSnapshots.map(snap => snap.val()).filter(Boolean);

    if (emails.length === 0) {
      return res.status(404).json({ success: false, message: 'No valid emails found for participants.' });
    }

    // Format event dates
    const start = formatDate(event.start);
    const end = formatDate(event.end);
    const dateRange = `${start} - ${end}`;

    // Send emails
    await Promise.all(
      emails.map(email =>
        transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: `You have been scheduled for: ${event.title}`,
          html: `<h2>Event Scheduled</h2><p>You have been scheduled for <b>${event.title}</b> on <b>${dateRange}</b> at <b>${event.location}</b>.</p><p>Description: ${event.description || 'No description provided.'}</p>`
        })
      )
    );

    return res.status(200).json({ success: true, message: `Emails sent to ${emails.length} participants.` });
  } catch (error) {
    console.error('Error sending event notification emails:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
} 
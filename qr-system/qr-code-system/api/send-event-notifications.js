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
  // Add connection pooling for bulk emails
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateLimit: 10 // Max 10 emails per second
});

// Email validation function
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

// Function to send emails in batches to avoid rate limiting
async function sendEmailsBatch(emails, subject, html, batchSize = 10) {
  const results = {
    sent: [],
    failed: [],
    total: emails.length
  };

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (email) => {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject,
          html
        });
        results.sent.push(email);
        return { email, success: true };
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
        results.failed.push({ email, error: error.message });
        return { email, success: false, error: error.message };
      }
    });

    await Promise.all(batchPromises);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  return results;
}

export default async function handler(req, res) {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { event, participantIds } = req.body;
  if (!event || !participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({ success: false, message: 'Missing event or participantIds' });
  }

  console.log(`Processing email blast for ${participantIds.length} participants`);

  try {
    // Fetch user emails with better error handling
    const userEmailPromises = participantIds.map(async (id) => {
      try {
        const snapshot = await db.ref(`users/${id}/profile/email`).once('value');
        const email = snapshot.val();
        
        if (!email) {
          console.warn(`No email found for user ${id}`);
          return null;
        }
        
        if (!isValidEmail(email)) {
          console.warn(`Invalid email format for user ${id}: ${email}`);
          return null;
        }
        
        return email.trim().toLowerCase();
      } catch (error) {
        console.error(`Error fetching email for user ${id}:`, error.message);
        return null;
      }
    });

    const emailResults = await Promise.all(userEmailPromises);
    const validEmails = emailResults.filter(Boolean);
    const uniqueEmails = [...new Set(validEmails)]; // Remove duplicates

    console.log(`Found ${validEmails.length} valid emails out of ${participantIds.length} participants`);
    console.log(`After deduplication: ${uniqueEmails.length} unique emails`);

    if (uniqueEmails.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No valid emails found for participants.',
        details: {
          totalParticipants: participantIds.length,
          validEmails: 0,
          uniqueEmails: 0
        }
      });
    }

    // Format event dates
    const start = formatDate(event.start);
    const end = formatDate(event.end);
    const dateRange = `${start} - ${end}`;

    const subject = `You have been scheduled for: ${event.title}`;
    const html = `
      <h2>Event Scheduled</h2>
      <p>You have been scheduled for <strong>${event.title}</strong> on <strong>${dateRange}</strong> at <strong>${event.location}</strong>.</p>
      <p><strong>Description:</strong> ${event.description || 'No description provided.'}</p>
      <hr>
      <p><small>This is an automated message from the QR System.</small></p>
    `;

    // Send emails in batches
    const batchSize = uniqueEmails.length > 50 ? 5 : 10; // Smaller batches for larger sends
    const results = await sendEmailsBatch(uniqueEmails, subject, html, batchSize);

    console.log(`Email blast complete. Sent: ${results.sent.length}, Failed: ${results.failed.length}`);

    return res.status(200).json({ 
      success: true, 
      message: `Email blast completed. ${results.sent.length} emails sent successfully, ${results.failed.length} failed.`,
      details: {
        totalParticipants: participantIds.length,
        validEmails: validEmails.length,
        uniqueEmails: uniqueEmails.length,
        sent: results.sent.length,
        failed: results.failed.length,
        failedEmails: results.failed.map(f => ({ email: f.email, error: f.error }))
      }
    });
  } catch (error) {
    console.error('Error sending event notification emails:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}`,
      details: {
        error: error.message,
        totalParticipants: participantIds?.length || 0
      }
    });
  }
} 
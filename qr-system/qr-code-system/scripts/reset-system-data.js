// scripts/reset-system-data.js
//
// Deletes ALL attendance, events and deleted-user backups in the production
// database, and clears every user's schedule, attendance, events and stats.
// There is no undo.
//
//   Dry run (default, deletes nothing):  node scripts/reset-system-data.js
//   Delete:                              node scripts/reset-system-data.js --apply
//
// --apply asks you to type the project id, then saves a backup of everything
// it deletes to ~/qr-system-backups/ before deleting. The backup is kept
// outside the repo because it contains personal data.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const TOP_LEVEL_NODES = ['attendance', 'events', 'deleted_users'];

// Every per-user field that holds attendance or schedule state. The clock
// flags are included so nobody is left looking "clocked in" after a reset.
const USER_FIELDS = [
  'schedule',
  'attendance',
  'clockInTimes',
  'clockOutTimes',
  'events',
  'statistics',
  'stats',
  'activityLog',
  'clockedIn',
  'clockedInDate',
  'clockedInTimestamp',
  'clockedOut',
  'clockedOutDate',
  'clockedOutTimestamp',
];

const isPadrino = (user) => Boolean(user && user.profile && user.profile.padrino);

// One multi-path update, so the reset is all-or-nothing.
function buildResetUpdates(users) {
  const updates = {};
  TOP_LEVEL_NODES.forEach((node) => {
    updates[node] = null;
  });
  Object.entries(users || {}).forEach(([uid, user]) => {
    USER_FIELDS.forEach((field) => {
      updates[`users/${uid}/${field}`] = null;
    });
    if (isPadrino(user)) {
      updates[`users/${uid}/profile/padrinoColor`] = 'blue';
      updates[`users/${uid}/profile/padrinoColorCode`] = 'blue';
      updates[`users/${uid}/profile/manualColorOverride`] = false;
    }
  });
  return updates;
}

// Everything buildResetUpdates would delete or overwrite.
function buildBackup(data) {
  const backup = { takenAt: new Date().toISOString(), users: {} };
  TOP_LEVEL_NODES.forEach((node) => {
    backup[node] = data[node] === undefined ? null : data[node];
  });
  Object.entries(data.users || {}).forEach(([uid, user]) => {
    const kept = {};
    USER_FIELDS.forEach((field) => {
      if (user && user[field] !== undefined) kept[field] = user[field];
    });
    if (isPadrino(user)) {
      const { padrinoColor, padrinoColorCode, manualColorOverride } = user.profile;
      kept.profile = { padrinoColor, padrinoColorCode, manualColorOverride };
    }
    if (Object.keys(kept).length > 0) backup.users[uid] = kept;
  });
  return backup;
}

function summarize(data) {
  const users = Object.values(data.users || {});
  const lines = TOP_LEVEL_NODES.map(
    (node) => `${node}: ${Object.keys(data[node] || {}).length} entries deleted`
  );
  USER_FIELDS.forEach((field) => {
    const count = users.filter((user) => user && user[field] !== undefined).length;
    if (count > 0) lines.push(`users/*/${field}: cleared on ${count} users`);
  });
  lines.push(`padrino colors reset to blue: ${users.filter(isPadrino).length} users`);
  return lines;
}

function confirmationMatches(answer, projectId) {
  return typeof answer === 'string' && Boolean(projectId) && answer.trim() === projectId;
}

// The database must belong to the project you confirm, e.g.
// https://<project>-default-rtdb.firebaseio.com, so typing one project's id
// can never delete another project's data.
function databaseMatchesProject(databaseURL, projectId) {
  if (!projectId) return false;
  try {
    const label = new URL(databaseURL).hostname.split('.')[0];
    return label === projectId || label.startsWith(`${projectId}-`);
  } catch (error) {
    return false;
  }
}

function connect() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const {
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: clientEmail,
    FIREBASE_PRIVATE_KEY: privateKey,
    FIREBASE_DATABASE_URL: databaseURL,
  } = process.env;
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error(
      'Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or FIREBASE_DATABASE_URL. Add them to .env (see .env.example).'
    );
  }
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    databaseURL,
  });
  return { db: admin.database(), projectId, databaseURL };
}

async function loadData(db) {
  const data = {};
  for (const node of [...TOP_LEVEL_NODES, 'users']) {
    data[node] = (await db.ref(node).once('value')).val();
  }
  return data;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function writeBackup(backup) {
  const dir = path.join(os.homedir(), 'qr-system-backups');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `reset-${backup.takenAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), { mode: 0o600 });
  return file;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { db, projectId, databaseURL } = connect();
  if (!databaseMatchesProject(databaseURL, projectId)) {
    throw new Error(`FIREBASE_DATABASE_URL (${databaseURL}) does not belong to project ${projectId}. Fix .env first.`);
  }
  const data = await loadData(db);

  console.log(apply ? `RESET of ${databaseURL} will delete:` : `DRY RUN for ${databaseURL} (nothing is deleted):`);
  summarize(data).forEach((line) => console.log(`  ${line}`));

  if (!apply) {
    console.log('\nRun with --apply to delete. You will be asked to type the project id.');
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error('Refusing to delete without an interactive terminal.');
  }
  const answer = await ask(`\nThis cannot be undone. Type the project id (${projectId}) to continue: `);
  if (!confirmationMatches(answer, projectId)) {
    console.log('Not confirmed. Nothing was deleted.');
    return;
  }

  const file = writeBackup(buildBackup(data));
  console.log(`Backup saved to ${file}. It contains personal data; keep it private.`);
  await db.ref().update(buildResetUpdates(data.users));
  console.log('Reset complete.');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Reset failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  buildResetUpdates,
  buildBackup,
  summarize,
  confirmationMatches,
  databaseMatchesProject,
  USER_FIELDS,
  TOP_LEVEL_NODES,
};

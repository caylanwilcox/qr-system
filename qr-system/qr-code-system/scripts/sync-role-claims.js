// scripts/sync-role-claims.js
// Copies each user's database role into their login token's custom claims, so the
// API can stop trusting the browser-writable database role.
//
//   Dry run (default, changes nothing):  node scripts/sync-role-claims.js
//   Apply the listed changes:            node scripts/sync-role-claims.js --apply
//
// Review the dry run first: database roles could be edited from the browser, so confirm
// every user listed as becoming admin or super_admin before applying.
// After applying, set ALLOW_DB_ROLE_FALLBACK=false in Vercel.

const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email || !process.env.FIREBASE_DATABASE_URL) {
  console.error('Missing FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL or FIREBASE_DATABASE_URL. Add them to .env (see .env.example).');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

// Keep these three helpers in sync with api/_lib/auth.js.
const ROLES = ['employee', 'admin', 'super_admin'];

function normalizeRole(role) {
  if (typeof role !== 'string') return null;
  const value = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'superadmin') return 'super_admin';
  return ROLES.includes(value) ? value : null;
}

function roleFromUserRecord(userData) {
  const candidates = [userData?.profile?.role, userData?.role, userData?.profile?.userRole, userData?.userRole];
  for (const candidate of candidates) {
    const role = normalizeRole(candidate);
    if (role) return role;
  }
  return null;
}

function claimsForRole(role) {
  return {
    role,
    ...(role === 'admin' || role === 'super_admin' ? { admin: true } : {}),
    ...(role === 'super_admin' ? { superAdmin: true } : {}),
  };
}

const stable = (obj) => JSON.stringify(Object.keys(obj).sort().map((key) => [key, obj[key]]));

// Compares every login account's claims with its database role.
async function collectChanges(users) {
  const changes = [];
  const skipped = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    for (const authUser of page.users) {
      const label = `${authUser.uid} (${authUser.email || 'no email'})`;
      const record = users[authUser.uid];
      if (!record) {
        skipped.push(`${label}: no database record`);
        continue;
      }
      const dbRole = roleFromUserRecord(record);
      if (!dbRole) {
        skipped.push(`${label}: missing or unknown role`);
        continue;
      }
      const current = authUser.customClaims || {};
      const { role: _role, admin: _admin, superAdmin: _superAdmin, ...otherClaims } = current;
      const next = { ...otherClaims, ...claimsForRole(dbRole) };
      if (stable(current) !== stable(next)) {
        changes.push({ uid: authUser.uid, label, from: current.role || '(none)', to: dbRole, next });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  // Show admin grants first: those are the ones to double-check.
  const rank = { super_admin: 0, admin: 1, employee: 2 };
  changes.sort((a, b) => rank[a.to] - rank[b.to]);
  return { changes, skipped };
}

function printPlan(changes, skipped, apply) {
  console.log(`\n${changes.length} users need claim changes${apply ? '' : ' (dry run, nothing written)'}:`);
  for (const change of changes) {
    const flag = change.to === 'employee' ? '' : '   <-- ADMIN ACCESS, confirm';
    console.log(`  ${change.label}: ${change.from} -> ${change.to}${flag}`);
  }
  if (skipped.length) {
    console.log(`\n${skipped.length} login accounts skipped:`);
    skipped.forEach((line) => console.log(`  ${line}`));
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const users = (await admin.database().ref('users').once('value')).val() || {};
  const { changes, skipped } = await collectChanges(users);
  printPlan(changes, skipped, apply);

  if (!apply) {
    console.log('\nRe-run with --apply to write these claims.');
    return;
  }

  for (const change of changes) {
    await admin.auth().setCustomUserClaims(change.uid, change.next);
  }
  console.log(`\nUpdated claims for ${changes.length} users.`);
  console.log('Users pick up new claims when their token refreshes (within an hour) or on next sign-in.');
  console.log('Next: set ALLOW_DB_ROLE_FALLBACK=false in Vercel so the API trusts claims only.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Load environment variables
require('dotenv').config();

const admin = require('firebase-admin');

// Check required environment variables
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not defined');
  process.exit(1);
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccount = {
    type: process.env.TYPE,
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASE_URL,
  });
}

const db = admin.database();
const auth = admin.auth();

// Helper functions
function generateEmail(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '.') // Replace spaces and special chars with dots
    .replace(/\.+/g, '.') // Replace multiple dots with single dot
    .replace(/^\.+|\.+$/g, '') // Remove dots from start and end
    + '@av.com';
}

function cleanLocationName(location) {
  return (location || '').replace(/agua viva\s*/i, '').trim() || 'Aurora';
}

// Database operations
const dbOperations = {
  async createUserAuth(userData) {
    try {
      const email = generateEmail(userData.name);
      
      const userRecord = await auth.createUser({
        email,
        password: 'AV2025',
        displayName: userData.name,
        disabled: userData.status !== 'active'
      });

      const customClaims = {
        role: userData.role?.toLowerCase() || 'employee'
      };

      if (customClaims.role === 'admin') {
        customClaims.admin = true;
      } else if (customClaims.role === 'super_admin') {
        customClaims.admin = true;
        customClaims.superAdmin = true;
      }

      await auth.setCustomUserClaims(userRecord.uid, customClaims);

      return {
        success: true,
        uid: userRecord.uid,
        email,
        customClaims
      };
    } catch (error) {
      console.error(`Failed to create auth for ${userData.name}:`, error);
      return { success: false, error };
    }
  },

  async migrateDatabase() {
    console.log('Starting database migration...');
    
    try {
      // 1. Create backup
      console.log('Creating backup...');
      const snapshot = await db.ref('/').once('value');
      const oldData = snapshot.val();
      await db.ref('backup_before_migration').set(oldData);

      // 2. Prepare new structure
      const newStructure = {
        users: {},
        events: {},
        locations: {},
        attendance: {},
        userCredentials: []
      };

      // 3. Process locations
      console.log('Processing locations...');
      const locations = oldData.locations || {};
      for (const [locationId, location] of Object.entries(locations)) {
        const cleanedName = cleanLocationName(location.name);
        newStructure.locations[cleanedName.toLowerCase()] = {
          name: cleanedName,
          address: location.address || '',
          activeUsers: {}
        };
      }

      // 4. Process users
      console.log('Processing users...');
      const users = oldData.users || {};
      const authResults = {
        success: [],
        failed: []
      };

      for (const [userId, userData] of Object.entries(users)) {
        if (!userData.name) continue;

        console.log(`Processing user: ${userData.name}`);
        const authResult = await this.createUserAuth(userData);

        if (authResult.success) {
          const cleanLocation = cleanLocationName(userData.location);
          const { uid, email, customClaims } = authResult;

          // Create user profile
          newStructure.users[uid] = {
            profile: {
              name: userData.name,
              email,
              phone: userData.phone || '',
              department: userData.department || '',
              position: userData.position || '',
              role: customClaims.role,
              status: userData.status || 'active',
              joinDate: userData.joinDate || new Date().toISOString(),
              primaryLocation: cleanLocation.toLowerCase(),
              emergencyContact: {
                name: userData.emergencyContact || '',
                phone: userData.emergencyPhone || ''
              }
            },
            stats: {
              daysPresent: userData.stats?.daysPresent || 0,
              daysAbsent: userData.stats?.daysAbsent || 0,
              daysLate: userData.stats?.daysLate || 0,
              attendanceRate: userData.stats?.attendanceRate || 0,
              onTimeRate: userData.stats?.onTimeRate || 0,
              lastClockIn: userData.stats?.lastClockIn || null,
              lastClockOut: userData.stats?.lastClockOut || null,
              totalHours: userData.stats?.totalHours || 0
            }
          };

          // Add to active users if status is active
          if (userData.status === 'active') {
            newStructure.locations[cleanLocation.toLowerCase()].activeUsers[uid] = {
              position: userData.position || '',
              lastClockIn: userData.stats?.lastClockIn || null
            };
          }

          authResults.success.push({
            name: userData.name,
            email,
            password: 'AV2025'
          });
        } else {
          authResults.failed.push({
            name: userData.name,
            error: authResult.error.message
          });
        }
      }

      // 5. Process events
      console.log('Processing events...');
      const events = oldData.events || {};
      for (const [eventId, event] of Object.entries(events)) {
        if (!event.title) continue;

        const cleanedLocation = cleanLocationName(event.location);
        newStructure.events[eventId] = {
          title: event.title,
          description: event.description || '',
          type: event.type || '',
          location: cleanedLocation,
          start: event.start || '',
          end: event.end || '',
          createdAt: event.createdAt || new Date().toISOString(),
          updatedAt: event.updatedAt || new Date().toISOString(),
          status: event.status || 'pending',
          isUrgent: event.isUrgent || false,
          staffRequirements: event.staffRequirements || []
        };
      }

      // 6. Store credentials temporarily
      newStructure.userCredentials = authResults.success;

      // 7. Write new structure
      console.log('Writing new database structure...');
      await db.ref('/').update(newStructure);

      return {
        status: 'success',
        message: 'Migration completed successfully',
        authResults
      };
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        status: 'error',
        message: 'Migration failed',
        error: error.message
      };
    }
  }
};

// Export the module
module.exports = {
  db,
  auth,
  dbOperations
};

// If this file is run directly, execute the migration
if (require.main === module) {
  console.log('Running database migration...');
  dbOperations.migrateDatabase()
    .then(result => {
      console.log('\n=== Migration Complete ===');
      console.log(`Successful auth accounts: ${result.authResults.success.length}`);
      console.log(`Failed auth accounts: ${result.authResults.failed.length}`);
      
      console.log('\n=== User Credentials ===');
      result.authResults.success.forEach(user => {
        console.log(`\nName: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Password: AV2025`);
      });
      
      if (result.authResults.failed.length > 0) {
        console.log('\n=== Failed Accounts ===');
        result.authResults.failed.forEach(failure => {
          console.log(`\nName: ${failure.name}`);
          console.log(`Error: ${failure.error}`);
        });
      }
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
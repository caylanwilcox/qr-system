// InitializeSystemCodes.js - Backend version using Firebase Admin SDK

const admin = require("firebase-admin");
require('dotenv').config({ path: '../.env' });

// Initialize Firebase Admin using environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
};

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID', 
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n📝 Please create a .env file in the project root with your Firebase credentials.');
  process.exit(1);
}

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

// Database initialization script to set up our system codes
async function initializeSystemCodesDatabase() {
  console.log('Starting system codes database initialization...');

  try {
    // Service Types
    const serviceTypesRef = db.ref('serviceTypes');
    const serviceTypesSnapshot = await serviceTypesRef.once('value');
    
    if (!serviceTypesSnapshot.exists()) {
      console.log('Initializing serviceTypes...');
      const serviceTypes = {
        'st-1': {
          name: 'RSG',
          description: 'Orejas',
          createdAt: new Date().toISOString()
        },
        'st-2': {
          name: 'COM',
          description: 'Apoyos',
          createdAt: new Date().toISOString()
        },
        'st-3': {
          name: 'LIDER',
          description: 'Lider',
          createdAt: new Date().toISOString()
        },
        'st-4': {
          name: 'TESORERO DE GRUPO',
          description: 'Tesorero de Grupo',
          createdAt: new Date().toISOString()
        },
        'st-5': {
          name: 'PPI',
          description: 'PPI',
          createdAt: new Date().toISOString()
        },
        'st-6': {
          name: 'MANAGER DE HACIENDA',
          description: 'Manager de Hacienda',
          createdAt: new Date().toISOString()
        },
        'st-7': {
          name: 'COORDINADOR DE HACIENDA',
          description: 'Coordinador de Hacienda',
          createdAt: new Date().toISOString()
        },
        'st-8': {
          name: 'ATRACCION INTERNA',
          description: 'Atraccion Interna',
          createdAt: new Date().toISOString()
        },
        'st-9': {
          name: 'ATRACCION EXTERNA',
          description: 'Atraccion Externa',
          createdAt: new Date().toISOString()
        },
        'st-10': {
          name: 'SECRETARY',
          description: 'Secretary',
          createdAt: new Date().toISOString()
        },
        'st-11': {
          name: 'LITERATURA',
          description: 'Literatura',
          createdAt: new Date().toISOString()
        },
        'st-12': {
          name: 'SERVIDOR DE CORO',
          description: 'Servidor de Coro',
          createdAt: new Date().toISOString()
        },
        'st-13': {
          name: 'SERVIDOR DE JAV EN MESA',
          description: 'Servidor de JAV en Mesa',
          createdAt: new Date().toISOString()
        },
        'st-14': {
          name: 'SERVIDOR DE SEGUIMIENTOS',
          description: 'Servidor de Seguimientos',
          createdAt: new Date().toISOString()
        }
      };
      
      await serviceTypesRef.set(serviceTypes);
      console.log('ServiceTypes initialized successfully.');
    } else {
      console.log('ServiceTypes already exist, skipping initialization.');
    }

    // Positions
    const positionsRef = db.ref('positions');
    const positionsSnapshot = await positionsRef.once('value');
    
    if (!positionsSnapshot.exists()) {
      console.log('Initializing positions...');
      const positions = {
        'pos-1': {
          name: 'Manager',
          description: 'Manager position',
          createdAt: new Date().toISOString()
        },
        'pos-2': {
          name: 'Coordinator',
          description: 'Coordinator position',
          createdAt: new Date().toISOString()
        },
        'pos-3': {
          name: 'Volunteer',
          description: 'Volunteer position',
          createdAt: new Date().toISOString()
        },
        'pos-4': {
          name: 'Leader',
          description: 'Team Leader position',
          createdAt: new Date().toISOString()
        },
        'pos-5': {
          name: 'Member',
          description: 'Regular member position',
          createdAt: new Date().toISOString()
        }
      };
      
      await positionsRef.set(positions);
      console.log('Positions initialized successfully.');
    } else {
      console.log('Positions already exist, skipping initialization.');
    }

    // Locations
    const locationsRef = db.ref('locations');
    const locationsSnapshot = await locationsRef.once('value');
    
    if (!locationsSnapshot.exists()) {
      console.log('Initializing locations...');
      const locations = {
        'loc-1': {
          name: 'Aurora',
          description: 'Aurora Location',
          createdAt: new Date().toISOString()
        },
        'loc-2': {
          name: 'westchicago',
          description: 'West Chicago Location',
          createdAt: new Date().toISOString()
        },
        'loc-3': {
          name: 'lyons',
          description: 'Lyons Location',
          createdAt: new Date().toISOString()
        },
        'loc-4': {
          name: 'Elgin',
          description: 'Elgin Location',
          createdAt: new Date().toISOString()
        },
        'loc-5': {
          name: 'Joliet',
          description: 'Joliet Location',
          createdAt: new Date().toISOString()
        },
        'loc-6': {
          name: 'Wheeling',
          description: 'Wheeling Location',
          createdAt: new Date().toISOString()
        },
        'loc-7': {
          name: 'Javs',
          description: 'Javs Location',
          createdAt: new Date().toISOString()
        }
      };
      
      await locationsRef.set(locations);
      console.log('Locations initialized successfully.');
    } else {
      console.log('Locations already exist, skipping initialization.');
    }

    // Roles
    const rolesRef = db.ref('roles');
    const rolesSnapshot = await rolesRef.once('value');
    
    if (!rolesSnapshot.exists()) {
      console.log('Initializing roles...');
      const roles = {
        'role-1': {
          name: 'employee',
          description: 'Regular employee with basic access',
          createdAt: new Date().toISOString()
        },
        'role-2': {
          name: 'admin',
          description: 'Location admin with location-specific management',
          createdAt: new Date().toISOString()
        },
        'role-3': {
          name: 'super_admin',
          description: 'Super admin with system-wide access',
          createdAt: new Date().toISOString()
        }
      };
      
      await rolesRef.set(roles);
      console.log('Roles initialized successfully.');
    } else {
      console.log('Roles already exist, skipping initialization.');
    }

    // Statuses
    const statusesRef = db.ref('statuses');
    const statusesSnapshot = await statusesRef.once('value');
    
    if (!statusesSnapshot.exists()) {
      console.log('Initializing statuses...');
      const statuses = {
        'status-1': {
          name: 'active',
          description: 'Active employee',
          createdAt: new Date().toISOString()
        },
        'status-2': {
          name: 'inactive',
          description: 'Inactive employee',
          createdAt: new Date().toISOString()
        },
        'status-3': {
          name: 'on_leave',
          description: 'Employee on leave',
          createdAt: new Date().toISOString()
        },
        'status-4': {
          name: 'suspended',
          description: 'Suspended employee',
          createdAt: new Date().toISOString()
        }
      };
      
      await statusesRef.set(statuses);
      console.log('Statuses initialized successfully.');
    } else {
      console.log('Statuses already exist, skipping initialization.');
    }

    // Meeting Types
    const meetingTypesRef = db.ref('meetingTypes');
    const meetingTypesSnapshot = await meetingTypesRef.once('value');
    
    if (!meetingTypesSnapshot.exists()) {
      console.log('Initializing meetingTypes...');
      const meetingTypes = {
        'mt-1': {
          name: 'PADRINOS Y OREJAS',
          description: 'Meeting for Padrinos y Orejas',
          createdAt: new Date().toISOString()
        },
        'mt-2': {
          name: 'GENERAL',
          description: 'General Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-3': {
          name: 'INICIANDO EL CAMINO',
          description: 'Iniciando el Camino Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-4': {
          name: 'CIRCULO DE RECUPERACION',
          description: 'Circulo de Recuperacion Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-5': {
          name: 'TRIBUNA',
          description: 'Tribuna Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-6': {
          name: 'SEGUIMIENTO',
          description: 'Seguimiento Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-7': {
          name: 'CIRCULO DE ESTUDIO',
          description: 'Circulo de Estudio Meeting',
          createdAt: new Date().toISOString()
        },
        'mt-8': {
          name: 'NOCHE DE GUERRO',
          description: 'Noche de Guerro Meeting',
          createdAt: new Date().toISOString()
        }
      };
      
      await meetingTypesRef.set(meetingTypes);
      console.log('Meeting Types initialized successfully.');
    } else {
      console.log('Meeting Types already exist, skipping initialization.');
    }

    // Event Types
    const eventTypesRef = db.ref('eventTypes');
    const eventTypesSnapshot = await eventTypesRef.once('value');
    
    if (!eventTypesSnapshot.exists()) {
      console.log('Initializing eventTypes...');
      const eventTypes = {
        'et-1': {
          name: 'WORKSHOPS',
          displayName: 'Workshops',
          description: 'Workshop events',
          createdAt: new Date().toISOString()
        },
        'et-2': {
          name: 'MEETINGS',
          displayName: 'Meetings',
          description: 'Meeting events',
          createdAt: new Date().toISOString()
        },
        'et-3': {
          name: 'HACIENDAS',
          displayName: 'Haciendas',
          description: 'Hacienda events',
          createdAt: new Date().toISOString()
        },
        'et-4': {
          name: 'JUNTA_HACIENDA',
          displayName: 'Junta Hacienda',
          description: 'Junta Hacienda events',
          createdAt: new Date().toISOString()
        },
        'et-5': {
          name: 'GESTION',
          displayName: 'Gestion',
          description: 'Gestion events',
          createdAt: new Date().toISOString()
        }
      };
      
      await eventTypesRef.set(eventTypes);
      console.log('Event Types initialized successfully.');
    } else {
      console.log('Event Types already exist, skipping initialization.');
    }

    // Event Type to Category mapping
    const eventTypeToCategoryRef = db.ref('eventTypeCategories');
    const eventTypeToCategorySnapshot = await eventTypeToCategoryRef.once('value');
    
    if (!eventTypeToCategorySnapshot.exists()) {
      console.log('Initializing eventTypeCategories...');
      const eventTypeCategories = {
        'WORKSHOPS': 'WORKSHOPS',
        'MEETINGS': 'MEETINGS',
        'HACIENDAS': 'HACIENDAS',
        'JUNTA_HACIENDA': 'JUNTA_HACIENDA',
        'GESTION': 'GESTION'
      };
      
      await eventTypeToCategoryRef.set(eventTypeCategories);
      console.log('Event Type Categories initialized successfully.');
    } else {
      console.log('Event Type Categories already exist, skipping initialization.');
    }

    console.log('System codes database initialization completed!');
    
    return true;
  } catch (error) {
    console.error('Error during system codes database initialization:', error);
    return false;
  }
}

// Run the function
initializeSystemCodesDatabase()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
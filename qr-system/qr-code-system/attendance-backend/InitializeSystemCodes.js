// InitializeSystemCodes.js - Backend version using Firebase Admin SDK

const admin = require("firebase-admin");

// Use your existing service account
const serviceAccount = {
  type: "service_account",
  project_id: "qr-system-1cea7",
  private_key_id: "14ad13ff505798e18917023a7de21bff80386377",
  private_key: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFamWAJUrHYeM0\n6LdmkmRom3zfzyS+Y7ES6bFsjYab7/5k4SPKipDfxPIK9JPU3eUV0vxAFTmAXy7T\nApF39FgoKm8DhFCBNUbjTmjmQSw1+vt5OlF68Lj9d9hl1b6RJgQkr7ZBgoJTdx4E\neUHCCscu29IIdlOTt4mqkGfPysadc/aLBhBEJeEQs9sQYMghHcYDx3X51f7EdS+J\ntbqGoEIXy7lW0u4LhJMcGkKK0mK/bOxLi3QsNeA7CkCsCSt34xXngn8WJgvZSB5E\ngSr9FxQTTxpbSFHFBhoePHXO2Zql70ZOcERi8yMiwCI/KuspBrhyFDRMC12kpo/q\n5CUGACcvAgMBAAECggEAGL90G/K7g2/SWMv3pHnORo1/blsnDbWs+WRRuVGrQe8o\nYqMVUTW6YE2YfiZs8IQkohjB8JKjPmQwQtmRPOAPu8aeBhXXNcC6XefIH11PhTDX\nx48NBIQa3K43yC8EZb5wnzIRKfiKDUaN0nJqUOtNpE0q8PlMaY8vndyJIbPCNEig\nifv2hI2f1FIgjr3fDYQzqT684OiZnNytAw75fY4BjrYVfWGNik7aUXwNyTUOq5s2\nkQDGHi196cpwCPYE7Jf2vKHyaudTOVwfGQJEimZNWJ5VXIG4RNjdEIR+ceUJvWJp\nbe0rNvledDdiwrtVWJrqRtATanlVf1SnQJZJ+7kLgQKBgQDmljfQ+Gl/lHjZFZsP\nNuKKaGc8b2jZOCsjjsYmGEQPniOHqlhThzHcd1zwDkcnvwek83EHBa8o4qMSsvlp\n3I3sKSJdomQiPT4PmXMQf4wnAGON1BX1dWA8gpU4B8sbgeTVymGnpYFPCjeCYOs9\nT8jfQMs7rU8c8uRA15NerbYcbwKBgQDbLEkzA1twyVpRIUh52xm4Tj4UeKvIYtO8\nfS9biYl1b7pn7fcpsOFIMQ/l6sBPZAHfezBr6n4842BB0dxQkgebIGom+N7bLpBC\na7ys+9wYaNaRiho6nrJXwO8zhjKaB3ELdBhMcloHmxau/MsA2a4ZyQXttRMQt+yL\nLPF9lgGBQQKBgQDZ4bugI/pb6Qk/5yB7gdsR+ZEDFCq4hlCM6s3lFSzKrRzZhmar\nlqXQsqEI3BT0Q5ePj9CPWBmowm5grujp1NPuAPhODbIcgE3yI4cMYdkmyUFItMyD\nAYQL6T/ij8qllVmLgg5AgSzsaLUG51mgt5ERE4J2Q07sBb8UXh8MaYwY1QKBgQCK\njmGsLUgmcjR1q5vc5UVKPbSDTpISuV9v/pfsv3M12a83OroREjApalLJn/F5fxis\nBn3jCzhJF9lnYttr2BWU3RYekyCX4cTzKJb7qLFIgSZ8lZjlTCQk0+SkZwcgVuoB\nOqCN25DM1B+v+kH/xJ2K0Ym878cgv5V7mqsEIMvMwQKBgGNlfrKrLrcHiMQvegx+\nRnNXlLFHLNUzNJoTGgt/SxZYFOjUOaKpHDcrnvE40ciskktIXN1ipaIvUVyaDwTc\n9ZU9ndz0cpupK45dWWzx070ddbWwwB16MQNjCi3T+7d0KZ8HLOZaWTQ5VdeERkPR\nhYO57PTsaw0oJBWhPy2naEWb\n-----END PRIVATE KEY-----\n`,
  client_email: "firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com",
  client_id: "118105325590848927895",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fqxwu%40qr-system-1cea7.iam.gserviceaccount.com"
};

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
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
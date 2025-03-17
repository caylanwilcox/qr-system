require('dotenv').config({ path: '/Users/it/code/qr-system/qr-system/qr-code-system/.env' });

console.log("Database URL from env:", process.env.REACT_APP_FIREBASE_DATABASE_URL);

const { db } = require('./db'); // Import your existing db setup

/**
 * Setup the management structure for admins to manage by location and department
 * @param {string} superAdminId - The UID of the super admin user
 */
async function setupManagementStructure(superAdminId) {
  console.log("Starting management structure setup...");

  try {
    // 1. Get all users
    const usersSnapshot = await db.ref('users').once('value');
    if (!usersSnapshot.exists()) {
      console.error("No users found in the database");
      return;
    }

    const users = usersSnapshot.val();

    // 2. Identify all admins (including super_admin)
    const admins = {};
    const regularUsers = {};

    Object.entries(users).forEach(([userId, userData]) => {
      const profile = userData.profile || {};

      if (profile.role === 'admin' || profile.role === 'super_admin') {
        admins[userId] = {
          ...profile,
          id: userId
        };
      } else {
        regularUsers[userId] = {
          ...profile,
          id: userId
        };
      }
    });

    console.log(`Found ${Object.keys(admins).length} admins and ${Object.keys(regularUsers).length} regular users`);

    // 3. Extract all unique locations and departments
    const locations = {};
    const departments = {};

    Object.values(users).forEach(userData => {
      const profile = userData.profile || {};

      if (profile.primaryLocation && profile.primaryLocation.trim() !== '') {
        locations[profile.primaryLocation] = true;
      }

      if (profile.department && profile.department.trim() !== '') {
        departments[profile.department] = true;
      }
    });

    console.log(`Found ${Object.keys(locations).length} unique locations and ${Object.keys(departments).length} unique departments`);

    // 4. Create initial management structure entry for super admin
    // Super admin manages all locations and departments
    const managementUpdates = {};

    managementUpdates[`managementStructure/${superAdminId}`] = {
      managedLocations: locations,
      managedDepartments: departments,
      role: 'super_admin'
    };

    // 5. Create initial management structure for other admins
    // Initially, each admin is assigned their own location
    Object.entries(admins).forEach(([adminId, adminData]) => {
      if (adminId !== superAdminId && adminData.primaryLocation) {
        // For each admin, assign their own location 
        const adminLocations = {};
        adminLocations[adminData.primaryLocation] = true;

        // If admin has a department, assign that department
        const adminDepartments = {};
        if (adminData.department && adminData.department.trim() !== '') {
          adminDepartments[adminData.department] = true;
        }

        managementUpdates[`managementStructure/${adminId}`] = {
          managedLocations: adminLocations,
          managedDepartments: adminDepartments,
          role: adminData.role
        };
      }
    });

    // 6. Set managedBy field for each regular user to their location
    // This is the key change - we're storing location, not admin ID
    const userUpdates = {};

    Object.entries(regularUsers).forEach(([userId, userData]) => {
      if (userData.primaryLocation) {
        // Set managedBy to the user's location
        userUpdates[`users/${userId}/profile/managedBy`] = userData.primaryLocation;
      }
    });

    // 7. Execute updates
    console.log("Applying management structure updates...");
    await db.ref().update(managementUpdates);
    console.log("Management structure created successfully");

    console.log("Updating user managedBy fields...");
    await db.ref().update(userUpdates);
    console.log("User management assignments completed");

    return {
      adminsCount: Object.keys(admins).length,
      usersCount: Object.keys(regularUsers).length,
      locationsCount: Object.keys(locations).length,
      departmentsCount: Object.keys(departments).length
    };
  } catch (error) {
    console.error("Error setting up management structure:", error);
    throw error;
  }
}

/**
 * Run the initial setup
 */
async function runInitialSetup() {
  try {
    // Get the super admin ID - in your case it appears to be "QImMxBxXUbTZJcrJyjtLnMuFMmQ2" 
    const superAdminId = "QImMxBxXUbTZJcrJyjtLnMuFMmQ2"; 

    // Run the setup
    const results = await setupManagementStructure(superAdminId);
    console.log("Setup completed successfully:", results);

    return results;
  } catch (error) {
    console.error("Setup failed:", error);
    throw error;
  }
}

// Run the setup when this script is executed directly
if (require.main === module) {
  runInitialSetup()
    .then(results => {
      console.log('Management structure setup complete!', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = {
  setupManagementStructure,
  runInitialSetup
};
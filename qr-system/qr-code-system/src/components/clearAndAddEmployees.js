const { ref, set, remove } = require('firebase/database');
const { database } = require('../services/firebaseConfig'); // Import your Firebase config

const clearAndAddEmployees = async () => {
  try {
    // Define the locations
    const locations = [
      'Agua Viva Elgin R7',
      'Agua Viva Joliet',
      'Agua Viva Lyons',
      'Agua Viva West Chicago',
      'Agua Viva Wheeling'
    ];

    // Loop through each location to clear and add employees
    for (const location of locations) {
      const locationRef = ref(database, `attendance/Agua Viva/${location}`);

      // Remove existing employees under the location
      await remove(locationRef);

      // Add two new employees with the specified attributes
      const newEmployees = {
        employee_001: {
          assignedDates: ['2024-10-08', '2024-10-22'],
          clockInTime: '2024-10-08T08:01:00',
          clockOutTime: '2024-10-08T16:01:00',
          name: 'Employee 001',
          position: 'Position A',
          daysScheduledPresent: 10,
          daysScheduledMissed: 2,
          totalDays: 12,
          daysOnTime: 8,
          daysLate: 2,
        },
        employee_002: {
          assignedDates: ['2024-10-10', '2024-10-25'],
          clockInTime: '2024-10-10T08:00:00',
          clockOutTime: '2024-10-10T16:00:00',
          name: 'Employee 002',
          position: 'Position B',
          daysScheduledPresent: 11,
          daysScheduledMissed: 1,
          totalDays: 12,
          daysOnTime: 9,
          daysLate: 1,
        },
      };

      // Set the new employees under the location
      await set(locationRef, newEmployees);
    }

    console.log('All employees cleared and new data added successfully.');
  } catch (error) {
    console.error('Error updating employee data:', error);
  }
};

// Call the function to execute the changes
clearAndAddEmployees();

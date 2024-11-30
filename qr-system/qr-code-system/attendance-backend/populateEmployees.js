import { ref, set } from "firebase/database";
import { database } from "./firebaseConfig";

const locations = [
  "Agua Viva Elgin R7",
  "Agua Viva Joliet",
  "Agua Viva Lyons",
  "Agua Viva West Chicago",
  "Agua Viva Wheeling"
];

const positions = ["Junior", "Intermediate", "Senior", "Manager", "Position A", "Position B"];

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomClockInTime = () => {
  // Simulate clock-in times between 7:00 AM and 9:00 AM (randomly generate)
  const date = new Date();
  date.setHours(getRandomInt(7, 9));
  date.setMinutes(getRandomInt(0, 59));
  date.setSeconds(0);
  return date.toISOString();
};

const populateEmployees = async () => {
  const employeesPerLocation = 10; // Number of employees per location
  const rankUpProbability = 0.2; // 20% chance of ranking up
  const newData = {};

  locations.forEach((location) => {
    newData[location] = {}; // Initialize location in the database

    for (let i = 0; i < employeesPerLocation; i++) {
      const employeeId = `employee_${i + 1}`;
      const clockInTime = getRandomClockInTime();
      const daysScheduledPresent = getRandomInt(4, 6); // Between 4 to 6 days scheduled to work
      const daysScheduledMissed = getRandomInt(0, 2); // Between 0 to 2 days missed
      const daysOnTime = getRandomInt(2, daysScheduledPresent); // On time days cannot exceed scheduled present days
      const daysLate = daysScheduledPresent - daysOnTime; // Late days calculated from scheduled present days

      const rankUp = Math.random() < rankUpProbability; // Random chance for rank up

      // Add randomized employee data
      newData[location][employeeId] = {
        name: `Employee ${i + 1}`,
        position: positions[getRandomInt(0, positions.length - 1)],
        clockInTime: clockInTime,
        daysScheduledPresent: daysScheduledPresent,
        daysScheduledMissed: daysScheduledMissed,
        daysOnTime: daysOnTime,
        daysLate: daysLate,
        rankUp: rankUp
      };
    }
  });

  // Push data to Firebase
  const attendanceRef = ref(database, "attendance");
  await set(attendanceRef, newData);

  console.log("Employees populated successfully!");
};

populateEmployees().catch((error) => console.error("Error populating employees:", error));

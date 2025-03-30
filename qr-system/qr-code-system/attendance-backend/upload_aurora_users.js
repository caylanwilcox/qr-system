const admin = require("firebase-admin");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com"
});

// Initialize with your service account credentials
// IMPORTANT: Load from a JSON file instead of hardcoding the credentials
// This avoids issues with the private key format

const db = admin.database();

// Helper: Generate email from name
const generateEmail = (name) => {
  if (!name) return "unknown@example.com";
  const emailName = name.toLowerCase().replace(/[^a-z0-9]/g, ".");
  return `${emailName}@avelgin.com`;
};

// Helper: Generate random phone number if not provided
const generatePhone = () => {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const firstPart = Math.floor(Math.random() * 900) + 100;
  const secondPart = Math.floor(Math.random() * 9000) + 1000;
  return `(${areaCode}) ${firstPart} ${secondPart}`;
};

// Add users to the database with overwrite protection
const addUsers = async (usersList) => {
  const usersRef = db.ref("users");
  const locationsRef = db.ref("locations");
  const userCredentialsRef = db.ref("userCredentials");
  const locationId = "Elgin";
  
  // First, ensure the location exists in the locations node
  await locationsRef.child(locationId).update({
    name: "West Chicago",
    address: "123 Main St, West Chicago, IL",
    activeUsers: {}
  });
  
  console.log("Created or updated West Chicago location in the database");
  
  // Clear existing West Chicago users to prevent duplications
  console.log("Cleaning up existing West Chicago users...");
  
  // Get all existing users
  const existingUsersSnapshot = await usersRef.once("value");
  const existingUsers = existingUsersSnapshot.val() || {};
  
  // Find and remove users with westchicago location
  for (const [userId, user] of Object.entries(existingUsers)) {
    if (user.location === locationId) {
      console.log(`Removing existing user: ${user.name} (${userId})`);
      await usersRef.child(userId).remove();
      
      // Also remove from location's activeUsers
      await locationsRef.child(locationId).child("activeUsers").child(userId).remove();
    }
  }
  
  // Update existing credentials for this location or create new ones
  const existingCredentialsSnapshot = await userCredentialsRef.once("value");
  const existingCredentials = existingCredentialsSnapshot.val() || {};
  const elginEmails = usersList.map(user => generateEmail(user.name));
  
  for (const [credId, cred] of Object.entries(existingCredentials)) {
    if (elginEmails.includes(cred.email)) {
      console.log(`Removing existing credentials for: ${cred.name} (${cred.email})`);
      await userCredentialsRef.child(credId).remove();
    }
  }
  
  console.log(`Adding ${usersList.length} users with location '${locationId}'...`);
  
  // Process each user
  for (const user of usersList) {
    if (!user.name || user.name.trim() === "") {
      console.warn("Skipping user due to missing name", user);
      continue;
    }
    
    // Generate a unique ID
    const userId = uuidv4();
    const phone = user.phone || generatePhone();
    const email = generateEmail(user.name);
    
    // Create login credentials
    const userCredential = {
      email: email,
      name: user.name,
      password: "AV2025" // Default password
    };
    
    // Add to userCredentials collection
    await userCredentialsRef.push(userCredential);
    console.log(`Created login credentials for: ${user.name} (${email})`);
    
    // Create user data structure directly matching your database structure and app requirements
    const userData = {
      name: user.name,
      location: locationId, // Store location directly in user node
      locationHistory: [
        {
          locationId: locationId,
          date: new Date().toISOString(),
          changedBy: "system"
        }
      ],
      profile: {
        department: "",
        email: email,
        emergencyContact: {
          name: "",
          phone: ""
        },
        joinDate: new Date().toISOString(),
        managedBy: "",
        name: user.name,
        padrinoColor: "red",
        phone: phone,
        position: user.position || "Member",
        primaryLocation: locationId, // This is what the app uses for displaying location
        role: "employee",
        status: "active",
        password: "AV2025" // Add password to profile
      },
      stats: {
        attendanceRate: 0,
        daysAbsent: 0,
        daysLate: 0,
        daysPresent: 0,
        onTimeRate: 0,
        totalHours: 0
      },
      status: "active"
    };
    
    // Add user to database
    await usersRef.child(userId).set(userData);
    
    // Add user to location's activeUsers
    await locationsRef.child(locationId).child("activeUsers").child(userId).set({
      position: userData.profile.position
    });
    
    console.log(`Added user: ${user.name} (${userId})`);
  }
  
  console.log("All users added successfully!");
};
// Elgin Users List - all set to "Member" position
const elginUsers = [
  { name: "Griselda Gomes", position: "Member" },
  { name: "Javier Aviles", position: "Member" },
  { name: "Marlene Avila", position: "Member" },
  { name: "Nancy Morales", position: "Member" },
  { name: "Shontal Marines", position: "Member" },
  { name: "Omar Salazar", position: "Member" },
  { name: "Oscar Batalla", position: "Member" },
  { name: "Ignacia Perez", position: "Member" },
  { name: "Edith Pineda", position: "Member" },
  { name: "Everardo Tinagero", position: "Member" },
  { name: "Sandy Martinez", position: "Member" },
  { name: "Sanjuana Carranza", position: "Member" },
  { name: "Cindy Cruz", position: "Member" },
  { name: "Mayra Rodriguez", position: "Member" },
  { name: "Dulce Rosas", position: "Member" },
  { name: "Patricia Ramirez", position: "Member" },
  { name: "Estela Paque", position: "Member" },
  { name: "Arturo Cruz", position: "Member" },
  { name: "Claudia Mestizo", position: "Member" },
  { name: "Janis Vergara", position: "Member" },
  { name: "Edilia Esquebel", position: "Member" },
  { name: "Maria Montes", position: "Member" },
  { name: "Rene Espinosa", position: "Member" },
  { name: "Katheryne Mesa", position: "Member" },
  { name: "Sergio Avila", position: "Member" },
  { name: "Ramon Cruz", position: "Member" },
  { name: "Jose Vega", position: "Member" },
  { name: "Valente Guido", position: "Member" },
  { name: "Araceli Luis", position: "Member" },
  { name: "Jennifer Montoya", position: "Member" },
  { name: "Agustin Hernandez", position: "Member" },
  { name: "Hilda Oliva", position: "Member" },
  { name: "Juan Rosas", position: "Member" },
  { name: "Jay Juarez", position: "Member" },
  { name: "Ana Lopez", position: "Member" },
  { name: "Jose Baesa", position: "Member" },
  { name: "Juan Guadalupe", position: "Member" },
  { name: "Rosalba Aguilar", position: "Member" },
  { name: "Antonio Vega", position: "Member" },
  { name: "Cristina Burgos", position: "Member" },
  { name: "Citiali Bautista", position: "Member" },
  { name: "Sarai Gomar", position: "Member" },
  { name: "Nelson Calero", position: "Member" },
  { name: "Crisanto Burgos", position: "Member" },
  { name: "Manuela Reyes", position: "Member" },
  { name: "Tony Antunez", position: "Member" },
  { name: "Veronica Orosco", position: "Member" },
  { name: "Alejandro Amador", position: "Member" },
  { name: "Alfredo Veldanez", position: "Member" },
  { name: "Angelina Cruz", position: "Member" },
  { name: "Christian Ramirez", position: "Member" },
  { name: "Hilda Barrios", position: "Member" },
  { name: "Jose Acevedo", position: "Member" },
  { name: "Jorge Lara", position: "Member" },
  { name: "Miguel Reyna", position: "Member" },
  { name: "Pedro Aguirre", position: "Member" }
];

// Main function
const main = async () => {
  try {
    console.log("Starting user addition process...");
    await addUsers(elginUsers);
    console.log("User addition process completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error during execution:", error);
    process.exit(1);
  }
};

// Instructions for setting up the serviceAccountKey.json file:
// 1. Go to your Firebase console -> Project settings -> Service accounts
// 2. Click "Generate new private key"
// 3. Save the downloaded JSON file as "serviceAccountKey.json" in the same directory as this script

// Run the script
main();
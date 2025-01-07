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

const db = admin.database();
// Helper: Generate email

// Helper: Generate email
const generateEmail = (name) => {
    if (!name) return "unknown@example.com";
    const emailName = name.toLowerCase().replace(/[^a-z0-9]/g, ".");
    return `${emailName}@avjoliet.com`;
  };
  
  // Helper: Determine position
  const determinePosition = (service) => {
    if (!service || service.toLowerCase() === "no") return "Member";
    if (service.toLowerCase().includes("coordinador")) return "Coordinator";
    if (service.toLowerCase().includes("tesoreria")) return "Treasurer";
    if (service.toLowerCase().includes("atraccion")) return "Attraction";
    if (service.toLowerCase().includes("lider")) return "Leader";
    if (service.toLowerCase().includes("secretaria")) return "Secretary";
    return "Staff";
  };
  
  // Replace Users Function
  const replaceUsers = async (users) => {
    const usersRef = db.ref("users");
    const locationsRef = db.ref("locations");
    const locationId = "joliet";
  
    // Clear all existing users
    await usersRef.set(null);
  
    // Ensure Joliet location exists
    const locationSnapshot = await locationsRef.child(locationId).get();
    if (!locationSnapshot.exists()) {
      await locationsRef.child(locationId).set({
        name: "Joliet",
        address: "123 Main St, Joliet, IL",
        activeUsers: []
      });
    }
  
    const activeUsers = [];
  
    // Process each user
    for (const user of users) {
      if (!user.name || user.name.trim() === "") {
        console.warn("Skipping user due to missing name:", user);
        continue;
      }
  
      const id = uuidv4(); // Generate unique ID
      const fullName = `${user.name} ${user.lastName || ""} ${user.secondLastName || ""}`.trim();
  
      const userData = {
        name: fullName,
        email: generateEmail(fullName),
        phone: user.phone || "No Phone Provided",
        position: determinePosition(user.service),
        status: user.service && user.service.toLowerCase() !== "no" ? "active" : "inactive",
        locationHistory: [
          {
            locationId: locationId,
            date: new Date().toISOString(),
            changedBy: "system"
          }
        ],
        stats: {
          daysPresent: 0,
          daysLate: 0,
          daysAbsent: 0,
          rank: 0
        }
      };
  
      // Add user to Firebase
      await usersRef.child(id).set(userData);
  
      // If the user is active, add them to the active users list
      if (userData.status === "active") {
        activeUsers.push(id);
      }
  
      console.log(`Processed user: ${fullName} (${userData.status})`);
    }
  
    // Update active users in Joliet location
    await locationsRef.child(locationId).child("activeUsers").set(activeUsers);
  };
  
  const main = async () => {
    try {
      // Users parsed from the Joliet list
      const users = [
        {
          "name": "Alex Gutierrez",
          "lastName": "Salcedo",
          "service": "No",
          "phone": "(331) 385 3542"
        },
        {
          "name": "Alfonso Nocelotl",
          "lastName": "Velazquez",
          "service": "No",
          "phone": "(331) 454 3729"
        },
        {
          "name": "Alvaro Aponte",
          "lastName": "Peña",
          "service": "No",
          "phone": "(612) 261 5858"
        },
        {
          "name": "Antonia Cardenas",
          "lastName": "",
          "service": "No",
          "phone": "(630) 618 1870"
        },
        {
          "name": "Araceli Flores",
          "lastName": "",
          "service": "Coordinador de Oracion y Meditacion",
          "phone": "(630) 373 5570"
        },
        {
          "name": "Benjamin Elizalde",
          "lastName": "Ruiz",
          "service": "No",
          "phone": "(630) 639 9409"
        },
        {
          "name": "Blanca Rubio",
          "lastName": "",
          "service": "No",
          "phone": "(630) 823 1892"
        },
        {
          "name": "Blanca Ramos",
          "lastName": "Garcia",
          "service": "No",
          "phone": "(630) 945 6204"
        },
        {
          "name": "Cecilia Magallanes",
          "lastName": "",
          "service": "No",
          "phone": "(331) 274 8628"
        },
        {
          "name": "Crisanto Mendez",
          "lastName": "Ayala",
          "service": "Coordinador de Alabanza",
          "phone": "(630) 506 7174"
        },
        {
          "name": "Diana Xique",
          "lastName": "Magaña",
          "service": "No",
          "phone": "(630) 644 8402"
        },
        {
          "name": "Diana Cruz",
          "lastName": "",
          "service": "No",
          "phone": "(630) 303 7954"
        },
        {
          "name": "Edi Ferro",
          "lastName": "",
          "service": "No",
          "phone": "(815) 766 4323"
        },
        {
          "name": "Edith Morales",
          "lastName": "Beltran",
          "service": "No",
          "phone": "(331) 274 6707"
        },
        {
          "name": "Eli Nocelotl",
          "lastName": "",
          "service": "Coordinador JAV",
          "phone": "(331) 758 2607"
        },
        {
          "name": "Elizabeth Perez",
          "lastName": "",
          "service": "No",
          "phone": "(219) 292 1128"
        },
        {
          "name": "Elssy Chavez",
          "lastName": "Orozco",
          "service": "Tesoreria de Grupo",
          "phone": "(630) 456 0323"
        },
        {
          "name": "Erendira Bedolla",
          "lastName": "Sanchez",
          "service": "No",
          "phone": "(630) 731 6730"
        },
        {
          "name": "Erik Hernandez",
          "lastName": "Gonzalez",
          "service": "No",
          "phone": "(630) 742 5374"
        },
        {
          "name": "Francisco Lopez",
          "lastName": "",
          "service": "Alterno Coordinador de Hacienda",
          "phone": "(630) 806 5994"
        },
        {
          "name": "Gerardo Nuñez",
          "lastName": "",
          "service": "No",
          "phone": "(630) 677 5994"
        },
        {
          "name": "Guadalupe Pantoja",
          "lastName": "",
          "service": "No",
          "phone": "(708) 341 1823"
        },
        {
          "name": "Ines Aguilar",
          "lastName": "Flores",
          "service": "No",
          "phone": "(773) 980 0663"
        },
        {
          "name": "Janet Gonzalez",
          "lastName": "A",
          "service": "No",
          "phone": "(630) 888 9208"
        },
      
        {
          "name": "Javier Arreguin",
          "lastName": "",
          "service": "No",
          "phone": "(630) 901 3858"
        },
        {
          "name": "Jeovanni Sarmiento",
          "lastName": "",
          "service": "No",
          "phone": "(773) 615 7634"
        },
        {
          "name": "Jhon Jairo Gutierrez",
          "lastName": "",
          "service": "No",
          "phone": "(630) 788 7291"
        },
        {
          "name": "Jorge Alberto Garcia",
          "lastName": "Guerrero",
          "service": "Atraccion Externa",
          "phone": "(630) 345 2395"
        },
        {
          "name": "Jose Muñoz",
          "lastName": "",
          "service": "No",
          "phone": "(331) 454 1438"
        },
        {
          "name": "Jose E Cruz",
          "lastName": "Gallardo",
          "service": "No",
          "phone": "(630) 401 9540"
        },
        {
          "name": "Josefina Cielo",
          "lastName": "",
          "service": "No",
          "phone": "(630) 450 7387"
        },
        {
          "name": "Joselyn Gallardo",
          "lastName": "Rivera",
          "service": "Atraccion Interna JAV",
          "phone": "(331) 431 7434"
        },
        {
          "name": "Juanis Rios",
          "lastName": "Peña",
          "service": "No",
          "phone": "(630) 450 4968"
        },
        {
          "name": "Juliana Elizondo",
          "lastName": "Almaraz",
          "service": "No",
          "phone": "(630) 236 1227"
        },
        {
          "name": "Julissa Rodriguez",
          "lastName": "Varela",
          "service": "No",
          "phone": "(630) 518 0437"
        },
        {
          "name": "Kike Rios",
          "lastName": "Peña",
          "service": "Atraccion Interna",
          "phone": "(630) 450 6517"
        },
        {
          "name": "Laura Muñoz",
          "lastName": "",
          "service": "No",
          "phone": "(331) 431 9066"
        },
        {
          "name": "Liz A",
          "lastName": "",
          "service": "No",
          "phone": "(331) 262 3294"
        },
        {
          "name": "Lolis Rivera",
          "lastName": "Nuñez",
          "service": "No",
          "phone": "(331) 575 4269"
        },
        {
          "name": "Luly Ch",
          "lastName": "",
          "service": "No",
          "phone": "(630) 809 6107"
        },
        {
          "name": "Maria Camacho",
          "lastName": "",
          "service": "No",
          "phone": "(331) 575 6486"
        },
        {
          "name": "Maria Ruiz",
          "lastName": "Aguilera",
          "service": "No",
          "phone": "(630) 340 6616"
        },
        {
          "name": "Maria de Jesus Hernandez",
          "lastName": "",
          "service": "Preparador de Primeros Inventarios",
          "phone": "(630) 854 3328"
        },
        {
          "name": "Maria del Carmen",
          "lastName": "Quiroz Loza",
          "service": "Relaciones Publicas",
          "phone": "(313) 805 5805"
        },
        {
          "name": "Maria Estela",
          "lastName": "Ornelas",
          "service": "No",
          "phone": "(630) 486 4813"
        },
        {
          "name": "María Guadalupe",
          "lastName": "Alvarez",
          "service": "No",
          "phone": "(708) 965 9261"
        },
        {
          "name": "Maribel",
          "lastName": "Diaz",
          "service": "Coordinador de Hacienda",
          "phone": "(630) 220 3668"
        },
        {
          "name": "Marisela",
          "lastName": "Romero",
          "service": "No",
          "phone": "(331) 425 3405"
        },
        {
          "name": "Mayra",
          "lastName": "Villanueva Hernandez",
          "service": "No",
          "phone": "(331) 262 1583"
        },
        {
          "name": "Miguel",
          "lastName": "Tochimani",
          "service": "No",
          "phone": "(630) 450 3452"
        },
        {
          "name": "Miriam",
          "lastName": "Gaspar",
          "service": "No",
          "phone": "(708) 769 4741"
        },
        {
          "name": "Monica",
          "lastName": "Nocelotl",
          "service": "No",
          "phone": "(331) 300 5758"
        },
        {
          "name": "Nacho",
          "lastName": "Garcia",
          "service": "No",
          "phone": "(331) 425 5141"
        },
        {
          "name": "Nancy",
          "lastName": "Maravillo Garduño",
          "service": "No",
          "phone": "(630) 877 9301"
        },
        {
          "name": "Natalia",
          "lastName": "Calvo Garcia",
          "service": "No",
          "phone": "(630) 457 6970"
        },
        {
          "name": "Nicolás",
          "lastName": "Bello Camposano",
          "service": "Lider",
          "phone": "(630) 625 3011"
        },
        {
          "name": "Noe",
          "lastName": "Leon",
          "service": "No",
          "phone": "(331) 575 1598"
        },
        {
          "name": "Oliver",
          "lastName": "Ferro",
          "service": "No",
          "phone": "(224) 318 6327"
        },
        {
          "name": "Ramon",
          "lastName": "Rodriguez",
          "service": "Representante de Servicios Generales",
          "phone": "(630) 256 9097"
        },
        {
          "name": "Remedios",
          "lastName": "Xochitecatl",
          "service": "Manager de Hacienda",
          "phone": "(630) 877 7031"
        },
        {
          "name": "Rocio",
          "lastName": "Elizalde",
          "service": "No",
          "phone": "(630) 639 0150"
        },
        {
          "name": "Sandro",
          "lastName": "Leal",
          "service": "No",
          "phone": "(630) 429 6160"
        },
        {
          "name": "Santiago",
          "lastName": "Hernandez",
          "service": "Segundo Coordinador 2do Inventario",
          "phone": "(630) 854 0992"
        },
        {
          "name": "Santiago jr",
          "lastName": "Hernandez",
          "service": "No",
          "phone": "(630) 677 6806"
        },
        {
          "name": "Sergio",
          "lastName": "Pulido",
          "service": "No",
          "phone": "(630) 890 1445"
        },
        {
          "name": "Sergio",
          "lastName": "Silvan",
          "service": "No",
          "phone": "(630) 470 2167"
        },
        {
          "name": "Sergio",
          "lastName": "Jimenez Sanchez",
          "service": "No",
          "phone": "(331) 277 6829"
        },
        {
          "name": "Tanya",
          "lastName": "Teran",
          "service": "No",
          "phone": "(630) 398 0638"
        },
        {
          "name": "Vicky",
          "lastName": "Angulo",
          "service": "No",
          "phone": "(630) 974 7832"
        },
        {
          "name": "Yolanda",
          "lastName": "Murillo Bañuelos",
          "service": "No",
          "phone": "(630) 644 2169"
        }
      ]

      console.log("Replacing users...");
      await replaceUsers(users);
  
      console.log("Replacement and addition process completed successfully!");
      process.exit(0);
    } catch (error) {
      console.error("Error during execution:", error);
      process.exit(1);
    }
  };
  
  main();
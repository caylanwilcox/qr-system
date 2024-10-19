// Import the necessary functions from the Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database'; // Correctly using Modular SDK
import { getAnalytics } from "firebase/analytics";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCdXo5RHQiL4WRUszEDVTC6wg1uETOCNs",
  authDomain: "qr-system-1cea7.firebaseapp.com",
  databaseURL: "https://qr-system-1cea7-default-rtdb.firebaseio.com",
  projectId: "qr-system-1cea7",
  storageBucket: "qr-system-1cea7.appspot.com",
  messagingSenderId: "683806203538",
  appId: "1:683806203538:web:09f25b26f4602b6e3f504b",
  measurementId: "G-CCSH9765MK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);  // Firebase Auth instance
const database = getDatabase(app);  // Firebase Realtime Database instance
const analytics = getAnalytics(app);  // Firebase Analytics

// Export the initialized services
export { auth, database };

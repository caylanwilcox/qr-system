// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);
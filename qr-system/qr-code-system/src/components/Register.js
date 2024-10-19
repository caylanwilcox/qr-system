import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from './firebaseConfig';  // Import auth from Firebase configuration

const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User registered:', userCredential.user);
    // Optionally, save user details to the Realtime Database or Firestore
  } catch (error) {
    console.error('Error registering user:', error.message);
  }
};

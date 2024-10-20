import React, { useState, useEffect, createContext } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from './firebaseConfig'; // Your Firebase config

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log('Setting up onAuthStateChanged listener');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged triggered');
      if (firebaseUser) {
        try {
          // Get custom claims (like role) from Firebase
          const tokenResult = await getIdTokenResult(firebaseUser);
          const role = tokenResult.claims.role || 'employee';  // Default to employee if role isn't set
          console.log('User authenticated:', firebaseUser);
          console.log('User role:', role);
          setUser({ ...firebaseUser, role });
        } catch (error) {
          console.error('Error getting token result:', error);
        }
      } else {
        console.log('No user authenticated');
        setUser(null);
      }
    });

    return () => {
      console.log('Cleaning up onAuthStateChanged listener');
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
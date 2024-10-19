import React, { useState, useEffect, createContext } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from './firebaseConfig'; // Your Firebase config

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get custom claims (like role) from Firebase
        const tokenResult = await getIdTokenResult(firebaseUser);
        const role = tokenResult.claims.role || 'employee';  // Default to employee if role isn't set
        setUser({ ...firebaseUser, role });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

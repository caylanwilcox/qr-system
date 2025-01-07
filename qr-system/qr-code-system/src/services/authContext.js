import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult 
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, database } from './firebaseConfig';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const ROLE_HIERARCHY = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EMPLOYEE: 1
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idTokenResult = await getIdTokenResult(userCredential.user);
      
      // Get additional user data from the database
      const userRef = ref(database, `users/${userCredential.user.uid}`);
      const userSnapshot = await get(userRef);
      const userData = userSnapshot.val();

      const userWithRole = {
        ...userCredential.user,
        role: idTokenResult.claims.role || userData?.role || 'EMPLOYEE'
      };

      return userWithRole;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign out function
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // Check if user has required role
  const hasRequiredRole = (userRole, requiredRole) => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Get custom claims and database data
          const [tokenResult, userSnapshot] = await Promise.all([
            getIdTokenResult(firebaseUser),
            get(ref(database, `users/${firebaseUser.uid}`))
          ]);

          const userData = userSnapshot.val();
          const role = tokenResult.claims.role || userData?.role || 'EMPLOYEE';

          setUser({
            ...firebaseUser,
            role,
            ...userData
          });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    signIn,
    signOut: handleSignOut,
    hasRequiredRole
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
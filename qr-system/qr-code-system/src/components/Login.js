import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react'; // Optional - you can remove if not using
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await signIn(email, password);
      console.log('Login successful, user role:', user.role);

      // Check if user exists in database
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
        // Create basic user data if it doesn't exist
        await set(userRef, {
          profile: {
            email: email,
            role: user.role || 'EMPLOYEE', // Default to EMPLOYEE if no role
            status: 'active',
            name: user.email.split('@')[0],
            createdAt: new Date().toISOString(),
          },
          stats: {
            lastLogin: new Date().toISOString()
          }
        });
      } else {
        // Update last login time
        await update(userRef, {
          'stats/lastLogin': new Date().toISOString()
        });
      }

      // Normalize the role to uppercase for consistent comparison
      const userRole = (user.role || '').toUpperCase();

      switch (userRole) {
        case 'SUPER_ADMIN':
        case 'SUPER-ADMIN': // Handle hyphenated version too
          navigate('/super-admin/manage-employees');
          break;
        case 'ADMIN':
          navigate('/location-admin/employees');
          break;
        case 'EMPLOYEE':
          navigate('/dashboard');
          break;
        default:
          console.error('Unknown role:', userRole);
          // Try to get role from database as fallback
          if (snapshot.exists() && snapshot.val().profile?.role) {
            const dbRole = snapshot.val().profile.role.toUpperCase();
            console.log('Using role from database:', dbRole);
            
            if (dbRole === 'SUPER_ADMIN' || dbRole === 'SUPER-ADMIN') {
              navigate('/super-admin/manage-employees');
            } else if (dbRole === 'ADMIN') {
              navigate('/location-admin/employees');
            } else {
              navigate('/dashboard'); // Default to employee dashboard
            }
          } else {
            navigate('/dashboard'); // Default to employee dashboard
            console.warn('No role found, defaulting to employee dashboard');
          }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Provide more specific error messages
      if (error.code === 'auth/user-not-found') {
        setError('No account exists with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError('Failed to sign in. Please check your email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-header">Login</h1>
        
        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>
          
          {error && (
            <div className="login-error">
              {/* If you're using lucide-react: */}
              {/* <AlertCircle size={16} className="error-icon" /> */}
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                {/* If you're using lucide-react: */}
                {/* <Loader2 size={16} className="loading-spinner" /> */}
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      </div>
      <div className="company-name">
        Agua Viva Technology
      </div>
    </div>
  );
};

export default Login;
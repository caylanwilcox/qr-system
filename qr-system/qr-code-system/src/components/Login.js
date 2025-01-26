import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { ref, get, set } from 'firebase/database';
import { database } from '../services/firebaseConfig';
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
          email: email,
          role: user.role,
          status: 'active',
          name: user.email.split('@')[0],
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      }

      // Normalize the role to uppercase for consistent comparison
      const userRole = user.role?.toUpperCase();

      switch (userRole) {
        case 'SUPER_ADMIN':
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
          setError('Invalid user role assigned');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to sign in. Please check your email or password.');
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
          
          {error && <div className="login-error">{error}</div>}
          
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
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
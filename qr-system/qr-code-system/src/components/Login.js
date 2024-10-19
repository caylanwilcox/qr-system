import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig'; // Import your Firebase config file
import './Login.css';
import logo from './download.png'; // Import the logo image

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate(); // This is used for navigation after login

  const handleLogin = async (e) => {
    e.preventDefault(); 
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idTokenResult = await user.getIdTokenResult();
      const role = idTokenResult.claims.role;

      if (role === 'admin') {
        navigate('/admin'); 
      } else {
        navigate('/user-dashboard'); 
      }

    } catch (error) {
      setError('Failed to sign in. Please check your email or password.');
      console.error(error.message); 
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo Image */}
        <img src={logo} alt="Company Logo" className="login-logo" />
        
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
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-button">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;

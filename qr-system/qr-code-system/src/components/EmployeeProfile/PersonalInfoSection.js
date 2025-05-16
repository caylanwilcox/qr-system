'use client';

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ref, update, get } from 'firebase/database';
import { 
  getAuth, 
  updateProfile, 
  updateEmail, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { database } from '../../services/firebaseConfig';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  AlertCircle, 
  Lock, 
  Users, 
  User, 
  CheckCircle,
  Info,
  AlertTriangle
} from 'lucide-react';

const FormField = ({
  label,
  icon,
  name,
  type = 'text',
  value,
  onChange,
  disabled,
  error,
  required,
  children,
}) => (
  <div className="form-group">
    <label htmlFor={name} className="block mb-2">
      <span className="inline-flex items-center gap-2 text-sm text-gray-300/90">
        {icon}
        <span>{label}</span>
        {required && <span className="text-red-400">*</span>}
      </span>
    </label>
    {children || (
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
          px-3 py-2 text-white/90 placeholder-white/50
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
          disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
          backdrop-blur-md transition-all duration-200
          ${error ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''}
        `}
      />
    )}
    {error && (
      <div id={`${name}-error`} className="text-red-400 text-sm mt-1 flex items-center gap-1">
        <AlertCircle size={14} />
        <span>{error}</span>
      </div>
    )}
  </div>
);

const PersonalInfoSection = ({
  formData,
  editMode,
  handleInputChange,
  errors = {},
  onSave,
  onCancel,
  userId,
  onSendPasswordReset,
  userData,
  isCurrentUser = false,
  fetchUserData,
  locations = []
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [credentialsChanged, setCredentialsChanged] = useState(false);
  const auth = getAuth();
  
  // Store original values to track changes
  const [originalValues, setOriginalValues] = useState({
    email: formData?.email || '',
    name: formData?.name || ''
  });
  
  useEffect(() => {
    // Update original values when formData changes
    if (formData) {
      setOriginalValues({
        email: formData.email || '',
        name: formData.name || ''
      });
    }
  }, [formData]);

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    if (field === 'current') {
      setShowCurrentPassword(prevState => !prevState);
    } else {
      setShowPassword(prevState => !prevState);
    }
  };

  // Custom handler for password field
  const handlePasswordChange = (e) => {
    if (handleInputChange) {
      handleInputChange(e);
    }
  };

  // Handler for current password field
  const handleCurrentPasswordChange = (e) => {
    setCurrentPassword(e.target.value);
  };

  // Check if email or password has changed (requiring authentication)
  const needsAuthentication = () => {
    return isCurrentUser && (
      (formData.email && formData.email !== originalValues.email) ||
      (formData.password && formData.password.trim() !== '')
    );
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      // If your auth context has a logout function
      if (window.logout) {
        await window.logout();
      } else {
        await auth.signOut();
      }
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error("Error logging out:", error);
      // Force page refresh as a fallback
      window.location.href = '/login';
    }
  };

  // Update Firebase Auth for current user
  const updateAuthUser = async () => {
    if (!auth.currentUser) {
      throw new Error('Not authenticated');
    }
    
    // Authenticate user if required
    if (needsAuthentication()) {
      if (!currentPassword) {
        throw new Error('Current password is required to update email or password');
      }
      
      try {
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
      } catch (error) {
        if (error.code === 'auth/wrong-password') {
          throw new Error('Current password is incorrect');
        } else {
          throw error;
        }
      }
    }
    
    // Update the user profile
    const updates = [];
    let credChanged = false;
    
    // Update display name if changed
    if (formData.name && formData.name !== auth.currentUser.displayName) {
      updates.push(updateProfile(auth.currentUser, {
        displayName: formData.name
      }));
    }
    
    // Update email if changed
    if (formData.email && formData.email !== auth.currentUser.email) {
      updates.push(updateEmail(auth.currentUser, formData.email));
      credChanged = true;
    }
    
    // Update password if provided
    if (formData.password && formData.password.trim() !== '') {
      updates.push(updatePassword(auth.currentUser, formData.password));
      credChanged = true;
    }
    
    // Execute all updates
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    return { success: true, credentialsChanged: credChanged };
  };

  // Update Firebase Auth admin API for other users
  const updateUserAuthViaAdmin = async () => {
    try {
      // Create update object
      const updates = {};
      
      if (formData.name) updates.displayName = formData.name;
      if (formData.email) updates.email = formData.email;
      if (formData.password && formData.password.trim() !== '') {
        updates.password = formData.password;
      }
      
      // Only proceed if we have updates
      if (Object.keys(updates).length === 0) return { success: true };
      
      // Get the current user's ID token
      const idToken = await auth.currentUser.getIdToken();
      
      // Call the admin API
      const response = await fetch('/api/admin/update-user-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId,
          updates
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update user authentication');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Admin update failed:', error);
      throw error;
    }
  };

  // Update the database with correct auth info
  const updateDatabaseWithAuthInfo = async () => {
    try {
      // Create updates object for Firebase
      const dbUpdates = {};
      
      // Update name in both places
      if (formData.name) {
        dbUpdates[`users/${userId}/profile/name`] = formData.name;
        dbUpdates[`users/${userId}/name`] = formData.name; // Update root level too
      }
      
      // Update email
      if (formData.email) {
        dbUpdates[`users/${userId}/profile/email`] = formData.email;
      }
      
      // Update phone
      if (formData.phone !== undefined) {
        dbUpdates[`users/${userId}/profile/phone`] = formData.phone || '';
      }
      
      // Update service
      if (formData.service) {
        dbUpdates[`users/${userId}/profile/service`] = formData.service;
      }
      
      // Update password in database if provided
      if (formData.password && formData.password.trim() !== '') {
        dbUpdates[`users/${userId}/profile/password`] = formData.password;
      }
      
      // Also update authUid link for current user
      if (isCurrentUser && auth.currentUser) {
        dbUpdates[`users/${userId}/profile/authUid`] = auth.currentUser.uid;
      }
      
      // Perform the database update
      await update(ref(database), dbUpdates);
      return true;
    } catch (error) {
      console.error("Error updating database:", error);
      throw error;
    }
  };

  // Handle save button click
  const handleSaveClick = async () => {
    try {
      setIsSaving(true);
      setUpdateStatus(null);
      setCredentialsChanged(false);
      
      // Step 1: Update Firebase Auth if necessary
      if (isCurrentUser) {
        try {
          // Update authentication for current user
          const authResult = await updateAuthUser();
          if (authResult.credentialsChanged) {
            setCredentialsChanged(true);
          }
        } catch (error) {
          console.error("Auth update error:", error);
          setUpdateStatus({ 
            type: 'error', 
            message: `Authentication error: ${error.message}` 
          });
          setIsSaving(false);
          return;
        }
      } else if (auth.currentUser && formData.password) {
        // Admin updating another user's auth
        try {
          await updateUserAuthViaAdmin();
        } catch (error) {
          console.error("Admin auth update error:", error);
          setUpdateStatus({ 
            type: 'error', 
            message: `Admin authentication error: ${error.message}` 
          });
          // Continue with database update even if Auth update fails
        }
      }
      
      // Step 2: Update the database
      await updateDatabaseWithAuthInfo();
      
      // Step 3: Call parent onSave if provided
      if (onSave) {
        await onSave();
      }
      
      // Step 4: Update state and show feedback
      if (credentialsChanged) {
        setUpdateStatus({ 
          type: 'success', 
          message: 'Profile updated successfully! You need to log in again with your new credentials.' 
        });
        setShowLogoutPrompt(true);
      } else {
        setUpdateStatus({ 
          type: 'success', 
          message: 'Profile updated successfully!' 
        });
        
        // If a fetchUserData function was provided, refresh the user data
        if (fetchUserData) {
          await fetchUserData();
        }
      }
      
      // Clear sensitive data
      setCurrentPassword('');
      
    } catch (error) {
      console.error("Error saving profile:", error);
      setUpdateStatus({ 
        type: 'error', 
        message: `Error updating profile: ${error.message}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render logout prompt modal
  const renderLogoutPrompt = () => {
    if (!showLogoutPrompt) return null;
    
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg border border-slate-600 shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Info className="w-6 h-6 text-blue-400 mr-2" />
              Login Credentials Updated
            </h3>
            <p className="text-white/80 mb-6">
              Your login information has been updated successfully. You need to log in again with your new credentials.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500"
              >
                Log Out Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render current password field when needed
  const renderCurrentPasswordField = () => {
    if (!editMode || !isCurrentUser || !needsAuthentication()) return null;
    
    return (
      <div className="form-group md:col-span-2 mt-2">
        <label htmlFor="currentPassword" className="block mb-2">
          <span className="inline-flex items-center gap-2 text-sm text-gray-300/90">
            <Lock size={16} className="text-white/70" />
            <span>Current Password</span>
            <span className="text-red-400">*</span>
          </span>
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={handleCurrentPasswordChange}
            placeholder="Enter your current password"
            className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
              px-3 py-2 text-white/90 placeholder-white/50
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
              backdrop-blur-md transition-all duration-200 pr-12
            `}
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('current')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
          >
            {showCurrentPassword ? "HIDE" : "SHOW"}
          </button>
        </div>
        <p className="text-amber-400 text-xs mt-1">
          Required to confirm changes to password or email
        </p>
      </div>
    );
  };

  return (
    <div className="bg-[rgba(13,25,48,0.4)] backdrop-blur-xl rounded-lg border border-white/10 shadow-xl">
      {/* Render logout prompt modal if credentials changed */}
      {renderLogoutPrompt()}
      
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white/90">Personal Information</h2>
        {userId && <p className="text-xs text-white/50 mt-1">User ID: {userId}</p>}
      </div>

      {updateStatus && (
        <div className={`mx-6 mt-4 p-3 rounded ${
          updateStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          <div className="flex items-start">
            {updateStatus.type === 'success' ? (
              <CheckCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            )}
            <span>{updateStatus.message}</span>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Display Name / Username */}
          <FormField
            label="Display Name"
            icon={<User size={16} className="text-white/70" />}
            name="name"
            type="text"
            value={formData.name || ''}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.name}
            required
          />

          {/* Email */}
          <FormField
            label="Email"
            icon={<Mail size={16} className="text-white/70" />}
            name="email"
            type="email"
            value={formData.email || ''}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.email}
            required
          />

          {/* Phone */}
          <FormField
            label="Phone"
            icon={<Phone size={16} className="text-white/70" />}
            name="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.phone}
            required
          />

          {/* Location */}
          <FormField
            label="Location"
            icon={<MapPin size={16} className="text-white/70" />}
            name="location"
            disabled={!editMode}
            error={errors.location}
          >
            {editMode && locations.length > 0 ? (
              <select
                id="location"
                name="location"
                value={formData.location || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                  px-3 py-2 text-white/90
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                  disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
                  backdrop-blur-md transition-all duration-200
                  ${errors.location ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''}
                `}
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="location"
                name="location"
                value={formData.location || ''}
                onChange={handleInputChange}
                disabled={true}
                className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                  px-3 py-2 text-white/90 placeholder-white/50
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                  disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
                  backdrop-blur-md transition-all duration-200
                `}
              />
            )}
          </FormField>

          {/* Join Date */}
          <FormField
            label="Join Date"
            icon={<Calendar size={16} className="text-white/70" />}
            name="joinDate"
            type="date"
            value={formData.joinDate || ''}
            disabled={true}
          />

          {/* Service Type */}
          <FormField
            label="Service Type"
            icon={<Users size={16} className="text-white/70" />}
            name="service"
            disabled={!editMode}
            error={errors.service}
          >
            <select
              id="service"
              name="service"
              value={formData.service || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                px-3 py-2 text-white/90
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
                backdrop-blur-md transition-all duration-200
                ${errors.service ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''}
              `}
            >
              <option value="">Select Service Type</option>
              <option value="RSG">Orejas</option>
              <option value="COM">Apoyos</option>
              <option value="LIDER">Lider</option>
              <option value="TESORERO DE GRUPO">Tesorero de Grupo</option>
              <option value="PPI">PPI</option>
              <option value="MANAGER DE HACIENDA">Manager de Hacienda</option>
              <option value="COORDINADOR DE HACIENDA">Coordinador de Hacienda</option>
              <option value="ATRACCION INTERNA">Atraccion Interna</option>
              <option value="ATRACCION EXTERNA">Atraccion Externa</option>
              <option value="SECRETARY">Secretary</option>
              <option value="LITERATURA">Literatura</option>
              <option value="SERVIDOR DE CORO">Servidor de Coro</option>
              <option value="SERVIDOR DE JAV EN MESA">Servidor de JAV en Mesa</option>
              <option value="SERVIDOR DE SEGUIMIENTOS">Servidor de Seguimientos</option>
            </select>
          </FormField>
          
          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password" className="block mb-2">
              <span className="inline-flex items-center gap-2 text-sm text-gray-300/90">
                <Lock size={16} className="text-white/70" />
                <span>Password</span>
              </span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password || ''}
                onChange={handlePasswordChange}
                disabled={!editMode}
                placeholder="Enter new password"
                className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                  px-3 py-2 text-white/90 placeholder-white/50
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                  disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
                  backdrop-blur-md transition-all duration-200 pr-12
                  ${errors.password ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''}
                `}
              />
              {editMode && (
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              )}
            </div>
            {errors.password && (
              <div id="password-error" className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                <span>{errors.password}</span>
              </div>
            )}
            
            {/* Add password reset option for admins editing other users */}
            {editMode && !isCurrentUser && onSendPasswordReset && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onSendPasswordReset}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <Mail size={14} />
                  <span className="underline">Send password reset email instead</span>
                </button>
              </div>
            )}
            
            {/* Help text for password field */}
            {editMode && (
              <div className="text-blue-400 text-sm mt-2 flex items-start">
                <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  {isCurrentUser 
                    ? 'Changing your password will require you to log in again.'
                    : 'As an admin, you can update this user\'s password.'}
                </span>
              </div>
            )}
          </div>

          {/* Add Current Password Field when needed */}
          {renderCurrentPasswordField()}

          {/* Help text for email changes */}
          {editMode && isCurrentUser && formData.email !== originalValues.email && (
            <div className="form-group md:col-span-2">
              <div className="text-blue-400 text-sm mb-2 flex items-start">
                <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  Changing your email will require you to log in again with the new email address.
                  You must provide your current password below.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {editMode && (
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border border-white/20 text-white/70 hover:bg-white/10"
              disabled={isSaving}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSaveClick}
            className={`px-4 py-2 rounded-md ${
              isSaving 
                ? 'bg-blue-600/50 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500'
            } text-white font-semibold flex items-center justify-center`}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-2 border-white/20 border-t-white rounded-full mr-2"></span>
                Saving...
              </>
            ) : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};

PersonalInfoSection.propTypes = {
  formData: PropTypes.object.isRequired,
  editMode: PropTypes.bool.isRequired,
  handleInputChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  userId: PropTypes.string,
  onSendPasswordReset: PropTypes.func,
  userData: PropTypes.object,
  isCurrentUser: PropTypes.bool,
  fetchUserData: PropTypes.func,
  locations: PropTypes.array
};

export default PersonalInfoSection;
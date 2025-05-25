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
  AlertTriangle,
  KeyRound,
  Award,
  X
} from 'lucide-react';
import { calculatePadrinoColor, PADRINO_COLORS } from '../utils/padrinoColorCalculator';

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

const PadrinoStatusSection = ({ userData, formData, onPadrinoChange, onPadrinoColorChange, editMode }) => {
  const [padrinoStatus, setPadrinoStatus] = useState({
    eligible: false,
    color: PADRINO_COLORS.BLUE,
    requirements: {
      haciendas: { required: 95, actual: 0, met: false },
      workshops: { required: 60, actual: 0, met: false },
      meetings: { required: 100, actual: 0, met: false }
    },
    allRequirementsMet: false
  });
  
  const [autoCalculate, setAutoCalculate] = useState(false);

  // Calculate padrino status when userData changes
  useEffect(() => {
    if (userData && userData.events) {
      const status = calculatePadrinoColor(userData);
      setPadrinoStatus(status);
      
      // If in auto mode, update the color based on calculations
      if (autoCalculate && formData.padrino) {
        onPadrinoColorChange({ target: { value: status.color } });
      }
    }
  }, [userData, autoCalculate, onPadrinoColorChange, formData.padrino]);

  // Get color display name
  const getColorDisplayName = (color) => {
    return color ? color.charAt(0).toUpperCase() + color.slice(1) : 'Blue';
  };

  // Get CSS classes for color display
  const getColorClasses = (color) => {
    switch (color) {
      case PADRINO_COLORS.RED:
        return 'bg-red-500/20 text-red-500 border-red-500/30';
      case PADRINO_COLORS.ORANGE:
        return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case PADRINO_COLORS.GREEN:
        return 'bg-green-500/20 text-green-500 border-green-500/30';
      case PADRINO_COLORS.BLUE:
      default:
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    }
  };

  // Get requirement status display
  const getRequirementStatus = (requirement) => {
    if (!requirement.actual) return 'Not enough data';
    if (requirement.met) return `${requirement.actual}% ✓`;
    return `${requirement.actual}% (${requirement.required}% required) ✗`;
  };

  // Toggle auto-calculate mode
  const handleAutoCalculateToggle = () => {
    const newValue = !autoCalculate;
    setAutoCalculate(newValue);
    
    // If turning on auto-calculate, immediately update color
    if (newValue && formData.padrino) {
      onPadrinoColorChange({ target: { value: padrinoStatus.color } });
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white/90 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-400" />
          Padrino Status
        </h3>
        
        <div className="flex items-center">
          <label className="relative inline-flex items-center cursor-pointer mr-3">
            <input
              type="checkbox"
              checked={formData.padrino}
              onChange={onPadrinoChange}
              className="sr-only peer"
              disabled={!editMode}
            />
            <div className={`w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer 
              ${formData.padrino ? 'peer-checked:after:translate-x-full peer-checked:bg-blue-600' : ''}
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:border-gray-300 after:border after:rounded-full 
              after:h-5 after:w-5 after:transition-all`}>
            </div>
            <span className="ml-2 text-sm font-medium text-white/70">
              {formData.padrino ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      <div className="p-4">
        {formData.padrino ? (
          <>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white/70">Color Selection</h4>
                <label className="flex items-center text-sm text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCalculate}
                    onChange={handleAutoCalculateToggle}
                    className="mr-2 h-4 w-4"
                    disabled={!editMode}
                  />
                  Auto-calculate
                </label>
              </div>
              
              {editMode ? (
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(PADRINO_COLORS).map((color) => (
                    <div 
                      key={color}
                      onClick={() => !autoCalculate && onPadrinoColorChange({ target: { value: color } })}
                      className={`border rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer
                        ${color === formData.padrinoColor ? 'ring-2 ring-white/30' : ''}
                        ${getColorClasses(color)}
                        ${autoCalculate ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-white/30'}`}
                    >
                      <Award className="w-6 h-6 mb-1" />
                      <span className="text-sm">{getColorDisplayName(color)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`border rounded-lg p-3 flex items-center ${getColorClasses(formData.padrinoColor)}`}>
                  <Award className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">{getColorDisplayName(formData.padrinoColor || PADRINO_COLORS.BLUE)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-white/70 mb-3">Attendance Requirements</h4>
              <div className="space-y-3">
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.haciendas.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Haciendas (min 95%)</span>
                    <span className={padrinoStatus.requirements.haciendas.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.haciendas)}
                    </span>
                  </div>
                </div>
                
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.workshops.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Workshops (min 60%)</span>
                    <span className={padrinoStatus.requirements.workshops.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.workshops)}
                    </span>
                  </div>
                </div>
                
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.meetings.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Group Meetings (100%)</span>
                    <span className={padrinoStatus.requirements.meetings.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.meetings)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={`mt-4 p-3 rounded-lg border ${padrinoStatus.eligible ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <div className="flex items-center">
                  {padrinoStatus.eligible ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
                  )}
                  <span className={padrinoStatus.eligible ? 'text-green-400' : 'text-yellow-400'}>
                    {padrinoStatus.eligible 
                      ? 'All requirements met! Eligible for Padrino status.' 
                      : 'Some requirements not met. See above for details.'}
                  </span>
                </div>
                
                {padrinoStatus.eligible && autoCalculate && (
                  <div className="mt-2 text-sm text-white/60">
                    Recommended color: <span className={`font-semibold ${getColorClasses(padrinoStatus.color).split(' ')[1]}`}>{getColorDisplayName(padrinoStatus.color)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-white/60">
            <X className="w-8 h-8 mb-2" />
            <p>Padrino status is currently disabled.</p>
            <p className="text-sm mt-1">Enable it to manage colors and view requirements.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const PersonalInfoSection = ({
  formData,
  editMode,
  handleInputChange,
  errors = {},
  onSave,
  onCancel,
  userId,
  userData,
  isCurrentUser = false,
  fetchUserData,
  locations = [],
  departments = [],
  onPadrinoChange,
  onPadrinoColorChange
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [expandedSection, setExpandedSection] = useState('personal');
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
    // Remove authentication requirement - no longer need current password
    return false;
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
    
    // No longer require authentication - removed current password requirement
    
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
      
      // Update location if provided
      if (formData.location) {
        dbUpdates[`users/${userId}/profile/location`] = formData.location;
        dbUpdates[`users/${userId}/location`] = formData.location;
      }
      
      // Update department if provided
      if (formData.department) {
        dbUpdates[`users/${userId}/profile/department`] = formData.department;
      }
      
      // Update position if provided
      if (formData.position) {
        dbUpdates[`users/${userId}/profile/position`] = formData.position;
      }
      
      // Update joinDate if provided
      if (formData.joinDate) {
        dbUpdates[`users/${userId}/profile/joinDate`] = formData.joinDate;
      }
      
      // Update emergency contact fields if provided
      if (formData.emergencyContact) {
        dbUpdates[`users/${userId}/profile/emergencyContact`] = formData.emergencyContact;
      }
      
      if (formData.emergencyPhone) {
        dbUpdates[`users/${userId}/profile/emergencyPhone`] = formData.emergencyPhone;
      }
      
      // Update padrino fields if needed
      if (formData.padrino !== undefined) {
        dbUpdates[`users/${userId}/profile/padrino`] = formData.padrino;
      }
      
      if (formData.padrinoColor) {
        dbUpdates[`users/${userId}/profile/padrinoColor`] = formData.padrinoColor;
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
      } else if (auth.currentUser && (formData.password || formData.email !== originalValues.email)) {
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
    // No longer require current password verification
    return null;
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

      {/* Login Credentials Section - Always visible */}
      <div className="p-6 pt-4">
        <div className="bg-[rgba(13,25,48,0.6)] p-4 rounded-lg border border-blue-500/20 mb-6">
          <h3 className="text-blue-400 text-md font-semibold mb-3 flex items-center">
            <KeyRound size={18} className="mr-2" />
            Login Credentials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <FormField
              label="Email Address"
              icon={<Mail size={16} className="text-white/70" />}
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.email}
              required
            />
            
            {/* Password */}
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
            </div>
          </div>
          
          {/* Help text for login credentials */}
          {editMode && (
            <div className="mt-3 text-amber-400 text-sm flex items-start">
              <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>
                {isCurrentUser 
                  ? 'Changing your login credentials will require you to log in again with your new information.'
                  : 'As an admin, you can update this user\'s login credentials. They will need to use these new details next time they log in.'}
              </span>
            </div>
          )}
          
          {/* Current password field for verification when changing own credentials */}
          {renderCurrentPasswordField()}
        </div>
      </div>
        
      {/* Navigation tabs */}
      <div className="flex space-x-2 mx-6 overflow-x-auto pb-2 border-b border-white/10">
        <button
          onClick={() => setExpandedSection('personal')}
          className={`px-4 py-2 text-sm rounded-lg ${
            expandedSection === 'personal'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-white/70 hover:bg-white/5'
          }`}
        >
          Basic Info
        </button>
        <button
          onClick={() => setExpandedSection('contact')}
          className={`px-4 py-2 text-sm rounded-lg ${
            expandedSection === 'contact'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-white/70 hover:bg-white/5'
          }`}
        >
          Contact
        </button>
        <button
          onClick={() => setExpandedSection('padrino')}
          className={`px-4 py-2 text-sm rounded-lg ${
            expandedSection === 'padrino'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-white/70 hover:bg-white/5'
          }`}
        >
          Padrino
        </button>
      </div>

      <div className="p-6">
        {expandedSection === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Full Name"
              icon={<User size={16} className="text-white/70" />}
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.name}
              required
            />

            <FormField
              label="Position"
              icon={<Award size={16} className="text-white/70" />}
              name="position"
              value={formData.position || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.position}
            />

            <FormField
              label="Department"
              icon={<Users size={16} className="text-white/70" />}
              name="department"
              disabled={!editMode}
              error={errors.department}
            >
              <select
                id="department"
                name="department"
                value={formData.department || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                  px-3 py-2 text-white/90
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                  disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30 disabled:cursor-not-allowed
                  backdrop-blur-md transition-all duration-200
                  ${errors.department ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50' : ''}
                `}
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Location"
              icon={<MapPin size={16} className="text-white/70" />}
              name="location"
              disabled={!editMode}
              error={errors.location}
            >
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
            </FormField>

            <FormField
              label="Join Date"
              icon={<Calendar size={16} className="text-white/70" />}
              name="joinDate"
              type="date"
              value={formData.joinDate || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.joinDate}
            />

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
          </div>
        )}

        {expandedSection === 'contact' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Phone"
              icon={<Phone size={16} className="text-white/70" />}
              name="phone"
              type="tel"
              value={formData.phone || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.phone}
            />

            <FormField
              label="Emergency Contact"
              icon={<User size={16} className="text-white/70" />}
              name="emergencyContact"
              value={formData.emergencyContact || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.emergencyContact}
            />

            <FormField
              label="Emergency Phone"
              icon={<Phone size={16} className="text-white/70" />}
              name="emergencyPhone"
              type="tel"
              value={formData.emergencyPhone || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.emergencyPhone}
            />
          </div>
        )}

        {expandedSection === 'padrino' && (
          <PadrinoStatusSection 
            userData={userData}
            formData={formData}
            onPadrinoChange={onPadrinoChange}
            onPadrinoColorChange={onPadrinoColorChange}
            editMode={editMode}
          />
        )}
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

PadrinoStatusSection.propTypes = {
  userData: PropTypes.object,
  formData: PropTypes.object.isRequired,
  onPadrinoChange: PropTypes.func.isRequired,
  onPadrinoColorChange: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired
};

PersonalInfoSection.propTypes = {
  formData: PropTypes.object.isRequired,
  editMode: PropTypes.bool.isRequired,
  handleInputChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  userId: PropTypes.string,
  userData: PropTypes.object,
  isCurrentUser: PropTypes.bool,
  fetchUserData: PropTypes.func,
  locations: PropTypes.array,
  departments: PropTypes.array,
  onPadrinoChange: PropTypes.func,
  onPadrinoColorChange: PropTypes.func
};

export default PersonalInfoSection;
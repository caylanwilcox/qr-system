'use client';

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ref, update } from 'firebase/database';
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
  X,
  RefreshCw,
  Shield,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import { calculatePadrinoColor, PADRINO_COLORS } from '../utils/padrinoColorCalculator';

const FormField = ({ label, icon, name, type = 'text', value, onChange, disabled, error, required, children }) => (
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

  useEffect(() => {
    if (userData && userData.events) {
      const status = calculatePadrinoColor(userData);
      setPadrinoStatus(status);
      
      if (autoCalculate && formData.padrino) {
        onPadrinoColorChange({ target: { value: status.color } });
      }
    }
  }, [userData, autoCalculate, onPadrinoColorChange, formData.padrino]);

  const getColorDisplayName = (color) => {
    return color ? color.charAt(0).toUpperCase() + color.slice(1) : 'Blue';
  };

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

  const getRequirementStatus = (requirement) => {
    if (!requirement.actual) return 'Not enough data';
    if (requirement.met) return `${requirement.actual}% ✓`;
    return `${requirement.actual}% (${requirement.required}% required) ✗`;
  };

  const handleAutoCalculateToggle = () => {
    const newValue = !autoCalculate;
    setAutoCalculate(newValue);
    
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
  onPadrinoColorChange, 
  isAdminUser = false 
}) => {
  const auth = getAuth();
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [expandedSection, setExpandedSection] = useState('personal');
  const [isSaving, setIsSaving] = useState(false);
  
  // Authentication state
  const [currentPassword, setCurrentPassword] = useState('');
  const [showLogoutPrompt, setShowLogoutPrompt] = useState(false);
  const [credentialsChanged, setCredentialsChanged] = useState(false);
  
  // Reset functionality state
  const [isResetting, setIsResetting] = useState(false);
  
  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    email: '',
    name: ''
  });

  // Update original values when formData changes
  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
      console.log('🔄 [PERSONAL_INFO] Updating original values:', {
        email: formData.email,
        name: formData.name
      });
      
      setOriginalValues({
        email: formData.email || '',
        name: formData.name || ''
      });
    }
  }, [formData?.email, formData?.name]);

  // Debug logging
  useEffect(() => {
    console.log('🎭 [PERSONAL_INFO] Component state:', {
      isCurrentUser,
      isAdminUser,
      userId,
      editMode,
      hasFormData: !!formData,
      authUser: auth.currentUser?.uid
    });
  }, [isCurrentUser, isAdminUser, userId, editMode, formData, auth.currentUser]);

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    if (field === 'current') {
      setShowCurrentPassword(prev => !prev);
    } else {
      setShowPassword(prev => !prev);
    }
  };

  // Handle password changes with logging
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    console.log('🔑 [PERSONAL_INFO] Password field changed:', {
      length: newPassword.length,
      hasValue: !!newPassword
    });
    
    if (handleInputChange) {
      handleInputChange(e);
    }
  };

  // Handle current password changes
  const handleCurrentPasswordChange = (e) => {
    setCurrentPassword(e.target.value);
  };

  // Check if authentication is needed for current user changes
  const needsAuthentication = () => {
    return isCurrentUser && (
      (formData.email && formData.email.trim() !== (originalValues.email || '').trim()) ||
      (formData.password && formData.password.trim() !== '')
    );
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error("Error logging out:", error);
      window.location.href = '/login';
    }
  };

  // Update current user's Firebase Auth record
  const updateCurrentUserAuth = async () => {
    console.log('\n🔐 [AUTH] === CURRENT USER AUTH UPDATE START ===');
    
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user. Please sign in again.');
    }

    const emailChanged = formData.email && formData.email.trim() !== (originalValues.email || '').trim();
    const nameChanged = formData.name && formData.name.trim() !== (originalValues.name || '').trim();
    const passwordProvided = formData.password && formData.password.trim() !== '';

    console.log('🔐 [AUTH] Changes detected:', {
      emailChanged,
      nameChanged,
      passwordProvided
    });

    if (!emailChanged && !nameChanged && !passwordProvided) {
      return { success: true, credentialsChanged: false };
    }

    // Re-authenticate if changing email or password
    if (emailChanged || passwordProvided) {
      if (!currentPassword) {
        throw new Error('Current password is required to change your email or password.');
      }
      
      try {
        console.log('🔐 [AUTH] Re-authenticating user...');
        const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
        await reauthenticateWithCredential(user, credential);
        console.log('✅ [AUTH] Re-authentication successful');
      } catch (error) {
        console.error('❌ [AUTH] Re-authentication failed:', error);
        throw new Error('Re-authentication failed. Please check your current password.');
      }
    }

    let credentialsWillChange = false;

    try {
      if (nameChanged) {
        console.log('📝 [AUTH] Updating displayName...');
        await updateProfile(user, { displayName: formData.name.trim() });
      }

      if (emailChanged) {
        console.log('✉️ [AUTH] Updating email...');
        await updateEmail(user, formData.email.trim());
        credentialsWillChange = true;
      }

      if (passwordProvided) {
        console.log('🔑 [AUTH] Updating password...');
        await updatePassword(user, formData.password.trim());
        credentialsWillChange = true;
      }

      console.log('✅ [AUTH] Current user auth updated successfully');
      return { success: true, credentialsChanged: credentialsWillChange };
    } catch (error) {
      console.error('❌ [AUTH] Failed to update current user auth:', error);
      throw error;
    }
  };

  // Update another user's auth via admin API
  const updateUserAuthViaAdmin = async () => {
    console.log('\n🔧 [ADMIN] === ADMIN AUTH UPDATE START ===');
    
    if (isCurrentUser) {
      return { success: true, skipped: 'is_current_user' };
    }
    
    if (!isAdminUser) {
      return { success: false, error: 'Current user is not an admin' };
    }

    // Build updates payload
    const authUpdates = {};
    
    if (formData.name && formData.name.trim() !== (originalValues.name || '').trim()) {
      authUpdates.displayName = formData.name.trim();
    }
    
    if (formData.email && formData.email.trim() !== (originalValues.email || '').trim()) {
      authUpdates.email = formData.email.trim();
    }
    
    if (formData.password && formData.password.trim() !== '') {
      authUpdates.password = formData.password.trim();
    }

    console.log('🔧 [ADMIN] Auth updates to send:', {
      ...authUpdates,
      password: authUpdates.password ? '[REDACTED]' : undefined
    });

    if (Object.keys(authUpdates).length === 0) {
      return { success: true, skipped: 'no_auth_changes' };
    }

    try {
      const idToken = await auth.currentUser.getIdToken();
      
      const response = await fetch('/api/admin/update-user-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId, updates: authUpdates })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user auth via admin API');
      }

      const result = await response.json();
      console.log('✅ [ADMIN] Admin auth update successful:', result);
      return { success: true, result };
    } catch (error) {
      console.error('❌ [ADMIN] Admin auth update failed:', error);
      return { success: false, error: error.message };
    }
  };

  // Update database with all form data
  const updateDatabaseWithAuthInfo = async () => {
    try {
      console.log('🗄️ [DATABASE] Updating database...');
      
      const dbUpdates = {};
      
      // Update all form fields in the database
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'password') {
          dbUpdates[`users/${userId}/profile/${key}`] = value;
          
          // Also update certain fields at root level for backward compatibility
          if (['name', 'email', 'location'].includes(key)) {
            dbUpdates[`users/${userId}/${key}`] = value;
          }
        }
      });
      
      // Maintain auth link
      if (isCurrentUser && auth.currentUser) {
        dbUpdates[`users/${userId}/profile/authUid`] = auth.currentUser.uid;
      }
      
      // Add timestamp
      dbUpdates[`users/${userId}/profile/updatedAt`] = new Date().toISOString();
      
      await update(ref(database), dbUpdates);
      console.log('✅ [DATABASE] Database updated successfully');
      return true;
    } catch (error) {
      console.error('❌ [DATABASE] Error updating database:', error);
      throw error;
    }
  };

  // Main save handler
  const handleSaveClick = async () => {
    console.log('\n🚀 === SAVE PROCESS START ===');
    setIsSaving(true);
    setUpdateStatus(null);
    setCredentialsChanged(false);

    try {
      // Detect changes
      const emailChanged = formData.email && formData.email.trim() !== (originalValues.email || '').trim();
      const nameChanged = formData.name && formData.name.trim() !== (originalValues.name || '').trim();
      const passwordProvided = formData.password && formData.password.trim() !== '';
      const shouldUpdateAuth = emailChanged || nameChanged || passwordProvided;

      console.log('💾 [SAVE] Changes detected:', {
        emailChanged,
        nameChanged,
        passwordProvided,
        shouldUpdateAuth
      });

      let authUpdateResult = { success: true };

      // Update Firebase Auth if needed
      if (shouldUpdateAuth) {
        if (isCurrentUser) {
          console.log('👤 [SAVE] Updating current user auth...');
          authUpdateResult = await updateCurrentUserAuth();
          
          if (authUpdateResult.credentialsChanged) {
            setCredentialsChanged(true);
          }
        } else {
          console.log('👥 [SAVE] Updating user auth via admin...');
          authUpdateResult = await updateUserAuthViaAdmin();
          
          if (!authUpdateResult.success) {
            throw new Error(authUpdateResult.error || 'Failed to update authentication');
          }
        }
      }

      // Update database
      console.log('🗄️ [SAVE] Updating database...');
      await updateDatabaseWithAuthInfo();

      // Call parent onSave if provided
      if (onSave) {
        console.log('📞 [SAVE] Calling parent onSave...');
        await onSave();
      }

      // Show success message
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
        
        if (fetchUserData) {
          await fetchUserData();
        }
      }

      // Cleanup
      setCurrentPassword('');
      if (handleInputChange) {
        handleInputChange({ target: { name: 'password', value: '' } });
      }

      console.log('🎯 === SAVE PROCESS COMPLETE ===');
    } catch (error) {
      console.error('❌ [SAVE] Error:', error);
      setUpdateStatus({ 
        type: 'error', 
        message: `Error updating profile: ${error.message}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simple quick reset handler
  const handleQuickReset = async (type) => {
    if (!isAdminUser || isCurrentUser) {
      setUpdateStatus({
        type: 'error',
        message: 'You do not have permission to reset credentials for this user.'
      });
      return;
    }

    setIsResetting(true);
    try {
      const updates = {};
      
      if (type === 'email') {
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setUpdateStatus({ type: 'error', message: 'Please enter a valid email in the form first.' });
          return;
        }
        updates.email = formData.email;
        updates.displayName = formData.name;
      } else if (type === 'password') {
        updates.password = 'AV2025!';
      }

      // Call admin API
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/update-user-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId, updates })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reset credentials');
      }

      // Update database
      const dbUpdates = {};
      if (updates.email) {
        dbUpdates[`users/${userId}/profile/email`] = updates.email;
        dbUpdates[`users/${userId}/email`] = updates.email;
      }
      if (updates.displayName) {
        dbUpdates[`users/${userId}/profile/name`] = updates.displayName;
        dbUpdates[`users/${userId}/name`] = updates.displayName;
      }
      dbUpdates[`users/${userId}/profile/updatedAt`] = new Date().toISOString();
      
      await update(ref(database), dbUpdates);

      const message = type === 'email' 
        ? `Email reset to: ${updates.email}` 
        : `Password reset to: AV2025!`;
      
      setUpdateStatus({
        type: 'success',
        message: `Successfully reset ${type}. ${message}`
      });
      
      if (fetchUserData) {
        await fetchUserData();
      }
    } catch (error) {
      console.error('❌ [QUICK_RESET] Error:', error);
      setUpdateStatus({
        type: 'error',
        message: `Error resetting ${type}: ${error.message}`
      });
    } finally {
      setIsResetting(false);
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

  // Render current password field
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
            className="w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
              px-3 py-2 text-white/90 placeholder-white/50
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
              backdrop-blur-md transition-all duration-200 pr-12"
            required
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('current')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
          >
            {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
      {renderLogoutPrompt()}
      
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white/90">Personal Information</h2>
        {userId && <p className="text-xs text-white/50 mt-1">User ID: {userId}</p>}
        <div className="text-xs text-white/40 mt-1">
          Current User: {isCurrentUser ? 'Yes' : 'No'} | Admin: {isAdminUser ? 'Yes' : 'No'}
        </div>
      </div>

      {updateStatus && (
        <div className={`mx-6 mt-4 p-3 rounded ${
          updateStatus.type === 'success' 
            ? 'bg-green-900/50 text-green-300' 
            : updateStatus.type === 'warning'
            ? 'bg-yellow-900/50 text-yellow-300'
            : 'bg-red-900/50 text-red-300'
        }`}>
          <div className="flex items-start">
            {updateStatus.type === 'success' ? (
              <CheckCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            ) : updateStatus.type === 'warning' ? (
              <AlertTriangle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
            )}
            <span>{updateStatus.message}</span>
          </div>
        </div>
      )}

      {/* Login Credentials Section */}
      {editMode && (
        <div className="p-6 pt-4">
          <div className="bg-[rgba(13,25,48,0.6)] p-4 rounded-lg border border-blue-500/20 mb-6">
            <h3 className="text-blue-400 text-md font-semibold mb-3 flex items-center">
              <KeyRound size={18} className="mr-2" />
              Login Credentials
            </h3>
            
            {/* Admin Reset Option */}
            {isAdminUser && !isCurrentUser && (
              <div className="mb-4 p-3 bg-[rgba(220,38,38,0.1)] rounded-lg border border-red-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield size={16} className="text-red-400 mr-2" />
                    <span className="text-red-400 font-semibold text-sm">Admin Quick Reset</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQuickReset('email')}
                      className="px-3 py-1 rounded-md bg-orange-600 text-white font-semibold hover:bg-orange-500 text-xs"
                      disabled={isResetting}
                    >
                      Reset Email
                    </button>
                    <button
                      onClick={() => handleQuickReset('password')}
                      className="px-3 py-1 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500 text-xs"
                      disabled={isResetting}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
                <p className="text-white/60 text-xs mt-1">
                  Reset email to current form value or password to "AV2025!"
                </p>
              </div>
            )}

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
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  )}
                </div>
                {errors.password && (
                  <div className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle size={14} />
                    <span>{errors.password}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Help text */}
            <div className="mt-3 text-amber-400 text-sm flex items-start">
              <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <span>
                {isCurrentUser 
                  ? 'Changing your login credentials will require you to log in again with your new information.'
                  : 'As an admin, you can update this user\'s login credentials. They will need to use these new details next time they log in.'}
              </span>
            </div>
            
            {/* Current password field */}
            {renderCurrentPasswordField()}
          </div>
        </div>
      )}
        
      {/* Tab Navigation */}
      <div className="flex space-x-2 mx-6 overflow-x-auto pb-2 border-b border-white/10">
        {[
          { id: 'personal', label: 'Basic Info' },
          { id: 'contact', label: 'Contact' },
          { id: 'padrino', label: 'Padrino' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setExpandedSection(tab.id)}
            className={`px-4 py-2 text-sm rounded-lg ${
              expandedSection === tab.id
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-white/70 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
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
              label="Username"
              icon={<User size={16} className="text-white/70" />}
              name="username"
              value={formData.username || ''}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.username}
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

      {/* Save/Cancel Buttons */}
      {editMode && (
        <div className="border-t border-white/10 p-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-white/20 rounded-lg text-white/70 hover:bg-white/5 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center ${
              isSaving
                ? 'bg-blue-600/50 cursor-not-allowed text-white/70'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="animate-spin mr-2" size={16} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
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
  onPadrinoColorChange: PropTypes.func,
  isAdminUser: PropTypes.bool
};

export default PersonalInfoSection;
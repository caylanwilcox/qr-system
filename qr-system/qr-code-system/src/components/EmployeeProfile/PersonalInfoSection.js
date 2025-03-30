'use client';
//src/components/EmployeeProfile/PersonalInfoSection.js

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ref, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Mail, Phone, MapPin, Calendar, AlertCircle, Lock, Users, User, Award, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { calculatePadrinoColor, PADRINO_COLORS } from '../utils/padrinoColorCalculator';
import { useAuth } from '../../services/authContext';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';

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
  onRoleToggle,
  locations = [],
  departments = [],
  onPadrinoChange,
  onPadrinoColorChange,
  userData,
  isCurrentUser = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [expandedSection, setExpandedSection] = useState('personal');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const { user } = useAuth();

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(prevState => !prevState);
  };

  // Toggle current password visibility
  const toggleCurrentPasswordVisibility = () => {
    setShowCurrentPassword(prevState => !prevState);
  };

  // Handle save with password update logic
  const handleSaveClick = async () => {
    try {
      // If there's a new password and this is the current user's profile
      if (formData.password && isCurrentUser) {
        if (!currentPassword) {
          setUpdateStatus({ 
            type: 'error', 
            message: 'Current password is required to update password' 
          });
          return;
        }

        try {
          // Make sure user is available before trying to reauthenticate
          if (!user || !user.email) {
            setUpdateStatus({
              type: 'error',
              message: 'Authentication error: User not properly authenticated'
            });
            return;
          }

          // First reauthenticate
          const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword
          );
          
          await reauthenticateWithCredential(auth.currentUser, credential);
          
          // Then update password
          await updatePassword(auth.currentUser, formData.password);
          
          setUpdateStatus({ 
            type: 'success', 
            message: 'Password updated successfully!' 
          });
          
          // Clear password fields after successful update
          setCurrentPassword('');
          // If you have a handler to update formData directly:
          // handleInputChange({ target: { name: 'password', value: '' } });
        } catch (authError) {
          console.error("Auth error updating password:", authError);
          
          if (authError.code === 'auth/wrong-password') {
            setUpdateStatus({ 
              type: 'error', 
              message: 'Current password is incorrect' 
            });
          } else if (authError.code === 'auth/weak-password') {
            setUpdateStatus({ 
              type: 'error', 
              message: 'New password is too weak (minimum 6 characters)' 
            });
          } else if (authError.code === 'auth/requires-recent-login') {
            setUpdateStatus({ 
              type: 'error', 
              message: 'Please log out and log back in before changing your password' 
            });
          } else {
            setUpdateStatus({ 
              type: 'error', 
              message: `Authentication error: ${authError.message}` 
            });
          }
          return;
        }
      }
      
      // Continue with regular save logic
      if (onSave) {
        await onSave();
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setUpdateStatus({ 
        type: 'error', 
        message: `Error: ${error.message}` 
      });
    }
  };

  // Render appropriate password help text based on user context
  const renderPasswordHelpText = () => {
    if (!editMode) return null;

    if (isCurrentUser) {
      return (
        <div className="text-blue-400 text-sm mb-2 flex items-start">
          <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
          <span>
            Enter a new password to update your account. You'll need to enter your current 
            password to confirm this change.
          </span>
        </div>
      );
    } else {
      return (
        <div className="text-amber-400 text-sm mb-2 flex items-start">
          <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
          <span>
            As an administrator, you can update this user's database password, but this won't change their 
            authentication credentials. For complete password reset, please use the admin dashboard.
          </span>
        </div>
      );
    }
  };

  // Render current password field when needed
  const renderCurrentPasswordField = () => {
    // Make sure user is available and we're in the right conditions to show this field
    if (!editMode || !isCurrentUser || !formData.password || !user) return null;
    
    return (
      <div className="form-group md:col-span-2 mt-4">
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
            name="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
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
            onClick={toggleCurrentPasswordVisibility}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-600 transition-colors"
          >
            {showCurrentPassword ? "HIDE" : "SHOW"}
          </button>
        </div>
        <p className="text-amber-400 text-xs mt-1">
          Required to confirm password change
        </p>
      </div>
    );
  };

  return (
    <div className="bg-[rgba(13,25,48,0.4)] backdrop-blur-xl rounded-lg border border-white/10 shadow-xl">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white/90">Personal Information</h2>
        {userId && <p className="text-xs text-white/50 mt-1">User ID: {userId}</p>}
      </div>

      {updateStatus && (
        <div className={`mx-6 mt-4 p-3 rounded ${
          updateStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {updateStatus.message}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex space-x-2 m-6 overflow-x-auto pb-2 border-b border-white/10">
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

            {/* Custom Password Field with Toggle Button */}
            <div className="form-group md:col-span-2">
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
                  onChange={handleInputChange}
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
                    onClick={togglePasswordVisibility}
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

            {/* Password update help text */}
            {editMode && renderPasswordHelpText()}

            {/* Current password field for verification when changing own password */}
            {renderCurrentPasswordField()}
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
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSaveClick}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500"
          >
            Save Changes
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
  onRoleToggle: PropTypes.func,
  locations: PropTypes.array,
  departments: PropTypes.array,
  onPadrinoChange: PropTypes.func,
  onPadrinoColorChange: PropTypes.func,
  userData: PropTypes.object,
  isCurrentUser: PropTypes.bool
};

export default PersonalInfoSection;
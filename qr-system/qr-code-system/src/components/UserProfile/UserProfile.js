'use client';

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ref, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Mail, Phone, MapPin, Calendar, AlertCircle, Lock, Users } from 'lucide-react';

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
  userId, // Add userId as a prop to allow admin to edit different users
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  // Custom handler for password field to ensure it works with the form's overall input handling
  const handlePasswordChange = (e) => {
    if (handleInputChange) {
      handleInputChange(e);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prevState => !prevState);
  };

  const handleSave = async () => {
    try {
      if (!userId) {
        setUpdateStatus({ type: 'error', message: 'No user ID provided' });
        return;
      }

      // Create updates for database fields
      const updates = {};
      
      // Only update phone and service in the profile object
      updates[`users/${userId}/profile/phone`] = formData.phone || '';
      
      // Add service if it exists
      if (formData.service) {
        console.log("Updating service type to:", formData.service);
        updates[`users/${userId}/profile/service`] = formData.service;
      }

      // Add password update if it exists and is not empty
      if (formData.password && formData.password.trim() !== '') {
        console.log("Updating password (normally would use Firebase Auth instead of direct DB update)");
        updates[`users/${userId}/profile/password`] = formData.password;
      }

      // Update Firebase database only
      console.log("Updating user profile:", updates);
      await update(ref(database), updates);
      console.log("Database update completed successfully");

      setUpdateStatus({ 
        type: 'success', 
        message: 'Profile updated successfully!' 
      });

      // Call the onSave callback if provided
      if (onSave) {
        onSave();
      }
      
      // Clear status after 3 seconds
      setTimeout(() => setUpdateStatus(null), 3000);
      
    } catch (error) {
      console.error("Error updating profile:", error);
      setUpdateStatus({ 
        type: 'error', 
        message: `Error: ${error.message}` 
      });
    }
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

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Email"
            icon={<Mail size={16} className="text-white/70" />}
            name="email"
            type="email"
            value={formData.email || ''}
            onChange={handleInputChange}
            disabled={true}
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
            required
          />

          <FormField
            label="Location"
            icon={<MapPin size={16} className="text-white/70" />}
            name="location"
            value={formData.location || ''}
            disabled={true}
          />

          <FormField
            label="Join Date"
            icon={<Calendar size={16} className="text-white/70" />}
            name="joinDate"
            type="date"
            value={formData.joinDate || ''}
            disabled={true}
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
          
          {/* Custom Password Field with Toggle Button */}
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
                placeholder="Enter password"
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

          {editMode && (
            <div>
              <div className="text-amber-400 text-sm mb-2">
                <strong>Note:</strong> For security reasons, your password changes here will only affect the database. 
                For full authentication updates, please contact your administrator.
              </div>
              <div className="text-gray-300 text-xs">
                You can update your phone number, service type, and password from this form.
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
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500"
          >
            Save Chsdsdsdes
          </button>
        </div>
      )}
    </div>
  );
};

PersonalInfoSection.propTypes = {
  formData: PropTypes.shape({
    email: PropTypes.string,
    phone: PropTypes.string,
    location: PropTypes.string,
    joinDate: PropTypes.string,
    password: PropTypes.string,
    service: PropTypes.string,
  }).isRequired,
  editMode: PropTypes.bool.isRequired,
  handleInputChange: PropTypes.func.isRequired,
  errors: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  userId: PropTypes.string, // User ID to update (for admin purposes)
};

export default PersonalInfoSection;
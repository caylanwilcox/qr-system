'use client';
import React from 'react';
import PropTypes from 'prop-types';
import { updatePassword } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { auth, database } from '../../services/firebaseConfig';
import {
  Mail, Phone, MapPin, Calendar, UserPlus, AlertCircle, Award, Lock,
} from 'lucide-react';

const serviceTypes = [
  'LIDER', 'RSG', 'COM', 'TESORERO DE GRUPO', 'PPI',
  'MANAGER DE HACIENDA', 'COORDINADOR DE HACIENDA',
  'ATRACCION INTERNA', 'ATRACCION EXTERNA', 'SECRETARY',
  'LITERATURA', 'SERVIDOR DE CORO', 'SERVIDOR DE JAV EN MESA',
  'SERVIDOR DE SEGUIMIENTOS',
];

const padrinoColors = [
  { value: 'orange', label: 'Orange', bgColor: 'bg-orange-500' },
  { value: 'red', label: 'Red', bgColor: 'bg-red-500' },
  { value: 'green', label: 'Green', bgColor: 'bg-green-500' },
  { value: 'blue', label: 'Blue', bgColor: 'bg-blue-500' },
];

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
  onPadrinoChange,
  locations,
  departments,
  errors = {},
  onSave,
  onCancel,
}) => {
  const handleSave = async () => {
    try {
      const user = auth.currentUser;
      const updates = { ...formData };
      delete updates.password;

      // Update profile in database
      const userRef = ref(database, `users/${user.uid}`);
      await update(userRef, updates);

      // Update password if provided
      if (formData.password) {
        await updatePassword(user, formData.password);
      }

      onSave?.();
    } catch (error) {
      console.error('Error updating profile:', error);
      // Handle error
    }
  };

  return (
    <div className="bg-[rgba(13,25,48,0.4)] backdrop-blur-xl rounded-lg border border-white/10 shadow-xl">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white/90">Personal Information</h2>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Email"
            icon={<Mail size={16} className="text-white/70" />}
            name="email"
            type="email"
            value={formData.email}
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
            value={formData.phone}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.phone}
            required
          />

          <FormField
            label="Location"
            icon={<MapPin size={16} className="text-white/70" />}
            name="location"
            error={errors.location}
            required
          >
            <select
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              disabled={!editMode}
              className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                px-3 py-2 text-white/90 backdrop-blur-md
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30
                transition-all duration-200 appearance-none
                ${errors.location ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
            >
              <option value="">Select Location</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Service"
            icon={<Award size={16} className="text-white/70" />}
            name="service"
            error={errors.service}
            required
          >
            <select
              id="service"
              name="service"
              value={formData.service}
              onChange={handleInputChange}
              disabled={!editMode}
              className={`w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                px-3 py-2 text-white/90 backdrop-blur-md
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30
                transition-all duration-200 appearance-none
                ${errors.service ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
            >
              <option value="">Select Service Type</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Join Date"
            icon={<Calendar size={16} className="text-white/70" />}
            name="joinDate"
            type="date"
            value={formData.joinDate}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.joinDate}
            required
          />

          <FormField
            label="Password"
            icon={<Lock size={16} className="text-white/70" />}
            name="password"
            type="password"
            value={formData.password || ''}
            onChange={handleInputChange}
            disabled={!editMode}
            error={errors.password}
            required={false}
          />
        </div>

        <div className="border-t border-white/10 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-white/70" />
              <span className="text-sm font-medium text-white/90">¿Padrino?</span>
            </div>
            <input
              type="checkbox"
              name="padrino"
              checked={formData.padrino}
              onChange={onPadrinoChange}
              disabled={!editMode}
              className="cursor-pointer h-5 w-5 accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {formData.padrino && (
            <div className="mt-4">
              <label className="block text-sm text-white/70 mb-2">
                Padrino Color Rank
              </label>
              <select
                name="padrinoColor"
                value={formData.padrinoColor || ''}
                onChange={handleInputChange}
                disabled={!editMode}
                className="w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                  px-3 py-2 text-white/90 backdrop-blur-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50
                  disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30
                  transition-all duration-200 appearance-none"
              >
                <option value="">Select Rank Color</option>
                {padrinoColors.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {formData.padrinoColor && (
                <div className="mt-2 flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${padrinoColors.find(c => c.value === formData.padrinoColor)?.bgColor}`} />
                  <span className="text-sm text-white/70">Current Rank</span>
                </div>
              )}
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
            Save Changes
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
    service: PropTypes.string,
    joinDate: PropTypes.string,
    password: PropTypes.string,
    padrino: PropTypes.bool,
    padrinoColor: PropTypes.string,
  }).isRequired,
  editMode: PropTypes.bool.isRequired,
  handleInputChange: PropTypes.func.isRequired,
  onPadrinoChange: PropTypes.func.isRequired,
  locations: PropTypes.arrayOf(PropTypes.string).isRequired,
  departments: PropTypes.arrayOf(PropTypes.string).isRequired,
  errors: PropTypes.object,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
};

export default PersonalInfoSection;
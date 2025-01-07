import React from 'react';
import PropTypes from 'prop-types';
import { 
  Shield, Mail, Phone, Building2, Calendar, 
  Users, UserPlus, MapPin, AlertCircle 
} from 'lucide-react';

const IconWrapper = ({ children, label }) => (
  <span className="inline-flex items-center gap-2 text-sm text-gray-300/90" aria-hidden="true">
    {children}
    <span>{label}</span>
  </span>
);

const FormField = ({ 
  label, 
  icon, 
  name, 
  type = "text", 
  value, 
  onChange, 
  disabled, 
  error,
  required,
  children 
}) => (
  <div className="form-group">
    <label htmlFor={name} className="block mb-2">
      <IconWrapper label={label}>{icon}</IconWrapper>
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
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`
          w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
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
  onRoleToggle,
  locations,
  departments,
  errors = {}
}) => {
  return (
    <div className="bg-[rgba(13,25,48,0.4)] backdrop-blur-xl rounded-lg border border-white/10 shadow-xl">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white/90">Personal Information</h2>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Main Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className={`
                w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                px-3 py-2 text-white/90 backdrop-blur-md
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                disabled:bg-[rgba(13,25,48,0.3)] disabled:text-white/30
                transition-all duration-200 appearance-none
                ${errors.location ? 'border-red-500/50 focus:ring-red-500/50' : ''}
              `}
              aria-invalid={errors.location ? "true" : "false"}
            >
              <option value="">Select Location</option>
              {locations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </FormField>

          {/* Similar FormField components for other fields... */}

        </div>

        {/* Emergency Contact Card */}
        <div className="bg-[rgba(239,68,68,0.1)] backdrop-blur-md rounded-lg p-6 border border-red-500/20">
          <h3 className="text-red-400 font-medium mb-4">Emergency Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Contact Name"
              icon={<Users size={16} className="text-white/70" />}
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.emergencyContact}
              required
            />

            <FormField
              label="Contact Phone"
              icon={<Phone size={16} className="text-white/70" />}
              name="emergencyPhone"
              type="tel"
              value={formData.emergencyPhone}
              onChange={handleInputChange}
              disabled={!editMode}
              error={errors.emergencyPhone}
              required
            />
          </div>
        </div>

        {/* Role Toggle */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-white/70" />
              <span className="text-sm font-medium text-white/90">Admin Access</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.role === 'admin'}
              onClick={editMode ? onRoleToggle : undefined}
              disabled={!editMode}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                border-2 border-transparent transition-colors duration-200 ease-in-out 
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2
                ${formData.role === 'admin' ? 'bg-blue-500' : 'bg-gray-500/50'}
                ${!editMode ? 'opacity-50 cursor-not-allowed' : ''}
                backdrop-blur-md
              `}
            >
              <span className="sr-only">Toggle admin access</span>
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full 
                  bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                  ${formData.role === 'admin' ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
          <p className="mt-2 text-sm text-white/70">
            {formData.role === 'admin' ? 'Administrator' : 'Regular Member'}
          </p>
        </div>

        {/* Additional Notes */}
        {editMode && (
          <div className="space-y-2">
            <label htmlFor="notes" className="block text-sm font-medium text-white/90">
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className={`
                w-full rounded-md bg-[rgba(13,25,48,0.6)] border border-white/10
                px-3 py-2 text-white/90 placeholder-white/50
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                backdrop-blur-md transition-all duration-200
              `}
              placeholder="Add any additional notes..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

PersonalInfoSection.propTypes = {
  formData: PropTypes.shape({
    email: PropTypes.string,
    phone: PropTypes.string,
    location: PropTypes.string,
    department: PropTypes.string,
    position: PropTypes.string,
    joinDate: PropTypes.string,
    emergencyContact: PropTypes.string,
    emergencyPhone: PropTypes.string,
    role: PropTypes.string,
    notes: PropTypes.string,
  }).isRequired,
  editMode: PropTypes.bool.isRequired,
  handleInputChange: PropTypes.func.isRequired,
  onRoleToggle: PropTypes.func.isRequired,
  locations: PropTypes.arrayOf(PropTypes.string).isRequired,
  departments: PropTypes.arrayOf(PropTypes.string),
  errors: PropTypes.object,
};

export default PersonalInfoSection;
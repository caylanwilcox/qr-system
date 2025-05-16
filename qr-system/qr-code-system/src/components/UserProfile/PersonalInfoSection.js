import React, { useState } from 'react';
import { 
  User, Phone, Mail, Calendar, MapPin, Building, 
  Shield, Users, Send, CheckCircle, AlertCircle,
  Clock, X
} from 'lucide-react';

/**
 * Personal Information Section Component
 * Displays employee personal details with limited edit capabilities for employee view
 */
const PersonalInfoSection = ({
  formData,
  editMode,
  handleInputChange,
  userId,
  onRoleToggle,
  locations,
  departments,
  onPadrinoChange,
  onPadrinoColorChange,
  onSave,
  onCancel,
  errors = {},
  userData,
  isCurrentUser,
  onSendPasswordReset,
  fetchUserData,
  viewOnly = false,
  isEmployeeView = false,
  onUpdatePhone,
  onUpdateEmergencyContact
}) => {
  // Local state for updatable fields
  const [showPhoneUpdateForm, setShowPhoneUpdateForm] = useState(false);
  const [newPhone, setNewPhone] = useState(formData.phone || '');
  const [showEmergencyContactForm, setShowEmergencyContactForm] = useState(false);
  const [newEmergencyContact, setNewEmergencyContact] = useState(formData.emergencyContact || '');
  const [newEmergencyPhone, setNewEmergencyPhone] = useState(formData.emergencyPhone || '');
  const [formErrors, setFormErrors] = useState({});

  // Function to validate phone numbers
  const validatePhone = (phone) => {
    const phoneRegex = /^[\d\s\+\-\(\)]{10,15}$/;
    return phoneRegex.test(phone);
  };

  // Function to handle phone update
  const handlePhoneUpdate = () => {
    // Reset errors
    setFormErrors({});
    
    // Validate phone number
    if (!newPhone.trim()) {
      setFormErrors({ phone: 'Phone number is required' });
      return;
    }
    
    if (!validatePhone(newPhone)) {
      setFormErrors({ phone: 'Please enter a valid phone number' });
      return;
    }
    
    // Call update function
    if (onUpdatePhone) {
      onUpdatePhone(newPhone);
      setShowPhoneUpdateForm(false);
    }
  };

  // Function to handle emergency contact update
  const handleEmergencyContactUpdate = () => {
    // Reset errors
    setFormErrors({});
    
    // Validate inputs
    if (!newEmergencyContact.trim()) {
      setFormErrors({ contact: 'Contact name is required' });
      return;
    }
    
    if (newEmergencyPhone && !validatePhone(newEmergencyPhone)) {
      setFormErrors({ contactPhone: 'Please enter a valid phone number' });
      return;
    }
    
    // Call update function
    if (onUpdateEmergencyContact) {
      onUpdateEmergencyContact(newEmergencyContact, newEmergencyPhone);
      setShowEmergencyContactForm(false);
    }
  };

  // Cancel phone update form
  const cancelPhoneUpdate = () => {
    setShowPhoneUpdateForm(false);
    setNewPhone(formData.phone || '');
    setFormErrors({});
  };

  // Cancel emergency contact update form
  const cancelEmergencyUpdate = () => {
    setShowEmergencyContactForm(false);
    setNewEmergencyContact(formData.emergencyContact || '');
    setNewEmergencyPhone(formData.emergencyPhone || '');
    setFormErrors({});
  };

  // For employee view, we show a simplified read-only version with limited edit options
  if (isEmployeeView) {
    return (
      <div className="bg-[rgba(13,25,48,0.4)] rounded-lg border border-[rgba(255,255,255,0.1)] p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Details - Read Only */}
          <div>
            <h3 className="text-white text-lg font-medium mb-4 flex items-center">
              <User className="mr-2 text-blue-400" size={20} />
              Personal Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Full Name</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)]">
                  {formData.name || 'Not provided'}
                </p>
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-1">Email Address</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)] flex items-center">
                  <Mail className="mr-2 text-blue-400" size={16} />
                  {formData.email || 'Not provided'}
                </p>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-white/70 text-sm mb-1">Phone Number</label>
                  <button 
                    type="button"
                    onClick={() => setShowPhoneUpdateForm(!showPhoneUpdateForm)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    {showPhoneUpdateForm ? 'Cancel' : 'Update'}
                  </button>
                </div>
                
                {showPhoneUpdateForm ? (
                  <div className="space-y-2">
                    <div className="flex">
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        className={`flex-1 bg-[rgba(13,25,48,0.6)] text-white p-3 rounded-l-md border ${
                          formErrors.phone ? 'border-red-500' : 'border-[rgba(255,255,255,0.1)]'
                        }`}
                        placeholder="Enter new phone number"
                      />
                      <div className="flex">
                        <button
                          type="button"
                          onClick={cancelPhoneUpdate}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 border-y border-r border-[rgba(255,255,255,0.1)]"
                        >
                          <X size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={handlePhoneUpdate}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 rounded-r-md"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                    {formErrors.phone && (
                      <p className="text-red-400 text-xs flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        {formErrors.phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)] flex items-center">
                    <Phone className="mr-2 text-blue-400" size={16} />
                    {formData.phone || 'Not provided'}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Work Details - Read Only */}
          <div>
            <h3 className="text-white text-lg font-medium mb-4 flex items-center">
              <Building className="mr-2 text-green-400" size={20} />
              Work Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-1">Position</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)]">
                  {formData.position || 'Not assigned'}
                </p>
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-1">Department</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)]">
                  {formData.department || 'Not assigned'}
                </p>
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-1">Primary Location</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)] flex items-center">
                  <MapPin className="mr-2 text-green-400" size={16} />
                  {formData.location || 'Not assigned'}
                </p>
              </div>
              
              <div>
                <label className="block text-white/70 text-sm mb-1">Join Date</label>
                <p className="text-white bg-[rgba(13,25,48,0.6)] p-3 rounded-md border border-[rgba(255,255,255,0.1)] flex items-center">
                  <Calendar className="mr-2 text-green-400" size={16} />
                  {formData.joinDate || 'Not recorded'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Emergency Contact Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-lg font-medium flex items-center">
              <Users className="mr-2 text-red-400" size={20} />
              Emergency Contact
            </h3>
            <button 
              type="button"
              onClick={() => setShowEmergencyContactForm(!showEmergencyContactForm)}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
            >
              {showEmergencyContactForm ? (
                <>
                  <X size={14} className="mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Send size={14} className="mr-1" />
                  Update Contact
                </>
              )}
            </button>
          </div>
          
          {showEmergencyContactForm ? (
            <div className="bg-[rgba(13,25,48,0.6)] p-4 rounded-md border border-[rgba(255,255,255,0.1)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={newEmergencyContact}
                    onChange={e => setNewEmergencyContact(e.target.value)}
                    className={`w-full bg-[rgba(30,41,59,0.8)] text-white p-3 rounded-md ${
                      formErrors.contact ? 'border-red-500' : 'border-[rgba(255,255,255,0.1)]'
                    }`}
                    placeholder="Emergency contact name"
                  />
                  {formErrors.contact && (
                    <p className="text-red-400 text-xs flex items-center mt-1">
                      <AlertCircle size={12} className="mr-1" />
                      {formErrors.contact}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={newEmergencyPhone}
                    onChange={e => setNewEmergencyPhone(e.target.value)}
                    className={`w-full bg-[rgba(30,41,59,0.8)] text-white p-3 rounded-md ${
                      formErrors.contactPhone ? 'border-red-500' : 'border-[rgba(255,255,255,0.1)]'
                    }`}
                    placeholder="Emergency contact phone"
                  />
                  {formErrors.contactPhone && (
                    <p className="text-red-400 text-xs flex items-center mt-1">
                      <AlertCircle size={12} className="mr-1" />
                      {formErrors.contactPhone}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelEmergencyUpdate}
                  className="px-4 py-2 text-white/70 border border-[rgba(255,255,255,0.1)] rounded-md hover:bg-[rgba(255,255,255,0.05)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEmergencyContactUpdate}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
                >
                  <CheckCircle size={16} className="mr-2" />
                  Save Contact
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[rgba(13,25,48,0.6)] p-4 rounded-md border border-[rgba(255,255,255,0.1)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm mb-1">Emergency Contact</label>
                  <p className="text-white p-3 flex items-center">
                    <Users className="mr-2 text-red-400" size={16} />
                    {formData.emergencyContact || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-1">Emergency Phone</label>
                  <p className="text-white p-3 flex items-center">
                    <Phone className="mr-2 text-red-400" size={16} />
                    {formData.emergencyPhone || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Service Information */}
        {(formData.service || formData.padrino) && (
          <div className="mt-8">
            <h3 className="text-white text-lg font-medium mb-4 flex items-center">
              <Shield className="mr-2 text-yellow-400" size={20} />
              Service Information
            </h3>
            <div className="bg-[rgba(13,25,48,0.6)] p-4 rounded-md border border-[rgba(255,255,255,0.1)]">
              <div className="space-y-3">
                {formData.service && (
                  <div className="flex items-center">
                    <Clock className="mr-2 text-white/70" size={16} />
                    <span className="text-white/70 mr-2">Service:</span>
                    <span className="text-white">{formData.service}</span>
                  </div>
                )}
                
                {formData.padrino && (
                  <div className="flex items-center">
                    <Shield className="mr-2 text-yellow-400" size={16} />
                    <span className="text-white/70 mr-2">Padrino Status:</span>
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full bg-${formData.padrinoColor}-500 mr-2`}></span>
                      <span className={`text-${formData.padrinoColor}-400 capitalize`}>
                        {formData.padrinoColor || 'Red'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin view (original component)
  return (
    <div className="bg-[rgba(13,25,48,0.4)] rounded-lg border border-[rgba(255,255,255,0.1)] p-6">
      <h3 className="text-white text-lg font-medium mb-4">Personal Information</h3>

      {/* Form fields would go here */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Name Field */}
        <div className="form-group">
          <label htmlFor="name" className="block text-[rgba(255,255,255,0.7)] text-sm font-medium mb-2">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-input"
            placeholder="Enter full name"
            disabled={!editMode || viewOnly}
          />
        </div>

        {/* Other form fields would follow */}
        {/* ... */}
      </div>

      {/* Action buttons */}
      {editMode && !viewOnly && (
        <div className="flex justify-end mt-6 space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn warning"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="btn primary"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalInfoSection;
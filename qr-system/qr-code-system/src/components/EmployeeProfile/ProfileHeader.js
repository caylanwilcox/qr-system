// components/ProfileHeader.js
import React from 'react';
import { Activity, Edit2, X, Save } from 'lucide-react';
import PropTypes from 'prop-types';

const ProfileHeader = ({ 
  formData, 
  editMode, 
  employeeId, 
  onEdit, 
  onSave, 
  onStatusToggle, 
  handleInputChange 
}) => (
  <div className="profile-header glass-panel">
    <div className="profile-info">
      <div className="avatar">
        {formData.name.charAt(0)}
      </div>
      <div>
        {editMode ? (
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-input name-input"
            placeholder="Enter name"
          />
        ) : (
          <h1>{formData.name}</h1>
        )}
        <div className="profile-status">
          <span className={`status-dot ${formData.status}`} />
          {formData.status}
        </div>
        <p className="profile-id">ID: {employeeId}</p>
      </div>
    </div>

    <div className="profile-actions">
      <button 
        onClick={onStatusToggle}
        className={`btn ${formData.status === 'active' ? 'success' : 'warning'}`}
      >
        <Activity size={18} />
        {formData.status === 'active' ? 'Set Inactive' : 'Set Active'}
      </button>
      
      <button onClick={onEdit} className="btn primary">
        {editMode ? <X size={18} /> : <Edit2 size={18} />}
        {editMode ? 'Cancel' : 'Edit Profile'}
      </button>
      
      {editMode && (
        <button onClick={onSave} className="btn success">
          <Save size={18} />
          Save Changes
        </button>
      )}
    </div>
  </div>
);

ProfileHeader.propTypes = {
  formData: PropTypes.shape({
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  editMode: PropTypes.bool.isRequired,
  employeeId: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onStatusToggle: PropTypes.func.isRequired,
  handleInputChange: PropTypes.func.isRequired,
};

export default ProfileHeader;
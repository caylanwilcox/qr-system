// src/components/UserProfile/ProfileHeader.js
import React from 'react';
import { Edit2, X, Save, Award } from 'lucide-react';
import PropTypes from 'prop-types';

const getRankColor = (rank) => {
  if (!rank) return 'text-gray-400';
  switch (rank.toLowerCase()) {
    case 'blue': return 'text-blue-400';
    case 'green': return 'text-green-400';
    case 'red': return 'text-red-400';
    case 'orange': return 'text-orange-400';
    default: return 'text-gray-400';
  }
};

const ProfileHeader = ({
  formData,
  editMode,
  employeeId,
  onEdit,
  onSave,
  handleInputChange
}) => (
  <div className="profile-header glass-panel">
    <div className="profile-info">
      <div className="avatar">
        {formData?.name?.charAt(0) || '?'}
      </div>
      <div>
        {editMode ? (
          <input
            type="text"
            name="name"
            value={formData?.name || ''}
            onChange={handleInputChange}
            className="form-input name-input"
            placeholder="Enter name"
            disabled
          />
        ) : (
          <h1>{formData?.name || 'Unnamed'}</h1>
        )}
        <div className="flex items-center gap-4">
          <div className="profile-status">
            <span className={`status-dot ${formData?.status || 'inactive'}`} />
            {formData?.status || 'inactive'}
          </div>
          <div className="flex items-center gap-2">
            <Award className={`w-4 h-4 ${getRankColor(formData?.padrinoColor)}`} />
            <span className={`text-sm ${getRankColor(formData?.padrinoColor)}`}>
              {formData?.padrinoColor ? 
                `${formData.padrinoColor.charAt(0).toUpperCase()}${formData.padrinoColor.slice(1)} Rank` : 
                'No Rank'
              }
            </span>
          </div>
        </div>
        <p className="profile-id">ID: {employeeId}</p>
      </div>
    </div>

    <div className="profile-actions">
      <button onClick={onEdit} className="btn primary">
        {editMode ? <X size={18} /> : <Edit2 size={18} />}
        {editMode ? 'Cancel' : 'Edit Contact Info'}
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
    name: PropTypes.string,
    status: PropTypes.string,
    padrinoColor: PropTypes.oneOf(['blue', 'green', 'red', 'orange', null]),
  }).isRequired,
  editMode: PropTypes.bool.isRequired,
  employeeId: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  handleInputChange: PropTypes.func.isRequired,
};

export default ProfileHeader;
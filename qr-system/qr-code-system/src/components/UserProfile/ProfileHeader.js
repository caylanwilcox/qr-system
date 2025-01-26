import React from 'react';
import { Activity, Award } from 'lucide-react';
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

const UserProfileHeader = ({ formData }) => (
  <div className="profile-header glass-panel">
    <div className="profile-info">
      <div className="avatar">
        {formData?.name?.charAt(0) || '?'}
      </div>
      <div>
        <h1>{formData?.name || 'Unnamed'}</h1>
        <div className="flex items-center gap-4">
          <div className="profile-status">
            <span className={`status-dot ${formData?.status || 'inactive'}`} />
            {formData?.status || 'inactive'}
          </div>
          {formData?.padrinoColor && (
            <div className="flex items-center gap-2">
              <Award className={`w-4 h-4 ${getRankColor(formData.padrinoColor)}`} />
              <span className={`text-sm ${getRankColor(formData.padrinoColor)}`}>
                {`${formData.padrinoColor.charAt(0).toUpperCase()}${formData.padrinoColor.slice(1)} Rank`}
              </span>
            </div>
          )}
        </div>
        <p className="profile-id">ID: {formData?.id || 'N/A'}</p>
      </div>
    </div>
  </div>
);

UserProfileHeader.propTypes = {
  formData: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    status: PropTypes.string,
    padrinoColor: PropTypes.oneOf(['blue', 'green', 'red', 'orange', null]),
  }).isRequired,
};

export default UserProfileHeader;
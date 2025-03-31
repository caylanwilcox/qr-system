import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { useAuth } from '../../services/authContext';
import { ArrowLeft, Edit, Save, X, AlertTriangle, Award, PieChart, Clock } from 'lucide-react';
import PersonalInfoSection from './PersonalInfoSection';
import './styles/UserProfile.css';

const UserProfile = ({ locationRestricted = false }) => {
  const { employeeId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  // Determine if viewing own profile or someone else's
  const isOwnProfile = !employeeId || employeeId === user?.uid;
  const userId = employeeId || user?.uid;

  // Prepare editableData state separate from profileData
  const [editableData, setEditableData] = useState({});

  useEffect(() => {
    if (!userId) {
      setError("No user ID available");
      setLoading(false);
      return;
    }

    const userRef = ref(database, `users/${userId}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      try {
        const userData = snapshot.val();
        
        if (!userData) {
          setError("User not found");
          setProfileData({});
        } else {
          // Extract profile data
          const profile = userData.profile || {};
          const stats = userData.stats || {};
          
          // If location is restricted and the profile's location doesn't match admin's location
          if (locationRestricted && user?.profile?.primaryLocation && 
              profile.primaryLocation !== user.profile.primaryLocation) {
            setError("You don't have permission to view this profile");
            setProfileData({});
          } else {
            // Format data for the profile view
            const formattedData = {
              id: userId,
              email: profile.email || '',
              name: profile.name || '',
              phone: profile.phone || '',
              location: profile.primaryLocation || '',
              joinDate: profile.joinDate || '',
              service: profile.service || '',
              role: profile.role || 'employee',
              status: profile.status || 'inactive',
              stats: {
                daysPresent: stats.daysPresent || 0,
                daysAbsent: stats.daysAbsent || 0,
                daysLate: stats.daysLate || 0,
                attendanceRate: stats.attendanceRate || 0,
                onTimeRate: stats.onTimeRate || 0,
              }
            };
            
            setProfileData(formattedData);
            setEditableData(formattedData);
          }
        }
      } catch (err) {
        console.error("Error processing user data:", err);
        setError("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [userId, user, locationRestricted]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditableData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    // Validate phone (simple validation)
    if (editableData.phone && !/^\d{10,15}$/.test(editableData.phone.replace(/\D/g, ''))) {
      errors.phone = "Please enter a valid phone number";
    }
    
    // Validate password if provided
    if (editableData.password && editableData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      // Format updates for Firebase
      const updates = {};
      
      // Only update fields that are editable
      if (editableData.phone !== profileData.phone) {
        updates[`users/${userId}/profile/phone`] = editableData.phone || '';
      }
      
      if (editableData.service !== profileData.service) {
        updates[`users/${userId}/profile/service`] = editableData.service || '';
      }
      
      if (editableData.password && editableData.password.trim() !== '') {
        updates[`users/${userId}/profile/password`] = editableData.password;
      }
      
      // Status can be toggled by admins
      if (!isOwnProfile && editableData.status !== profileData.status) {
        updates[`users/${userId}/profile/status`] = editableData.status;
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
        setSuccessMessage("Profile updated successfully");
        
        // Clear password field after update
        setEditableData(prev => ({
          ...prev,
          password: ''
        }));
        
        setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
      }
      
      setEditMode(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(`Update failed: ${err.message}`);
      
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  const handleCancel = () => {
    // Reset editable data to current profile data
    setEditableData(profileData);
    setEditMode(false);
    setFormErrors({});
  };

  const toggleStatus = async () => {
    try {
      const newStatus = profileData.status === 'active' ? 'inactive' : 'active';
      
      await update(ref(database, `users/${userId}/profile`), {
        status: newStatus
      });
      
      setSuccessMessage(`User is now ${newStatus}`);
      
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error toggling status:", err);
      setError(`Failed to update status: ${err.message}`);
      
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  const handleBack = () => {
    // Determine correct back navigation path based on user role
    if (user?.role?.toLowerCase() === 'super_admin') {
      navigate('/super-admin/manage-employees');
    } else if (user?.role?.toLowerCase() === 'admin') {
      navigate('/location-admin/manage-employees');
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">
          <AlertTriangle size={48} />
        </div>
        <h2>Error</h2>
        <p>{error}</p>
        <button className="button" onClick={handleBack}>
          Go Back
        </button>
      </div>
    );
  }

  // Check if we have profile data
  if (!profileData || !profileData.id) {
    return (
      <div className="error-container">
        <div className="error-icon">
          <AlertTriangle size={48} />
        </div>
        <h2>Profile Not Found</h2>
        <p>The requested user profile could not be found.</p>
        <button className="button" onClick={handleBack}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      {/* Back button */}
      <button className="back-button" onClick={handleBack}>
        <ArrowLeft size={18} />
        <span>Back to Employee List</span>
      </button>
      
      {/* Profile header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {profileData.name?.charAt(0) || 'U'}
        </div>
        
        <div className="profile-info">
          <h1 className="profile-name">{profileData.name}</h1>
          
          <div className="profile-meta">
            <span className={`badge ${profileData.role}`}>{profileData.role}</span>
            <span className={`badge ${profileData.status}`}>{profileData.status}</span>
            {profileData.service && (
              <span className="badge service">{profileData.service}</span>
            )}
          </div>
          
          <div className="profile-location">
            {profileData.location}
          </div>
        </div>
        
        <div className="profile-actions">
          {/* Edit button - shown only if viewing own profile or admin/super_admin */}
          {(isOwnProfile || 
            ['admin', 'super_admin'].includes(user?.role?.toLowerCase())) && (
            <button 
              className="edit-button"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? (
                <>
                  <X size={16} />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Edit size={16} />
                  <span>Edit</span>
                </>
              )}
            </button>
          )}
          
          {/* Status toggle button - shown only for admins viewing other profiles */}
          {!isOwnProfile && 
           ['admin', 'super_admin'].includes(user?.role?.toLowerCase()) && (
            <button 
              className={`status-button ${profileData.status === 'active' ? 'deactivate' : 'activate'}`}
              onClick={toggleStatus}
            >
              {profileData.status === 'active' ? 'Deactivate User' : 'Activate User'}
            </button>
          )}
        </div>
      </div>
      
      {/* Success/Error messages */}
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      {/* Tabs navigation */}
      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <PieChart size={16} />
          <span>Overview</span>
        </button>
        
        <button 
          className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          <Award size={16} />
          <span>Performance</span>
        </button>
        
        <button 
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={16} />
          <span>Attendance</span>
        </button>
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <PersonalInfoSection 
              formData={editableData}
              editMode={editMode}
              handleInputChange={handleInputChange}
              errors={formErrors}
              onSave={handleSave}
              onCancel={handleCancel}
              userId={userId}
            />
          </div>
        )}
        
        {activeTab === 'performance' && (
          <div className="performance-tab">
            <div className="card">
              <h2>Performance Metrics</h2>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-title">Attendance Rate</div>
                  <div className={`metric-value ${
                    profileData.stats.attendanceRate >= 90 ? 'excellent' :
                    profileData.stats.attendanceRate >= 80 ? 'good' :
                    profileData.stats.attendanceRate >= 70 ? 'average' : 'poor'
                  }`}>
                    {profileData.stats.attendanceRate}%
                  </div>
                </div>
                
                <div className="metric-card">
                  <div className="metric-title">On-Time Rate</div>
                  <div className={`metric-value ${
                    profileData.stats.onTimeRate >= 90 ? 'excellent' :
                    profileData.stats.onTimeRate >= 80 ? 'good' :
                    profileData.stats.onTimeRate >= 70 ? 'average' : 'poor'
                  }`}>
                    {profileData.stats.onTimeRate}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'attendance' && (
          <div className="attendance-tab">
            <div className="card">
              <h2>Attendance History</h2>
              <div className="attendance-summary">
                <div className="summary-card">
                  <div className="summary-title">Days Present</div>
                  <div className="summary-value">{profileData.stats.daysPresent}</div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-title">Days Absent</div>
                  <div className="summary-value">{profileData.stats.daysAbsent}</div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-title">Days Late</div>
                  <div className="summary-value">{profileData.stats.daysLate}</div>
                </div>
                
                <div className="summary-card">
                  <div className="summary-title">Total Days</div>
                  <div className="summary-value">
                    {profileData.stats.daysPresent + profileData.stats.daysAbsent}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
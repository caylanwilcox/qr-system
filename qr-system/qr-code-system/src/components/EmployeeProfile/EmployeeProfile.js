// Fixed EmployeeProfile.jsx with proper edit mode and admin authentication
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ref,
  get,
  update,
  remove,
} from 'firebase/database';
import {
  getAuth,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { database } from '../../services/firebaseConfig';

import {
  formatScheduledDates,
} from '../utils/employeeUtils';
import { calculatePadrinoColor } from '../utils/padrinoColorCalculator';
import { fetchLocations } from '../../services/locationService';
import { setUserRole } from '../../services/adminApi';
import { ROLES, normalizeRole } from '../../utils/roles';
import { profileToForm } from './profileForm';

import './styles/EmployeeProfile.css';
// Import the new carousel CSS
import './styles/EmployeeProfileCarousel.css';

import { 
  User, 
  BarChart2, 
  Calendar, 
  Edit3,
  X
} from 'lucide-react';

// Import your subcomponents:
import ProfileHeader from './ProfileHeader';
import PersonalInfoSection from './PersonalInfoSection';
import StatsSection from './StatsSection';
import AttendanceSection from './AttendanceSection';
import ScheduleSection from './ScheduleSection';
import IdCardSection from './IdCardSection';
// Import the new carousel component
import EmployeeProfileCarousel from './EmployeeProfileCarousel';

const DEPARTMENTS = [
  // Example: 'Finance', 'IT', 'Operations' ...
];

const INITIAL_FORM_DATA = {
  name: '',
  username: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  location: '',
  joinDate: '',
  role: 'employee',
  status: 'inactive',
  emergencyContact: '',
  emergencyPhone: '',
  notes: '',
  padrino: false,
  padrinoColor: 'blue',
  padrinoColorCode: 'blue',
  service: '',
  password: '',
};

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg
               transition-all duration-200 ${
      active
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        : 'text-white/70 hover:bg-white/5'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const EmployeeProfile = () => {
  const { employeeId } = useParams();
  const auth = getAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('personal');
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [locations, setLocations] = useState([]);
  const [locationsError, setLocationsError] = useState(null);
  const [, setScheduledDates] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);

  // 🔥 CRITICAL: User permission states
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);

  // The location menu lists the real locations. There is no hardcoded
  // fallback: guessed names are how mismatched locations got saved.
  useEffect(() => {
    let cancelled = false;
    fetchLocations()
      .then((list) => {
        if (!cancelled) setLocations(list);
      })
      .catch((err) => {
        console.error('Error loading locations:', err);
        if (!cancelled) setLocationsError('Could not load locations. Reload the page to change location.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Total number of slides in personal tab carousel
  const totalPersonalSlides = 3;

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  // 🔥 CRITICAL: Check if the profile belongs to the current user AND get admin status
  useEffect(() => {
    const checkUserPermissions = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsCurrentUser(false);
        setIsAdminUser(false);
        setAdminCheckComplete(true);
        return;
      }

      console.log('🎭 [EMPLOYEE_PROFILE] Checking user permissions...', {
        currentUserId: currentUser.uid,
        profileUserId: employeeId,
        userEmail: currentUser.email
      });

      // Check if current user
      const isCurrent = currentUser.uid === employeeId;
      setIsCurrentUser(isCurrent);

      try {
        // Get current user's data from database to check admin status
        const currentUserRef = ref(database, `users/${currentUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        
        if (currentUserSnapshot.exists()) {
          const userData = currentUserSnapshot.val();
          setCurrentUserData(userData);
          
          // Check for admin privileges from multiple sources
          const userRole = userData?.profile?.role?.toLowerCase() || userData?.role?.toLowerCase() || '';
          const hasAdminRole = userRole.includes('admin') || userRole === 'super_admin';
          
          // Also check custom claims if available (from Firebase Auth token)
          const hasAdminClaims = currentUser?.customClaims?.admin === true || 
                                currentUser?.customClaims?.superAdmin === true;
          
          // Check if Firebase Auth user record has admin claims
          let tokenAdminClaims = false;
          try {
            const idToken = await currentUser.getIdToken();
            const tokenPayload = JSON.parse(atob(idToken.split('.')[1]));
            tokenAdminClaims = tokenPayload.admin === true || tokenPayload.superAdmin === true;
          } catch (tokenError) {
            console.warn('Could not parse token for admin claims:', tokenError);
          }
          
          const isAdmin = hasAdminRole || hasAdminClaims || tokenAdminClaims;
          
          console.log('🔍 [EMPLOYEE_PROFILE] Admin status check:', {
            userId: currentUser.uid,
            role: userRole,
            hasAdminRole,
            hasAdminClaims,
            tokenAdminClaims,
            isAdmin,
            profileRole: userData?.profile?.role,
            rootRole: userData?.role
          });
          
          setIsAdminUser(isAdmin);
        } else {
          console.warn('🔍 [EMPLOYEE_PROFILE] Current user data not found in database');
          setIsAdminUser(false);
        }
      } catch (error) {
        console.error('🔍 [EMPLOYEE_PROFILE] Error checking admin status:', error);
        setIsAdminUser(false);
      } finally {
        setAdminCheckComplete(true);
      }
    };

    if (employeeId) {
      checkUserPermissions();
    }
  }, [auth, employeeId]);

  // Control form input changes
  const handleInputChange = (e) => {
    const { name, type, checked, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle sending a password reset email (for admin use)
  const handleSendPasswordReset = async () => {
    try {
      if (!formData.email) {
        showNotification('Email address is required to send password reset', 'error');
        return;
      }
      
      await sendPasswordResetEmail(auth, formData.email);
      showNotification(`Password reset email sent to ${formData.email}`, 'success');
    } catch (error) {
      console.error('Error sending password reset:', error);
      
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No Firebase Auth user found with this email address';
      }
      
      showNotification(errorMessage, 'error');
    }
  };

  // Handle Padrino status (toggle)
  const handlePadrinoChange = async (e) => {
    const { checked } = e.target;
    try { 
      let updates = { padrino: checked };

      // If enabling Padrino, attempt to auto-calc color
      if (checked) {
        const padrinoStatus = calculatePadrinoColor(employeeDetails);
        updates.padrinoColor = padrinoStatus.eligible ? padrinoStatus.color : 'blue';
        updates.padrinoColorCode = padrinoStatus.eligible ? padrinoStatus.color : 'blue';
      } else {
        // If disabling, just keep color in DB or default to 'blue'
        updates.padrinoColor = formData.padrinoColorCode || 'blue';
        updates.padrinoColorCode = formData.padrinoColorCode || 'blue';
      }

      await update(ref(database, `users/${employeeId}/profile`), updates);
      setFormData((prev) => ({ ...prev, ...updates }));
      showNotification('Padrino status updated successfully');
    } catch (err) {
      console.error('Error updating padrino status:', err);
      showNotification('Failed to update padrino status', 'error');
    }
  };

  // Handle Padrino color selection. A colour picked by hand is marked
  // manualColorOverride, so the automatic colour never replaces it; the
  // Auto-calculate option passes `auto: true` and clears the mark.
  // Memoized: the Auto-calculate effect depends on it, and a new function on
  // every render made that effect save again after each save.
  const handlePadrinoColorChange = useCallback(async (e) => {
    const { value } = e.target;
    const manualColorOverride = !e.auto;
    try {
      await update(ref(database, `users/${employeeId}/profile`), {
        padrinoColor: value,
        padrinoColorCode: value,
        manualColorOverride,
      });
      setFormData((prev) => ({ ...prev, padrinoColorCode: value, manualColorOverride }));
      showNotification('Padrino color updated successfully');
    } catch (err) {
      console.error('Error updating padrino color:', err);
      showNotification('Failed to update padrino color', 'error');
    }
  }, [employeeId, showNotification]);

  // 🔥 ENHANCED: Handle save - this will be called by PersonalInfoSection
  const handleSave = async () => {
    console.log('💾 [EMPLOYEE_PROFILE] Save called from PersonalInfoSection');
    
    // The PersonalInfoSection handles the actual saving logic
    // This is just for any additional parent-level logic
    try {
      // Refresh employee details after save
      await fetchEmployeeDetails();
      
      // Exit edit mode after successful save
      setEditMode(false);
      
      console.log('✅ [EMPLOYEE_PROFILE] Save completed, edit mode disabled');
    } catch (error) {
      console.error('❌ [EMPLOYEE_PROFILE] Error in parent save handler:', error);
    }
  };

  // 🔥 FIXED: Handle edit mode toggle
  const handleEditToggle = () => {
    console.log('✏️ [EMPLOYEE_PROFILE] Edit mode toggle:', !editMode);
    setEditMode(prev => !prev);
  };

  // 🔥 FIXED: Handle cancel edit
  const handleCancelEdit = () => {
    console.log('❌ [EMPLOYEE_PROFILE] Cancel edit mode');
    setEditMode(false);
    // Reset form data to original values
    if (employeeDetails?.profile) {
      setFormData(profileToForm(employeeDetails.profile, employeeDetails.location));
    }
  };

  // Toggle role between "admin" and "employee"
  const handleRoleToggle = async () => {
    const currentRole = normalizeRole(formData.role);
    if (currentRole === ROLES.SUPER_ADMIN) {
      // The toggle only switches admin/employee; it used to demote super admins.
      showNotification('Change Super Admin roles in Manage Admins', 'error');
      return;
    }
    const newRole = currentRole === ROLES.ADMIN ? ROLES.EMPLOYEE : ROLES.ADMIN;
    try {
      // The server changes the login claim and the stored role together.
      // Only super admins may change roles.
      await setUserRole(employeeId, newRole);
      setFormData((prev) => ({ ...prev, role: newRole }));
      showNotification(`Role updated to ${newRole}`);
    } catch (err) {
      showNotification(`Failed to update role: ${err.message}`, 'error');
    }
  };

  // Toggle status
  const handleStatusToggle = async () => {
    const newStatus = formData.status === 'active' ? 'inactive' : 'active';
    try {
      await update(ref(database, `users/${employeeId}/profile`), {
        status: newStatus,
      });
      setFormData((prev) => ({ ...prev, status: newStatus }));
      showNotification(`Status updated to ${newStatus}`);
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  // Delete an attendance record
  const handleDeleteRecord = async (timestamp) => {
    if (deleteConfirm !== timestamp) {
      setDeleteConfirm(timestamp);
      return;
    }
    try {
      await remove(ref(database, `users/${employeeId}/clockInTimes/${timestamp}`));
      await remove(ref(database, `users/${employeeId}/clockOutTimes/${timestamp}`));

      setDeleteConfirm(null);
      showNotification('Record deleted successfully');
    } catch (err) {
      console.error('Error deleting record:', err);
      showNotification('Failed to delete record', 'error');
    }
  };

  // Fetch employee details
  const fetchEmployeeDetails = useCallback(async () => {
    setLoading(true);
    try {
      const employeeRef = ref(database, `users/${employeeId}`);
      const snapshot = await get(employeeRef);
      if (!snapshot.exists()) {
        throw new Error('Employee not found');
      }
      const data = snapshot.val();
      setEmployeeDetails(data);

      // Set local form data (location comes from profile.locationKey, not
      // primaryLocation, which almost no user has)
      setFormData(profileToForm(data.profile, data.location));

      // Format scheduled dates
      setScheduledDates(formatScheduledDates(data.assignedDates || []));

      // Opening a profile never changes the padrino colour. The calculated
      // colour counts only events the member was scanned into (always 100%
      // attended), so it isn't saved without an admin choosing it (the
      // Auto-calculate option or a colour pick).
    } catch (err) {
      console.error('Error fetching employee details:', err);
      setError(err.message || 'Failed to fetch employee data');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmployeeDetails();
  }, [fetchEmployeeDetails]);

  // Tabs
  const tabs = [
    { id: 'personal', label: 'Personal Information', icon: User },
    { id: 'stats', label: 'Statistics', icon: BarChart2 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];

  // 🔥 UPDATED: Render slide content with proper props and edit controls
  const renderSlideContent = (index, data) => {
    switch (index) {
      case 0:
        return (
          <div className="space-y-6">
            {/* Edit Mode Controls - Only show if user has permission */}
            {(isCurrentUser || isAdminUser) && (
              <div className="flex justify-between items-center p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${editMode ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                  <span className="text-white/80 font-medium">
                    {editMode ? 'Edit Mode Active' : 'View Mode'}
                  </span>
                  {editMode && (
                    <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                      Make changes and click Save
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {!editMode ? (
                    <button
                      onClick={handleEditToggle}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                    >
                      <Edit3 size={16} />
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* PersonalInfoSection with all required props */}
            <PersonalInfoSection
              formData={formData}
              editMode={editMode}
              handleInputChange={handleInputChange}
              userId={employeeId}
              onRoleToggle={handleRoleToggle}
              locations={locations}
              locationsError={locationsError}
              departments={DEPARTMENTS}
              onPadrinoChange={handlePadrinoChange}
              onPadrinoColorChange={handlePadrinoColorChange}
              onSave={handleSave}
              onCancel={handleCancelEdit}
              errors={{}} // You can pass form validation errors here
              userData={employeeDetails}
              isCurrentUser={isCurrentUser}
              isAdminUser={isAdminUser}  // 🔥 CRITICAL - This was missing!
              onSendPasswordReset={handleSendPasswordReset}
              fetchUserData={fetchEmployeeDetails}
            />
          </div>
        );
      case 1:
        return (
          <IdCardSection
            employeeDetails={employeeDetails}
            employeeId={employeeId}
          />
        );
      case 2:
        return (
          <AttendanceSection
            deleteConfirm={deleteConfirm}
            onDeleteRecord={handleDeleteRecord}
            employeeId={employeeId}
          />
        );
      default:
        return null;
    }
  };

  // Prepare slide data for the carousel
  const slideData = {
    formData,
    editMode,
    employeeDetails,
    deleteConfirm,
    employeeId,
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return (
          <EmployeeProfileCarousel
            activeSlide={activeSlide}
            setActiveSlide={setActiveSlide}
            totalSlides={totalPersonalSlides}
            renderSlideContent={renderSlideContent}
            slideData={slideData}
          />
        );
      case 'stats':
        return (
          <div className="glass-panel p-6">
            <StatsSection employeeDetails={employeeDetails} employeeId={employeeId} />
          </div>
        );
      case 'calendar':
        return (
          <div className="glass-panel">
            <ScheduleSection
              employeeId={employeeId}
              employeeDetails={employeeDetails}
            />
          </div>
        );
      default:
        return null;
    }
  };

  // 🔥 Wait for admin check to complete before rendering
  if (!adminCheckComplete) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p>Checking permissions...</p>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p>Loading employee details...</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="error-container glass-panel">
        <p>{error}</p>
        <button onClick={fetchEmployeeDetails} className="btn primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="employee-profile-container">
      {/* Notification banner */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* 🔥 Enhanced Debug Panel */}
      <div className="mb-4 p-4 bg-slate-800/50 rounded-lg text-sm text-white/70 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <strong className="text-white">User Permissions:</strong>
            <div className="mt-1 space-y-1">
              <div>Current User: <span className={isCurrentUser ? 'text-green-400' : 'text-red-400'}>{isCurrentUser ? 'Yes' : 'No'}</span></div>
              <div>Admin User: <span className={isAdminUser ? 'text-green-400' : 'text-red-400'}>{isAdminUser ? 'Yes' : 'No'}</span></div>
              <div>Can Edit: <span className={(isCurrentUser || isAdminUser) ? 'text-green-400' : 'text-red-400'}>{(isCurrentUser || isAdminUser) ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
          <div>
            <strong className="text-white">Profile State:</strong>
            <div className="mt-1 space-y-1">
              <div>Profile ID: <span className="text-blue-400">{employeeId}</span></div>
              <div>Current User ID: <span className="text-blue-400">{auth.currentUser?.uid || 'None'}</span></div>
              <div>Edit Mode: <span className={editMode ? 'text-green-400' : 'text-gray-400'}>{editMode ? 'Active' : 'Inactive'}</span></div>
              <div>Role: <span className="text-yellow-400">{currentUserData?.profile?.role || currentUserData?.role || 'None'}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Header (with Edit/Save & Status toggles) */}
      <ProfileHeader
        formData={formData}
        editMode={editMode}
        employeeId={employeeId}
        onEdit={handleEditToggle}
        onSave={handleSave}
        onStatusToggle={handleStatusToggle}
        handleInputChange={handleInputChange}
      />

      {/* Tab Navigation */}
      <div className="bg-glass-dark backdrop-blur border border-glass-light rounded-lg mt-6 mb-6">
        <div className="p-2 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="tab-content glass-panel">{renderTabContent()}</div>
    </div>
  );
};

export default EmployeeProfile;
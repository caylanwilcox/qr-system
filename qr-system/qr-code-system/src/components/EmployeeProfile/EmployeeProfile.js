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
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { database } from '../../services/firebaseConfig';

import {
  formatScheduledDates,
} from '../utils/employeeUtils';
import { calculatePadrinoColor } from '../utils/padrinoColorCalculator';

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

const LOCATIONS = [
  'Aurora',
  'Agua Viva West Chicago',
  'Agua Viva Lyons',
  'Agua Viva Elgin R7',
  'Agua Viva Joliet',
  'Agua Viva Wheeling',
  'Retreat',
];

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

const INITIAL_STATS = {
  attendanceRate: 0,
  punctualityRate: 0,
  totalHours: 0,
  avgHoursPerDay: 0,
  previousMonthHours: 0,
  hoursChange: 0,
  perfectStreak: 0,
  earlyArrivalRate: 0,
  mostActiveDay: '',
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
  const [scheduledDates, setScheduledDates] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  // 🔥 CRITICAL: User permission states
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);
  
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
    
    // Debug logging for password changes
    if (name === 'password') {
      console.log('🔑 [EMPLOYEE_PROFILE] Password field changed:', {
        name,
        hasValue: !!value,
        length: value?.length || 0,
        preview: value ? value.substring(0, 3) + '***' : 'empty'
      });
    }
    
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

  // Handle Padrino color selection
  const handlePadrinoColorChange = async (e) => {
    const { value } = e.target;
    try {
      await update(ref(database, `users/${employeeId}/profile`), { padrinoColor: value, padrinoColorCode: value });
      setFormData((prev) => ({ ...prev, padrinoColorCode: value }));
      showNotification('Padrino color updated successfully');
    } catch (err) {
      console.error('Error updating padrino color:', err);
      showNotification('Failed to update padrino color', 'error');
    }
  };

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
      setFormData({
        name: employeeDetails.profile?.name || '',
        username: employeeDetails.profile?.username || '',
        email: employeeDetails.profile?.email || '',
        phone: employeeDetails.profile?.phone || '',
        position: employeeDetails.profile?.position || '',
        department: employeeDetails.profile?.department || '',
        location: employeeDetails.profile?.primaryLocation || '',
        joinDate: employeeDetails.profile?.joinDate || '',
        role: employeeDetails.profile?.role || 'employee',
        status: employeeDetails.profile?.status || 'inactive',
        emergencyContact: employeeDetails.profile?.emergencyContact || '',
        emergencyPhone: employeeDetails.profile?.emergencyPhone || '',
        notes: employeeDetails.profile?.notes || '',
        padrino: employeeDetails.profile?.padrino ?? false,
        padrinoColor: employeeDetails.profile?.padrinoColor || 'blue',
        padrinoColorCode: employeeDetails.profile?.padrinoColorCode || 'blue',
        service: employeeDetails.profile?.service || '',
        password: '', // Always clear password field
      });
    }
  };

  // Toggle role between "admin" and "employee"
  const handleRoleToggle = async () => {
    const newRole = formData.role === 'admin' ? 'employee' : 'admin';
    try {
      await update(ref(database, `users/${employeeId}/profile`), { role: newRole });
      setFormData((prev) => ({ ...prev, role: newRole }));
      showNotification(`Role updated to ${newRole}`);
    } catch (err) {
      showNotification('Failed to update role', 'error');
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

      // Set local form data
      setFormData({
        name: data.profile?.name || '',
        username: data.profile?.username || '',
        email: data.profile?.email || '',
        phone: data.profile?.phone || '',
        position: data.profile?.position || '',
        department: data.profile?.department || '',
        location: data.profile?.primaryLocation || '',
        joinDate: data.profile?.joinDate || '',
        role: data.profile?.role || 'employee',
        status: data.profile?.status || 'inactive',
        emergencyContact: data.profile?.emergencyContact || '',
        emergencyPhone: data.profile?.emergencyPhone || '',
        notes: data.profile?.notes || '',
        padrino: data.profile?.padrino || false,
        padrinoColor: data.profile?.padrinoColorCode || 'blue',
        padrinoColorCode: data.profile?.padrinoColorCode || 'blue',
        service: data.profile?.service || '',
        password: '', // Always start with empty password
      });

      // Format scheduled dates
      setScheduledDates(formatScheduledDates(data.assignedDates || []));

      // Auto-update padrino color if needed
      if (data.profile?.padrino && data.events) {
        const padrinoStatus = calculatePadrinoColor(data);
        if (
          padrinoStatus.color &&
          padrinoStatus.color !== data.profile?.padrinoColor
        ) {
          await update(ref(database, `users/${employeeId}/profile`), {
            padrinoColor: padrinoStatus.color,
            padrinoColorCode: padrinoStatus.color,
          });
          setFormData((prev) => ({
            ...prev,
            padrinoColor: padrinoStatus.color,
            padrinoColorCode: padrinoStatus.color,
          }));
          console.log(`Auto-updated padrino color to ${padrinoStatus.color}`);
        }
      }
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
              locations={LOCATIONS}
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
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
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { database } from '../../services/firebaseConfig';

import {
  formatAttendanceRecords,
  calculateStats,
  formatScheduledDates,
} from '../utils/employeeUtils';
import { calculatePadrinoColor } from '../utils/padrinoColorCalculator';

import './styles/EmployeeProfile.css';
import { User, BarChart2, Calendar } from 'lucide-react';

// Import your subcomponents:
import ProfileHeader from './ProfileHeader';
import PersonalInfoSection from './PersonalInfoSection';
import StatsSection from './StatsSection';
import AttendanceSection from './AttendanceSection';
import ScheduleSection from './ScheduleSection';
import IdCardSection from './IdCardSection';

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
  padrinoColor: 'red',
  service: '',
  password: '',
  currentPassword: '', // For local re-auth
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
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [activeTab, setActiveTab] = useState('personal');
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [scheduledDates, setScheduledDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');

  // Dialog for re-auth (when a current user changes their own password)
  const [passwordDialog, setPasswordDialog] = useState({
    show: false,
    currentPassword: '',
    error: null,
  });

  // Dialog for creating a brand-new Auth user if none exist for the given email
  const [createUserDialog, setCreateUserDialog] = useState({
    show: false,
    error: null,
  });

  const [isCurrentUser, setIsCurrentUser] = useState(false);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  // Check if the profile belongs to the current user
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === employeeId) {
      setIsCurrentUser(true);
    } else {
      setIsCurrentUser(false);
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

  // Handle Padrino status (toggle)
  const handlePadrinoChange = async (e) => {
    const { checked } = e.target;
    try {
      let updates = { padrino: checked };

      // If enabling Padrino, attempt to auto-calc color
      if (checked) {
        const padrinoStatus = calculatePadrinoColor(employeeDetails);
        updates.padrinoColor = padrinoStatus.eligible ? padrinoStatus.color : 'red';
      } else {
        // If disabling, just keep color in DB or default to 'red'
        updates.padrinoColor = formData.padrinoColor || 'red';
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
      await update(ref(database, `users/${employeeId}/profile`), { padrinoColor: value });
      setFormData((prev) => ({ ...prev, padrinoColor: value }));
      showNotification('Padrino color updated successfully');
    } catch (err) {
      console.error('Error updating padrino color:', err);
      showNotification('Failed to update padrino color', 'error');
    }
  };

  // Re-auth dialog input
  const handlePasswordDialogChange = (e) => {
    setPasswordDialog((prev) => ({
      ...prev,
      currentPassword: e.target.value,
      error: null,
    }));
  };

  // Confirm changing password for the currently logged-in user
  const handlePasswordDialogSubmit = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setPasswordDialog((prev) => ({
        ...prev,
        error: 'No current user authenticated. Please log in again.',
      }));
      return;
    }

    try {
      // Re-auth with current password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordDialog.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update Auth password
      await updatePassword(currentUser, formData.password);

      // (Optional) Update RTDB profile password - caution storing plain text
      await update(ref(database, `users/${employeeId}/profile`), {
        password: formData.password,
      });

      setPasswordDialog({ show: false, currentPassword: '', error: null });
      // Clear the password from formData to avoid confusion
      setFormData((prev) => ({ ...prev, password: '' }));

      showNotification('Password updated successfully');
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordDialog((prev) => ({
        ...prev,
        error:
          error?.message ||
          'Current password is incorrect or authentication failed',
      }));
    }
  };

  // Cancel re-auth dialog
  const handlePasswordDialogCancel = () => {
    setPasswordDialog({ show: false, currentPassword: '', error: null });
  };

  // Confirm creation of a brand-new Auth user if none exist
  const handleCreateUserConfirm = async () => {
    setCreateUserDialog((prev) => ({ ...prev, error: null }));

    try {
      // Create new user with email & password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // You can store the new user’s UID in the employee’s profile if needed
      await update(ref(database, `users/${employeeId}/profile`), {
        authUid: userCredential.user.uid,
        password: formData.password,
      });

      setCreateUserDialog({ show: false, error: null });
      showNotification(`New Auth user created: ${formData.email}`);
      setFormData((prev) => ({ ...prev, password: '' }));
    } catch (err) {
      console.error('Error creating new user:', err);
      setCreateUserDialog((prev) => ({
        ...prev,
        error: err?.message || 'Failed to create new Auth user.',
      }));
    }
  };

  const handleCreateUserCancel = () => {
    setCreateUserDialog({ show: false, error: null });
  };

  // Main "Save" for the entire personal info form
  const handleSave = async () => {
    // Build our updates for RTDB
    const updates = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      position: formData.position,
      department: formData.department,
      primaryLocation: formData.location,
      joinDate: formData.joinDate,
      role: formData.role,
      status: formData.status,
      emergencyContact: formData.emergencyContact,
      emergencyPhone: formData.emergencyPhone,
      notes: formData.notes,
      padrino: formData.padrino,
      padrinoColor: formData.padrinoColor,
      service: formData.service,
    };

    try {
      // Check if the user typed a new password
      if (formData.password && formData.password.trim() !== '') {
        // 1) Check if there is an existing Auth user for the given email
        const signInMethods = await fetchSignInMethodsForEmail(
          auth,
          formData.email
        );

        // If no sign-in methods (no existing user):
        if (signInMethods.length === 0) {
          // Show a dialog to create a brand new user in Firebase Auth
          setCreateUserDialog({ show: true, error: null });
        } else {
          // If sign-in methods exist, we have a user in Auth
          //   If it's the *current* user, we do re-auth with old password
          //   If it’s an admin editing someone else, we only update RTDB
          if (isCurrentUser) {
            // Let the user confirm re-auth
            setPasswordDialog({ show: true, currentPassword: '', error: null });
            // Return so the "re-auth" step can do the actual password update
            return;
          } else {
            // For an admin editing another user
            updates.password = formData.password;
            showNotification(
              'Database password updated. Auth password not changed.',
              'warning'
            );
          }
        }
      }

      // Update the user’s profile in RTDB
      await update(ref(database, `users/${employeeId}/profile`), updates);

      // Update local details
      setEmployeeDetails((prev) => ({
        ...prev,
        profile: { ...prev?.profile, ...updates },
      }));

      // Exit edit mode
      setEditMode(false);
      showNotification('Profile updated successfully');
    } catch (err) {
      console.error('Save error:', err);
      showNotification('Failed to save changes', 'error');
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

      setAttendanceRecords((prev) =>
        prev.filter((record) => record.timestamp !== timestamp)
      );
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

      // Format attendance
      const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
      setAttendanceRecords(records);
      setStats(calculateStats(records));

      // Set local form data
      setFormData({
        name: data.profile?.name || '',
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
        padrino: data.profile?.padrino ?? false,
        padrinoColor: data.profile?.padrinoColor || 'red',
        service: data.profile?.service || '',
        password: '',
        currentPassword: '',
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
          });
          setFormData((prev) => ({
            ...prev,
            padrinoColor: padrinoStatus.color,
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'personal':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6">
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
                onCancel={() => setEditMode(false)}
                errors={{}} // You can pass form validation errors here
                userData={employeeDetails}
                isCurrentUser={isCurrentUser}
              />
            </div>

            <div className="glass-panel p-6">
              <IdCardSection
                employeeDetails={employeeDetails}
                employeeId={employeeId}
              />
            </div>

            <div className="glass-panel p-6">
              <AttendanceSection
                attendanceRecords={attendanceRecords}
                deleteConfirm={deleteConfirm}
                onDeleteRecord={handleDeleteRecord}
                employeeId={employeeId}
              />
            </div>
          </div>
        );
      case 'stats':
        return (
          <div className="glass-panel p-6">
            <StatsSection employeeDetails={employeeDetails} />
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

      {/* Re-Auth Dialog for updating password when user is current user */}
      {passwordDialog.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              Confirm Password Change
            </h3>
            <p className="text-white/70 mb-4">
              For security, please enter your current password to confirm.
            </p>

            {passwordDialog.error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500/30 rounded-md text-red-300">
                {passwordDialog.error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-white/80 mb-2">Current Password</label>
              <input
                type="password"
                value={passwordDialog.currentPassword}
                onChange={handlePasswordDialogChange}
                className="w-full rounded-md bg-slate-700 border border-white/10 px-3 py-2 text-white"
                placeholder="Enter your current password"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handlePasswordDialogCancel}
                className="px-4 py-2 rounded-md border border-white/20 text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordDialogSubmit}
                className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New User Dialog (if no existing Auth record) */}
      {createUserDialog.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              Create New Auth User
            </h3>
            <p className="text-white/70 mb-4">
              No existing user found for <strong>{formData.email}</strong>.
              Would you like to create a new Firebase Auth account with this
              email and the password you entered?
            </p>

            {createUserDialog.error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500/30 rounded-md text-red-300">
                {createUserDialog.error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCreateUserCancel}
                className="px-4 py-2 rounded-md border border-white/20 text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUserConfirm}
                className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-500"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header (with Edit/Save & Status toggles) */}
      <ProfileHeader
        formData={formData}
        editMode={editMode}
        employeeId={employeeId}
        onEdit={() => setEditMode((prev) => !prev)}
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
      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default EmployeeProfile;

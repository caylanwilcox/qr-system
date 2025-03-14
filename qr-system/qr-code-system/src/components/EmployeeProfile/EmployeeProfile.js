'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update, remove } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { formatAttendanceRecords, calculateStats, formatScheduledDates } from '../utils/employeeUtils';
import './styles/EmployeeProfile.css';
import { User, BarChart2, Calendar } from 'lucide-react';

import ProfileHeader from './ProfileHeader';
import PersonalInfoSection from './PersonalInfoSection';
import StatsSection from './StatsSection';
import AttendanceSection from './AttendanceSection';
import ScheduleSection from './ScheduleSection';
import IdCardSection from './IdCardSection';

const LOCATIONS = [
  'Aurora', 'Agua Viva West Chicago', 'Agua Viva Lyons',
  'Agua Viva Elgin R7', 'Agua Viva Joliet', 'Agua Viva Wheeling', 'Retreat',
];

const DEPARTMENTS = [
  'Main Church', 'Youth Ministry', 'Kids Ministry',
  'Music Ministry', 'Administration',
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
  padrinoColor: null,
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

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  const handleInputChange = (e) => {
    const { name, type, checked, value } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));
  };

  // Note: When updating profile-related fields, use the '/profile' subnode
  const handlePadrinoChange = async (e) => {
    const { checked } = e.target;
    try {
      const updates = {
        padrino: checked,
        padrinoColor: checked ? formData.padrinoColor : null
      };
      await update(ref(database, `users/${employeeId}/profile`), updates);
      setFormData(prev => ({ ...prev, ...updates }));
      showNotification('Padrino status updated successfully');
    } catch (err) {
      console.error('Error updating padrino status:', err);
      showNotification('Failed to update padrino status', 'error');
    }
  };

  const handlePadrinoColorChange = async (e) => {
    const { value } = e.target;
    try {
      await update(ref(database, `users/${employeeId}/profile`), { padrinoColor: value });
      setFormData(prev => ({ ...prev, padrinoColor: value }));
      showNotification('Padrino color updated successfully');
    } catch (err) {
      console.error('Error updating padrino color:', err);
      showNotification('Failed to update padrino color', 'error');
    }
  };

  const handleSave = async () => {
    try {
      const updates = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        position: formData.position,
        department: formData.department,
        primaryLocation: formData.location, // new field in profile
        joinDate: formData.joinDate,
        role: formData.role,
        status: formData.status,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        notes: formData.notes,
        padrino: formData.padrino,
        padrinoColor: formData.padrinoColor,
      };

      await update(ref(database, `users/${employeeId}/profile`), updates);
      setEmployeeDetails(prev => ({
        ...prev,
        profile: { ...prev.profile, ...updates }
      }));
      setEditMode(false);
      showNotification('Changes saved successfully');
    } catch (err) {
      console.error('Save error:', err);
      showNotification('Failed to save changes', 'error');
    }
  };

  const handleRoleToggle = async () => {
    const newRole = formData.role === 'admin' ? 'employee' : 'admin';
    try {
      await update(ref(database, `users/${employeeId}/profile`), { role: newRole });
      setFormData(prev => ({ ...prev, role: newRole }));
      showNotification(`Role updated to ${newRole}`);
    } catch (err) {
      showNotification('Failed to update role', 'error');
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = formData.status === 'active' ? 'inactive' : 'active';
    try {
      await update(ref(database, `users/${employeeId}/profile`), { status: newStatus });
      setFormData(prev => ({ ...prev, status: newStatus }));
      showNotification(`Status updated to ${newStatus}`);
    } catch (err) {
      showNotification('Failed to update status', 'error');
    }
  };

  const handleDeleteRecord = async (timestamp) => {
    if (deleteConfirm !== timestamp) {
      setDeleteConfirm(timestamp);
      return;
    }
    try {
      await remove(ref(database, `users/${employeeId}/clockInTimes/${timestamp}`));
      await remove(ref(database, `users/${employeeId}/clockOutTimes/${timestamp}`));
      setAttendanceRecords(prev => prev.filter(record => record.timestamp !== timestamp));
      setDeleteConfirm(null);
      showNotification('Record deleted successfully');
    } catch (err) {
      console.error('Error deleting record:', err);
      showNotification('Failed to delete record', 'error');
    }
  };

  // Fetch employee details from the new structure
  const fetchEmployeeDetails = useCallback(async () => {
    try {
      const employeeRef = ref(database, `users/${employeeId}`);
      const snapshot = await get(employeeRef);
      if (!snapshot.exists()) {
        throw new Error('Employee not found');
      }
      const data = snapshot.val();
      setEmployeeDetails(data);

      // Process attendance records if still stored under these keys;
      // adjust these calls if attendance data has been moved.
      const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
      setAttendanceRecords(records);
      const calculatedStats = calculateStats(records);
      setStats(calculatedStats);

      // Set form data from the profile node
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
        padrinoColor: data.profile?.padrinoColor || null,
      });

      // If scheduled dates have been migrated, adjust accordingly:
      const formattedDates = formatScheduledDates(data.assignedDates || []);
      setScheduledDates(formattedDates);
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
                onRoleToggle={handleRoleToggle}
                locations={LOCATIONS}
                departments={DEPARTMENTS}
                onPadrinoChange={handlePadrinoChange}
                onPadrinoColorChange={handlePadrinoColorChange}
              />
            </div>
            <div className="glass-panel p-6">
              <IdCardSection employeeDetails={employeeDetails} employeeId={employeeId} />
            </div>
            <div className="glass-panel p-6">
              <AttendanceSection
                attendanceRecords={attendanceRecords}
                deleteConfirm={deleteConfirm}
                onDeleteRecord={handleDeleteRecord}
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
            <ScheduleSection employeeId={employeeId} employeeDetails={employeeDetails} />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p>Loading employee details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container glass-panel">
        <p>{error}</p>
        <button onClick={fetchEmployeeDetails} className="btn primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="employee-profile-container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <ProfileHeader
        formData={formData}
        editMode={editMode}
        employeeId={employeeId}
        onEdit={() => setEditMode(!editMode)}
        onSave={handleSave}
        onStatusToggle={handleStatusToggle}
        handleInputChange={handleInputChange}
      />

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

      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default EmployeeProfile;

import React, { useState, useEffect, useCallback } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { formatAttendanceRecords, calculateStats, formatScheduledDates } from '../utils/employeeUtils';
import { User, BarChart2, Calendar } from 'lucide-react';

import ProfileHeader from './ProfileHeader';
import PersonalInfoSection from './PersonalInfoSection';
import StatsSection from './StatsSection';
import AttendanceSection from './AttendanceSection';
import ScheduleSection from './ScheduleSection';
import IdCardSection from './IdCardSection';

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

const UserDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [activeTab, setActiveTab] = useState('personal');
  const [userDetails, setUserDetails] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [scheduledDates, setScheduledDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  const fetchUserDetails = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
        throw new Error('User data not found');
      }

      const data = snapshot.val();
      setUserDetails(data);

      const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
      setAttendanceRecords(records);

      const calculatedStats = calculateStats(records);
      setStats(calculatedStats);

      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        position: data.position || '',
        department: data.department || '',
        location: data.location || '',
        joinDate: data.joinDate || '',
        role: data.role || 'employee',
        status: data.status || 'inactive',
        emergencyContact: data.emergencyContact || '',
        emergencyPhone: data.emergencyPhone || '',
        notes: data.notes || '',
        padrino: data.padrino ?? false,
        padrinoColor: data.padrinoColor || null,
      });

      const formattedDates = formatScheduledDates(data.assignedDates || []);
      setScheduledDates(formattedDates);
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError(err.message || 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

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
                editMode={false}
                handleInputChange={() => {}}
              />
            </div>
            <div className="glass-panel p-6">
              <IdCardSection userDetails={userDetails} userId={auth.currentUser?.uid} />
            </div>
            <div className="glass-panel p-6">
              <AttendanceSection
                attendanceRecords={attendanceRecords}
                deleteConfirm={null}
                onDeleteRecord={() => {}}
              />
            </div>
          </div>
        );
      case 'stats':
        return (
          <div className="glass-panel p-6">
            <StatsSection userDetails={userDetails} />
          </div>
        );
      case 'calendar':
        return (
          <div className="glass-panel">
            <ScheduleSection userId={auth.currentUser?.uid} userDetails={userDetails} />
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
        <p>Loading user details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container glass-panel">
        <p>{error}</p>
        <button onClick={fetchUserDetails} className="btn primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="user-dashboard-container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <ProfileHeader
        formData={formData}
        editMode={false}
        employeeId={auth.currentUser?.uid}
        onEdit={() => {}}
        onSave={() => {}}
        onStatusToggle={() => {}}
        handleInputChange={() => {}}
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

export default UserDashboard;
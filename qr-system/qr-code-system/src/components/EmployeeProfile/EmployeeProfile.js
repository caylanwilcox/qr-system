import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update, remove } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { formatAttendanceRecords, calculateStats, formatScheduledDates } from '../utils/employeeUtils';
import './styles/EmployeeProfile.css';
import { User, BarChart2, Calendar } from 'lucide-react';

// Component Imports
import ProfileHeader from './ProfileHeader';
import PersonalInfoSection from './PersonalInfoSection';
import StatsSection from './StatsSection';
import AttendanceSection from './AttendanceSection';
import ScheduleSection from './ScheduleSection';
import IdCardSection from './IdCardSection';

// Constants
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
  'Main Church',
  'Youth Ministry',
  'Kids Ministry',
  'Music Ministry',
  'Administration',
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
  
  // State Management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notification, setNotification] = useState({ 
    show: false, 
    message: '', 
    type: '' 
  });
  const [activeTab, setActiveTab] = useState('personal');

  const tabs = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User,
    },
    {
      id: 'stats',
      label: 'Statistics',
      icon: BarChart2,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
    },
  ];

  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [scheduledDates, setScheduledDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  
  // Schedule state
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');

  // Notification handler
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  // Data fetching
  const fetchEmployeeDetails = useCallback(async () => {
    try {
      const employeeRef = ref(database, `users/${employeeId}`);
      const snapshot = await get(employeeRef);

      if (!snapshot.exists()) {
        throw new Error('Employee not found');
      }

      const data = snapshot.val();
      setEmployeeDetails(data);

      // Process attendance records
      const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
      setAttendanceRecords(records);

      // Calculate employee stats
      const calculatedStats = calculateStats(records);
      setStats(calculatedStats);

      // Set form data
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
      });

      // Process scheduled dates
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

  // Form handlers
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSave = async () => {
    try {
      await update(ref(database, `users/${employeeId}`), formData);
      setEmployeeDetails(prev => ({
        ...prev,
        ...formData
      }));
      setEditMode(false);
      showNotification('Changes saved successfully');
    } catch (err) {
      showNotification('Failed to save changes', 'error');
    }
  };

  const handleRoleToggle = async () => {
    const newRole = formData.role === 'admin' ? 'employee' : 'admin';
    try {
      await update(ref(database, `users/${employeeId}`), { role: newRole });
      setFormData(prev => ({
        ...prev,
        role: newRole
      }));
      showNotification(`Role updated to ${newRole}`);
    } catch (err) {
      showNotification('Failed to update role', 'error');
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = formData.status === 'active' ? 'inactive' : 'active';
    try {
      await update(ref(database, `users/${employeeId}`), { status: newStatus });
      setFormData(prev => ({
        ...prev,
        status: newStatus
      }));
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
      
      setAttendanceRecords(prev => 
        prev.filter(record => record.timestamp !== timestamp)
      );
      setDeleteConfirm(null);
      showNotification('Record deleted successfully');
    } catch (err) {
      showNotification('Failed to delete record', 'error');
    }
  };

  const handleScheduleAdd = async () => {
    if (!newScheduleDate || !newScheduleTime) {
      showNotification('Please select both date and time', 'error');
      return;
    }

    try {
      const newSchedules = [...scheduledDates, {
        date: newScheduleDate,
        time: newScheduleTime,
        status: 'scheduled'
      }].sort((a, b) => new Date(a.date) - new Date(b.date));

      await update(ref(database, `users/${employeeId}`), {
        assignedDates: newSchedules.map(s => s.date)
      });

      setScheduledDates(newSchedules);
      setNewScheduleDate('');
      setNewScheduleTime('');
      showNotification('Schedule added successfully');
    } catch (err) {
      showNotification('Failed to add schedule', 'error');
    }
  };

  // Loading and error states
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
        <button onClick={fetchEmployeeDetails} className="btn primary">
          Retry
        </button>
      </div>
    );
  }

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
              />
            </div>
          </div>
        );
      
      case 'stats':
        return (
          <div className="glass-panel p-6">
            <StatsSection stats={stats} />
          </div>
        );
      
      case 'calendar':
        return (
          <div className="glass-panel">
            <ScheduleSection
              scheduledDates={scheduledDates}
              attendanceRecords={attendanceRecords}
              onScheduleAdd={handleScheduleAdd}
              newScheduleDate={newScheduleDate}
              newScheduleTime={newScheduleTime}
              setNewScheduleDate={setNewScheduleDate}
              setNewScheduleTime={setNewScheduleTime}
            />
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
        <button onClick={fetchEmployeeDetails} className="btn primary">
          Retry
        </button>
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

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default EmployeeProfile;
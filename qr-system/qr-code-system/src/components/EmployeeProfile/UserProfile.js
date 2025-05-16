import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { database, auth } from '../../services/firebaseConfig';
import { formatAttendanceRecords, calculateStats, formatScheduledDates } from '../utils/employeeUtils';
import { User, BarChart2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

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
               transition-all duration-200 flex-1 justify-center ${
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
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [userDetails, setUserDetails] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [scheduledDates, setScheduledDates] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [editMode, setEditMode] = useState(false);
  const carouselRef = useRef(null);

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'stats', label: 'Statistics', icon: BarChart2 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];

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

      // Extract profile data from the correct path
      const profile = data.profile || {};
      
      const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
      setAttendanceRecords(records);

      const calculatedStats = calculateStats(records);
      setStats(calculatedStats);

      setFormData({
        name: profile.name || data.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        position: profile.position || '',
        department: profile.department || '',
        location: profile.primaryLocation || profile.location || data.location || '',
        joinDate: profile.joinDate || '',
        role: profile.role || data.role || 'employee',
        status: profile.status || data.status || 'inactive',
        emergencyContact: profile.emergencyContact?.name || '',
        emergencyPhone: profile.emergencyContact?.phone || '',
        notes: profile.notes || '',
        padrino: profile.padrino ?? false,
        padrinoColor: profile.padrinoColor || null,
        service: profile.service || '',
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePadrinoChange = (e) => {
    setFormData(prev => ({ ...prev, padrino: e.target.checked }));
  };

  const handlePadrinoColorChange = (e) => {
    setFormData(prev => ({ ...prev, padrinoColor: e.target.value }));
  };

  const handleSave = async () => {
    // Implementation for saving the form data
    showNotification("Profile updated successfully");
    setEditMode(false);
    await fetchUserDetails(); // Refresh data
  };

  // Navigate to next/previous tab
  const navigateTab = (direction) => {
    let newIndex = activeTabIndex + direction;
    
    // Loop around if out of bounds
    if (newIndex < 0) newIndex = tabs.length - 1;
    if (newIndex >= tabs.length) newIndex = 0;
    
    setActiveTabIndex(newIndex);
  };

  // Render all tab contents but only show the active one
  const renderTabContents = () => {
    return (
      <div className="relative overflow-hidden" ref={carouselRef}>
        <div 
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${activeTabIndex * 100}%)` }}
        >
          {/* Personal Tab */}
          <div className="w-full flex-shrink-0">
            <PersonalInfoSection
              formData={formData}
              editMode={editMode}
              handleInputChange={handleInputChange}
              errors={{}}
              onSave={handleSave}
              onCancel={() => setEditMode(false)}
              userId={auth.currentUser?.uid}
              userData={userDetails}
              isCurrentUser={true}
              fetchUserData={fetchUserDetails}
              onPadrinoChange={handlePadrinoChange}
              onPadrinoColorChange={handlePadrinoColorChange}
              serviceTypes={[]}
              positions={[]}
              locations={[]}
              departments={[]}
            />
            {/* ID Card section at the bottom of personal tab */}
            <div className="glass-panel p-6 mt-6">
              <IdCardSection userDetails={userDetails} userId={auth.currentUser?.uid} />
            </div>
          </div>

          {/* Stats Tab */}
          <div className="w-full flex-shrink-0">
            <div className="glass-panel p-6 w-full">
              <StatsSection userDetails={userDetails} />
              <div className="mt-6">
                <AttendanceSection
                  attendanceRecords={attendanceRecords}
                  deleteConfirm={null}
                  onDeleteRecord={() => {}}
                />
              </div>
            </div>
          </div>

          {/* Calendar Tab */}
          <div className="w-full flex-shrink-0">
            <div className="glass-panel w-full">
              <ScheduleSection userId={auth.currentUser?.uid} userDetails={userDetails} />
            </div>
          </div>
        </div>
      </div>
    );
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
    <div className="user-dashboard-container max-w-6xl mx-auto px-4">
      {notification.show && (
        <div className={`notification fixed top-4 right-4 z-50 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white shadow-lg`}>
          {notification.message}
        </div>
      )}

      <ProfileHeader
        formData={formData}
        editMode={editMode}
        employeeId={auth.currentUser?.uid}
        onEdit={() => setEditMode(true)}
        onSave={handleSave}
        onStatusToggle={() => {}}
        handleInputChange={handleInputChange}
      />

      {/* Carousel-style tab navigation */}
      <div className="bg-glass-dark backdrop-blur border border-glass-light rounded-lg mt-6 mb-6 flex items-center">
        <button 
          onClick={() => navigateTab(-1)}
          className="p-3 text-white/70 hover:text-white hover:bg-white/5 rounded-l-lg"
          aria-label="Previous tab"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="flex-1 flex">
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.id}
              active={activeTabIndex === index}
              onClick={() => setActiveTabIndex(index)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>
        
        <button 
          onClick={() => navigateTab(1)}
          className="p-3 text-white/70 hover:text-white hover:bg-white/5 rounded-r-lg"
          aria-label="Next tab"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Full-width carousel content */}
      {renderTabContents()}
    </div>
  );
};

export default UserDashboard;
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { 
  User, BarChart2, Calendar, Award, Shield, Clock, 
  ChevronUp, ChevronDown, MapPin, LogOut, Edit,
  CheckCircle
} from 'lucide-react';

// Import utility functions
import {
  formatAttendanceRecords,
  calculateStats,
  formatScheduledDates,
} from '../utils/employeeUtils';

// Import components
import EmployeeProfileCarousel from '../EmployeeProfile/EmployeeProfileCarousel';
import PersonalInfoSection from '../EmployeeProfile/PersonalInfoSection';
import IdCardSection from '../EmployeeProfile/IdCardSection';
import AttendanceSection from '../EmployeeProfile/AttendanceSection';
import ScheduleSection from '../EmployeeProfile/ScheduleSection';
import StatsSection from '../EmployeeProfile/StatsSection';

// Import styles
import '../EmployeeProfile/styles/EmployeeProfile.css';
import '../EmployeeProfile/styles/EmployeeProfileCarousel.css';
import './styles/UserDashboard.css';

// Tab Button Component - Updated for darker theme
const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg
               transition-all duration-200 ${
      active
        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
        : 'text-white/70 hover:bg-[#131b31]'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const UserDashboard = ({ initialTab = 'personal' }) => {
  const auth = getAuth();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeSlide, setActiveSlide] = useState(0);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [editMode, setEditMode] = useState(false);
  
  // User data state
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    location: '',
    joinDate: '',
    emergencyContact: '',
    emergencyPhone: '',
    padrino: false,
    padrinoColor: 'blue',
    service: '',
  });
  const [scheduledDates, setScheduledDates] = useState([]);
  const [stats, setStats] = useState({
    attendanceRate: 0,
    punctualityRate: 0,
    totalHours: 0,
    avgHoursPerDay: 0,
    previousMonthHours: 0,
    hoursChange: 0,
    perfectStreak: 0,
    earlyArrivalRate: 0,
    mostActiveDay: '',
  });

  // Total number of slides in personal tab carousel
  const totalPersonalSlides = 3;

  // Notification handler
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  // Fetch current user details
  const fetchUserDetails = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        // If no current user, redirect to login
        navigate('/login');
        return;
      }

      const userId = currentUser.uid;
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        throw new Error('User data not found. Please contact your administrator.');
      }
      
      const data = snapshot.val();
      setEmployeeDetails(data);

      // Calculate statistics if records exist
      if (data.clockInTimes && data.clockOutTimes) {
        const records = formatAttendanceRecords(data.clockInTimes, data.clockOutTimes);
        setStats(calculateStats(records));
      }

      // Process scheduled dates
      setScheduledDates(formatScheduledDates(data.assignedDates || []));
      
      // Set form data from profile
      setFormData({
        name: data.profile?.name || '',
        email: data.profile?.email || '',
        phone: data.profile?.phone || '',
        position: data.profile?.position || '',
        department: data.profile?.department || '',
        location: data.profile?.primaryLocation || '',
        joinDate: data.profile?.joinDate || '',
        emergencyContact: data.profile?.emergencyContact || '',
        emergencyPhone: data.profile?.emergencyPhone || '',
        padrino: data.profile?.padrino || false,
        padrinoColor: data.profile?.padrinoColorCode || 'blue',
        service: data.profile?.service || '',
      });
      
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError(err.message || 'Failed to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auth, navigate]);

  // Load user data on component mount
  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  // Handle phone number update
  const handleUpdatePhone = async (phoneNumber) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const userId = currentUser.uid;
      await update(ref(database, `users/${userId}/profile`), { phone: phoneNumber });
      
      // Update local state
      setFormData(prev => ({ ...prev, phone: phoneNumber }));
      
      showNotification('Phone number updated successfully');
    } catch (err) {
      console.error('Error updating phone number:', err);
      showNotification('Failed to update phone number', 'error');
    }
  };

  // Handle emergency contact update
  const handleUpdateEmergencyContact = async (contact, phone) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const userId = currentUser.uid;
      await update(ref(database, `users/${userId}/profile`), { 
        emergencyContact: contact,
        emergencyPhone: phone
      });
      
      // Update local state
      setFormData(prev => ({ 
        ...prev, 
        emergencyContact: contact,
        emergencyPhone: phone
      }));
      
      showNotification('Emergency contact updated successfully');
    } catch (err) {
      console.error('Error updating emergency contact:', err);
      showNotification('Failed to update emergency contact', 'error');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      showNotification('Failed to log out', 'error');
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setEditMode(prev => !prev);
  };

  // Handle save after editing
  const handleSave = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const userId = currentUser.uid;
      await update(ref(database, `users/${userId}/profile`), {
        phone: formData.phone,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
      });
      
      setEditMode(false);
      showNotification('Profile updated successfully');
      await fetchUserDetails(); // Refresh data
    } catch (err) {
      console.error('Error saving profile:', err);
      showNotification('Failed to save profile', 'error');
    }
  };

  // Render slide content based on index
  const renderSlideContent = (index, data) => {
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid || '';
    
    switch (index) {
      case 0:
        return (
          <PersonalInfoSection
            formData={data.formData}
            editMode={editMode}
            handleInputChange={(e) => {
              const { name, value } = e.target;
              setFormData(prev => ({ ...prev, [name]: value }));
            }}
            userId={userId}
            userData={data.employeeDetails}
            isCurrentUser={true}
            viewOnly={!editMode} // Only editable in edit mode
            isEmployeeView={true}
            onUpdatePhone={handleUpdatePhone}
            onUpdateEmergencyContact={handleUpdateEmergencyContact}
            onSave={handleSave}
            onCancel={() => setEditMode(false)}
          />
        );
      case 1:
        return (
          <IdCardSection
            employeeDetails={data.employeeDetails}
            employeeId={userId}
          />
        );
      case 2:
        return (
          <AttendanceSection
            employeeId={userId}
            viewOnly={true} // Employees can't delete their attendance records
          />
        );
      default:
        return null;
    }
  };

  // Available tabs
  const tabs = [
    { id: 'personal', label: 'My Profile', icon: User },
    { id: 'stats', label: 'My Stats', icon: BarChart2 },
    { id: 'schedule', label: 'My Schedule', icon: Calendar },
    { id: 'achievements', label: 'Achievements', icon: Award },
  ];

  // Prepare slide data for the carousel
  const slideData = {
    formData,
    employeeDetails,
    employeeId: auth.currentUser?.uid,
  };

  // Achievement card component
  const AchievementCard = ({ 
    icon: Icon, 
    title, 
    description, 
    isUnlocked, 
    color = 'yellow',
    progress = { current: 0, target: 100, suffix: '' } 
  }) => {
    const displayColor = isUnlocked ? color : 'gray';
    return (
      <div className={`achievement-card ${isUnlocked ? 'achievement-card-unlocked' : 'achievement-card-locked'}`}>
        <div className="achievement-icon">
          <Icon color={isUnlocked ? {
            blue: '#60A5FA',
            green: '#34D399',
            yellow: '#FBBF24',
            red: '#F87171',
            purple: '#A78BFA'
          }[color] : '#9CA3AF'} size={24} />
        </div>
        <h3 className={`achievement-title text-${displayColor}-400`}>
          {title}
        </h3>
        <p className="achievement-description">
          {description}
        </p>
        {progress && (
          <>
            <div className="progress-container">
              <div 
                className={`progress-bar`}
                style={{
                  width: `${Math.min((progress.current / progress.target) * 100, 100)}%`,
                  background: isUnlocked ? 
                    `linear-gradient(to right, ${
                      {
                        blue: '#3B82F6, #60A5FA',
                        green: '#10B981, #34D399',
                        yellow: '#F59E0B, #FBBF24',
                        red: '#EF4444, #F87171',
                        purple: '#8B5CF6, #A78BFA'
                      }[color] || '#F59E0B, #FBBF24'
                    })` : 'rgba(255, 255, 255, 0.1)'
                }}
              ></div>
            </div>
            <p className="text-xs text-white/50 mt-1">
              {progress.current}{progress.suffix} / {progress.target}{progress.suffix} {isUnlocked ? '(Completed)' : ''}
            </p>
          </>
        )}
      </div>
    );
  };

  // Render tab content based on active tab
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
            <h2 className="text-xl text-white mb-4 flex items-center">
              <BarChart2 className="mr-2 text-blue-400" size={24} />
              Your Statistics
            </h2>
            
            {/* Statistics Cards - UPDATED to match screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="stat-card-dark">
                <div className="flex items-start">
                  <Calendar className="stat-icon text-blue-400" size={20} />
                  <div className="ml-3">
                    <div className="stat-label">Attendance Rate</div>
                    <div className="stat-value">{stats.attendanceRate}%</div>
                  </div>
                </div>
                <div className="progress-container mt-3">
                  <div 
                    className="progress-bar progress-blue" 
                    style={{ width: `${stats.attendanceRate}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="stat-card-dark">
                <div className="flex items-start">
                  <Clock className="stat-icon text-blue-400" size={20} />
                  <div className="ml-3">
                    <div className="stat-label">Punctuality</div>
                    <div className="stat-value">{stats.punctualityRate}%</div>
                  </div>
                </div>
                <div className="progress-container mt-3">
                  <div 
                    className="progress-bar progress-blue" 
                    style={{ width: `${stats.punctualityRate}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="stat-card-dark">
                <div className="flex items-start">
                  <Award className="stat-icon text-blue-400" size={20} />
                  <div className="ml-3">
                    <div className="stat-label">Perfect Streak</div>
                    <div className="stat-value">{stats.perfectStreak} days</div>
                  </div>
                </div>
                <div className="progress-container mt-3">
                  <div 
                    className="progress-bar progress-blue" 
                    style={{ width: `${Math.min(stats.perfectStreak * 3.33, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="stat-card-dark">
                <div className="flex items-start">
                  <BarChart2 className="stat-icon text-blue-400" size={20} />
                  <div className="ml-3">
                    <div className="stat-label">Total Hours</div>
                    <div className="stat-value flex items-center">
                      {stats.totalHours.toFixed(1)}
                      <span className="text-xs text-green-400 ml-2">
                        {stats.hoursChange >= 0 && '+'}{stats.hoursChange.toFixed(1)}% vs last month
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detailed Statistics */}
            <StatsSection employeeDetails={employeeDetails} />
          </div>
        );
      case 'schedule':
        return (
          <div className="glass-panel">
            <ScheduleSection
              employeeId={auth.currentUser?.uid}
              employeeDetails={employeeDetails}
              viewOnly={true}
            />
          </div>
        );
      case 'achievements':
        return (
          <div className="glass-panel p-6">
            <h2 className="text-xl text-white mb-4 flex items-center">
              <Award className="mr-2 text-yellow-400" size={24} />
              Your Achievements
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Perfect Attendance Achievement */}
              <AchievementCard 
                icon={Calendar}
                title="Perfect Attendance"
                description="Maintain perfect attendance for 7 consecutive days"
                isUnlocked={stats.perfectStreak >= 7}
                color="yellow"
                progress={{ current: stats.perfectStreak, target: 7, suffix: ' days' }}
              />
              
              {/* Punctuality Master Achievement */}
              <AchievementCard 
                icon={Clock}
                title="Punctuality Master"
                description="Achieve 90% or higher punctuality rate"
                isUnlocked={stats.punctualityRate >= 90}
                color="blue"
                progress={{ current: stats.punctualityRate.toFixed(1), target: 90, suffix: '%' }}
              />
              
              {/* Service Star Achievement */}
              <AchievementCard 
                icon={User}
                title="Service Star"
                description="Join a service team and contribute to the organization"
                isUnlocked={Boolean(employeeDetails?.profile?.service)}
                color="green"
                progress={null}
              />
              
              {/* Total Hours Achievement */}
              <AchievementCard 
                icon={BarChart2}
                title="Century Club"
                description="Log 100+ total hours of service"
                isUnlocked={stats.totalHours >= 100}
                color="red"
                progress={{ current: stats.totalHours.toFixed(1), target: 100, suffix: ' hours' }}
              />
              
              {/* Early Bird Achievement */}
              <AchievementCard 
                icon={Clock}
                title="Early Bird"
                description="Arrive early at least 25% of the time"
                isUnlocked={stats.earlyArrivalRate >= 25}
                color="purple"
                progress={{ current: stats.earlyArrivalRate.toFixed(1), target: 25, suffix: '%' }}
              />
              
              {/* Padrino Achievement */}
              <AchievementCard 
                icon={Shield}
                title="Padrino Status"
                description="Earn Padrino status through consistent service"
                isUnlocked={Boolean(employeeDetails?.profile?.padrino)}
                color={employeeDetails?.profile?.padrinoColor || 'yellow'}
                progress={null}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container glass-panel">
        <p>{error}</p>
        <button onClick={fetchUserDetails} className="btn primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="employee-dashboard px-4 py-6 max-w-7xl mx-auto">
      {/* Notification banner */}
      {notification.show && (
        <div className={`notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'} text-white`}>
          {notification.message}
        </div>
      )}

      {/* Top action bar with logout */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleLogout}
          className="btn danger flex items-center"
          aria-label="Log out"
        >
          <LogOut size={16} className="mr-2" />
          Logout
        </button>
      </div>

      {/* Welcome Header */}
      <div className="glass-panel profile-header mb-6">
        <div className="profile-info">
          <div className={`avatar ${employeeDetails?.profile?.padrino ? `border-${employeeDetails.profile.padrinoColor}-500/50` : ''}`}>
            {formData.name ? formData.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome, {formData.name || 'Employee'}
            </h1>
            <div className="profile-status">
              <div className={`status-dot ${employeeDetails?.profile?.status === 'active' ? 'active' : 'inactive'}`}></div>
              <span className="text-white/70 capitalize">
                {employeeDetails?.profile?.status || 'Status'} - {formData.position || 'Team Member'}
              </span>
            </div>
            {formData.location && (
              <div className="text-white/70 text-sm mt-1 flex items-center">
                <MapPin size={14} className="mr-1 text-blue-400" />
                {formData.location}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center mt-2 sm:mt-0">
          {/* Edit button */}
          {activeTab === 'personal' && (
            <button
              onClick={toggleEditMode}
              className={`btn ${editMode ? 'warning' : 'primary'} mr-2`}
            >
              <Edit size={16} className="mr-1" />
              {editMode ? 'Cancel Edit' : 'Edit Profile'}
            </button>
          )}
          
          {/* Save button when in edit mode */}
          {activeTab === 'personal' && editMode && (
            <button
              onClick={handleSave}
              className="btn success mr-2"
            >
              <CheckCircle size={16} className="mr-1" />
              Save Changes
            </button>
          )}
          
          <div className="stats-summary px-3 py-2 flex items-center mr-3 text-white/70">
            <div className="text-sm flex flex-col">
              <span className="text-xs opacity-80">Next Shift</span>
              <span className="font-medium">
                {scheduledDates.length > 0 ? 
                  new Date(scheduledDates[0]?.timestamp).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  }) : 'No upcoming shifts'}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => setActiveTab('schedule')}
            className="btn primary mr-2"
          >
            <Calendar size={16} className="mr-1" />
            My Schedule
          </button>
          
          <button
            onClick={() => setActiveTab('achievements')}
            className="btn success"
          >
            <Award size={16} className="mr-1" />
            Achievements
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#0d1323] backdrop-blur border border-[rgba(255,255,255,0.05)] rounded-lg mb-6">
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

export default UserDashboard;
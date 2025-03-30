import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Link, useOutletContext } from 'react-router-dom';
import { Loader2, AlertCircle, Users, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../services/authContext';
import './SuperAdmin/SuperAdminDashboard.css';

const LocationAdminDashboard = () => {
  // ---------------------------
  // State Management
  // ---------------------------
  const [metrics, setMetrics] = useState({
    total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
    perLocation: {},
    overview: {
      totalMembers: 0,
      padrinosBlue: 0,
      padrinosGreen: 0,
      padrinosRed: 0,
      padrinosOrange: 0,
      totalOrejas: 0,
      totalApoyos: 0,
      monthlyAttendance: 0,
    },
    date: new Date().toISOString().split('T')[0]
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clockedInEmployees, setClockedInEmployees] = useState([]);
  const [notClockedInEmployees, setNotClockedInEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  
  // Get context passed from parent LocationAdmin component
  // If using directly, fallback to useAuth
  const contextValue = useOutletContext();
  const { user } = useAuth();
  
  // Extract admin permissions - use context if available, otherwise use auth user
  const adminLocations = useMemo(() => {
    if (contextValue?.adminLocations) return contextValue.adminLocations;
    return user?.managementPermissions?.managedLocations || [];
  }, [contextValue, user]);
  
  const hasAllLocations = useMemo(() => {
    if (contextValue?.hasAllLocations !== undefined) return contextValue.hasAllLocations;
    return adminLocations.includes('*');
  }, [contextValue, adminLocations]);
  
  // Define location mapping with useMemo to prevent unnecessary recalculations
  const locationMap = useMemo(() => ({
    All: 'All',
    Aurora: 'Aurora',
    Elgin: 'Agua Viva Elgin R7',
    Joliet: 'Agua Viva Joliet',
    Lyons: 'Agua Viva Lyons',
    'West Chicago': 'Agua Viva West Chicago',
    Wheeling: 'Agua Viva Wheeling',
    Retreat: 'Retreat',
  }), []);

  // Tab handler with useCallback to prevent re-renders
  const handleTabClick = useCallback((tabName) => {
    setActiveTab(tabName);
  }, []);

  // Safe check for location access with useCallback to prevent dependency issues
  const canAccessLocation = useCallback((userLocation) => {
    // If admin has all locations access
    if (hasAllLocations) return true;
    
    // If adminLocations is not properly defined
    if (!Array.isArray(adminLocations)) return false;
    
    // If on "All" tab, check if location is in admin's locations
    if (activeTab === 'All') return adminLocations.includes(userLocation);
    
    // Otherwise, check if current tab matches the user's location
    return userLocation === locationMap[activeTab];
  }, [hasAllLocations, adminLocations, activeTab, locationMap]);
  
  // Debug user permissions
  useEffect(() => {
    console.log("Admin has access to locations:", adminLocations);
    console.log("Has all locations access:", hasAllLocations);
  }, [adminLocations, hasAllLocations]);
  
  // ---------------------------
  // Data Fetching
  // ---------------------------
  useEffect(() => {
    console.log("Effect running with activeTab:", activeTab);
    
    // Skip if no admin locations
    if (!adminLocations.length && !hasAllLocations) {
      console.log("No admin locations available, skipping data fetch");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const usersRef = ref(database, 'users');
      
      const unsubscribe = onValue(usersRef, (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            console.log("No user data available");
            setError("No user data available");
            setLoading(false);
            return;
          }

          console.log("Got user data, processing...");
          
          // Process data
          const present = [];
          const absent = [];
          
          // Count totals
          const newMetrics = {
            total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
            perLocation: {},
            overview: {
              totalMembers: 0,
              padrinosBlue: 0,
              padrinosGreen: 0,
              padrinosRed: 0,
              padrinosOrange: 0,
              totalOrejas: 0,
              totalApoyos: 0,
              monthlyAttendance: 0,
            },
            date: new Date().toISOString().split('T')[0]
          };
          
          // Initialize perLocation metrics for each admin location
          const validAdminLocations = hasAllLocations ? 
            Object.values(locationMap).filter(loc => loc !== 'All') : 
            adminLocations.filter(loc => loc !== '*');
            
          validAdminLocations.forEach(location => {
            newMetrics.perLocation[location] = {
              notClockedIn: 0,
              clockedIn: 0,
              onTime: 0,
              late: 0,
              totalMembers: 0
            };
          });
          
          // Today's date for attendance check
          const today = new Date().toISOString().split('T')[0];
          
          // Debug: Print some sample data to verify structure
          const sampleKeys = Object.keys(data).slice(0, 2);
          sampleKeys.forEach(key => {
            console.log(`Sample user data for ${key}:`, data[key]);
          });
          
          // Count the users being processed
          let processedUsers = 0;
          
          Object.entries(data).forEach(([userId, user]) => {
            // Skip if user or profile is missing
            if (!user || !user.profile) {
              return;
            }
            
            processedUsers++;
            
            // Get the user's location
            const userLocation = user.profile.location || user.profile.primaryLocation || 'Unknown';
            
            // Skip users not in admin's allowed locations
            if (!hasAllLocations && !adminLocations.includes(userLocation) && !adminLocations.includes('*')) {
              return;
            }
            
            // Count as a member
            newMetrics.overview.totalMembers++;
            
            // Initialize location metrics if not exist
            if (!newMetrics.perLocation[userLocation] && userLocation !== 'Unknown') {
              newMetrics.perLocation[userLocation] = {
                notClockedIn: 0,
                clockedIn: 0,
                onTime: 0,
                late: 0,
                totalMembers: 0
              };
            }
            
            if (userLocation !== 'Unknown') {
              if (newMetrics.perLocation[userLocation]) {
                newMetrics.perLocation[userLocation].totalMembers++;
              }
            }
            
            // Check attendance for today
            // For testing purposes, randomly assign attendance status
            const isPresent = Math.random() > 0.5;
            
            // Build user object with required information
            const userObj = {
              id: userId,
              name: user.profile.name || 'Unknown',
              position: user.profile.position || 'Member',
              location: userLocation,
              stats: {
                attendanceRate: Math.floor(Math.random() * 100), // Random attendance rate for testing
              }
            };
            
            if (isPresent) {
              newMetrics.total.clockedIn++;
              if (userLocation !== 'Unknown' && newMetrics.perLocation[userLocation]) {
                newMetrics.perLocation[userLocation].clockedIn++;
              }
              
              // Randomly determine if on time
              const isOnTime = Math.random() > 0.3;
                
              if (isOnTime) {
                newMetrics.total.onTime++;
                if (userLocation !== 'Unknown' && newMetrics.perLocation[userLocation]) {
                  newMetrics.perLocation[userLocation].onTime++;
                }
              } else {
                newMetrics.total.late++;
                if (userLocation !== 'Unknown' && newMetrics.perLocation[userLocation]) {
                  newMetrics.perLocation[userLocation].late++;
                }
              }
              
              present.push({
                ...userObj,
                attendanceTime: new Date().toISOString(),
                isOnTime
              });
            } else {
              newMetrics.total.notClockedIn++;
              if (userLocation !== 'Unknown' && newMetrics.perLocation[userLocation]) {
                newMetrics.perLocation[userLocation].notClockedIn++;
              }
              
              absent.push(userObj);
            }
            
            // Count members by position
            const position = (user.profile.position || '').toLowerCase();
            if (position.includes('padrino') || position.includes('padrina')) {
              if (position.includes('blue')) {
                newMetrics.overview.padrinosBlue++;
              } else if (position.includes('green')) {
                newMetrics.overview.padrinosGreen++;
              } else if (position.includes('red')) {
                newMetrics.overview.padrinosRed++;
              } else if (position.includes('orange')) {
                newMetrics.overview.padrinosOrange++;
              }
            } else if (position.includes('oreja')) {
              newMetrics.overview.totalOrejas++;
            } else if (position.includes('apoyo')) {
              newMetrics.overview.totalApoyos++;
            }
          });
          
          // Sort employees by name
          present.sort((a, b) => a.name.localeCompare(b.name));
          absent.sort((a, b) => a.name.localeCompare(b.name));
          
          // Calculate monthly attendance rate
          if (newMetrics.overview.totalMembers > 0) {
            // This is a simplified calculation - in real app would need proper monthly data
            const attendanceRate = (newMetrics.total.clockedIn / newMetrics.overview.totalMembers) * 100;
            newMetrics.overview.monthlyAttendance = Math.round(attendanceRate);
          }
          
          console.log(`Processed ${processedUsers} total users, ${newMetrics.overview.totalMembers} members, ${present.length} present, ${absent.length} absent`);
          
          // Update all states at once
          setMetrics(newMetrics);
          setClockedInEmployees(present);
          setNotClockedInEmployees(absent);
          setLoading(false);
          
        } catch (error) {
          console.error("Error processing user data:", error);
          setError(`Error processing data: ${error.message}`);
          setLoading(false);
        }
      }, (error) => {
        console.error("Firebase error:", error);
        setError(`Database error: ${error.message}`);
        setLoading(false);
      });
      
      return () => {
        console.log("Cleaning up effect");
        unsubscribe();
      };
    } catch (error) {
      console.error("Error setting up Firebase listener:", error);
      setError(`Error setting up database connection: ${error.message}`);
      setLoading(false);
    }
  }, [activeTab, adminLocations, hasAllLocations, locationMap]);

  // ---------------------------
  // Render
  // ---------------------------
  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-banner">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span>{error}</span>
      </div>
    );
  }

  // Get available tabs based on admin permissions
  const availableTabs = ['All', ...adminLocations.filter(loc => loc !== '*')];

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        {/* Quadrant 1: Location Navigation and Metrics */}
        <div className="quadrant quadrant-1">
          {/* Location nav */}
          <nav className="quadrant-nav">
            <ul>
              {availableTabs.map((tabName) => (
                <li
                  key={tabName}
                  onClick={() => handleTabClick(tabName)}
                  className={`nav-item ${activeTab === tabName ? 'active' : ''}`}
                >
                  {tabName}
                </li>
              ))}
            </ul>
          </nav>

          {/* Metrics display */}
          <div className="metrics-grid">
            <div className="metric-box">
              <h3>Total Members</h3>
              <div className="metric-content">
                <Users className="w-6 h-6 text-blue-400 mr-2" />
                <p className="metric-number">
                  {activeTab === 'All' 
                    ? metrics.overview.totalMembers
                    : metrics.perLocation[locationMap[activeTab]]?.totalMembers || 0}
                </p>
              </div>
            </div>
            
            <div className="metric-box">
              <h3>Present Today</h3>
              <div className="metric-content">
                <CheckCircle2 className="w-6 h-6 text-green-400 mr-2" />
                <p className="metric-number">
                  {activeTab === 'All' 
                    ? metrics.total.clockedIn
                    : metrics.perLocation[locationMap[activeTab]]?.clockedIn || 0}
                </p>
              </div>
            </div>
            
            <div className="metric-box">
              <h3>Absent Today</h3>
              <div className="metric-content">
                <AlertCircle className="w-6 h-6 text-red-400 mr-2" />
                <p className="metric-number">
                  {activeTab === 'All' 
                    ? metrics.total.notClockedIn
                    : metrics.perLocation[locationMap[activeTab]]?.notClockedIn || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quadrant 2: Employee Lists */}
        <div className="quadrant quadrant-2">
          <div className="lists-container">
            <div className="list-column">
              {/* Present employees list */}
              <div className="employee-list">
                <h3 className="list-title">Present ({
                  activeTab === 'All' 
                    ? clockedInEmployees.length
                    : clockedInEmployees.filter(emp => emp.location === locationMap[activeTab]).length
                })</h3>
                
                <div className="employees-scrollable">
                  {clockedInEmployees.length === 0 ? (
                    <div className="empty-list">No employees found</div>
                  ) : (
                    clockedInEmployees
                      .filter(employee => 
                        activeTab === 'All' || 
                        employee.location === locationMap[activeTab]
                      )
                      .map((employee) => (
                        <div key={employee.id} className="employee-item">
                          <Link to={`/location-admin/users/${employee.id}`} className="employee-link">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`status-indicator ${employee.isOnTime ? 'on-time' : 'late'}`}></div>
                                <div>
                                  <p className="employee-name">{employee.name}</p>
                                  <p className="employee-details">
                                    {employee.location.replace('Agua Viva ', '')} • {employee.position}
                                  </p>
                                </div>
                              </div>
                              <div className="employee-meta">
                                <span className="attendance-time">
                                  {new Date(employee.attendanceTime).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="list-column">
              {/* Absent employees list */}
              <div className="employee-list">
                <h3 className="list-title">Absent ({
                  activeTab === 'All' 
                    ? notClockedInEmployees.length
                    : notClockedInEmployees.filter(emp => emp.location === locationMap[activeTab]).length
                })</h3>
                
                <div className="employees-scrollable">
                  {notClockedInEmployees.length === 0 ? (
                    <div className="empty-list">No employees found</div>
                  ) : (
                    notClockedInEmployees
                      .filter(employee => 
                        activeTab === 'All' || 
                        employee.location === locationMap[activeTab]
                      )
                      .map((employee) => (
                        <div key={employee.id} className="employee-item">
                          <Link to={`/location-admin/users/${employee.id}`} className="employee-link">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="status-indicator absent"></div>
                                <div>
                                  <p className="employee-name">{employee.name}</p>
                                  <p className="employee-details">
                                    {employee.location.replace('Agua Viva ', '')} • {employee.position}
                                  </p>
                                </div>
                              </div>
                              <div className="employee-meta">
                                <span className="attendance-rate">
                                  {employee.stats.attendanceRate}%
                                </span>
                              </div>
                            </div>
                          </Link>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationAdminDashboard;
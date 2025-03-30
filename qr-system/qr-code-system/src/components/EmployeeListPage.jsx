import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { useNavigate, useLocation } from 'react-router-dom';
import { database } from '../services/firebaseConfig';
import { Activity, Calendar, Users, Clock, Filter } from 'lucide-react';
import './EmployeeListPage.css';

// Consistent date formatting utility
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return dateString; // Return the original string if parsing fails
  }
};

// Normalize date format for consistent comparison
const normalizeDate = (dateString) => {
  if (!dateString) return null;
  try {
    const dateObj = new Date(dateString);
    return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (e) {
    console.error("Error normalizing date:", e);
    return dateString; // Fallback to original string
  }
};

// Helper function to get the CSS class for a score
const getScoreClass = (score) => {
  const numScore = parseFloat(score);
  if (numScore >= 95) return 'bg-emerald-400';
  if (numScore >= 85) return 'bg-green-400';
  if (numScore >= 75) return 'bg-teal-400';
  if (numScore >= 65) return 'bg-yellow-400';
  if (numScore >= 55) return 'bg-orange-400';
  if (numScore >= 45) return 'bg-red-400';
  return 'bg-red-600';
};

// Status indicator component
const AttendanceIndicator = ({ score }) => (
  <div
    className={`w-3 h-3 rounded-full ${getScoreClass(score)} inline-block mr-2`}
    title={`Attendance: ${score}%`}
  />
);

// Event category attendance indicator
// Event category attendance indicator
// Example solution #1: Safely convert to array
const EventCategoryIndicator = ({ events }) => {
  // If `events` is already an array, use it as is. Otherwise, convert to an array of object values.
  const eventArray = Array.isArray(events) ? events : Object.values(events || {});
  
  const totalEvents = eventArray.length;
  const attendedEvents = eventArray.filter(e => e.attended).length;

  const attendanceRate = totalEvents > 0
    ? ((attendedEvents / totalEvents) * 100).toFixed(1)
    : 0;

  return (
    <div
      className={`w-4 h-4 rounded-full ${getScoreClass(attendanceRate)} flex items-center justify-center`}
      title={`Attended ${attendedEvents} of ${totalEvents} events (${attendanceRate}%)`}
    >
      <span className="text-xs text-white font-bold">
        {attendedEvents}/{totalEvents}
      </span>
    </div>
  );
};



export default function EmployeeListPage() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterTitle, setFilterTitle] = useState('All Employees');
  const [filterDate, setFilterDate] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Apply filter function
  const applyFilter = (filter, date = null) => {
    if (!employees || employees.length === 0) {
      console.log("No employees data available for filtering");
      return;
    }

    console.log(`Applying filter: ${filter}, date: ${date}`);
    setActiveFilter(filter);
    
    // Set and normalize the filter date
    const normalizedDate = date ? normalizeDate(date) : null;
    if (normalizedDate) {
      setFilterDate(normalizedDate);
      console.log(`Normalized date for filtering: ${normalizedDate}`);
    }
    
    let filtered = [...employees];
    let title = 'All Employees';
    
    // Log expected count from metrics if available
    const expectedCount = location.state?.count;
    if (expectedCount !== undefined) {
      console.log(`Expected count from metrics: ${expectedCount}`);
    }
    
    switch(filter) {
      // Metrics filters 
      case 'RSG':
        filtered = employees.filter(emp => emp.serviceType === 'RSG');
        title = 'Orejas';
        break;
      case 'COM':
        filtered = employees.filter(emp => emp.serviceType === 'COM');
        title = 'Apoyos';
        break;
      case 'padrinosBlue':
        filtered = employees.filter(emp => emp.padrinoColor === 'blue');
        title = 'Blue Padrinos';
        break;
      case 'padrinosGreen':
        filtered = employees.filter(emp => emp.padrinoColor === 'green');
        title = 'Green Padrinos';
        break;
      case 'padrinosRed':
        filtered = employees.filter(emp => emp.padrinoColor === 'red');
        title = 'Red Padrinos';
        break;
      case 'padrinosOrange':
        filtered = employees.filter(emp => emp.padrinoColor === 'orange');
        title = 'Orange Padrinos';
        break;
      
      // Attendance-specific filters with fixed logic to match the dashboard
      case 'absent':
        if (normalizedDate) {
          console.log(`Checking for absent employees on ${normalizedDate}`);
          
          // FIXED: Match the SuperAdminDashboard's logic for counting absences
          // A user is considered absent if they have no lastClockIn value
          filtered = employees.filter(emp => {
            // Important: Use same logic as SuperAdminDashboard.js
            const lastClockIn = emp.stats?.lastClockIn || null;
            return !lastClockIn;
          });
          
          console.log(`Found ${filtered.length} absent employees using consistent logic`);
          title = `Absent Employees (${formatDate(normalizedDate)})`;
        } else {
          filtered = employees.filter(emp => emp.status === 'inactive');
          title = 'Absent Employees';
        }
        break;
        
      case 'present':
        if (normalizedDate) {
          console.log(`Checking for present employees on ${normalizedDate}`);
          // FIXED: Use same logic as dashboard - a user is present if they have lastClockIn
          filtered = employees.filter(emp => {
            const lastClockIn = emp.stats?.lastClockIn || null;
            return lastClockIn !== null;
          });
          
          title = `Present Employees (${formatDate(normalizedDate)})`;
        } else {
          filtered = employees.filter(emp => emp.status === 'active');
          title = 'Present Employees';
        }
        break;
        
      case 'late':
        if (normalizedDate) {
          console.log(`Checking for late employees on ${normalizedDate}`);
          // FIXED: Match dashboard - user is late based on daysLate
          filtered = employees.filter(emp => {
            const lastClockIn = emp.stats?.lastClockIn || null;
            const daysLate = emp.stats?.daysLate || 0;
            return lastClockIn !== null && daysLate > 0;
          });
          
          title = `Late Employees (${formatDate(normalizedDate)})`;
        } else {
          filtered = employees.filter(emp => parseFloat(emp.punctualityRate) < 85);
          title = 'Employees with Poor Punctuality';
        }
        break;
        
      case 'onTime':
        if (normalizedDate) {
          console.log(`Checking for on-time employees on ${normalizedDate}`);
          // FIXED: Match dashboard - user is on time if clocked in but not late
          filtered = employees.filter(emp => {
            const lastClockIn = emp.stats?.lastClockIn || null;
            const daysLate = emp.stats?.daysLate || 0;
            return lastClockIn !== null && daysLate === 0;
          });
          
          title = `On-Time Employees (${formatDate(normalizedDate)})`;
        } else {
          filtered = employees.filter(emp => parseFloat(emp.punctualityRate) >= 85);
          title = 'Punctual Employees';
        }
        break;
        
      case 'all':
      default:
        filtered = employees;
        title = 'All Employees';
        break;
    }
    
    // Log results
    console.log(`Filter applied. Results: ${filtered.length} employees`);
    if (expectedCount !== undefined && filtered.length !== expectedCount) {
      console.warn(`WARNING: Expected ${expectedCount} employees but found ${filtered.length}`);
      console.log(`This may indicate inconsistent logic between dashboard and employee list`);
    }
    
    setFilteredEmployees(filtered);
    setFilterTitle(title);
  };

  // Clear filter function
  const clearFilter = () => {
    setActiveFilter(null);
    setFilterDate(null);
    setFilteredEmployees(employees);
    setFilterTitle('All Employees');
    
    // Update URL without the filter state
    navigate('/employee-list', { replace: true });
  };

  // Load employees data
  useEffect(() => {
    // Fetch all user records from Firebase
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        try {
          const data = snapshot.val() || {};
          const userArray = [];

          // Convert each user object into a friendlier format
          Object.entries(data).forEach(([userId, userRecord]) => {
            if (userRecord?.profile) {
              const { 
                name, 
                role, 
                status, 
                primaryLocation, 
                service, 
                padrinoColor 
              } = userRecord.profile;
              
              // Get stats data - IMPORTANT: Use this for consistent logic with dashboard
              const stats = userRecord?.stats || {};
              const events = userRecord?.events || {};
              
              // Include all relevant data, ensuring stats is available for filtering
              userArray.push({
                id: userId,
                name: name || 'Unknown',
                role: role || 'Unknown',
                status: status || 'unknown',
                location: primaryLocation || 'unknown',
                serviceType: service || '',
                padrinoColor: padrinoColor || null,
                dailyAttendance: userRecord?.attendance || {},
                stats: stats, // Include full stats object for filter consistency
                attendanceRate: stats.attendanceRate || 0,
                punctualityRate: stats.punctualityRate || 0,
                events: {
                  workshops: events.workshops || [],
                  meetings: events.meetings || [],
                  haciendas: events.haciendas || [],
                  juntaHacienda: events.juntaHacienda || []
                }
              });
            }
          });

          console.log(`Loaded ${userArray.length} employees from database`);
          setEmployees(userArray);
          
          // Initialize with all employees
          setFilteredEmployees(userArray);
          setLoading(false);
          
          // If we have location state with a filter, apply it now that we have data
          if (location.state?.filter) {
            console.log("Found filter in location state:", location.state.filter);
            applyFilter(location.state.filter, location.state.date);
          }
        } catch (err) {
          console.error('Error processing employees data:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, []); 

  // Apply filter based on route state when location changes
  useEffect(() => {
    if (location.state?.filter && employees.length > 0) {
      console.log("Location changed, applying filter:", location.state.filter);
      applyFilter(location.state.filter, location.state.date);
    }
  }, [location.state, employees.length]);

  // Handler for "Back" button
  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Loading employees...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="back-button" onClick={handleBackClick}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-list-page">
      <div className="glass-card p-4">
        {/* Back button at the top */}
        <button className="back-button" onClick={handleBackClick}>
          ← Back
        </button>

        <div className="flex justify-between items-center mb-4">
          <h1 className="employee-list-title">{filterTitle}</h1>
          
          {activeFilter && (
            <button 
              onClick={clearFilter}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
            >
              <Filter className="w-4 h-4" />
              Clear Filter
            </button>
          )}
        </div>
        
        <p className="employee-list-subtitle">
          {`Showing ${filteredEmployees.length} ${filteredEmployees.length === 1 ? 'employee' : 'employees'}`}
        </p>
        
        {/* Legend for attendance indicators */}
        <div className="mb-4 p-2 bg-slate-800/30 rounded-lg">
          <h3 className="text-sm font-medium text-white/80 mb-2">Attendance Legend:</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-400 mr-2"></div>
                <span className="text-xs">Excellent (95%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                <span className="text-xs">Good (85%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                <span className="text-xs">Average (65%+)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
                <span className="text-xs">Needs Improvement (&lt;65%)</span>
              </div>
            </div>
            <div className="text-xs bg-slate-800/50 p-2 rounded">
              <span className="font-medium">Note:</span> The color next to employee names shows their weighted attendance score across all event types (Workshops: 25%, Meetings: 25%, Haciendas: 30%, Junta: 20%)
            </div>
          </div>
        </div>

        {/* Table of employees */}
        <table className="employee-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Location</th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden md:inline">Workshops</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-4 h-4" />
                  <span className="hidden md:inline">Meetings</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="w-4 h-4" />
                  <span className="hidden md:inline">Haciendas</span>
                </div>
              </th>
              <th className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="hidden md:inline">Junta</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id} onClick={() => navigate(`/employee/${emp.id}`)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="flex items-center">
                    <AttendanceIndicator score={emp.attendanceRate} />
                    {emp.name}
                    {emp.padrinoColor && (
                      <span 
                        className={`ml-2 inline-block w-3 h-3 rounded-full`}
                        style={{ backgroundColor: emp.padrinoColor }}
                        title={`${emp.padrinoColor.charAt(0).toUpperCase() + emp.padrinoColor.slice(1)} Padrino`}
                      ></span>
                    )}
                  </div>
                </td>
                <td>{emp.role}</td>
                <td>{emp.status}</td>
                <td>{emp.location}</td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.workshops} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.meetings} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.haciendas} 
                    />
                  </div>
                </td>
                <td className="text-center">
                  <div className="flex justify-center">
                    <EventCategoryIndicator 
                      events={emp.events.juntaHacienda} 
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>
                  No employees found with the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
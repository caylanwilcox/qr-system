import React, { useState, useEffect } from 'react';
import { ref, onValue, update, remove, set, get } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  Search, 
  Users, 
  Activity, 
  Trash2, 
  AlertTriangle, 
  Archive, 
  Filter, 
  X, 
  Shield, 
  CheckCircle, 
  MapPin,
  User,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import './ManageEmployees.css';

const ManageEmployees = ({ locationFiltered = false }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [locations, setLocations] = useState([]);
  const { user } = useAuth();

  // Utility functions for location normalization - borrowed from migration script
  const normalizeLocationKey = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };
  
  const formatDisplayName = (text) => {
    if (!text) return '';
    return text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Fetch locations from Firebase
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Try multiple approaches to ensure we get locations data, similar to migration script
        
        // Approach 1: Try the compatibility node first (fastest)
        const compatListRef = ref(database, 'locationsList');
        onValue(compatListRef, async (snapshot) => {
          if (snapshot.exists()) {
            const locationsData = snapshot.val();
            
            if (Array.isArray(locationsData) && locationsData.length > 0) {
              setLocations(locationsData.sort());
              return;
            }
          }
          
          // Approach 2: Try the central locations node
          const locationsRef = ref(database, 'locations');
          const locationsSnapshot = await get(locationsRef);
          
          if (locationsSnapshot.exists()) {
            const locationsData = locationsSnapshot.val();
            const locationNames = [];
            
            // Extract location names from various possible formats
            Object.values(locationsData).forEach(location => {
              if (typeof location === 'object' && location !== null && location.name) {
                locationNames.push(location.name);
              } else if (typeof location === 'string') {
                locationNames.push(location);
              }
            });
            
            if (locationNames.length > 0) {
              setLocations(locationNames.sort());
              return;
            }
          }
          
          // Approach 3: Fall back to extracting from user profiles (legacy approach)
          console.log('Falling back to legacy location extraction');
          const usersRef = ref(database, 'users');
          const usersSnapshot = await get(usersRef);
          
          if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            const allLocations = new Set();
            
            Object.values(usersData).forEach(data => {
              if (data.profile) {
                // Try all possible location fields
                const possibleLocations = [
                  data.profile.location,
                  data.profile.primaryLocation,
                  data.location,
                  data.locationKey
                ];
                
                possibleLocations.forEach(loc => {
                  if (loc && typeof loc === 'string' && loc.trim() !== '') {
                    allLocations.add(formatDisplayName(loc.trim()));
                  }
                });
              }
            });
            
            setLocations(Array.from(allLocations).sort());
          } else {
            setLocations([]);
          }
        });
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Failed to load locations. Please try again later.');
      }
    };

    fetchLocations();
  }, []);

  // Determine admin's location or admin status
  const [adminLocation, setAdminLocation] = useState(null);
  
  useEffect(() => {
    const fetchAdminLocation = async () => {
      if (!user || !locationFiltered) return;
      
      // Fetch the admin's profile to get their location
      try {
        const userRef = ref(database, `users/${user.uid}`);
        
        onValue(userRef, (snapshot) => {
          const userData = snapshot.val();
          if (userData) {
            // Try multiple location fields - similar to the migration script approach
            const possibleLocations = [
              userData.location,
              userData.locationKey,
              userData.profile?.location,
              userData.profile?.locationKey,
              userData.profile?.primaryLocation
            ];
            
            // Find the first non-empty location
            let adminLoc = null;
            for (const loc of possibleLocations) {
              if (loc && typeof loc === 'string' && loc.trim() !== '') {
                adminLoc = loc.trim();
                break;
              }
            }
            
            if (adminLoc) {
              setAdminLocation(adminLoc);
              setSelectedLocation(adminLoc);
            }
          }
        });
      } catch (err) {
        console.error('Error fetching admin location:', err);
      }
    };
    
    fetchAdminLocation();
  }, [user, locationFiltered]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const usersRef = ref(database, 'users');
        onValue(usersRef, (snapshot) => {
          const usersData = snapshot.val();
          if (!usersData) {
            setEmployees([]);
            setLoading(false);
            return;
          }

          // Map through the users using the updated structure:
          const employeeList = Object.entries(usersData)
            .filter(([_, userData]) => userData && userData.profile && userData.profile.name)
            .map(([userId, userData]) => {
              const profile = userData.profile || {};
              const stats = userData.stats || {};

              // Consider all possible location fields
              const possibleLocations = [
                userData.location,
                userData.locationKey,
                profile.location,
                profile.locationKey, 
                profile.primaryLocation
              ];
              
              // Find the first non-empty location
              let locationValue = null;
              for (const loc of possibleLocations) {
                if (loc && typeof loc === 'string' && loc.trim() !== '') {
                  locationValue = loc.trim();
                  break;
                }
              }
              
              // Find location key (normalized version of location)
              const locationKey = normalizeLocationKey(locationValue);
              
              // Status handling with fallbacks
              const status = userData.status ? userData.status.toLowerCase() : 
                            (profile.status ? profile.status.toLowerCase() : 'inactive');
              
              const role = (profile.role || 'employee').toLowerCase();
              const service = profile.service || 'Not Assigned';

              const daysPresent = stats.daysPresent || 0;
              const daysAbsent = stats.daysAbsent || 0;
              const daysLate = stats.daysLate || 0;
              const totalDays = daysPresent + daysAbsent;

              const attendanceRate = totalDays > 0 
                ? ((daysPresent / totalDays) * 100).toFixed(1) 
                : 0;
              
              const onTimeRate = daysPresent > 0 
                ? (((daysPresent - daysLate) / daysPresent) * 100).toFixed(1) 
                : 0;

              return {
                id: userId,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                service,
                // Store both the display name and the normalized key
                location: locationValue,
                locationKey: locationKey,
                status,
                role,
                stats: {
                  daysPresent,
                  daysAbsent,
                  daysLate,
                  rank: stats.rank || 0,
                  attendanceRate,
                  onTimeRate,
                },
              };
            });

          // If location filtering is enabled and admin location is set, filter by admin's location
          let filteredList = employeeList;
          if (locationFiltered && adminLocation) {
            const adminLocationKey = normalizeLocationKey(adminLocation);
            
            filteredList = employeeList.filter(emp => {
              // Match either the display name or the normalized key
              return emp.location === adminLocation || 
                     emp.locationKey === adminLocationKey ||
                     normalizeLocationKey(emp.location) === adminLocationKey;
            });
          }

          setEmployees(filteredList);
          setError(null);
          setLoading(false);
        });
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employee data. Please try again later.');
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [adminLocation, locationFiltered]);

  // Get the correct count of users for each location
  const getUserCountByLocation = (location) => {
    const locationKey = normalizeLocationKey(location);
    
    return employees.filter(user => {
      // Match by exact location name or by normalized location key
      return user.location === location || 
             user.locationKey === locationKey ||
             normalizeLocationKey(user.location) === locationKey;
    }).length;
  };

  // Filter employees based on search and filter
  const filterEmployees = (employeeList) => {
    let filtered = employeeList;
    
    if (filter !== 'all') {
      filtered = filtered.filter((emp) => emp.status === filter);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((emp) => 
        emp.name.toLowerCase().includes(search) ||
        emp.email?.toLowerCase().includes(search) ||
        emp.service.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  // Handle user deletion with backup
  const handleDeleteUser = async (employee) => {
    setUserToDelete(employee);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      // First, create a backup of the user data
      const userRef = ref(database, `users/${userToDelete.id}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();
      
      if (userData) {
        // Create a Firebase-safe timestamp by replacing invalid path characters
        // Firebase doesn't allow ".", "#", "$", "[", or "]" in paths
        const originalTimestamp = new Date().toISOString();
        const safeTimestamp = originalTimestamp.replace(/\./g, '_').replace(/:/g, '-');
        
        // Create a backup path with the sanitized timestamp
        const backupRef = ref(database, `deleted_users/${userToDelete.id}_${safeTimestamp}`);
        
        // Save the backup with the original timestamp in the data
        await set(backupRef, {
          ...userData,
          deletedAt: originalTimestamp, // Keep original format for data fields
          deletedBy: user.uid,
        });
        
        console.log(`User backup created at: deleted_users/${userToDelete.id}_${safeTimestamp}`);
        
        // Proceed with user deletion after backup is confirmed
        await remove(userRef);
        console.log(`User ${userToDelete.id} deleted successfully`);
        
        // Update local state to remove the user from the UI
        setEmployees(employees.filter(emp => emp.id !== userToDelete.id));
        
        // Show success notification
        setDeleteSuccess(true);
        setSuccessMessage(`Successfully deleted user ${userToDelete.name}`);
        
        // Reset modal after 3 seconds
        setTimeout(() => {
          setDeleteSuccess(false);
          setShowDeleteModal(false);
          setUserToDelete(null);
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error('Could not find user data to backup');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(`Failed to delete user: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  // Update role inside the profile node
  const handleToggleRole = async (employee) => {
    try {
      const newRole = employee.role === 'admin' ? 'employee' : 'admin';
      await update(ref(database, `users/${employee.id}/profile`), {
        role: newRole,
      });
      setSuccessMessage(`Successfully updated ${employee.name}'s role to ${newRole}`);
      
      // Update local state to refresh user role without reloading
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === employee.id ? {...emp, role: newRole} : emp
        )
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role. Please try again.');
    }
  };

  // Filter locations based on search
  const filteredLocations = locations.filter(location => 
    !locationFilter || location.toLowerCase().includes(locationFilter.toLowerCase())
  );

  // Notification component
  const Notification = ({ type, message, onDismiss }) => (
    <div className={`fixed top-4 right-4 max-w-md z-50 shadow-lg rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm
      ${type === 'error' ? 'bg-red-900 bg-opacity-20 border border-red-500 text-red-400' : 
        'bg-green-900 bg-opacity-20 border border-green-500 text-green-400'}`}>
      <span className="flex-shrink-0 mt-1">
        {type === 'error' ? 
          <AlertTriangle className="h-5 w-5" /> : 
          <CheckCircle className="h-5 w-5" />
        }
      </span>
      <div className="flex-1">
        <div className="font-medium mb-1">
          {type === 'error' ? 'Error' : 'Success'}
        </div>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      <button 
        onClick={onDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-white"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );

  const LocationCard = ({ location }) => {
    const locationKey = normalizeLocationKey(location);
    
    // Get all employees where location matches the current location card
    const locationEmployees = employees.filter(emp => {
      // Match by exact location name or by normalized location key
      return emp.location === location || 
             emp.locationKey === locationKey ||
             normalizeLocationKey(emp.location) === locationKey;
    });
    
    const activeCount = locationEmployees.filter(
      (emp) => emp.status === 'active'
    ).length;
    
    const adminCount = locationEmployees.filter(
      (emp) => emp.role === 'admin'
    ).length;

    const attendanceStats = locationEmployees.reduce(
      (acc, emp) => {
        acc.totalAttendance += parseFloat(emp.stats?.attendanceRate || 0);
        return acc;
      },
      { totalAttendance: 0 }
    );
    
    const averageAttendance = locationEmployees.length > 0
      ? (attendanceStats.totalAttendance / locationEmployees.length).toFixed(1)
      : 0;
    
    const isSelected = location === selectedLocation;
    
    return (
      <div 
        className={`location-card ${isSelected ? 'selected' : ''}`} 
        onClick={() => setSelectedLocation(location)}
      >
        <div className="location-card-header">
          <h3 className="location-name">{location}</h3>
          <ChevronRight size={18} className="text-blue-400" />
        </div>
        <div className="location-stats">
          <p><Users size={16} /> Total Members: {locationEmployees.length}</p>
          <p className="active-count">
            <Activity size={16} /> Active: {activeCount}
          </p>
          <p className="admin-count">
            <Shield size={16} /> Admins: {adminCount}
          </p>
          <p className="attendance-rate">Avg. Attendance: {averageAttendance}%</p>
        </div>
      </div>
    );
  };

  const EmployeeTable = ({ employees }) => (
    <div className="employee-table-container">
      <table className="employee-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Service</th>
            <th>Role</th>
            <th>Status</th>
            <th>Days Present</th>
            <th>Days Absent</th>
            <th>Days Late</th>
            <th>Attendance Rate</th>
            <th>On-Time Rate</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <Link 
                  to={locationFiltered 
                    ? `/location-admin/users/${employee.id}` 
                    : `/super-admin/users/${employee.id}`}
                  className="employee-name"
                >
                  {employee.name}
                </Link>
              </td>
              <td>{employee.service}</td>
              <td>
                <span className={`role-badge ${employee.role}`}>
                  {employee.role}
                </span>
              </td>
              <td>
                <span className={`status-indicator ${employee.status}`}>
                  {employee.status}
                </span>
              </td>
              <td>{employee.stats.daysPresent}</td>
              <td>{employee.stats.daysAbsent}</td>
              <td>{employee.stats.daysLate}</td>
              <td className={`reliability-score ${
                employee.stats.attendanceRate >= 95 ? 'score-perfect' :
                employee.stats.attendanceRate >= 85 ? 'score-high' :
                employee.stats.attendanceRate >= 75 ? 'score-good' :
                employee.stats.attendanceRate >= 65 ? 'score-medium' :
                employee.stats.attendanceRate >= 55 ? 'score-below' :
                employee.stats.attendanceRate >= 45 ? 'score-poor' :
                'score-critical'
              }`}>
                {employee.stats.attendanceRate}%
              </td>
              <td className={`reliability-score ${
                employee.stats.onTimeRate >= 95 ? 'score-perfect' :
                employee.stats.onTimeRate >= 85 ? 'score-high' :
                employee.stats.onTimeRate >= 75 ? 'score-good' :
                employee.stats.onTimeRate >= 65 ? 'score-medium' :
                employee.stats.onTimeRate >= 55 ? 'score-below' :
                employee.stats.onTimeRate >= 45 ? 'score-poor' :
                'score-critical'
              }`}>
                {employee.stats.onTimeRate}%
              </td>
              <td>
                {employee.role !== 'super_admin' && (
                  <div className="action-buttons">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleRole(employee);
                      }}
                      className="toggle-role-btn"
                    >
                      {employee.role === 'admin' ? 'Demote to Employee' : 'Promote to Admin'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteUser(employee);
                      }}
                      className="delete-user-btn"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const LocationDetails = ({ location }) => {
    const locationKey = normalizeLocationKey(location);
    
    // Get all employees where location matches the selected location
    const locationEmployees = employees.filter(emp => {
      return emp.location === location || 
             emp.locationKey === locationKey ||
             normalizeLocationKey(emp.location) === locationKey;
    });
    
    const filteredEmployees = filterEmployees(locationEmployees);
    
    const activeCount = locationEmployees.filter(
      (emp) => emp.status === 'active'
    ).length;

    return (
      <div className="location-details">
        <div className="location-header">
          <div className="location-title-area">
            <h3 className="location-title">
              <MapPin size={20} className="text-blue-400" />
              {location} - Member Details
            </h3>
            <div className="location-summary">
              <div className="summary-item">
                <Users size={16} />
                Total Members: {getUserCountByLocation(location)}
              </div>
              <div className="summary-item active-count">
                <Activity size={16} />
                Active Members: {activeCount}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setSelectedLocation(null)} 
            className="back-button"
          >
            <ChevronLeft size={20} />
            Back to Locations
          </button>
        </div>
        
        <div className="header-controls">
          <div className="search-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-container">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Members</option>
              <option value="active">Active Members</option>
              <option value="inactive">Inactive Members</option>
            </select>
          </div>
        </div>

        {filteredEmployees.length > 0 ? (
          <EmployeeTable employees={filteredEmployees} />
        ) : (
          <div className="empty-state">
            <p>No members found matching your criteria.</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p>Loading member data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  // Return the main UI
  return (
    <div className="manage-dashboard">
      {/* Top Navigation Bar */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <Settings size={20} className="text-blue-400" />
            <h2 className="dashboard-title">Location Overview</h2>
          </div>
          <div className="search-container">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search locations..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>
      
      {/* Notifications */}
      {error && (
        <Notification 
          type="error" 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      )}

      {successMessage && (
        <Notification 
          type="success" 
          message={successMessage} 
          onDismiss={() => setSuccessMessage('')} 
        />
      )}

      {/* Main Content */}
      <div className="dashboard-content">
        <div className="locations-section">
          {/* Show either location grid or selected location details */}
          {selectedLocation ? (
            <LocationDetails location={selectedLocation} />
          ) : (
            <div className="location-grid">
              {filteredLocations.length > 0 ? (
                filteredLocations
                  .map((location) => (
                    <LocationCard key={location} location={location} />
                  ))
              ) : locations.length > 0 ? (
                <div className="empty-state">
                  <p>No locations found matching your search.</p>
                </div>
              ) : (
                <div className="loading-locations">
                  <div className="loading-spinner-small"></div>
                  <p>Loading locations...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
 
      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay">
          <div className="delete-modal">
            {!deleteSuccess ? (
              <>
                <div className="modal-header">
                  <AlertTriangle size={24} className="warning-icon" />
                  <h3>Confirm User Deletion</h3>
                </div>
                <div className="modal-content">
                  <p>Are you sure you want to delete the user <strong>{userToDelete.name}</strong>?</p>
                  <p>This action will remove the user but a backup will be created in the database.</p>
                  <div className="backup-info">
                    <Archive size={16} />
                    <span>A backup will be stored in <code>deleted_users/{`${userToDelete.id}_[timestamp]`}</code></span>
                  </div>
                </div>
                <div className="modal-actions">
                  <button 
                    onClick={cancelDelete} 
                    className="cancel-button" 
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeleteUser} 
                    className="delete-button" 
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <>
                        <div className="spinner-small"></div>
                        Processing...
                      </>
                    ) : (
                      'Delete User'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h3>User Deleted Successfully</h3>
                <p>A backup has been created in the database.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEmployees;
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ChevronLeft, 
  Users, 
  Activity, 
  MapPin,
  Filter,
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  Trash2,
  Archive
} from 'lucide-react';
import { database } from '../services/firebaseConfig';
import { ref, onValue, update, remove, set, get } from 'firebase/database';
import { useAuth } from '../services/authContext';
import './LocationEmployees.css';

const LocationEmployees = ({ locationFiltered = false }) => {
  const { locationName } = useParams();
  const decodedLocation = decodeURIComponent(locationName || '');
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const { user } = useAuth();
  const [locationStats, setLocationStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    adminCount: 0
  });
  
  // Get context from parent route
  const context = useOutletContext() || {};
  const parentPath = context.parentPath || (locationFiltered ? '/location-admin' : '/super-admin');
  const { adminLocations = [], hasAllLocations = false } = context;

  // Utility function for location normalization
  const normalizeLocationKey = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };

  useEffect(() => {
    if (!decodedLocation) {
      navigate(`${parentPath}/manage-employees`);
      return;
    }

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

          // Map through the users
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

              // Check for padrino status and color
              const isPadrino = profile.padrino || false;
              const padrinoColor = profile.padrinoColor || '';

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
                location: locationValue,
                locationKey: locationKey,
                status,
                role,
                isPadrino,
                padrinoColor,
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

          // Filter by location
          const locationKey = normalizeLocationKey(decodedLocation);
          
          const filteredList = employeeList.filter(emp => {
            // Match either the display name or the normalized key
            return emp.location === decodedLocation || 
                   emp.locationKey === locationKey ||
                   normalizeLocationKey(emp.location) === locationKey;
          });

          // If location admin is restricted, also filter by their assigned locations
          let finalList = filteredList;
          
          if (locationFiltered && !hasAllLocations && adminLocations.length > 0) {
            finalList = filteredList.filter(emp => {
              return adminLocations.some(adminLoc => {
                const adminLocationKey = normalizeLocationKey(adminLoc);
                return emp.location === adminLoc || 
                       emp.locationKey === adminLocationKey ||
                       normalizeLocationKey(emp.location) === adminLocationKey;
              });
            });
          }

          setEmployees(finalList);
          
          // Update location stats
          const activeCount = finalList.filter(emp => emp.status === 'active').length;
          const adminCount = finalList.filter(emp => emp.role === 'admin').length;
          
          setLocationStats({
            totalMembers: finalList.length,
            activeMembers: activeCount,
            adminCount: adminCount
          });
          
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
  }, [decodedLocation, navigate, parentPath, adminLocations, hasAllLocations, locationFiltered]);

  // Filter employees based on search and filter
  const filterEmployees = () => {
    let filtered = employees;
    
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
  const handleDeleteUser = (employee) => {
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
        const originalTimestamp = new Date().toISOString();
        const safeTimestamp = originalTimestamp.replace(/\./g, '_').replace(/:/g, '-');
        
        // Create a backup path with the sanitized timestamp
        const backupRef = ref(database, `deleted_users/${userToDelete.id}_${safeTimestamp}`);
        
        // Save the backup with the original timestamp in the data
        await set(backupRef, {
          ...userData,
          deletedAt: originalTimestamp,
          deletedBy: user.uid,
        });
        
        // Proceed with user deletion after backup is confirmed
        await remove(userRef);
        
        // Update local state to remove the user from the UI
        setEmployees(employees.filter(emp => emp.id !== userToDelete.id));
        
        // Update stats
        setLocationStats(prev => ({
          ...prev,
          totalMembers: prev.totalMembers - 1,
          activeMembers: userToDelete.status === 'active' ? prev.activeMembers - 1 : prev.activeMembers,
          adminCount: userToDelete.role === 'admin' ? prev.adminCount - 1 : prev.adminCount
        }));
        
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
      
      // Update admin count
      setLocationStats(prev => ({
        ...prev,
        adminCount: newRole === 'admin' 
          ? prev.adminCount + 1 
          : Math.max(0, prev.adminCount - 1)
      }));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating role:', err);
      setError('Failed to update role. Please try again.');
    }
  };

  const handleBackClick = () => {
    navigate(`${parentPath}/manage-employees`);
  };

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

  if (loading) {
    return (
      <div className="location-employees-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading member data...</p>
        </div>
      </div>
    );
  }

  if (error && !employees.length) {
    return (
      <div className="location-employees-container">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredEmployees = filterEmployees();

  return (
    <div className="location-employees-container">
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

      <div className="location-header">
        <div className="location-title-area">
          <h2 className="location-title">
            <MapPin size={20} className="text-blue-400" />
            {decodedLocation}
          </h2>
          <div className="location-summary">
            <div className="summary-item">
              <Users size={14} />
              Total: {locationStats.totalMembers}
            </div>
            <div className="summary-item active-count">
              <Activity size={14} />
              Active: {locationStats.activeMembers}
            </div>
            <div className="summary-item admin-count">
              <Shield size={14} />
              Admins: {locationStats.adminCount}
            </div>
          </div>
        </div>
        <button 
          onClick={handleBackClick} 
          className="back-button"
        >
          <ChevronLeft size={18} />
          Back
        </button>
      </div>

      <div className="employee-table-view">
        <div className="header-controls">
          <div className="search-container">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-container">
            <Filter size={14} className="text-gray-400" />
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Members</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {filteredEmployees.length > 0 ? (
          <div className="employee-table-container">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Service</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Attendance</th>
                  <th>On-Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr 
                    key={employee.id} 
                    className={employee.isPadrino ? 'padrino-row' : ''}
                    onClick={() => navigate(`${parentPath}/users/${employee.id}`)}
                    style={employee.isPadrino ? {'--padrino-color': employee.padrinoColor || '#60a5fa'} : {}}
                  >
                    <td>
                      <div className="employee-name-container">
                        {employee.isPadrino ? (
                          <>
                            <span 
                              className="padrino-indicator" 
                              style={{backgroundColor: employee.padrinoColor || '#60a5fa'}}
                            />
                            <span className="employee-name">{employee.name}</span>
                          </>
                        ) : (
                          <span className="employee-name">{employee.name}</span>
                        )}
                      </div>
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
                    <td onClick={(e) => e.stopPropagation()}>
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
                            {employee.role === 'admin' ? 'Demote' : 'Promote'}
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
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No members found matching your criteria.</p>
          </div>
        )}
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

export default LocationEmployees;
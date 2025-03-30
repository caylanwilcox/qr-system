import React, { useState, useEffect } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { 
  Loader2, 
  AlertCircle, 
  Users, 
  MapPin, 
  User,
  Filter,
  X,
  CheckCircle,
  Shield,
  ShieldCheck,
  Search
} from 'lucide-react';

const ManageAdmins = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Core data
  const [admins, setAdmins] = useState([]);
  const [regularUsers, setRegularUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationAdmins, setLocationAdmins] = useState({});
  
  // UI state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Role management state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToPromote, setUserToPromote] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Initial data loading
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchAdmins(),
          fetchRegularUsers(),
          fetchLocations(),
          fetchLocationPermissions()
        ]);
      } catch (err) {
        setError('Failed to load data. Please try again.');
        console.error('Error loading initial data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch all users with admin/super-admin roles
  const fetchAdmins = async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const adminsArray = Object.entries(usersData)
          .filter(([_, data]) => {
            if (!data.profile || !data.profile.role) return false;
            
            // Check for all possible role formats
            const role = data.profile.role.toLowerCase();
            return role === 'admin' || 
                   role === 'super_admin' || 
                   role === 'super-admin' ||
                   role === 'ADMIN' || 
                   role === 'SUPER_ADMIN';
          })
          .map(([id, data]) => ({
            id,
            ...data.profile,
            stats: data.stats // include stats if present
          }));
        setAdmins(adminsArray);
      } else {
        setAdmins([]);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
      throw err;
    }
  };

  // Fetch regular users (not admin/super-admin)
  const fetchRegularUsers = async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersArray = Object.entries(usersData)
          .filter(([_, data]) => {
            if (!data.profile) return false;
            
            if (!data.profile.role) return true; // Users without role are considered regular
            
            const role = data.profile.role.toLowerCase();
            return role !== 'admin' && 
                   role !== 'super_admin' && 
                   role !== 'super-admin' &&
                   role !== 'ADMIN' && 
                   role !== 'SUPER_ADMIN';
          })
          .map(([id, data]) => ({
            id,
            ...data.profile,
            location: data.profile.location || data.profile.primaryLocation,
            primaryLocation: data.profile.primaryLocation || data.profile.location,
            managedBy: data.profile.managedBy || null
          }));
        
        setRegularUsers(usersArray);
      } else {
        setRegularUsers([]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      throw err;
    }
  };
  
  // Extract unique locations from all users
  const fetchLocations = async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const allLocations = new Set();
        
        Object.values(usersData).forEach(data => {
          if (data.profile) {
            const location = data.profile.primaryLocation || data.profile.location;
            if (location) {
              allLocations.add(location);
            }
          }
        });
        
        setLocations(Array.from(allLocations).sort());
      } else {
        setLocations([]);
      }
    } catch (err) {
      console.error('Error extracting locations:', err);
      throw err;
    }
  };
  
  // Fetch location permissions map (which admins manage which locations)
  const fetchLocationPermissions = async () => {
    try {
      const managementRef = ref(database, 'managementStructure');
      const snapshot = await get(managementRef);
      
      if (snapshot.exists()) {
        const managementData = snapshot.val();
        const locationPermissions = {};
        
        // First, initialize all locations with empty admin arrays
        locations.forEach(location => {
          locationPermissions[location] = [];
        });
        
        // Then populate with admin IDs
        Object.entries(managementData).forEach(([adminId, data]) => {
          if (data.managedLocations) {
            Object.keys(data.managedLocations).forEach(location => {
              if (!locationPermissions[location]) {
                locationPermissions[location] = [];
              }
              locationPermissions[location].push(adminId);
            });
          }
        });
        
        setLocationAdmins(locationPermissions);
      } else {
        // Initialize empty permissions
        const emptyPermissions = {};
        locations.forEach(location => {
          emptyPermissions[location] = [];
        });
        setLocationAdmins(emptyPermissions);
      }
    } catch (err) {
      console.error('Error fetching location permissions:', err);
      throw err;
    }
  };

  // Handle selecting a location to manage
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    
    // Initialize selected admins with current admins for this location
    const initialSelectedAdmins = {};
    const currentAdmins = locationAdmins[location] || [];
    
    admins.forEach(admin => {
      initialSelectedAdmins[admin.id] = currentAdmins.includes(admin.id);
    });
    
    setSelectedAdmins(initialSelectedAdmins);
  };
  
  // Toggle an admin's selection status
  const toggleAdminSelection = (adminId) => {
    setSelectedAdmins(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };
  
  // Save location admin assignments
  const saveLocationAdmins = async () => {
    if (!selectedLocation) {
      setError('Please select a location first');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get the admin IDs that are selected
      const selectedAdminIds = Object.entries(selectedAdmins)
        .filter(([_, isSelected]) => isSelected)
        .map(([adminId]) => adminId);
      
      // Batch updates for better performance
      const updates = {};
      
      // 1. First remove this location from all admins who no longer manage it
      const currentAdmins = locationAdmins[selectedLocation] || [];
      const adminsToRemove = currentAdmins.filter(adminId => !selectedAdminIds.includes(adminId));
      
      adminsToRemove.forEach(adminId => {
        updates[`managementStructure/${adminId}/managedLocations/${selectedLocation}`] = null;
      });
      
      // 2. Add this location to newly selected admins
      selectedAdminIds.forEach(adminId => {
        if (!currentAdmins.includes(adminId)) {
          // Make sure the management structure exists for this admin
          updates[`managementStructure/${adminId}/managedLocations/${selectedLocation}`] = true;
        } 
      });
      
      // 3. Update the users in this location to be managed by the first selected admin
      // (or null if no admins selected)
      const primaryAdminId = selectedAdminIds.length > 0 ? selectedAdminIds[0] : null;
      
      regularUsers
        .filter(user => (user.primaryLocation || user.location) === selectedLocation)
        .forEach(user => {
          updates[`users/${user.id}/profile/managedBy`] = primaryAdminId;
        });
      
      // Execute all updates
      await update(ref(database), updates);
      
      // Update local state
      setLocationAdmins(prev => ({
        ...prev,
        [selectedLocation]: selectedAdminIds
      }));
      
      setSuccessMessage(`Successfully updated admins for ${selectedLocation}`);
      
      // Refresh data to ensure consistency
      await fetchLocationPermissions();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update location admins');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Count users in a location
  const getUserCountByLocation = (location) => {
    return regularUsers.filter(user => 
      (user.primaryLocation || user.location) === location
    ).length;
  };
  
  // Get admin name by ID
  const getAdminName = (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    return admin ? admin.name : 'Unknown';
  };
  
  // Filter admins based on search and role filter
  const filteredAdmins = admins.filter(admin => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      (admin.name && admin.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by role with improved role matching
    let matchesRole = filterRole === 'all';
    
    if (!matchesRole) {
      const adminRole = (admin.role || '').toLowerCase();
      
      if (filterRole === 'super-admin') {
        // Match any super admin format
        matchesRole = adminRole === 'super-admin' || 
                     adminRole === 'super_admin' || 
                     adminRole === 'super admin' ||
                     adminRole === 'superadmin';
      } else if (filterRole === 'admin') {
        // Only match regular admin (not super admin)
        matchesRole = adminRole === 'admin' && 
                     !adminRole.includes('super');
      }
    }
    
    return matchesSearch && matchesRole;
  });

  // Filter users based on search query for role promotion
  const filteredUsers = [...regularUsers, ...admins].filter(user => {
    return !userSearchQuery || 
      (user.name && user.name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()));
  }).sort((a, b) => {
    // Sort by name for better usability
    return (a.name || '').localeCompare(b.name || '');
  });
  
  // Handle role change
  const handleRoleChange = async () => {
    if (!userToPromote || !selectedRole) {
      setError('Unable to update role. Missing information.');
      return;
    }

    try {
      setLoading(true);
      // Update the user's role in Firebase
      const updates = {};
      updates[`users/${userToPromote.id}/profile/role`] = selectedRole;
      
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully updated ${userToPromote.name}'s role to ${selectedRole}`);
      setShowRoleModal(false);
      setUserToPromote(null);
      
      // Refresh data to show updated roles
      await fetchAdmins();
      await fetchRegularUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle opening the role promotion modal
  const handlePromoteClick = (user) => {
    setUserToPromote(user);
    
    // Default role selection based on current role
    if (user.role === 'admin') {
      setSelectedRole('super-admin');
    } else if (user.role === 'super-admin') {
      setSelectedRole('admin'); // Downgrade option
    } else {
      setSelectedRole('admin');
    }
    
    setShowRoleModal(true);
  };
  
  // Handle demoting an admin to regular employee
  const handleDemoteAdmin = async (adminId) => {
    try {
      setLoading(true);
      // Get current admin data
      const adminRef = ref(database, `users/${adminId}`);
      const adminSnapshot = await get(adminRef);
      
      if (!adminSnapshot.exists()) {
        setError('Admin user not found');
        return;
      }
      
      const adminData = adminSnapshot.val();
      
      // Check if this admin manages users
      const managementRef = ref(database, `managementStructure/${adminId}`);
      const managementSnapshot = await get(managementRef);
      
      // Create updates object
      const updates = {};
      
      // Update role to regular employee
      updates[`users/${adminId}/profile/role`] = 'employee';
      
      // If this admin manages users, reassign them
      if (managementSnapshot.exists()) {
        const managementData = managementSnapshot.val();
        
        if (managementData.manages) {
          // Remove all users from this admin's management
          Object.keys(managementData.manages).forEach(userId => {
            updates[`users/${userId}/profile/managedBy`] = null;
          });
          
          // Remove management structure
          updates[`managementStructure/${adminId}`] = null;
        }
      }
      
      // Execute updates
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully demoted ${adminData.profile?.name || 'admin'} to regular employee`);
      
      // Refresh data
      await fetchAdmins();
      await fetchRegularUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to demote admin');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Update the dropdown options to be more comprehensive
  const roleFilterOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Admin Only' },
    { value: 'super-admin', label: 'Super Admin Only' }
  ];
  
  // Clear any error or success messages
  const clearMessages = () => {
    setError(null);
    setSuccessMessage('');
  };
  
  // Loading overlay component
  const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-md">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
        <p className="text-white font-medium">Processing your request...</p>
      </div>
    </div>
  );
  
  // Notification component
  const Notification = ({ type, message, onDismiss }) => (
    <div className={`fixed top-4 right-4 max-w-md z-50 shadow-lg rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm
      ${type === 'error' ? 'bg-red-900 bg-opacity-20 border border-red-500 text-red-400' : 
        'bg-green-900 bg-opacity-20 border border-green-500 text-green-400'}`}>
      <span className="flex-shrink-0 mt-1">
        {type === 'error' ? 
          <AlertCircle className="h-5 w-5" /> : 
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

  if (loading && admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-12 w-12 text-blue-500 mb-4" />
        <p className="text-white">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Admin Management Dashboard</h1>
      
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

      {/* Loading overlay */}
      {loading && <LoadingOverlay />}

      {/* User Role Management Section */}
      <div className="mb-8 bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-white text-xl font-medium flex items-center gap-2">
            <Shield size={20} className="text-purple-400" /> 
            User Role Management
          </h2>
        </div>
        
        <div className="p-4">
          <p className="text-gray-300 mb-4">
            Promote regular users to admin or super-admin roles, or change existing admin roles.
          </p>
          
          {/* Search for users */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search for users by name or email..."
                className="w-full bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Search size={18} />
              </div>
              {userSearchQuery && (
                <button
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          
          {/* User list */}
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  No users found matching your search
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {filteredUsers.map(user => {
                    const isAdmin = user.role === 'admin';
                    const isSuperAdmin = user.role === 'super-admin' || user.role === 'super_admin';
                    
                    return (
                      <div 
                        key={user.id}
                        className="p-4 flex items-center justify-between hover:bg-gray-700 hover:bg-opacity-20"
                      >
                        <div className="flex items-center gap-3">
                          {isSuperAdmin ? (
                            <ShieldCheck size={20} className="text-purple-400" />
                          ) : isAdmin ? (
                            <Shield size={20} className="text-blue-400" />
                          ) : (
                            <User size={20} className="text-gray-400" />
                          )}
                          
                          <div>
                            <div className="text-white font-medium">{user.name || 'Unknown User'}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {user.email && (
                                <span className="text-sm text-gray-400">{user.email}</span>
                              )}
                              {user.role && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  isSuperAdmin 
                                    ? 'bg-purple-900 bg-opacity-30 text-purple-400'
                                    : isAdmin
                                      ? 'bg-blue-900 bg-opacity-30 text-blue-400'
                                      : 'bg-gray-700 bg-opacity-40 text-gray-300'
                                }`}>
                                  {user.role}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!isSuperAdmin && (
                            <button
                              onClick={() => handlePromoteClick(user)}
                              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 font-medium ${
                                isAdmin
                                  ? 'bg-purple-900 bg-opacity-20 text-purple-400 border border-purple-500 border-opacity-30'
                                  : 'bg-blue-900 bg-opacity-20 text-blue-400 border border-blue-500 border-opacity-30'
                              }`}
                            >
                              {isAdmin ? (
                                <>
                                  <ShieldCheck size={16} />
                                  Make Super-Admin
                                </>
                              ) : (
                                <>
                                  <Shield size={16} />
                                  Make Admin
                                </>
                              )}
                            </button>
                          )}
                          
                          {(isAdmin || isSuperAdmin) && (
                            <button
                              onClick={() => handleDemoteAdmin(user.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-900 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30 text-sm flex items-center gap-1.5 font-medium"
                            >
                              <User size={16} />
                              Demote to Employee
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column - Locations List */}
        <div className="md:col-span-4 lg:col-span-3">
          <div className="bg-gray-900 bg-opacity-40 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-white text-xl font-medium flex items-center gap-2">
                <MapPin size={20} className="text-blue-400" /> 
                Locations
              </h2>
            </div>
            
            <div className="divide-y divide-gray-700">
              {locations.length === 0 ? (
                <div className="p-4 text-center text-gray-400">
                  No locations found
                </div>
              ) : (
                locations.map(location => {
                  const isSelected = location === selectedLocation;
                  const userCount = getUserCountByLocation(location);
                  const adminCount = (locationAdmins[location] || []).length;
                  
                  return (
                    <div 
                      key={location}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-900 bg-opacity-20 border-l-4 border-blue-500'
                          : 'hover:bg-gray-700 hover:bg-opacity-20 border-l-4 border-transparent'
                      }`}
                      onClick={() => handleLocationSelect(location)}
                    >
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{location}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Users size={12} />
                            {userCount} users
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <User size={12} />
                            {adminCount} admins
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Right Column - Admin Assignment */}
        <div className="md:col-span-8 lg:col-span-9">
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-white text-xl font-medium flex items-center gap-2">
                <Users size={20} className="text-blue-400" /> 
                {selectedLocation ? `Assign Admins to ${selectedLocation}` : 'Select a Location'}
              </h2>
            </div>
            
            {!selectedLocation ? (
              <div className="p-8 text-center text-gray-400">
                Please select a location from the left panel to manage its administrators
              </div>
            ) : (
              <>
                {/* Admin Filter and Search */}
                <div className="p-4 border-b border-gray-700 bg-gray-800 bg-opacity-20">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search administrators..."
                        className="w-full bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-2 pl-9 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <Users size={16} />
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                          aria-label="Clear search"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-2 pl-3">
                      <Filter size={16} className="text-gray-400" />
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="bg-transparent text-white focus:outline-none"
                      >
                        {roleFilterOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Admin List */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredAdmins.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      No administrators match your search criteria
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {filteredAdmins.map(admin => {
                        const isSelected = selectedAdmins[admin.id];
                        
                        return (
                          <div 
                            key={admin.id}
                            className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected 
                                ? 'bg-blue-900 bg-opacity-20' 
                                : 'hover:bg-gray-700 hover:bg-opacity-20'
                            }`}
                            onClick={() => toggleAdminSelection(admin.id)}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAdminSelection(admin.id)}
                                className="h-5 w-5 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{admin.name || 'Unknown Admin'}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    admin.role === 'super-admin' || admin.role === 'super_admin'
                                      ? 'bg-purple-900 bg-opacity-30 text-purple-400'
                                      : 'bg-blue-900 bg-opacity-30 text-blue-400'
                                  }`}>
                                    {admin.role}
                                  </span>
                                </div>
                                {admin.primaryLocation || admin.location ? (
                                  <div className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                                    <MapPin size={14} />
                                    {admin.primaryLocation || admin.location}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            
                            {/* Show badge for already assigned admins */}
                            {locationAdmins[selectedLocation]?.includes(admin.id) && !isSelected && (
                              <span className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 px-2 py-1 rounded-full">
                                Currently assigned
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="p-4 border-t border-gray-700 bg-gray-800 bg-opacity-20 flex justify-between items-center">
                  <div className="text-sm text-gray-400">
                    {Object.values(selectedAdmins).filter(Boolean).length} administrators selected
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleLocationSelect(selectedLocation)} // Reset selections
                      className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-30"
                    >
                      Reset
                    </button>
                    
                    <button
                      onClick={saveLocationAdmins}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Save Changes
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Location Details */}
          {selectedLocation && (
            <div className="mt-6 bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-white text-xl font-medium flex items-center gap-2">
                  <MapPin size={20} className="text-blue-400" /> 
                  {selectedLocation} Details
                </h2>
              </div>
              
              <div className="p-4">
                <h3 className="text-white font-medium mb-2">Current Administrators:</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {(locationAdmins[selectedLocation] || []).length === 0 ? (
                    <div className="text-gray-400">No administrators assigned</div>
                  ) : (
                    locationAdmins[selectedLocation].map(adminId => {
                      const admin = admins.find(a => a.id === adminId);
                      if (!admin) return null;
                      
                      return (
                        <div 
                          key={adminId}
                          className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-blue-400" />
                            <span className="text-white">{admin.name || 'Unknown Admin'}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{admin.role}</div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                <h3 className="text-white font-medium mb-2">Users in this location:</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {regularUsers
                    .filter(user => (user.primaryLocation || user.location) === selectedLocation)
                    .map(user => (
                      <div 
                        key={user.id}
                        className="flex items-center gap-2 bg-gray-800 bg-opacity-30 p-2 rounded-lg border border-gray-700 border-opacity-50"
                      >
                        <User size={16} className="text-gray-400" />
                        <span className="text-white text-sm truncate">{user.name || 'Unknown User'}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Role Management Modal */}
      {showRoleModal && userToPromote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Update Role for {userToPromote.name || 'User'}
            </h3>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrator</option>
                <option value="super-admin">Super Administrator</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleRoleChange}
                className="px-4 py-2 rounded-lg bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAdmins;
              
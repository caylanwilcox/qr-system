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
  Search,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Settings,
  Home,
  ArrowLeft
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
  const [activeTab, setActiveTab] = useState('location-assignment'); // 'location-assignment', 'role-management'
  const [locationFilter, setLocationFilter] = useState('');
  const [showAvailableAdminsOnly, setShowAvailableAdminsOnly] = useState(false);

  // Role management state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToPromote, setUserToPromote] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Quick assign modal
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
  const [quickAssignLocation, setQuickAssignLocation] = useState('');
  const [quickAssignUserSearch, setQuickAssignUserSearch] = useState('');
  const [quickAssignRole, setQuickAssignRole] = useState('admin');

  // Initial data loading
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // First fetch locations so we have them available for other functions
        await fetchLocations();
        
        // Then fetch all other data in parallel
        const [adminsResult, usersResult, permissionsResult] = await Promise.all([
          fetchAdmins(),
          fetchRegularUsers(),
          fetchLocationPermissions()
        ]);
        
        // Store the direct results first
        setAdmins(adminsResult);
        setRegularUsers(usersResult);
        setLocationAdmins(permissionsResult);
        
        console.log("Initial data loaded:", {
          admins: adminsResult.length,
          users: usersResult.length,
          locations: locations.length,
          permissions: permissionsResult
        });
        
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
        return adminsArray;
      } else {
        return [];
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
            location: data.location || data.profile.location || data.profile.primaryLocation,
            primaryLocation: data.profile.primaryLocation || data.profile.location,
            managedBy: data.profile.managedBy || null
          }));
        
        return usersArray;
      } else {
        return [];
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      throw err;
    }
  };
  
  // Extract unique locations from all users
  const fetchLocations = async () => {
    try {
      // Try multiple approaches to ensure we get locations data
      
      // Approach 1: Try the compatibility node first (fastest)
      const compatListRef = ref(database, 'locationsList');
      const compatListSnapshot = await get(compatListRef);
      
      if (compatListSnapshot.exists()) {
        const locationsList = compatListSnapshot.val();
        if (Array.isArray(locationsList) && locationsList.length > 0) {
          setLocations(locationsList.sort());
          return locationsList.sort();
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
          return locationNames.sort();
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
              data.primaryLocation
            ];
            
            possibleLocations.forEach(loc => {
              if (loc && typeof loc === 'string' && loc.trim() !== '') {
                allLocations.add(loc.trim());
              }
            });
          }
        });
        
        const sortedLocations = Array.from(allLocations).sort();
        setLocations(sortedLocations);
        return sortedLocations;
      } else {
        setLocations([]);
        return [];
      }
    } catch (err) {
      console.error('Error extracting locations:', err);
      setLocations([]);
      throw err;
    }
  };

  // Fetch location permissions map (which admins manage which locations)
  const fetchLocationPermissions = async () => {
    try {
      const managementRef = ref(database, 'managementStructure');
      const snapshot = await get(managementRef);
      
      // Try to ensure locations are loaded first
      let locationsList = locations;
      if (!locationsList || locationsList.length === 0) {
        // If locations not loaded yet, try to fetch them
        locationsList = await fetchLocations();
      }
      
      // First, get a mapping of location keys to names for reference
      const locationsRef = ref(database, 'locations');
      const locationsSnapshot = await get(locationsRef);
      const locationKeyToName = {};
      const locationNameToKey = {};
      
      if (locationsSnapshot.exists()) {
        const locationsData = locationsSnapshot.val();
        
        Object.values(locationsData).forEach(location => {
          if (typeof location === 'object' && location !== null && location.name && location.key) {
            locationKeyToName[location.key] = location.name;
            locationNameToKey[location.name] = location.key;
          }
        });
      }
      
      // Initialize permissions object with empty arrays for all locations
      const locationPermissions = {};
      locationsList.forEach(location => {
        locationPermissions[location] = [];
      });
      
      // If there's management data, populate the permissions
      if (snapshot.exists()) {
        const managementData = snapshot.val();
        
        // Process each admin's permissions
        Object.entries(managementData).forEach(([adminId, data]) => {
          if (data.managedLocations) {
            Object.keys(data.managedLocations).forEach(locationIdentifier => {
              // Case 1: It's a location name directly in our locations list
              if (locationsList.includes(locationIdentifier)) {
                locationPermissions[locationIdentifier].push(adminId);
              }
              // Case 2: It's a location key, and we need to find the corresponding name
              else if (locationKeyToName[locationIdentifier] && 
                      locationsList.includes(locationKeyToName[locationIdentifier])) {
                const locationName = locationKeyToName[locationIdentifier];
                locationPermissions[locationName].push(adminId);
              }
              // Case 4: It's a wildcard location (*) for super admins
              else if (locationIdentifier === '*') {
                // Give this admin access to all locations
                locationsList.forEach(location => {
                  locationPermissions[location].push(adminId);
                });
              }
            });
          }
        });
      }
      
      return locationPermissions;
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
      
      // Get mapping of location names to keys
      const locationsRef = ref(database, 'locations');
      const locationsSnapshot = await get(locationsRef);
      let locationKey = null;
      
      if (locationsSnapshot.exists()) {
        const locationsData = locationsSnapshot.val();
        
        // Find the location key for the selected location name
        Object.values(locationsData).forEach(location => {
          if (typeof location === 'object' && location !== null && 
              location.name === selectedLocation) {
            locationKey = location.key;
          }
        });
      }
      
      // Use location name if key not found
      const locationIdentifier = locationKey || selectedLocation;
      
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
        // Remove both by key and by name to ensure backward compatibility
        updates[`managementStructure/${adminId}/managedLocations/${selectedLocation}`] = null;
        
        if (locationKey) {
          updates[`managementStructure/${adminId}/managedLocations/${locationKey}`] = null;
        }
      });
      
      // 2. Add this location to newly selected admins
      selectedAdminIds.forEach(adminId => {
        if (!currentAdmins.includes(adminId)) {
          // Add both by key and by name for backward compatibility
          updates[`managementStructure/${adminId}/managedLocations/${selectedLocation}`] = true;
          
          if (locationKey) {
            updates[`managementStructure/${adminId}/managedLocations/${locationKey}`] = true;
          }
          
          // Ensure role is set
          const admin = admins.find(a => a.id === adminId);
          if (admin && admin.role) {
            updates[`managementStructure/${adminId}/role`] = admin.role;
          }
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
      const updatedPermissions = await fetchLocationPermissions();
      setLocationAdmins(updatedPermissions);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update location admins');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle quick assign
  const handleQuickAssign = async () => {
    if (!quickAssignLocation || !userToPromote) {
      setError('Please select both a location and a user');
      return;
    }
    
    try {
      setLoading(true);
      
      // First update the user's role if needed
      if (!userToPromote.role || userToPromote.role.toLowerCase() !== quickAssignRole.toLowerCase()) {
        await update(ref(database, `users/${userToPromote.id}/profile`), {
          role: quickAssignRole
        });
      }
      
      // Then assign them to the location
      const updates = {};
      
      // Add location to this admin's managed locations
      updates[`managementStructure/${userToPromote.id}/managedLocations/${quickAssignLocation}`] = true;
      updates[`managementStructure/${userToPromote.id}/role`] = quickAssignRole;
      
      // Update local state to include this new admin
      await update(ref(database), updates);
      
      // Reset form
      setSuccessMessage(`Successfully assigned ${userToPromote.name} as ${quickAssignRole} to ${quickAssignLocation}`);
      setShowQuickAssignModal(false);
      setUserToPromote(null);
      
      // Refresh data
      const [adminsResult, permissionsResult] = await Promise.all([
        fetchAdmins(),
        fetchLocationPermissions()
      ]);
      
      setAdmins(adminsResult);
      setLocationAdmins(permissionsResult);
      
      // If the quickly assigned location is the currently selected one, update its selected admins
      if (selectedLocation === quickAssignLocation) {
        handleLocationSelect(quickAssignLocation);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to assign admin');
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
  const getFilteredAdmins = () => {
    return admins.filter(admin => {
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
      
      // Filter by location if showAvailableAdminsOnly is true
      let matchesLocationFilter = true;
      if (selectedLocation && showAvailableAdminsOnly) {
        // Admin doesn't already manage this location
        matchesLocationFilter = !(locationAdmins[selectedLocation] || []).includes(admin.id);
      }
      
      return matchesSearch && matchesRole && matchesLocationFilter;
    });
  };

  // Filter locations based on search
  const filteredLocations = locations.filter(location => 
    !locationFilter || location.toLowerCase().includes(locationFilter.toLowerCase())
  );

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
      const [adminsResult, usersResult] = await Promise.all([
        fetchAdmins(),
        fetchRegularUsers()
      ]);
      
      setAdmins(adminsResult);
      setRegularUsers(usersResult);
      
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
      const [adminsResult, usersResult, permissionsResult] = await Promise.all([
        fetchAdmins(),
        fetchRegularUsers(),
        fetchLocationPermissions()
      ]);
      
      setAdmins(adminsResult);
      setRegularUsers(usersResult);
      setLocationAdmins(permissionsResult);
      
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
      {/* Top Navigation Bar */}
      <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-3 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 bg-opacity-20 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Admin Management</h1>
            <p className="text-sm text-gray-400">Manage administrators across locations</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'location-assignment'
                ? 'bg-blue-900 bg-opacity-30 text-blue-400 border border-blue-600 border-opacity-30'
                : 'text-gray-400 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
            onClick={() => setActiveTab('location-assignment')}
          >
            <MapPin size={16} />
            Location Assignment
          </button>
          
          <button
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'role-management'
                ? 'bg-purple-900 bg-opacity-30 text-purple-400 border border-purple-600 border-opacity-30'
                : 'text-gray-400 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
            onClick={() => setActiveTab('role-management')}
          >
            <Shield size={16} />
            Role Management
          </button>
          
          <button
            onClick={() => setShowQuickAssignModal(true)}
            className="px-4 py-2 bg-green-600 bg-opacity-20 hover:bg-opacity-30 text-green-400 rounded-lg font-medium flex items-center gap-2 border border-green-500 border-opacity-20"
          >
            <UserPlus size={16} />
            Quick Assign Admin
          </button>
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

      {/* Loading overlay */}
      {loading && <LoadingOverlay />}

      {/* Location Assignment Tab */}
      {activeTab === 'location-assignment' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column - Locations List */}
          <div className="md:col-span-4 lg:col-span-3">
            <div className="bg-gray-900 bg-opacity-40 border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-white text-lg font-medium flex items-center gap-2">
                  <MapPin size={18} className="text-blue-400" /> 
                  Locations
                </h2>
                <span className="text-xs text-gray-400 bg-gray-800 bg-opacity-40 px-2 py-1 rounded-full">
                  {locations.length} total
                </span>
              </div>
              
              {/* Location search */}
              <div className="p-3 border-b border-gray-700">
                <div className="relative">
                  <input
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-2 pl-9 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={14} />
                  </div>
                  {locationFilter && (
                    <button
                      onClick={() => setLocationFilter('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-gray-700 max-h-[65vh] overflow-y-auto">
                {filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    No locations found
                  </div>
                ) : (
                  filteredLocations.map(location => {
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
                              <Shield size={12} />
                              {adminCount} admins
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <ChevronRight size={18} className="text-blue-400" />
                        )}
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
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-white text-xl font-medium flex items-center gap-2">
                  {selectedLocation ? (
                    <>
                      <MapPin size={20} className="text-blue-400" />
                      Manage Admins: {selectedLocation}
                    </>
                  ) : (
                    <>
                      <Users size={20} className="text-blue-400" /> 
                      Select a Location
                    </>
                  )}
                </h2>
                
                {selectedLocation && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowQuickAssignModal(true)}
                      className="px-3 py-1.5 rounded-lg text-sm bg-green-600 bg-opacity-20 hover:bg-opacity-30 text-green-400 flex items-center gap-1.5 font-medium border border-green-500 border-opacity-20"
                    >
                      <UserPlus size={16} />
                      Add New Admin
                    </button>
                  </div>
                )}
              </div>
              
              {!selectedLocation ? (
                <div className="p-8 text-center text-gray-400 bg-gray-800 bg-opacity-10">
                  <MapPin size={48} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-lg font-medium text-gray-300 mb-2">No Location Selected</p>
                  <p className="max-w-md mx-auto">
                    Please select a location from the left panel to view and manage its administrators
                  </p>
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
                          <Search size={16} />
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
                      
                      <div className="flex items-center">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showAvailableAdminsOnly}
                            onChange={() => setShowAvailableAdminsOnly(!showAvailableAdminsOnly)}
                            className="rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                          />
                          Show available admins only
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Admin List */}
                  <div className="max-h-[45vh] overflow-y-auto">
                    {getFilteredAdmins().length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        No administrators match your search criteria
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-700">
                        {getFilteredAdmins().map(admin => {
                          const isSelected = selectedAdmins[admin.id];
                          const isAssigned = locationAdmins[selectedLocation]?.includes(admin.id);
                          const isSuperAdmin = admin.role?.toLowerCase() === 'super-admin' || 
                                            admin.role?.toLowerCase() === 'super_admin';
                          
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
                                    {isSuperAdmin ? (
                                      <ShieldCheck size={18} className="text-purple-400" />
                                    ) : (
                                      <Shield size={18} className="text-blue-400" />
                                    )}
                                    <span className="text-white font-medium">{admin.name || 'Unknown Admin'}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      isSuperAdmin
                                        ? 'bg-purple-900 bg-opacity-30 text-purple-400'
                                        : 'bg-blue-900 bg-opacity-30 text-blue-400'
                                    }`}>
                                      {admin.role}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                    {admin.email && (
                                      <span>{admin.email}</span>
                                    )}
                                    {admin.primaryLocation || admin.location ? (
                                      <div className="flex items-center gap-1">
                                        <MapPin size={14} />
                                        {admin.primaryLocation || admin.location}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Show badge for already assigned admins */}
                              {isAssigned && !isSelected && (
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
                  
                  {/* Location Details */}
                  <div className="p-4 border-t border-gray-700 bg-gray-800 bg-opacity-40">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Users size={16} className="text-blue-400" />
                      Current Administrators
                    </h3>
                    
                    {!locationAdmins[selectedLocation] || locationAdmins[selectedLocation].length === 0 ? (
                      <div className="text-gray-400 text-sm italic">No administrators currently assigned</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {locationAdmins[selectedLocation].map(adminId => {
                          const admin = admins.find(a => a.id === adminId);
                          if (!admin) return null;
                          
                          const isSuperAdmin = admin.role?.toLowerCase() === 'super-admin' || 
                                            admin.role?.toLowerCase() === 'super_admin';
                          
                          return (
                            <div 
                              key={adminId}
                              className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-2 flex items-center gap-2"
                            >
                              {isSuperAdmin ? (
                                <ShieldCheck size={16} className="text-purple-400" />
                              ) : (
                                <Shield size={16} className="text-blue-400" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm truncate">{admin.name || 'Unknown Admin'}</div>
                                <div className="text-xs text-gray-400">{admin.role}</div>
                              </div>
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
            
            {/* User info for the selected location */}
            {selectedLocation && (
              <div className="mt-6 bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="text-white text-lg font-medium flex items-center gap-2">
                    <Users size={18} className="text-blue-400" /> 
                    Users in {selectedLocation}
                  </h2>
                </div>
                
                <div className="p-4">
                  {regularUsers.filter(user => (user.primaryLocation || user.location) === selectedLocation).length === 0 ? (
                    <div className="text-gray-400 text-sm italic">No users in this location</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
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
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Role Management Tab */}
      {activeTab === 'role-management' && (
        <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden">
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
              <div className="grid grid-cols-3 gap-4 p-3 border-b border-gray-700 bg-gray-900 bg-opacity-40 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div>User</div>
                <div>Location</div>
                <div>Actions</div>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto">
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
                          className="p-4 grid grid-cols-3 gap-4 hover:bg-gray-700 hover:bg-opacity-20"
                        >
                          <div className="flex items-center gap-3">
                            {isSuperAdmin ? (
                              <ShieldCheck size={20} className="text-purple-400 flex-shrink-0" />
                            ) : isAdmin ? (
                              <Shield size={20} className="text-blue-400 flex-shrink-0" />
                            ) : (
                              <User size={20} className="text-gray-400 flex-shrink-0" />
                            )}
                            
                            <div className="min-w-0">
                              <div className="text-white font-medium truncate">{user.name || 'Unknown User'}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {user.email && (
                                  <span className="text-sm text-gray-400 truncate">{user.email}</span>
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
                          
                          <div className="flex items-center">
                            {user.primaryLocation || user.location ? (
                              <div className="flex items-center gap-2 text-gray-300">
                                <MapPin size={16} className="text-gray-400" />
                                {user.primaryLocation || user.location}
                              </div>
                            ) : (
                              <span className="text-gray-500 italic">No assigned location</span>
                            )}
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
                                Demote
                              </button>
                            )}
                            
                            {(isAdmin || isSuperAdmin) && user.primaryLocation && (
                              <button
                                onClick={() => {
                                  setSelectedLocation(user.primaryLocation);
                                  setActiveTab('location-assignment');
                                  setTimeout(() => {
                                    const initialSelectedAdmins = {};
                                    admins.forEach(admin => {
                                      initialSelectedAdmins[admin.id] = (locationAdmins[user.primaryLocation] || []).includes(admin.id);
                                    });
                                    // Add this user if not already in the list
                                    initialSelectedAdmins[user.id] = true;
                                    setSelectedAdmins(initialSelectedAdmins);
                                  }, 100);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-green-900 bg-opacity-20 text-green-400 border border-green-500 border-opacity-30 text-sm flex items-center gap-1.5 font-medium"
                              >
                                <MapPin size={16} />
                                Assign
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
      )}
      
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
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Assign Modal */}
      {showQuickAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <UserPlus size={20} className="text-green-400" />
                Quick Assign Admin
              </h3>
              <button
                onClick={() => setShowQuickAssignModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Location selection */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">Location</label>
              <select
                value={quickAssignLocation}
                onChange={(e) => setQuickAssignLocation(e.target.value)}
                className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a location</option>
                {locations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
            
            {/* User selection with search */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-2">User to Assign</label>
              <div className="relative">
                <input
                  type="text"
                  value={quickAssignUserSearch}
                  onChange={(e) => setQuickAssignUserSearch(e.target.value)}
                  placeholder="Search for a user..."
                  className="w-full bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-3 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
              </div>
              
              <div className="max-h-40 overflow-y-auto bg-gray-900 bg-opacity-40 border border-gray-700 rounded-lg">
                {filteredUsers
                  .filter(user => 
                    !quickAssignUserSearch || 
                    user.name?.toLowerCase().includes(quickAssignUserSearch.toLowerCase()) ||
                    user.email?.toLowerCase().includes(quickAssignUserSearch.toLowerCase())
                  )
                  .map(user => (
                    <div 
                      key={user.id}
                      className={`p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-700 hover:bg-opacity-30 ${
                        userToPromote?.id === user.id ? 'bg-blue-900 bg-opacity-20' : ''
                      }`}
                      onClick={() => setUserToPromote(user)}
                    >
                      <User size={16} className="text-gray-400" />
                      <div>
                        <div className="text-white text-sm">{user.name || 'Unknown User'}</div>
                        {user.email && (
                          <div className="text-xs text-gray-400">{user.email}</div>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            {/* Role selection */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm mb-2">Role</label>
              <select
                value={quickAssignRole}
                onChange={(e) => setQuickAssignRole(e.target.value)}
                className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrator</option>
                <option value="super-admin">Super Administrator</option>
              </select>
            </div>
            
            {userToPromote && (
              <div className="bg-blue-900 bg-opacity-10 border border-blue-500 border-opacity-20 rounded-lg p-3 mb-6">
                <h4 className="font-medium text-blue-400 mb-1">Selected User</h4>
                <div className="flex items-center gap-2">
                  <User size={18} className="text-blue-400" />
                  <div>
                    <div className="text-white">{userToPromote.name}</div>
                    {userToPromote.email && (
                      <div className="text-sm text-gray-400">{userToPromote.email}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3"><button
                onClick={() => setShowQuickAssignModal(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleQuickAssign}
                disabled={!quickAssignLocation || !userToPromote}
                className={`px-4 py-2 rounded-lg ${
                  !quickAssignLocation || !userToPromote
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } font-medium flex items-center gap-2`}
              >
                <UserPlus size={18} />
                Assign to Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAdmins;
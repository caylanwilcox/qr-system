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
  ArrowLeft,
  Eye,
  EyeOff,
  Star,
  Building,
  Mail,
  Phone,
  Calendar,
  Activity,
  TrendingUp,
  MoreVertical,
  Edit3,
  Trash2,
  RefreshCw
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'role', 'location'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

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

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');

  // Enhanced filtering and sorting
  const roleFilterOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Administrators' },
    { value: 'super-admin', label: 'Super Administrators' },
    { value: 'regular', label: 'Regular Users' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'role', label: 'Role' },
    { value: 'location', label: 'Location' },
    { value: 'recent', label: 'Recently Added' }
  ];

  // Computed values for better UX
  const filteredLocations = locations.filter(location =>
    location.toLowerCase().includes(locationFilter.toLowerCase())
  );

  const filteredUsers = [...admins, ...regularUsers]
    .filter(user => {
      const matchesSearch = !userSearchQuery || 
        user.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(userSearchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'all' || 
        (filterRole === 'regular' && (!user.role || !['admin', 'super-admin', 'super_admin'].includes(user.role.toLowerCase()))) ||
        (filterRole === 'admin' && user.role?.toLowerCase() === 'admin') ||
        (filterRole === 'super-admin' && ['super-admin', 'super_admin'].includes(user.role?.toLowerCase()));
      
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'role':
          aValue = a.role || 'regular';
          bValue = b.role || 'regular';
          break;
        case 'location':
          aValue = a.primaryLocation || a.location || '';
          bValue = b.primaryLocation || b.location || '';
          break;
        default:
          aValue = a.name || '';
          bValue = b.name || '';
      }
      
      const comparison = aValue.localeCompare(bValue);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

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

  // Get user count by location
  const getUserCountByLocation = (location) => {
    return regularUsers.filter(user => 
      (user.primaryLocation || user.location) === location
    ).length;
  };

  // Get admin name by ID
  const getAdminName = (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    return admin ? admin.name : 'Unknown Admin';
  };

  // Get filtered admins based on search and filters
  const getFilteredAdmins = () => {
    return admins.filter(admin => {
      const matchesSearch = !searchQuery || 
        admin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        admin.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = filterRole === 'all' || 
        (filterRole === 'admin' && admin.role?.toLowerCase() === 'admin') ||
        (filterRole === 'super-admin' && ['super-admin', 'super_admin'].includes(admin.role?.toLowerCase()));
      
      const matchesAvailability = !showAvailableAdminsOnly || 
        !selectedLocation || 
        !(locationAdmins[selectedLocation] || []).includes(admin.id);
      
      return matchesSearch && matchesRole && matchesAvailability;
    });
  };

  // Handle role change
  const handleRoleChange = async () => {
    if (!userToPromote || !selectedRole) {
      setError('Please select a role');
      return;
    }
    
    try {
      setLoading(true);
      
      // Update user role in database
      await update(ref(database, `users/${userToPromote.id}/profile`), {
        role: selectedRole
      });
      
      // Update local state
      if (selectedRole === 'admin' || selectedRole === 'super-admin') {
        // Move from regular users to admins
        const updatedRegularUsers = regularUsers.filter(u => u.id !== userToPromote.id);
        const updatedAdmins = [...admins, { ...userToPromote, role: selectedRole }];
        
        setRegularUsers(updatedRegularUsers);
        setAdmins(updatedAdmins);
      }
      
      setSuccessMessage(`Successfully updated ${userToPromote.name}'s role to ${selectedRole}`);
      setShowRoleModal(false);
      setUserToPromote(null);
      setSelectedRole('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle promote click
  const handlePromoteClick = (user) => {
    setUserToPromote(user);
    
    // Set default role based on current role
    if (!user.role || user.role.toLowerCase() === 'regular') {
      setSelectedRole('admin');
    } else if (user.role.toLowerCase() === 'admin') {
      setSelectedRole('super-admin');
    }
    
    setShowRoleModal(true);
  };

  // Handle demote admin
  const handleDemoteAdmin = async (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    const adminName = admin ? admin.name : 'this administrator';
    
    setConfirmTitle('Demote Administrator');
    setConfirmMessage(`Are you sure you want to demote ${adminName}? This will remove all their admin privileges and cannot be undone.`);
    setConfirmAction(() => async () => {
      try {
        setLoading(true);
        
        // Update user role to regular user
        await update(ref(database, `users/${adminId}/profile`), {
          role: null
        });
        
        // Remove from all management structures
        const managementRef = ref(database, `managementStructure/${adminId}`);
        await set(managementRef, null);
        
        // Update local state
        const demotedAdmin = admins.find(a => a.id === adminId);
        if (demotedAdmin) {
          const updatedAdmins = admins.filter(a => a.id !== adminId);
          const updatedRegularUsers = [...regularUsers, { ...demotedAdmin, role: null }];
          
          setAdmins(updatedAdmins);
          setRegularUsers(updatedRegularUsers);
          
          // Update location admins
          const updatedLocationAdmins = { ...locationAdmins };
          Object.keys(updatedLocationAdmins).forEach(location => {
            updatedLocationAdmins[location] = updatedLocationAdmins[location].filter(id => id !== adminId);
          });
          setLocationAdmins(updatedLocationAdmins);
        }
        
        setSuccessMessage(`Successfully demoted ${adminName}`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to demote administrator');
        console.error('Error:', err);
      } finally {
        setLoading(false);
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  // Clear all messages
  const clearMessages = () => {
    setError(null);
    setSuccessMessage('');
  };

  // Loading overlay component
  const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
        <p className="text-white">Processing...</p>
      </div>
    </div>
  );
  
  // Notification component
  const Notification = ({ type, message, onDismiss }) => (
    <div className={`fixed top-4 right-4 max-w-md z-50 shadow-lg rounded-lg p-4 flex items-start gap-3 backdrop-blur-sm animate-in slide-in-from-right duration-300
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
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );

  // Enhanced Stats Card Component
  const StatsCard = ({ icon, title, value, subtitle, color = 'blue' }) => (
    <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl p-4 hover:bg-opacity-60 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg bg-${color}-500 bg-opacity-20`}>
          {icon}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-gray-400">{subtitle}</div>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-sm font-medium text-gray-300">{title}</div>
      </div>
    </div>
  );

  // Enhanced User Card Component
  const UserCard = ({ user, isSelected, onSelect, showActions = true }) => {
    const isAdmin = user.role === 'admin';
    const isSuperAdmin = user.role === 'super-admin' || user.role === 'super_admin';
    
    return (
      <div className={`bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl p-4 hover:bg-opacity-60 transition-all duration-200 ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-900 bg-opacity-20' : ''
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {showActions && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect(user.id)}
                className="h-4 w-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
            )}
            <div className={`p-2 rounded-lg ${
              isSuperAdmin ? 'bg-purple-500 bg-opacity-20' :
              isAdmin ? 'bg-blue-500 bg-opacity-20' :
              'bg-gray-500 bg-opacity-20'
            }`}>
              {isSuperAdmin ? (
                <ShieldCheck size={20} className="text-purple-400 flex-shrink-0" />
              ) : isAdmin ? (
                <Shield size={20} className="text-blue-400 flex-shrink-0" />
              ) : (
                <User size={20} className="text-gray-400 flex-shrink-0" />
              )}
            </div>
          </div>
          
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{user.name || 'Unknown User'}</div>
            {user.email && (
              <div className="text-sm text-gray-400 truncate flex items-center gap-1">
                <Mail size={12} />
                {user.email}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Confirmation Modal Component
  const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-500 bg-opacity-20">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">
              {title}
            </h3>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-300 leading-relaxed">
              {message}
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50 transition-all duration-200"
            >
              Cancel
            </button>
            
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium transition-all duration-200 shadow-lg"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading && admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-12 w-12 text-blue-500 mb-4" />
        <p className="text-white">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 bg-opacity-60 border border-gray-700 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500 bg-opacity-20 p-3 rounded-xl">
              <Settings className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Management</h1>
              <p className="text-gray-400 mt-1">Manage administrators and user roles across all locations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-700 bg-opacity-50 hover:bg-opacity-70 text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-all duration-200"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            
            <button
              onClick={() => setShowQuickAssignModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium flex items-center gap-2 transition-all duration-200 shadow-lg"
            >
              <UserPlus size={16} />
              Quick Assign
            </button>
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatsCard
            icon={<Shield className="h-5 w-5 text-blue-400" />}
            title="Total Admins"
            value={admins.length}
            subtitle="Active administrators"
            color="blue"
          />
          <StatsCard
            icon={<ShieldCheck className="h-5 w-5 text-purple-400" />}
            title="Super Admins"
            value={admins.filter(a => ['super-admin', 'super_admin'].includes(a.role?.toLowerCase())).length}
            subtitle="Super administrators"
            color="purple"
          />
          <StatsCard
            icon={<Building className="h-5 w-5 text-green-400" />}
            title="Locations"
            value={locations.length}
            subtitle="Managed locations"
            color="green"
          />
          <StatsCard
            icon={<Users className="h-5 w-5 text-yellow-400" />}
            title="Regular Users"
            value={regularUsers.length}
            subtitle="Non-admin users"
            color="yellow"
          />
        </div>
      </div>

      {/* Enhanced Tab Navigation */}
      <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
        <div className="flex">
          <button
            className={`flex-1 px-6 py-4 font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === 'location-assignment'
                ? 'bg-blue-600 bg-opacity-20 text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
            onClick={() => setActiveTab('location-assignment')}
          >
            <MapPin size={18} />
            Location Assignment
          </button>
          
          <button
            className={`flex-1 px-6 py-4 font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
              activeTab === 'role-management'
                ? 'bg-purple-600 bg-opacity-20 text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 hover:bg-opacity-30'
            }`}
            onClick={() => setActiveTab('role-management')}
          >
            <Shield size={18} />
            Role Management
          </button>
        </div>
        
        <div className="p-4 text-gray-300 bg-gray-800 bg-opacity-20 border-t border-gray-700">
          {activeTab === 'location-assignment' ? (
            <p className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-400" />
              Assign administrators to specific locations and manage their access permissions.
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <Shield size={16} className="text-purple-400" />
              Promote users to admin roles or modify existing administrator permissions.
            </p>
          )}
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column - Locations List */}
          <div className="xl:col-span-4">
            <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-700 bg-gray-900 bg-opacity-40">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                    <Building size={18} className="text-blue-400" /> 
                    Locations
                  </h2>
                  <span className="text-xs text-gray-400 bg-gray-800 bg-opacity-60 px-3 py-1 rounded-full">
                    {locations.length} total
                  </span>
                </div>
                
                {/* Location search */}
                <div className="relative">
                  <input
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 pl-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={16} />
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
              
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredLocations.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    <Building size={32} className="mx-auto text-gray-600 mb-2" />
                    <p>No locations found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredLocations.map(location => {
                      const isSelected = location === selectedLocation;
                      const userCount = getUserCountByLocation(location);
                      const adminCount = (locationAdmins[location] || []).length;
                      
                      return (
                        <div 
                          key={location}
                          className={`p-4 cursor-pointer transition-all duration-200 ${
                            isSelected 
                              ? 'bg-blue-600 bg-opacity-20 border-l-4 border-blue-500'
                              : 'hover:bg-gray-700 hover:bg-opacity-20 border-l-4 border-transparent'
                          }`}
                          onClick={() => handleLocationSelect(location)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-white font-medium mb-2">{location}</h3>
                              <div className="flex items-center gap-4">
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Column - Admin Assignment */}
          <div className="xl:col-span-8">
            <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-700 bg-gray-900 bg-opacity-40">
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-xl font-semibold flex items-center gap-2">
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                          className="px-3 py-1.5 rounded-lg text-sm bg-gray-700 bg-opacity-50 hover:bg-opacity-70 text-gray-300 flex items-center gap-1.5 font-medium transition-all duration-200"
                        >
                          {viewMode === 'grid' ? <Eye size={16} /> : <EyeOff size={16} />}
                          {viewMode === 'grid' ? 'List' : 'Grid'}
                        </button>
                        
                        <button
                          onClick={() => setShowQuickAssignModal(true)}
                          className="px-3 py-1.5 rounded-lg text-sm bg-green-600 bg-opacity-20 hover:bg-opacity-30 text-green-400 flex items-center gap-1.5 font-medium border border-green-500 border-opacity-20 transition-all duration-200"
                        >
                          <UserPlus size={16} />
                          Add Admin
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {!selectedLocation ? (
                <div className="p-12 text-center text-gray-400 bg-gray-800 bg-opacity-10">
                  <Building size={64} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-xl font-medium text-gray-300 mb-2">No Location Selected</p>
                  <p className="max-w-md mx-auto">
                    Please select a location from the left panel to view and manage its administrators
                  </p>
                </div>
              ) : (
                <>
                  {/* Enhanced Filter and Search */}
                  <div className="p-4 border-b border-gray-700 bg-gray-800 bg-opacity-20">
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search administrators..."
                          className="w-full bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                          <Search size={18} />
                        </div>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            aria-label="Clear search"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-2 pl-3">
                          <Filter size={16} className="text-gray-400" />
                          <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className="bg-transparent text-white focus:outline-none"
                          >
                            {roleFilterOptions.map(option => (
                              <option key={option.value} value={option.value} className="bg-gray-800">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showAvailableAdminsOnly}
                            onChange={() => setShowAvailableAdminsOnly(!showAvailableAdminsOnly)}
                            className="rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                          />
                          Available only
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Admin List */}
                  <div className="max-h-[50vh] overflow-y-auto">
                    {getFilteredAdmins().length === 0 ? (
                      <div className="p-8 text-center text-gray-400">
                        <Users size={32} className="mx-auto text-gray-600 mb-2" />
                        <p>No administrators match your search criteria</p>
                      </div>
                    ) : (
                      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4' : 'divide-y divide-gray-700'}>
                        {getFilteredAdmins().map(admin => {
                          const isSelected = selectedAdmins[admin.id];
                          const isAssigned = locationAdmins[selectedLocation]?.includes(admin.id);
                          
                          if (viewMode === 'grid') {
                            return (
                              <UserCard
                                key={admin.id}
                                user={admin}
                                isSelected={isSelected}
                                onSelect={toggleAdminSelection}
                              />
                            );
                          } else {
                            const isSuperAdmin = admin.role?.toLowerCase() === 'super-admin' || 
                                              admin.role?.toLowerCase() === 'super_admin';
                            
                            return (
                              <div 
                                key={admin.id}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-all duration-200 ${
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
                                        isSuperAdmin
                                          ? 'bg-purple-900 bg-opacity-30 text-purple-400'
                                          : 'bg-blue-900 bg-opacity-30 text-blue-400'
                                      }`}>
                                        {admin.role}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                      {admin.email && (
                                        <span className="text-sm text-gray-400 truncate">{admin.email}</span>
                                      )}
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
                          }
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Current Administrators Section */}
                  <div className="p-4 border-t border-gray-700 bg-gray-800 bg-opacity-40">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Users size={16} className="text-blue-400" />
                      Current Administrators
                    </h3>
                    
                    {!locationAdmins[selectedLocation] || locationAdmins[selectedLocation].length === 0 ? (
                      <div className="text-gray-400 text-sm italic">No administrators currently assigned</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {locationAdmins[selectedLocation].map(adminId => {
                          const admin = admins.find(a => a.id === adminId);
                          if (!admin) return null;
                          
                          const isSuperAdmin = admin.role?.toLowerCase() === 'super-admin' || 
                                            admin.role?.toLowerCase() === 'super_admin';
                          
                          return (
                            <div 
                              key={adminId}
                              className="bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 flex items-center gap-3 hover:bg-opacity-80 transition-all duration-200"
                            >
                              <div className={`p-2 rounded-lg ${
                                isSuperAdmin ? 'bg-purple-500 bg-opacity-20' : 'bg-blue-500 bg-opacity-20'
                              }`}>
                                {isSuperAdmin ? (
                                  <ShieldCheck size={16} className="text-purple-400" />
                                ) : (
                                  <Shield size={16} className="text-blue-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">{admin.name || 'Unknown Admin'}</div>
                                <div className="text-xs text-gray-400">{admin.role}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Action Buttons */}
                  <div className="p-4 border-t border-gray-700 bg-gray-900 bg-opacity-40 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-gray-400">
                      {Object.values(selectedAdmins).filter(Boolean).length} administrators selected
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleLocationSelect(selectedLocation)} // Reset selections
                        className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-30 transition-all duration-200"
                      >
                        Reset
                      </button>
                      
                      <button
                        onClick={saveLocationAdmins}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white flex items-center gap-2 font-medium transition-all duration-200 shadow-lg"
                      >
                        <CheckCircle size={18} />
                        Save Changes
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Enhanced User info for the selected location */}
            {selectedLocation && (
              <div className="mt-6 bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-700 bg-gray-900 bg-opacity-40">
                  <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                    <Users size={18} className="text-blue-400" /> 
                    Users in {selectedLocation}
                  </h2>
                </div>
                
                <div className="p-4">
                  {regularUsers.filter(user => (user.primaryLocation || user.location) === selectedLocation).length === 0 ? (
                    <div className="text-center text-gray-400 py-6">
                      <Users size={32} className="mx-auto text-gray-600 mb-2" />
                      <p>No users in this location</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {regularUsers
                        .filter(user => (user.primaryLocation || user.location) === selectedLocation)
                        .map(user => (
                          <div 
                            key={user.id}
                            className="flex items-center gap-3 bg-gray-800 bg-opacity-60 p-3 rounded-lg border border-gray-600 border-opacity-50 hover:bg-opacity-80 transition-all duration-200"
                          >
                            <div className="p-2 rounded-lg bg-gray-500 bg-opacity-20">
                              <User size={16} className="text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-medium truncate">{user.name || 'Unknown User'}</div>
                              {user.email && (
                                <div className="text-xs text-gray-400 truncate">{user.email}</div>
                              )}
                            </div>
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

      {/* Enhanced User Role Management Tab */}
      {activeTab === 'role-management' && (
        <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-gray-700 bg-gray-900 bg-opacity-40">
            <h2 className="text-white text-2xl font-semibold flex items-center gap-2 mb-2">
              <Shield size={24} className="text-purple-400" /> 
              User Role Management
            </h2>
            <p className="text-gray-300">
              Promote regular users to admin or super-admin roles, or modify existing administrator permissions.
            </p>
          </div>
          
          <div className="p-6">
            {/* Enhanced Search and Filters */}
            <div className="mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search for users by name or email..."
                    className="w-full bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </div>
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      aria-label="Clear search"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-2 pl-3">
                    <Filter size={16} className="text-gray-400" />
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="bg-transparent text-white focus:outline-none"
                    >
                      {roleFilterOptions.map(option => (
                        <option key={option.value} value={option.value} className="bg-gray-800">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-2 pl-3">
                    <TrendingUp size={16} className="text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent text-white focus:outline-none"
                    >
                      {sortOptions.map(option => (
                        <option key={option.value} value={option.value} className="bg-gray-800">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    {sortOrder === 'asc' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Enhanced User list */}
            <div className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 bg-gray-900 bg-opacity-60 text-xs text-gray-400 font-semibold uppercase tracking-wider">
                <div>User Information</div>
                <div>Role & Status</div>
                <div>Location</div>
                <div>Actions</div>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    <Users size={32} className="mx-auto text-gray-600 mb-2" />
                    <p>No users found matching your search criteria</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredUsers.map(user => {
                      const isAdmin = user.role === 'admin';
                      const isSuperAdmin = user.role === 'super-admin' || user.role === 'super_admin';
                      
                      return (
                        <div 
                          key={user.id}
                          className="p-4 grid grid-cols-4 gap-4 hover:bg-gray-700 hover:bg-opacity-20 transition-all duration-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              isSuperAdmin ? 'bg-purple-500 bg-opacity-20' :
                              isAdmin ? 'bg-blue-500 bg-opacity-20' :
                              'bg-gray-500 bg-opacity-20'
                            }`}>
                              {isSuperAdmin ? (
                                <ShieldCheck size={20} className="text-purple-400 flex-shrink-0" />
                              ) : isAdmin ? (
                                <Shield size={20} className="text-blue-400 flex-shrink-0" />
                              ) : (
                                <User size={20} className="text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                            
                            <div className="min-w-0">
                              <div className="text-white font-medium truncate">{user.name || 'Unknown User'}</div>
                              {user.email && (
                                <div className="text-sm text-gray-400 truncate flex items-center gap-1">
                                  <Mail size={12} />
                                  {user.email}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            {user.role ? (
                              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                isSuperAdmin 
                                  ? 'bg-purple-900 bg-opacity-30 text-purple-400'
                                  : isAdmin
                                    ? 'bg-blue-900 bg-opacity-30 text-blue-400'
                                    : 'bg-gray-700 bg-opacity-40 text-gray-300'
                              }`}>
                                {user.role}
                              </span>
                            ) : (
                              <span className="text-xs px-3 py-1 rounded-full bg-gray-700 bg-opacity-40 text-gray-400">
                                Regular User
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!isSuperAdmin && (
                              <button
                                onClick={() => handlePromoteClick(user)}
                                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 font-medium transition-all duration-200 ${
                                  isAdmin
                                    ? 'bg-purple-900 bg-opacity-20 text-purple-400 border border-purple-500 border-opacity-30 hover:bg-opacity-30'
                                    : 'bg-blue-900 bg-opacity-20 text-blue-400 border border-blue-500 border-opacity-30 hover:bg-opacity-30'
                                }`}
                              >
                                {isAdmin ? (
                                  <>
                                    <ShieldCheck size={16} />
                                    Super Admin
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
                                className="px-3 py-1.5 rounded-lg bg-red-900 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30 text-sm flex items-center gap-1.5 font-medium hover:bg-opacity-30 transition-all duration-200"
                              >
                                <User size={16} />
                                Demote
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
      
      {/* Enhanced Role Management Modal */}
      {showRoleModal && userToPromote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500 bg-opacity-20">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">
                Update Role for {userToPromote.name || 'User'}
              </h3>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-3 font-medium">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              >
                <option value="admin">Administrator</option>
                <option value="super-admin">Super Administrator</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50 transition-all duration-200"
              >
                Cancel
              </button>
              
              <button
                onClick={handleRoleChange}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium transition-all duration-200 shadow-lg"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced Quick Assign Modal */}
      {showQuickAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500 bg-opacity-20">
                  <UserPlus className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  Quick Assign Admin
                </h3>
              </div>
              <button
                onClick={() => setShowQuickAssignModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Location selection */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">Location</label>
              <select
                value={quickAssignLocation}
                onChange={(e) => setQuickAssignLocation(e.target.value)}
                className="bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Select a location</option>
                {locations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
            
            {/* User selection with search */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">User to Assign</label>
              <div className="relative">
                <input
                  type="text"
                  value={quickAssignUserSearch}
                  onChange={(e) => setQuickAssignUserSearch(e.target.value)}
                  placeholder="Search for a user..."
                  className="w-full bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2 transition-all duration-200"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <Search size={18} />
                </div>
              </div>
              
              <div className="max-h-40 overflow-y-auto bg-gray-900 bg-opacity-60 border border-gray-600 rounded-lg">
                {filteredUsers
                  .filter(user => 
                    !quickAssignUserSearch || 
                    user.name?.toLowerCase().includes(quickAssignUserSearch.toLowerCase()) ||
                    user.email?.toLowerCase().includes(quickAssignUserSearch.toLowerCase())
                  )
                  .slice(0, 10) // Limit to 10 results for performance
                  .map(user => (
                    <div 
                      key={user.id}
                      className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-700 hover:bg-opacity-30 transition-all duration-200 ${
                        userToPromote?.id === user.id ? 'bg-green-900 bg-opacity-20' : ''
                      }`}
                      onClick={() => setUserToPromote(user)}
                    >
                      <div className="p-2 rounded-lg bg-gray-500 bg-opacity-20">
                        <User size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium truncate">{user.name || 'Unknown User'}</div>
                        {user.email && (
                          <div className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Mail size={12} />
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            {/* Role selection */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">Role</label>
              <select
                value={quickAssignRole}
                onChange={(e) => setQuickAssignRole(e.target.value)}
                className="bg-gray-800 bg-opacity-60 border border-gray-600 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              >
                <option value="admin">Administrator</option>
                <option value="super-admin">Super Administrator</option>
              </select>
            </div>
            
            {userToPromote && (
              <div className="bg-green-900 bg-opacity-10 border border-green-500 border-opacity-20 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-green-400 mb-2">Selected User</h4>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500 bg-opacity-20">
                    <User size={18} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium truncate">{userToPromote.name}</div>
                    {userToPromote.email && (
                      <div className="text-sm text-gray-400 truncate">{userToPromote.email}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowQuickAssignModal(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50 transition-all duration-200"
              >
                Cancel
              </button>
              
              <button
                onClick={handleQuickAssign}
                disabled={!quickAssignLocation || !userToPromote}
                className={`px-4 py-2 rounded-lg ${
                  !quickAssignLocation || !userToPromote
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg'
                } font-medium flex items-center gap-2 transition-all duration-200`}
              >
                <UserPlus size={18} />
                Assign to Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          title={confirmTitle}
          message={confirmMessage}
          onConfirm={confirmAction}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
};

export default ManageAdmins;
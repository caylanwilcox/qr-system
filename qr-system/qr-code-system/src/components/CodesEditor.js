import React, { useState, useEffect } from 'react';
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { 
  Tag, 
  PlusCircle, 
  X, 
  Save, 
  AlertTriangle, 
  CheckCircle,
  Edit,
  Trash2,
  Server,
  MapPin,
  User,
  Calendar,
  Search,
  Filter,
  Settings,
  AlertCircle,
  MoreHorizontal,
  Lock,
  RefreshCw  // Add this import
} from 'lucide-react';
import { useAuth } from '../services/authContext';
import './CodesEditor.css';
// Define categories for the system codes
const CATEGORIES = [
  { id: 'locations', name: 'Locations', icon: <MapPin size={18} />, hasStructuredData: true, protected: true },
  { id: 'serviceTypes', name: 'Service Types', icon: <Tag size={18} />, hasStructuredData: false, protected: false },
  { id: 'meetingTypes', name: 'Meeting Types', icon: <Calendar size={18} />, hasStructuredData: false, protected: false },
  { id: 'eventTypes', name: 'Event Types', icon: <Calendar size={18} />, hasStructuredData: true, protected: false },
  { id: 'roles', name: 'System Roles', icon: <User size={18} />, hasStructuredData: false, protected: true },
];

const CodesEditor = () => {
  // State management
  const [activeCategory, setActiveCategory] = useState('locations');
  const [codes, setCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // State for new code entry
  const [newCode, setNewCode] = useState({ 
    name: '', 
    key: '',
    value: '', 
    description: '',
    address: '',
    displayName: ''
  });
  
  // State for editing 
  const [editMode, setEditMode] = useState({});
  const [editingItem, setEditingItem] = useState({});
  
  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Get the current user and determine if they're a super_admin
  const { user } = useAuth();
  const [userRole, setUserRole] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Get active category definition
  const activeCategoryObj = CATEGORIES.find(cat => cat.id === activeCategory);
  const hasStructuredData = activeCategoryObj?.hasStructuredData || false;
  const isProtectedCategory = activeCategoryObj?.protected || false;

  // Check if the user is a super_admin
  useEffect(() => {
    const checkUserRole = async () => {
      if (user && user.uid) {
        try {
          const userRef = ref(database, `users/${user.uid}/profile`);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.val();
            const role = userData.role || '';
            setUserRole(role);
            setIsSuperAdmin(role === 'super_admin');
          }
        } catch (error) {
          console.error('Error checking user role:', error);
        }
      }
    };
    
    checkUserRole();
  }, [user]);

  // Load codes on mount and when active category changes
  useEffect(() => {
    const fetchCodes = async () => {
      try {
        setLoading(true);
        
        // Fetch codes for the active category
        const categoryRef = ref(database, activeCategory);
        const snapshot = await get(categoryRef);
        
        if (snapshot.exists()) {
          const codesData = snapshot.val();
          setCodes(prevCodes => ({
            ...prevCodes,
            [activeCategory]: codesData
          }));
        } else {
          setCodes(prevCodes => ({
            ...prevCodes,
            [activeCategory]: {}
          }));
        }
      } catch (error) {
        showNotification(`Error loading ${activeCategory}: ${error.message}`, 'error');
        console.error(`Error fetching ${activeCategory}:`, error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCodes();
    
    // Reset search term and edit states when changing categories
    setSearchTerm('');
    setEditMode({});
    setEditingItem({});
  }, [activeCategory]);

  // Load locationsList on mount
  const [locationsList, setLocationsList] = useState([]);
  
  useEffect(() => {
    const fetchLocationsList = async () => {
      try {
        const locationsListRef = ref(database, 'locationsList');
        const snapshot = await get(locationsListRef);
        
        if (snapshot.exists()) {
          const locationsData = snapshot.val();
          setLocationsList(locationsData);
        } else {
          setLocationsList([]);
        }
      } catch (error) {
        console.error('Error fetching locationsList:', error);
      }
    };
    
    fetchLocationsList();
  }, []);

  // Normalize text to a key
  const normalizeToKey = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };

  // Show notification message
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Get singular name for category
  const getSingularName = (categoryId) => {
    const mapping = {
      'locations': 'Location',
      'serviceTypes': 'Service Type',
      'meetingTypes': 'Meeting Type',
      'eventTypes': 'Event Type',
      'roles': 'Role'
    };
    return mapping[categoryId] || 'Item';
  };

  // Sync locations to locationsList
  const syncLocationsToList = async () => {
    try {
      if (!isSuperAdmin) {
        showNotification('Only super admins can sync locations', 'error');
        return;
      }
      
      // Get all active locations
      const locationsData = codes.locations || {};
      
      // Filter active locations and extract names
      const activeLocationNames = Object.values(locationsData)
        .filter(location => location.active !== false)
        .map(location => location.name)
        .filter(name => !!name) // Filter out any undefined or empty names
        .sort();
      
      // Update locationsList in Firebase
      const locationsListRef = ref(database, 'locationsList');
      await set(locationsListRef, activeLocationNames);
      
      // Update local state
      setLocationsList(activeLocationNames);
      
      showNotification('Locations successfully synchronized to locationsList', 'success');
    } catch (error) {
      console.error('Error syncing locations:', error);
      showNotification(`Error syncing locations: ${error.message}`, 'error');
    }
  };

  // Handle adding a new code
  const handleAddCode = async () => {
    if (!newCode.name.trim()) {
      showNotification('Name field is required', 'error');
      return;
    }

    // Check permissions for protected categories
    if (isProtectedCategory && !isSuperAdmin) {
      showNotification(`Only super admins can add new ${getSingularName(activeCategory).toLowerCase()}s`, 'error');
      return;
    }

    try {
      const categoryRef = ref(database, activeCategory);
      const newCodeRef = push(categoryRef);
      
      // Prepare code data based on category type
      let codeData = {};
      
      if (hasStructuredData) {
        // For structured data (locations, event types)
        const normalized = normalizeToKey(newCode.name);
        
        codeData = {
          name: newCode.name.trim(),
          key: normalized,
          description: newCode.description || '',
          active: true,
          createdAt: new Date().toISOString()
        };
        
        // Add category-specific fields
        if (activeCategory === 'locations' && newCode.address) {
          codeData.address = newCode.address;
        }
        
        if (activeCategory === 'eventTypes' && newCode.displayName) {
          codeData.displayName = newCode.displayName;
        } else if (activeCategory === 'eventTypes') {
          codeData.displayName = newCode.name.trim();
        }
      } else {
        // For simple data (service types, meeting types, roles)
        codeData = {
          name: newCode.name.trim(),
          value: newCode.value || newCode.name.trim(),
          description: newCode.description || '',
          createdAt: new Date().toISOString()
        };
      }
      
      await set(newCodeRef, codeData);
      
      // If this is a location, also update locationsList
      if (activeCategory === 'locations') {
        const updatedLocationsList = [...locationsList, newCode.name.trim()].sort();
        const locationsListRef = ref(database, 'locationsList');
        await set(locationsListRef, updatedLocationsList);
        setLocationsList(updatedLocationsList);
      }
      
      // Reset the form
      setNewCode({ 
        name: '', 
        key: '',
        value: '', 
        description: '',
        address: '',
        displayName: ''
      });
      
      showNotification(`New ${getSingularName(activeCategory)} added successfully`, 'success');
      
      // Refresh the codes
      const updatedSnapshot = await get(categoryRef);
      if (updatedSnapshot.exists()) {
        setCodes(prevCodes => ({
          ...prevCodes,
          [activeCategory]: updatedSnapshot.val()
        }));
      }
    } catch (error) {
      console.error('Error adding code:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  // Handle updating an existing code
  const handleUpdateCode = async (codeId) => {
    if (!editingItem.name) {
      showNotification('Name field is required', 'error');
      return;
    }

    // Check permissions for protected categories
    if (isProtectedCategory && !isSuperAdmin) {
      showNotification(`Only super admins can edit ${getSingularName(activeCategory).toLowerCase()}s`, 'error');
      setEditMode({...editMode, [codeId]: false});
      setEditingItem({});
      return;
    }

    try {
      const codeRef = ref(database, `${activeCategory}/${codeId}`);
      
      // Get original item for comparison (for locations)
      let originalItem = null;
      if (activeCategory === 'locations') {
        originalItem = codes.locations[codeId];
      }
      
      // Prepare updates based on category type
      let updates = {};
      
      if (hasStructuredData) {
        // Update for structured data
        const normalized = editingItem.key || normalizeToKey(editingItem.name);
        
        updates = {
          name: editingItem.name.trim(),
          key: normalized,
          description: editingItem.description || '',
          active: editingItem.active !== false, // default to true if not explicitly false
          updatedAt: new Date().toISOString()
        };
        
        // Add category-specific fields
        if (activeCategory === 'locations' && editingItem.address !== undefined) {
          updates.address = editingItem.address;
        }
        
        if (activeCategory === 'eventTypes' && editingItem.displayName !== undefined) {
          updates.displayName = editingItem.displayName;
        }
      } else {
        // Update for simple data
        updates = {
          name: editingItem.name.trim(),
          value: editingItem.value || editingItem.name.trim(),
          description: editingItem.description || '',
          updatedAt: new Date().toISOString()
        };
      }
      
      await update(codeRef, updates);
      
      // If this is a location, check if we need to update locationsList
      if (activeCategory === 'locations') {
        // Handle location name changes or status changes
        const nameChanged = originalItem && originalItem.name !== editingItem.name.trim();
        const statusChanged = originalItem && (originalItem.active !== false) !== (editingItem.active !== false);
        
        if (nameChanged || statusChanged) {
          let updatedLocationsList = [...locationsList];
          
          // Remove old name if it exists
          if (nameChanged && originalItem) {
            updatedLocationsList = updatedLocationsList.filter(name => name !== originalItem.name);
          }
          
          // Add new name if location is active
          if (editingItem.active !== false) {
            if (nameChanged || (statusChanged && originalItem.active === false)) {
              updatedLocationsList.push(editingItem.name.trim());
            }
          } else if (statusChanged && originalItem.active !== false) {
            // Remove name if location was active but is now inactive
            updatedLocationsList = updatedLocationsList.filter(name => name !== editingItem.name.trim());
          }
          
          // Sort and update locationsList
          updatedLocationsList.sort();
          const locationsListRef = ref(database, 'locationsList');
          await set(locationsListRef, updatedLocationsList);
          setLocationsList(updatedLocationsList);
        }
      }
      
      // Exit edit mode
      setEditMode({...editMode, [codeId]: false});
      setEditingItem({});
      
      showNotification(`${getSingularName(activeCategory)} updated successfully`, 'success');
      
      // Refresh the codes
      const categoryRef = ref(database, activeCategory);
      const updatedSnapshot = await get(categoryRef);
      if (updatedSnapshot.exists()) {
        setCodes(prevCodes => ({
          ...prevCodes,
          [activeCategory]: updatedSnapshot.val()
        }));
      }
    } catch (error) {
      console.error('Error updating code:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  // Handle deleting a code
  const handleDeleteCode = async (codeId) => {
    // Check permissions for protected categories
    if (isProtectedCategory && !isSuperAdmin) {
      showNotification(`Only super admins can delete ${getSingularName(activeCategory).toLowerCase()}s`, 'error');
      setShowDeleteConfirm(null);
      return;
    }

    try {
      // Check if the code is in use before deleting
      if (activeCategory === 'locations') {
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          const locationData = codes[activeCategory][codeId];
          
          // Check if any user has this location
          const locationKey = locationData.key || normalizeToKey(locationData.name);
          const locationName = locationData.name;
          
          let locationInUse = false;
          
          Object.values(usersData).forEach(userData => {
            if (userData.profile) {
              if (userData.profile.locationKey === locationKey ||
                  userData.profile.location === locationName) {
                locationInUse = true;
              }
            }
          });
          
          if (locationInUse) {
            showNotification(`Cannot delete: This ${getSingularName(activeCategory)} is assigned to one or more users`, 'error');
            setShowDeleteConfirm(null);
            return;
          }
        }
      }
      
      // If we get here, it's safe to delete
      const codeRef = ref(database, `${activeCategory}/${codeId}`);
      
      // Store item for location sync if needed
      let deletedLocation = null;
      if (activeCategory === 'locations') {
        deletedLocation = codes.locations[codeId];
      }
      
      await remove(codeRef);
      
      // If this is a location and was active, update locationsList
      if (activeCategory === 'locations' && deletedLocation && deletedLocation.active !== false) {
        const updatedLocationsList = locationsList.filter(name => name !== deletedLocation.name);
        const locationsListRef = ref(database, 'locationsList');
        await set(locationsListRef, updatedLocationsList);
        setLocationsList(updatedLocationsList);
      }
      
      showNotification(`${getSingularName(activeCategory)} deleted successfully`, 'success');
      setShowDeleteConfirm(null);
      
      // Refresh the codes
      const categoryRef = ref(database, activeCategory);
      const updatedSnapshot = await get(categoryRef);
      if (updatedSnapshot.exists()) {
        setCodes(prevCodes => ({
          ...prevCodes,
          [activeCategory]: updatedSnapshot.val()
        }));
      } else {
        setCodes(prevCodes => ({
          ...prevCodes,
          [activeCategory]: {}
        }));
      }
    } catch (error) {
      console.error('Error deleting code:', error);
      showNotification(`Error: ${error.message}`, 'error');
      setShowDeleteConfirm(null);
    }
  };

  // Toggle edit mode for a code
  const toggleEditMode = (codeId, codeData) => {
    // Check permissions for protected categories
    if (isProtectedCategory && !isSuperAdmin) {
      showNotification(`Only super admins can edit ${getSingularName(activeCategory).toLowerCase()}s`, 'error');
      return;
    }

    setEditMode({...editMode, [codeId]: !editMode[codeId]});
    
    if (!editMode[codeId]) {
      setEditingItem({
        id: codeId,
        ...codeData
      });
    } else {
      setEditingItem({});
    }
  };

  // Toggle active status for a code
  const toggleActiveStatus = async (codeId, currentStatus) => {
    // Check permissions for protected categories
    if (isProtectedCategory && !isSuperAdmin) {
      showNotification(`Only super admins can change status of ${getSingularName(activeCategory).toLowerCase()}s`, 'error');
      return;
    }

    try {
      const codeRef = ref(database, `${activeCategory}/${codeId}`);
      const newStatus = !currentStatus;
      
      await update(codeRef, {
        active: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      // If this is a location, update locationsList
      if (activeCategory === 'locations') {
        const locationData = codes.locations[codeId];
        const locationName = locationData.name;
        let updatedLocationsList = [...locationsList];
        
        if (newStatus) {
          // If becoming active, add to list
          if (!updatedLocationsList.includes(locationName)) {
            updatedLocationsList.push(locationName);
            updatedLocationsList.sort();
          }
        } else {
          // If becoming inactive, remove from list
          updatedLocationsList = updatedLocationsList.filter(name => name !== locationName);
        }
        
        const locationsListRef = ref(database, 'locationsList');
        await set(locationsListRef, updatedLocationsList);
        setLocationsList(updatedLocationsList);
      }
      
      // Refresh the codes
      const categoryRef = ref(database, activeCategory);
      const updatedSnapshot = await get(categoryRef);
      if (updatedSnapshot.exists()) {
        setCodes(prevCodes => ({
          ...prevCodes,
          [activeCategory]: updatedSnapshot.val()
        }));
      }
      
      showNotification(`${getSingularName(activeCategory)} ${!currentStatus ? 'activated' : 'deactivated'} successfully`, 'success');
    } catch (error) {
      console.error('Error toggling status:', error);
      showNotification(`Error: ${error.message}`, 'error');
    }
  };

  // Filter codes based on search and active status
  const getFilteredCodes = () => {
    if (!codes[activeCategory]) return [];
    
    return Object.entries(codes[activeCategory])
      .filter(([_, item]) => {
        // Filter by search term
        const searchMatch = !searchTerm || 
          (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.address && item.address.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Filter by active status
        const activeMatch = !hasStructuredData || showInactive || item.active !== false;
        
        return searchMatch && activeMatch;
      })
      .map(([id, item]) => ({ id, ...item }));
  };

  // Render the form for adding a new code
  const renderAddForm = () => {
    // For protected categories, only show form to super admins
    if (isProtectedCategory && !isSuperAdmin) {
      return (
        <div className="add-code-section bg-gray-800 bg-opacity-30 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-center text-gray-400 p-4">
            <Lock size={18} className="mr-2" />
            <p>Only super administrators can add new {getSingularName(activeCategory).toLowerCase()}s</p>
          </div>
        </div>
      );
    }

    return (
      <div className="add-code-section bg-gray-800 bg-opacity-30 rounded-lg p-4 mb-6 border border-gray-700">
        <h3 className="text-lg text-white font-medium mb-4 flex items-center gap-2">
          <PlusCircle size={18} className="text-blue-400" />
          Add New {getSingularName(activeCategory)}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name field (common to all) */}
          <div className="form-group">
            <label className="form-label flex items-center gap-1">
              <Tag size={14} className="text-gray-400" />
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={`Enter ${getSingularName(activeCategory)} name`}
              value={newCode.name}
              onChange={(e) => {
                const name = e.target.value;
                setNewCode({
                  ...newCode, 
                  name,
                  key: normalizeToKey(name),
                  // For event types, auto-set display name
                  ...(activeCategory === 'eventTypes' ? { displayName: name } : {})
                });
              }}
              required
            />
            {hasStructuredData && newCode.name && (
              <div className="text-xs text-gray-400 mt-1">
                Key: {normalizeToKey(newCode.name)}
              </div>
            )}
          </div>
          
          {/* Conditional fields based on category */}
          {!hasStructuredData && (
            <div className="form-group">
              <label className="form-label">Value (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter value (defaults to name if blank)"
                value={newCode.value}
                onChange={(e) => setNewCode({...newCode, value: e.target.value})}
              />
            </div>
          )}
          
          {activeCategory === 'locations' && (
            <div className="form-group">
              <label className="form-label flex items-center gap-1">
                <MapPin size={14} className="text-gray-400" />
                Address
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter location address"
                value={newCode.address}
                onChange={(e) => setNewCode({...newCode, address: e.target.value})}
              />
            </div>
          )}
          
          {activeCategory === 'eventTypes' && (
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter display name (for UI)"
                value={newCode.displayName}
                onChange={(e) => setNewCode({...newCode, displayName: e.target.value})}
              />
            </div>
          )}
          
          {/* Description field (common to all) */}
          <div className={`form-group ${hasStructuredData ? 'md:col-span-2' : ''}`}>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              placeholder="Enter description"
              value={newCode.description}
              onChange={(e) => setNewCode({...newCode, description: e.target.value})}
              rows="2"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => setNewCode({ 
              name: '', 
              key: '',
              value: '', 
              description: '',
              address: '',
              displayName: ''
            })}
            className="px-3 py-1.5 text-sm border border-gray-600 rounded text-gray-300 hover:bg-gray-700"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleAddCode}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            disabled={!newCode.name.trim()}
          >
            <PlusCircle size={16} />
            Add {getSingularName(activeCategory)}
          </button>
        </div>
      </div>
    );
  };

  // Render the list of existing codes
  const renderCodesList = () => {
    const filteredCodes = getFilteredCodes();
    
    return (
      <div className="codes-list-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-white font-medium flex items-center gap-2">
            {activeCategoryObj?.icon}
            {activeCategoryObj?.name} ({filteredCodes.length})
            
            {/* Sync button for locations - only for super_admin */}
            {activeCategory === 'locations' && isSuperAdmin && (
              <button
                type="button"
                onClick={syncLocationsToList}
                className="ml-4 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                title="Sync active locations to locationsList"
              >
                <RefreshCw size={14} />
                Sync to locationsList
              </button>
            )}
            
            {/* Protected category indicator */}
            {isProtectedCategory && !isSuperAdmin && (
              <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full flex items-center gap-1">
                <Lock size={12} />
                Super admin only
              </span>
            )}
          </h3>
          
          <div className="flex items-center gap-2">
            {hasStructuredData && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={() => setShowInactive(!showInactive)}
                  className="h-4 w-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span className="text-gray-300 text-sm whitespace-nowrap">Show inactive</span>
              </label>
            )}
            
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${activeCategoryObj?.name.toLowerCase()}...`}
                className="w-full bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-2 pl-9 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Search size={14} />
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* LocationsList status (when in Locations category) */}
        {activeCategory === 'locations' && (
          <div className="mb-4 p-3 bg-gray-800 bg-opacity-40 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-blue-400" />
                <span className="text-sm text-gray-300">locationsList Status:</span>
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-gray-700">
                {locationsList.length} locations
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              This list is used by components like ManageEmployees to display location options.
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCodes.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-8 bg-gray-800 bg-opacity-20 rounded-lg border border-gray-700">
              {searchTerm ? (
                <div className="flex flex-col items-center">
                  <AlertTriangle size={24} className="mb-2" />
                  <p>No {activeCategoryObj?.name.toLowerCase()} match your search criteria.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Tag size={24} className="mb-2" />
                  <p>No {activeCategoryObj?.name.toLowerCase()} have been added yet.</p>
                </div>
              )}
            </div>
          ) : (
            filteredCodes.map((item) => (
              <div 
                key={item.id} 
                className={`code-item bg-gray-800 bg-opacity-30 rounded-lg border ${
                  hasStructuredData && item.active === false 
                    ? 'border-red-900 bg-opacity-20' 
                    : 'border-gray-700'
                } overflow-hidden`}
              >
                {editMode[item.id] ? (
                  // Edit Mode
                  <div className="p-4">
                    {/* Name field (common to all) */}
                    <div className="form-group mb-3">
                      <label className="form-label flex items-center gap-1">
                        <Tag size={14} className="text-gray-400" />
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={editingItem.name || ''}
                        onChange={(e) => {
                          const name = e.target.value;
                          setEditingItem({
                            ...editingItem, 
                            name,
                            ...(activeCategory === 'eventTypes' && !editingItem.displayName ? { displayName: name } : {})
                          });
                        }}
                        required
                      />
                      {hasStructuredData && (
                        <div className="text-xs text-gray-400 mt-1">
                          Key: {editingItem.key || normalizeToKey(editingItem.name || '')}
                        </div>
                      )}
                    </div>
                    
                    {/* Conditional fields based on category */}
                    {!hasStructuredData && (
                      <div className="form-group mb-3">
                        <label className="form-label">Value</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editingItem.value || ''}
                          onChange={(e) => setEditingItem({...editingItem, value: e.target.value})}
                        />
                      </div>
                    )}
                    
                    {activeCategory === 'locations' && (
                      <div className="form-group mb-3">
                        <label className="form-label flex items-center gap-1">
                          <MapPin size={14} className="text-gray-400" />
                          Address
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={editingItem.address || ''}
                          onChange={(e) => setEditingItem({...editingItem, address: e.target.value})}
                        />
                      </div>
                    )}
                    
                    {activeCategory === 'eventTypes' && (
                      <div className="form-group mb-3">
                        <label className="form-label">Display Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editingItem.displayName || ''}
                          onChange={(e) => setEditingItem({...editingItem, displayName: e.target.value})}
                        />
                      </div>
                    )}
                    
                    {/* Description field (common to all) */}
                    <div className="form-group mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-input"
                        value={editingItem.description || ''}
                        onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                        rows="2"
                      />
                    </div>
                    
                    {/* Active/Inactive toggle for structured data */}
                    {hasStructuredData && (
                      <div className="form-group mb-3">
                        <label className="form-label flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingItem.active !== false}
                            onChange={(e) => setEditingItem({
                              ...editingItem, 
                              active: e.target.checked
                            })}
                            className="h-4 w-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                          />
                          <span className="text-white">Active</span>
                        </label>
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleEditMode(item.id)}
                        className="px-2.5 py-1 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateCode(item.id)}
                        className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                        disabled={!editingItem.name?.trim()}
                      >
                        <Save size={14} />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <h4 className="text-white font-medium mb-1 flex items-center gap-1 break-all">
                          {activeCategoryObj?.icon && (
                            <span className="flex-shrink-0 text-blue-400">
                              {activeCategoryObj.icon}
                            </span>
                          )}
                          <span>{item.name}</span>
                          {hasStructuredData && item.active === false && (
                            <span className="ml-2 text-xs bg-red-900 bg-opacity-30 text-red-400 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </h4>
                        
                        {(item.key || item.value) && (
                          <div className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded ml-2 flex-shrink-0">
                            {item.key || item.value}
                          </div>
                        )}
                      </div>
                      
                      {/* In locations view, indicate if location is in locationsList */}
                      {activeCategory === 'locations' && (
                        <div className="text-xs mt-1">
                          {locationsList.includes(item.name) ? (
                            <span className="text-green-400 flex items-center gap-1">
                              <CheckCircle size={12} />
                              In locationsList
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertCircle size={12} />
                              Not in locationsList
                            </span>
                          )}
                        </div>
                      )}
                      
                      {item.displayName && item.displayName !== item.name && (
                        <div className="text-sm text-blue-400 mt-1">
                          Display: {item.displayName}
                        </div>
                      )}
                      
                      {item.address && (
                        <div className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                          <MapPin size={14} className="flex-shrink-0" />
                          {item.address}
                        </div>
                      )}
                      
                      {item.description && (
                        <div className="text-sm text-gray-400 mt-2">
                          {item.description}
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t border-gray-700 p-2 bg-gray-900 bg-opacity-30 flex justify-end gap-2">
                      {/* Only show action buttons for super admins on protected categories */}
                      {(!isProtectedCategory || isSuperAdmin) && (
                        <>
                          {hasStructuredData && (
                            <button
                              type="button"
                              onClick={() => toggleActiveStatus(item.id, item.active !== false)}
                              className={`p-1.5 rounded ${
                                item.active === false
                                  ? 'text-green-400 hover:bg-green-900 hover:bg-opacity-30'
                                  : 'text-red-400 hover:bg-red-900 hover:bg-opacity-30'
                              }`}
                              title={item.active === false ? 'Activate' : 'Deactivate'}
                            >
                              {item.active === false ? (
                                <CheckCircle size={16} />
                              ) : (
                                <AlertCircle size={16} />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleEditMode(item.id, item)}
                            className="p-1.5 text-blue-400 hover:bg-blue-900 hover:bg-opacity-30 rounded"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(item.id)}
                            className="p-1.5 text-red-400 hover:bg-red-900 hover:bg-opacity-30 rounded"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      
                      {/* For protected categories, show lock icon for non-super-admins */}
                      {isProtectedCategory && !isSuperAdmin && (
                        <div className="p-1.5 text-gray-500">
                          <Lock size={16} title="Super admin access required" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="codes-editor glass-panel">
      {/* Header */}
      <div className="section-header">
        <h2 className="section-title">System Codes Editor</h2>
        <p className="text-white text-opacity-60 mt-2">
          Manage system codes used throughout the application.
          {!isSuperAdmin && (
            <span className="ml-2 text-yellow-400">
              Some actions require super admin access.
            </span>
          )}
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? (
            <CheckCircle className="inline-block mr-2" size={18} />
          ) : (
            <AlertTriangle className="inline-block mr-2" size={18} />
          )}
          {notification.message}
        </div>
      )}

      {/* Content */}
      <div className="codes-content">
        {/* Categories Sidebar */}
        <div className="categories-sidebar">
          <h3 className="sidebar-title">Categories</h3>
          <div className="category-list">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                className={`category-item ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.icon}
                <span>{category.name}</span>
                {category.protected && !isSuperAdmin && (
                  <Lock size={12} className="ml-auto text-gray-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="codes-main">
          {loading ? (
            <div className="loading-spinner-container">
              <div className="loading-spinner"></div>
              <p>Loading {activeCategoryObj?.name.toLowerCase()}...</p>
            </div>
          ) : (
            <>
              {/* Add Form */}
              {renderAddForm()}
              
              {/* Codes List */}
              {renderCodesList()}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md">
            <h3 className="text-lg text-white font-medium mb-3">Confirm Deletion</h3>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete this {getSingularName(activeCategory).toLowerCase()}? This action cannot be undone.
            </p>
            <p className="text-amber-400 text-sm mb-4 flex items-center gap-1">
              <AlertTriangle size={16} />
              This will permanently remove it from the system.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-600 rounded text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCode(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 size={16} />
                Delete {getSingularName(activeCategory)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodesEditor;
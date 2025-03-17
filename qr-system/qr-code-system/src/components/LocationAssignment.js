import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { 
  CheckCircle, 
  User, 
  MapPin, 
  Search, 
  Users, 
  Info, 
  ArrowRight,
  ChevronDown,
  ChevronRight 
} from 'lucide-react';

const LocationAssignment = ({ 
  admins, 
  adminLocations,
  regularUsers, 
  uniqueLocations, 
  onAssignLocations 
}) => {
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLocations, setFilteredLocations] = useState(uniqueLocations);
  const [expandedLocations, setExpandedLocations] = useState({});
  
  // Update filtered locations when search changes or uniqueLocations updates
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLocations(uniqueLocations);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredLocations(
        uniqueLocations.filter(location => 
          location.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, uniqueLocations]);

  // Initialize all locations as expanded
  useEffect(() => {
    const initialExpanded = {};
    uniqueLocations.forEach(location => {
      initialExpanded[location] = true;
    });
    setExpandedLocations(initialExpanded);
  }, [uniqueLocations]);

  // Normalize user location (handle location/primaryLocation inconsistency)
  const getUserLocation = (user) => {
    return user.primaryLocation || user.location;
  };

  // Get admin name by ID
  const getAdminName = (adminId) => {
    const admin = admins.find(a => a.id === adminId);
    return admin ? admin.name : 'Unknown';
  };

  // Handle the location assignment submission
  const handleSubmit = () => {
    onAssignLocations(selectedAdmin, selectedUsers);
    setSelectedUsers([]);
  };

  // Toggle expanded state for a location
  const toggleLocationExpand = (location) => {
    setExpandedLocations(prev => ({
      ...prev,
      [location]: !prev[location]
    }));
  };

  // Count users by location
  const getUserCountByLocation = (location) => {
    return regularUsers.filter(u => getUserLocation(u) === location).length;
  };

  // Count selected users by location
  const getSelectedUserCountByLocation = (location) => {
    const usersInLocation = regularUsers.filter(u => getUserLocation(u) === location);
    return usersInLocation.filter(u => selectedUsers.includes(u.id)).length;
  };

  // Total selected users
  const totalSelectedUsers = selectedUsers.length;
  
  // Selected locations count
  const selectedLocationsCount = [...new Set(
    selectedUsers.map(userId => {
      const user = regularUsers.find(u => u.id === userId);
      return user ? getUserLocation(user) : null;
    }).filter(Boolean)
  )].length;

  return (
    <div className="space-y-6">
      {/* Admin Selection */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <label className="text-lg font-medium text-white flex items-center gap-2">
            <Users size={18} />
            Select Administrator
          </label>
          
          {selectedAdmin && (
            <div className="text-sm text-blue-400 bg-blue-900 bg-opacity-20 px-3 py-1.5 rounded-full border border-blue-500 border-opacity-20 inline-flex items-center gap-2">
              <User size={14} />
              <span>Administrator: {getAdminName(selectedAdmin)}</span>
            </div>
          )}
        </div>
        
        <select
          value={selectedAdmin}
          onChange={(e) => setSelectedAdmin(e.target.value)}
          className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          aria-label="Select an Administrator"
        >
          <option value="">-- Select an Administrator --</option>
          {admins.map(admin => (
            <option key={admin.id} value={admin.id}>
              {admin.name} ({admin.role}) - {getUserLocation(admin)}
            </option>
          ))}
        </select>
        
        {/* Display current location assignments for the selected admin */}
        {selectedAdmin && adminLocations[selectedAdmin] && adminLocations[selectedAdmin].length > 0 && (
          <div className="p-4 bg-blue-900 bg-opacity-10 rounded-lg border border-blue-500 border-opacity-30 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <Info size={16} />
              <p className="font-medium">Currently assigned locations:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {adminLocations[selectedAdmin].map(loc => (
                <span 
                  key={loc} 
                  className="inline-flex items-center gap-1.5 text-sm bg-blue-800 bg-opacity-30 px-3 py-1.5 rounded-full"
                >
                  <MapPin size={14} className="text-blue-300" />
                  {loc}
                  <span className="text-xs text-blue-300 bg-blue-800 bg-opacity-40 px-1.5 py-0.5 rounded-full ml-1">
                    {getUserCountByLocation(loc)} users
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Location Selection with Search */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <label className="text-lg font-medium text-white flex items-center gap-2">
            <MapPin size={18} />
            Select Locations to Assign
          </label>
          
          <div className="text-sm text-gray-300 bg-gray-800 bg-opacity-30 px-3 py-1.5 rounded-full">
            <span className="text-blue-400 font-medium">{totalSelectedUsers}</span> users selected from 
            <span className="text-blue-400 font-medium ml-1">{selectedLocationsCount}</span> locations
          </div>
        </div>
        
        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search locations..."
            className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        
        {/* Locations list */}
        <div className="bg-gray-800 bg-opacity-20 border border-gray-700 rounded-lg overflow-hidden">
          {filteredLocations.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              {searchQuery ? 'No locations match your search' : 'No locations found'}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredLocations.map(location => {
                const usersInLocation = regularUsers.filter(u => getUserLocation(u) === location);
                const allSelected = usersInLocation.length > 0 && usersInLocation.every(u => selectedUsers.includes(u.id));
                const someSelected = usersInLocation.some(u => selectedUsers.includes(u.id));
                const adminForLocation = Object.entries(adminLocations).find(([_, locs]) => 
                  locs.includes(location)
                );
                const isExpanded = expandedLocations[location];
                
                return (
                  <div key={location} 
                    className={`transition-colors ${
                      allSelected 
                        ? 'bg-blue-900 bg-opacity-20' 
                        : someSelected 
                          ? 'bg-blue-900 bg-opacity-10'
                          : ''
                    }`}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`location-${location}`}
                          checked={allSelected}
                          onChange={(e) => {
                            const userIds = usersInLocation.map(u => u.id);
                            if (e.target.checked) {
                              // Add all users from this location
                              const newSelected = [...selectedUsers];
                              userIds.forEach(id => {
                                if (!newSelected.includes(id)) {
                                  newSelected.push(id);
                                }
                              });
                              setSelectedUsers(newSelected);
                            } else {
                              // Remove all users from this location
                              setSelectedUsers(selectedUsers.filter(id => !userIds.includes(id)));
                            }
                          }}
                          className="form-checkbox h-5 w-5 text-blue-500 rounded transition-colors cursor-pointer focus:ring-2 focus:ring-blue-500"
                          aria-label={`Select all users in ${location}`}
                        />
                        
                        <label 
                          htmlFor={`location-${location}`}
                          className="flex-1 flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className={`${allSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                            <h3 className="font-medium text-white">{location}</h3>
                            
                            {adminForLocation && adminForLocation[0] !== selectedAdmin && (
                              <span className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 px-2 py-1 rounded-full inline-flex items-center gap-1">
                                <Info size={12} />
                                Managed by: {getAdminName(adminForLocation[0])}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {someSelected && !allSelected && (
                              <span className="text-xs text-blue-400 bg-blue-900 bg-opacity-20 px-2 py-1 rounded-full">
                                {getSelectedUserCountByLocation(location)}/{usersInLocation.length} selected
                              </span>
                            )}
                            <span className="text-xs text-gray-400 bg-gray-700 bg-opacity-30 px-2 py-1 rounded-full flex items-center gap-1">
                              <Users size={12} />
                              {usersInLocation.length} users
                            </span>
                          </div>
                        </label>

                        {/* Toggle arrow button */}
                        <button
                          onClick={() => toggleLocationExpand(location)}
                          className="ml-2 p-1 rounded-full hover:bg-gray-700 hover:bg-opacity-30 text-gray-400 hover:text-white transition-colors"
                          aria-label={isExpanded ? "Collapse user list" : "Expand user list"}
                        >
                          {isExpanded ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </button>
                      </div>

                      {/* User list for this location - Collapsible */}
                      {isExpanded && (
                        <div className="mt-2 pl-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pb-3">
                          {usersInLocation.map(user => (
                            <div 
                              key={user.id}
                              className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                                selectedUsers.includes(user.id) 
                                  ? 'bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30' 
                                  : 'hover:bg-gray-700 hover:bg-opacity-30 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <User size={16} className={`${selectedUsers.includes(user.id) ? 'text-blue-400' : 'text-gray-400'}`} />
                                <span className="text-white text-sm truncate max-w-xs">{user.name}</span>
                              </div>
                              
                              <input
                                type="checkbox"
                                id={`user-${user.id}`}
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers([...selectedUsers, user.id]);
                                  } else {
                                    setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                  }
                                }}
                                className="form-checkbox h-4 w-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                aria-label={`Select ${user.name}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary and Action */}
      <div className="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-white font-medium">Assignment Summary</h3>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1 text-sm bg-gray-700 bg-opacity-30 px-3 py-1 rounded-full">
                <Users size={14} className="text-blue-400" />
                <span>{totalSelectedUsers} users</span>
              </div>
              <div className="inline-flex items-center gap-1 text-sm bg-gray-700 bg-opacity-30 px-3 py-1 rounded-full">
                <MapPin size={14} className="text-blue-400" />
                <span>{selectedLocationsCount} locations</span>
              </div>
              {selectedAdmin && (
                <div className="inline-flex items-center gap-1 text-sm bg-gray-700 bg-opacity-30 px-3 py-1 rounded-full">
                  <User size={14} className="text-blue-400" />
                  <span>{getAdminName(selectedAdmin)}</span>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={!selectedAdmin || selectedUsers.length === 0}
            className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg transition-all duration-300 ${
              !selectedAdmin || selectedUsers.length === 0
                ? 'bg-gray-700 bg-opacity-20 text-gray-500 cursor-not-allowed opacity-70'
                : 'bg-blue-600 hover:bg-blue-700 text-white font-medium'
            }`}
            aria-label="Assign Selected Locations"
          >
            <CheckCircle size={18} />
            <span>Assign {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}</span>
            <ArrowRight size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

LocationAssignment.propTypes = {
  admins: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      role: PropTypes.string,
      location: PropTypes.string,
      primaryLocation: PropTypes.string
    })
  ).isRequired,
  adminLocations: PropTypes.object.isRequired,
  regularUsers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      location: PropTypes.string,
      primaryLocation: PropTypes.string,
      managedBy: PropTypes.string
    })
  ).isRequired,
  uniqueLocations: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAssignLocations: PropTypes.func.isRequired
};

export default LocationAssignment;
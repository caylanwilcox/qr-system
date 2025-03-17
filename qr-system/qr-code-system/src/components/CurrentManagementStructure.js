import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  Users, 
  User, 
  MapPin, 
  ChevronDown, 
  ChevronRight, 
  Search,
  Building
} from 'lucide-react';

const CurrentManagementStructure = ({ admins, adminLocations, regularUsers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAdmins, setExpandedAdmins] = useState({});
  const [expandedLocations, setExpandedLocations] = useState({});
  
  // Normalize user location (handle location/primaryLocation inconsistency)
  const getUserLocation = (user) => {
    return user.primaryLocation || user.location;
  };
  
  // Toggle expanded state for an admin
  const toggleAdminExpand = (adminId) => {
    setExpandedAdmins(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }));
  };
  
  // Toggle expanded state for a location
  const toggleLocationExpand = (adminId, location) => {
    const key = `${adminId}-${location}`;
    setExpandedLocations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Filter admins and their locations based on search query
  const filteredAdmins = admins.filter(admin => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    
    // Check if admin name matches search
    if (admin.name && admin.name.toLowerCase().includes(query)) return true;
    
    // Check if any assigned location matches search
    const adminLocs = adminLocations[admin.id] || [];
    if (adminLocs.some(loc => loc.toLowerCase().includes(query))) return true;
    
    // Check if any user under this admin matches search
    const managedUsers = regularUsers.filter(user => user.managedBy === admin.id);
    if (managedUsers.some(user => user.name && user.name.toLowerCase().includes(query))) return true;
    
    return false;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by admin, location, or user name..."
          className="bg-gray-800 bg-opacity-40 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
        />
      </div>
      
      {/* Admin Cards */}
      <div className="space-y-4">
        {filteredAdmins.length === 0 ? (
          <div className="bg-gray-800 bg-opacity-20 border border-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400">
              {searchQuery 
                ? 'No results match your search criteria' 
                : 'No administrators found'}
            </p>
          </div>
        ) : (
          filteredAdmins.map(admin => {
            const adminLocs = adminLocations[admin.id] || [];
            const isExpanded = expandedAdmins[admin.id];
            
            // Group users by location
            const locationsData = {};
            
            regularUsers
              .filter(user => user.managedBy === admin.id)
              .forEach(user => {
                const userLocation = getUserLocation(user);
                if (userLocation) {
                  if (!locationsData[userLocation]) {
                    locationsData[userLocation] = [];
                  }
                  locationsData[userLocation].push(user);
                }
              });
            
            // Filter locations by search query
            const filteredLocations = Object.entries(locationsData)
              .filter(([location, users]) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                
                if (location.toLowerCase().includes(query)) return true;
                
                return users.some(user => 
                  user.name && user.name.toLowerCase().includes(query)
                );
              });
            
            // Calculate total users
            const totalUsers = Object.values(locationsData).reduce(
              (sum, users) => sum + users.length, 0
            );
            
            return (
              <div
                key={admin.id}
                className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Admin Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700 hover:bg-opacity-20 transition-colors"
                  onClick={() => toggleAdminExpand(admin.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Expand/Collapse Icon */}
                    <div className="text-gray-400">
                      {isExpanded ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </div>
                    
                    {/* Admin Details */}
                    <div className="flex items-center gap-2">
                      <User size={20} className="text-blue-400" />
                      <h3 className="text-white text-lg font-medium">{admin.name}</h3>
                      <span className="bg-gray-700 bg-opacity-50 px-2 py-1 rounded text-xs text-gray-300">
                        {admin.role}
                      </span>
                    </div>
                  </div>
                  
                  {/* Location and User Count Badges */}
                  <div className="flex gap-3">
                    <div className="bg-blue-900 bg-opacity-20 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Building size={14} className="text-blue-400" />
                      <span className="text-blue-400 text-sm">{adminLocs.length} locations</span>
                    </div>
                    <div className="bg-blue-900 bg-opacity-20 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Users size={14} className="text-blue-400" />
                      <span className="text-blue-400 text-sm">{totalUsers} users</span>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700">
                    {adminLocs.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        No locations assigned to this administrator
                      </div>
                    ) : filteredLocations.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        No matching locations found
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-700">
                        {filteredLocations.map(([location, users]) => {
                          const locationKey = `${admin.id}-${location}`;
                          const isLocationExpanded = expandedLocations[locationKey];
                          
                          return (
                            <div key={location} className="px-4 py-3">
                              {/* Location Header */}
                              <div 
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-700 hover:bg-opacity-10 p-2 rounded-lg transition-colors"
                                onClick={() => toggleLocationExpand(admin.id, location)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="text-gray-400">
                                    {isLocationExpanded ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <MapPin size={16} className="text-blue-400" />
                                    <h4 className="text-white font-medium">{location}</h4>
                                  </div>
                                </div>
                                
                                <span className="text-xs bg-gray-700 bg-opacity-30 px-2 py-1 rounded-full text-gray-300 flex items-center gap-1">
                                  <Users size={12} />
                                  {users.length} users
                                </span>
                              </div>
                              
                              {/* User List */}
                              {isLocationExpanded && (
                                <div className="pl-10 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                  {users.map(user => (
                                    <div 
                                      key={user.id} 
                                      className="flex items-center gap-2 bg-gray-800 bg-opacity-30 p-2 rounded-lg hover:bg-opacity-50 transition-colors border border-gray-700 border-opacity-50"
                                    >
                                      <User size={16} className="text-gray-400" />
                                      <span className="text-white text-sm truncate">{user.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

CurrentManagementStructure.propTypes = {
  admins: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      role: PropTypes.string
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
  ).isRequired
};

export default CurrentManagementStructure;
import React, { useState, useEffect } from 'react';
import { X, Search, Users, User, Filter, Check, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/ParticipantSelectionDialog.css';
import { ref, get } from 'firebase/database';
import { database } from '../../../services/firebaseConfig';

const ParticipantSelectionDialog = ({ eventId, onClose }) => {
  // Get context values
  const {
    handleAssignParticipants,
    getManageableUsers,
    events,
    ensureUserScheduleNode
  } = useSchedulerContext();

  // State for the component
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    department: ''
  });
  const [error, setError] = useState(null);
  
  // For displaying filter options
  const [uniqueLocations, setUniqueLocations] = useState([]);
  const [uniqueDepartments, setUniqueDepartments] = useState([]);
  
  // Validate eventId - must be a string
  useEffect(() => {
    if (typeof eventId !== 'string') {
      console.error("Invalid eventId received:", eventId);
      onClose();
    }
  }, [eventId, onClose]);

  // Fetch event details
  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId || typeof eventId !== 'string') return;
      
      console.log("Loading event details for ID:", eventId);
      setLoading(true);
      
      try {
        // First check if event is in local state
        const foundEvent = events.find(e => e.id === eventId);
        
        if (foundEvent) {
          console.log("Found event in local state:", foundEvent);
          setEvent(foundEvent);
          
          // IMPORTANT: For "All Locations" events, don't set a location filter
          if (foundEvent.location === "All Locations") {
            setFilters({
              location: '', // Empty string means "All Locations" in the filter dropdown
              department: foundEvent.department || ''
            });
          } else {
            // For specific locations, we can pre-filter
            setFilters({
              location: foundEvent.location || '',
              department: foundEvent.department || ''
            });
          }
          
          // If the event has participants, pre-select them
          if (foundEvent.participants) {
            console.log("Pre-selecting participants:", foundEvent.participants);
            setSelectedUsers(Object.keys(foundEvent.participants));
          }
          
          setLoading(false);
          return;
        }
        
        // If not found in local state, fetch from Firebase
        const eventRef = ref(database, `events/${eventId}`);
        const snapshot = await get(eventRef);
        
        if (snapshot.exists()) {
          const eventData = snapshot.val();
          const formattedEvent = {
            ...eventData,
            id: eventId,
            start: new Date(eventData.start),
            end: new Date(eventData.end),
            title: eventData.title || "Untitled Event"
          };
          
          console.log("Fetched event from Firebase:", formattedEvent);
          setEvent(formattedEvent);
          
          // IMPORTANT: For "All Locations" events, don't set a location filter
          if (formattedEvent.location === "All Locations") {
            setFilters({
              location: '', // Empty string means "All Locations" in the filter dropdown
              department: formattedEvent.department || ''
            });
          } else {
            // For specific locations, we can pre-filter
            setFilters({
              location: formattedEvent.location || '',
              department: formattedEvent.department || ''
            });
          }
          
          // If the event has participants, pre-select them
          if (formattedEvent.participants) {
            console.log("Pre-selecting participants from Firebase:", formattedEvent.participants);
            setSelectedUsers(Object.keys(formattedEvent.participants));
          }
          
          setLoading(false);
        } else {
          console.error("Event not found:", eventId);
          setError("Event not found in database");
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        setError(`Error loading event: ${error.message}`);
        setLoading(false);
      }
    };
    
    loadEvent();
  }, [eventId, events]);

  // Fetch all users regardless of location
  const fetchAllUsers = async () => {
    try {
      console.log("Fetching all users");
      
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        console.log("No users found in database");
        return [];
      }
      
      const usersData = snapshot.val();
      console.log(`Total users in database: ${Object.keys(usersData).length}`);
      
      const allUsers = Object.entries(usersData)
        .filter(([_, userData]) => userData.profile) // Only users with profiles
        .map(([id, userData]) => ({
          id,
          name: userData.profile?.name || 'Unknown User',
          email: userData.profile?.email || '',
          department: userData.profile?.department || '',
          position: userData.profile?.position || '',
          primaryLocation: userData.profile?.primaryLocation || userData.profile?.location || '',
          hasSchedule: Boolean(userData.schedule)
        }));
      
      console.log(`Found ${allUsers.length} total users`);
      return allUsers;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  };

  // Fetch users by specific location
  const fetchUsersByLocation = async (location) => {
    if (!location) {
      console.log("No location provided to fetch users");
      return [];
    }
    
    // Special case for All Locations
    if (location === "All Locations") {
      console.log("Location is 'All Locations', fetching all users");
      return await fetchAllUsers();
    }
    
    try {
      console.log(`Fetching users in location: ${location}`);
      
      // Get all users
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        console.log("No users found in database");
        return [];
      }
      
      const usersData = snapshot.val();
      
      // Filter users by location (case-insensitive)
      const locationLower = location.toLowerCase().trim();
      
      const usersInLocation = Object.entries(usersData)
        .filter(([_, userData]) => {
          const userLocation = (userData.profile?.primaryLocation || userData.profile?.location || '').toLowerCase().trim();
          return userLocation === locationLower;
        })
        .map(([id, userData]) => ({
          id,
          name: userData.profile?.name || 'Unknown User',
          email: userData.profile?.email || '',
          department: userData.profile?.department || '',
          position: userData.profile?.position || '',
          primaryLocation: userData.profile?.primaryLocation || userData.profile?.location || '',
          hasSchedule: Boolean(userData.schedule)
        }));
      
      console.log(`Found ${usersInLocation.length} users in location "${location}"`);
      
      // If no exact matches, try a more flexible search
      if (usersInLocation.length === 0) {
        const fuzzyUsersInLocation = Object.entries(usersData)
          .filter(([_, userData]) => {
            const userLocation = (userData.profile?.primaryLocation || userData.profile?.location || '').toLowerCase().trim();
            // Use includes instead of exact match
            return userLocation.includes(locationLower) || locationLower.includes(userLocation);
          })
          .map(([id, userData]) => ({
            id,
            name: userData.profile?.name || 'Unknown User',
            email: userData.profile?.email || '',
            department: userData.profile?.department || '',
            position: userData.profile?.position || '',
            primaryLocation: userData.profile?.primaryLocation || userData.profile?.location || '',
            hasSchedule: Boolean(userData.schedule)
          }));
          
        console.log(`Fuzzy search found ${fuzzyUsersInLocation.length} users in location "${location}"`);
        
        if (fuzzyUsersInLocation.length > 0) {
          return fuzzyUsersInLocation;
        }
        
        // If still no matches, fall back to all users
        console.log(`No users found with fuzzy match. Falling back to all users.`);
        return await fetchAllUsers();
      }
      
      return usersInLocation;
    } catch (error) {
      console.error(`Error fetching users for location ${location}:`, error);
      // On error, fall back to all users
      return await fetchAllUsers();
    }
  };

  // Fetch users for selection
  useEffect(() => {
    const fetchUsers = async () => {
      if (!event) return;
      
      setLoading(true);
      try {
        let usersToShow = [];
        
        // Special handling for "All Locations" events
        if (event.location === "All Locations") {
          console.log("Fetching users for ALL LOCATIONS event");
          usersToShow = await fetchAllUsers();
        }
        // If event has a specific location, directly fetch users by that location
        else if (event.location) {
          console.log(`Fetching users for event location: ${event.location}`);
          usersToShow = await fetchUsersByLocation(event.location);
        } else {
          // Fall back to the regular getManageableUsers function
          console.log("No location specified, using getManageableUsers");
          usersToShow = await getManageableUsers();
        }
        
        // Ensure all users have schedule nodes
        for (const user of usersToShow) {
          if (!user.hasSchedule && ensureUserScheduleNode) {
            console.log(`Ensuring schedule node for user ${user.id}`);
            try {
              await ensureUserScheduleNode(user.id);
            } catch (error) {
              console.warn(`Failed to ensure schedule node for user ${user.id}:`, error);
              // Continue even if this fails
            }
          }
        }
        
        if (usersToShow.length === 0) {
          setError("No users found. Please check the event location or try a different filter.");
        } else {
          setError(null);
        }
        
        console.log(`Total users to display: ${usersToShow.length}`);
        setUsers(usersToShow);
        
        // Extract unique locations and departments for filters
        const locations = [...new Set(usersToShow.map(user => user.primaryLocation).filter(Boolean))];
        const departments = [...new Set(usersToShow.map(user => user.department).filter(Boolean))];
        
        setUniqueLocations(locations);
        setUniqueDepartments(departments);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError(`Error loading users: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [event, getManageableUsers, ensureUserScheduleNode]);

  // Save handler
  const handleSave = () => {
    if (!eventId || typeof eventId !== 'string') {
      console.error("No valid event ID available for assignment");
      return;
    }
    
    console.log(`Saving ${selectedUsers.length} participants for event ${eventId}`);
    handleAssignParticipants(eventId, selectedUsers);
    onClose();
  };

  // Toggle user selection
  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Handle filter changes
  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Select/Deselect all users
  const handleSelectAll = (filtered) => {
    if (filtered.length === selectedUsers.length) {
      // Deselect all if all are currently selected
      setSelectedUsers([]);
    } else {
      // Select all filtered users
      setSelectedUsers(filtered.map(user => user.id));
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({
      location: '',
      department: ''
    });
  };

  // Filter users based on search term and filters
  const filteredUsers = users.filter(user => {
    // Search by name or email
    const matchesSearch = searchTerm === '' || 
                         (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by location
    const matchesLocation = filters.location === '' || 
                           (user.primaryLocation && 
                            user.primaryLocation.toLowerCase().trim() === filters.location.toLowerCase().trim());
    
    // Filter by department
    const matchesDepartment = filters.department === '' || 
                             (user.department && 
                              user.department.toLowerCase().trim() === filters.department.toLowerCase().trim());
    
    return matchesSearch && matchesLocation && matchesDepartment;
  });

  // Group users by location for display
  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const location = user.primaryLocation || 'No Location';
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(user);
    return acc;
  }, {});

  // If eventId is invalid, don't render
  if (!eventId || typeof eventId !== 'string') {
    return null;
  }

  // If we don't have the event yet, show loading
  if (!event && loading) {
    return (
      <div className="participant-dialog-overlay">
        <div className="participant-dialog">
          <div className="dialog-header">
            <h2>Loading Event...</h2>
            <button onClick={onClose} className="close-button">
              <X size={20} />
            </button>
          </div>
          <div className="dialog-content">
            <div className="loading">
              <Loader2 size={24} className="animate-spin" />
              <span>Loading event details...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-dialog-overlay">
      <div className="participant-dialog">
        <div className="dialog-header">
          <h2>Select Participants</h2>
          <div className="event-info">
            <h3>{event?.title || 'Event'}</h3>
            <p>
              <MapPin size={14} className="inline-icon" />
              {event?.location || 'No location'} - {event?.start ? new Date(event.start).toLocaleDateString() : 'No date'}
            </p>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="search-filters">
            <div className="search-bar">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {(searchTerm || filters.location || filters.department) && (
                <button 
                  className="clear-filters-button"
                  onClick={handleClearFilters}
                  title="Clear all filters"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="filters">
              <div className="filter-group">
                <Filter size={16} className="filter-icon" />
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <Filter size={16} className="filter-icon" />
                <select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <Loader2 size={24} className="animate-spin" />
              <span>Loading users...</span>
            </div>
          ) : (
            <div className="user-selection">
              <div className="selection-header">
                <div className="selection-count">
                  <div className="count-badge">{selectedUsers.length}</div>
                  <span>users selected</span>
                </div>
                
                <button 
                  className="select-all-button"
                  onClick={() => handleSelectAll(filteredUsers)}
                  disabled={filteredUsers.length === 0}
                >
                  {filteredUsers.length === selectedUsers.length && filteredUsers.length > 0 
                    ? 'Deselect All' 
                    : 'Select All'}
                </button>
              </div>
              
              <div className="user-list">
                {Object.entries(groupedUsers).length > 0 ? (
                  Object.entries(groupedUsers).map(([location, locationUsers]) => (
                    <div key={location} className="location-group">
                      <div className="location-header">
                        <h4>{location}</h4>
                        <span className="user-count">{locationUsers.length} users</span>
                      </div>
                      
                      <div className="user-grid">
                        {locationUsers.map(user => (
                          <div 
                            key={user.id}
                            className={`user-card ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                            onClick={() => handleSelectUser(user.id)}
                          >
                            <div className="user-avatar">
                              <User size={20} />
                            </div>
                            <div className="user-info">
                              <div className="user-name">{user.name}</div>
                              <div className="user-details">
                                {user.department && <span>{user.department}</span>}
                                {user.position && <span>{user.position}</span>}
                              </div>
                            </div>
                            <div className="selection-indicator">
                              {selectedUsers.includes(user.id) && <Check size={16} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-results">
                    <Users size={24} />
                    <p>No users match your criteria</p>
                    <div className="suggestion">
                      {event?.location && (
                        <p>Try clearing your filters or check that users exist in "{event.location}"</p>
                      )}
                      <button 
                        className="reset-search-button"
                        onClick={handleClearFilters}
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="cancel-button">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={selectedUsers.length === 0}
            className="save-button"
          >
            Assign {selectedUsers.length} Participants
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantSelectionDialog;
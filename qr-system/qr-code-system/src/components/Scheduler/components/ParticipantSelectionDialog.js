import React, { useState, useEffect } from 'react';
import { X, Search, Users, User, Filter, Check, MapPin, AlertCircle } from 'lucide-react';
import { useSchedulerContext } from '../context/SchedulerContext';
import '../styles/ParticipantSelectionDialog.css';
import { ref, get, set } from 'firebase/database';
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
          
          // Update filters based on event
          setFilters({
            location: foundEvent.location || '',
            department: foundEvent.department || ''
          });
          
          // If the event has participants, pre-select them
          if (foundEvent.participants) {
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
          
          // Update filters based on event
          setFilters({
            location: formattedEvent.location || '',
            department: formattedEvent.department || ''
          });
          
          // If the event has participants, pre-select them
          if (formattedEvent.participants) {
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

  // Fetch users by location
  const fetchUsersByLocation = async (location) => {
    if (!location) {
      console.log("No location provided to fetch users");
      return [];
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
        return fuzzyUsersInLocation;
      }
      
      return usersInLocation;
    } catch (error) {
      console.error(`Error fetching users for location ${location}:`, error);
      return [];
    }
  };

  // Fetch all users as fallback
  const fetchAllUsers = async () => {
    try {
      console.log("Fetching all users");
      
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const usersData = snapshot.val();
      
      const allUsers = Object.entries(usersData)
        .filter(([_, userData]) => userData.profile)
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

  // Fetch users for selection
  useEffect(() => {
    const fetchUsers = async () => {
      if (!event) return;
      
      setLoading(true);
      try {
        let usersToShow = [];
        
        // If event has a location, directly fetch users by that location
        if (event.location) {
          console.log(`Fetching users for event location: ${event.location}`);
          const locationUsers = await fetchUsersByLocation(event.location);
          
          // If no users found for this location, try fetching all users as fallback
          if (locationUsers.length === 0) {
            console.log(`No users found for location "${event.location}", fetching all users`);
            usersToShow = await fetchAllUsers();
          } else {
            usersToShow = locationUsers;
          }
          
          // Ensure all users have schedule nodes
          for (const user of usersToShow) {
            if (!user.hasSchedule && ensureUserScheduleNode) {
              console.log(`Ensuring schedule node for user ${user.id}`);
              await ensureUserScheduleNode(user.id);
            }
          }
        } else {
          // Fall back to the regular getManageableUsers function
          usersToShow = await getManageableUsers();
        }
        
        if (usersToShow.length === 0) {
          setError("No users found. Please check the event location or try a different filter.");
        } else {
          setError(null);
        }
        
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
            <div className="loading">Loading event details...</div>
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
            <div className="loading">Loading users...</div>
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
                    {event?.location && (
                      <div className="suggestion">
                        <p>Try clearing your filters or check that users exist in "{event.location}"</p>
                      </div>
                    )}
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
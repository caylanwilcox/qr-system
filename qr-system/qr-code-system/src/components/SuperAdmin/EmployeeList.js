import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { User, TrendingUp, TrendingDown, Search, Loader2, UserCircle, MapPin, ChevronLeft, Award } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './EmployeeListPage.css';

// Helper function to get user's full name from various possible fields
const getUserFullName = (user) => {
  const profile = user.profile || {};
  
  // Priority order for name fields
  if (profile.firstName && profile.lastName) {
    return `${profile.firstName} ${profile.lastName}`;
  }
  
  if (profile.name) return profile.name;
  if (profile.displayName) return profile.displayName;
  if (profile.fullName) return profile.fullName;
  
  if (profile.firstName) return profile.firstName;
  if (profile.lastName) return profile.lastName;
  
  return `Unknown User (${user.id?.substring(0, 5) || 'N/A'})`;
};

// Helper function to extract location from user data
const extractUserLocation = (user) => {
  if (!user) return null;
  
  // Check all possible location fields
  const possibleLocations = [
    user.location,
    user.locationKey,
    user.profile?.location,
    user.profile?.locationKey,
    user.profile?.primaryLocation
  ];
  
  // Find the first non-empty location
  for (const loc of possibleLocations) {
    if (loc && typeof loc === 'string' && loc.trim() !== '') {
      return loc.trim();
    }
  }
  
  return 'Unknown';
};

const EmployeeList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [activeFilters, setActiveFilters] = useState({
    color: null,
    service: null,
    location: null
  });
  const [debug, setDebug] = useState({
    locationState: null,
    appliedFilters: null
  });

  // Extract filters from location state if available
  useEffect(() => {
    if (location.state) {
      console.log("Location state received:", location.state);
      const newFilters = { ...activeFilters };
      
      if (location.state.filter) {
        // Handle service filter (RSG, COM)
        if (['RSG', 'COM'].includes(location.state.filter)) {
          newFilters.service = location.state.filter;
        }
        
        // Handle color filter that's part of the filter string (padrinosBlue, padrinosGreen, etc.)
        if (location.state.filter.startsWith('padrinos') && location.state.filter !== 'padrinos') {
          const colorValue = location.state.filter.replace('padrinos', '').toLowerCase();
          console.log("Setting color filter to:", colorValue);
          newFilters.color = colorValue;
        }
      }
      
      // Handle direct color parameter (for combined filters)
      if (location.state.color) {
        console.log("Setting color filter from direct parameter:", location.state.color);
        newFilters.color = location.state.color;
      }
      
      // Handle location filter
      if (location.state.location) {
        console.log("Setting location filter to:", location.state.location);
        newFilters.location = location.state.location;
      }
      
      console.log("New filters:", newFilters);
      setActiveFilters(newFilters);
      
      // Save debug info
      setDebug({
        locationState: location.state,
        appliedFilters: newFilters
      });
    }
  }, [location.state]);

  useEffect(() => {
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      // Map through the users with improved name handling
      const employeeList = Object.entries(data)
        .map(([id, user]) => {
          // Add ID to the user object for reference
          user.id = id;
          
          // Extract location using our helper function
          const userLocation = extractUserLocation(user);
          
          return {
            id,
            name: getUserFullName(user),
            position: user.profile?.position || 'N/A',
            location: userLocation,
            padrinoColor: user.profile?.padrinoColorCode || null,
            service: user.profile?.service || '',
            isPadrino: user.profile?.padrino === true,
            stats: {
              attendanceRate: calculateAttendanceRate(user.stats),
              onTimeRate: calculateOnTimeRate(user.stats),
              rankChange: user.stats?.rankChange,
              lastActive: user.stats?.lastActive || null
            }
          };
        });

      setEmployees(employeeList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateAttendanceRate = (stats) => {
    if (!stats) return 0;
    const total = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
    return total > 0 ? ((stats.daysPresent || 0) / total * 100).toFixed(1) : 0;
  };

  const calculateOnTimeRate = (stats) => {
    if (!stats || !stats.daysPresent) return 0;
    const onTime = stats.daysPresent - (stats.daysLate || 0);
    return ((onTime / stats.daysPresent) * 100).toFixed(1);
  };

  const getScoreClass = (score) => {
    const numScore = parseFloat(score);
    if (numScore >= 0) return 'bg-emerald-400';
 
    
  };

  // Get color for padrino rank
  const getPadrinoColorClass = (color) => {
    if (!color) return '';
    
    const colorMap = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      orange: 'bg-orange-500'
    };
    return colorMap[color.toLowerCase()] || '';
  };

  // Location matching function to handle case insensitivity
  const locationMatches = (employeeLocation, filterLocation) => {
    if (!filterLocation) return true;
    if (!employeeLocation) return false;
    
    return employeeLocation.toLowerCase() === filterLocation.toLowerCase();
  };

  // Apply all filters and sorting
  const sortedEmployees = useMemo(() => {
    if (!employees.length) return [];
    console.log("Filtering employees with filters:", activeFilters);
    
    let filteredList = [...employees];
    
    // Apply search filter
    if (searchTerm) {
      filteredList = filteredList.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply color filter
    if (activeFilters.color) {
      filteredList = filteredList.filter(emp => 
        emp.padrinoColor?.toLowerCase() === activeFilters.color.toLowerCase()
      );
    }
    
    // Apply service filter
    if (activeFilters.service) {
      filteredList = filteredList.filter(emp => 
        emp.service.toUpperCase() === activeFilters.service
      );
    }
    
    // Apply location filter
    if (activeFilters.location) {
      filteredList = filteredList.filter(emp => 
        locationMatches(emp.location, activeFilters.location)
      );
    }

    // Apply sorting
    filteredList.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // For sorting by attendance or on-time rates, extract the appropriate stat value.
      if (sortConfig.key === 'stats.attendanceRate' || sortConfig.key === 'stats.onTimeRate') {
        aValue = Number(a.stats[sortConfig.key.split('.')[1]]);
        bValue = Number(b.stats[sortConfig.key.split('.')[1]]);
      }
      
      // Special handling for rank/padrino status sorting
      if (sortConfig.key === 'isPadrino') {
        // Sort by padrino status first (padrinos come first)
        if (a.isPadrino !== b.isPadrino) {
          return sortConfig.direction === 'asc' 
            ? (a.isPadrino ? -1 : 1)
            : (a.isPadrino ? 1 : -1);
        }
        
        // If both are padrinos, sort by color rank
        if (a.isPadrino && b.isPadrino) {
          const colorRank = {
            'blue': 1,
            'green': 2,
            'orange': 3,
            'red': 4,
            '': 5
          };
          
          const aRank = colorRank[a.padrinoColor?.toLowerCase() || ''] || 5;
          const bRank = colorRank[b.padrinoColor?.toLowerCase() || ''] || 5;
          
          return sortConfig.direction === 'asc' 
            ? aRank - bRank
            : bRank - aRank;
        }
        
        // Default to name sort if neither is a padrino
        aValue = a.name;
        bValue = b.name;
      }
      
      return sortConfig.direction === 'asc' 
        ? aValue < bValue ? -1 : 1
        : aValue > bValue ? -1 : 1;
    });

    return filteredList;
  }, [employees, searchTerm, sortConfig, activeFilters]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEmployeeClick = (employeeId) => {
    navigate(`/super-admin/users/${employeeId}`);
  };

  const handleClearFilters = () => {
    setActiveFilters({
      color: null,
      service: null,
      location: null
    });
    
    // Clear the location state
    navigate('/employee-list', { replace: true, state: {} });
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  // Render arrow indicator for sort state
  const renderSortArrow = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? 
        '↑' : '↓';
    }
    return null;
  };

  // Get the filter description
  const getFilterDescription = () => {
    const filters = [];
    
    if (activeFilters.service) {
      filters.push(activeFilters.service === 'RSG' ? 'Orejas' : 'Apoyos');
    }
    
    if (activeFilters.color) {
      filters.push(`${activeFilters.color.charAt(0).toUpperCase() + activeFilters.color.slice(1)} Padrinos`);
    }
    
    if (activeFilters.location) {
      filters.push(`Location: ${activeFilters.location}`);
    }
    
    return filters.length > 0 ? filters.join(' • ') : 'All Employees';
  };

  // Display rank label with proper styling
  const renderRankLabel = (employee) => {
    if (!employee.isPadrino) {
      return <span className="text-gray-400">Not a Padrino</span>;
    }
    
    if (!employee.padrinoColor) {
      return (
        <div className="flex items-center gap-1">
          <Award className="h-4 w-4 text-amber-400" />
          <span>Padrino</span>
        </div>
      );
    }
    
    const colorTextClass = {
      'blue': 'text-blue-400',
      'green': 'text-green-400',
      'orange': 'text-orange-400',
      'red': 'text-red-400'
    }[employee.padrinoColor?.toLowerCase()] || 'text-gray-400';
    
    return (
      <div className="flex items-center gap-1">
        <Award className={`h-4 w-4 ${colorTextClass}`} />
        <span className={`font-medium ${colorTextClass} capitalize`}>
          {employee.padrinoColor} Padrino
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="employee-list-page">
        <div className="glass-card">
          <div className="loading-overlay">
            <Loader2 className="animate-spin h-8 w-8" />
            <p className="mt-2">Loading employee data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-list-page">
      <div className="glass-card">
        {/* Back button */}
        <button className="back-button" onClick={handleBackClick}>
          <ChevronLeft size={16} />
          Back
        </button>

        <h1 className="employee-list-title">{getFilterDescription()}</h1>
        <p className="employee-list-subtitle">
          Showing {sortedEmployees.length} {sortedEmployees.length === 1 ? 'employee' : 'employees'}
        </p>

        {/* Debug Info - Can be removed in production */}
        {debug.locationState && (
          <div className="bg-slate-800/40 p-2 rounded-lg text-xs mb-2">
            <details>
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 text-green-300">
                {JSON.stringify({
                  locationState: debug.locationState,
                  appliedFilters: debug.appliedFilters,
                  allEmployees: employees.length,
                  filteredEmployees: sortedEmployees.length
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Search and filter controls */}
        <div className="flex justify-between mb-4">
          <div className="search-container">
            <div className="relative">
              <Search className="h-4 w-4 text-blue-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Clear filters button */}
          {(activeFilters.color || activeFilters.service || activeFilters.location) && (
            <button 
              onClick={handleClearFilters}
              className="px-3 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-white rounded-lg flex items-center gap-1"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Legend for Padrino ranks */}
        <div className="mb-4 p-2 bg-slate-800/30 rounded-lg">
          <h3 className="text-sm font-medium text-white/80 mb-2">Padrino Rank Legend:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
              <span className="text-xs text-blue-400">Blue (≥90% attendance)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span className="text-xs text-green-400">Green (≥75% attendance)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500 mr-1"></div>
              <span className="text-xs text-orange-400">Orange (≥60% attendance)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <span className="text-xs text-red-400">Red (&lt;60% attendance)</span>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <table className="employee-list-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>
                Name {renderSortArrow('name')}
              </th>
              <th onClick={() => handleSort('location')} style={{cursor: 'pointer'}}>
                Location {renderSortArrow('location')}
              </th>
              <th onClick={() => handleSort('service')} style={{cursor: 'pointer'}}>
                Service {renderSortArrow('service')}
              </th>
              <th onClick={() => handleSort('stats.attendanceRate')} style={{cursor: 'pointer'}}>
                Attendance {renderSortArrow('stats.attendanceRate')}
              </th>
              <th onClick={() => handleSort('stats.onTimeRate')} style={{cursor: 'pointer'}}>
                On-Time {renderSortArrow('stats.onTimeRate')}
              </th>
              <th onClick={() => handleSort('isPadrino')} style={{cursor: 'pointer'}}>
                Rank {renderSortArrow('isPadrino')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.length === 0 ? (
              <tr>
                <td colSpan="6">No employees found matching your criteria.</td>
              </tr>
            ) : (
              sortedEmployees.map((employee) => (
                <tr key={employee.id} onClick={() => handleEmployeeClick(employee.id)} style={{cursor: 'pointer'}}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getScoreClass(employee.stats.attendanceRate)}`}></div>
                      {employee.name}
                    </div>
                  </td>
                  <td>{employee.location}</td>
                  <td>{employee.service}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      parseFloat(employee.stats.attendanceRate) >= 75 
                        ? 'bg-green-700/30 text-green-300' 
                        : 'bg-red-700/30 text-red-300'
                    }`}>
                      {employee.stats.attendanceRate}%
                    </span>
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs ${
                      parseFloat(employee.stats.onTimeRate) >= 85 
                        ? 'bg-green-700/30 text-green-300' 
                        : parseFloat(employee.stats.onTimeRate) >= 65
                          ? 'bg-yellow-700/30 text-yellow-300'
                          : 'bg-red-700/30 text-red-300'
                    }`}>
                      {employee.stats.onTimeRate}%
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {renderRankLabel(employee)}
                      {employee.isPadrino && employee.padrinoColor && (
                        <div 
                          className={`w-4 h-4 rounded-full ${getPadrinoColorClass(employee.padrinoColor)}`}
                        ></div>
                      )}
                      {employee.stats.rankChange && 
                        Date.now() - new Date(employee.stats.rankChange.date).getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                          employee.stats.rankChange.direction === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;
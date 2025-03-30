'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { User, TrendingUp, TrendingDown, Search, Loader2, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const EmployeeList = ({ colorFilter }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

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
          // Add ID to the user object for name extraction
          user.id = id;
          
          return {
            id,
            name: getUserFullName(user),
            position: user.profile?.position || 'N/A',
            location: user.profile?.primaryLocation || 'N/A',
            padrinoColor: user.profile?.padrinoColor || 'blue',
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

  const getColorClass = (color) => {
    const colorMap = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      orange: 'bg-orange-500'
    };
    return colorMap[color?.toLowerCase()] || 'bg-gray-500';
  };
  
  const getTextColorClass = (color) => {
    const colorMap = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      red: 'text-red-500',
      orange: 'text-orange-500'
    };
    return colorMap[color?.toLowerCase()] || 'text-gray-500';
  };

  const sortedEmployees = useMemo(() => {
    let filteredList = [...employees];
    
    if (searchTerm) {
      filteredList = filteredList.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (colorFilter) {
      filteredList = filteredList.filter(emp => 
        emp.padrinoColor?.toLowerCase() === colorFilter.replace('padrinos', '').toLowerCase()
      );
    }

    filteredList.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // For sorting by attendance or on-time rates, extract the appropriate stat value.
      if (sortConfig.key === 'stats.attendanceRate' || sortConfig.key === 'stats.onTimeRate') {
        aValue = Number(a.stats[sortConfig.key.split('.')[1]]);
        bValue = Number(b.stats[sortConfig.key.split('.')[1]]);
      }
      
      return sortConfig.direction === 'asc' 
        ? aValue < bValue ? -1 : 1
        : aValue > bValue ? -1 : 1;
    });

    return filteredList;
  }, [employees, searchTerm, sortConfig, colorFilter]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEmployeeClick = (employeeId) => {
    navigate(`/super-admin/users/${employeeId}`);
  };

  // Render arrow indicator for sort state
  const renderSortArrow = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? 
        '↑' : '↓';
    }
    return null;
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading employee data...</p>
      </div>
    );
  }

  return (
    <div className="employee-list card">
      <div className="card-header">
        <UserCircle className="h-5 w-5 text-blue-500" />
        <h3>Employees ({sortedEmployees.length})</h3>
        
        <div className="search-container ml-auto">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1 text-sm bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="list-header">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600 border-b border-gray-200">
          <div className="cursor-pointer hover:text-blue-600 flex items-center" onClick={() => handleSort('name')}>
            Name {renderSortArrow('name')}
          </div>
          <div className="cursor-pointer hover:text-blue-600 text-center flex items-center justify-center" onClick={() => handleSort('stats.attendanceRate')}>
            Attendance {renderSortArrow('stats.attendanceRate')}
          </div>
          <div className="cursor-pointer hover:text-blue-600 text-center flex items-center justify-center" onClick={() => handleSort('stats.onTimeRate')}>
            On Time {renderSortArrow('stats.onTimeRate')}
          </div>
          <div className="cursor-pointer hover:text-blue-600 text-right flex items-center justify-end" onClick={() => handleSort('padrinoColor')}>
            Rank {renderSortArrow('padrinoColor')}
          </div>
        </div>
      </div>

      {sortedEmployees.length === 0 ? (
        <div className="empty-state">
          <p>No employees found matching your search</p>
        </div>
      ) : (
        <div className="user-list">
          {sortedEmployees.map((employee) => (
            <div
              key={employee.id}
              onClick={() => handleEmployeeClick(employee.id)}
              className="user-item hover:bg-gray-50 cursor-pointer"
            >
              <div className="user-info">
                <div className="user-name">
                  <span className={`status-dot ${getColorClass(employee.padrinoColor)}`}></span>
                  {employee.name}
                </div>
                <div className="user-location">{employee.location} • {employee.position}</div>
              </div>
              
              <div className="stats-container grid grid-cols-3 gap-2 text-sm">
                <div className="stat-item text-center">
                  <div className={`stat-value font-medium ${
                    Number(employee.stats.attendanceRate) >= 75 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {employee.stats.attendanceRate}%
                  </div>
                </div>
                
                <div className="stat-item text-center">
                  <div className={`stat-value font-medium ${
                    Number(employee.stats.onTimeRate) >= 90 ? 'text-green-600' 
                    : Number(employee.stats.onTimeRate) >= 75 ? 'text-amber-600' 
                    : 'text-red-600'
                  }`}>
                    {employee.stats.onTimeRate}%
                  </div>
                </div>
                
                <div className="stat-item text-right">
                  <div className="stat-value flex items-center justify-end space-x-1">
                    <span className={`font-medium ${getTextColorClass(employee.padrinoColor)} capitalize`}>
                      {employee.padrinoColor}
                    </span>
                    {employee.stats.rankChange &&
                      Date.now() - new Date(employee.stats.rankChange.date).getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                        employee.stats.rankChange.direction === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500 ml-1" />
                        )
                      )
                    }
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
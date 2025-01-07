import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Users, Activity } from 'lucide-react';
import './ManageEmployees.css';

const ManageEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const locations = [
    'Aurora',
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
    'Retreat',
  ];

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const usersRef = ref(database, 'users');
        
        onValue(usersRef, (snapshot) => {
          const usersData = snapshot.val();
          if (!usersData) {
            setEmployees([]);
            return;
          }

          const employeeList = Object.entries(usersData)
            .filter(([_, userData]) => userData && userData.name)
            .map(([userId, userData]) => {
              const currentLocation = userData.locationHistory?.[0]?.locationId || 'Unknown';
              const status = userData.status?.toLowerCase() || 'inactive';
              
              // Calculate statistics
              const stats = userData.stats || {};
              const daysPresent = stats.daysPresent || 0;
              const daysAbsent = stats.daysAbsent || 0;
              const daysLate = stats.daysLate || 0;
              const totalDays = daysPresent + daysAbsent;
              
              const attendanceRate = totalDays > 0 
                ? ((daysPresent / totalDays) * 100).toFixed(1)
                : 0;
              
              const onTimeRate = daysPresent > 0
                ? (((daysPresent - daysLate) / daysPresent) * 100).toFixed(1)
                : 0;

              return {
                id: userId,
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                position: userData.position || 'Member',
                location: currentLocation,
                status,
                stats: {
                  daysPresent,
                  daysAbsent,
                  daysLate,
                  rank: stats.rank || 0,
                  attendanceRate,
                  onTimeRate,
                }
              };
            });

          setEmployees(employeeList);
          setError(null);
        });
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employee data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filterEmployees = (employeeList) => {
    let filtered = employeeList;
    
    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(emp => emp.status === filter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(search) ||
        emp.email?.toLowerCase().includes(search) ||
        emp.position.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  const getRoleCount = (employees, location, role) => {
  return employees.filter(emp => 
    emp.location === location && 
    emp.role?.toLowerCase() === role.toLowerCase()
  ).length;
};

  const LocationCard = ({ location }) => {
    const locationEmployees = employees.filter(emp => emp.location === location);
    const activeCount = locationEmployees.filter(emp => emp.status === 'active').length;
    const adminCount = getRoleCount(employees, location, 'admin');
    
    const attendanceStats = locationEmployees.reduce((acc, emp) => {
      acc.totalAttendance += parseFloat(emp.stats.attendanceRate) || 0;
      return acc;
    }, { totalAttendance: 0 });
    
    const averageAttendance = locationEmployees.length > 0
      ? (attendanceStats.totalAttendance / locationEmployees.length).toFixed(1)
      : 0;

    return (
      <div className="location-card" onClick={() => setSelectedLocation(location)}>
        <h3 className="location-name">{location}</h3>
        <div className="location-stats">
          <p><Users size={16} /> Total Members: {locationEmployees.length}</p>
          <p className="active-count"><Activity size={16} /> Active: {activeCount}</p>
          <p className="admin-count"><Users size={16} /> Admins: {adminCount}</p>
          <p className="attendance-rate">Avg. Attendance: {averageAttendance}%</p>
        </div>
      </div>
    );
  };

  const EmployeeTable = ({ employees }) => (
    <div className="employee-table-container">
      <table className="employee-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Position</th>
            <th>Role</th>
            <th>Status</th>
            <th>Days Present</th>
            <th>Days Absent</th>
            <th>Days Late</th>
            <th>Attendance Rate</th>
            <th>On-Time Rate</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                <Link to={`/super-admin/users/${employee.id}`} className="employee-name">
                  {employee.name}
                </Link>
              </td>
              <td>{employee.position}</td>
              <td>
                <span className={`role-badge ${employee.role?.toLowerCase() || 'employee'}`}>
                  {employee.role || 'Employee'}
                </span>
              </td>
              <td>
                <span className={`status-indicator ${employee.status}`}>
                  {employee.status}
                </span>
              </td>
              <td>{employee.stats.daysPresent}</td>
              <td>{employee.stats.daysAbsent}</td>
              <td>{employee.stats.daysLate}</td>
              <td className={`reliability-score ${
                employee.stats.attendanceRate >= 95 ? 'score-perfect' :
                employee.stats.attendanceRate >= 85 ? 'score-high' :
                employee.stats.attendanceRate >= 75 ? 'score-good' :
                employee.stats.attendanceRate >= 65 ? 'score-medium' :
                employee.stats.attendanceRate >= 55 ? 'score-below' :
                employee.stats.attendanceRate >= 45 ? 'score-poor' :
                'score-critical'
              }`}>
                {employee.stats.attendanceRate}%
              </td>
              <td className={`reliability-score ${
                employee.stats.onTimeRate >= 95 ? 'score-perfect' :
                employee.stats.onTimeRate >= 85 ? 'score-high' :
                employee.stats.onTimeRate >= 75 ? 'score-good' :
                employee.stats.onTimeRate >= 65 ? 'score-medium' :
                employee.stats.onTimeRate >= 55 ? 'score-below' :
                employee.stats.onTimeRate >= 45 ? 'score-poor' :
                'score-critical'
              }`}>
                {employee.stats.onTimeRate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p>Loading member data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (selectedLocation) {
    const locationEmployees = employees.filter(emp => emp.location === selectedLocation);
    const activeCount = locationEmployees.filter(emp => emp.status === 'active').length;
    const filteredEmployees = filterEmployees(locationEmployees);

    return (
      <div className="manage-dashboard">
        <div className="location-header">
          <button onClick={() => setSelectedLocation(null)} className="back-button">
            <ChevronLeft size={20} />
            Back to Locations
          </button>
          
          <div className="header-content">
            <h2 className="location-title">{selectedLocation}</h2>
            <div className="location-summary">
              <div className="summary-item">
                <Users size={16} />
                Total Members: {locationEmployees.length}
              </div>
              <div className="summary-item active-count">
                <Activity size={16} />
                Active Members: {activeCount}
              </div>
            </div>
            
            <div className="header-controls">
              <div className="search-container">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Members</option>
                <option value="active">Active Members</option>
                <option value="inactive">Inactive Members</option>
              </select>
            </div>
          </div>
        </div>

        {filteredEmployees.length > 0 ? (
          <EmployeeTable employees={filteredEmployees} />
        ) : (
          <div className="empty-state">
            <p>No members found matching your criteria.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="manage-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Location Overview</h2>
        <div className="search-container">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="location-grid">
        {locations
          .filter(location => 
            location.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((location) => (
            <LocationCard key={location} location={location} />
          ))
        }
      </div>
    </div>
  );
};

export default ManageEmployees;
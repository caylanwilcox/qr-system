import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
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
    'West Chicago',
    'Lyons',
    'Elgin',
    'Joliet',
    'Wheeling',
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
            setLoading(false);
            return;
          }

          // Map through the users using the new structure:
          // - Profile data is under userData.profile
          // - Performance metrics are under userData.stats
          const employeeList = Object.entries(usersData)
            .filter(([_, userData]) => userData && userData.profile && userData.profile.name)
            .map(([userId, userData]) => {
              const profile = userData.profile;
              const stats = userData.stats || {};

              // Use primaryLocation from profile
              const currentLocation = profile.primaryLocation || 'Unknown';
              const status = (profile.status || 'inactive').toLowerCase();
              const role = (profile.role || 'employee').toLowerCase();
              const service = profile.service || 'Not Assigned';

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
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                service,
                location: currentLocation,
                status,
                role,
                stats: {
                  daysPresent,
                  daysAbsent,
                  daysLate,
                  rank: stats.rank || 0,
                  attendanceRate,
                  onTimeRate,
                },
              };
            });

          setEmployees(employeeList);
          setError(null);
          setLoading(false);
        });
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employee data. Please try again later.');
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filterEmployees = (employeeList) => {
    let filtered = employeeList;
    
    if (filter !== 'all') {
      filtered = filtered.filter((emp) => emp.status === filter);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((emp) => 
        emp.name.toLowerCase().includes(search) ||
        emp.email?.toLowerCase().includes(search) ||
        emp.service.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  // Update role inside the profile node
  const handleToggleRole = async (employee) => {
    try {
      const newRole = employee.role === 'admin' ? 'employee' : 'admin';
      await update(ref(database, `users/${employee.id}/profile`), {
        role: newRole,
      });
      console.log(`Role updated to "${newRole}" for user: ${employee.id}`);
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role. Please try again.');
    }
  };

  const getRoleCount = (employees, location, role) => {
    return employees.filter(
      (emp) => emp.location === location && emp.role === role.toLowerCase()
    ).length;
  };

  const LocationCard = ({ location }) => {
    const locationEmployees = employees.filter(
      (emp) => emp.location.toLowerCase() === location.toLowerCase()
    );
    const activeCount = locationEmployees.filter(
      (emp) => emp.status === 'active'
    ).length;
    const adminCount = locationEmployees.filter(
      (emp) => emp.role === 'admin'
    ).length;

    const attendanceStats = locationEmployees.reduce(
      (acc, emp) => {
        acc.totalAttendance += parseFloat(emp.stats?.attendanceRate || 0);
        return acc;
      },
      { totalAttendance: 0 }
    );
    
    const averageAttendance = locationEmployees.length > 0
      ? (attendanceStats.totalAttendance / locationEmployees.length).toFixed(1)
      : 0;
    
    return (
      <div className="location-card" onClick={() => setSelectedLocation(location)}>
        <h3 className="location-name">{location}</h3>
        <div className="location-stats">
          <p><Users size={16} /> Total Members: {locationEmployees.length}</p>
          <p className="active-count">
            <Activity size={16} /> Active: {activeCount}
          </p>
          <p className="admin-count">
            <Users size={16} /> Admins: {adminCount}
          </p>
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
            <th>Service</th>
            <th>Role</th>
            <th>Status</th>
            <th>Days Present</th>
            <th>Days Absent</th>
            <th>Days Late</th>
            <th>Attendance Rate</th>
            <th>On-Time Rate</th>
            <th>Action</th>
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
              <td>{employee.service}</td>
              <td>
                <span className={`role-badge ${employee.role}`}>
                  {employee.role}
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
              <td>
                {employee.role !== 'super_admin' && (
                  <button
                    onClick={() => handleToggleRole(employee)}
                    className="toggle-role-btn"
                  >
                    {employee.role === 'admin' ? 'Demote to Employee' : 'Promote to Admin'}
                  </button>
                )}
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
    const locationEmployees = employees.filter(
      (emp) => emp.location.toLowerCase() === selectedLocation.toLowerCase()
    );
    const activeCount = locationEmployees.filter(
      (emp) => emp.status === 'active'
    ).length;
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
          .filter((location) =>
            location.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((location) => (
            <LocationCard key={location} location={location} />
          ))}
      </div>
    </div>
  );
};

export default ManageEmployees;

import React, { useState, useEffect } from 'react';
import { ref, onValue } from "firebase/database";
import { database } from '../services/firebaseConfig';
import { Link } from 'react-router-dom';
import './ManageEmployees.css';

const ManageEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); 
  const [selectedLocation, setSelectedLocation] = useState(null); 
  const [locations] = useState([
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
    'Retreat'
  ]);
  useEffect(() => {
    const fetchEmployeeData = () => {
      const employeesRef = ref(database, 'attendance');
  
      onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();
        const employeeList = [];
  
        for (const location in data) {
          for (const employeeId in data[location]) {
            const employeeData = data[location][employeeId];
  
            // Ensure required fields are present, or set defaults
            if (!employeeData || !employeeData.name) {
              console.warn(`Employee ${employeeId} at location ${location} is missing a name.`);
              continue; // Skip invalid employees
            }
  
            employeeList.push({
              id: employeeId,
              location,
              ...employeeData,
            });
          }
        }
  
        setEmployees(employeeList);
        setLoading(false);
      });
    };
  
    fetchEmployeeData();
  }, []);
  

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLocationClick = (location) => {
    setSelectedLocation(selectedLocation === location ? null : location);
  };

  if (loading) {
    return <div>Loading employee data...</div>;
  }

  return (
    <div className='manage-dashboard'>
      {/* Back Arrow for navigating back */}
      {selectedLocation && (
        <button onClick={() => setSelectedLocation(null)} className="back-arrow">
          ← Back
        </button>
      )}

    

      {/* Location Cards or Employee Table */}
      {selectedLocation ? (
        // Employee table for selected location
        <div className="employee-table">
          <div className="table-title">{selectedLocation} - Employee Stats</div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Rank</th>
                <th>Attendance Streak</th>
                <th>Absence Streak</th>
                <th>Avg. On-Time %</th>
                <th>Avg. Hours Stayed</th>
                <th>Total Days</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees
                .filter((employee) => employee.location === selectedLocation)
                .map((employee) => (
                  <tr key={employee.id} className={employee.clockInTime ? "green-text" : "red-text"}>
                    <td>
                      <Link to={`/admin/employee/${employee.id}`} className="employee-name">
                        {employee.name}
                      </Link>
                    </td>
                    <td>{employee.clockInTime ? "Clocked In" : "Not Clocked In"}</td>
                    <td>
                      {employee.rank}
                      {employee.rankUp && <span className="rank-arrow">↑</span>}
                    </td>
                    <td>{employee.attendanceStreak || 0} days</td>
                    <td>{employee.absenceStreak || 0} days</td>
                    <td>{((employee.daysOnTime / employee.totalDays) * 100).toFixed(2)}%</td>
                    <td>{employee.averageHoursStayed || "N/A"}</td>
                    <td>{employee.totalDays || 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Location cards
        <div className="location-grid">
          {locations.map((location) => (
            <div
              key={location}
              className="location-card"
              onClick={() => handleLocationClick(location)}
            >
              <span className="location-name">{location}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageEmployees;

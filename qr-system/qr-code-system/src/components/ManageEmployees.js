import React, { useState, useEffect } from 'react';
import { ref, onValue } from "firebase/database"; // Firebase Realtime Database methods
import { database } from '../services/firebaseConfig'; // Path to your Firebase configuration file
import { Link } from 'react-router-dom'; // For linking to employee profiles
import './ManageEmployees.css'; // Optional: Add styles if needed

const ManageEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // Search term state
  const [locations] = useState([
    'Agua Viva West Chicago',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ]); // Predefined locations

  useEffect(() => {
    // Fetch employee data from Firebase Realtime Database
    const fetchEmployeeData = () => {
      const employeesRef = ref(database, 'attendance'); // Refers to the attendance node

      onValue(employeesRef, (snapshot) => {
        const data = snapshot.val();
        const employeeList = [];

        // Loop through each location and gather all employees
        for (const location in data) {
          for (const employeeId in data[location]) {
            employeeList.push({
              id: employeeId,
              location,
              ...data[location][employeeId], // Spread employee details (name, clockInTime, clockOutTime)
            });
          }
        }

        setEmployees(employeeList);
        setLoading(false);
      });
    };

    fetchEmployeeData();
  }, []);

  // Filter employees by search term
  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div>Loading employee data...</div>;
  }

  return (
    <div>
      <h2>Manage Employees</h2>
      
      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Display Employees by Location */}
      {locations.map((location) => (
        <div key={location} className="location-section">
          <h3>{location}</h3>
          <div className="employee-grid">
            {filteredEmployees
              .filter((employee) => employee.location === location)
              .map((employee) => (
                <div key={employee.id} className="employee-item">
                  {/* Employee Name Link */}
                  <Link to={`/admin/employee/${employee.id}`} className="employee-name">
                    {employee.name}
                  </Link>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ManageEmployees;
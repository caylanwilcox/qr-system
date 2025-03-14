import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';   // <-- for Back button
import { database } from '../services/firebaseConfig';
import './EmployeeListPage.css';

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate(); // <-- For the back button

  useEffect(() => {
    // Fetch all user records from Firebase
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        try {
          const data = snapshot.val() || {};
          const userArray = [];

          // Convert each user object into a friendlier format
          Object.entries(data).forEach(([userId, userRecord]) => {
            if (userRecord?.profile) {
              const { name, role, status, primaryLocation } = userRecord.profile;
              userArray.push({
                id: userId,
                name: name || 'Unknown',
                role: role || 'Unknown',
                status: status || 'unknown',
                location: primaryLocation || 'unknown',
              });
            }
          });

          setEmployees(userArray);
          setLoading(false);
        } catch (err) {
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Handler for "Back" button – navigates one step back in history
  const handleBackClick = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Loading employees...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-list-page">
        <div className="glass-card p-4 text-center">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="back-button" onClick={handleBackClick}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-list-page">
      <div className="glass-card p-4">
        {/* Back button at the top */}
        <button className="back-button" onClick={handleBackClick}>
          ← Back
        </button>

        <h1 className="employee-list-title">Employee List Page</h1>
        <p className="employee-list-subtitle">
          Below is a list of all users in the system.
        </p>

        {/* Table of employees */}
        <table className="employee-list-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.name}</td>
                <td>{emp.role}</td>
                <td>{emp.status}</td>
                <td>{emp.location}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { User, Users, CheckCircle, AlertCircle } from 'lucide-react';

const AssignUsersToAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [regularUsers, setRegularUsers] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminsAndUsers();
  }, []);

  const fetchAdminsAndUsers = async () => {
    setLoading(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const adminsArray = [];
        const usersArray = [];
        
        // Sort users into admins and regular users
        Object.entries(usersData).forEach(([userId, userData]) => {
          const profile = userData.profile || {};
          
          if (profile.role === 'admin' || profile.role === 'super-admin') {
            adminsArray.push({
              id: userId,
              name: profile.name || 'Unknown',
              role: profile.role,
              location: profile.location
            });
          } else {
            usersArray.push({
              id: userId,
              name: profile.name || 'Unknown',
              role: profile.role || 'employee',
              location: profile.location,
              managedBy: profile.managedBy || null
            });
          }
        });
        
        setAdmins(adminsArray);
        setRegularUsers(usersArray);
      }
    } catch (err) {
      setError('Failed to fetch users and admins');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUsers = async () => {
    if (!selectedAdmin || selectedUsers.length === 0) {
      setError('Please select an admin and at least one user');
      return;
    }
    
    try {
      // Batch updates for better performance
      const updates = {};
      
      // 1. Update each user's managedBy field
      selectedUsers.forEach(userId => {
        updates[`users/${userId}/profile/managedBy`] = selectedAdmin;
      });
      
      // 2. Update the admin's "manages" list in managementStructure
      // First, make sure the management structure entry exists
      const adminRef = ref(database, `managementStructure/${selectedAdmin}`);
      const adminSnapshot = await get(adminRef);
      
      if (!adminSnapshot.exists()) {
        // Create the management structure for this admin if it doesn't exist
        updates[`managementStructure/${selectedAdmin}`] = {
          manages: {}
        };
      }
      
      // Then add each user to the "manages" list
      selectedUsers.forEach(userId => {
        updates[`managementStructure/${selectedAdmin}/manages/${userId}`] = true;
      });
      
      // Execute all updates
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully assigned ${selectedUsers.length} users to the selected admin`);
      setSelectedUsers([]);
      
      // Refresh data
      fetchAdminsAndUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to assign users to admin');
      console.error('Error:', err);
    }
  };

  return (
    <div className="dashboard-container p-6">
      {error && (
        <div className="error-banner mb-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg mb-4 backdrop-blur-sm">
          {successMessage}
        </div>
      )}

      <div className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
        <h2 className="text-xl font-semibold text-white mb-6">
          Assign Users to Administrators
        </h2>
        
        {/* Admin Selection */}
        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Select Administrator</label>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select an Administrator --</option>
            {admins.map(admin => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.role}) - {admin.location}
              </option>
            ))}
          </select>
        </div>
        
        {/* User Selection */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-300">Select Users to Assign</label>
            <div className="text-gray-400 text-sm">
              {selectedUsers.length} users selected
            </div>
          </div>
          
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
            {regularUsers.length === 0 ? (
              <div className="text-gray-400 text-center py-4">No regular users found</div>
            ) : (
              <div className="space-y-2">
                {regularUsers.map(user => (
                  <div 
                    key={user.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      selectedUsers.includes(user.id) 
                        ? 'bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30' 
                        : 'hover:bg-gray-700 hover:bg-opacity-20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User size={20} className="text-gray-400" />
                      <div>
                        <div className="text-white">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.location || 'No location'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {user.managedBy && (
                        <span className="text-xs text-gray-400 bg-gray-700 bg-opacity-40 px-2 py-1 rounded">
                          {admins.find(a => a.id === user.managedBy)?.name || 'Unknown Admin'}
                        </span>
                      )}
                      
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }
                        }}
                        className="form-checkbox h-5 w-5 text-blue-500 rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={handleAssignUsers}
          disabled={!selectedAdmin || selectedUsers.length === 0}
          className={`mt-4 px-6 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 ${
            !selectedAdmin || selectedUsers.length === 0
              ? 'bg-gray-700 bg-opacity-20 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20'
          }`}
        >
          <CheckCircle size={20} />
          Assign Selected Users
        </button>
      </div>
      
      {/* Current Assignments View */}
      <div className="quadrant rounded-lg overflow-hidden bg-gray-800 bg-opacity-40 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">
          Current Management Structure
        </h2>
        
        <div className="space-y-8">
          {admins.map(admin => {
            const managedUsers = regularUsers.filter(user => user.managedBy === admin.id);
            
            return (
              <div key={admin.id} className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={20} className="text-blue-400" />
                  <h3 className="text-white text-lg">{admin.name}</h3>
                  <span className="bg-gray-700 bg-opacity-40 px-2 py-1 rounded text-xs text-gray-300">
                    {admin.role}
                  </span>
                </div>
                
                {managedUsers.length === 0 ? (
                  <p className="text-gray-400">No users assigned to this admin</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {managedUsers.map(user => (
                      <div key={user.id} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                        <User size={16} className="text-gray-400" />
                        <span className="text-white">{user.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AssignUsersToAdmins;
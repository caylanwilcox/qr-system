import React, { useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { User, Shield, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';

const AssignRoles = () => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersArray = [];
        
        Object.entries(usersData).forEach(([userId, userData]) => {
          const profile = userData.profile || {};
          
          usersArray.push({
            id: userId,
            name: profile.name || 'Unknown',
            role: profile.role || 'employee',
            location: profile.location || profile.primaryLocation || 'Unknown',
            email: profile.email || 'No email'
          });
        });
        
        // Sort by role (admins first, then alphabetically by name)
        usersArray.sort((a, b) => {
          const roleOrder = { 'super-admin': 0, 'admin': 1, 'employee': 2 };
          const roleA = roleOrder[a.role] || 3;
          const roleB = roleOrder[b.role] || 3;
          
          if (roleA !== roleB) {
            return roleA - roleB;
          }
          
          return a.name.localeCompare(b.name);
        });
        
        setUsers(usersArray);
      }
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedRole || selectedUsers.length === 0) {
      setError('Please select a role and at least one user');
      return;
    }
    
    setConfirmationVisible(true);
  };
  
  const confirmRoleAssignment = async () => {
    try {
      // Batch updates for better performance
      const updates = {};
      
      // Update each selected user's role
      selectedUsers.forEach(userId => {
        updates[`users/${userId}/profile/role`] = selectedRole;
      });
      
      // Execute all updates
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully assigned ${selectedRole} role to ${selectedUsers.length} user(s)`);
      setSelectedUsers([]);
      setSelectedRole('');
      setConfirmationVisible(false);
      
      // Refresh user data
      fetchUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to assign roles');
      console.error('Error:', err);
      setConfirmationVisible(false);
    }
  };
  
  const cancelAssignment = () => {
    setConfirmationVisible(false);
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.location.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super-admin':
        return 'bg-purple-500 bg-opacity-20 text-purple-400 border border-purple-500 border-opacity-20';
      case 'admin':
        return 'bg-blue-500 bg-opacity-20 text-blue-400 border border-blue-500 border-opacity-20';
      default:
        return 'bg-gray-700 bg-opacity-40 text-gray-400';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'super-admin':
        return <ShieldCheck size={16} className="text-purple-400" />;
      case 'admin':
        return <Shield size={16} className="text-blue-400" />;
      default:
        return <User size={16} className="text-gray-400" />;
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
        <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg mb-4 backdrop-blur-sm flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
        <h2 className="text-xl font-semibold text-white mb-6">
          Assign Admin Roles
        </h2>
        
        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-gray-300 mb-2">Select Role to Assign</label>
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedRole('admin')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                selectedRole === 'admin'
                  ? 'bg-blue-500 bg-opacity-20 text-blue-400 border border-blue-500 border-opacity-50'
                  : 'bg-gray-800 bg-opacity-30 text-gray-300 border border-gray-700 hover:bg-opacity-40'
              }`}
            >
              <Shield size={20} />
              Admin
            </button>
            
            <button
              onClick={() => setSelectedRole('super-admin')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                selectedRole === 'super-admin'
                  ? 'bg-purple-500 bg-opacity-20 text-purple-400 border border-purple-500 border-opacity-50'
                  : 'bg-gray-800 bg-opacity-30 text-gray-300 border border-gray-700 hover:bg-opacity-40'
              }`}
            >
              <ShieldCheck size={20} />
              Super Admin
            </button>
            
            <button
              onClick={() => setSelectedRole('employee')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 ${
                selectedRole === 'employee'
                  ? 'bg-gray-600 bg-opacity-20 text-gray-400 border border-gray-600 border-opacity-50'
                  : 'bg-gray-800 bg-opacity-30 text-gray-300 border border-gray-700 hover:bg-opacity-40'
              }`}
            >
              <User size={20} />
              Employee (Remove Admin)
            </button>
          </div>
        </div>
        
        {/* User Search and Selection */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-300">Select Users</label>
            <div className="text-gray-400 text-sm">
              {selectedUsers.length} users selected
            </div>
          </div>
          
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search users by name, email, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-gray-400 text-center py-4">
                {searchQuery ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <div 
                    key={user.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      selectedUsers.includes(user.id) 
                        ? 'bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30' 
                        : 'hover:bg-gray-700 hover:bg-opacity-20 border border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getRoleIcon(user.role)}
                      <div>
                        <div className="text-white">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                        <div className="text-xs text-gray-500 mt-1">{user.location}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getRoleBadgeClass(user.role)}`}>
                        {user.role}
                      </span>
                      
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
          onClick={handleAssignRole}
          disabled={!selectedRole || selectedUsers.length === 0}
          className={`mt-4 px-6 py-3 rounded-lg flex items-center gap-2 transition-all duration-300 ${
            !selectedRole || selectedUsers.length === 0
              ? 'bg-gray-700 bg-opacity-20 text-gray-500 cursor-not-allowed'
              : selectedRole === 'super-admin'
                ? 'bg-purple-500 bg-opacity-20 hover:bg-opacity-30 text-purple-400 font-medium border border-purple-500 border-opacity-20'
                : selectedRole === 'admin'
                  ? 'bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20'
                  : 'bg-gray-600 bg-opacity-20 hover:bg-opacity-30 text-gray-400 font-medium border border-gray-600 border-opacity-20'
          }`}
        >
          {selectedRole === 'super-admin' ? (
            <ShieldCheck size={20} />
          ) : selectedRole === 'admin' ? (
            <Shield size={20} />
          ) : (
            <User size={20} />
          )}
          Assign {selectedRole} Role to Selected Users
        </button>
      </div>
      
      {/* Confirmation Modal */}
      {confirmationVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Confirm Role Assignment</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to assign the <span className="font-semibold">{selectedRole}</span> role to {selectedUsers.length} selected user(s)?
              {selectedRole === 'super-admin' && (
                <span className="block mt-2 text-yellow-400">
                  Warning: Super Admin users have full system access.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelAssignment}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleAssignment}
                className={`px-4 py-2 rounded-lg ${
                  selectedRole === 'super-admin'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : selectedRole === 'admin'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Role Summary */}
      <div className="quadrant rounded-lg overflow-hidden bg-gray-800 bg-opacity-40 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">
          Current Role Distribution
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Super Admins */}
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={22} className="text-purple-400" />
              <h3 className="text-white text-lg">Super Admins</h3>
            </div>
            <p className="text-2xl font-bold text-purple-400 mb-3">
              {users.filter(user => user.role === 'super-admin').length}
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {users.filter(user => user.role === 'super-admin').map(admin => (
                <div key={admin.id} className="flex items-center gap-2 py-1 border-b border-gray-700 last:border-b-0">
                  <span className="text-white">{admin.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{admin.location}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Admins */}
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={22} className="text-blue-400" />
              <h3 className="text-white text-lg">Admins</h3>
            </div>
            <p className="text-2xl font-bold text-blue-400 mb-3">
              {users.filter(user => user.role === 'admin').length}
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {users.filter(user => user.role === 'admin').map(admin => (
                <div key={admin.id} className="flex items-center gap-2 py-1 border-b border-gray-700 last:border-b-0">
                  <span className="text-white">{admin.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{admin.location}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Employees */}
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <User size={22} className="text-gray-400" />
              <h3 className="text-white text-lg">Regular Employees</h3>
            </div>
            <p className="text-2xl font-bold text-gray-400 mb-3">
              {users.filter(user => user.role !== 'admin' && user.role !== 'super-admin').length}
            </p>
            <div className="text-gray-500 text-sm">
              Regular employees are displayed in the user assignment screen
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignRoles;
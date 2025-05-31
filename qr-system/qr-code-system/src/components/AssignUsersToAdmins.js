import React, { useState, useEffect } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { User, Users, CheckCircle, AlertCircle, Shield, ShieldCheck } from 'lucide-react';

const AssignUsersToAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [regularUsers, setRegularUsers] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);
  
  // Role management state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [userToPromote, setUserToPromote] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  // User promotion state
  const [selectedUserForPromotion, setSelectedUserForPromotion] = useState('');
  const [promotionRole, setPromotionRole] = useState('admin');
  const [promotionLoading, setPromotionLoading] = useState(false);

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
        const adminsArray = Object.entries(usersData)
          .filter(([_, data]) => {
            const profile = data.profile;
            if (!profile || !profile.role) return false;
            
            // Check for all possible admin role formats for backward compatibility
            const role = profile.role.toLowerCase();
            return role === 'admin' || 
                   role === 'super-admin' || 
                   role === 'super_admin' ||
                   role === 'ADMIN' || 
                   role === 'SUPER_ADMIN';
          })
          .map(([id, data]) => ({ id, ...data.profile }));
        
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

  // Handle opening the role promotion modal
  const handlePromoteClick = (user) => {
    setUserToPromote(user);
    setSelectedRole(user.role === 'admin' ? 'super_admin' : 'admin');
    setShowRoleModal(true);
  };

  // Handle role changes
  const handleRoleChange = async () => {
    if (!userToPromote || !selectedRole) {
      setError('Unable to update role. Missing information.');
      return;
    }

    try {
      // FIXED: Normalize role format to match system expectations
      let normalizedRole = selectedRole;
      if (selectedRole === 'super-admin') {
        normalizedRole = 'super_admin'; // Use underscore format for consistency with auth system
      }
      
      // Update the user's role in Firebase
      const updates = {};
      updates[`users/${userToPromote.id}/profile/role`] = normalizedRole;
      
      // For super admin, also ensure they have proper permissions
      if (normalizedRole === 'super_admin') {
        updates[`managementStructure/${userToPromote.id}/role`] = 'super_admin';
        updates[`managementStructure/${userToPromote.id}/canManageAll`] = true;
      } else if (normalizedRole === 'admin') {
        updates[`managementStructure/${userToPromote.id}/role`] = 'admin';
        updates[`managementStructure/${userToPromote.id}/canManageAll`] = false;
      }
      
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully updated ${userToPromote.name}'s role to ${normalizedRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}`);
      setShowRoleModal(false);
      setUserToPromote(null);
      
      // Refresh data to show updated roles
      fetchAdminsAndUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error:', err);
    }
  };

  const handleDemoteAdmin = async (adminId) => {
    try {
      // Get current admin data
      const adminRef = ref(database, `users/${adminId}`);
      const adminSnapshot = await get(adminRef);
      
      if (!adminSnapshot.exists()) {
        setError('Admin user not found');
        return;
      }
      
      const adminData = adminSnapshot.val();
      
      // Check if this admin manages users
      const managementRef = ref(database, `managementStructure/${adminId}`);
      const managementSnapshot = await get(managementRef);
      
      // Create updates object
      const updates = {};
      
      // Update role to regular employee
      updates[`users/${adminId}/profile/role`] = 'employee';
      
      // If this admin manages users, reassign them
      if (managementSnapshot.exists()) {
        const managementData = managementSnapshot.val();
        
        if (managementData.manages) {
          // Remove all users from this admin's management
          Object.keys(managementData.manages).forEach(userId => {
            updates[`users/${userId}/profile/managedBy`] = null;
          });
          
          // Remove management structure
          updates[`managementStructure/${adminId}`] = null;
        }
      }
      
      // Execute updates
      await update(ref(database), updates);
      
      setSuccessMessage(`Successfully demoted ${adminData.profile?.name || 'admin'} to regular employee`);
      
      // Refresh data
      fetchAdminsAndUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to demote admin');
      console.error('Error:', err);
    }
  };

  // Handle user promotion in the dedicated section
  const handlePromoteUser = async () => {
    if (!selectedUserForPromotion) {
      setError('Please select a user to promote');
      return;
    }

    setPromotionLoading(true);
    setError(null);

    try {
      // FIXED: Normalize role format to match system expectations
      let normalizedRole = promotionRole;
      if (promotionRole === 'super-admin') {
        normalizedRole = 'super_admin'; // Use underscore format for consistency with auth system
      }
      
      // Update the user's role in Firebase
      const updates = {};
      updates[`users/${selectedUserForPromotion}/profile/role`] = normalizedRole;
      
      // For super admin, also ensure they have proper permissions
      if (normalizedRole === 'super_admin') {
        updates[`managementStructure/${selectedUserForPromotion}/role`] = 'super_admin';
        updates[`managementStructure/${selectedUserForPromotion}/canManageAll`] = true;
      } else if (normalizedRole === 'admin') {
        updates[`managementStructure/${selectedUserForPromotion}/role`] = 'admin';
        updates[`managementStructure/${selectedUserForPromotion}/canManageAll`] = false;
      }
      
      await update(ref(database), updates);
      
      // Find the user's name from the regularUsers array
      const userName = regularUsers.find(user => user.id === selectedUserForPromotion)?.name || 'User';
      
      setSuccessMessage(`Successfully promoted ${userName} to ${normalizedRole === 'super_admin' ? 'Super Administrator' : 'Administrator'}`);
      
      // Reset selection
      setSelectedUserForPromotion('');
      
      // Refresh data to show updated roles
      fetchAdminsAndUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to promote user');
      console.error('Error:', err);
    } finally {
      setPromotionLoading(false);
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

      {/* User Promotion Section */}
      <div className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
        <h2 className="text-xl font-semibold text-white mb-6">
          Promote User
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Selection */}
          <div>
            <label className="block text-gray-300 mb-2">Select User to Promote</label>
            <select
              value={selectedUserForPromotion}
              onChange={(e) => setSelectedUserForPromotion(e.target.value)}
              className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a User --</option>
              {regularUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.location || 'No location'}
                </option>
              ))}
            </select>
          </div>
          
          {/* Role Selection */}
          <div>
            <label className="block text-gray-300 mb-2">Select Role</label>
            <div className="flex gap-4">
              <div 
                onClick={() => setPromotionRole('admin')}
                className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  promotionRole === 'admin'
                    ? 'bg-blue-900 bg-opacity-20 border-blue-500 text-blue-400'
                    : 'border-gray-700 text-gray-400 hover:bg-gray-700 hover:bg-opacity-20'
                }`}
              >
                <Shield className="h-5 w-5" />
                <span>Administrator</span>
              </div>
              
              <div 
                onClick={() => setPromotionRole('super_admin')}
                className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                  promotionRole === 'super_admin'
                    ? 'bg-indigo-900 bg-opacity-20 border-indigo-500 text-indigo-400'
                    : 'border-gray-700 text-gray-400 hover:bg-gray-700 hover:bg-opacity-20'
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Super Admin</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Selected User Preview (if a user is selected) */}
        {selectedUserForPromotion && (
          <div className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-800 bg-opacity-30">
            <h3 className="text-gray-300 mb-2">Promotion Preview</h3>
            <div className="flex items-center gap-3">
              <User size={20} className="text-gray-400" />
              <div className="text-white">
                {regularUsers.find(user => user.id === selectedUserForPromotion)?.name || 'Selected User'}
              </div>
              <div className="text-gray-400">→</div>
              {promotionRole === 'admin' ? (
                <div className="flex items-center gap-1 text-blue-400">
                  <Shield size={20} />
                  <span>Administrator</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-indigo-400">
                  <ShieldCheck size={20} />
                  <span>Super Administrator</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        <button
          onClick={handlePromoteUser}
          disabled={!selectedUserForPromotion || promotionLoading}
          className={`mt-6 px-6 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 ${
            !selectedUserForPromotion || promotionLoading
              ? 'bg-gray-700 bg-opacity-20 text-gray-500 cursor-not-allowed'
              : promotionRole === 'admin'
                ? 'bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20'
                : 'bg-indigo-500 bg-opacity-20 hover:bg-opacity-30 text-indigo-400 font-medium border border-indigo-500 border-opacity-20'
          }`}
        >
          {promotionLoading ? (
            <span>Promoting...</span>
          ) : (
            <>
              {promotionRole === 'admin' ? <Shield size={20} /> : <ShieldCheck size={20} />}
              Promote to {promotionRole === 'admin' ? 'Administrator' : 'Super Administrator'}
            </>
          )}
        </button>
      </div>

      {/* User Assignment Section */}
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

      {/* Role Management Section */}
      <div className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
        <h2 className="text-xl font-semibold text-white mb-6">
          Role Management
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-300 mb-4">Promote regular users to admin or super-admin roles, or demote existing admins.</p>
          
          <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-medium text-white mb-2">Regular Users</h3>
            
            {regularUsers.length === 0 ? (
              <div className="text-gray-400 text-center py-2">No regular users found</div>
            ) : (
              <div className="space-y-2 mb-6">
                {regularUsers.map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700 hover:bg-opacity-20"
                  >
                    <div className="flex items-center gap-3">
                      <User size={20} className="text-gray-400" />
                      <div>
                        <div className="text-white">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.location || 'No location'}</div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handlePromoteClick(user)}
                      className="bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20 px-3 py-1 rounded-lg flex items-center gap-1 text-sm"
                    >
                      <Shield size={16} />
                      Promote to Admin
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <h3 className="text-lg font-medium text-white mb-2 mt-6">Administrators</h3>
            
            {admins.length === 0 ? (
              <div className="text-gray-400 text-center py-2">No administrators found</div>
            ) : (
              <div className="space-y-2">
                {admins.map(admin => (
                  <div 
                    key={admin.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700 hover:bg-opacity-20"
                  >
                    <div className="flex items-center gap-3">
                      {(admin.role === 'super-admin' || admin.role === 'super_admin') ? (
                        <ShieldCheck size={20} className="text-indigo-400" />
                      ) : (
                        <Shield size={20} className="text-blue-400" />
                      )}
                      <div>
                        <div className="text-white">{admin.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-400">{admin.location || 'No location'}</span>
                          <span className="bg-gray-700 bg-opacity-40 px-2 py-0.5 rounded text-xs text-gray-300">
                            {admin.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {admin.role === 'admin' && (
                        <button
                          onClick={() => handlePromoteClick(admin)}
                          className="bg-indigo-500 bg-opacity-20 hover:bg-opacity-30 text-indigo-400 font-medium border border-indigo-500 border-opacity-20 px-3 py-1 rounded-lg flex items-center gap-1 text-sm"
                        >
                          <ShieldCheck size={16} />
                          Make Super-Admin
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDemoteAdmin(admin.id)}
                        className="bg-red-500 bg-opacity-20 hover:bg-opacity-30 text-red-400 font-medium border border-red-500 border-opacity-20 px-3 py-1 rounded-lg flex items-center gap-1 text-sm"
                      >
                        <User size={16} />
                        Demote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
                  {(admin.role === 'super-admin' || admin.role === 'super_admin') ? (
                    <ShieldCheck size={20} className="text-indigo-400" />
                  ) : (
                    <Shield size={20} className="text-blue-400" />
                  )}
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

      {/* Role Management Modal */}
      {showRoleModal && userToPromote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Update Role for {userToPromote.name}
            </h3>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="admin">Administrator</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:bg-opacity-50"
              >
                Cancel
              </button>
              
              <button
                onClick={handleRoleChange}
                className="px-4 py-2 rounded-lg bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignUsersToAdmins;
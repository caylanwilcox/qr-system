import React, { useState } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { User, Shield, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';

const UserPromotionSection = ({ regularUsers, fetchAdminsAndUsers }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const handlePromoteUser = async () => {
    if (!selectedUser) {
      setError('Please select a user to promote');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update the user's role in Firebase
      const updates = {};
      updates[`users/${selectedUser}/profile/role`] = selectedRole;
      
      await update(ref(database), updates);
      
      // Find the user's name from the regularUsers array
      const userName = regularUsers.find(user => user.id === selectedUser)?.name || 'User';
      
      setSuccessMessage(`Successfully promoted ${userName} to ${selectedRole}`);
      
      // Reset selection
      setSelectedUser('');
      
      // Refresh data to show updated roles
      fetchAdminsAndUsers();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to promote user');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
      <h2 className="text-xl font-semibold text-white mb-6">
        Promote User
      </h2>
      
      {error && (
        <div className="error-banner mb-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="success-banner mb-4 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Selection */}
        <div>
          <label className="block text-gray-300 mb-2">Select User to Promote</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
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
              onClick={() => setSelectedRole('admin')}
              className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRole === 'admin'
                  ? 'bg-blue-900 bg-opacity-20 border-blue-500 text-blue-400'
                  : 'border-gray-700 text-gray-400 hover:bg-gray-700 hover:bg-opacity-20'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span>Administrator</span>
            </div>
            
            <div 
              onClick={() => setSelectedRole('super-admin')}
              className={`flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRole === 'super-admin'
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
      {selectedUser && (
        <div className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-800 bg-opacity-30">
          <h3 className="text-gray-300 mb-2">Promotion Preview</h3>
          <div className="flex items-center gap-3">
            <User size={20} className="text-gray-400" />
            <div className="text-white">
              {regularUsers.find(user => user.id === selectedUser)?.name || 'Selected User'}
            </div>
            <div className="text-gray-400">→</div>
            {selectedRole === 'admin' ? (
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
        disabled={!selectedUser || loading}
        className={`mt-6 px-6 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 ${
          !selectedUser || loading
            ? 'bg-gray-700 bg-opacity-20 text-gray-500 cursor-not-allowed'
            : selectedRole === 'admin'
              ? 'bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium border border-blue-500 border-opacity-20'
              : 'bg-indigo-500 bg-opacity-20 hover:bg-opacity-30 text-indigo-400 font-medium border border-indigo-500 border-opacity-20'
        }`}
      >
        {loading ? (
          <span>Promoting...</span>
        ) : (
          <>
            {selectedRole === 'admin' ? <Shield size={20} /> : <ShieldCheck size={20} />}
            Promote to {selectedRole === 'admin' ? 'Administrator' : 'Super Administrator'}
          </>
        )}
      </button>
    </div>
  );
};

export default UserPromotionSection;
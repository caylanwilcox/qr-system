import React, { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { PlusCircle, Trash2, Edit2, Loader2, AlertCircle, User } from 'lucide-react';

const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    location: '',
    phone: '',
    role: 'ADMIN'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const locations = [
    'Aurora', 'Agua Viva Lyons', 'Agua Viva',
    'Agua Viva Elgin R7', 'Agua Viva Joliet', 'Agua Viva Wheeling',
  ];

  useEffect(() => {
    fetchAdmins();
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersArray = Object.entries(usersData)
          .filter(([_, data]) => data.role !== 'ADMIN' && data.role !== 'SUPER_ADMIN')
          .map(([id, data]) => ({
            id,
            ...data
          }));
        setAllUsers(usersArray);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const adminsArray = Object.entries(usersData)
          .filter(([_, data]) => data.role === 'ADMIN' || data.role === 'SUPER_ADMIN')
          .map(([id, data]) => ({
            id,
            ...data
          }));
        setAdmins(adminsArray);
      } else {
        setAdmins([]);
      }
    } catch (err) {
      setError('Failed to fetch administrators');
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdmin(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'name') {
      handleSearch(value);
    }
  };

  const handleSearch = (value) => {
    if (value.length > 0) {
      const filteredSuggestions = allUsers.filter(user =>
        user.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectUser = (user) => {
    setNewAdmin({
      ...newAdmin,
      name: user.name,
      email: user.email || '',
      phone: user.phone || '',
      location: user.location || ''
    });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const adminRef = ref(database, `users/${editingId}`);
        await set(adminRef, { ...newAdmin, role: 'ADMIN' });
        setSuccessMessage('Administrator updated successfully');
      } else {
        const adminRef = ref(database, `users/${new Date().getTime()}`);
        await set(adminRef, { ...newAdmin, role: 'ADMIN', status: 'active' });
        setSuccessMessage('Administrator added successfully');
      }
      
      setNewAdmin({ name: '', email: '', location: '', phone: '', role: 'ADMIN' });
      setIsEditing(false);
      setEditingId(null);
      fetchAdmins();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(isEditing ? 'Failed to update administrator' : 'Failed to add administrator');
      console.error('Error saving admin:', err);
    }
  };

  const handleEdit = (admin) => {
    setNewAdmin(admin);
    setIsEditing(true);
    setEditingId(admin.id);
  };

  const handleDelete = async (adminId) => {
    if (window.confirm('Are you sure you want to remove admin privileges from this user?')) {
      try {
        const adminRef = ref(database, `users/${adminId}`);
        // Get current user data
        const snapshot = await get(adminRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          // Update only the role while preserving all other user data
          await set(adminRef, {
            ...userData,
            role: 'EMPLOYEE' // Change role back to EMPLOYEE
          });
          setSuccessMessage('Admin privileges removed successfully');
          fetchAdmins();
          setTimeout(() => setSuccessMessage(''), 3000);
        }
      } catch (err) {
        setError('Failed to remove admin privileges');
        console.error('Error updating user:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p>Loading administrators...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container p-6">
      {error && (
        <div className="error-banner mb-4">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20 text-green-400 p-4 rounded-lg mb-4 backdrop-blur-sm">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="quadrant p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold text-white mb-6">
          {isEditing ? 'Edit Administrator' : 'Add New Administrator'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={newAdmin.name}
              onChange={handleInputChange}
              onFocus={() => newAdmin.name && handleSearch(newAdmin.name)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required
              className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                {suggestions.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-700 cursor-pointer text-white"
                    onClick={() => handleSelectUser(user)}
                  >
                    <User size={16} className="text-gray-400" />
                    <div>
                      <div>{user.name}</div>
                      <div className="text-sm text-gray-400">{user.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={newAdmin.email}
            onChange={handleInputChange}
            required
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="location"
            value={newAdmin.location}
            onChange={handleInputChange}
            required
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Location</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <input
            type="tel"
            name="phone"
            placeholder="Phone"
            value={newAdmin.phone}
            onChange={handleInputChange}
            required
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button 
          type="submit" 
          className="mt-6 bg-blue-500 bg-opacity-20 hover:bg-opacity-30 text-blue-400 font-medium px-6 py-2 rounded-lg flex items-center gap-2 border border-blue-500 border-opacity-20 transition-all duration-300"
        >
          <PlusCircle size={20} />
          {isEditing ? 'Update Administrator' : 'Add Administrator'}
        </button>
      </form>

      <div className="quadrant rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 bg-opacity-40">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-opacity-20">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-700 hover:bg-opacity-20 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-white">{admin.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      admin.role === 'SUPER_ADMIN' 
                        ? 'bg-purple-500 bg-opacity-20 text-purple-400' 
                        : 'bg-blue-500 bg-opacity-20 text-blue-400'
                    }`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(admin)}
                        className="text-blue-400 hover:text-blue-300"
                        disabled={admin.role === 'SUPER_ADMIN'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(admin.id)}
                        className="text-red-400 hover:text-red-300"
                        disabled={admin.role === 'SUPER_ADMIN'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageAdmins;
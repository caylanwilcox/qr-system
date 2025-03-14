import React, { useState, useEffect } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Link } from 'react-router-dom';
import { PlusCircle, Trash2, Edit2, Loader2, AlertCircle, User } from 'lucide-react';

// Helper to convert an attendanceRate (0-100) into a letter grade
function getAttendanceGrade(rate) {
  if (rate == null) return 'N/A';
  if (rate >= 95) return 'A';
  if (rate >= 85) return 'B';
  if (rate >= 75) return 'C';
  if (rate >= 65) return 'D';
  return 'F';
}

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
    role: 'admin'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // If you have more locations, add them here
  const locations = [
    'Aurora',
    'Agua Viva Lyons',
    'Agua Viva',
    'Agua Viva Elgin R7',
    'Agua Viva Joliet',
    'Agua Viva Wheeling',
  ];

  useEffect(() => {
    fetchAdmins();
    fetchAllUsers();
  }, []);

  // 1) Fetch all users that are NOT admin/super-admin (for suggestion dropdown)
  const fetchAllUsers = async () => {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        // Use the "profile" subnode for filtering role
        const usersArray = Object.entries(usersData)
          .filter(([_, data]) => 
            data.profile && 
            data.profile.role !== 'admin' && 
            data.profile.role !== 'super-admin'
          )
          .map(([id, data]) => ({
            id,
            ...data.profile
          }));
        setAllUsers(usersArray);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // 2) Fetch all current admins (where role === 'admin' or 'super-admin')
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        // Filter for admins using the profile subnode and flatten the profile data.
        const adminsArray = Object.entries(usersData)
          .filter(([_, data]) => data.profile && (data.profile.role === 'admin' || data.profile.role === 'super-admin'))
          .map(([id, data]) => ({
            id,
            ...data.profile,
            stats: data.stats // include stats if present
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

  // 3) Live-search existing (non-admin) users by name
  const handleSearch = (value) => {
    if (value.length > 0) {
      const filteredSuggestions = allUsers.filter(user =>
        (user.name || '').toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // When clicking a suggestion from the dropdown, fill form fields
  const handleSelectUser = (user) => {
    setNewAdmin({
      ...newAdmin,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      location: user.location || '',
    });
    setShowSuggestions(false);
  };

  // Handle typed input in the "Add Admin" form
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

  // 4) Create or Update an admin from the form
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        const adminRef = ref(database, `users/${editingId}/profile`);
        // Overwrite the existing profile with newAdmin data (forcing role: 'admin')
        await set(adminRef, { ...newAdmin, role: 'admin' });
        setSuccessMessage('Administrator updated successfully');
      } else {
        // Create a new user node; here we generate a new ID (using current timestamp)
        const newId = new Date().getTime().toString();
        const adminRef = ref(database, `users/${newId}/profile`);
        await set(adminRef, { ...newAdmin, role: 'admin', status: 'active' });
        setSuccessMessage('Administrator added successfully');
      }

      // Reset form
      setNewAdmin({ name: '', email: '', location: '', phone: '', role: 'admin' });
      setIsEditing(false);
      setEditingId(null);

      // Refresh admin list
      fetchAdmins();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(isEditing ? 'Failed to update administrator' : 'Failed to add administrator');
      console.error('Error saving admin:', err);
    }
  };

  // 5) Load an existing admin into the form for editing
  const handleEdit = (admin) => {
    setIsEditing(true);
    setEditingId(admin.id);
    // Since we flattened profile data in fetchAdmins, we can simply set the form data
    setNewAdmin({
      name: admin.name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      location: admin.location || '',
      role: admin.role || 'admin'
    });
  };

  // 6) Remove admin privileges (set role to 'employee')
  const handleDelete = async (adminId) => {
    if (window.confirm('Are you sure you want to remove admin privileges from this user?')) {
      try {
        const adminRef = ref(database, `users/${adminId}/profile`);
        const snapshot = await get(adminRef);
        if (snapshot.exists()) {
          const profileData = snapshot.val();
          await set(adminRef, {
            ...profileData,
            role: 'employee'
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

  // 7) Directly change the role from a <select> in the table
  const handleChangeRole = async (userId, newRole) => {
    try {
      const userRef = ref(database, `users/${userId}/profile`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const profileData = snapshot.val();
        await set(userRef, {
          ...profileData,
          role: newRole
        });
        setSuccessMessage(`User role updated to "${newRole}"`);
        // Re-fetch admins to update the list if needed
        fetchAdmins();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error updating user:', err);
    }
  };

  // 8) Render the component
  if (loading) {
    return (
      <div className="loading-overlay flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-2" />
        <p className="text-white">Loading administrators...</p>
      </div>
    );
  }

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

      {/* --- Form for Adding/Editing an Admin --- */}
      <form onSubmit={handleSubmit} className="quadrant p-6 rounded-lg mb-8 bg-gray-800 bg-opacity-40">
        <h2 className="text-xl font-semibold text-white mb-6">
          {isEditing ? 'Edit Administrator' : 'Add New Administrator'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Name Input + Suggestions */}
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
            {/* Suggestion Dropdown */}
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

          {/* Email */}
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={newAdmin.email}
            onChange={handleInputChange}
            required
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Location */}
          <select
            name="location"
            value={newAdmin.location}
            onChange={handleInputChange}
            required
            className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Phone */}
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

      {/* --- Admins List Table --- */}
      <div className="quadrant rounded-lg overflow-hidden bg-gray-800 bg-opacity-40">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 bg-opacity-40">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Phone</th>
                {/* New Column: Attendance Grade */}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-opacity-20">
              {admins.map((admin) => {
                // Use admin.stats.attendanceRate if available; otherwise, null.
                const attendanceRate = admin.stats?.attendanceRate ?? null;
                const attendanceGrade = getAttendanceGrade(attendanceRate);

                return (
                  <tr
                    key={admin.id}
                    className="hover:bg-gray-700 hover:bg-opacity-20 transition-colors"
                  >
                    {/* Name (with link to Profile) */}
                    <td className="px-6 py-4 whitespace-nowrap text-white">
                      <Link
                        to={`/super-admin/users/${admin.id}`}
                        className="hover:underline text-blue-400"
                      >
                        {admin.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{admin.phone}</td>
                    {/* Attendance Grade column */}
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">{attendanceGrade}</td>
                    {/* Role with a <select> to change it */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={admin.role}
                        onChange={(e) => handleChangeRole(admin.id, e.target.value)}
                        className="bg-gray-800 bg-opacity-40 text-white rounded px-2 py-1 focus:outline-none"
                        disabled={admin.role === 'super-admin'}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="super-admin">Super Admin</option>
                      </select>
                    </td>
                    {/* Actions: Edit or Delete */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(admin)}
                          className="text-blue-400 hover:text-blue-300"
                          disabled={admin.role === 'super-admin'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="text-red-400 hover:text-red-300"
                          disabled={admin.role === 'super-admin'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageAdmins;

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import PropTypes from 'prop-types';
import { PlusCircle } from 'lucide-react';

const AdminForm = ({ 
  isEditing, 
  onSubmit, 
  initialFormData = {
    name: '',
    email: '',
    location: '',
    phone: '',
    role: 'admin'
  },
  locations = [],
  allUsers = [] 
}) => {
  const [formData, setFormData] = useState(initialFormData);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reset form when initialFormData changes (when editing different admin)
  useEffect(() => {
    setFormData(initialFormData);
  }, [initialFormData]);

  // Live-search existing (non-admin) users by name
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
    setFormData({
      ...formData,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      // Use primaryLocation as priority, fallback to location if not available
      location: user.primaryLocation || user.location || '',
    });
    setShowSuggestions(false);
  };

  // Handle typed input in the form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'name') {
      handleSearch(value);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    
    // Reset form if not editing
    if (!isEditing) {
      setFormData({
        name: '',
        email: '',
        location: '',
        phone: '',
        role: 'admin'
      });
    }
  };

  return (
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
            value={formData.name}
            onChange={handleInputChange}
            onFocus={() => formData.name && handleSearch(formData.name)}
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
                    <div className="text-sm text-gray-400">{user.primaryLocation || user.location}</div>
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
          value={formData.email}
          onChange={handleInputChange}
          required
          className="bg-opacity-20 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-400 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Location */}
        <select
          name="location"
          value={formData.location}
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
          value={formData.phone}
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
  );
};

AdminForm.propTypes = {
  isEditing: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  initialFormData: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    location: PropTypes.string,
    phone: PropTypes.string,
    role: PropTypes.string
  }),
  locations: PropTypes.arrayOf(PropTypes.string),
  allUsers: PropTypes.arrayOf(PropTypes.object)
};

AdminForm.defaultProps = {
  isEditing: false,
  initialFormData: {
    name: '',
    email: '',
    location: '',
    phone: '',
    role: 'admin'
  },
  locations: [],
  allUsers: []
};

export default AdminForm;
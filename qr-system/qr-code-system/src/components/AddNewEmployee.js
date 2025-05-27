import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Lock, 
  Building,
  AlertCircle
} from 'lucide-react';
import { ref, get, set, update, onValue } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { database, auth } from '../services/firebaseConfig';
import SystemCodes from '../utils/SystemCodes';
import './AddNewEmployee.css';

const AddNewEmployee = () => {
  const INITIAL_FORM = {
    name: '',
    position: 'Member', // Default position
    locationKey: '', // Used to store the location ID
    joinDate: '',
    service: '',
    email: '',
    phone: '',
    emergencyContact: {
      name: '',
      phone: ''
    },
    password: 'AV2025!', // Set default password that matches existing pattern
    role: 'employee',
    status: 'active',
    padrino: false, // Added based on user examples
    padrinoColor: '',
  };

  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [notif, setNotif] = useState({ show: false, message: '', type: '' });
  const [errors, setErrors] = useState({});
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState(null);
  
  // Other system codes from original component
  const [positions, setPositions] = useState([]);
  const [services, setServices] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [statusesList, setStatusesList] = useState([]);

  // Utility functions for location normalization - borrowed from ManageEmployees component
  const normalizeLocationKey = (text) => {
    if (!text) return '';
    return text.trim().toLowerCase().replace(/\s+/g, '');
  };
  
  const formatDisplayName = (text) => {
    if (!text) return '';
    return text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Fetch locations using the same approach as ManageEmployees component
  useEffect(() => {
    const fetchLocations = async () => {
      setLocationsLoading(true);
      try {
        // Try multiple approaches to ensure we get locations data
        
        // Approach 1: Try the compatibility node first (fastest)
        const compatListRef = ref(database, 'locationsList');
        onValue(compatListRef, async (snapshot) => {
          if (snapshot.exists()) {
            const locationsData = snapshot.val();
            
            if (Array.isArray(locationsData) && locationsData.length > 0) {
              // Format locations for dropdown
              const locationOptions = locationsData
                .sort()
                .map(location => ({
                  value: normalizeLocationKey(location),
                  label: formatDisplayName(location)
                }));
              
              setLocations(locationOptions);
              setLocationsLoading(false);
              setLocationsError(null);
              return;
            }
          }
          
          // Approach 2: Try the central locations node
          const locationsRef = ref(database, 'locations');
          const locationsSnapshot = await get(locationsRef);
          
          if (locationsSnapshot.exists()) {
            const locationsData = locationsSnapshot.val();
            const locationNames = [];
            
            // Extract location names from various possible formats
            Object.values(locationsData).forEach(location => {
              if (typeof location === 'object' && location !== null && location.name) {
                locationNames.push(location.name);
              } else if (typeof location === 'string') {
                locationNames.push(location);
              }
            });
            
            if (locationNames.length > 0) {
              // Format locations for dropdown
              const locationOptions = locationNames
                .sort()
                .map(location => ({
                  value: normalizeLocationKey(location),
                  label: formatDisplayName(location)
                }));
              
              setLocations(locationOptions);
              setLocationsLoading(false);
              setLocationsError(null);
              return;
            }
          }
          
          // Approach 3: Fall back to extracting from user profiles (legacy approach)
          console.log('Falling back to legacy location extraction');
          const usersRef = ref(database, 'users');
          const usersSnapshot = await get(usersRef);
          
          if (usersSnapshot.exists()) {
            const usersData = usersSnapshot.val();
            const allLocations = new Set();
            
            Object.values(usersData).forEach(data => {
              if (data.profile) {
                // Try all possible location fields
                const possibleLocations = [
                  data.profile.location,
                  data.profile.primaryLocation,
                  data.location,
                  data.locationKey
                ];
                
                possibleLocations.forEach(loc => {
                  if (loc && typeof loc === 'string' && loc.trim() !== '') {
                    allLocations.add(formatDisplayName(loc.trim()));
                  }
                });
              }
            });
            
            // Format locations for dropdown
            const locationOptions = Array.from(allLocations)
              .sort()
              .map(location => ({
                value: normalizeLocationKey(location),
                label: formatDisplayName(location)
              }));
            
            setLocations(locationOptions);
            setLocationsLoading(false);
            setLocationsError(null);
          } else {
            setLocations([]);
            setLocationsLoading(false);
            setLocationsError('No locations found');
          }
        }, (error) => {
          console.error('Error fetching locations:', error);
          setLocationsError('Failed to load locations. Please try again later.');
          setLocationsLoading(false);
        });
      } catch (err) {
        console.error('Error fetching locations:', err);
        setLocationsError('Failed to load locations. Please try again later.');
        setLocationsLoading(false);
      }
    };

    fetchLocations();
  }, []);

  useEffect(() => {
    const fetchSystemCodes = async () => {
      try {
        // Fetch all code lists in parallel
        const codeCategories = {
          positions: setPositions,
          serviceTypes: setServices,
          roles: setRolesList,
          statuses: setStatusesList
        };
        
        const fetchPromises = Object.keys(codeCategories).map(async (category) => {
          const options = await SystemCodes.getAll(category, 'options');
          return { category, data: options };
        });
        
        const results = await Promise.all(fetchPromises);
        
        // Process and store all fetched data
        results.forEach(result => {
          const { category, data } = result;
          // Update the corresponding state with the setter function
          codeCategories[category](data);
        });
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        setNotif({ 
          show: true, 
          message: "Error loading dropdown options. Please refresh.", 
          type: 'error' 
        });
      }
    };
    
    fetchSystemCodes();
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    
    // Handle nested emergencyContact fields
    if (name === 'emergencyContactName') {
      setFormData(fd => ({
        ...fd,
        emergencyContact: {
          ...fd.emergencyContact,
          name: value
        }
      }));
    } else if (name === 'emergencyContactPhone') {
      setFormData(fd => ({
        ...fd,
        emergencyContact: {
          ...fd.emergencyContact,
          phone: value
        }
      }));
    } else if (name === 'padrino') {
      // Handle checkbox for padrino
      setFormData(fd => ({
        ...fd,
        padrino: e.target.checked
      }));
    } else {
      // Handle regular fields
      setFormData(fd => ({ ...fd, [name]: value }));
    }
    
    // Clear validation error when field is changed
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const notify = (message, type = 'success') => {
    setNotif({ show: true, message, type });
    setTimeout(() => setNotif({ show: false, message: '', type: '' }), 4000);
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.password.trim()) newErrors.password = 'Temporary password is required';
    if (!formData.joinDate) newErrors.joinDate = 'Join date is required';
    if (!formData.role) newErrors.role = 'Role is required';
    if (!formData.locationKey) newErrors.locationKey = 'Location is required';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    // Password strength
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      notify('Please correct the errors in the form', 'error');
      return;
    }
    
    try {
      const { email, password } = formData;
      
      // Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const now = new Date().toISOString();

      // Look up location display name if location key exists
      let locationName = '';
      if (formData.locationKey) {
        const selectedLocation = locations.find(loc => loc.value === formData.locationKey);
        locationName = selectedLocation ? selectedLocation.label : '';
      }

      // *** Create user structure that matches successful examples ***
      const userRecord = {
        // Root level fields
        location: formData.locationKey, // Store location key at root level
        locationHistory: [
          {
            changedBy: "migration",
            date: now,
            locationKey: formData.locationKey,
            locationName: locationName
          }
        ],
        name: formData.name, // Store name at root level too
        profile: {
          // Profile fields
          department: formData.department || "",
          email: email,
          emergencyContact: {
            name: formData.emergencyContact.name || "",
            phone: formData.emergencyContact.phone || ""
          },
          joinDate: now,
          location: locationName, // Store display name in profile
          locationKey: formData.locationKey, // Store location key in profile
          managedBy: "",
          name: formData.name, // Store name in profile
          password: password,
          phone: formData.phone || "",
          position: formData.position || "Member",
          role: formData.role,
          service: formData.service || "",
          status: formData.status,
          notes: "",
          // Only include padrino fields if padrino is true
          ...(formData.padrino ? {
            padrino: true,
            padrinoColor: formData.padrinoColor || "blue"
          } : {})
        },
        stats: {
          // Initialize stats
          attendanceRate: 0,
          daysAbsent: 0,
          daysLate: 0,
          daysPresent: 0,
          onTimeRate: 0,
          totalHours: 0
        },
        status: formData.status // Root level status
      };

      // Set the complete user record
      await set(ref(database, `users/${uid}`), userRecord);

      // If role is admin, set up management structure
      if (formData.role === 'admin' || formData.role === 'super_admin') {
        await set(ref(database, `managementStructure/${uid}`), {
          role: formData.role,
          managedLocations: formData.role === 'super_admin' 
            ? { "*": true } 
            : { [formData.locationKey]: true },
          managedDepartments: { "*": true }
        });
      }

      // Add user to location's activeUsers if status is active
      if (formData.status === 'active' && formData.locationKey) {
        const locationUsersRef = ref(database, `locations/${formData.locationKey}/activeUsers/${uid}`);
        await set(locationUsersRef, {
          position: formData.position || "Member"
        });
      }

      notify(`User created successfully! Login: ${email} / ${password}`);
      setFormData({ ...INITIAL_FORM });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        notify('This email is already registered. Please use a different email.', 'error');
      } else if (err.code === 'auth/invalid-email') {
        notify('Invalid email format.', 'error');
      } else if (err.code === 'auth/weak-password') {
        notify('Password is too weak. Use at least 6 characters.', 'error');
      } else {
        notify(err.message, 'error');
      }
    }
  };

  return (
    <div className="add-employee glass-panel">
      {notif.show && (
        <div className={`notification ${notif.type}`}>
          {notif.type === 'success' ? (
            <AlertCircle className="inline-block mr-2" size={18} />
          ) : (
            <AlertCircle className="inline-block mr-2" size={18} />
          )}
          {notif.message}
        </div>
      )}
      
      <div className="section-header">
        <h2 className="section-title">Create New Member</h2>
        <p className="text-white text-opacity-60 mt-2">
          Add a new employee or administrator to the system.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="add-employee-form">
        <div className="form-section">
          <h3 className="form-section-title">Basic Information</h3>
          <div className="form-section-content">
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">
                <User className="form-icon" size={16} />
                Full Name
                <span className="required-mark">*</span>
              </label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`form-input ${errors.name ? 'error' : ''}`}
                required
              />
              {errors.name && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.name}
                </div>
              )}
            </div>

            {/* Position */}
            <div className="form-group">
              <label className="form-label">
                <Building className="form-icon" size={16} />
                Position
              </label>
              <select
                name="position"
                value={formData.position}
                onChange={handleChange}
                className={`form-select ${errors.position ? 'error' : ''}`}
              >
                <option value="Member">Member</option>
                {positions.map(position => (
                  <option key={position.value} value={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
              {errors.position && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.position}
                </div>
              )}
            </div>

            {/* Service Type */}
            <div className="form-group">
              <label className="form-label">
                <Building className="form-icon" size={16} />
                Service Type
              </label>
              <select
                name="service"
                value={formData.service}
                onChange={handleChange}
                className={`form-select ${errors.service ? 'error' : ''}`}
              >
                <option value="">Select Service</option>
                {services.map(service => (
                  <option key={service.value} value={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
              {errors.service && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.service}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="form-group">
              <label className="form-label">
                <MapPin className="form-icon" size={16} />
                Location
                <span className="required-mark">*</span>
              </label>
              <select
                name="locationKey"
                value={formData.locationKey}
                onChange={handleChange}
                className={`form-select ${errors.locationKey ? 'error' : ''}`}
                disabled={locationsLoading}
                required
              >
                <option value="">Select Location</option>
                {locations.map(location => (
                  <option key={location.value} value={location.value}>
                    {location.label}
                  </option>
                ))}
              </select>
              {errors.locationKey && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.locationKey}
                </div>
              )}
              {locationsLoading && (
                <div className="input-help-text">Loading locations...</div>
              )}
              {locationsError && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {locationsError}
                </div>
              )}
            </div>

            {/* Join Date */}
            <div className="form-group">
              <label className="form-label">
                <Calendar className="form-icon" size={16} />
                Join Date
                <span className="required-mark">*</span>
              </label>
              <input
                name="joinDate"
                type="date"
                value={formData.joinDate}
                onChange={handleChange}
                className={`form-input ${errors.joinDate ? 'error' : ''}`}
                required
              />
              {errors.joinDate && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.joinDate}
                </div>
              )}
            </div>

            {/* Padrino option */}
            <div className="form-group">
              <label className="form-checkbox-label">
                <input
                  type="checkbox"
                  name="padrino"
                  checked={formData.padrino}
                  onChange={handleChange}
                  className="form-checkbox"
                />
                <span className="ml-2">Padrino Member</span>
              </label>
            </div>

            {/* Padrino Color - Only show if padrino is checked */}
            {formData.padrino && (
              <div className="form-group">
                <label className="form-label">
                  Padrino Color
                </label>
                <select
                  name="padrinoColor"
                  value={formData.padrinoColor}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="orange">Orange</option>
                  <option value="red">Red</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Contact Information</h3>
          <div className="form-section-content">
            {/* Email */}
            <div className="form-group">
              <label className="form-label">
                <Mail className="form-icon" size={16} />
                Email
                <span className="required-mark">*</span>
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`form-input ${errors.email ? 'error' : ''}`}
                required
              />
              {errors.email && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.email}
                </div>
              )}
              <div className="input-help-text">
                Format: firstname.lastname@avjoliet.com
              </div>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">
                <Phone className="form-icon" size={16} />
                Phone
              </label>
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={`form-input ${errors.phone ? 'error' : ''}`}
                placeholder="(123) 456 7890"
              />
              {errors.phone && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.phone}
                </div>
              )}
            </div>

            {/* Emergency Contact Name */}
            <div className="form-group">
              <label className="form-label">
                <User className="form-icon" size={16} />
                Emergency Contact Name
              </label>
              <input
                name="emergencyContactName"
                value={formData.emergencyContact.name}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            {/* Emergency Phone */}
            <div className="form-group">
              <label className="form-label">
                <Phone className="form-icon" size={16} />
                Emergency Phone
              </label>
              <input
                name="emergencyContactPhone"
                type="tel"
                value={formData.emergencyContact.phone}
                onChange={handleChange}
                className="form-input"
                placeholder="(123) 456 7890"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Account Settings</h3>
          <div className="form-section-content">
            {/* Password */}
            <div className="form-group">
              <label className="form-label">
                <Lock className="form-icon" size={16} />
                Temporary Password
                <span className="required-mark">*</span>
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className={`form-input ${errors.password ? 'error' : ''}`}
                required
              />
              {errors.password && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.password}
                </div>
              )}
              <div className="input-help-text">
                Default password: AV2025! (must be at least 6 characters)
              </div>
            </div>

            {/* Role */}
            <div className="form-group">
              <label className="form-label">
                <Building className="form-icon" size={16} />
                Role
                <span className="required-mark">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`form-select ${errors.role ? 'error' : ''}`}
                required
              >
                <option value="employee">Employee</option>
                {rolesList.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {errors.role && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.role}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="form-group">
              <label className="form-label">
                <AlertCircle className="form-icon" size={16} />
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`form-select ${errors.status ? 'error' : ''}`}
              >
                <option value="active">Active</option>
                {statusesList.map(status => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              {errors.status && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.status}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => setFormData({ ...INITIAL_FORM })}
            className="btn btn-secondary"
          >
            Reset
          </button>
          <button type="submit" className="btn btn-primary">
            Create Member
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddNewEmployee;
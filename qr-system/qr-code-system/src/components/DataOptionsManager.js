import React, { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import { Save, PlusCircle, Trash2, Edit, X, Check } from 'lucide-react';
import './DatabaseOptionsManager.css';

const DatabaseOptionsManager = () => {
  // State for different option types
  const [positions, setPositions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [statuses, setStatuses] = useState([]);
  
  // State for the currently selected category
  const [activeTab, setActiveTab] = useState('positions');
  
  // State for new item being added
  const [newItem, setNewItem] = useState('');
  
  // State for item being edited
  const [editingItem, setEditingItem] = useState({ key: null, value: '' });
  
  // State for notification
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  // Fetch all data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Function to fetch all data types
  const fetchAllData = async () => {
    try {
      // Fetch positions
      const posSnap = await get(ref(database, 'positions'));
      if (posSnap.exists()) {
        const posData = posSnap.val();
        setPositions(Object.entries(posData).map(([key, value]) => ({ 
          key, 
          value: typeof value === 'string' ? value : (value.name || JSON.stringify(value))
        })));
      } else {
        setPositions([]);
      }
      
      // Fetch locations
      const locSnap = await get(ref(database, 'locations'));
      if (locSnap.exists()) {
        const locData = locSnap.val();
        setLocations(Object.entries(locData).map(([key, value]) => ({ 
          key, 
          value: typeof value === 'string' ? value : (value.name || JSON.stringify(value))
        })));
      } else {
        setLocations([]);
      }
      
      // Fetch service types
      const servSnap = await get(ref(database, 'serviceTypes'));
      if (servSnap.exists()) {
        const servData = servSnap.val();
        setServiceTypes(Object.entries(servData).map(([key, value]) => ({ 
          key, 
          value: typeof value === 'string' ? value : (value.name || JSON.stringify(value))
        })));
      } else {
        setServiceTypes([]);
      }
      
      // Fetch roles
      const roleSnap = await get(ref(database, 'roles'));
      if (roleSnap.exists()) {
        const roleData = roleSnap.val();
        setRoles(Object.entries(roleData).map(([key, value]) => ({ 
          key, 
          value: typeof value === 'string' ? value : (value.name || JSON.stringify(value))
        })));
      } else {
        setRoles([]);
      }
      
      // Fetch statuses
      const statusSnap = await get(ref(database, 'statuses'));
      if (statusSnap.exists()) {
        const statusData = statusSnap.val();
        setStatuses(Object.entries(statusData).map(([key, value]) => ({ 
          key, 
          value: typeof value === 'string' ? value : (value.name || JSON.stringify(value))
        })));
      } else {
        setStatuses([]);
      }
      
      notify("Data loaded successfully", "success");
    } catch (error) {
      console.error("Error fetching data:", error);
      notify("Error loading data. Please try again.", "error");
    }
  };

  // Helper function to get the current data array based on active tab
  const getCurrentData = () => {
    switch(activeTab) {
      case 'positions': return positions;
      case 'locations': return locations;
      case 'serviceTypes': return serviceTypes;
      case 'roles': return roles;
      case 'statuses': return statuses;
      default: return [];
    }
  };
  
  // Helper function to set the current data array based on active tab
  const setCurrentData = (data) => {
    switch(activeTab) {
      case 'positions': setPositions(data); break;
      case 'locations': setLocations(data); break;
      case 'serviceTypes': setServiceTypes(data); break;
      case 'roles': setRoles(data); break;
      case 'statuses': setStatuses(data); break;
      default: break;
    }
  };

  // Function to add a new item
  const handleAddItem = async () => {
    if (!newItem.trim()) {
      notify("Please enter a value", "error");
      return;
    }
    
    try {
      // Generate a new unique key
      const newKey = Date.now().toString();
      
      // Create the data object - just a string for simplicity
      const dataToSave = newItem.trim();
      
      // Save to Firebase
      await set(ref(database, `${activeTab}/${newKey}`), dataToSave);
      
      // Update local state
      setCurrentData([...getCurrentData(), { key: newKey, value: dataToSave }]);
      
      // Clear the input
      setNewItem('');
      
      notify("Item added successfully", "success");
    } catch (error) {
      console.error("Error adding item:", error);
      notify("Error adding item. Please try again.", "error");
    }
  };

  // Function to delete an item
  const handleDeleteItem = async (key) => {
    if (!key) return;
    
    try {
      // Delete from Firebase
      await remove(ref(database, `${activeTab}/${key}`));
      
      // Update local state
      setCurrentData(getCurrentData().filter(item => item.key !== key));
      
      notify("Item deleted successfully", "success");
    } catch (error) {
      console.error("Error deleting item:", error);
      notify("Error deleting item. Please try again.", "error");
    }
  };

  // Function to start editing an item
  const handleStartEdit = (item) => {
    setEditingItem({ key: item.key, value: item.value });
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingItem({ key: null, value: '' });
  };

  // Function to save edited item
  const handleSaveEdit = async () => {
    if (!editingItem.key || !editingItem.value.trim()) {
      notify("Please enter a valid value", "error");
      return;
    }
    
    try {
      // Save to Firebase
      await set(ref(database, `${activeTab}/${editingItem.key}`), editingItem.value);
      
      // Update local state
      setCurrentData(getCurrentData().map(item => 
        item.key === editingItem.key ? { ...item, value: editingItem.value } : item
      ));
      
      // Clear editing state
      setEditingItem({ key: null, value: '' });
      
      notify("Item updated successfully", "success");
    } catch (error) {
      console.error("Error updating item:", error);
      notify("Error updating item. Please try again.", "error");
    }
  };

  // Function to show notification
  const notify = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  // Get the human-readable name for the active tab
  const getTabName = () => {
    switch(activeTab) {
      case 'positions': return 'Positions';
      case 'locations': return 'Locations';
      case 'serviceTypes': return 'Service Types';
      case 'roles': return 'Roles';
      case 'statuses': return 'Statuses';
      default: return '';
    }
  };

  return (
    <div className="database-options-manager p-6 max-w-4xl mx-auto glass-panel">
      <h2 className="section-title mb-6">Manage Database Options</h2>
      
      {/* Notification */}
      {notification.show && (
        <div className={`notification ${notification.type} mb-4`}>
          {notification.message}
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="tabs-container mb-6">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            Positions
          </button>
          <button 
            className={`tab-button ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            Locations
          </button>
          <button 
            className={`tab-button ${activeTab === 'serviceTypes' ? 'active' : ''}`}
            onClick={() => setActiveTab('serviceTypes')}
          >
            Service Types
          </button>
          <button 
            className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Roles
          </button>
          <button 
            className={`tab-button ${activeTab === 'statuses' ? 'active' : ''}`}
            onClick={() => setActiveTab('statuses')}
          >
            Statuses
          </button>
        </div>
      </div>
      
      {/* Add New Item Form */}
      <div className="add-item-form mb-6">
        <h3 className="text-xl font-semibold mb-2">Add New {getTabName().slice(0, -1)}</h3>
        <div className="flex items-center">
          <input 
            type="text" 
            className="form-input flex-grow mr-2"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`Enter new ${getTabName().toLowerCase().slice(0, -1)} name...`}
          />
          <button 
            className="btn btn-primary flex items-center"
            onClick={handleAddItem}
          >
            <PlusCircle size={18} className="mr-1" />
            Add
          </button>
        </div>
      </div>
      
      {/* Items List */}
      <div className="items-list">
        <h3 className="text-xl font-semibold mb-4">{getTabName()} List</h3>
        
        {getCurrentData().length === 0 ? (
          <p className="text-gray-500">No items found. Add some using the form above.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {getCurrentData().map((item) => (
              <li key={item.key} className="py-3 flex items-center justify-between">
                {editingItem.key === item.key ? (
                  // Edit mode
                  <div className="flex items-center flex-grow">
                    <input 
                      type="text" 
                      className="form-input flex-grow mr-2"
                      value={editingItem.value}
                      onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                    />
                    <button 
                      className="btn btn-sm btn-success mr-1"
                      onClick={handleSaveEdit}
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  // View mode
                  <>
                    <span className="text-gray-800">{item.value}</span>
                    <div className="flex items-center">
                      <button 
                        className="btn btn-sm btn-secondary mr-1"
                        onClick={() => handleStartEdit(item)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteItem(item.key)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DatabaseOptionsManager;
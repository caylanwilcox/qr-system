// src/components/QRSCANNER/QRScannerPage.js
import React, { useState, useEffect } from 'react';
import { Settings, X, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { useAuth } from '../../services/authContext';
import Scanner from './Scanner';
import moment from 'moment-timezone';

/**
 * Main QR Scanner page component
 * Simplified to focus on clock in functionality that writes to Firebase
 */
const QRScannerPage = () => {
  const { user } = useAuth();
  
  // Basic state
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  
  // Settings state
  const [locations, setLocations] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [eventTypeDisplayNames, setEventTypeDisplayNames] = useState({});

  // Initialize app on component mount
  useEffect(() => {
    const loadSystemSettings = async () => {
      try {
        // Load locations
        const locationsRef = ref(database, 'locations');
        const locationsSnapshot = await get(locationsRef);
        if (locationsSnapshot.exists()) {
          setLocations(Object.values(locationsSnapshot.val()));
        } else {
          // Default locations if none found
          setLocations(['Aurora', 'Elgin', 'Chicago']);
        }

        // Load event types
        const eventTypesRef = ref(database, 'eventTypes');
        const eventTypesSnapshot = await get(eventTypesRef);
        if (eventTypesSnapshot.exists()) {
          const types = {};
          const displayNames = {};
          
          Object.entries(eventTypesSnapshot.val()).forEach(([key, value]) => {
            types[key] = value.name;
            displayNames[value.name] = value.displayName;
          });
          
          setEventTypes(types);
          setEventTypeDisplayNames(displayNames);
          
          // REMOVED: Don't auto-select first event type - user must choose manually
          // This ensures the scanner won't work until user explicitly selects an event type
        }
      } catch (error) {
        console.error('Error loading system settings:', error);
        setMessage('Failed to load system settings. Please refresh.');
      }
    };

    loadSystemSettings();
  }, []);

  // Handle successful scan
  const handleScan = async (scannedCode) => {
    if (isProcessing || !scannedCode) {
      setMessage(!scannedCode ? 'No code detected' : 'Processing in progress...');
      return;
    }

    if (!location) {
      setMessage('Please select a location first');
      return;
    }

    if (!eventType) {
      setMessage('Please select an event type first');
      return;
    }

    setIsProcessing(true);
    setMessage('Processing scan...');

    try {
      const userId = scannedCode.trim();
      
      // Check if user exists and is active
      const userRef = ref(database, `users/${userId}`);
      const userSnapshot = await get(userRef);
      
      if (!userSnapshot.exists()) {
        throw new Error('User not found in the system');
      }
      
      const userData = userSnapshot.val();
      
      // Check if user is active
      const deletedUsersRef = ref(database, `deleted_users`);
      const deletedSnapshot = await get(deletedUsersRef);
      
      if (deletedSnapshot.exists()) {
        const deletedUsers = deletedSnapshot.val();
        const isDeleted = Object.keys(deletedUsers).some(key => key.includes(userId));
        
        if (isDeleted) {
          throw new Error('User account is inactive or deleted');
        }
      }
      
      // FIXED: Get current timestamp and date using Chicago timezone
      const chicagoNow = moment().tz('America/Chicago');
      const timestamp = chicagoNow.toISOString();
      const currentDate = chicagoNow.format('YYYY-MM-DD');
      
      console.log('🔍 Old QRScannerPage timestamp:', { 
        timestamp, 
        currentDate, 
        chicagoTime: chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'),
        utcTime: new Date().toISOString()
      });
      
      // Prepare clock-in data
      const clockInData = {
        userId,
        name: userData.name || 'Unknown User',
        position: userData.profile?.position || 'Member',
        location,
        eventType,
        clockInTime: timestamp
      };
      
      // Save to attendance database
      const locationKey = location.toLowerCase();
      const attendanceRef = ref(database, `attendance/${locationKey}/${currentDate}/${userId}`);
      
      await set(attendanceRef, clockInData);
      
      // Update employee summary
      updateEmployeeSummary(userId, userData, locationKey);
      
      // Set employee info to display
      setEmployeeInfo({
        ...userData,
        userId,
        clockInTime: timestamp
      });
      
      setMessage(`Successfully clocked in: ${userData.name}`);
    } catch (error) {
      console.error('Scan error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Update employee attendance summary
  const updateEmployeeSummary = async (userId, userData, locationKey) => {
    try {
      const summaryRef = ref(database, `employeeAttendanceSummary/${locationKey}/${userId}`);
      const summarySnapshot = await get(summaryRef);
      
      const summary = summarySnapshot.exists() 
        ? summarySnapshot.val() 
        : {
            daysLate: 0,
            daysOnTime: 0,
            daysScheduledMissed: 0,
            daysScheduledPresent: 0,
            totalDays: 0,
            email: userData.profile?.email || '',
            name: userData.name || 'Unknown User',
            phone: userData.profile?.phone || '',
            position: userData.profile?.position || 'Member',
            startDate: userData.profile?.joinDate || new Date().toISOString()
          };
      
      // Increment days on time for simplicity
      summary.daysOnTime += 1;
      summary.totalDays += 1;
      
      await set(summaryRef, summary);
    } catch (error) {
      console.error('Error updating employee summary:', error);
    }
  };

  // Handle location selection
  const handleLocationChange = (e) => {
    setLocation(e.target.value);
  };
  
  // Handle event type selection
  const handleEventTypeChange = (e) => {
    setEventType(e.target.value);
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 bg-opacity-75 backdrop-blur-xl p-8">
      <header className="text-4xl text-white text-center font-bold mb-8">
        QR Code Scanner
      </header>

      <div className="fixed top-8 right-8">
        <button
          onClick={() => setSettingsVisible(!settingsVisible)}
          className="text-white hover:rotate-90 transition-transform duration-300"
        >
          {settingsVisible ? <X size={24} /> : <Settings size={24} />}
        </button>
      </div>

      {settingsVisible && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6 max-w-lg mx-auto">
          <h3 className="text-white text-lg font-semibold mb-4">Settings</h3>
          
          <div className="mb-4">
            <label className="text-white text-opacity-80 mb-2 block">Location</label>
            <select
              value={location}
              onChange={handleLocationChange}
              className="w-full p-2 bg-black bg-opacity-30 border border-white border-opacity-10 rounded-lg text-white"
            >
              <option value="">Select Location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="text-white text-opacity-80 mb-2 block">Event Type</label>
            <select
              value={eventType}
              onChange={handleEventTypeChange}
              className="w-full p-2 bg-black bg-opacity-30 border border-white border-opacity-10 rounded-lg text-white"
            >
              <option value="">Select Event Type</option>
              {Object.entries(eventTypes).map(([key, value]) => (
                <option key={key} value={value}>
                  {eventTypeDisplayNames[value] || value}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!location && (
        <div className="bg-amber-600 bg-opacity-20 border border-amber-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-500">
              Please select a location in Settings before scanning
            </span>
          </div>
        </div>
      )}

      {!eventType && location && (
        <div className="bg-amber-600 bg-opacity-20 border border-amber-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-500">
              Please select an event type in Settings before scanning
            </span>
          </div>
        </div>
      )}

      <Scanner onScan={handleScan} location={location} isProcessing={isProcessing} />

      <div className="max-w-lg mx-auto text-center mb-4">
        <span className="px-3 py-1 rounded-lg text-sm bg-green-600 text-white">
          Clock In Mode
        </span>
        
        {location && eventType && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="px-3 py-1 rounded-lg text-sm bg-blue-600 text-white">
              {location}
            </span>
            <span className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white">
              {eventTypeDisplayNames[eventType] || eventType}
            </span>
          </div>
        )}
      </div>

      {message && (
        <div className={`bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-4 mb-4 text-white max-w-lg mx-auto text-center`}>
          {message}
        </div>
      )}

      {employeeInfo && (
        <div className="bg-green-600 bg-opacity-20 border border-green-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h3 className="text-white text-lg font-semibold">
              {employeeInfo.name}
            </h3>
            <p className="text-white text-opacity-70">
              {employeeInfo.profile?.position || 'Member'}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-white text-opacity-70 text-sm">
                Location: {location}
              </p>
              <p className="text-white text-opacity-70 text-sm">
                Event: {eventTypeDisplayNames[eventType] || eventType}
              </p>
              <p className="text-white text-opacity-70 text-sm">
                Time: {new Date(employeeInfo.clockInTime).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;
import React, { useState, useEffect, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { ref, set, get, update } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import Scanner from './Scanner';

const QRScannerPage = () => {
  // State management
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [mode, setMode] = useState('clock-in');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Mode ref for async operations
  const modeRef = useRef(mode);

  const locations = [
    "Agua Viva West Chicago",
    "Agua Viva Lyons",
    "Aurora",
    "Agua Viva Elgin R7",
    "Agua Viva Joliet",
    "Agua Viva Wheeling",
  ];

  // Update mode ref when mode changes
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const updateUserLocation = async (userId, userData) => {
    const userRef = ref(database, `users/${userId}`);
    const now = new Date().toISOString();
    
    const locationHistory = userData.locationHistory || [];
    locationHistory.unshift({
      locationId: location,
      date: now,
      changedBy: 'system'
    });

    await update(userRef, {
      location: location,
      locationHistory: locationHistory.slice(0, 10)
    });
  };

  const handleScan = async (scannedCode) => {
    if (isProcessing || !location || !scannedCode) {
      setMessage(!location ? "⚠️ Please select a location first" : "No code detected");
      return;
    }

    setIsProcessing(true);
    try {
      // Clean and validate the scanned code
      const employeeId = scannedCode.trim();
      
      // Get current date for attendance record
      const now = new Date().toISOString();
      const attendanceDate = now.split('T')[0]; // YYYY-MM-DD format
      
      // Get user data
      const userRef = ref(database, `users/${employeeId}`);
      const userSnapshot = await get(userRef);

      if (!userSnapshot.exists()) {
        throw new Error(`Employee ID not found: ${employeeId}`);
      }

      const userData = userSnapshot.val();
      
      // Check if user is active
      if (userData.status !== 'active') {
        throw new Error('This employee ID is not active');
      }

      // Reference to attendance record
      const attendanceRef = ref(database, `attendance/${location}/${attendanceDate}/${employeeId}`);
      
      // Update user's location
      await updateUserLocation(employeeId, userData);

      // Handle clock in/out based on mode
      if (modeRef.current === 'clock-in') {
        await handleClockIn(userData, employeeId, attendanceRef, now);
      } else {
        await handleClockOut(userData, employeeId, attendanceRef, now);
      }
    } catch (error) {
      console.error('Operation error:', error);
      setErrors(prev => [...prev, error.message]);
      setMessage(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClockIn = async (userData, employeeId, attendanceRef, now) => {
    const existingRecord = await get(attendanceRef);
    if (existingRecord.exists() && existingRecord.val().clockInTime) {
      throw new Error(`${userData.name} is already clocked in for today`);
    }

    // Create attendance record
    await set(attendanceRef, {
      clockInTime: now,
      name: userData.name,
      position: userData.position || 'Member',
      userId: employeeId,
      location
    });

    // Update user's stats
    const statsRef = ref(database, `users/${employeeId}/stats`);
    const statsSnapshot = await get(statsRef);
    const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
    
    await update(statsRef, {
      daysPresent: (currentStats.daysPresent || 0) + 1,
      lastClockIn: now
    });

    setEmployeeInfo({
      name: userData.name,
      photo: userData.photo || "",
      position: userData.position || 'Member',
      clockInTime: new Date(now).toLocaleString()
    });
    
    setMessage(`Welcome ${userData.name}! Clock-in successful`);
  };

  const handleClockOut = async (userData, employeeId, attendanceRef, now) => {
    const existingRecord = await get(attendanceRef);
    
    if (!existingRecord.exists() || !existingRecord.val().clockInTime) {
      throw new Error(`No clock-in record found for ${userData.name} today`);
    }

    const recordData = existingRecord.val();
    
    if (recordData.clockOutTime) {
      throw new Error(`${userData.name} is already clocked out for today`);
    }

    const clockInTime = new Date(recordData.clockInTime);
    const clockOutTime = new Date(now);
    const hoursWorked = Math.max(0, (clockOutTime - clockInTime) / (1000 * 60 * 60));

    await update(attendanceRef, {
      clockOutTime: now,
      hoursWorked: hoursWorked.toFixed(2)
    });

    // Update user's stats
    const statsRef = ref(database, `users/${employeeId}/stats`);
    const statsSnapshot = await get(statsRef);
    const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
    
    await update(statsRef, {
      totalHours: (currentStats.totalHours || 0) + hoursWorked,
      lastClockOut: now
    });

    setEmployeeInfo({
      name: userData.name,
      photo: userData.photo || "",
      position: userData.position || 'Member',
      clockOutTime: new Date(now).toLocaleString(),
      hoursWorked: hoursWorked.toFixed(2)
    });

    setMessage(`Goodbye ${userData.name}! Clock-out successful`);

    // Clear employee info after delay
    setTimeout(() => {
      setEmployeeInfo(null);
    }, 5000);
  };

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setMessage(`Switched to ${newMode === "clock-in" ? "Clock In" : "Clock Out"} mode`);
    setEmployeeInfo(null);
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
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl p-8 mb-8 max-w-lg mx-auto backdrop-blur-md">
          <h2 className="text-white text-xl mb-6">Scanner Settings</h2>
          
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-3 text-base bg-black bg-opacity-5 border border-white border-opacity-10 rounded-lg text-white mb-6 cursor-pointer"
          >
            <option value="">Select Location</option>
            {locations.map((loc) => (
              <option key={loc} value={loc} className="bg-slate-900 text-white">
                {loc}
              </option>
            ))}
          </select>

          <div className="flex gap-4 justify-center mb-4">
            <button
              onClick={() => handleModeSwitch("clock-in")}
              className={`px-6 py-3 text-base rounded-lg transition-all ${
                mode === "clock-in"
                  ? "bg-blue-500 text-white"
                  : "bg-blue-500 bg-opacity-20 border border-blue-500 border-opacity-30 text-blue-400"
              }`}
            >
              Clock In
            </button>
            <button
              onClick={() => handleModeSwitch("clock-out")}
              className={`px-6 py-3 text-base rounded-lg transition-all ${
                mode === "clock-out"
                  ? "bg-blue-500 text-white"
                  : "bg-blue-500 bg-opacity-20 border border-blue-500 border-opacity-30 text-blue-400"
              }`}
            >
              Clock Out
            </button>
          </div>
        </div>
      )}

      <Scanner 
        onScan={handleScan}
        location={location}
        isProcessing={isProcessing}
      />

      {message && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-4 mb-4 text-center text-white max-w-lg mx-auto">
          {message}
        </div>
      )}

      {employeeInfo && (
        <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl p-8 mt-8 max-w-lg mx-auto flex flex-col items-center backdrop-blur-md">
          <div className="mb-6">
            <img
              src={employeeInfo.photo || "/api/placeholder/120/120"}
              alt="Employee"
              className="w-32 h-32 rounded-full object-cover border-3 border-blue-500 border-opacity-30 bg-black bg-opacity-20"
            />
          </div>
          <div className="text-center">
            <h2 className="text-2xl text-white mb-2">{employeeInfo.name}</h2>
            <p className="text-white text-opacity-70 mb-2">{employeeInfo.position}</p>
            {employeeInfo.clockInTime && (
              <p className="text-white text-opacity-70">
                Clocked in at: {employeeInfo.clockInTime}
              </p>
            )}
            {employeeInfo.clockOutTime && (
              <div>
                <p className="text-white text-opacity-70">
                  Clocked out at: {employeeInfo.clockOutTime}
                </p>
                <p className="text-white text-opacity-70 mt-2">
                  Hours worked: {employeeInfo.hoursWorked} hours
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="max-w-lg mx-auto mt-4">
          {errors.map((error, index) => (
            <p key={index} className="text-red-400 text-sm mb-1">
              {error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;
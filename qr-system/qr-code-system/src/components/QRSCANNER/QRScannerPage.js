// src/components/QRSCANNER/QRScannerPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, X, CheckCircle, AlertCircle, ExternalLink, LogOut, LogIn } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { useAuth } from '../../services/authContext';
import { eventBus, EVENTS } from '../../services/eventBus';
import { useNavigate } from 'react-router-dom';
import Scanner from './Scanner';
import SettingsPanel from './SettingsPanel';
import moment from 'moment-timezone';
import { recordScan } from '../../services/adminApi';

// Tells open dashboards that attendance changed.
function emitClockEvents(userId, locationKey, locationValue, now, type, isLate = false, eventType = null, eventId = null) {
  console.log('🔍 Emitting clock events:', { userId, type, locationKey, eventType });
  
  try {
    eventBus.emit(EVENTS.ATTENDANCE_UPDATED, {
      userId,
      location: locationKey,
      locationName: locationValue,
      timestamp: now.toISOString(),
      type: type,
      isLate: isLate
    });
    
    eventBus.emit(EVENTS.USER_DATA_UPDATED, {
      userId,
      field: 'attendance',
      timestamp: now.toISOString()
    });
    
    if (eventType && eventId) {
      eventBus.emit(EVENTS.EVENT_UPDATED, {
        userId,
        eventId,
        eventType: eventType,
        status: 'attended',
        timestamp: now.toISOString()
      });
    }
    
    eventBus.emit(EVENTS.DASHBOARD_DATA_UPDATED, {
      location: locationKey,
      timestamp: now.toISOString()
    });
    
    console.log('🔍 All clock events emitted successfully');
  } catch (error) {
    console.error('🔍 Error emitting events:', error);
  }
}

/**
 * Main QR Scanner page component with Clock-In and Clock-Out support
 * FIXED VERSION - Addresses dashboard compatibility and clock-in issues
 */
const QRScannerPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Basic state
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState('');
  const [mode, setMode] = useState('clock-in'); // 'clock-in' or 'clock-out'
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  
  // Settings state
  const [locations, setLocations] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [eventTypeDisplayNames, setEventTypeDisplayNames] = useState({});
  const [meetingTypes] = useState([]);
  const [selectedMeeting, setSelectedMeetting] = useState('');
  const [scheduledEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Refs to track current state for callbacks
  const currentStateRef = useRef({ location: '', eventType: '', mode: 'clock-in' });
  // Set synchronously on scan. The isProcessing state lags a render behind,
  // which let two quick scans of the same badge both get through.
  const processingRef = useRef(false);

  console.log('🔍 QRScannerPage render - current state:', { location, eventType, mode, isProcessing });
  
  // Update ref whenever state changes
  useEffect(() => {
    currentStateRef.current = { location, eventType, mode };
    console.log('🔍 State update - Location:', location, 'EventType:', eventType, 'Mode:', mode);
  }, [location, eventType, mode]);

  // Initialize app on component mount
  useEffect(() => {
    console.log('🔍 useEffect running - loadSystemSettings');
    
    const loadSystemSettings = async () => {
      try {
        // Load locations
        const locationsRef = ref(database, 'locations');
        const locationsSnapshot = await get(locationsRef);
        if (locationsSnapshot.exists()) {
          const locationsData = locationsSnapshot.val();
          console.log('Raw locations data from Firebase:', locationsData);
          
          const locationsList = Object.entries(locationsData).map(([key, value]) => {
            if (typeof value === 'object' && value !== null && value.name) {
              return value.name;
            }
            if (typeof value === 'string') {
              return value;
            }
            return key;
          }).filter(loc => loc && typeof loc === 'string');
          
          console.log('Processed locations list:', locationsList);
          setLocations(locationsList);
        } else {
          console.log('No locations found in database, using defaults');
          setLocations(['Aurora', 'Elgin', 'Chicago']);
        }

        // Load event types
        const eventTypesRef = ref(database, 'eventTypes');
        const eventTypesSnapshot = await get(eventTypesRef);
        if (eventTypesSnapshot.exists()) {
          const types = {};
          const displayNames = {};
          
          console.log('🔍 Raw event types from Firebase:', eventTypesSnapshot.val());
          
          Object.entries(eventTypesSnapshot.val()).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              const eventTypeName = value.name || value.key || key;
              types[key] = eventTypeName;
              displayNames[eventTypeName] = value.displayName || eventTypeName;
              
              const normalized = eventTypeName.toLowerCase().replace(/\s+/g, '');
              displayNames[normalized] = value.displayName || eventTypeName;
            } else if (typeof value === 'string') {
              types[key] = value;
              displayNames[value] = value;
              
              const normalized = value.toLowerCase().replace(/\s+/g, '');
              displayNames[normalized] = value;
            }
          });
          
          // Add common display names
          const commonNames = {
            'juntahacienda': 'Junta Hacienda',
            'junta_hacienda': 'Junta Hacienda', 
            'JUNTA_HACIENDA': 'Junta Hacienda',
            'meetings': 'Meetings',
            'workshops': 'Workshops',
            'haciendas': 'Haciendas',
            'gestion': 'Gestion'
          };
          
          Object.entries(commonNames).forEach(([key, value]) => {
            if (!displayNames[key]) {
              displayNames[key] = value;
            }
          });
          
          console.log('🔍 Processed event types:', types);
          console.log('🔍 Event type display names:', displayNames);
          
          setEventTypes(types);
          setEventTypeDisplayNames(displayNames);
          
          console.log('🔍 Event types loaded');
        } else {
          // Default event types
          const defaultTypes = {
            'general': 'GENERAL',
            'juntahacienda': 'juntahacienda',
            'meeting': 'MEETING',
            'training': 'TRAINING'
          };
          
          const defaultDisplayNames = {
            'GENERAL': 'General Meeting',
            'general': 'General Meeting',
            'juntahacienda': 'Junta Hacienda',
            'MEETING': 'Meeting',
            'meeting': 'Meeting',
            'TRAINING': 'Training',
            'training': 'Training'
          };
          
          setEventTypes(defaultTypes);
          setEventTypeDisplayNames(defaultDisplayNames);
        }
        
        setMessage('System loaded. Ready to scan.');
      } catch (error) {
        console.error('Error loading system settings:', error);
        setMessage('Failed to load system settings. Please refresh.');
      }
    };

    loadSystemSettings();
  }, []);

  // Clock in and clock out run on the server (api/attendance/scan.js). It
  // holds a per-person lock, so two scans of one badge, even from two
  // devices, can never both clock in, and it saves each scan in one write.
  const processScan = useCallback(async (userId, mode, currentLocation, currentEventType) => {
    const eventTypeLabel = currentEventType ? (eventTypeDisplayNames[currentEventType] || currentEventType) : '';
    const result = await recordScan({
      userId,
      mode,
      location: currentLocation,
      eventType: mode === 'clock-in' ? currentEventType : '',
      eventTypeLabel
    });

    // Nothing was open today; an older forgotten clock-in was closed instead.
    if (result.mode === 'stale-closed') {
      setEmployeeInfo(null);
      setMessage(result.message);
      return;
    }

    setEmployeeInfo({
      userId,
      name: result.name,
      position: result.position,
      mode: result.mode,
      clockInTime: result.clockInTime,
      clockOutTime: result.clockOutTime,
      hoursWorked: result.hoursWorked,
      isLate: Boolean(result.isLate),
      selectedEventType: currentEventType,
      selectedEventDisplayName: eventTypeLabel,
      attendanceKey: result.attendanceKey
    });
    emitClockEvents(
      userId,
      result.locationKey,
      currentLocation,
      new Date(),
      result.mode,
      Boolean(result.isLate),
      result.eventType || null,
      result.eventId || null
    );
    setMessage(result.message);
  }, [eventTypeDisplayNames]);

  const handleScan = useCallback(async (scannedCode) => {
    const currentLocation = currentStateRef.current.location;
    const currentEventType = currentStateRef.current.eventType;
    const currentMode = currentStateRef.current.mode;
    
    console.log('🔍 Scan attempt with current state:', { 
      scannedCode, 
      currentLocation, 
      currentEventType,
      currentMode,
      processing: processingRef.current
    });

    // CRITICAL FIX: Validate inputs more thoroughly
    if (processingRef.current) {
      console.log('🔍 Scan blocked: Already processing');
      setMessage('Processing in progress...');
      return;
    }
    
    if (!scannedCode || !scannedCode.trim()) {
      console.log('🔍 Scan blocked: No code detected');
      setMessage('No code detected');
      return;
    }

    if (!currentLocation || !currentLocation.trim()) {
      console.log('🔍 Scan blocked: No location selected');
      setMessage('Please select a location first');
      return;
    }

    // For clock-in mode, event type is required
    if (currentMode === 'clock-in' && (!currentEventType || !currentEventType.trim())) {
      console.log('🔍 Scan blocked: No event type selected for clock-in');
      setMessage('Please select an event type for clock-in');
      return;
    }

    console.log('🔍 Scan proceeding with:', { location: currentLocation, eventType: currentEventType, mode: currentMode });
    processingRef.current = true;
    setIsProcessing(true);
    setMessage(`Processing ${currentMode}...`);

    try {
      await processScan(scannedCode.trim(), currentMode, currentLocation, currentEventType);
    } catch (error) {
      console.error('🔍 Scan error:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [processScan]);

  // Debug function to test timezone calculations
  const debugTimezone = () => {
    const chicagoNow = moment().tz('America/Chicago');
    const utcNow = moment().utc();
    const localNow = moment();
    
    console.log('=== TIMEZONE DEBUG ===');
    console.log('Chicago time:', chicagoNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('Chicago date:', chicagoNow.format('YYYY-MM-DD'));
    console.log('UTC time:', utcNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('UTC date:', utcNow.format('YYYY-MM-DD'));
    console.log('Local time:', localNow.format('YYYY-MM-DD HH:mm:ss Z'));
    console.log('Local date:', localNow.format('YYYY-MM-DD'));
    console.log('Timestamp (Chicago):', chicagoNow.valueOf());
    console.log('Timestamp (UTC):', utcNow.valueOf());
    console.log('======================');
    
    setMessage(`Debug: Chicago date is ${chicagoNow.format('YYYY-MM-DD')}, UTC date is ${utcNow.format('YYYY-MM-DD')}`);
  };

  // Handle mode switch
  const handleModeSwitch = (newMode) => {
    console.log('🔍 Mode switch:', newMode);
    setMode(newMode);
    setEmployeeInfo(null); // Clear previous scan result
    setMessage(`Switched to ${newMode} mode`);
  };

  // Handle location selection
  const handleLocationChange = (selectedLocation) => {
    console.log('🔍 Location change:', selectedLocation);
    setLocation(selectedLocation);
    setMessage(`Location set to: ${selectedLocation}`);
  };
  
  // Handle event type selection
  const handleEventTypeChange = (selectedValue) => {
    console.log('🔍 Event type selection:', selectedValue);
    setEventType(selectedValue);
    const displayName = eventTypeDisplayNames[selectedValue] || selectedValue;
    setMessage(`Event type set to: ${displayName}`);
  };
  
  // Placeholder functions for settings panel
  const handleReloadCodes = () => {
    console.log('🔄 Reloading system codes...');
    setMessage('System codes reloaded');
  };

  const handleShowScheduledEvents = () => {
    console.log('📅 Showing scheduled events...');
    setMessage('Showing scheduled events');
  };

  const forceRefreshEvents = () => {
    console.log('🔄 Force refreshing events...');
    setMessage('Events refreshed');
  };

  const handleEventSelection = (event) => {
    console.log('📅 Event selected:', event);
    setSelectedEvent(event);
  };
  
  // Close settings panel
  const handleSettingsClose = () => {
    console.log('🔍 Settings close');
    setSettingsVisible(false);
    
    setTimeout(() => {
      const currentLocation = currentStateRef.current.location;
      const currentEventType = currentStateRef.current.eventType;
      const currentMode = currentStateRef.current.mode;
      
      if (!currentLocation) {
        setMessage('Please select a location before scanning');
      } else if (currentMode === 'clock-in' && !currentEventType) {
        setMessage('Please select an event type for clock-in');
      } else {
        const modeText = currentMode === 'clock-in' ? 'Clock In' : 'Clock Out';
        const eventText = currentMode === 'clock-in' && currentEventType 
          ? ` with event type: ${eventTypeDisplayNames[currentEventType] || currentEventType}` 
          : '';
        setMessage(`Ready to ${modeText} at location: ${currentLocation}${eventText}`);
      }
    }, 100);
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
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-xl font-semibold">Scanner Settings</h3>
              <button
                onClick={() => setSettingsVisible(false)}
                className="text-white hover:bg-slate-700 p-1 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <SettingsPanel
              location={location}
              setLocation={handleLocationChange}
              locations={locations}
              eventType={eventType}
              eventTypes={eventTypes}
              eventTypeDisplayNames={eventTypeDisplayNames}
              handleEventTypeChange={handleEventTypeChange}
              meetingTypes={meetingTypes}
              selectedMeeting={selectedMeeting}
              setSelectedMeeting={setSelectedMeetting}
              scheduledEvents={scheduledEvents}
              selectedEvent={selectedEvent}
              handleEventSelection={handleEventSelection}
              mode={mode}
              handleModeSwitch={handleModeSwitch}
              handleReloadCodes={handleReloadCodes}
              handleShowScheduledEvents={handleShowScheduledEvents}
              forceRefreshEvents={forceRefreshEvents}
            />
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSettingsClose}
                className="flex-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Apply Settings
              </button>
              <button
                onClick={() => setSettingsVisible(false)}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
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

      {!eventType && location && mode === 'clock-in' && (
        <div className="bg-amber-600 bg-opacity-20 border border-amber-500 rounded-lg p-4 mb-4 max-w-lg mx-auto">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-500">
              Please select an event type in Settings for clock-in
            </span>
          </div>
        </div>
      )}

      <Scanner 
        onScan={handleScan} 
        location={location} 
        eventType={eventType}
        mode={mode}
        isProcessing={isProcessing} 
      />

      <div className="max-w-lg mx-auto mb-6 flex flex-col gap-3">
        {/* Mode and Settings Display */}
        {location && (mode === 'clock-out' || (mode === 'clock-in' && eventType)) && (
          <div className="p-4 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg flex flex-col">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-lg text-sm flex items-center gap-1 ${
                mode === 'clock-in' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
              }`}>
                {mode === 'clock-in' ? <LogIn size={14} /> : <LogOut size={14} />}
                {mode === 'clock-in' ? 'Clock In Mode' : 'Clock Out Mode'}
              </span>
              <span className="px-3 py-1 rounded-lg text-sm bg-purple-600 text-white">
                {location}
              </span>
              {mode === 'clock-in' && eventType && (
                <span className="px-3 py-1 rounded-lg text-sm bg-orange-600 text-white">
                  {eventTypeDisplayNames[eventType] || eventType}
                </span>
              )}
            </div>
            <div className="text-center text-white text-opacity-70 text-sm">
              Scan QR code or ID to {mode === 'clock-in' ? 'clock in' : 'clock out'}
            </div>
          </div>
        )}
        
        <button
          onClick={() => setSettingsVisible(true)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white flex items-center justify-center gap-2 transition"
        >
          <Settings size={18} />
          {location && (mode === 'clock-out' || (mode === 'clock-in' && eventType)) ? 'Change Settings' : 'Configure Scanner'}
        </button>
        
        <button
          onClick={() => {
            if (user?.role === 'super_admin' || user?.role === 'SUPER_ADMIN') {
              navigate('/super-admin');
            } else if (user?.role === 'admin' || user?.role === 'ADMIN') {
              navigate('/location-admin');
            } else {
              navigate('/dashboard');
            }
          }}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition"
        >
          <ExternalLink size={18} />
          View Dashboard
        </button>
        
        {/* Debug button - remove after testing */}
        <button
          onClick={debugTimezone}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center justify-center gap-2 transition text-sm"
        >
          🐛 Debug Timezone
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`${
          message.includes('Success') || message.includes('Ready to') || message.includes('clocked out')
            ? 'bg-green-500 bg-opacity-20 border-green-500' 
            : message.includes('Error') || message.includes('Failed')
              ? 'bg-red-500 bg-opacity-20 border-red-500'
              : 'bg-white bg-opacity-10 border-white border-opacity-20'
        } border rounded-lg p-4 mb-4 text-white max-w-lg mx-auto text-center`}>
          {(message.includes('Success') || message.includes('clocked out')) && <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-2" />}
          {message.includes('Error') && <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />}
          {message}
        </div>
      )}

      {/* Employee Info Display */}
      {employeeInfo && (
        <div className={`${
          employeeInfo.mode === 'clock-in' 
            ? 'bg-green-600 bg-opacity-20 border-green-500' 
            : 'bg-blue-600 bg-opacity-20 border-blue-500'
        } border rounded-lg p-4 mb-4 max-w-lg mx-auto`}>
          <div className="text-center">
            {employeeInfo.mode === 'clock-in' ? (
              <LogIn className="w-8 h-8 text-green-400 mx-auto mb-2" />
            ) : (
              <LogOut className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            )}
            <h3 className="text-white text-lg font-semibold">
              {typeof employeeInfo.name === 'object' ? 'User' : employeeInfo.name}
            </h3>
            <p className="text-white text-opacity-70">
              {employeeInfo.profile?.position || employeeInfo.position || 'Member'}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-white text-opacity-70 text-sm">
                Location: {location}
              </p>
              {employeeInfo.mode === 'clock-in' && (
                <>
                  <p className="text-white text-opacity-70 text-sm">
                    Event: {employeeInfo.selectedEventDisplayName || 'General'}
                  </p>
                  <p className="text-white text-opacity-70 text-sm">
                    Clock In Time: {employeeInfo.clockInTime}
                  </p>
                  {employeeInfo.isLate && (
                    <p className="text-red-400 text-sm font-semibold">
                      Late Arrival
                    </p>
                  )}
                </>
              )}
              {employeeInfo.mode === 'clock-out' && (
                <>
                  <p className="text-white text-opacity-70 text-sm">
                    Clock Out Time: {employeeInfo.clockOutTime}
                  </p>
                  <p className="text-white text-opacity-70 text-sm">
                    Hours Worked: {employeeInfo.hoursWorked}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScannerPage;
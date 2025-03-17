// src/components/SuperAdmin/SystemRepair.jsx
import React, { useState, useEffect } from 'react';
import { useSchedulerContext } from '../Scheduler/context/SchedulerContext';
import { ref, get, set } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { 
  Loader2, CheckCircle, AlertCircle, Users, Tools, Database, Calendar, ListChecks
} from 'lucide-react';

const SystemRepair = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [userData, setUserData] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [testEventId, setTestEventId] = useState('');
  const [testLocation, setTestLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const { 
    currentUser, repairUserScheduleNodes, 
    handleCreateEvent, assignToLocation,
    ensureUserScheduleNode
  } = useSchedulerContext();

  // Load users and locations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get users
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const usersData = usersSnapshot.val();
          
          const processedUsers = Object.entries(usersData)
            .map(([id, data]) => ({
              id,
              name: data.profile?.name || 'Unknown User',
              location: data.profile?.primaryLocation || data.profile?.location || 'Unknown Location',
              hasSchedule: Boolean(data.schedule)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          
          setUserData(processedUsers);
          
          // Extract unique locations
          const uniqueLocations = new Set();
          processedUsers.forEach(user => {
            if (user.location && user.location !== 'Unknown Location') {
              uniqueLocations.add(user.location);
            }
          });
          
          setLocations(Array.from(uniqueLocations).sort());
          
          // Set default test location if available
          if (uniqueLocations.size > 0) {
            setTestLocation(Array.from(uniqueLocations)[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, []);

  // Repair all user schedule nodes
  const handleRepairSchedules = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      if (!repairUserScheduleNodes) {
        throw new Error("Repair function not available");
      }
      
      const repairResults = await repairUserScheduleNodes();
      setResults({
        type: 'repair',
        ...repairResults
      });
    } catch (error) {
      setResults({ 
        type: 'repair',
        success: false, 
        message: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  // Fix a single user's schedule node
  const handleFixUserSchedule = async () => {
    if (!selectedUser) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      if (!ensureUserScheduleNode) {
        throw new Error("Repair function not available");
      }
      
      const created = await ensureUserScheduleNode(selectedUser);
      
      setResults({
        type: 'userFix',
        success: true,
        userId: selectedUser,
        created: created
      });
      
      // Update local state
      setUserData(prev => 
        prev.map(user => 
          user.id === selectedUser 
            ? { ...user, hasSchedule: true }
            : user
        )
      );
    } catch (error) {
      setResults({ 
        type: 'userFix',
        success: false, 
        message: error.message,
        userId: selectedUser
      });
    } finally {
      setLoading(false);
    }
  };

  // Create test event and assign to all users in a location
  const handleCreateTestEvent = async () => {
    if (!testLocation) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      // Create test event
      const testEvent = {
        title: `Test Event for ${testLocation}`,
        description: `This is a test event for location: ${testLocation}`,
        location: testLocation,
        start: new Date(),
        end: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
        isUrgent: false
      };
      
      if (!handleCreateEvent) {
        throw new Error("Create event function not available");
      }
      
      const eventId = await handleCreateEvent(testEvent);
      setTestEventId(eventId);
      
      // Assign to location
      if (!assignToLocation) {
        throw new Error("Assign to location function not available");
      }
      
      const assignmentResults = await assignToLocation(eventId, testLocation);
      
      setResults({
        type: 'testEvent',
        success: assignmentResults.success,
        eventId: eventId,
        location: testLocation,
        ...assignmentResults
      });
    } catch (error) {
      setResults({ 
        type: 'testEvent',
        success: false, 
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <Tools className="h-6 w-6 text-blue-500" />
        System Repair Tools
      </h1>
      
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg flex flex-col items-center">
            <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
            <p className="text-white font-medium">Processing your request...</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fix All Users */}
        <div className="bg-slate-800 bg-opacity-40 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-400" />
              Repair All User Schedules
            </h2>
          </div>
          
          <div className="p-4">
            <div className="bg-blue-900 bg-opacity-20 p-4 rounded-lg border border-blue-500/30 text-blue-300 mb-4">
              <p>This tool will ensure all users in the database have a schedule node. This is necessary for event assignment to work properly.</p>
            </div>
            
            <button
              onClick={handleRepairSchedules}
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Tools className="h-4 w-4" />
              Repair All User Schedule Nodes
            </button>
            
            {results && results.type === 'repair' && (
              <div className={`mt-4 p-4 rounded-lg ${
                results.success 
                  ? 'bg-green-900 bg-opacity-20 border border-green-500/30' 
                  : 'bg-red-900 bg-opacity-20 border border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {results.success 
                    ? <CheckCircle className="h-5 w-5 text-green-400" /> 
                    : <AlertCircle className="h-5 w-5 text-red-400" />
                  }
                  <h3 className={`font-medium ${results.success ? 'text-green-300' : 'text-red-300'}`}>
                    {results.success ? 'Repair Successful' : 'Repair Failed'}
                  </h3>
                </div>
                
                {results.success ? (
                  <div className="space-y-1 text-green-200">
                    <p>Checked: {results.checked} users</p>
                    <p>Created: {results.created} schedule nodes</p>
                    <p>Errors: {results.errors?.length || 0}</p>
                  </div>
                ) : (
                  <p className="text-red-300">{results.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Fix Individual User */}
        <div className="bg-slate-800 bg-opacity-40 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              Fix Individual User Schedule
            </h2>
          </div>
          
          <div className="p-4">
            <div className="space-y-4">
              <label className="block">
                <span className="text-white block mb-1">Select User:</span>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white"
                >
                  <option value="">-- Select a user --</option>
                  {userData.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.location}) {!user.hasSchedule ? '- Missing Schedule' : ''}
                    </option>
                  ))}
                </select>
              </label>
              
              <button
                onClick={handleFixUserSchedule}
                disabled={!selectedUser || loading}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Fix User Schedule Node
              </button>
              
              {results && results.type === 'userFix' && (
                <div className={`mt-2 p-3 rounded-lg ${
                  results.success 
                    ? 'bg-green-900 bg-opacity-20 border border-green-500/30' 
                    : 'bg-red-900 bg-opacity-20 border border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {results.success 
                      ? <CheckCircle className="h-5 w-5 text-green-400" /> 
                      : <AlertCircle className="h-5 w-5 text-red-400" />
                    }
                    <div>
                      {results.success ? (
                        <p className="text-green-300">
                          {results.created 
                            ? 'Created new schedule node successfully' 
                            : 'Schedule node already exists'}
                        </p>
                      ) : (
                        <p className="text-red-300">{results.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Create Test Event */}
        <div className="bg-slate-800 bg-opacity-40 border border-slate-700 rounded-lg overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              Test Event Assignment System
            </h2>
          </div>
          
          <div className="p-4">
            <div className="bg-yellow-900 bg-opacity-20 p-4 rounded-lg border border-yellow-500/30 text-yellow-300 mb-4">
              <p>This tool will create a test event and assign it to all users in a specific location. Use this to verify that the event assignment system is working correctly.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-white block mb-1">Select Location:</span>
                <select
                  value={testLocation}
                  onChange={(e) => setTestLocation(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white"
                >
                  <option value="">-- Select a location --</option>
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
              
              <div className="flex items-end">
                <button
                  onClick={handleCreateTestEvent}
                  disabled={!testLocation || loading}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Create Test Event for {testLocation || "selected location"}
                </button>
              </div>
            </div>
            
            {results && results.type === 'testEvent' && (
              <div className={`mt-4 p-4 rounded-lg ${
                results.success 
                  ? 'bg-green-900 bg-opacity-20 border border-green-500/30' 
                  : 'bg-red-900 bg-opacity-20 border border-red-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {results.success 
                    ? <CheckCircle className="h-5 w-5 text-green-400" /> 
                    : <AlertCircle className="h-5 w-5 text-red-400" />
                  }
                  <h3 className={`font-medium ${results.success ? 'text-green-300' : 'text-red-300'}`}>
                    {results.success ? 'Test Successful' : 'Test Failed'}
                  </h3>
                </div>
                
                {results.success ? (
                  <div>
                    <p className="text-green-200 mb-2">
                      Successfully created event <span className="font-mono">{results.eventId}</span> and assigned to users in <strong>{results.location}</strong>.
                    </p>
                    
                    <div className="bg-slate-900 bg-opacity-60 p-3 rounded border border-slate-700 font-mono text-xs text-green-300">
                      <div className="mb-1">Results:</div>
                      <div>- Assigned to {results.assigned?.length || 0} users</div>
                      <div>- Failed for {results.errors?.length || 0} users</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-red-300">{results.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Schedule Verification */}
        <div className="bg-slate-800 bg-opacity-40 border border-slate-700 rounded-lg overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-blue-400" />
              User Schedule Statistics
            </h2>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-700 bg-opacity-40 p-4 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-sm">Total Users</div>
                <div className="text-2xl font-bold text-white mt-1">{userData.length}</div>
              </div>
              
              <div className="bg-slate-700 bg-opacity-40 p-4 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-sm">With Schedule Node</div>
                <div className="text-2xl font-bold text-green-400 mt-1">
                  {userData.filter(u => u.hasSchedule).length}
                </div>
              </div>
              
              <div className="bg-slate-700 bg-opacity-40 p-4 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-sm">Missing Schedule Node</div>
                <div className="text-2xl font-bold text-red-400 mt-1">
                  {userData.filter(u => !u.hasSchedule).length}
                </div>
              </div>
              
              <div className="bg-slate-700 bg-opacity-40 p-4 rounded-lg border border-slate-600">
                <div className="text-gray-400 text-sm">Total Locations</div>
                <div className="text-2xl font-bold text-blue-400 mt-1">{locations.length}</div>
              </div>
            </div>
            
            {userData.filter(u => !u.hasSchedule).length > 0 && (
              <div className="bg-yellow-900 bg-opacity-20 p-4 rounded-lg border border-yellow-500/30 text-yellow-300">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="font-medium">Users Missing Schedule Nodes</h3>
                </div>
                
                <div className="text-sm">
                  There are {userData.filter(u => !u.hasSchedule).length} users missing schedule nodes. Click "Repair All User Schedule Nodes" above to fix this issue.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemRepair;
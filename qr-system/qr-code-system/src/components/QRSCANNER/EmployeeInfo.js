// src/components/QRSCANNER/EmployeeInfo.js
import React from 'react';
import { CheckCircle } from 'lucide-react';

/**
 * Component to display employee information after scanning
 * 
 * @param {Object} props
 * @param {Object} props.employeeInfo - Employee information
 * @param {string} props.location - Selected location
 * @param {Array} props.locations - Available locations
 * @param {Function} props.setLocation - Function to set location
 * @param {Function} props.handleLocationSelected - Function to handle location selection
 * @param {boolean} props.attendanceUpdated - Whether attendance was updated
 * @param {Object} props.selectedEvent - Selected event
 * @param {Function} props.onViewEvents - Function to view employee's events
 */
const EmployeeInfo = ({
  employeeInfo,
  location,
  locations,
  setLocation,
  handleLocationSelected,
  attendanceUpdated,
  selectedEvent,
  onViewEvents
}) => {
  if (!employeeInfo) return null;

  return (
    <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-2xl p-8 mt-8 max-w-lg mx-auto flex flex-col items-center backdrop-blur-md">
      <div className="mb-6">
        <img
          src={employeeInfo.photo || '/api/placeholder/120/120'}
          alt="Employee"
          className="w-32 h-32 rounded-full object-cover border-3 border-blue-500 border-opacity-30 bg-black bg-opacity-20"
        />
      </div>
      <div className="text-center">
        <h2 className="text-2xl text-white mb-2">{employeeInfo.name}</h2>
        <p className="text-white text-opacity-70 mb-2">{employeeInfo.position}</p>

        {employeeInfo.needsLocation && (
          <div className="mt-4 mb-4">
            <p className="text-white text-opacity-70 mb-2">Please select a location:</p>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full p-3 text-base bg-black bg-opacity-5 border border-white border-opacity-10 rounded-lg text-white mb-4 cursor-pointer"
            >
              <option value="">Select Location</option>
              {locations.map((loc) => (
                <option key={loc} value={loc} className="bg-slate-900 text-white">
                  {loc}
                </option>
              ))}
            </select>
            <button
              onClick={handleLocationSelected}
              disabled={!location}
              className={`px-4 py-2 rounded-md ${
                location ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 cursor-not-allowed'
              } text-white transition`}
            >
              Continue with Check-In
            </button>
          </div>
        )}

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

        {attendanceUpdated && selectedEvent && (
          <div className="mt-4 bg-green-500 bg-opacity-20 border border-green-500 border-opacity-30 p-3 rounded-lg flex items-center justify-center gap-2">
            <CheckCircle className="text-green-400 h-5 w-5" />
            <span className="text-green-400">
              Attendance recorded for {selectedEvent.title}
            </span>
          </div>
        )}

        {/* Button to view scheduled events */}
        {employeeInfo.userId && !employeeInfo.needsLocation && (
          <button
            onClick={onViewEvents}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            View Scheduled Events
          </button>
        )}
      </div>
    </div>
  );
};

export default EmployeeInfo;
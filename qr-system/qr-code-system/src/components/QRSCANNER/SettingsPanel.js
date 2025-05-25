// src/components/QRSCANNER/SettingsPanel.js
import React from 'react';
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  RefreshCw,
  List,
  Share2
} from 'lucide-react';

/**
 * Settings panel component for QR Scanner
 * 
 * @param {Object} props
 * @param {string} props.location - Current location
 * @param {Function} props.setLocation - Function to set location
 * @param {Array} props.locations - Available locations
 * @param {string} props.eventType - Current event type
 * @param {Object} props.eventTypes - Available event types
 * @param {Object} props.eventTypeDisplayNames - Display names for event types
 * @param {Function} props.handleEventTypeChange - Function to handle event type change
 * @param {Array} props.meetingTypes - Available meeting types
 * @param {string} props.selectedMeeting - Current selected meeting type
 * @param {Function} props.setSelectedMeeting - Function to set selected meeting type
 * @param {Array} props.scheduledEvents - Scheduled events
 * @param {Object} props.selectedEvent - Selected event
 * @param {Function} props.handleEventSelection - Function to handle event selection
 * @param {string} props.mode - Current mode (clock-in, clock-out)
 * @param {Function} props.handleModeSwitch - Function to handle mode switch
 * @param {Function} props.handleReloadCodes - Function to reload system codes
 * @param {Function} props.handleShowScheduledEvents - Function to show scheduled events
 * @param {Function} props.forceRefreshEvents - Function to force refresh events
 */
const SettingsPanel = ({
  location,
  setLocation,
  locations,
  eventType,
  eventTypes,
  eventTypeDisplayNames,
  handleEventTypeChange,
  meetingTypes,
  selectedMeeting,
  setSelectedMeeting,
  scheduledEvents,
  selectedEvent,
  handleEventSelection,
  mode,
  handleModeSwitch,
  handleReloadCodes,
  handleShowScheduledEvents,
  forceRefreshEvents
}) => {
  return (
    <div className="bg-slate-900 bg-opacity-90 backdrop-blur-xl border border-slate-700 
                    rounded-2xl p-6 shadow-2xl max-w-lg mx-auto mb-8 animate-fadeIn">
      <h2 className="text-2xl text-white mb-6 font-semibold">Scanner Settings</h2>

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="text-white text-opacity-80 font-medium flex items-center gap-2 mb-3">
          <Clock size={18} />
          Clock Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleModeSwitch('clock-in')}
            className={`py-3 rounded-lg text-center ${
              mode === 'clock-in'
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-white text-opacity-70 hover:bg-slate-700'
            }`}
          >
            Clock In
          </button>
          <button
            onClick={() => handleModeSwitch('clock-out')}
            className={`py-3 rounded-lg text-center ${
              mode === 'clock-out'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-white text-opacity-70 hover:bg-slate-700'
            }`}
          >
            Clock Out
          </button>
        </div>
      </div>

      {/* Location Selection */}
      <div className="mb-6">
        <label className="text-white text-opacity-80 font-medium flex items-center gap-2 mb-3">
          <MapPin size={18} />
          Location
        </label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full p-3 text-lg bg-black bg-opacity-30 border border-white border-opacity-10 
                     rounded-lg text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Location</option>
          {locations.map((loc) => (
            <option key={loc} value={loc} className="bg-slate-900 text-white">
              {loc}
            </option>
          ))}
        </select>
      </div>

      {/* Event Type Selection (only for clock-in mode) */}
      {mode === 'clock-in' && (
        <div className="mb-6">
          <label className="text-white text-opacity-80 font-medium flex items-center gap-2 mb-3">
            <Calendar size={18} />
            Event Type
          </label>
          <select
            value={eventType}
            onChange={(e) => handleEventTypeChange(e.target.value)}
            className="w-full p-3 text-lg bg-black bg-opacity-30 border border-white border-opacity-10 
                       rounded-lg text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="bg-slate-900 text-white">
              Choose an event type
            </option>
            {Object.entries(eventTypes).map(([key, value]) => (
              <option key={key} value={value} className="bg-slate-900 text-white">
                {eventTypeDisplayNames[value] || value}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Meeting Type Selection (only if event type is MEETINGS and clock-in mode) */}
      {mode === 'clock-in' && eventType === eventTypes.MEETINGS && (
        <div className="mb-6">
          <label className="text-white text-opacity-80 font-medium flex items-center gap-2 mb-3">
            <Users size={18} />
            Meeting Type
          </label>
          <select
            value={selectedMeeting}
            onChange={(e) => setSelectedMeeting(e.target.value)}
            className="w-full p-3 text-lg bg-black bg-opacity-30 border border-white border-opacity-10 
                       rounded-lg text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Meeting Type</option>
            {meetingTypes.map((type) => (
              <option key={type} value={type} className="bg-slate-900 text-white">
                {type}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scheduled Events */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="text-white text-opacity-80 font-medium flex items-center gap-2">
            <List size={18} />
            Scheduled Events
          </label>
          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {scheduledEvents.length} today
          </span>
        </div>
        <button
          onClick={handleShowScheduledEvents}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2"
          disabled={!location}
        >
          <Calendar size={18} />
          Show Today's Events
        </button>
      </div>

      {/* Force Refresh Events */}
      <div className="mb-6">
        <button
          onClick={forceRefreshEvents}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2"
          disabled={!location}
        >
          <Share2 size={18} />
          Force Fetch Today's Events
        </button>
        <p className="text-xs text-gray-400 mt-1 text-center">
          Directly query database for events
        </p>
      </div>

      {/* Reload System Codes */}
      <div className="mb-2">
        <button
          onClick={handleReloadCodes}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          Reload System Codes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
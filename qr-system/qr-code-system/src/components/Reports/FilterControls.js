import React from 'react';
import { Search, MapPin, Filter, X } from 'lucide-react';

const FilterControls = ({
  searchTerm,
  setSearchTerm,
  locations,
  selectedLocation,
  handleLocationChange,
  eventTypes,
  selectedEventType,
  handleEventTypeChange,
  clearAllFilters
}) => {
  // Make sure handleLocationChange and handleEventTypeChange are properly handled
  const onLocationChange = (e) => {
    if (typeof handleLocationChange === 'function') {
      handleLocationChange(e);
    } else {
      console.warn('handleLocationChange is not a function');
    }
  };

  const onEventTypeChange = (e) => {
    if (typeof handleEventTypeChange === 'function') {
      handleEventTypeChange(e);
    } else {
      console.warn('handleEventTypeChange is not a function');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Search */}
      <div className="glass-card p-3 flex items-center">
        <Search className="text-gray-400 w-5 h-5 mr-2" />
        <input
          type="text"
          value={searchTerm || ''}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search employees..."
          className="bg-transparent border-none text-white flex-grow focus:outline-none"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="text-gray-400 hover:text-white"
            type="button"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* Location filter */}
      {locations && locations.length > 0 && (
        <div className="glass-card p-3 flex items-center">
          <MapPin className="text-sky-400 w-5 h-5 mr-2" />
          <select
            value={selectedLocation || 'all'}
            onChange={onLocationChange}
            className="bg-transparent border-none text-white w-full focus:outline-none"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* Event Type filter */}
      {eventTypes && eventTypes.length > 0 && (
        <div className="glass-card p-3 flex items-center">
          <Filter className="text-sky-400 w-5 h-5 mr-2" />
          <select
            value={selectedEventType || 'all'}
            onChange={onEventTypeChange}
            className="bg-transparent border-none text-white w-full focus:outline-none"
          >
            <option value="all">All Event Types</option>
            {eventTypes.map(type => (
              <option key={type.id} value={type.id}>{type.displayName}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default FilterControls;
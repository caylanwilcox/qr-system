import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

const TimeFilter = ({ timeFilter, onTimeFilterChange }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Handle time filter change
  const handleFilterChange = (type) => {
    // If already selected, do nothing
    if (type === timeFilter.type) return;

    // Create today's date in ISO format
    const today = new Date().toISOString().split('T')[0];
    
    // Create a date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString().split('T')[0];
    
    // Create a date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

    // Set appropriate date range based on filter type
    let dateRange = { start: '', end: '' };
    
    if (type === '7d') {
      dateRange = { start: sevenDaysAgoISO, end: today };
    } else if (type === '30d') {
      dateRange = { start: thirtyDaysAgoISO, end: today };
    } else if (type === 'range') {
      // For range, keep existing date range or set default of last 7 days
      dateRange = timeFilter.dateRange && timeFilter.dateRange.start 
        ? timeFilter.dateRange 
        : { start: sevenDaysAgoISO, end: today };
    }

    // Update the filter
    onTimeFilterChange({
      type,
      dateRange
    });
  };

  // Handle date range change
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    
    onTimeFilterChange({
      ...timeFilter,
      dateRange: {
        ...timeFilter.dateRange,
        [name]: value
      }
    });
  };

  return (
    <div className="time-filter">
      <div className="filter-header">
        <Calendar className="h-4 w-4" />
        <h3>Time Period</h3>
      </div>

      <div className="filter-options">
        <button 
          className={`filter-btn ${timeFilter.type === '24h' ? 'active' : ''}`}
          onClick={() => handleFilterChange('24h')}
        >
          Today
        </button>
        <button 
          className={`filter-btn ${timeFilter.type === '7d' ? 'active' : ''}`}
          onClick={() => handleFilterChange('7d')}
        >
          Last 7 Days
        </button>
        <button 
          className={`filter-btn ${timeFilter.type === '30d' ? 'active' : ''}`}
          onClick={() => handleFilterChange('30d')}
        >
          Last 30 Days
        </button>
        <button 
          className={`filter-btn ${timeFilter.type === 'range' ? 'active' : ''}`}
          onClick={() => {
            handleFilterChange('range');
            setShowDatePicker(true);
          }}
        >
          Custom Range
        </button>
      </div>

      {timeFilter.type === 'range' && (
        <div className="date-range-picker">
          <div className="date-input-group">
            <label>Start Date:</label>
            <input
              type="date"
              name="start"
              value={timeFilter.dateRange.start}
              onChange={handleDateChange}
              max={timeFilter.dateRange.end || undefined}
            />
          </div>
          <div className="date-input-group">
            <label>End Date:</label>
            <input
              type="date"
              name="end"
              value={timeFilter.dateRange.end}
              onChange={handleDateChange}
              min={timeFilter.dateRange.start || undefined}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}

      {timeFilter.type === 'range' && timeFilter.dateRange.start && timeFilter.dateRange.end && (
        <div className="selected-range">
          Showing data from {formatDate(timeFilter.dateRange.start)} to {formatDate(timeFilter.dateRange.end)}
        </div>
      )}
    </div>
  );
};

export default TimeFilter;
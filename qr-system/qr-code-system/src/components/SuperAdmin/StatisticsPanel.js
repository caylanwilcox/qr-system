'use client';
import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

// We'll reuse your "calculateFraction" approach inside if needed
// or let the container pass in a function. 
// We'll keep it simple here.

export default function StatisticsPanel({
  activeTab,
  locationMap,
  metrics,
  timeFilter,
  setTimeFilter,
  onTabClick,
  onStatClick,
}) {
  const handleTimeFilterChange = (type) => {
    setTimeFilter((prev) => ({
      ...prev,
      type,
      dateRange: type === '24h' ? { start: '', end: '' } : prev.dateRange,
    }));
  };

  const handleDateChange = (field, val) => {
    setTimeFilter((prev) => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: val },
    }));
  };

  const isAll = activeTab === 'All';
  const locationData = isAll
    ? metrics.total
    : metrics.perLocation[locationMap[activeTab]] || {
        notClockedIn: 0,
        clockedIn: 0,
        onTime: 0,
        late: 0,
      };

  // Just a helper for fraction
  function calcFraction(numerator, denominator) {
    if (!denominator || denominator === 0) return '0.00';
    const val = (numerator / denominator) * 100;
    return isNaN(val) ? '0.00' : val.toFixed(2);
  }

  // Example click handlers for stats
  const handleClickAbsent = () => onStatClick && onStatClick('absent');
  const handleClickLate = () => onStatClick && onStatClick('late');
  // etc.

  return (
    <div className="quadrant quadrant-2">
      {/* LOCATION TABS */}
      <nav className="quadrant-nav">
        <ul>
          {Object.keys(locationMap).map((tabName) => (
            <li
              key={tabName}
              onClick={() => onTabClick(tabName)}
              className={`nav-item ${activeTab === tabName ? 'active' : ''}`}
            >
              {tabName}
            </li>
          ))}
        </ul>
      </nav>

      {/* TIME FILTER */}
      <div className="filter-options">
        <button
          onClick={() => handleTimeFilterChange('24h')}
          className={`filter-btn ${timeFilter.type === '24h' ? 'active' : ''}`}
        >
          <Clock className="h-4 w-4 mr-2" />
          Last 24 Hours
        </button>
        <button
          onClick={() => handleTimeFilterChange('range')}
          className={`filter-btn ${timeFilter.type === 'range' ? 'active' : ''}`}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Date Range
        </button>

        {timeFilter.type === 'range' && (
          <div className="date-range-inputs">
            <input
              type="date"
              value={timeFilter.dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="date-input"
            />
            <input
              type="date"
              value={timeFilter.dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="date-input"
            />
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="quadrant-inside">
        {/* Absent */}
        <div className="metric-box total-absent" onClick={handleClickAbsent}>
          <h3>{isAll ? 'Total Absent' : `${activeTab} - Absent`}</h3>
          <div className="metric-content">
            <p className="metric-number large warning">
              {locationData.notClockedIn}
            </p>
          </div>
        </div>

        <div className="metrics-grid">
          {/* Present */}
          <div className="metric-box">
            <h3>Total Present</h3>
            <div className="metric-content">
              <p className="metric-number success">{locationData.clockedIn}</p>
            </div>
          </div>

          {/* Late (clickable) */}
          <div className="metric-box" onClick={handleClickLate}>
            <h3>Late</h3>
            <div className="metric-content">
              <p className="metric-number warning">{locationData.late}</p>
            </div>
          </div>

          {/* % On Time */}
          <div className="metric-box">
            <h3>% On Time</h3>
            <div className="metric-content">
              <p className="metric-number success">
                {calcFraction(locationData.onTime, locationData.clockedIn)}%
              </p>
            </div>
          </div>

          {/* % Present */}
          <div className="metric-box">
            <h3>% Present</h3>
            <div className="metric-content">
              <p className="metric-number success">
                {calcFraction(
                  locationData.clockedIn,
                  locationData.clockedIn + locationData.notClockedIn
                )}
                %
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

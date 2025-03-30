'use client';
import React from 'react';
import { Clock, Calendar } from 'lucide-react';
import './TimeFilter.css';

const TimeFilter = ({
  timeFilter,
  onTimeFilterChange,
  onDateRangeChange,
}) => {
  if (!timeFilter) {
    return <div className="time-filter">Loading filter options...</div>;
  }

  return (
    <div className="time-filter">
      <button
        onClick={() => onTimeFilterChange('24h')}
        className={`filter-btn ${timeFilter.type === '24h' ? 'active' : ''}`}
      >
        <Clock className="h-4 w-4 mr-2" />
        Últimas 24 horas
      </button>
      
      <button
        onClick={() => onTimeFilterChange('range')}
        className={`filter-btn ${timeFilter.type === 'range' ? 'active' : ''}`}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Rango de Fechas
      </button>
      
      {timeFilter.type === 'range' && (
        <div className="date-inputs">
          <input
            type="date"
            value={timeFilter.dateRange.start}
            onChange={(e) => onDateRangeChange('start', e.target.value)}
            max={timeFilter.dateRange.end || undefined}
            aria-label="Fecha de inicio"
          />
          <input
            type="date"
            value={timeFilter.dateRange.end}
            onChange={(e) => onDateRangeChange('end', e.target.value)}
            min={timeFilter.dateRange.start || undefined}
            aria-label="Fecha final"
          />
        </div>
      )}
    </div>
  );
};

export default TimeFilter;
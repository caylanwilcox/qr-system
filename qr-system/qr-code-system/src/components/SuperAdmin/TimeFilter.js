'use client';
import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import './TimeFilter.css';

const TimeFilter = ({
  timeFilter,
  onTimeFilterChange,
  onDateRangeChange,
}) => {
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
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Rango de Fechas
      </button>

      {timeFilter.type === 'range' && (
        <div className="date-inputs">
          <input
            type="date"
            value={timeFilter.dateRange.start}
            onChange={(e) => onDateRangeChange('start', e.target.value)}
            max={timeFilter.dateRange.end || undefined}
          />
          <input
            type="date"
            value={timeFilter.dateRange.end}
            onChange={(e) => onDateRangeChange('end', e.target.value)}
            min={timeFilter.dateRange.start || undefined}
          />
        </div>
      )}
    </div>
  );
};

export default TimeFilter;

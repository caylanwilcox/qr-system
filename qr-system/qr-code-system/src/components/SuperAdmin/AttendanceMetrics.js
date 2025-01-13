import React from 'react';
import { Users } from 'lucide-react';

const AttendanceMetrics = ({ 
  metrics, 
  activeTab, 
  locationMetrics,
  filteredEmployees 
}) => {
  // Get count of currently clocked in users for the active location
  const clockedInCount = filteredEmployees.filter(employee => {
    if (activeTab === "All") return true;
    return employee.location.includes(activeTab);
  }).length;

  // Get total users for the active location
  const getTotalForLocation = () => {
    if (activeTab === "All") {
      return metrics.total.totalMembers;
    }
    return locationMetrics?.totalMembers || 0;
  };

  return (
    <div className="metrics-grid grid-cols-2">
      {/* Clocked In Stats */}
      <div className="metric-box">
        <h3>Currently Clocked In</h3>
        <div className="metric-content">
          <p className="metric-number large text-blue-400">
            {clockedInCount}
          </p>
        </div>
      </div>

      {/* Total Members Stats */}
      <div className="metric-box">
        <h3>Total Members</h3>
        <div className="metric-content">
          <p className="metric-number success">
            {getTotalForLocation()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceMetrics;
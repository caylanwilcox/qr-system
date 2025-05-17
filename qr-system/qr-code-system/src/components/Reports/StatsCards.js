import React from 'react';
import { User, Users, Clock, TrendingUp } from 'lucide-react';

const StatsCards = ({ 
  overallStats,
  filteredReports,
  setFilteredReports,
  employeeReports,
  handleTotalClockInsClick
}) => {
  // Handle clicking on Total Members - show all users
  const handleTotalMembersClick = () => {
    // Reset to show all employees
    setFilteredReports(employeeReports);
  };
  
  // Handle clicking on Active Padrinos - filter to only show padrinos
  const handleActivePadrinosClick = () => {
    // Filter for users with padrino = true or role = 'padrino'
    const padrinosOnly = employeeReports.filter(report => 
      report.isPadrino && report.status !== 'inactive'
    );
    
    setFilteredReports(padrinosOnly);
  };

  // Handle Total Clock-ins click - make sure it's properly passed
  const onTotalClockInsClick = () => {
    if (typeof handleTotalClockInsClick === 'function') {
      handleTotalClockInsClick();
    } else {
      console.warn('handleTotalClockInsClick is not a function');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Card 1: Total Members */}
      <div
        className="glass-card p-4 rounded-xl cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={handleTotalMembersClick}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-slate-300 text-sm">Total Members</h3>
          <User className="text-sky-400 w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-sky-400 mt-2">
          {overallStats.totalMembers}
        </p>
      </div>

      {/* Card 2: Active Padrinos */}
      <div
        className="glass-card p-4 rounded-xl cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={handleActivePadrinosClick}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-slate-300 text-sm">Active Padrinos</h3>
          <Users className="text-sky-400 w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-sky-400 mt-2">
          {overallStats.activePadrinos}
        </p>
      </div>

      {/* Card 3: Total Clock-ins */}
      <div 
        className="glass-card p-4 rounded-xl cursor-pointer hover:bg-slate-700/20 transition-colors"
        onClick={onTotalClockInsClick}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-slate-300 text-sm">Total Clock-ins</h3>
          <Clock className="text-sky-400 w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-sky-400 mt-2">
          {overallStats.totalClockIns}
        </p>
      </div>

      {/* Card 4: Average Attendance */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-slate-300 text-sm">Average Attendance</h3>
          <TrendingUp className="text-sky-400 w-5 h-5" />
        </div>
        <p className="text-2xl font-bold text-sky-400 mt-2">
          {overallStats.avgAttendance}%
        </p>
      </div>
    </div>
  );
};

export default StatsCards;
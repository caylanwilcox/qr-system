// src/components/EmployeeProfile/StatsSection.js
import React from 'react';
import { Activity, Clock, Calendar, TrendingUp, Users, ChartBar } from 'lucide-react';

const getScoreClass = (score) => {
  const numScore = parseFloat(score);
  if (numScore >= 95) return 'text-emerald-400';
  if (numScore >= 85) return 'text-green-400';
  if (numScore >= 75) return 'text-teal-400';
  if (numScore >= 65) return 'text-yellow-400';
  if (numScore >= 55) return 'text-orange-400';
  if (numScore >= 45) return 'text-red-400';
  return 'text-red-600';
};

const StatsSection = ({ employeeDetails }) => {
  // Extract stats from employee details
  const stats = employeeDetails?.stats || {};
  const locationHistory = employeeDetails?.locationHistory || [];

  // Calculate attendance rate
  const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
  const attendanceRate = totalDays ? ((stats.daysPresent || 0) / totalDays * 100).toFixed(1) : 0;
  
  // Calculate days late rate
  const daysLateRate = stats.daysPresent ? ((stats.daysLate || 0) / stats.daysPresent * 100).toFixed(1) : 0;
  
  // Convert total hours to a readable format
  const totalHours = stats.totalHours ? Math.round(stats.totalHours) : 0;
  
  // Format last clock in/out times
  const lastClockIn = stats.lastClockIn ? new Date(stats.lastClockIn).toLocaleString() : 'N/A';
  const lastClockOut = stats.lastClockOut ? new Date(stats.lastClockOut).toLocaleString() : 'N/A';

  const statItems = [
    {
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      title: 'Attendance Rate',
      value: `${attendanceRate}%`,
      scoreClass: getScoreClass(attendanceRate),
      period: 'Overall'
    },
    {
      icon: <Clock className="w-5 h-5 text-purple-400" />,
      title: 'On-Time Rate',
      value: `${(100 - daysLateRate).toFixed(1)}%`,
      scoreClass: getScoreClass(100 - daysLateRate),
      period: 'Overall'
    },
    {
      icon: <Calendar className="w-5 h-5 text-green-400" />,
      title: 'Days Present',
      value: stats.daysPresent || 0,
      period: 'Total'
    },
    {
      icon: <ChartBar className="w-5 h-5 text-yellow-400" />,
      title: 'Total Hours',
      value: totalHours,
      period: 'Accumulated'
    }
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white/90">Performance Statistics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
        {statItems.map((stat, index) => (
          <div 
            key={index}
            className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-lg p-4
                     hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="flex items-center gap-3 mb-3">
              {stat.icon}
              <h3 className="text-sm font-medium text-white/70">{stat.title}</h3>
            </div>
            <div className={`font-mono text-2xl font-semibold mb-2 ${stat.scoreClass || 'text-white/90'}`}>
              {stat.value}
            </div>
            <div className="text-xs text-white/50">{stat.period}</div>
            {stat.scoreClass && (
              <div className={`mt-2 text-xs px-2 py-1 rounded-full ${
                parseFloat(stat.value) >= 75 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : parseFloat(stat.value) >= 50 
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {parseFloat(stat.value) >= 75 ? 'Good' : 
                 parseFloat(stat.value) >= 50 ? 'Average' : 'Needs Improvement'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Additional Insights */}
      <div className="grid md:grid-cols-2 gap-6 p-6 border-t border-slate-700">
        {/* Attendance Details */}
        <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Attendance Overview</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-white/50 mb-1">Present</div>
              <div className="font-mono text-lg font-medium text-white/90">
                {stats.daysPresent || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Late</div>
              <div className="font-mono text-lg font-medium text-red-400">
                {stats.daysLate || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Absent</div>
              <div className="font-mono text-lg font-medium text-orange-400">
                {stats.daysAbsent || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Recent Activity</h4>
          <div className="space-y-3">
            {stats.lastClockIn && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Last clock in: {lastClockIn}</span>
              </div>
            )}
            {stats.lastClockOut && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-green-400" />
                <span>Last clock out: {lastClockOut}</span>
              </div>
            )}
            {locationHistory.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Users className="w-4 h-4 text-purple-400" />
                <span>
                  Current location: {locationHistory[0].locationId}
                  <span className="text-xs text-white/50 ml-2">
                    (since {new Date(locationHistory[0].date).toLocaleDateString()})
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSection;
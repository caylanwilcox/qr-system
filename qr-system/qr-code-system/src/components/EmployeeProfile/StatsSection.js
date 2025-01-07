import React from 'react';
import { Activity, Clock, Calendar, TrendingUp } from 'lucide-react';

const getScoreClass = (score) => {
  if (score >= 95) return 'text-emerald-400 glow-emerald';
  if (score >= 85) return 'text-green-400 glow-green';
  if (score >= 75) return 'text-teal-400 glow-teal';
  if (score >= 65) return 'text-yellow-400 glow-yellow';
  if (score >= 55) return 'text-orange-400 glow-orange';
  if (score >= 45) return 'text-red-400 glow-red';
  return 'text-red-600 glow-red-deep';
};

const StatsSection = ({ stats }) => {
  const statItems = [
    {
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      title: 'Attendance Rate',
      value: `${stats.attendanceRate}%`,
      scoreClass: getScoreClass(stats.attendanceRate),
      period: 'Last 30 Days'
    },
    {
      icon: <Clock className="w-5 h-5 text-purple-400" />,
      title: 'On-Time Rate',
      value: `${stats.punctualityRate}%`,
      scoreClass: getScoreClass(stats.punctualityRate),
      period: 'Last 30 Days'
    },
    {
      icon: <Calendar className="w-5 h-5 text-green-400" />,
      title: 'Total Hours',
      value: `${stats.totalHours}h`,
      period: 'Month to Date'
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-yellow-400" />,
      title: 'Average Hours/Day',
      value: `${stats.avgHoursPerDay}h`,
      period: 'Last 30 Days'
    }
  ];

  return (
    <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-glass-light">
        <h2 className="text-lg font-semibold text-white/90">Performance Statistics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
        {statItems.map((stat, index) => (
          <div 
            key={index}
            className="bg-glass-dark backdrop-blur border border-glass-light rounded-lg p-4
                     hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="flex items-center gap-3 mb-3">
              {stat.icon}
              <h3 className="text-sm font-medium text-white/70">{stat.title}</h3>
            </div>
            <div className={`font-mono text-2xl font-semibold mb-2 ${stat.scoreClass}`}>
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

      {/* Trends Section */}
      <div className="grid md:grid-cols-2 gap-6 p-6 border-t border-glass-light">
        {/* Monthly Comparison */}
        <div className="bg-glass-dark backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Monthly Comparison</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-white/50 mb-1">Previous Month</div>
              <div className="font-mono text-lg font-medium text-white/90">
                {stats.previousMonthHours || '0'}h
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Current Month</div>
              <div className="font-mono text-lg font-medium text-white/90">
                {stats.totalHours}h
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Change</div>
              <div className={`font-mono text-lg font-medium ${
                stats.hoursChange > 0 ? 'text-emerald-400' : 
                stats.hoursChange < 0 ? 'text-red-400' : 'text-white/90'
              }`}>
                {stats.hoursChange > 0 ? '+' : ''}
                {stats.hoursChange || '0'}%
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Insights */}
        <div className="bg-glass-dark backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Quick Insights</h4>
          <div className="space-y-3">
            {stats.perfectStreak > 0 && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-glass p-2 rounded-lg">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>
                  {stats.perfectStreak} day{stats.perfectStreak !== 1 ? 's' : ''} perfect attendance streak
                </span>
              </div>
            )}
            
            {stats.earlyArrivalRate && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-glass p-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>
                  Arrives early {stats.earlyArrivalRate}% of the time
                </span>
              </div>
            )}

            {stats.mostActiveDay && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-glass p-2 rounded-lg">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>
                  Most active on {stats.mostActiveDay}s
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
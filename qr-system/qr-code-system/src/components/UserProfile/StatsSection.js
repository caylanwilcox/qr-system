// src/components/UserProfile/StatsSection.js
import React from 'react';
import { Activity, Clock, Calendar, ChartBar, Users } from 'lucide-react';

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
// src/components/StatsSection.js
// Add this at the top of the file
const DEBUG_PREFIX = '🔍 [StatsSection]';

// Replace the loadEmployeeData function with this enhanced version
const loadEmployeeData = useCallback(async (forceRefresh = false) => {
  console.log(`${DEBUG_PREFIX} loadEmployeeData called with forceRefresh=${forceRefresh}`);
  console.log(`${DEBUG_PREFIX} employeeDetails=${!!employeeDetails}, employeeId=${employeeId}`);
  
  // If employeeDetails was provided directly, use it
  if (employeeDetails && !forceRefresh) {
    console.log(`${DEBUG_PREFIX} Using provided employeeDetails`, employeeDetails);
    setEmployeeData(employeeDetails);
    return;
  }
  
  // If we have an ID but no details, or force refresh is requested
  if (employeeId) {
    setLoading(true);
    try {
      console.log(`${DEBUG_PREFIX} Fetching user data for ID=${employeeId} with forceRefresh=${forceRefresh}`);
      const userData = await dataService.fetchUser(employeeId, forceRefresh);
      console.log(`${DEBUG_PREFIX} Fetched user data:`, userData ? 'SUCCESS' : 'NULL');
      
      if (userData) {
        console.log(`${DEBUG_PREFIX} User data details:`, {
          hasStats: !!userData.stats,
          hasEvents: !!userData.events,
          eventTypes: userData.events ? Object.keys(userData.events) : []
        });
        setEmployeeData(userData);
      } else {
        console.error(`${DEBUG_PREFIX} No user data returned for ID=${employeeId}`);
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error loading employee data:`, error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  } else {
    console.warn(`${DEBUG_PREFIX} No employeeId provided, cannot fetch data`);
  }
}, [employeeDetails, employeeId]);

// Enhance the event subscription with better logging
useEffect(() => {
  if (!employeeId && !employeeDetails?.id) {
    console.log(`${DEBUG_PREFIX} No user ID available, not setting up listener`);
    return;
  }
  
  const userId = employeeId || employeeDetails?.id;
  console.log(`${DEBUG_PREFIX} Setting up USER_DATA_UPDATED listener for user ${userId}`);
  
  const unsubscribe = eventBus.subscribe(EVENTS.USER_DATA_UPDATED, (data) => {
    console.log(`${DEBUG_PREFIX} Received USER_DATA_UPDATED event:`, data);
    
    // Only refresh if this event is for our user
    if (data.userId === userId) {
      console.log(`${DEBUG_PREFIX} Event matches our userId=${userId}, triggering refresh`);
      loadEmployeeData(true);
    } else {
      console.log(`${DEBUG_PREFIX} Event for userId=${data.userId} doesn't match our userId=${userId}, ignoring`);
    }
  });
  
  // Also listen for ATTENDANCE_UPDATED events as they might be relevant
  const unsubscribeAttendance = eventBus.subscribe(EVENTS.ATTENDANCE_UPDATED, (data) => {
    console.log(`${DEBUG_PREFIX} Received ATTENDANCE_UPDATED event:`, data);
    
    if (data.userId === userId) {
      console.log(`${DEBUG_PREFIX} Attendance event matches our userId=${userId}, triggering refresh`);
      loadEmployeeData(true);
    }
  });
  
  return () => {
    unsubscribe();
    unsubscribeAttendance();
    console.log(`${DEBUG_PREFIX} Unsubscribed from events for userId=${userId}`);
  };
}, [employeeId, employeeDetails?.id, loadEmployeeData]);

// Add debug logging to the handleRefresh function
const handleRefresh = () => {
  console.log(`${DEBUG_PREFIX} Manual refresh triggered`);
  loadEmployeeData(true);
  if (onRefresh) {
    console.log(`${DEBUG_PREFIX} Calling parent onRefresh callback`);
    onRefresh();
  }
};

// Add logging to the render section
// Before rendering stats, add:
console.log(`${DEBUG_PREFIX} Rendering with data:`, {
  loading,
  hasEmployeeData: !!employeeData,
  statsAvailable: !!(employeeData?.stats),
  eventsAvailable: !!(employeeData?.events)
});

// Add logging for each event category count
if (employeeData?.events) {
  Object.entries(employeeData.events).forEach(([category, events]) => {
    console.log(`${DEBUG_PREFIX} Event category ${category}:`, {
      total: Object.keys(events || {}).length,
      scheduled: Object.values(events || {}).filter(e => e.scheduled).length,
      attended: Object.values(events || {}).filter(e => e.attended).length,
      pending: Object.values(events || {}).filter(e => e.scheduled && !e.attended && !e.markedAbsent).length
    });
  });
}
const TimelineBox = ({ isAttended, date, tooltipContent }) => (
  <div 
    className={`w-6 h-6 border relative group ${
      isAttended 
        ? 'bg-green-500/20 border-green-500/30 text-green-400' 
        : 'bg-slate-800/50 border-slate-700/30 text-slate-600'
    } flex items-center justify-center text-xs rounded-md`}
  >
    {isAttended ? '✓' : 'X'}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
      {tooltipContent}
    </div>
  </div>
);

const RegistrySection = ({ title, events = [], total = 0 }) => (
  <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
    <div className="flex justify-between items-center mb-4">
      <h4 className="text-sm font-medium text-white/80">{title}</h4>
      <span className="text-xs text-white/50">
        Attendance: {((events.filter(e => e.attended).length / total) * 100).toFixed(1)}%
      </span>
    </div>
    <div className="flex gap-2 flex-wrap">
      {Array.from({ length: total }).map((_, index) => {
        const event = events[index] || {};
        const tooltipContent = event.date 
          ? `${new Date(event.date).toLocaleDateString()}: ${event.attended ? 'Attended' : 'Missed'}`
          : 'Not scheduled yet';
        
        return (
          <TimelineBox 
            key={index}
            isAttended={event.attended || false}
            date={event.date}
            tooltipContent={tooltipContent}
          />
        );
      })}
    </div>
  </div>
);

const StatsSection = ({ userDetails }) => {
  const stats = userDetails?.stats || {};
  const events = userDetails?.events || {};
  const locationHistory = userDetails?.locationHistory || [];

  const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
  const attendanceRate = totalDays ? ((stats.daysPresent || 0) / totalDays * 100).toFixed(1) : 0;
  const daysLateRate = stats.daysPresent ? ((stats.daysLate || 0) / stats.daysPresent * 100).toFixed(1) : 0;
  const totalHours = stats.totalHours ? Math.round(stats.totalHours) : 0;
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

  const attendanceStats = [
    {
      title: "Workshops",
      data: events.workshops || [],
      total: 12
    },
    {
      title: "Group Meetings",
      data: events.meetings || [],
      total: 4
    },
    {
      title: "Haciendas",
      data: events.haciendas || [],
      total: 52
    }
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white/90">My Statistics</h2>
      </div>

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

      <div className="p-6 space-y-6 border-t border-slate-700">
        {attendanceStats.map((section, index) => (
          <RegistrySection
            key={index}
            title={section.title}
            events={section.data}
            total={section.total}
          />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 p-6 border-t border-slate-700">
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
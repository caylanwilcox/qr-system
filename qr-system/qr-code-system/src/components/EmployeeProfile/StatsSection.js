import React from 'react';
import {
  Activity,
  Clock,
  Calendar,
  TrendingUp,
  Users,
  ChartBar,
  CheckSquare,
  XSquare
} from 'lucide-react';
import moment from 'moment-timezone';

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

const TimelineBox = ({
  isAttended,
  date,
  tooltipContent,
  isScheduled,
  attendanceStatus,
  eventDate
}) => {
  let backgroundClass = '';
  let borderClass = '';
  let textClass = '';
  let icon = null;

  if (isScheduled) {
    // Event is scheduled for this person
    if (attendanceStatus === 'pending') {
      // Pending attendance (orange)
      backgroundClass = 'bg-orange-500/20';
      borderClass = 'border-orange-500/30';
      textClass = 'text-orange-400';
      icon = <Clock className="w-4 h-4" />;
    } else if (isAttended) {
      // Attended (green checkmark)
      backgroundClass = 'bg-green-500/20';
      borderClass = 'border-green-500/30';
      textClass = 'text-green-400';
      icon = <CheckSquare className="w-4 h-4" />;
    } else {
      // Absent (red X)
      backgroundClass = 'bg-red-500/20';
      borderClass = 'border-red-500/30';
      textClass = 'text-red-400';
      icon = <XSquare className="w-4 h-4" />;
    }
  } else {
    // Not scheduled (gray)
    backgroundClass = 'bg-slate-800/50';
    borderClass = 'border-slate-700/30';
    textClass = 'text-slate-600';
    icon = null;
  }

  // Format event date for display beneath the box
  const displayDate = eventDate ? moment(eventDate).format('DD/MM') : '';

  return (
    <div className="flex flex-col items-center mb-1">
      <div
        className={`w-6 h-6 border relative group ${backgroundClass} ${borderClass} ${textClass}
          flex items-center justify-center text-xs rounded-md`}
      >
        {icon ||
          (isScheduled
            ? isAttended
              ? '✓'
              : attendanceStatus === 'pending'
              ? '⏱'
              : '✗'
            : '-')}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
          px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100
          transition pointer-events-none whitespace-nowrap z-10"
        >
          {tooltipContent}
        </div>
      </div>
      {displayDate && <div className="text-xs text-slate-400 mt-1">{displayDate}</div>}
    </div>
  );
};

const RegistrySection = ({ title, events = [], total = 0, eventType }) => {
  // Ensure events is always an array
  const eventsArray = Array.isArray(events) ? events : [];

  // Calculate attendance percentage based on scheduled events only
  const scheduledEvents = eventsArray.filter((e) => e.scheduled);
  const pendingEvents = scheduledEvents.filter(
    (e) => e.scheduled && !e.attended && !e.markedAbsent
  );

  // Only count non-pending events for the percentage calculation
  const nonPendingEvents = scheduledEvents.filter(
    (e) => e.attended !== undefined || e.markedAbsent
  );
  const attendancePercentage =
    nonPendingEvents.length > 0
      ? (
          (nonPendingEvents.filter((e) => e.attended).length /
            nonPendingEvents.length) *
          100
        ).toFixed(1)
      : 0;

  return (
    <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-white/80">{title}</h4>
        <div className="flex items-center gap-2">
          {pendingEvents.length > 0 && (
            <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">
              {pendingEvents.length} Pending
            </span>
          )}
          <span className="text-xs text-white/50">Attendance: {attendancePercentage}%</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: total }).map((_, index) => {
          const event = eventsArray[index] || {};

          // Determine attendance status
          let attendanceStatus = 'none';
          if (event.scheduled) {
            if (event.attended === true) {
              attendanceStatus = 'attended';
            } else if (event.markedAbsent === true || event.attended === false) {
              attendanceStatus = 'absent';
            } else {
              attendanceStatus = 'pending';
            }
          }

          // Show a tooltip that includes the event’s date, attendance status, etc.
          const displayedEventType = event.eventType || eventType;
          const tooltipContent = event.date
            ? `${moment(event.date).format('MMM D, YYYY')}: ${
                event.scheduled
                  ? attendanceStatus === 'pending'
                    ? 'Pending attendance'
                    : attendanceStatus === 'attended'
                    ? 'Attended'
                    : 'Absent'
                  : 'Not scheduled'
              }${
                event.title ? ` - ${event.title}` : ''
              }${displayedEventType ? ` (${displayedEventType})` : ''}`
            : 'Not scheduled yet';

          return (
            <TimelineBox
              key={index}
              isAttended={event.attended || false}
              isScheduled={event.scheduled || false}
              attendanceStatus={attendanceStatus}
              date={event.date}
              eventDate={event.date}
              tooltipContent={tooltipContent}
            />
          );
        })}
      </div>
    </div>
  );
};

const StatsSection = ({ employeeDetails }) => {
  // Basic stats & user info
  const stats = employeeDetails?.stats || {};
  const events = employeeDetails?.events || {};
  const locationHistory = employeeDetails?.locationHistory || [];

  // Calculate attendance rate
  const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
  const attendanceRate = totalDays
    ? ((stats.daysPresent || 0) / totalDays) * 100
    : 0;
  const attendanceRateStr = attendanceRate.toFixed(1);

  // Calculate days late rate
  const daysLateRate = stats.daysPresent
    ? ((stats.daysLate || 0) / stats.daysPresent) * 100
    : 0;
  const daysLateRateStr = daysLateRate.toFixed(1);

  // Convert total hours to a readable format
  const totalHours = stats.totalHours ? Math.round(stats.totalHours) : 0;

  // Format last clock in/out times
  const lastClockIn = stats.lastClockIn
    ? moment(stats.lastClockIn).format('MMM D, YYYY h:mm A')
    : 'N/A';
  const lastClockOut = stats.lastClockOut
    ? moment(stats.lastClockOut).format('MMM D, YYYY h:mm A')
    : 'N/A';

  // For coloring the stats blocks
  const statItems = [
    {
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      title: 'Attendance Rate',
      value: `${attendanceRateStr}%`,
      scoreClass: getScoreClass(attendanceRateStr),
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

  // Helper to unify the extraction logic
  const extractEvents = (eventType) => {
    const eventData = events[eventType];
    if (!eventData) return [];

    if (Array.isArray(eventData)) {
      // Make sure each event has the correct eventType set
      return eventData.map((evt) => ({
        ...evt,
        eventType
      }));
    }

    // If it's an object where keys are IDs
    if (typeof eventData === 'object') {
      return Object.entries(eventData).map(([id, evt]) => ({
        ...evt,
        id,
        eventType
      }));
    }

    return [];
  };

  // Extract arrays for each event category
  const workshopsArray = extractEvents('workshops');
  const meetingsArray = extractEvents('meetings');
  const haciendasArray = extractEvents('haciendas');
  const juntaHaciendaArray = extractEvents('juntaHacienda');
  const gestionArray = extractEvents('gestion');

  // Compute pending counts for each category
  const pendingWorkshops = workshopsArray.filter(
    (e) => e.scheduled && !e.attended && !e.markedAbsent
  ).length;
  const pendingMeetings = meetingsArray.filter(
    (e) => e.scheduled && !e.attended && !e.markedAbsent
  ).length;
  const pendingHaciendas = haciendasArray.filter(
    (e) => e.scheduled && !e.attended && !e.markedAbsent
  ).length;
  const pendingGestion = gestionArray.filter(
    (g) => g.scheduled && !g.attended && !g.markedAbsent
  ).length;

  // Build attendance stats “timelines” for each category
  const attendanceStats = [
    {
      title: `PO Workshops (Monthly)${
        pendingWorkshops > 0 ? ` (${pendingWorkshops} pending)` : ''
      }`,
      data: workshopsArray,
      total: 12,
      eventType: 'workshops'
    },
    {
      title: `PO Group Meetings${
        pendingMeetings > 0 ? ` (${pendingMeetings} pending)` : ''
      }`,
      data: meetingsArray,
      total: 4,
      eventType: 'meetings'
    },
    {
      title: `Haciendas${
        pendingHaciendas > 0 ? ` (${pendingHaciendas} pending)` : ''
      }`,
      data: haciendasArray,
      total: 52,
      eventType: 'haciendas'
    },
    {
      title: 'Junta de Hacienda',
      data: juntaHaciendaArray,
      total: 12,
      eventType: 'juntaHacienda'
    },
    {
      title: `Gestion${pendingGestion > 0 ? ` (${pendingGestion} pending)` : ''}`,
      data: gestionArray,
      total: 12,
      eventType: 'gestion'
    }
  ];

  // Calculate gestion percentage based on scheduled events only
  const scheduledGestions = gestionArray.filter((g) => g.scheduled);
  const gestionRate = scheduledGestions.length
    ? (
        (scheduledGestions.filter((g) => g.attended).length /
          scheduledGestions.length) *
        100
      ).toFixed(1)
    : 0;

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white/90">Registry</h2>
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
            <div
              className={`font-mono text-2xl font-semibold mb-2 ${
                stat.scoreClass || 'text-white/90'
              }`}
            >
              {stat.value}
            </div>
            <div className="text-xs text-white/50">{stat.period}</div>
            {stat.scoreClass && (
              <div
                className={`mt-2 text-xs px-2 py-1 rounded-full ${
                  parseFloat(stat.value) >= 75
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : parseFloat(stat.value) >= 50
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {parseFloat(stat.value) >= 75
                  ? 'Good'
                  : parseFloat(stat.value) >= 50
                  ? 'Average'
                  : 'Needs Improvement'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Event Registry Section */}
      <div className="p-6 space-y-6 border-t border-slate-700">
        {/* Timelines for each category */}
        {attendanceStats.map((section, index) => (
          <RegistrySection
            key={index}
            title={section.title}
            events={section.data}
            total={section.total}
            eventType={section.eventType}
          />
        ))}

        {/* Gestions Summary */}
        <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-white/80">Gestion Attended</h4>
            <span
              className={`text-lg font-mono font-semibold ${
                gestionRate >= 75
                  ? 'text-green-400'
                  : gestionRate >= 50
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {gestionRate}%
            </span>
          </div>
          <div className="mt-2 text-xs text-white/50">
            Total Gestions: {scheduledGestions.length}
          </div>
        </div>
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
            {locationHistory && locationHistory.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Users className="w-4 h-4 text-purple-400" />
                <span>
                  Current location: {locationHistory[0].locationId}
                  <span className="text-xs text-white/50 ml-2">
                    (since {moment(locationHistory[0].date).format('MMM D, YYYY')})
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

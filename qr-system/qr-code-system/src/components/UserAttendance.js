// UserAttendance.js
import React from 'react';
import { format } from 'date-fns';
import { Clock, AlertCircle } from 'lucide-react';

const UserAttendance = ({ attendanceRecords = [] }) => {
  const getStatusColor = (clockIn, expectedTime = '09:00') => {
    if (!clockIn) return 'text-red-400';
    const clockInTime = new Date(`2000-01-01 ${clockIn}`);
    const expectedDateTime = new Date(`2000-01-01 ${expectedTime}`);
    return clockInTime <= expectedDateTime ? 'text-emerald-400' : 'text-yellow-400';
  };

  const StatusBadge = ({ clockInTime }) => (
    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium 
                    ${!clockInTime ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      clockInTime > '09:15' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
      <Clock className="w-3 h-3" />
      {!clockInTime ? 'Absent' : clockInTime > '09:15' ? 'Late' : 'On Time'}
    </span>
  );

  return (
    <div className="bg-glass backdrop-blur border border-glass-light rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white/90 mb-6">Attendance Records</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr>
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                Date
              </th>
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                Clock In
              </th>
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                Clock Out
              </th>
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                Hours
              </th>
              <th className="bg-glass-dark px-6 py-4 text-left text-sm font-medium text-white/70 border-b border-glass-light">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-light">
            {attendanceRecords.map(record => (
              <tr key={record.timestamp} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 text-sm text-white/90">
                  {format(new Date(record.date), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <div className={`flex items-center gap-2 text-sm ${getStatusColor(record.clockInTime)}`}>
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">
                      {record.clockInTime || 'Not Clocked In'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">
                      {record.clockOutTime || 'Not Clocked Out'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-mono">
                  {record.hoursWorked ? (
                    <span className="text-white/90">{record.hoursWorked}h</span>
                  ) : (
                    <span className="text-white/30">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge clockInTime={record.clockInTime} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserAttendance
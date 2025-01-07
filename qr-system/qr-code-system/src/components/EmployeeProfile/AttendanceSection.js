// components/AttendanceSection.js
import React from 'react';
import { format } from 'date-fns';
import { Trash2, Clock, AlertCircle } from 'lucide-react';
import PropTypes from 'prop-types';

const AttendanceSection = ({
  attendanceRecords,
  deleteConfirm,
  onDeleteRecord
}) => {
  const getStatusColor = (clockIn, expectedTime = '09:00') => {
    if (!clockIn) return 'text-red-500';
    const clockInTime = new Date(`2000-01-01 ${clockIn}`);
    const expectedDateTime = new Date(`2000-01-01 ${expectedTime}`);
    return clockInTime <= expectedDateTime ? 'text-green-500' : 'text-yellow-500';
  };

  return (
    <div className="section glass-panel">
      <div className="section-header">
        <h2 className="section-title">Attendance Records</h2>
      </div>
      <div className="table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRecords?.map(record => (
              <tr key={record.timestamp}>
                <td>{format(new Date(record.date), 'MMM dd, yyyy')}</td>
                <td className={getStatusColor(record.clockInTime)}>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {record.clockInTime || 'Not Clocked In'}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {record.clockOutTime || 'Not Clocked Out'}
                  </div>
                </td>
                <td>
                  {record.hoursWorked ? (
                    `${record.hoursWorked}h`
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td>
                  {!record.clockInTime ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertCircle size={16} />
                      Absent
                    </span>
                  ) : record.clockInTime > '09:15' ? (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <Clock size={16} />
                      Late
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-green-500">
                      <Clock size={16} />
                      On Time
                    </span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => onDeleteRecord(record.timestamp)}
                    className="delete-record"
                    title="Delete record"
                  >
                    {deleteConfirm === record.timestamp ? (
                      'Confirm Delete'
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {(!attendanceRecords || attendanceRecords.length === 0) && (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  No attendance records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

AttendanceSection.propTypes = {
  attendanceRecords: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.number.isRequired,
      date: PropTypes.string.isRequired,
      clockInTime: PropTypes.string,
      clockOutTime: PropTypes.string,
      hoursWorked: PropTypes.string,
    })
  ),
  deleteConfirm: PropTypes.number,
  onDeleteRecord: PropTypes.func.isRequired,
};

AttendanceSection.defaultProps = {
  attendanceRecords: [],
  deleteConfirm: null,
};

export default AttendanceSection;
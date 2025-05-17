import React from 'react';

const EmployeeTable = ({ 
  filteredReports, 
  employeeReports, 
  selectedMonth, 
  selectedLocation 
}) => {
  return (
    <div className="glass-card overflow-x-auto">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Role</th>
            <th>Location</th>
            <th>Days Present</th>
            <th>Days Absent</th>
            <th>On Time (%)</th>
            <th>Late (%)</th>
            <th>Attendance (%)</th>
          </tr>
        </thead>
        <tbody>
          {filteredReports.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center py-4">
                No employee data available for the selected criteria
              </td>
            </tr>
          ) : (
            filteredReports.map((report, index) => (
              <tr key={`${report.id}-${index}`} className={`hover:bg-slate-700/30 ${report.isPlaceholder ? 'bg-amber-900/20' : ''}`}>
                <td>
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full mr-2 flex items-center justify-center ${
                      report.isPadrino ? 'bg-blue-600/50' : 
                      report.isPlaceholder ? 'bg-amber-600/50' : 'bg-slate-600/50'
                    }`}>
                      {report.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center">
                        {report.name}
                        {report.isPlaceholder && (
                          <span className="ml-2 text-xs text-amber-400 bg-amber-900/40 px-1 py-0.5 rounded">
                            Incomplete Data
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {report.isPlaceholder ? report.reason : report.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${
                    report.role === 'padrino' || report.isPadrino ? 'bg-blue-500/20 text-blue-300' :
                    report.role === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                    report.isPlaceholder ? 'bg-amber-500/20 text-amber-300' : 
                    'bg-slate-500/20 text-slate-300'
                  }`}>
                    {report.isPlaceholder ? 'Unknown' : report.role}
                  </span>
                </td>
                <td>{report.location}</td>
                <td>{report.daysPresent}</td>
                <td>{report.daysAbsent}</td>
                <td>{report.onTimePercentage}%</td>
                <td>{report.latePercentage}%</td>
                <td>
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                      <div 
                        className={`h-2 rounded-full ${
                          report.isPlaceholder ? 'bg-amber-500' :
                          parseFloat(report.attendancePercentage) >= 90 ? 'bg-green-500' :
                          parseFloat(report.attendancePercentage) >= 70 ? 'bg-blue-500' :
                          parseFloat(report.attendancePercentage) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${report.attendancePercentage}%` }}
                      ></div>
                    </div>
                    {report.attendancePercentage}%
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      <div className="text-right mt-2 px-4 pb-2 text-sm text-gray-400">
        {selectedMonth ? (
          <span>Showing {filteredReports.length} employees who clocked in during {selectedMonth}</span>
        ) : selectedLocation !== 'all' ? (
          <span>Showing {filteredReports.length} employees at {selectedLocation}</span>
        ) : (
          <span>Showing {filteredReports.length} of {employeeReports.length} employees</span>
        )}
      </div>
    </div>
  );
};

export default EmployeeTable
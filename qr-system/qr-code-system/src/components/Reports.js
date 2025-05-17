import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { database } from '../services/firebaseConfig';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Icons
import { User, Users, Clock, TrendingUp, Calendar, Search, RefreshCw, X, BarChart2 } from 'lucide-react';

// Child component
import AttendanceChart from './AttendanceChart';
import './Reports.css';

const Reports = () => {
  // Core state
  const [employeeReports, setEmployeeReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalMembers: 0,
    totalClockIns: 0,
    avgAttendance: 0,
    activePadrinos: 0,
  });
  
  // Date filtering
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // First day of current month
    endDate: new Date().toISOString().split('T')[0] // Today
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // For navigation
  const navigate = useNavigate();

  // Initial data fetch
  useEffect(() => {
    fetchEmployeeData();
  }, [dateRange]);
  
  // Apply search filter when it changes
  useEffect(() => {
    filterReports();
  }, [employeeReports, searchTerm]);

  // Calculate monthly attendance data for chart
  const calculateMonthlyAttendance = (attendance) => {
    const monthlyData = {};
    const currentYear = new Date().getFullYear();
    
    // Initialize with all months of the current year
    for (let i = 0; i < 12; i++) {
      const monthName = new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' });
      monthlyData[`${monthName}`] = { month: monthName, count: 0 };
    }
    
    // Process attendance data
    Object.entries(attendance || {}).forEach(([location, locationData]) => {
      Object.entries(locationData || {}).forEach(([date, records]) => {
        try {
          const recordDate = new Date(date);
          // Only count current year
          if (recordDate.getFullYear() === currentYear) {
            const month = recordDate.toLocaleString('default', { month: 'short' });
            
            // Count total clock-ins for this day
            let clockInCount = 0;
            const attendanceRecords = Array.isArray(records) ? records : [records];
            
            attendanceRecords.forEach(record => {
              if (record.present) {
                clockInCount++;
              }
            });
            
            // Add to monthly count - this counts all clock-ins, not just unique users
            if (monthlyData[month]) {
              monthlyData[month].count += clockInCount;
            }
          }
        } catch (error) {
          console.error("Error processing date:", date, error);
        }
      });
    });
    
    // Convert to array and sort by month index
    return Object.values(monthlyData).sort((a, b) => {
      const monthA = new Date(`${a.month} 1, ${currentYear}`).getMonth();
      const monthB = new Date(`${b.month} 1, ${currentYear}`).getMonth();
      return monthA - monthB;
    });
  };

  // Fetch all data
  const fetchEmployeeData = async () => {
    setLoading(true);
    setRefreshing(true);
    
    try {
      const usersRef = ref(database, 'users');
      const attendanceRef = ref(database, 'attendance');

      // Fetch all users
      const users = await new Promise((resolve) =>
        onValue(usersRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );

      // Fetch attendance data
      const attendance = await new Promise((resolve) =>
        onValue(attendanceRef, (snapshot) => {
          resolve(snapshot.val() || {});
        })
      );

      // Process data with date filtering applied
      const reports = calculateEmployeeReports(users, attendance);
      setEmployeeReports(reports);
      
      // Calculate monthly attendance data for chart
      const monthlyData = calculateMonthlyAttendance(attendance);
      setMonthlyAttendance(monthlyData);
      
      // Filter reports
      filterReports(reports);

      // Update overall stats
      updateStats(users, reports);
      
      setLoading(false);
      setTimeout(() => setRefreshing(false), 500);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate employee reports
  const calculateEmployeeReports = (users, attendance) => {
    const reports = [];
    const { startDate, endDate } = dateRange;
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    Object.entries(users || {}).forEach(([userId, userData]) => {
      if (userData && userData.profile) {
        const user = userData.profile;
        
        // Start with zeroed stats
        let daysPresent = 0;
        let daysAbsent = 0;
        let daysLate = 0;
        
        // Calculate attendance based on date range
        if (attendance && attendance[user.primaryLocation]) {
          const locationAttendance = attendance[user.primaryLocation];
          
          // Process attendance records
          Object.entries(locationAttendance || {}).forEach(([date, records]) => {
            const recordDate = new Date(date);
            
            // Only count if within date range
            if (recordDate >= startDateObj && recordDate <= endDateObj) {
              const userRecords = Array.isArray(records) ? records : [records];
              
              // Check if user was present on this day
              const userPresent = userRecords.some(record => 
                record.userId === userId && record.present
              );
              
              // Check if user was late on this day
              const userLate = userRecords.some(record => 
                record.userId === userId && record.present && record.late
              );
              
              if (userPresent) {
                daysPresent++;
                if (userLate) daysLate++;
              } else {
                daysAbsent++;
              }
            }
          });
        }
        
        // If no attendance data from the specific date range, fall back to profile stats
        if (daysPresent === 0 && daysAbsent === 0) {
          const userStats = userData.stats || {};
          daysPresent = userStats.daysPresent || 0;
          daysAbsent = userStats.daysAbsent || 0;
          daysLate = userStats.daysLate || 0;
        }
        
        const daysOnTime = daysPresent - daysLate;

        reports.push({
          id: userId,
          name: user.name || 'Unknown',
          email: userData.email || '',
          daysPresent,
          daysAbsent,
          daysLate,
          daysOnTime,
          onTimePercentage: calculatePercentage(daysOnTime, daysPresent),
          latePercentage: calculatePercentage(daysLate, daysPresent),
          attendancePercentage: calculatePercentage(daysPresent, daysPresent + daysAbsent),
          status: user.status || 'unknown',
          location: user.primaryLocation || 'unknown',
          role: user.role || 'unknown',
          isPadrino: user.role === 'padrino'
        });
      }
    });

    return reports.sort((a, b) => b.daysPresent - a.daysPresent);
  };

  // Update overall stats
  const updateStats = (users, reports) => {
    const totalMembers = reports.length;
    const totalClockIns = reports.reduce(
      (sum, report) => sum + report.daysPresent,
      0
    );
    const activePadrinos = Object.values(users || {}).filter(
      (userData) =>
        userData.profile?.role === 'padrino' &&
        userData.profile?.status === 'active'
    ).length;

    const avgAttendance =
      totalMembers > 0
        ? (
            reports.reduce(
              (sum, report) =>
                sum + parseFloat(report.attendancePercentage || '0'),
              0
            ) / totalMembers
          ).toFixed(2)
        : '0.00';

    setOverallStats({
      totalMembers,
      totalClockIns,
      avgAttendance,
      activePadrinos,
    });
  };

  // Calculate percentage
  const calculatePercentage = (numerator, denominator) => {
    return denominator ? ((numerator / denominator) * 100).toFixed(2) : '0.00';
  };
  
  // Filter reports based on search term
  const filterReports = (reports = employeeReports) => {
    if (!searchTerm.trim()) {
      setFilteredReports(reports);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = reports.filter(report => 
      report.name.toLowerCase().includes(term) ||
      report.email.toLowerCase().includes(term) ||
      report.role.toLowerCase().includes(term) ||
      report.location.toLowerCase().includes(term)
    );
    
    setFilteredReports(filtered);
  };

  // Handle date range changes
  const handleDateRangeChange = (e, field) => {
    setDateRange({
      ...dateRange,
      [field]: e.target.value
    });
  };
  
  // Handle refresh
  const handleRefresh = () => {
    fetchEmployeeData();
  };
  
  // Navigation handlers
  const handleTotalMembersClick = () => {
    navigate('/employee-list');
  };
  
  const handleActivePadrinosClick = () => {
    navigate('/employee-list', { 
      state: { filter: 'padrinos' } 
    });
  };
  
  const handleViewEmployeeDetails = (employeeId) => {
    navigate(`/users/${employeeId}`);
  };

  return (
    <div className="glass-container p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="chart-title text-3xl">Attendance Reports</h2>
        
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          {/* Refresh button */}
          <button 
            onClick={handleRefresh} 
            className="btn-outline flex items-center space-x-1"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>
      
      {/* Date range and search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Date range */}
        <div className="glass-card p-3 flex items-center">
          <Calendar className="text-sky-400 w-5 h-5 mr-2" />
          <div className="flex items-center space-x-2 flex-grow">
            <span className="text-sm text-gray-400">From:</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateRangeChange(e, 'startDate')}
              className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-white text-sm"
            />
            <span className="text-sm text-gray-400">To:</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateRangeChange(e, 'endDate')}
              className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-white text-sm"
            />
          </div>
        </div>
        
        {/* Search */}
        <div className="glass-card p-3 flex items-center">
          <Search className="text-gray-400 w-5 h-5 mr-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employees..."
            className="bg-transparent border-none text-white flex-grow focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
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
        <div className="glass-card p-4 rounded-xl">
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
      
      {/* Monthly Attendance Chart */}
      <div className="glass-card p-4 mb-8">
        <div className="flex items-center mb-4">
          <BarChart2 className="text-sky-400 w-5 h-5 mr-2" />
          <h3 className="text-xl font-medium">Monthly Clock-ins</h3>
        </div>
        
        {monthlyAttendance.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyAttendance}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#94a3b8' }} 
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} 
                />
                <YAxis 
                  tick={{ fill: '#94a3b8' }} 
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.9)', 
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    color: 'white' 
                  }} 
                  itemStyle={{ color: '#38bdf8' }}
                  labelStyle={{ color: 'white' }}
                  formatter={(value) => [`${value} clock-ins`, 'Total']}
                />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="count" name="Total Clock-ins" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>No monthly data available</p>
          </div>
        )}
        <div className="text-xs text-gray-400 mt-2 text-right">
          Total for year: {monthlyAttendance.reduce((sum, month) => sum + month.count, 0)} clock-ins
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-card p-6 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p>Loading attendance data...</p>
        </div>
      )}

      {/* Main attendance table */}
      {!loading && (
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
                  <tr key={`${report.id}-${index}`} className="hover:bg-slate-700/30">
                    <td>
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full mr-2 flex items-center justify-center ${
                          report.isPadrino ? 'bg-blue-600/50' : 'bg-slate-600/50'
                        }`}>
                          {report.name.charAt(0)}
                        </div>
                        <div>
                          <div>{report.name}</div>
                          <div className="text-xs text-gray-400">{report.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${
                        report.role === 'padrino' ? 'bg-blue-500/20 text-blue-300' :
                        report.role === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>
                        {report.role}
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
            Showing {filteredReports.length} of {employeeReports.length} employees
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
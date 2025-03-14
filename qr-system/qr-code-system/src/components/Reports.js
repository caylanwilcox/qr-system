import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';  // <-- For React Router
import { database } from '../services/firebaseConfig';

// Icons
import { User, Users, Clock, TrendingUp } from 'lucide-react';

// Child component
import AttendanceChart from './AttendanceChart'; // Example
import './Reports.css';

const Reports = () => {
  const [employeeReports, setEmployeeReports] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalMembers: 0,
    totalClockIns: 0,
    avgAttendance: 0,
    activePadrinos: 0,
  });
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [chartData, setChartData] = useState({});

  // 1) Use navigate for routing
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployeeData();
  }, [selectedMonth]);

  const fetchEmployeeData = async () => {
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

      // Process the data for reports
      const reports = calculateEmployeeReports(users, attendance);
      setEmployeeReports(reports);

      // Build chartData for the selectedMonth
      if (Array.isArray(reports) && reports.length > 0) {
        const attendanceByMonth = {};
        if (selectedMonth) {
          attendanceByMonth[selectedMonth] = {};
          reports.forEach((report) => {
            if (report.daysPresent > 0) {
              attendanceByMonth[selectedMonth][report.name] = {
                daysPresent: report.daysPresent,
                name: report.name,
              };
            }
          });
        }
        setChartData(attendanceByMonth);
      } else {
        setChartData({});
      }

      // Update overall stats
      updateStats(users, reports);

      // Generate available months
      const availableMonths = extractAvailableMonths(attendance);
      setMonths(availableMonths);

      // Default to first available month if none selected
      if (availableMonths.length > 0 && !selectedMonth) {
        setSelectedMonth(availableMonths[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const extractAvailableMonths = (attendance) => {
    const months = new Set();

    Object.entries(attendance || {}).forEach(([location, locationData]) => {
      Object.entries(locationData || {}).forEach(([_, records]) => {
        const clockIns = Array.isArray(records) ? records : [records];
        clockIns.forEach((record) => {
          if (record.clockInTime) {
            const date = new Date(record.clockInTime);
            const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
            months.add(monthYear);
          }
        });
      });
    });

    return Array.from(months).sort((a, b) => {
      const [mA, yA] = a.split('-').map(Number);
      const [mB, yB] = b.split('-').map(Number);
      return new Date(yB, mB - 1) - new Date(yA, mA - 1);
    });
  };

  const calculateEmployeeReports = (users, attendance) => {
    const reports = [];

    Object.entries(users || {}).forEach(([userId, userData]) => {
      if (userData && userData.profile) {
        const user = userData.profile;
        const userStats = userData.stats || {};

        const daysPresent = userStats.daysPresent || 0;
        const daysAbsent = userStats.daysAbsent || 0;
        const daysLate = userStats.daysLate || 0;
        const daysOnTime = daysPresent - daysLate;

        reports.push({
          name: user.name || 'Unknown',
          daysPresent,
          daysAbsent,
          daysLate,
          daysOnTime,
          onTimePercentage: calculatePercentage(daysOnTime, daysPresent),
          latePercentage: calculatePercentage(daysLate, daysPresent),
          attendancePercentage: calculatePercentage(
            daysPresent,
            daysPresent + daysAbsent
          ),
          status: user.status || 'unknown',
          location: user.primaryLocation || 'unknown',
          role: user.role || 'unknown',
        });
      }
    });

    return reports.sort((a, b) => b.daysPresent - a.daysPresent);
  };

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

  const calculatePercentage = (numerator, denominator) => {
    return denominator ? ((numerator / denominator) * 100).toFixed(2) : '0.00';
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  // 2) onClick for the “Total Members” card => navigate to /employee-list
  // You can do the same for “Active Padrinos” if desired
  const handleTotalMembersClick = () => {
    navigate('/employee-list');
  };

  return (
    <div className="glass-container p-6">
      <h2 className="chart-title text-3xl mb-8">Monthly Attendance Reports</h2>

      {/* Top-level stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Total Members */}
        <div
          className="glass-card p-4 rounded-xl cursor-pointer" // make pointer
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
        <div className="glass-card p-4 rounded-xl">
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

      {/* Month selection dropdown */}
      <div className="glass-card month-selector my-6">
        <label htmlFor="month-select">Select Month:</label>
        <select
          id="month-select"
          value={selectedMonth}
          onChange={handleMonthChange}
        >
          {months.map((month) => {
            const [m, y] = month.split('-').map(Number);
            return (
              <option key={month} value={month}>
                {new Date(y, m - 1).toLocaleString('default', {
                  month: 'long',
                  year: 'numeric',
                })}
              </option>
            );
          })}
        </select>
      </div>

      {/* Chart component for attendance visualization */}
      <div className="mb-8">
        {Object.keys(chartData).length > 0 ? (
          <AttendanceChart attendanceData={chartData} />
        ) : (
          <div className="glass-card p-4">
            <p className="text-center text-slate-300">
              No attendance data available for the selected month.
            </p>
          </div>
        )}
      </div>

      {/* Main attendance table */}
      <div className="glass-card">
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
            {employeeReports.map((report, index) => (
              <tr key={`${report.name}-${index}`}>
                <td>{report.name}</td>
                <td>{report.role}</td>
                <td>{report.location}</td>
                <td>{report.daysPresent}</td>
                <td>{report.daysAbsent}</td>
                <td>{report.onTimePercentage}%</td>
                <td>{report.latePercentage}%</td>
                <td>{report.attendancePercentage}%</td>
              </tr>
            ))}
            {employeeReports.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  No employee data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;

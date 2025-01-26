import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import AttendanceChart from './AttendanceChart';
import { User, Users, Clock, TrendingUp } from 'lucide-react';
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
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  /**
   * Fetches attendance data and user stats directly from Firebase.
   */
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

      // Generate chart data for present employees
// Generate chart data for present employees
const chartData = reports
  .filter((report) => report.daysPresent > 0)
  .map((report) => ({
    name: report.name,
    daysPresent: report.daysPresent,
    label: selectedMonth, // Use the selected month as the label
  }));
setChartData(chartData);

    
      setChartData(chartData);

      // Update overall stats
      updateStats(users, reports);

      // Generate available months from attendance
      const availableMonths = extractAvailableMonths(attendance);
      setMonths(availableMonths);

      // Default to the first available month
      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  /**
   * Extracts available months from the attendance data.
   */
  const extractAvailableMonths = (attendance) => {
    const months = new Set();

    Object.entries(attendance).forEach(([location, locationData]) => {
      Object.entries(locationData).forEach(([_, records]) => {
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

  /**
   * Generates detailed employee reports from users and attendance data.
   */
  const calculateEmployeeReports = (users, attendance) => {
    const reports = [];

    Object.entries(users).forEach(([userId, user]) => {
      const daysPresent = user.stats?.daysPresent || 0;
      const daysAbsent = user.stats?.daysAbsent || 0;
      const daysLate = user.stats?.daysLate || 0;
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
        location: user.location || 'unknown',
      });
    });

    return reports.sort((a, b) => b.daysPresent - a.daysPresent);
  };

  /**
   * Updates the top-level stats displayed in the cards.
   */
  const updateStats = (users, reports) => {
    const totalMembers = reports.length;

    const totalClockIns = reports.reduce(
      (sum, report) => sum + report.daysPresent,
      0
    );

    const activePadrinos = Object.values(users).filter(
      (user) => user.padrino && user.status === 'active'
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

  /**
   * Helper function to calculate percentages.
   */
  const calculatePercentage = (numerator, denominator) => {
    return denominator ? ((numerator / denominator) * 100).toFixed(2) : '0.00';
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <div className="glass-container p-6">
      <h2 className="chart-title text-3xl mb-8">Monthly Attendance Reports</h2>

      {/* Top-level stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-300 text-sm">Total Members</h3>
            <User className="text-sky-400 w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-sky-400 mt-2">
            {overallStats.totalMembers}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-300 text-sm">Active Padrinos</h3>
            <Users className="text-sky-400 w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-sky-400 mt-2">
            {overallStats.activePadrinos}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-300 text-sm">Total Clock-ins</h3>
            <Clock className="text-sky-400 w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-sky-400 mt-2">
            {overallStats.totalClockIns}
          </p>
        </div>
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

      {/* Chart showing only present employees */}

      {/* Month selection dropdown */}
      <div className="glass-card month-selector my-6">
        <label htmlFor="month-select">Select Month:</label>
        <select id="month-select" value={selectedMonth} onChange={handleMonthChange}>
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

      {/* Main attendance table */}
      <div className="glass-card">
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Days Present</th>
              <th>Days Absent</th>
              <th>On Time (%)</th>
              <th>Late (%)</th>
              <th>Attendance (%)</th>
            </tr>
          </thead>
          <tbody>
            {employeeReports.map((report) => (
              <tr key={report.name}>
                <td>{report.name}</td>
                <td>{report.daysPresent}</td>
                <td>{report.daysAbsent}</td>
                <td>{report.onTimePercentage}%</td>
                <td>{report.latePercentage}%</td>
                <td>{report.attendancePercentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;

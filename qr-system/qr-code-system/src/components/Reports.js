import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../services/firebaseConfig';
import './Reports.css';

const Reports = () => {
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [employeeReports, setEmployeeReports] = useState([]);

  useEffect(() => {
    const attendanceRef = ref(database, 'attendance');
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        processAttendanceData(data);
      }
    });

    return () => unsubscribe();
  }, []);

  const processAttendanceData = (data) => {
    const monthlyData = {};

    Object.values(data).forEach((locationData) => {
      Object.values(locationData).forEach((employee) => {
        const { name, clockInTime } = employee;
        const date = new Date(clockInTime);
        const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {};
        }

        if (!monthlyData[monthYear][name]) {
          monthlyData[monthYear][name] = {
            daysPresent: 0,
            daysAbsent: 0,
            daysOnTime: 0,
            daysLate: 0,
          };
        }

        monthlyData[monthYear][name].daysPresent += employee.daysScheduledPresent || 0;
        monthlyData[monthYear][name].daysAbsent += employee.daysScheduledMissed || 0;
        monthlyData[monthYear][name].daysOnTime += employee.daysOnTime || 0;
        monthlyData[monthYear][name].daysLate += employee.daysLate || 0;
      });
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const [monthA, yearA] = a.split('-').map(Number);
      const [monthB, yearB] = b.split('-').map(Number);
      return new Date(yearB, monthB - 1) - new Date(yearA, monthA - 1);
    });

    setMonths(sortedMonths);
    setAttendanceData(monthlyData);
    setSelectedMonth(sortedMonths[0]);
  };

  useEffect(() => {
    if (selectedMonth && attendanceData[selectedMonth]) {
      const reports = Object.entries(attendanceData[selectedMonth]).map(([name, data]) => ({
        name,
        ...data,
        onTimePercentage: calculatePercentage(data.daysOnTime, data.daysPresent),
        latePercentage: calculatePercentage(data.daysLate, data.daysPresent),
        attendancePercentage: calculatePercentage(data.daysPresent, data.daysPresent + data.daysAbsent),
      }));
      setEmployeeReports(reports);
    }
  }, [selectedMonth, attendanceData]);

  const calculatePercentage = (numerator, denominator) => {
    return denominator ? ((numerator / denominator) * 100).toFixed(2) : '0.00';
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <div className="attendance-reports-container">
      <h2>Monthly Attendance Reports</h2>
      <div className="month-selector">
        <label htmlFor="month-select">Select Month:</label>
        <select id="month-select" value={selectedMonth} onChange={handleMonthChange}>
          {months.map((month) => (
            <option key={month} value={month}>
              {new Date(month.split('-')[1], month.split('-')[0] - 1).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </option>
          ))}
        </select>
      </div>

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
  );
};

export default Reports;

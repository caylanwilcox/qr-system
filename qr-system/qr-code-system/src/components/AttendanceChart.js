import React, { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../services/firebaseConfig'; // Import Firebase config
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './AttendanceChart.css';

// Register Chart.js components for Bar chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AttendanceChart = () => {
  const [attendanceData, setAttendanceData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const currentMonthRef = ref(database, 'attendance/2024-10');
        const previousMonthRef = ref(database, 'attendance/2024-09');

        const currentMonthSnapshot = await get(currentMonthRef);
        const previousMonthSnapshot = await get(previousMonthRef);

        const currentMonthData = currentMonthSnapshot.val() || {};
        const previousMonthData = previousMonthSnapshot.val() || {};

        const attendanceRates = calculateAttendanceImprovement(
          currentMonthData,
          previousMonthData
        );

        setAttendanceData(attendanceRates);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data from Firebase:', error);
      }
    };

    fetchAttendanceData();
  }, []);

  const calculateAttendanceImprovement = (currentMonth, previousMonth) => {
    let currentTotalAttendance = 0;
    let previousTotalAttendance = 0;

    Object.values(currentMonth).forEach((employee) => {
      currentTotalAttendance += (employee.daysPresent / employee.totalDays) * 100;
    });

    Object.values(previousMonth).forEach((employee) => {
      previousTotalAttendance += (employee.daysPresent / employee.totalDays) * 100;
    });

    const numEmployees = Math.max(
      Object.keys(currentMonth).length,
      Object.keys(previousMonth).length
    );

    const averageCurrentMonth = numEmployees && currentTotalAttendance
      ? currentTotalAttendance / numEmployees
      : 0;
    const averagePreviousMonth = numEmployees && previousTotalAttendance
      ? previousTotalAttendance / numEmployees
      : 0;

    return {
      averageCurrentMonth,
      averagePreviousMonth,
      difference: averageCurrentMonth - averagePreviousMonth,
    };
  };

  const chartData = {
    labels: ['Previous Month', 'Current Month'],
    datasets: [
      {
        label: 'Average Attendance (%)',
        data: [
          attendanceData.averagePreviousMonth || 0,
          attendanceData.averageCurrentMonth || 0,
        ],
        backgroundColor: '#105485',
        borderRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#105485',
          font: {
            weight: 'bold',
          },
        },
      },
      title: {
        display: true,
        text: 'Monthly Attendance Comparison',
        color: '#105485',
        font: {
          size: 18,
          weight: 'bold',
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: '#105485',
          stepSize: 25,
        },
        title: {
          display: true,
          text: 'Attendance (%)',
          color: '#105485',
          font: {
            weight: 'bold',
          },
        },
      },
      x: {
        ticks: {
          color: '#105485',
        },
        title: {
          display: true,
          text: 'Month',
          color: '#105485',
          font: {
            weight: 'bold',
          },
        },
      },
    },
  };

  if (isLoading) {
    return <p>Loading attendance data...</p>;
  }

  return (
    <div className="attendance-chart-container">
      <nav className="attendance-nav">Attendance Dashboard</nav>
      <div className="quadrant-1 large-box">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default AttendanceChart;

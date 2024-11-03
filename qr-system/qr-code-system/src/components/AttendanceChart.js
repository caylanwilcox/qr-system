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
    // Function to fetch attendance data for both current and previous months
    const fetchAttendanceData = async () => {
      try {
        const currentMonthRef = ref(database, 'attendance/2024-10');
        const previousMonthRef = ref(database, 'attendance/2024-09');

        // Get attendance data
        const currentMonthSnapshot = await get(currentMonthRef);
        const previousMonthSnapshot = await get(previousMonthRef);

        const currentMonthData = currentMonthSnapshot.val() || {};
        const previousMonthData = previousMonthSnapshot.val() || {};

        // Calculate attendance improvement
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

  // Helper function to calculate attendance improvement
  const calculateAttendanceImprovement = (currentMonth, previousMonth) => {
    let currentTotalAttendance = 0;
    let previousTotalAttendance = 0;

    // Calculate attendance rates for current month
    Object.values(currentMonth).forEach((employee) => {
      currentTotalAttendance += (employee.daysPresent / employee.totalDays) * 100;
    });

    // Calculate attendance rates for previous month
    Object.values(previousMonth).forEach((employee) => {
      previousTotalAttendance += (employee.daysPresent / employee.totalDays) * 100;
    });

    const numEmployees = Math.max(
      Object.keys(currentMonth).length,
      Object.keys(previousMonth).length
    );
    const averageCurrentMonth = numEmployees ? currentTotalAttendance / numEmployees : 0;
    const averagePreviousMonth = numEmployees ? previousTotalAttendance / numEmployees : 0;

    return {
      averageCurrentMonth,
      averagePreviousMonth,
      difference: averageCurrentMonth - averagePreviousMonth,
    };
  };

  // Chart.js data configuration for bar chart
  const chartData = {
    labels: ['Previous Month', 'Current Month'],
    datasets: [
      {
        label: 'Average Attendance (%)',
        data: [
          attendanceData.averagePreviousMonth || 0,
          attendanceData.averageCurrentMonth || 0,
        ],
        backgroundColor: ['rgba(0, 204, 255, 0.6)', 'rgba(0, 204, 255, 0.6)'],
        borderColor: ['rgba(0, 204, 255, 1)', 'rgba(0, 204, 255, 1)'],
        borderWidth: 1,
        barPercentage: 0.6, // Controls the width of the bar
        borderRadius: 5, // Gives a rounded appearance to the bars
      },
    ],
  };

  // Chart.js options configuration
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#ffffff', // Use white for labels to improve readability on dark background
        },
      },
      title: {
        display: true,
        text: 'Monthly Attendance Comparison',
        color: '#ffffff', // Matching the overall dark theme
        font: {
          size: 16,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: '#ffffff',
          stepSize: 25, // Increment steps for better visualization
        },
        title: {
          display: true,
          text: 'Attendance (%)',
          color: '#ffffff',
        },
      },
      x: {
        ticks: {
          color: '#ffffff',
        },
        title: {
          display: true,
          text: 'Month',
          color: '#ffffff',
        },
      },
    },
  };

  if (isLoading) {
    return <p>Loading attendance data...</p>;
  }

  return (
    <div className="attendance-chart-container">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default AttendanceChart;

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-4 rounded-lg border border-slate-200/20">
        <p className="text-slate-200 font-medium">{label}</p>
        <p className="text-sky-400">Days Present: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const AttendanceChart = ({ attendanceData }) => {
  const monthlyStats = Object.entries(attendanceData)
    .map(([monthYear, employees]) => {
      const totalDaysPresent = Object.values(employees).reduce(
        (sum, emp) => sum + emp.daysPresent,
        0
      );

      const [month, year] = monthYear.split('-');
      const date = new Date(year, month - 1);
      const monthName = date.toLocaleString('default', { month: 'short' });

      return {
        month: `${monthName} ${year}`,
        daysPresent: totalDaysPresent,
      };
    })
    .sort((a, b) => {
      const [monthA, yearA] = a.month.split(' ');
      const [monthB, yearB] = b.month.split(' ');
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateA - dateB;
    });

  return (
    <div className="glass-card chart-container w-full h-[32rem]">
      <div className="glass-background"></div>
      <h3 className="text-2xl font-semibold mb-6 text-slate-200">
        Days Present Trends
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={monthlyStats}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148, 163, 184, 0.2)"
          />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={60}
            stroke="rgba(226, 232, 240, 0.6)"
            tick={{ fill: 'rgba(226, 232, 240, 0.6)' }}
          />
          <YAxis
            label={{
              value: 'Days Present',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'rgba(226, 232, 240, 0.6)' },
            }}
            stroke="rgba(226, 232, 240, 0.6)"
            tick={{ fill: 'rgba(226, 232, 240, 0.6)' }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
          />
          <Legend
            wrapperStyle={{
              paddingTop: '20px',
              color: 'rgba(226, 232, 240, 0.8)',
            }}
          />
          <Line
            type="monotone"
            dataKey="daysPresent"
            stroke="#0EA5E9"
            strokeWidth={3}
            name="Days Present"
            dot={{ fill: '#0EA5E9', strokeWidth: 2, r: 6 }}
            activeDot={{
              r: 8,
              stroke: '#38BDF8',
              strokeWidth: 2,
              fill: '#0EA5E9',
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AttendanceChart;

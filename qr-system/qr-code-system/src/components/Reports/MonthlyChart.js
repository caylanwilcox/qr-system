import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { BarChart2, X } from 'lucide-react';

const MonthlyChart = ({ 
  monthlyAttendance, 
  selectedMonth, 
  handleBarClick,
  clearMonthFilter
}) => {
  // Debug function to view details about a month's data when clicking
  const debugMonthData = (data) => {
    if (data && data.month) {
      console.log(`Month data for ${data.month}:`, data);
      // Log the event types and counts if available
      if (data.eventTypes) {
        console.log(`Event types for ${data.month}:`, data.eventTypes);
      }
    }
  };

  // Define colors
  const defaultBarColor = "#38bdf8";  // Light blue
  const selectedBarColor = "#10b981";  // Green

  return (
    <div className="glass-card p-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <BarChart2 className="text-sky-400 w-5 h-5 mr-2" />
          <h3 className="text-xl font-medium">Monthly Clock-ins</h3>
        </div>
        {selectedMonth && (
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">
              Filtered by: <span className="text-white font-medium">{selectedMonth}</span>
              {monthlyAttendance.find(m => m.month === selectedMonth)?.count 
                ? ` (${monthlyAttendance.find(m => m.month === selectedMonth)?.count} clock-ins)`
                : ''}
            </span>
            <button 
              onClick={clearMonthFilter} 
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      
      {monthlyAttendance.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyAttendance}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onClick={(data) => {
                if (data && data.activePayload && data.activePayload[0]) {
                  // Debug data to help identify issues
                  debugMonthData(data.activePayload[0].payload);
                  // Call the original handler
                  handleBarClick(data.activePayload[0].payload);
                }
              }}
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
                formatter={(value, name, props) => {
                  // Show location in tooltip if available
                  const location = props.payload.location;
                  // Add the number of unique employees if available
                  const uniqueEmployees = props.payload.employeeCount;
                  let tooltip = `${value} clock-ins`;
                  
                  if (location && location !== 'null') {
                    tooltip += ` (${location})`;
                  }
                  
                  if (uniqueEmployees) {
                    tooltip += `, ${uniqueEmployees} employees`;
                  }
                  
                  return [tooltip, 'Total'];
                }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar 
                dataKey="count" 
                name="Total Clock-ins" 
                fill={defaultBarColor}
                radius={[4, 4, 0, 0]} 
                cursor="pointer"
              >
                {monthlyAttendance.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.month === selectedMonth ? selectedBarColor : defaultBarColor} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No monthly data available</p>
        </div>
      )}
      <div className="text-xs text-gray-400 mt-2 text-right">
        <span className="mr-4">Click on a bar to filter employees by month</span>
        Total for year: {monthlyAttendance.reduce((sum, month) => sum + month.count, 0)} clock-ins
      </div>
    </div>
  );
};

export default MonthlyChart;
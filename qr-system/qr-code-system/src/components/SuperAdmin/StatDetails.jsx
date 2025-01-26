'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, Clock, CalendarDays, UserCheck } from 'lucide-react';
import './SuperAdminDashboard.css';

export default function StatDetails() {
  const { status } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const locationName = queryParams.get('location') || 'All';
  const timeFilter = location.state?.timeFilter;
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const isWithinTimeFilter = (timestamp) => {
    if (!timestamp) return false;
    if (timeFilter?.type === '24h') {
      const now = Date.now();
      return now - timestamp <= 24 * 60 * 60 * 1000;
    }
    if (timeFilter?.type === 'range' && timeFilter.dateRange.start && timeFilter.dateRange.end) {
      const date = new Date(timestamp);
      const startDate = new Date(timeFilter.dateRange.start);
      const endDate = new Date(timeFilter.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return date >= startDate && date <= endDate;
    }
    return true;
  };

  useEffect(() => {
    const usersRef = ref(database, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const userData = snapshot.val() || {};
      const filtered = Object.entries(userData)
        .filter(([_, user]) => {
          if (!user || user.status?.toLowerCase() !== 'active') return false;
          if (locationName !== 'All' && user.location !== locationName) return false;
          
          const stats = user.stats || {};
          const lastClockIn = stats.lastClockIn;
          if (!isWithinTimeFilter(new Date(lastClockIn).getTime())) return false;

          switch (status) {
            case 'absent': return stats.daysAbsent > 0;
            case 'present': return stats.daysPresent > 0;
            case 'late': return stats.daysLate > 0;
            case 'onTime': return (stats.daysPresent || 0) - (stats.daysLate || 0) > 0;
            default: return true;
          }
        })
        .map(([userId, user]) => ({
          id: userId,
          name: user.name || 'Unknown',
          location: user.location || 'Unknown',
          position: user.position || 'Member',
          lastClockIn: user.stats?.lastClockIn,
          lastClockOut: user.stats?.lastClockOut,
          stats: {
            daysPresent: user.stats?.daysPresent || 0,
            daysAbsent: user.stats?.daysAbsent || 0,
            daysLate: user.stats?.daysLate || 0,
            totalHours: user.stats?.totalHours || 0,
            frequency: {
              weekly: user.stats?.weeklyFrequency || 0,
              monthly: user.stats?.monthlyFrequency || 0
            },
            attendanceRate: calculateRate(
              user.stats?.daysPresent || 0,
              (user.stats?.daysPresent || 0) + (user.stats?.daysAbsent || 0)
            ),
            onTimeRate: calculateRate(
              (user.stats?.daysPresent || 0) - (user.stats?.daysLate || 0),
              user.stats?.daysPresent || 0
            )
          }
        }));

      setRecords(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [status, locationName, timeFilter]);

  const calculateRate = (numerator, denominator) => {
    if (!denominator) return 0;
    return ((numerator / denominator) * 100).toFixed(1);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <p className="mt-2">Loading stats data...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="error-banner">
          No matching records found for the selected criteria
        </div>
      </div>
    );
  }

  const groupedByLocation = records.reduce((acc, record) => {
    (acc[record.location] = acc[record.location] || []).push(record);
    return acc;
  }, {});

  return (
    <div className="dashboard-container">
      <div className="dashboard-grid">
        <div className="quadrant">
          <h2 className="rank-header">
            {status.toUpperCase()} Stats for {locationName}
          </h2>

          <div className="quadrant-inside">
            {Object.entries(groupedByLocation).map(([loc, items]) => (
              <div key={loc} className="metric-box mb-4">
                <h3 className="text-xl font-bold mb-4">{loc}</h3>
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="bg-glass-dark rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-lg">{item.name}</h4>
                          <p className="text-gray-400 text-sm">{item.position}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Last Clock In: {formatDateTime(item.lastClockIn)}</span>
                          </div>
                          <div className="text-sm flex items-center gap-2 mt-1">
                            <CalendarDays className="h-4 w-4" />
                            <span>Last Clock Out: {formatDateTime(item.lastClockOut)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="metric-box">
                          <div className="text-sm text-gray-400">Attendance Stats</div>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Present:</span>
                              <span className="font-medium">{item.stats.daysPresent} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Absent:</span>
                              <span className="font-medium">{item.stats.daysAbsent} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Late:</span>
                              <span className="font-medium">{item.stats.daysLate} times</span>
                            </div>
                          </div>
                        </div>

                        <div className="metric-box">
                          <div className="text-sm text-gray-400">Metrics</div>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Total Hours:</span>
                              <span className="font-medium">{item.stats.totalHours.toFixed(1)}h</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Weekly Events:</span>
                              <span className="font-medium">{item.stats.frequency.weekly}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Monthly Events:</span>
                              <span className="font-medium">{item.stats.frequency.monthly}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between mt-4">
                        <div className={`text-lg font-bold ${
                          Number(item.stats.attendanceRate) >= 75 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          Attendance Rate: {item.stats.attendanceRate}%
                        </div>
                        <div className={`text-lg font-bold ${
                          Number(item.stats.onTimeRate) >= 90
                            ? 'text-green-400'
                            : Number(item.stats.onTimeRate) >= 75
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}>
                          On-Time Rate: {item.stats.onTimeRate}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
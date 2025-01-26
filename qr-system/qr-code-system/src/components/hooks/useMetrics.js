import { useState, useCallback, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../services/firebaseConfig';

export const useMetrics = (activeLocation, timeFilter) => {
  const [metrics, setMetrics] = useState({
    total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
    perLocation: {},
    overview: {
      totalMembers: 0,
      padrinosBlue: 0,
      padrinosGreen: 0,
      padrinosRed: 0,
      padrinosOrange: 0,
      totalOrejas: 0,
      totalApoyos: 0,
      monthlyAttendance: 0
    }
  });

  const isWithinTimeFilter = useCallback((timestamp) => {
    if (!timestamp) return false;
    if (timeFilter.type === '24h') {
      const now = Date.now();
      return now - timestamp <= 24 * 60 * 60 * 1000;
    }
    if (timeFilter.type === 'range') {
      const date = new Date(timestamp);
      const startDate = new Date(timeFilter.dateRange.start);
      const endDate = new Date(timeFilter.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      return date >= startDate && date <= endDate;
    }
    return false;
  }, [timeFilter]);

  const processMetrics = useCallback((userData) => {
    const metrics = {
      total: { notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0 },
      perLocation: {},
      overview: {
        totalMembers: 0,
        padrinosBlue: 0,
        padrinosGreen: 0,
        padrinosRed: 0,
        padrinosOrange: 0,
        totalOrejas: 0,
        totalApoyos: 0,
        monthlyAttendance: 0,
        totalForAttendance: 0
      }
    };

    Object.entries(userData).forEach(([_, user]) => {
      if (!user || user.status?.toLowerCase() !== 'active') return;
      if (activeLocation !== 'All' && user.location !== activeLocation) return;

      const location = user.location || 'Unknown';
      if (!metrics.perLocation[location]) {
        metrics.perLocation[location] = {
          notClockedIn: 0, clockedIn: 0, onTime: 0, late: 0
        };
      }

      // Process attendance metrics
      const lastClockIn = user.stats?.lastClockIn;
      if (isWithinTimeFilter(new Date(lastClockIn).getTime())) {
        const stats = user.stats || {};
        const isPresent = stats.daysPresent > 0;
        const isLate = stats.daysLate > 0;

        if (isPresent) {
          metrics.perLocation[location].clockedIn++;
          metrics.total.clockedIn++;

          if (!isLate) {
            metrics.perLocation[location].onTime++;
            metrics.total.onTime++;
          } else {
            metrics.perLocation[location].late++;
            metrics.total.late++;
          }
        } else {
          metrics.perLocation[location].notClockedIn++;
          metrics.total.notClockedIn++;
        }
      }

      // Process overview metrics
      metrics.overview.totalMembers++;

      if (user.service === 'PPI') {
        switch (user.rank?.toLowerCase()) {
          case 'blue': metrics.overview.padrinosBlue++; break;
          case 'green': metrics.overview.padrinosGreen++; break;
          case 'red': metrics.overview.padrinosRed++; break;
          case 'orange': metrics.overview.padrinosOrange++; break;
          default: break;
        }
      } else if (user.service === 'RSG') {
        metrics.overview.totalOrejas++;
      } else if (user.service === 'COM') {
        metrics.overview.totalApoyos++;
      }

      const stats = user.stats || {};
      const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
      if (totalDays > 0) {
        metrics.overview.monthlyAttendance += ((stats.daysPresent || 0) / totalDays) * 100;
        metrics.overview.totalForAttendance++;
      }
    });

    if (metrics.overview.totalForAttendance > 0) {
      metrics.overview.monthlyAttendance /= metrics.overview.totalForAttendance;
    }

    return metrics;
  }, [activeLocation, isWithinTimeFilter]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const usersRefObj = ref(database, 'users');

        const unsubscribe = onValue(usersRefObj, (snapshot) => {
          if (!isMounted) return;
          
          const data = snapshot.val();
          if (!data) throw new Error('No user data available');

          const processedMetrics = processMetrics(data);
          setMetrics(processedMetrics);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error('Error fetching metrics:', err);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [processMetrics]);

  const locationMetrics = activeLocation === 'All'
    ? metrics.total
    : metrics.perLocation[activeLocation] || {
        notClockedIn: 0,
        clockedIn: 0,
        onTime: 0,
        late: 0
      };

  return {
    metrics,
    locationMetrics
  };
};
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { Loader2, AlertCircle } from 'lucide-react';
import './SuperAdminDashboard.css';

import LocationNav from './LocationNav';
import MetricsGrid from './MetricsGrid';
import ClockedInList from './ClockedInList';
import NotClockedInList from './NotClockedInList';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [colorUpdateStatus, setColorUpdateStatus] = useState(null);
  const [filteredData, setFilteredData] = useState({});
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);

  const dataSnapshot = useRef(null);
  const isUpdatingColors = useRef(false);

  const getCurrentDateISO = () => new Date().toISOString().split('T')[0];

  const locationMap = {
    All: 'All',
    Aurora: 'aurora',
    Elgin: 'elgin',
    Joliet: 'joliet',
    Lyons: 'lyons',
    'West Chicago': 'westchicago',
    Wheeling: 'wheeling',
  };

  const calculateUserColor = useCallback((profile, stats) => {
    const attendanceRate = stats?.attendanceRate || 0;
    const daysPresent = stats?.daysPresent || 0;

    if (daysPresent === 0) return 'red';
    if (attendanceRate >= 90) return 'blue';
    if (attendanceRate >= 75) return 'green';
    if (attendanceRate >= 60) return 'orange';
    return 'red';
  }, []);

  const applyFilters = useCallback((data, locationKey, colorFilter) => {
    return Object.fromEntries(
      Object.entries(data).filter(([_, user]) => {
        const userLoc = user.location || user.profile?.locationKey || user.profile?.primaryLocation;
        const locationMatch = locationKey === 'All' || userLoc === locationKey;
        const colorMatch = !colorFilter || (user.profile?.padrinoColor?.toLowerCase() === colorFilter && user.profile?.padrino);
        return locationMatch && colorMatch;
      })
    );
  }, []);

  const updatePadrinoColors = useCallback(async (data) => {
    if (isUpdatingColors.current) return;
    isUpdatingColors.current = true;
    setColorUpdateStatus('updating');

    const updates = {};

    Object.entries(data).forEach(([id, user]) => {
      const { profile, stats } = user;
      if (!profile) return;

      const newColor = profile.padrino && !profile.manualColorOverride
        ? calculateUserColor(profile, stats)
        : null;

      if (newColor !== null && profile.padrinoColor !== newColor) {
        updates[`users/${id}/profile/padrinoColor`] = newColor;
      } else if (!profile.padrino && profile.padrinoColor) {
        updates[`users/${id}/profile/padrinoColor`] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      try {
        await update(ref(database), updates);
        setColorUpdateStatus('success');
      } catch (err) {
        console.error('Error updating colors:', err);
        setColorUpdateStatus('error');
      }
    } else {
      setColorUpdateStatus('no-changes');
    }

    setTimeout(() => setColorUpdateStatus(null), 3000);
    isUpdatingColors.current = false;
  }, [calculateUserColor]);

  const processMetrics = useCallback((data, locationKey) => {
    const today = getCurrentDateISO();
    const metrics = {
      total: { clockedIn: 0, notClockedIn: 0, onTime: 0, late: 0 },
      perLocation: {},
      overview: {
        totalMembers: Object.keys(data).length,
        totalPadrinos: 0,
        padrinosBlue: 0,
        padrinosGreen: 0,
        padrinosRed: 0,
        padrinosOrange: 0,
        totalOrejas: 0,
        totalApoyos: 0,
        monthlyAttendance: 0,
      },
      date: today,
      activeUsersCount: 0,
      activeUsers: { count: 0, byLocation: {} }
    };

    let totalPresentAll = 0;
    let totalDaysAll = 0;
    let activeUsersCount = 0;

    Object.entries(data).forEach(([_, user]) => {
      const { profile, stats, attendance } = user;
      if (!profile) return;

      const loc = user.location || profile?.locationKey || 'Unknown';
      const color = profile?.padrinoColor?.toLowerCase?.();
      const isPadrino = profile?.padrino;

      if (!metrics.perLocation[loc]) {
        metrics.perLocation[loc] = { clockedIn: 0, notClockedIn: 0, onTime: 0, late: 0 };
      }

      if (isPadrino) {
        metrics.overview.totalPadrinos++;
        if (color === 'blue') metrics.overview.padrinosBlue++;
        if (color === 'green') metrics.overview.padrinosGreen++;
        if (color === 'orange') metrics.overview.padrinosOrange++;
        if (color === 'red') metrics.overview.padrinosRed++;
      }

      const service = profile?.service?.toUpperCase?.();
      if (service === 'RSG') metrics.overview.totalOrejas++;
      if (service === 'COM') metrics.overview.totalApoyos++;

      const attend = attendance?.[today];

      if (attend?.clockedIn) {
        metrics.total.clockedIn++;
        metrics.perLocation[loc].clockedIn++;
        attend.onTime ? metrics.total.onTime++ : metrics.total.late++;
        attend.onTime ? metrics.perLocation[loc].onTime++ : metrics.perLocation[loc].late++;
        activeUsersCount++;
      } else {
        metrics.total.notClockedIn++;
        metrics.perLocation[loc].notClockedIn++;
      }

      const daysPresent = stats?.daysPresent || 0;
      const daysAbsent = stats?.daysAbsent || 0;
      totalPresentAll += daysPresent;
      totalDaysAll += daysPresent + daysAbsent;
    });

    metrics.overview.monthlyAttendance = totalDaysAll > 0
      ? (totalPresentAll / totalDaysAll) * 100
      : 0;

    metrics.activeUsersCount = activeUsersCount;
    metrics.activeUsers.count = activeUsersCount;
    metrics.activeUsers.byLocation = Object.fromEntries(
      Object.entries(metrics.perLocation).map(([loc, data]) => [loc, data.clockedIn || 0])
    );

    return metrics;
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setError('No user data available');
          setLoading(false);
          return;
        }

        dataSnapshot.current = data;
        const activeLocationKey = locationMap[activeTab];
        const filtered = applyFilters(data, activeLocationKey, activeFilter);
        setFilteredData(filtered);
        setMetrics(processMetrics(filtered, activeLocationKey));
        setLoading(false);
        await updatePadrinoColors(data);
      } catch (err) {
        console.error('Error processing data:', err);
        setError('Error processing dashboard data');
        setLoading(false);
      }
    }, (err) => {
      console.error('Firebase error:', err);
      setError(`Error fetching data: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, activeFilter, processMetrics, updatePadrinoColors, applyFilters]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setActiveFilter(null);
  };

  const handleColorClick = (color) => {
    setActiveFilter(prev => (prev === color ? null : color));
  };

  if (loading) return (
    <div className="loading-overlay">
      <Loader2 className="animate-spin" />
      <p>Loading dashboard data...</p>
    </div>
  );

  if (error) return (
    <div className="error-banner">
      <AlertCircle />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      {colorUpdateStatus === 'success' && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded mb-4">
          Padrino colors updated successfully
        </div>
      )}
      {colorUpdateStatus === 'error' && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded mb-4">
          Error updating padrino colors
        </div>
      )}
      <div className="dashboard-grid">
        <div className="quadrant quadrant-1">
          <LocationNav
            locationMap={locationMap}
            activeTab={activeTab}
            onTabClick={handleTabClick}
          />
          <MetricsGrid
            metrics={metrics}
            activeFilter={activeFilter}
            onColorClick={handleColorClick}
            activeTab={activeTab}
          />
        </div>
        <div className="quadrant quadrant-2 flex gap-4">
          <ClockedInList data={filteredData} date={metrics?.date} />
          <NotClockedInList data={filteredData} date={metrics?.date} />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

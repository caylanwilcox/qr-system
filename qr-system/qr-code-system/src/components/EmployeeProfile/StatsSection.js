// src/components/StatsSection.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Activity,
  Clock,
  Calendar,
  Users,
  ChartBar,
  CheckSquare,
  XSquare,
  RefreshCw,
  FileText,
  MapPin,
  Tag,
  AlertCircle
} from 'lucide-react';
import moment from 'moment-timezone';
import { ref, get } from 'firebase/database';
import { database } from '../../services/firebaseConfig';
import { attendanceService } from '../../services/attendanceService';
import { eventBus, EVENTS } from '../../services/eventBus';
import AttendanceSection from './AttendanceSection';

/**
 * StatsSection Component - FIXED VERSION
 */
const StatsSection = ({ employeeDetails, employeeId, onRefresh }) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [employeeData, setEmployeeData] = useState(employeeDetails || null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [eventCount, setEventCount] = useState(0);
  const [recentClockIns, setRecentClockIns] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [error, setError] = useState(null);
  
  // Refs for cleanup and state tracking
  const mountedRef = useRef(true);
  const eventTypesLoadedRef = useRef(false);
  const subscriptionsRef = useRef([]);
  
  const DEBUG_PREFIX = '🔍 [StatsSection]';

  // Memoized user ID getter
  const userId = useMemo(() => {
    return employeeId || (employeeDetails && employeeDetails.id) || null;
  }, [employeeId, employeeDetails]);

  // Memoized event type formatter - FIXED
  const formatEventType = useCallback((eventType) => {
    if (!eventType) return 'General';
    
    const normalizedType = eventType.toLowerCase().replace(/\s+/g, '');
    
    const typeMap = {
      'generalmeeting': 'General Meeting',
      'general': 'General Meeting',
      'juntadehacienda': 'Junta Hacienda',
      'juntahacienda': 'Junta Hacienda',
      'junta_hacienda': 'Junta Hacienda',
      'haciendas': 'Hacienda',
      'hacienda': 'Hacienda',
      'workshops': 'Workshop',
      'workshop': 'Workshop',
      'meetings': 'Meeting',
      'meeting': 'Meeting',
      'gestion': 'Gestion',
      'gestiones': 'Gestion'
    };

    return typeMap[normalizedType] || eventType
      .replace(/[_-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  // Optimized event types fetcher with caching
  const fetchEventTypes = useCallback(async () => {
    if (eventTypesLoadedRef.current && Object.keys(eventTypes).length > 0) {
      console.log(`${DEBUG_PREFIX} Event types already loaded, skipping fetch`);
      return;
    }

    try {
      console.log(`${DEBUG_PREFIX} Fetching event types from database`);
      setLoadingEventTypes(true);
      setError(null);
      
      const eventTypesRef = ref(database, 'eventTypes');
      const snapshot = await get(eventTypesRef);
      
      if (!mountedRef.current) return;
      
      let eventTypesMap = {};
      
      if (snapshot.exists()) {
        const eventTypesData = snapshot.val();
        
        Object.values(eventTypesData).forEach(eventType => {
          if (eventType && eventType.active !== false) {
            const key = eventType.key?.toLowerCase() || 
                        eventType.name?.toLowerCase().replace(/\s+/g, '') || '';
            const displayName = eventType.displayName || eventType.name;
            
            if (key && displayName) {
              eventTypesMap[key] = displayName;
            }
          }
        });
        
        console.log(`${DEBUG_PREFIX} Loaded ${Object.keys(eventTypesMap).length} event types`);
      }
      
      // Set defaults if empty
      if (Object.keys(eventTypesMap).length === 0) {
        console.log(`${DEBUG_PREFIX} No event types found, using defaults`);
        eventTypesMap = {
          'gestion': 'Gestion',
          'haciendas': 'Hacienda',
          'workshops': 'Workshop',
          'meetings': 'Meeting',
          'juntahacienda': 'Junta de Hacienda'
        };
      }
      
      if (mountedRef.current) {
        setEventTypes(eventTypesMap);
        eventTypesLoadedRef.current = true;
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Error fetching event types:`, error);
      if (mountedRef.current) {
        setError('Failed to load event types');
      setEventTypes({
        'gestion': 'Gestion',
        'haciendas': 'Hacienda',
        'workshops': 'Workshop',
        'meetings': 'Meeting',
        'juntahacienda': 'Junta de Hacienda'
      });
        eventTypesLoadedRef.current = true;
      }
    } finally {
      if (mountedRef.current) {
      setLoadingEventTypes(false);
      }
    }
  }, []);

  // Memoized clock-ins extractor
  const extractRecentClockIns = useCallback((userData) => {
    if (!userData) return [];
    
    console.log(`${DEBUG_PREFIX} Extracting clock-ins from user data`);
    const clockIns = [];
    
    // Extract from attendance object
    if (userData.attendance) {
      Object.entries(userData.attendance).forEach(([date, data]) => {
        if (data.clockInTime) {
          clockIns.push({
            date,
            time: data.clockInTime,
            location: data.locationName || data.location || 'Unknown',
            isLate: data.isLate || false,
            eventType: data.eventType || null,
            timestamp: data.clockInTimestamp || moment(date + ' ' + data.clockInTime, 'YYYY-MM-DD h:mm A').valueOf()
          });
        }
      });
    }
    
    // Extract from clockInTimes
    if (userData.clockInTimes) {
      Object.entries(userData.clockInTimes).forEach(([timestamp, time]) => {
        const existing = clockIns.find(ci => Math.abs(ci.timestamp - parseInt(timestamp)) < 60000);
        
        if (!existing) {
          const date = moment(parseInt(timestamp)).format('YYYY-MM-DD');
          clockIns.push({
            date,
            time,
            timestamp: parseInt(timestamp),
            location: userData.location || 'Unknown',
            eventType: null
          });
        }
      });
    }
    
    // Extract from events structure
    if (userData.events) {
        Object.entries(userData.events).forEach(([eventType, events]) => {
        if (!events || typeof events !== 'object') return;
        
        Object.entries(events).forEach(([eventId, eventData]) => {
          if (!eventData || typeof eventData !== 'object') return;
          
          if (eventData.attended === true && eventData.attendedAt) {
            const attendedDate = new Date(eventData.attendedAt);
            const timestamp = attendedDate.getTime();
            
            const existing = clockIns.find(ci => Math.abs(ci.timestamp - timestamp) < 60000);
            
            if (!existing) {
              const date = moment(attendedDate).format('YYYY-MM-DD');
              const time = moment(attendedDate).format('hh:mm A');
              const hour = attendedDate.getHours();
              const minute = attendedDate.getMinutes();
              const isLate = hour > 9 || (hour === 9 && minute > 0);
              
              clockIns.push({
                date,
                time,
                timestamp,
                location: eventData.location || 'Unknown',
                isLate,
                eventType,
                eventId,
                title: eventData.title || `${formatEventType(eventType)} - Clock In`
              });
            } else {
              // Update existing with event info
              existing.eventType = eventType;
              existing.eventId = eventId;
              existing.title = eventData.title;
                }
              }
            });
      });
    }
    
    const sortedClockIns = clockIns.sort((a, b) => b.timestamp - a.timestamp);
    console.log(`${DEBUG_PREFIX} Extracted ${sortedClockIns.length} clock-ins`);
    
    return sortedClockIns;
  }, [formatEventType]);

  // Optimized employee data loader
  const loadEmployeeData = useCallback(async (forceRefresh = false) => {
    if (!mountedRef.current || (!userId && !employeeDetails)) {
      console.log(`${DEBUG_PREFIX} No user ID or details available, skipping load`);
      return;
    }
    
    console.log(`${DEBUG_PREFIX} Loading employee data (forceRefresh: ${forceRefresh})`);
    
    // Use provided details if available and not forcing refresh
    if (employeeDetails && !forceRefresh) {
      console.log(`${DEBUG_PREFIX} Using provided employee details`);
      if (mountedRef.current) {
      setEmployeeData(employeeDetails);
      const clockIns = extractRecentClockIns(employeeDetails);
      setRecentClockIns(clockIns);
        setLastRefresh(new Date());
      }
      return;
    }
    
    if (!userId) {
      console.warn(`${DEBUG_PREFIX} No user ID available for data fetch`);
      return;
    }
    
      setLoading(true);
    setError(null);
        
    try {
      console.log(`${DEBUG_PREFIX} Fetching user data for ID: ${userId}`);
        const userData = await attendanceService.fetchUser(userId, forceRefresh);
      
      if (!mountedRef.current) return;
      
      if (userData) {
        console.log(`${DEBUG_PREFIX} Successfully loaded user data`);
          const clockIns = extractRecentClockIns(userData);
          
          setEmployeeData(userData);
          setRecentClockIns(clockIns);
        setLastRefresh(new Date());
        setError(null);
        } else {
        console.error(`${DEBUG_PREFIX} No user data returned`);
        setError('User data not found');
        }
      } catch (error) {
        console.error(`${DEBUG_PREFIX} Error loading employee data:`, error);
      if (mountedRef.current) {
        setError('Failed to load employee data');
      }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
      }
    }
  }, [userId, employeeDetails, extractRecentClockIns]);

  // Memoized stats calculations
  const stats = useMemo(() => {
    if (!employeeData?.stats) return {};
    return employeeData.stats;
  }, [employeeData?.stats]);

  // FIXED: Enhanced attendance stats with comprehensive event matching
  const attendanceStats = useMemo(() => {
    if (!employeeData?.events) return [];
    
    const events = employeeData.events;
    
    console.log(`${DEBUG_PREFIX} Processing attendance stats with events:`, Object.keys(events));
    
    const standardEventTypes = [
      { key: 'workshops', title: 'PO Workshops', displayName: 'PO Workshops (Monthly)', total: 12 },
      { key: 'meetings', title: 'PO Group Meetings', displayName: 'PO Group Meetings', total: 4 },
      { key: 'haciendas', title: 'Haciendas', displayName: 'Haciendas', total: 52 },
      { 
        key: 'juntahacienda', 
        title: 'Junta de Hacienda', 
        displayName: 'Junta de Hacienda', 
        total: 12,
        alternateKeys: ['Junta de Hacienda', 'junta_hacienda', 'juntadehacienda', 'JUNTA_HACIENDA']
      },
      { key: 'gestion', title: 'Gestion', displayName: 'Gestion', total: 12 }
    ];
    
    return standardEventTypes.map(eventTypeInfo => {
      console.log(`${DEBUG_PREFIX} Processing event type: ${eventTypeInfo.key}`);
      
      // Find event data with comprehensive matching
      let eventData = null;
      let matchedKey = null;
      
      // 1. Direct key match
      if (events[eventTypeInfo.key]) {
        eventData = events[eventTypeInfo.key];
        matchedKey = eventTypeInfo.key;
        console.log(`${DEBUG_PREFIX} Direct match found for ${eventTypeInfo.key}`);
      }
      
      // 2. Try alternate keys
      if (!eventData && eventTypeInfo.alternateKeys) {
        for (const altKey of eventTypeInfo.alternateKeys) {
          if (events[altKey]) {
            eventData = events[altKey];
            matchedKey = altKey;
            console.log(`${DEBUG_PREFIX} Alternate key match found: ${altKey} for ${eventTypeInfo.key}`);
            break;
          }
        }
      }
      
      // 3. Normalized key matching (case-insensitive, no spaces/underscores)
      if (!eventData) {
        const normalizedTarget = eventTypeInfo.key.toLowerCase().replace(/[_\s-]/g, '');
        
        // Also try the alternate keys normalized
        const allKeysToTry = [eventTypeInfo.key, ...(eventTypeInfo.alternateKeys || [])];
        
        for (const keyToTry of allKeysToTry) {
          const normalizedKeyToTry = keyToTry.toLowerCase().replace(/[_\s-]/g, '');
          
          const matchingKey = Object.keys(events).find(key => {
            const normalizedExistingKey = key.toLowerCase().replace(/[_\s-]/g, '');
            return normalizedExistingKey === normalizedKeyToTry || normalizedExistingKey === normalizedTarget;
          });
          
          if (matchingKey) {
            eventData = events[matchingKey];
            matchedKey = matchingKey;
            console.log(`${DEBUG_PREFIX} Normalized match found: ${matchingKey} for ${eventTypeInfo.key} (normalized: ${normalizedTarget})`);
            break;
          }
        }
      }
      
      // 4. Special case for juntahacienda - check for variations
      if (!eventData && eventTypeInfo.key === 'juntahacienda') {
        const juntaVariations = [
          'juntadehacienda',
          'junta_de_hacienda', 
          'JUNTA_HACIENDA',
          'juntahacienda',
          'Junta Hacienda',
          'junta hacienda'
        ];
        
        for (const variation of juntaVariations) {
          if (events[variation]) {
            eventData = events[variation];  
            matchedKey = variation;
            console.log(`${DEBUG_PREFIX} Junta variation match found: ${variation}`);
            break;
          }
        }
      }
      
      let eventsArray = [];
      
      if (eventData) {
        console.log(`${DEBUG_PREFIX} Found event data for ${eventTypeInfo.key} under key ${matchedKey}:`, eventData);
        
        if (Array.isArray(eventData)) {
          eventsArray = eventData.map(evt => ({
            ...evt,
            eventType: eventTypeInfo.key,
            scheduled: evt.scheduled === undefined ? true : evt.scheduled,
            attended: evt.attended === true
          }));
        } else if (typeof eventData === 'object') {
          eventsArray = Object.entries(eventData).map(([id, evt]) => ({
            ...evt,
            id,
            eventType: eventTypeInfo.key,
            scheduled: evt.scheduled === undefined ? true : evt.scheduled,
            attended: evt.attended === true
          }));
        }
        
        console.log(`${DEBUG_PREFIX} Processed ${eventsArray.length} events for ${eventTypeInfo.key}:`, 
          eventsArray.map(e => ({ id: e.id, attended: e.attended, scheduled: e.scheduled, date: e.date })));
      } else {
        console.log(`${DEBUG_PREFIX} No event data found for ${eventTypeInfo.key}`);
      }
      
      const pendingEvents = eventsArray.filter(
        e => e.scheduled && !e.attended && !e.markedAbsent
      ).length;
      
      const displayTitle = pendingEvents > 0 
        ? `${eventTypeInfo.displayName} (${pendingEvents} pending)`
        : eventTypeInfo.displayName;
      
      return {
        title: displayTitle,
        data: eventsArray,
        total: eventTypeInfo.total,
        eventType: eventTypeInfo.key
      };
    });
  }, [employeeData?.events]);

  // Memoized calculated stats
  const calculatedStats = useMemo(() => {
    const totalDays = (stats.daysPresent || 0) + (stats.daysAbsent || 0);
    const attendanceRate = totalDays ? ((stats.daysPresent || 0) / totalDays) * 100 : 0;
    const daysLateRate = stats.daysPresent ? ((stats.daysLate || 0) / stats.daysPresent) * 100 : 0;
    const totalHours = stats.totalHours ? Math.round(stats.totalHours) : 0;
    
    const lastClockIn = stats.lastClockIn
      ? moment(stats.lastClockIn).format('MMM D, YYYY h:mm A')
      : 'N/A';
    const lastClockOut = stats.lastClockOut
      ? moment(stats.lastClockOut).format('MMM D, YYYY h:mm A')
      : 'N/A';
    
    return {
      attendanceRate: attendanceRate.toFixed(1),
      onTimeRate: (100 - daysLateRate).toFixed(1),
      totalHours,
      lastClockIn,
      lastClockOut
    };
  }, [stats]);

  // Initialize component
  useEffect(() => {
    mountedRef.current = true;
    console.log(`${DEBUG_PREFIX} Component mounted`);
    
    return () => {
      mountedRef.current = false;
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current = [];
      console.log(`${DEBUG_PREFIX} Component unmounted and cleaned up`);
    };
  }, []);

  // Load event types on mount
  useEffect(() => {
    if (mountedRef.current) {
    fetchEventTypes();
    }
  }, [fetchEventTypes]);

  // Load employee data when event types are ready
  useEffect(() => {
    if (!loadingEventTypes && eventTypesLoadedRef.current && mountedRef.current) {
      loadEmployeeData();
    }
  }, [loadingEventTypes, loadEmployeeData]);

  // Setup event subscriptions
  useEffect(() => {
    if (!userId || loadingEventTypes) {
      console.log(`${DEBUG_PREFIX} Skipping event subscriptions (no userId or loading)`);
      return;
    }
    
    console.log(`${DEBUG_PREFIX} Setting up event subscriptions for user: ${userId}`);
    
    subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
    subscriptionsRef.current = [];
    
    const isEventForUser = (eventData) => {
      const eventUserId = eventData.userId || eventData.id || (eventData.user && eventData.user.id);
      return eventUserId === userId || !eventUserId;
    };
    
    const events = [
      EVENTS.USER_DATA_UPDATED,
      EVENTS.ATTENDANCE_UPDATED,
      EVENTS.EVENT_UPDATED,
      EVENTS.DASHBOARD_DATA_UPDATED
    ];
    
    events.forEach(eventName => {
      const unsubscribe = eventBus.subscribe(eventName, (data) => {
        console.log(`${DEBUG_PREFIX} Received ${eventName}:`, data);
        
        if (isEventForUser(data) && mountedRef.current) {
          console.log(`${DEBUG_PREFIX} Event matches our user, refreshing data`);
          loadEmployeeData(true);
          setEventCount(prev => prev + 1);
        }
      });
      
      subscriptionsRef.current.push(unsubscribe);
    });
    
    return () => {
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [userId, loadingEventTypes, loadEmployeeData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    console.log(`${DEBUG_PREFIX} Manual refresh triggered`);
    setError(null);
    fetchEventTypes();
    loadEmployeeData(true);
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh, fetchEventTypes, loadEmployeeData]);

  // Helper function for score colors
  const getScoreClass = useCallback((score) => {
    const numScore = parseFloat(score);
    if (numScore >= 95) return 'text-emerald-400';
    if (numScore >= 85) return 'text-green-400';
    if (numScore >= 75) return 'text-teal-400';
    if (numScore >= 65) return 'text-yellow-400';
    if (numScore >= 55) return 'text-orange-400';
    if (numScore >= 45) return 'text-red-400';
    return 'text-red-600';
  }, []);

  // Memoized stat items
  const statItems = useMemo(() => [
    {
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      title: 'Attendance Rate',
      value: `${calculatedStats.attendanceRate}%`,
      scoreClass: getScoreClass(calculatedStats.attendanceRate),
      period: 'Overall'
    },
    {
      icon: <Clock className="w-5 h-5 text-purple-400" />,
      title: 'On-Time Rate',
      value: `${calculatedStats.onTimeRate}%`,
      scoreClass: getScoreClass(calculatedStats.onTimeRate),
      period: 'Overall'
    },
    {
      icon: <Calendar className="w-5 h-5 text-green-400" />,
      title: 'Days Present',
      value: stats.daysPresent || 0,
      period: 'Total'
    },
    {
      icon: <ChartBar className="w-5 h-5 text-yellow-400" />,
      title: 'Total Hours',
      value: calculatedStats.totalHours,
      period: 'Accumulated'
    }
  ], [calculatedStats, stats, getScoreClass]);

  // Loading state
  if ((loading || loadingEventTypes) && !employeeData) {
    return (
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-8 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-white/70">Loading employee data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !employeeData) {
    return (
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-8 flex justify-center items-center">
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mb-4" />
          <div className="text-white/70 mb-4">{error}</div>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!employeeData) {
    return (
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-8 flex justify-center items-center">
        <div className="text-white/70">No employee data available</div>
      </div>
    );
  }

  // Timeline Box component
  const TimelineBox = ({ isAttended, date, tooltipContent, isScheduled, attendanceStatus }) => {
    let backgroundClass = '';
    let borderClass = '';
    let textClass = '';
    let icon = null;

    if (isScheduled) {
      if (attendanceStatus === 'pending') {
        backgroundClass = 'bg-orange-500/20';
        borderClass = 'border-orange-500/30';
        textClass = 'text-orange-400';
        icon = <Clock className="w-4 h-4" />;
      } else if (isAttended) {
        backgroundClass = 'bg-green-500/20';
        borderClass = 'border-green-500/30';
        textClass = 'text-green-400';
        icon = <CheckSquare className="w-4 h-4" />;
      } else {
        backgroundClass = 'bg-red-500/20';
        borderClass = 'border-red-500/30';
        textClass = 'text-red-400';
        icon = <XSquare className="w-4 h-4" />;
      }
    } else {
      backgroundClass = 'bg-slate-800/50';
      borderClass = 'border-slate-700/30';
      textClass = 'text-slate-600';
    }

    const displayDate = date ? moment(date).format('DD/MM') : '';

    return (
      <div className="flex flex-col items-center mb-1">
        <div className={`w-6 h-6 border relative group ${backgroundClass} ${borderClass} ${textClass}
          flex items-center justify-center text-xs rounded-md cursor-help`}>
          {icon || (isScheduled ? (isAttended ? '✓' : attendanceStatus === 'pending' ? '⏱' : '✗') : '-')}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
            px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100
            transition pointer-events-none whitespace-nowrap z-10 border border-slate-600">
            {tooltipContent}
          </div>
        </div>
        {displayDate && <div className="text-xs text-slate-400 mt-1">{displayDate}</div>}
      </div>
    );
  };

  // Registry Section component
  const RegistrySection = ({ title, events = [], total = 0, eventType }) => {
    const eventsArray = Array.isArray(events) ? events : [];
    const scheduledEvents = eventsArray.filter(e => e.scheduled);
    const pendingEvents = scheduledEvents.filter(e => e.scheduled && !e.attended && !e.markedAbsent);
    const nonPendingEvents = scheduledEvents.filter(e => e.attended !== undefined || e.markedAbsent);
    const attendancePercentage = nonPendingEvents.length > 0
      ? ((nonPendingEvents.filter(e => e.attended).length / nonPendingEvents.length) * 100).toFixed(1)
        : 0;

    return (
      <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-medium text-white/80">{title}</h4>
          <div className="flex items-center gap-2">
            {pendingEvents.length > 0 && (
              <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full">
                {pendingEvents.length} Pending
              </span>
            )}
            <span className="text-xs text-white/50">Attendance: {attendancePercentage}%</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: total }).map((_, index) => {
            const event = eventsArray[index] || {};

            let attendanceStatus = 'none';
            if (event.scheduled) {
              if (event.attended === true) {
                attendanceStatus = 'attended';
              } else if (event.markedAbsent === true || event.attended === false) {
                attendanceStatus = 'absent';
              } else {
                attendanceStatus = 'pending';
              }
            }

            const tooltipContent = event.date
              ? `${moment(event.date).format('MMM D, YYYY')}: ${
                  event.scheduled
                    ? attendanceStatus === 'pending'
                      ? 'Pending attendance'
                      : attendanceStatus === 'attended'
                      ? 'Attended'
                      : 'Absent'
                    : 'Not scheduled'
                }${event.title ? ` - ${event.title}` : ''}${eventType ? ` (${formatEventType(eventType)})` : ''}`
              : 'Not scheduled yet';

            return (
              <TimelineBox
                key={index}
                isAttended={event.attended || false}
                isScheduled={event.scheduled || false}
                attendanceStatus={attendanceStatus}
                date={event.date}
                tooltipContent={tooltipContent}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          Registry
          {loadingEventTypes && (
            <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded-full flex items-center gap-1">
              <RefreshCw size={10} className="animate-spin" />
              Loading...
            </span>
          )}
          {error && (
            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded-full flex items-center gap-1">
              <AlertCircle size={10} />
              Error
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-gray-400 italic">Refreshing...</span>}
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-1 text-sm bg-blue-600 px-3 py-1 rounded text-white hover:bg-blue-700 disabled:opacity-50"
            title={`Last refresh: ${lastRefresh.toLocaleTimeString()}`}
            disabled={loading || loadingEventTypes}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
        {statItems.map((stat, index) => (
          <div
            key={index}
            className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-lg p-4
                       hover:-translate-y-1 transition-transform duration-300"
          >
            <div className="flex items-center gap-3 mb-3">
              {stat.icon}
              <h3 className="text-sm font-medium text-white/70">{stat.title}</h3>
            </div>
            <div className={`font-mono text-2xl font-semibold mb-2 ${stat.scoreClass || 'text-white/90'}`}>
              {stat.value}
            </div>
            <div className="text-xs text-white/50">{stat.period}</div>
          </div>
        ))}
      </div>

      {/* Event Registry */}
      <div className="p-6 space-y-6 border-t border-slate-700">
        {attendanceStats.map((section, index) => (
          <RegistrySection
            key={`${section.eventType}-${index}`}
            title={section.title}
            events={section.data}
            total={section.total}
            eventType={section.eventType}
          />
        ))}
      </div>

      {/* Additional Insights */}
      <div className="grid md:grid-cols-2 gap-6 p-6 border-t border-slate-700">
        {/* Attendance Details */}
        <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Attendance Overview</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-white/50 mb-1">Present</div>
              <div className="font-mono text-lg font-medium text-white/90">
                {stats.daysPresent || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Late</div>
              <div className="font-mono text-lg font-medium text-red-400">
                {stats.daysLate || 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Absent</div>
              <div className="font-mono text-lg font-medium text-orange-400">
                {stats.daysAbsent || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/80 backdrop-blur rounded-lg p-4">
          <h4 className="text-sm font-medium text-white/80 mb-4">Recent Activity</h4>
          <div className="space-y-3">
            {stats.lastClockIn && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Last clock in: {calculatedStats.lastClockIn}</span>
              </div>
            )}
            {stats.lastClockOut && (
              <div className="flex items-center gap-2 text-sm text-white/70 bg-slate-800/50 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-green-400" />
                <span>Last clock out: {calculatedStats.lastClockOut}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Attendance Records - Replaces Clock-in History */}
      <AttendanceSection 
        employeeId={userId || employeeId || employeeData?.id}
        attendanceRecords={[]}
        deleteConfirm={null}
        onDeleteRecord={() => {}}
      />
      
      {/* Debug Info - Only show in development */}
      {process.env.NODE_ENV !== 'production' && employeeData?.events && (
        <div className="p-6 border-t border-slate-700 bg-slate-900/50">
          <h4 className="text-sm font-medium text-white/80 mb-4">🔍 Debug: Event Data Structure</h4>
          <div className="bg-slate-800/80 rounded-lg p-4 overflow-x-auto">
            <div className="text-xs text-white/70 mb-2">Available event keys in database:</div>
            <div className="text-xs text-green-400 font-mono mb-4">
              {Object.keys(employeeData.events).join(', ')}
            </div>
            
            {Object.entries(employeeData.events).map(([key, data]) => {
              const eventCount = Array.isArray(data) ? data.length : (typeof data === 'object' ? Object.keys(data).length : 0);
              const attendedCount = Array.isArray(data) 
                ? data.filter(e => e.attended === true).length
                : (typeof data === 'object' 
                    ? Object.values(data).filter(e => e.attended === true).length 
                    : 0);
              
              return (
                <div key={key} className="text-xs text-white/50 mb-1">
                  <span className="text-blue-400">{key}</span>: {eventCount} events, {attendedCount} attended
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 flex justify-between items-center">
        <span className="text-xs text-white/40">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </span>
        
        {process.env.NODE_ENV !== 'production' && (
          <div className="text-xs text-white/40">
            Events: {eventCount} | User: {userId || 'N/A'} | Types: {Object.keys(eventTypes).length}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsSection;
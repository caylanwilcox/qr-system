// src/components/Scheduler/context/hooks/useUIState.js
import { useState } from 'react';

export const useUIState = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('week');
  const [date, setDate] = useState(new Date());
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  return {
    loading,
    setLoading,
    error,
    setError,
    view,
    setView,
    date,
    setDate,
    showEventDialog,
    setShowEventDialog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    isInitialLoad,
    setIsInitialLoad
  };
};
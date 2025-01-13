// src/components/Scheduler/SchedulerContainer.js
import React from 'react';
import { useAuth } from '../../services/authContext';
import AdminScheduler from './components/AdminScheduler';
import EmployeeScheduler from './components/EmployeeScheduler';

const SchedulerContainer = () => {
  const { user } = useAuth();

  // Render different scheduler views based on user role
  const renderSchedulerView = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return <AdminScheduler />;
      case 'EMPLOYEE':
        return <EmployeeScheduler />;
      default:
        return <div>Unauthorized access</div>;
    }
  };

  return (
    <div className="h-full">
      {renderSchedulerView()}
    </div>
  );
};

export default SchedulerContainer;
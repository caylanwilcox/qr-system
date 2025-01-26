// src/components/UserProfile/Alert.js
import React from 'react';

const Alert = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-500/10 text-blue-500',
    destructive: 'bg-red-500/10 text-red-500'
  };

  return (
    <div className={`flex items-center gap-2 p-4 rounded-lg ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default Alert;
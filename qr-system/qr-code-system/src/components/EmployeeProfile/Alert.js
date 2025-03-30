// src/components/EmployeeProfile/Alert.js
import React from 'react';

const Alert = ({ children, variant = 'default', className = '', ...props }) => {
  // Tailwind classes for different variants
  const variantClasses = {
    default: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    destructive: 'bg-red-500/20 text-red-400 border-red-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <div 
      className={`flex items-center gap-2 p-4 rounded-lg border ${variantClasses[variant]} ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

export default Alert;
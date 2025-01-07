import React from 'react';

const Alert = ({ children, variant = 'default', className = '' }) => {
  const baseStyles = 'flex items-center gap-2 p-4 rounded-lg';
  
  const variantStyles = {
    default: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    destructive: 'bg-red-500/20 text-red-400 border border-red-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30'
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

export default Alert;

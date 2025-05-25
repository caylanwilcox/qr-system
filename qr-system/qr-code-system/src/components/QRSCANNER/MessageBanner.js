// src/components/QRSCANNER/MessageBanner.js
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

/**
 * Enhanced message banner with auto-dismiss and message type styling
 * 
 * @param {Object} props
 * @param {string} props.message - Message to display
 * @param {string} props.type - Message type ('success', 'error', 'info')
 * @param {number} props.duration - Auto-dismiss duration in ms (0 to disable)
 * @param {function} props.onDismiss - Optional callback when message is dismissed
 */
const MessageBanner = ({ 
  message, 
  type = 'info', 
  duration = 0, 
  onDismiss 
}) => {
  const [visible, setVisible] = useState(!!message);
  
  // Auto-dismiss timer
  useEffect(() => {
    if (message) {
      setVisible(true);
      
      // Auto-dismiss if duration is set
      if (duration > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          if (onDismiss) onDismiss();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [message, duration, onDismiss]);
  
  // Don't render if no message or not visible
  if (!message || !visible) return null;
  
  // Determine background and icon based on type
  const getBannerStyles = () => {
    switch(type) {
      case 'success':
        return {
          bgColor: 'bg-green-500 bg-opacity-20',
          borderColor: 'border-green-500 border-opacity-30',
          textColor: 'text-green-400',
          icon: <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
        };
      case 'error':
        return {
          bgColor: 'bg-red-500 bg-opacity-20',
          borderColor: 'border-red-500 border-opacity-30',
          textColor: 'text-red-400',
          icon: <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
        };
      case 'info':
      default:
        return {
          bgColor: 'bg-white bg-opacity-10',
          borderColor: 'border-white border-opacity-20',
          textColor: 'text-white',
          icon: null
        };
    }
  };
  
  const { bgColor, borderColor, textColor, icon } = getBannerStyles();
  
  return (
    <div 
      className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-4 text-center ${textColor} max-w-lg mx-auto flex items-center justify-center`}
      data-testid="message-banner"
    >
      {icon}
      <div className="flex-grow">{message}</div>
      {onDismiss && (
        <button 
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="ml-2 text-white text-opacity-70 hover:text-opacity-100"
          aria-label="Dismiss message"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default MessageBanner;
// src/components/Scheduler/utils/eventStyles.js
export const eventStyleGetter = (event) => {
    const style = {
      backgroundColor: event.color || '#3b82f6',
      borderRadius: '4px',
      opacity: 0.95,
      color: '#fff',
      border: 'none',
      display: 'block'
    };
  
    // Add different styles based on event properties
    if (event.isUrgent) {
      style.backgroundColor = '#ef4444';
    } else if (event.isOptional) {
      style.backgroundColor = '#8b5cf6';
    } else if (event.isCompleted) {
      style.backgroundColor = '#10b981';
    }
  
    return {
      style,
      className: `event-${event.type || 'default'}`
    };
  };
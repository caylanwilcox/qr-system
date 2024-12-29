// CollapsibleSection.jsx
import React, { useState } from 'react';

const CollapsibleSection = ({ title, children, defaultExpanded = false, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`card ${className}`}>
      <div 
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>{title}</h2>
        <div className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </div>
      </div>
      <div className={`section-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="section-inner">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
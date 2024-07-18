// ErrorLog.js
import React from 'react';
import './ErrorLog.css';

const ErrorLog = ({ errors }) => {
  return (
    <div className="error-log">
      <h2>Error Log</h2>
      <ul>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

export default ErrorLog;

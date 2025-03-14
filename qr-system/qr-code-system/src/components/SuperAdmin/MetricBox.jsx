import React from "react";
import "./MetricBox.css";

const MetricBox = ({ title, value, className }) => {
  return (
    <div className={`metric-box ${className || ""}`}>
      <h3 className="metric-title">{title}</h3>
      <div className="metric-content">
        <p className="metric-number">{value}</p>
      </div>
    </div>
  );
};

export default MetricBox;
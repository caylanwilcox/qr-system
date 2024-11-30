import React from "react";
import "./EmployeeRanks.css";

const EmployeeRanks = ({ employeeRanksByLocation }) => {
  return (
    <div className="employee-ranks">
      {Object.entries(employeeRanksByLocation).map(([location, ranks]) => (
        <div key={location} className="location-rank">
          <h4 className="rank-title">{location}</h4>
          <p className="rank-detail">Junior: {ranks.junior}</p>
          <p className="rank-detail">Intermediate: {ranks.intermediate}</p>
          <p className="rank-detail">Senior: {ranks.senior}</p>
        </div>
      ))}
    </div>
  );
};

export default EmployeeRanks;

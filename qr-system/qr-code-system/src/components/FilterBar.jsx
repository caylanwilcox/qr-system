import React from "react";
import "./FilterBar.css";

const FilterBar = ({ activeTab, tabs, onTabClick }) => {
  return (
    <nav className="filter-bar">
      <ul>
        {tabs.map((tab) => (
          <li
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => onTabClick(tab)}
          >
            {tab}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default FilterBar;

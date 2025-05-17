import React from 'react';
import ReportsContainer from './ReportsContainer';

const Reports = ({ locationFiltered = false }) => {
  return <ReportsContainer locationFiltered={locationFiltered} />;
};

export default Reports;
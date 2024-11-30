import { Tooltip } from "react-tooltip";

const tileContent = ({ date, view }) => {
  if (view === 'month') {
    const formattedDate = date.toISOString().split('T')[0];
    if (assignedDates.includes(formattedDate)) {
      return (
        <div data-tooltip-id="calendar-tooltip" data-tooltip-content={`Assigned to ${employeeDetails.name}`}></div>
      );
    }
  }
  return null;
};

<Tooltip id="calendar-tooltip" />

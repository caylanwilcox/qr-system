// src/utils/padrinoColorCalculator.js

// Export color constants for consistency
export const PADRINO_COLORS = {
  BLUE: "blue",   // Highest level
  GREEN: "green", // Second level
  ORANGE: "orange", // Third level
  RED: "red"      // Lowest level
};

/**
 * Calculates padrino color eligibility based on attendance percentages
 * 
 * Requirements:
 * - Haciendas: minimum 95% attendance
 * - Workshops: minimum 60% attendance
 * - Group Meetings: 100% attendance
 * 
 * @param {Object} userData - The user's data including events
 * @returns {Object} - Contains eligibility status and color recommendation
 */
export const calculatePadrinoColor = (userData) => {
  // Default return structure
  const result = {
    eligible: false,
    color: PADRINO_COLORS.RED, // Default to lowest color
    requirements: {
      haciendas: { required: 95, actual: 0, met: false },
      workshops: { required: 60, actual: 0, met: false },
      meetings: { required: 100, actual: 0, met: false }
    },
    allRequirementsMet: false
  };

  // Guard clause if no user data or events
  if (!userData || !userData.events) {
    return result;
  }

  const { events } = userData;

  // Calculate haciendas attendance (min 95%)
  if (events.haciendas) {
    const haciendas = Object.values(events.haciendas);
    const attendedHaciendas = haciendas.filter(event => event.attended).length;
    const totalHaciendas = haciendas.length;
    
    if (totalHaciendas > 0) {
      const attendanceRate = (attendedHaciendas / totalHaciendas) * 100;
      result.requirements.haciendas.actual = parseFloat(attendanceRate.toFixed(1));
      result.requirements.haciendas.met = attendanceRate >= result.requirements.haciendas.required;
    }
  }

  // Calculate workshops attendance (min 60%)
  if (events.workshops) {
    const workshops = Object.values(events.workshops);
    const attendedWorkshops = workshops.filter(event => event.attended).length;
    const totalWorkshops = workshops.length;
    
    if (totalWorkshops > 0) {
      const attendanceRate = (attendedWorkshops / totalWorkshops) * 100;
      result.requirements.workshops.actual = parseFloat(attendanceRate.toFixed(1));
      result.requirements.workshops.met = attendanceRate >= result.requirements.workshops.required;
    }
  }

  // Calculate meetings attendance (must be 100%)
  if (events.meetings) {
    const meetings = Object.values(events.meetings);
    const attendedMeetings = meetings.filter(event => event.attended).length;
    const totalMeetings = meetings.length;
    
    if (totalMeetings > 0) {
      const attendanceRate = (attendedMeetings / totalMeetings) * 100;
      result.requirements.meetings.actual = parseFloat(attendanceRate.toFixed(1));
      result.requirements.meetings.met = attendanceRate >= result.requirements.meetings.required;
    }
  }

  // Check if all requirements are met
  result.allRequirementsMet = 
    result.requirements.haciendas.met && 
    result.requirements.workshops.met && 
    result.requirements.meetings.met;

  // Determine color based on attendance percentages
  // Color progression: red (lowest) -> orange -> green -> blue (highest)
  const haciendaAttendance = result.requirements.haciendas.actual;
  const workshopAttendance = result.requirements.workshops.actual;
  const meetingAttendance = result.requirements.meetings.actual;
  
  // Default color is red (lowest)
  result.color = PADRINO_COLORS.RED;
  
  // If all requirements are met, eligible for padrino status
  result.eligible = result.allRequirementsMet;
  
  // Color determination logic (from lowest to highest)
  // Basic requirements met - Orange
  if (haciendaAttendance >= 95 && workshopAttendance >= 60 && meetingAttendance === 100) {
    result.color = PADRINO_COLORS.ORANGE;
  }
  
  // Higher performance - Green
  if (haciendaAttendance >= 98 && workshopAttendance >= 75 && meetingAttendance === 100) {
    result.color = PADRINO_COLORS.GREEN;
  }
  
  // Outstanding performance - Blue (highest level)
  if (haciendaAttendance >= 99 && workshopAttendance >= 10 && meetingAttendance === 10) {
    result.color = PADRINO_COLORS.BLUE;
  }

  return result;
};

/**
 * Determines if a user is eligible for padrino status
 * 
 * @param {Object} userData - The user's data including events
 * @returns {boolean} - Whether the user is eligible
 */
export const isPadrinoEligible = (userData) => {
  const result = calculatePadrinoColor(userData);
  return result.eligible;
};
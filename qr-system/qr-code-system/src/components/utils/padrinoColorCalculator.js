// Padrino color calculation utilities

export const PADRINO_COLORS = {
  BLUE: 'blue',
  GREEN: 'green',
  ORANGE: 'orange',
  RED: 'red'
};

/**
 * Calculate the appropriate padrino color based on user attendance and activity
 * @param {Object} userData - User data from Firebase containing events and profile
 * @returns {Object} - Object containing eligibility, color, and requirements breakdown
 */
export const calculatePadrinoColor = (userData) => {
  if (!userData || !userData.events) {
    return {
      eligible: false,
      color: PADRINO_COLORS.BLUE,
      requirements: {
        haciendas: { required: 95, actual: 0, met: false },
        workshops: { required: 60, actual: 0, met: false },
        meetings: { required: 100, actual: 0, met: false }
      },
      allRequirementsMet: false
    };
  }

  const events = userData.events;
  
  // Initialize counters
  let haciendasTotal = 0;
  let haciendasAttended = 0;
  let workshopsTotal = 0;
  let workshopsAttended = 0;
  let meetingsTotal = 0;
  let meetingsAttended = 0;

  // Count haciendas events
  if (events.haciendas) {
    Object.values(events.haciendas).forEach(event => {
      if (event && typeof event === 'object') {
        haciendasTotal++;
        if (event.attended === true) {
          haciendasAttended++;
        }
      }
    });
  }

  // Count workshops events
  if (events.workshops) {
    Object.values(events.workshops).forEach(event => {
      if (event && typeof event === 'object') {
        workshopsTotal++;
        if (event.attended === true) {
          workshopsAttended++;
        }
      }
    });
  }

  // Count meetings events (group meetings)
  if (events.groupMeetings || events.meetings) {
    const meetingEvents = events.groupMeetings || events.meetings;
    Object.values(meetingEvents).forEach(event => {
      if (event && typeof event === 'object') {
        meetingsTotal++;
        if (event.attended === true) {
          meetingsAttended++;
        }
      }
    });
  }

  // Calculate percentages
  const haciendasRate = haciendasTotal > 0 ? (haciendasAttended / haciendasTotal) * 100 : 0;
  const workshopsRate = workshopsTotal > 0 ? (workshopsAttended / workshopsTotal) * 100 : 0;
  const meetingsRate = meetingsTotal > 0 ? (meetingsAttended / meetingsTotal) * 100 : 0;

  // Define requirements
  const requirements = {
    haciendas: { 
      required: 95, 
      actual: Math.round(haciendasRate * 10) / 10, 
      met: haciendasRate >= 95 
    },
    workshops: { 
      required: 60, 
      actual: Math.round(workshopsRate * 10) / 10, 
      met: workshopsRate >= 60 
    },
    meetings: { 
      required: 100, 
      actual: Math.round(meetingsRate * 10) / 10, 
      met: meetingsRate >= 100 
    }
  };

  // Check if all requirements are met
  const allRequirementsMet = requirements.haciendas.met && 
                           requirements.workshops.met && 
                           requirements.meetings.met;

  // Determine color based on performance
  let color = PADRINO_COLORS.RED; // Default to red

  if (allRequirementsMet) {
    // All requirements met - Blue (highest)
    color = PADRINO_COLORS.BLUE;
  } else if (requirements.haciendas.met && requirements.workshops.met) {
    // Haciendas and workshops met - Green
    color = PADRINO_COLORS.GREEN;
  } else if (requirements.haciendas.met || (requirements.workshops.met && requirements.meetings.met)) {
    // Either haciendas met OR both workshops and meetings met - Orange
    color = PADRINO_COLORS.ORANGE;
  } else {
    // Minimum requirements not met - Red
    color = PADRINO_COLORS.RED;
  }

  return {
    eligible: allRequirementsMet,
    color,
    requirements,
    allRequirementsMet
  };
};

/**
 * Get color display name
 * @param {string} color - Color code
 * @returns {string} - Formatted color name
 */
export const getColorDisplayName = (color) => {
  if (!color) return 'Blue';
  return color.charAt(0).toUpperCase() + color.slice(1);
};

/**
 * Get CSS classes for a padrino color
 * @param {string} color - Color code
 * @returns {string} - CSS classes
 */
export const getColorClasses = (color) => {
  switch (color) {
    case PADRINO_COLORS.RED:
      return 'bg-red-500/20 text-red-500 border-red-500/30';
    case PADRINO_COLORS.ORANGE:
      return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    case PADRINO_COLORS.GREEN:
      return 'bg-green-500/20 text-green-500 border-green-500/30';
    case PADRINO_COLORS.BLUE:
    default:
      return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
  }
};

export const getColorClass = (color) => {
    const colors = {
      blue: 'text-blue-500',
      green: 'text-green-500',
      red: 'text-red-500',
      orange: 'text-orange-500',
    };
    return colors[color?.toLowerCase()] || 'text-gray-500';
  };
  
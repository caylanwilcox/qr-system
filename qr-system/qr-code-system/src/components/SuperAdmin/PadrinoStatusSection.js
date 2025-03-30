
//src/components/SuperAdmin/PadrinoStatusSection.js
import React, { useEffect, useState } from 'react';
import { Award, AlertCircle, CheckCircle, X } from 'lucide-react';
import { calculatePadrinoColor, PADRINO_COLORS } from '../utils/padrinoColorCalculator';

const PadrinoStatusSection = ({ userData, formData, onPadrinoChange, onPadrinoColorChange, editMode }) => {
  const [padrinoStatus, setPadrinoStatus] = useState({
    eligible: false,
    color: PADRINO_COLORS.BLUE,
    requirements: {
      haciendas: { required: 95, actual: 0, met: false },
      workshops: { required: 60, actual: 0, met: false },
      meetings: { required: 100, actual: 0, met: false }
    },
    allRequirementsMet: false
  });
  
  const [autoCalculate, setAutoCalculate] = useState(false);

  // Calculate padrino status when userData changes
  useEffect(() => {
    if (userData && userData.events) {
      const status = calculatePadrinoColor(userData);
      setPadrinoStatus(status);
      
      // If in auto mode, update the color based on calculations
      if (autoCalculate && formData.padrino) {
        onPadrinoColorChange({ target: { value: status.color } });
      }
    }
  }, [userData, autoCalculate, onPadrinoColorChange, formData.padrino]);

  // Get color display name
  const getColorDisplayName = (color) => {
    return color.charAt(0).toUpperCase() + color.slice(1);
  };

  // Get CSS classes for color display
  const getColorClasses = (color) => {
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

  // Get requirement status display
  const getRequirementStatus = (requirement) => {
    if (!requirement.actual) return 'Not enough data';
    if (requirement.met) return `${requirement.actual}% ✓`;
    return `${requirement.actual}% (${requirement.required}% required) ✗`;
  };

  // Toggle auto-calculate mode
  const handleAutoCalculateToggle = () => {
    const newValue = !autoCalculate;
    setAutoCalculate(newValue);
    
    // If turning on auto-calculate, immediately update color
    if (newValue && formData.padrino) {
      onPadrinoColorChange({ target: { value: padrinoStatus.color } });
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white/90 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-400" />
          Padrino Status
        </h3>
        
        <div className="flex items-center">
          <label className="relative inline-flex items-center cursor-pointer mr-3">
            <input
              type="checkbox"
              checked={formData.padrino}
              onChange={onPadrinoChange}
              className="sr-only peer"
              disabled={!editMode}
            />
            <div className={`w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer 
              ${formData.padrino ? 'peer-checked:after:translate-x-full peer-checked:bg-blue-600' : ''}
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:border-gray-300 after:border after:rounded-full 
              after:h-5 after:w-5 after:transition-all`}>
            </div>
            <span className="ml-2 text-sm font-medium text-white/70">
              {formData.padrino ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      <div className="p-4">
        {formData.padrino ? (
          <>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white/70">Color Selection</h4>
                <label className="flex items-center text-sm text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCalculate}
                    onChange={handleAutoCalculateToggle}
                    className="mr-2 h-4 w-4"
                    disabled={!editMode}
                  />
                  Auto-calculate
                </label>
              </div>
              
              {editMode ? (
                <div className="grid grid-cols-4 gap-2">
                  {Object.values(PADRINO_COLORS).map((color) => (
                    <div 
                      key={color}
                      onClick={() => !autoCalculate && onPadrinoColorChange({ target: { value: color } })}
                      className={`border rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer
                        ${color === formData.padrinoColor ? 'ring-2 ring-white/30' : ''}
                        ${getColorClasses(color)}
                        ${autoCalculate ? 'opacity-50 cursor-not-allowed' : 'hover:ring-2 hover:ring-white/30'}`}
                    >
                      <Award className="w-6 h-6 mb-1" />
                      <span className="text-sm">{getColorDisplayName(color)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`border rounded-lg p-3 flex items-center ${getColorClasses(formData.padrinoColor)}`}>
                  <Award className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">{getColorDisplayName(formData.padrinoColor || PADRINO_COLORS.BLUE)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-white/70 mb-3">Attendance Requirements</h4>
              
              <div className="space-y-3">
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.haciendas.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Haciendas (min 95%)</span>
                    <span className={padrinoStatus.requirements.haciendas.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.haciendas)}
                    </span>
                  </div>
                </div>
                
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.workshops.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Workshops (min 60%)</span>
                    <span className={padrinoStatus.requirements.workshops.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.workshops)}
                    </span>
                  </div>
                </div>
                
                <div className={`rounded-lg p-3 border ${padrinoStatus.requirements.meetings.met ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80">Group Meetings (100%)</span>
                    <span className={padrinoStatus.requirements.meetings.met ? 'text-green-400' : 'text-white/60'}>
                      {getRequirementStatus(padrinoStatus.requirements.meetings)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={`mt-4 p-3 rounded-lg border ${padrinoStatus.eligible ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <div className="flex items-center">
                  {padrinoStatus.eligible ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-400 mr-2" />
                  )}
                  <span className={padrinoStatus.eligible ? 'text-green-400' : 'text-yellow-400'}>
                    {padrinoStatus.eligible 
                      ? 'All requirements met! Eligible for Padrino status.' 
                      : 'Some requirements not met. See above for details.'}
                  </span>
                </div>
                
                {padrinoStatus.eligible && autoCalculate && (
                  <div className="mt-2 text-sm text-white/60">
                    Recommended color: <span className={`font-semibold ${getColorClasses(padrinoStatus.color).split(' ')[1]}`}>{getColorDisplayName(padrinoStatus.color)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-white/60">
            <X className="w-8 h-8 mb-2" />
            <p>Padrino status is currently disabled.</p>
            <p className="text-sm mt-1">Enable it to manage colors and view requirements.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PadrinoStatusSection;
import React, { useRef, useState } from 'react';
import { Download, BadgeCheck, User, Calendar, Shield, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';

// Card Components
const CardContainer = ({ children, className = '' }) => (
  <div className={`bg-glass backdrop-blur border border-glass-light rounded-lg p-6 ${className}`}>
    {children}
  </div>
);

const CardSide = ({ isBack = false, children, isFlipped }) => (
  <div className={`absolute inset-0 w-full h-full transition-all duration-700 preserve-3d 
    ${isBack ? 'backface-hidden rotate-y-180' : 'backface-hidden'}
    ${isFlipped ? (isBack ? 'rotate-y-0' : 'rotate-y-180') : ''}`}>
    {children}
  </div>
);

const IdCard = ({ employeeDetails, employeeId, onDownload }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef(null);

  const getRoleStyles = (role) => {
    const baseStyles = 'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium';
    switch (role?.toLowerCase()) {
      case 'admin':
        return `${baseStyles} bg-blue-500/20 text-blue-400 border border-blue-500/30`;
      case 'super_admin':
        return `${baseStyles} bg-purple-500/20 text-purple-400 border border-purple-500/30`;
      default:
        return `${baseStyles} bg-glass-light text-white/70 border border-glass-light`;
    }
  };

  const handleFlip = () => setIsFlipped(!isFlipped);

  const CardHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <div className="text-xl font-semibold text-white/90">Agua Viva Church</div>
      <BadgeCheck className="w-6 h-6 text-blue-400" />
    </div>
  );

  const CardContent = () => (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-glass-dark 
                      border-2 border-glass-light flex items-center justify-center text-xl font-semibold text-white/90">
          {employeeDetails.name?.[0]?.toUpperCase()}
        </div>
        <div className={getRoleStyles(employeeDetails.role)}>
          <Shield className="w-3 h-3" />
          {employeeDetails.role === 'admin' ? 'Admin' : 'Member'}
        </div>
      </div>

      <div className="flex-1 space-y-1">
        <h3 className="text-lg font-semibold text-white/90">{employeeDetails.name}</h3>
        <p className="text-sm text-white/70">{employeeDetails.position || 'Member'}</p>
        <p className="text-sm text-white/70">{employeeDetails.department || 'General'}</p>
        <p className="text-sm text-white/70">{employeeDetails.location}</p>
      </div>
    </div>
  );

  const CardFooter = () => (
    <div className="mt-4 pt-4 border-t border-glass-light flex justify-between items-center text-xs text-white/60">
      <span>ID: {employeeId}</span>
      <span>Valid until: {format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'MM/dd/yyyy')}</span>
    </div>
  );

  const BackContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-white/80">Emergency Contact</h4>
        <p className="text-sm text-white/70">{employeeDetails.emergencyContact || 'Not Provided'}</p>
        <p className="text-sm text-white/70">{employeeDetails.emergencyPhone || 'Not Provided'}</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-white/80">Location</h4>
        <p className="text-sm text-white/70">{employeeDetails.location}</p>
      </div>

      <div className="mt-auto pt-4 text-xs text-white/50 text-center">
        <p>This card is property of Agua Viva Church.</p>
        <p>If found, please return to the nearest location.</p>
      </div>
    </div>
  );

  return (
    <CardContainer className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5" />
          Employee ID Card
        </h2>
        <button
          onClick={handleFlip}
          className="p-2 rounded-full hover:bg-glass-light transition-colors"
          title="Flip card"
        >
          <RefreshCcw className="w-5 h-5 text-white/70" />
        </button>
      </div>

      <div className="relative w-[340px] h-[200px] mx-auto perspective-1000">
        <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d
                        cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
             ref={cardRef}>
          <CardSide isFlipped={isFlipped}>
            <CardHeader />
            <CardContent />
            <CardFooter />
          </CardSide>

          <CardSide isBack isFlipped={isFlipped}>
            <BackContent />
          </CardSide>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 mt-6">
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 
                     rounded-lg hover:bg-blue-500/30 transition-colors"
          onClick={() => onDownload?.(cardRef)}
        >
          <Download className="w-4 h-4" />
          Download ID Card
        </button>

        <div className="text-sm text-white/60 flex flex-col items-center gap-1">
          <p className="flex items-center gap-1">
            <User className="w-4 h-4" />
            ID card is for identification only
          </p>
          <p className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Valid for one year from issue date
          </p>
        </div>
      </div>
    </CardContainer>
  );
};

export default IdCard;
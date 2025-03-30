// src/components/EmployeeProfile/IdCard.js
import React, { useRef, useEffect } from 'react';
import { Download, BadgeCheck, User, Calendar, Shield } from 'lucide-react';
import QRCode from 'qrcode.react';

const IdCard = ({ employeeDetails, employeeId, onDownload }) => {
  const cardRef = useRef(null);
  
  // Format date for 1 year from now
  const formatValidUntil = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
  };
  
  const validUntil = formatValidUntil();

  // Format ID for display (first 13 chars only)
  const displayId = employeeId ? employeeId.substring(0, 13) : 'ID-NOT-FOUND';
  
  // Full ID for QR code
  const qrCodeData = employeeId || 'NO-ID';

  // Get padrino color for styling the badge
  const getPadrinoColor = () => {
    const color = employeeDetails?.profile?.padrinoColor || 'blue';
    
    switch(color) {
      case 'red':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'orange':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'green':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'blue':
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  // Pass ref to parent component for PDF generation
  useEffect(() => {
    if (cardRef.current && onDownload) {
      onDownload(cardRef);
    }
  }, [cardRef, onDownload]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* ID Card */}
      <div 
        ref={cardRef}
        className="card-front relative bg-[#0F172A] rounded-lg overflow-hidden shadow-xl"
        style={{ width: '340px', height: '216px', margin: '0 auto' }} // Fixed aspect ratio (ID card proportions)
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-semibold text-white">Agua Viva</h3>
            <BadgeCheck className="w-6 h-6 text-blue-400" />
          </div>

          <div className="flex justify-between items-start gap-3">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#1a253b] flex items-center justify-center 
                          text-2xl font-semibold text-white/90">
              {employeeDetails?.profile?.name?.[0]?.toUpperCase() || 'N'}
            </div>

            {/* Personal Info */}
            <div className="flex-1">
              <h4 className="text-xl font-medium text-white/90 line-clamp-1">
                {employeeDetails?.profile?.name || 'Not Provided'}
              </h4>
              <p className="text-sm text-white/70 mt-1 line-clamp-1">
                {employeeDetails?.profile?.position || employeeDetails?.profile?.service || 'Member'}
              </p>
              <p className="text-sm text-white/70 line-clamp-1">
                {employeeDetails?.profile?.department || 'General'}
              </p>
              <p className="text-sm text-white/70 line-clamp-1">
                Location: {employeeDetails?.profile?.primaryLocation || employeeDetails?.profile?.location || 'Javs'}
              </p>

              {/* Padrino Badge */}
              {employeeDetails?.profile?.padrino && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getPadrinoColor()} 
                             border flex items-center gap-1 max-w-fit`}>
                  <Shield className="w-3 h-3" />
                  Padrino
                </span>
              )}
            </div>
            
            {/* QR Code */}
            <div className="bg-white p-2 rounded-lg">
              <QRCode
                value={qrCodeData}
                size={100}
                level="H"
                renderAs="svg"
                includeMargin={false}
                className="qr-code"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700 my-3"></div>

          {/* Footer */}
          <div>
            <p className="text-xs text-white/60 text-center mb-2">
              This card is property of Agua Viva.
              If found, please return to the nearest location.
            </p>
            <div className="flex justify-between items-center text-xs text-white/60">
              <span>ID: {displayId}</span>
              <span>Valid until: {validUntil}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4 mt-6">
        <button 
          onClick={() => onDownload?.(cardRef)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 
                     bg-blue-500/20 text-blue-400 rounded-lg 
                     hover:bg-blue-500/30 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download ID Card
        </button>

        <div className="flex flex-col items-center gap-2 text-sm text-white/60">
          <p className="flex items-center gap-2">
            <User className="w-4 h-4" />
            ID card is for identification only
          </p>
          <p className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Valid for one year from issue date
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdCard;
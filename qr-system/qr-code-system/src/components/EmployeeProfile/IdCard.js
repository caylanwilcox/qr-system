import React, { useRef, useEffect } from 'react';
import { Download, BadgeCheck, User, Calendar, Shield } from 'lucide-react';
import { format } from 'date-fns';
import QRCode from 'qrcode.react';

const IdCard = ({ employeeDetails, employeeId, onDownload }) => {
  const cardRef = useRef(null);
  const validUntil = format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'MM/dd/yyyy');

  // Format ID for display (first 5 digits only)
  const displayId = employeeId?.substring(0, 13) ;
  
  // Full ID for QR code
  const qrCodeData = employeeId;

  // Verify QR code data
  useEffect(() => {
    console.log('QR Code Data:', qrCodeData);
  }, [qrCodeData]);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5" />
          Employee ID Card
        </h2>
      </div>

      {/* ID Card */}
      <div 
        ref={cardRef}
        className="card-front relative bg-glass-dark rounded-lg overflow-hidden"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-white/90">Agua Viva Church</h3>
            <BadgeCheck className="w-6 h-6 text-blue-400" />
          </div>

          <div className="flex justify-between items-start gap-4">
            {/* Left side - Personal Info */}
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-4">
                {/* Avatar & Badge */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-glass flex items-center justify-center 
                                text-2xl font-semibold text-white/90">
                    {employeeDetails.name?.[0]?.toUpperCase() || 'N'}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-glass-light 
                               text-white/70 border border-glass-light flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Member
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <h4 className="text-xl font-medium text-white/90">
                    {employeeDetails.name || 'Not Provided'}
                  </h4>
                  <p className="text-sm text-white/70">
                    {employeeDetails.position || 'Leader'}
                  </p>
                  <p className="text-sm text-white/70">
                    {employeeDetails.department || 'General'}
                  </p>
                  <p className="text-sm text-white/70">
                    Location: {employeeDetails.location || 'Not Provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right side - QR Code */}
            <div className="bg-white p-3 rounded-lg">
              <QRCode
                value={qrCodeData}
                size={120}
                level="H"
                renderAs="svg"
                includeMargin={true}
                className="qr-code"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-glass-light">
            <p className="text-xs text-white/60 text-center mb-4">
              This card is property of Agua Viva Church.
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
      <div className="space-y-4">
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
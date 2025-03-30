// src/components/EmployeeProfile/IdCardSection.js
import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { AlertCircle, Download } from 'lucide-react';
import IdCard from './IdCard';

const IdCardSection = ({ employeeDetails, employeeId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);

  const generatePDF = async () => {
    if (!cardRef.current) {
      setError('Card reference not found. Please try again.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      // Set up PDF with ID card dimensions (credit card size)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [54, 85.6] // Standard ID card size
      });

      // Capture the card element
      const cardElement = cardRef.current;
      
      const canvas = await html2canvas(cardElement, {
        scale: 4, // Higher scale for better quality
        backgroundColor: '#0F172A', // Match your dark background
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // Ensure the cloned element is visible for capturing
          const clonedCard = clonedDoc.querySelector('.card-front');
          if (clonedCard) {
            clonedCard.style.transform = 'none';
            clonedCard.style.opacity = '1';
          }
        }
      });

      // Add the captured image to the PDF
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 85.6, 54, '', 'FAST');

      // Save the PDF
      const employeeName = employeeDetails?.profile?.name || 'employee';
      const fileName = `${employeeName.replace(/\s+/g, '_')}_ID_Card.pdf`;
      doc.save(fileName);

      setError(null);
      setIsGenerating(false);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setError('Failed to generate ID card PDF: ' + (err.message || 'Unknown error'));
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {error && (
        <div className="bg-red-500/20 text-red-400 border border-red-500/30 p-4 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-glass backdrop-blur border border-glass-light rounded-lg overflow-hidden">
        <div className="p-6">
          {/* Section Title */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/90">
              Employee Identification
            </h2>
            {isGenerating && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-white/70">Generating PDF...</span>
              </div>
            )}
          </div>

          {/* ID Card */}
          <div className="flex justify-center my-4">
            <IdCard 
              employeeDetails={employeeDetails} 
              employeeId={employeeId}
              onDownload={(ref) => {
                cardRef.current = ref.current;
              }}
            />
          </div>

          {/* Download Button */}
          <div className="mt-6 flex justify-center">
            <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-colors
                        ${isGenerating 
                          ? 'bg-gray-600 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download ID Card
                </>
              )}
            </button>
          </div>

          {/* Additional Information */}
          <div className="mt-6 p-4 bg-glass-dark rounded-lg">
            <h3 className="text-sm font-medium text-white/80 mb-2">
              Important Information
            </h3>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                Present this ID card when entering any facility
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                QR code is required for attendance tracking
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                Report lost or stolen cards immediately to administration
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-glass-dark border-t border-glass-light">
          <p className="text-xs text-white/50 text-center">
            {employeeDetails?.profile?.padrino ? (
              <>
                The padrino status displayed on this ID card indicates special privileges and responsibilities.
                <br />
                The color indicates the level of achievement based on attendance and service.
              </>
            ) : (
              <>
                For security purposes, printed ID cards contain additional verification features 
                not visible in the digital preview.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdCardSection;
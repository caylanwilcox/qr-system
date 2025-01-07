import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { AlertCircle } from 'lucide-react';
import Alert from './Alert';
import IdCard from './IdCard';

const IdCardSection = ({ employeeDetails, employeeId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generatePDF = async (cardRef) => {
    if (!cardRef.current) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // Create PDF with card dimensions (credit card size)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [54, 85.6]
      });

      // Capture front of card
      const frontCanvas = await html2canvas(cardRef.current.querySelector('.card-front'), {
        scale: 4,
        backgroundColor: null,
        useCORS: true,
        logging: false
      });

      // Add front of card
      const frontImgData = frontCanvas.toDataURL('image/png');
      doc.addImage(frontImgData, 'PNG', 0, 0, 85.6, 54);

      // Add new page for back
      doc.addPage([54, 85.6], 'landscape');
      
      // Capture and add back of card
      const backCanvas = await html2canvas(cardRef.current.querySelector('.card-back'), {
        scale: 4,
        backgroundColor: null,
        useCORS: true,
        logging: false
      });
      
      const backImgData = backCanvas.toDataURL('image/png');
      doc.addImage(backImgData, 'PNG', 0, 0, 85.6, 54);

      // Save the PDF with employee name
      const fileName = `${employeeDetails.name.replace(/\s+/g, '_')}_ID_Card.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate ID card PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </Alert>
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

          {/* ID Card Container */}
          <div className="flex justify-center">
            <IdCard 
              employeeDetails={employeeDetails} 
              employeeId={employeeId}
              onDownload={generatePDF}
            />
          </div>

          {/* Additional Information */}
          <div className="mt-6 p-4 bg-glass-dark rounded-lg">
            <h3 className="text-sm font-medium text-white/80 mb-2">
              Important Information
            </h3>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                Present this ID card when entering any church facility
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                Report lost or stolen cards immediately to administration
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                This ID is non-transferable and must be returned upon request
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-glass-dark border-t border-glass-light">
          <p className="text-xs text-white/50 text-center">
            For security purposes, printed ID cards contain additional verification features 
            not visible in the digital preview.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdCardSection;
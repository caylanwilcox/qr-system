// src/components/UserProfile/IdCardSection.js
import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { AlertCircle } from 'lucide-react';
import Alert from './Alert';
import IdCard from './IdCard';

const IdCardSection = ({ userDetails, userId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generatePDF = async (cardRef) => {
    if (!cardRef.current) {
      setError('Card reference not found. Please try again.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [54, 85.6]
      });

      const cardElement = cardRef.current;
      const canvas = await html2canvas(cardElement, {
        scale: 4,
        backgroundColor: '#0f172a',
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          const clonedCard = clonedDoc.querySelector('.card-front');
          if (clonedCard) {
            clonedCard.style.transform = 'none';
            clonedCard.style.opacity = '1';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', 0, 0, 85.6, 54, '', 'FAST');

      const fileName = `${userDetails.name.replace(/\s+/g, '_')}_ID_Card.pdf`;
      doc.save(fileName);

      setError(null);
    } catch (err) {
      console.error('PDF Generation Error:', err);
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white/90">
              My ID Card
            </h2>
            {isGenerating && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-white/70">Generating PDF...</span>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <IdCard 
              userDetails={userDetails} 
              userId={userId}
              onDownload={generatePDF}
            />
          </div>

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
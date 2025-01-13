import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Ban } from 'lucide-react';
import { debounce } from 'lodash';

const Scanner = ({ onScan, location, isProcessing }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [error, setError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  
  const scannerRef = useRef(null);
  const barcodeTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Get container dimensions for responsive QR box
  const calculateQrBoxSize = () => {
    const container = document.getElementById('qr-reader');
    if (!container) return { width: 250, height: 250 };
    
    const minDimension = Math.min(container.offsetWidth, container.offsetHeight);
    const qrboxSize = Math.floor(minDimension * 0.7); // 70% of container
    return {
      width: Math.max(qrboxSize, 100), // Ensure minimum of 100px
      height: Math.max(qrboxSize, 100)
    };
  };

  // Memoize scanner configuration
  const scannerConfig = {
    fps: 10,
    qrbox: calculateQrBoxSize(),
    aspectRatio: 1.0,
    rememberLastUsedCamera: true,
    formatsToSupport: [
      Html5Qrcode.CODE_128,
      Html5Qrcode.CODE_39,
      Html5Qrcode.EAN_13,
      Html5Qrcode.EAN_8,
      Html5Qrcode.UPC_A,
      Html5Qrcode.UPC_E,
      Html5Qrcode.UPC_EAN_EXTENSION,
      Html5Qrcode.CODABAR,
      Html5Qrcode.CODE_93,
      Html5Qrcode.QR_CODE,
      Html5Qrcode.DATA_MATRIX,
      Html5Qrcode.PDF_417
    ],
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    }
  };

  // Handle scanner errors
  const handleScannerError = useCallback((error) => {
    const ignoredErrors = [
      'No QR code found',
      'NotFoundException',
      'No MultiFormat Readers'
    ];
    
    if (!ignoredErrors.some(msg => error.includes(msg))) {
      console.error('Scanner error:', error);
      setError(error);
    }
  }, []);

  // Handle successful scans
  const handleSuccessfulScan = useCallback((decodedText) => {
    if (!isProcessing && decodedText && mountedRef.current) {
      onScan(decodedText.trim());
    }
  }, [isProcessing, onScan]);

  // Initialize camera and check permissions
  const initializeCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      if (mountedRef.current) {
        setHasCameraPermission(true);
      }
      return true;
    } catch (err) {
      console.error('Camera permission error:', err);
      if (mountedRef.current) {
        setHasCameraPermission(false);
        setError('Camera access denied - USB scanner still available');
      }
      return false;
    }
  }, []);

  // Initialize scanner
  const initializeScanner = useCallback(async () => {
    if (!location || !mountedRef.current) return;

    try {
      const hasCamera = await initializeCamera();
      if (!hasCamera || !mountedRef.current) return;

      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            ...scannerConfig,
            // Add error recovery options
            recoveryPeriod: 1000,
            disableFlip: false,
            experimentalFeatures: {
              ...scannerConfig.experimentalFeatures,
              useBarCodeDetectorIfSupported: true,
              allowNonGrantedPermissions: true
            }
          },
          handleSuccessfulScan,
          handleScannerError
        );
      } catch (startError) {
        // If standard mode fails, try fallback mode
        if (startError.message.includes('CanvasRenderingContext2D')) {
          console.log('Attempting fallback scanning mode...');
          await scanner.start(
            { facingMode: "environment" },
            {
              ...scannerConfig,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
              }
            },
            handleSuccessfulScan,
            handleScannerError
          );
        } else {
          throw startError;
        }
      }

      if (mountedRef.current) {
        setScannerReady(true);
      }
    } catch (err) {
      console.error('Scanner initialization error:', err);
      if (mountedRef.current) {
        setError(err.message);
      }
    }
  }, [location, handleSuccessfulScan, handleScannerError, initializeCamera]);

  // Handle barcode input with improved buffering
  const handleBarcodeInput = useCallback((event) => {
    if (isProcessing || !location) return;

    // Clear any existing timeout
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (barcodeInput) {
        onScan(barcodeInput.trim());
        setBarcodeInput('');
      }
      return;
    }

    // Only process alphanumeric and special characters
    if (event.key.length === 1 && /[\w\-]/.test(event.key)) {
      setBarcodeInput(prev => {
        const newInput = prev + event.key;
        
        // Wait for 500ms of no input before processing
        // This allows the complete barcode to be captured
        barcodeTimeoutRef.current = setTimeout(() => {
          if (newInput && mountedRef.current && newInput.length > 3) {
            onScan(newInput.trim());
            setBarcodeInput('');
          }
        }, 500);

        return newInput;
      });
    }
  }, [isProcessing, location, barcodeInput, onScan]);

  // Setup effect
  useEffect(() => {
    mountedRef.current = true;
    
    if (location) {
      initializeScanner();
      document.addEventListener('keydown', handleBarcodeInput);
      
      // Handle window resizing
      const handleResize = debounce(() => {
        if (scannerRef.current) {
          const newConfig = {
            ...scannerConfig,
            qrbox: calculateQrBoxSize()
          };
          scannerRef.current.applyVideoConstraints(newConfig);
        }
      }, 250);

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
      
      const cleanup = async () => {
        if (scannerRef.current) {
          try {
            const isScanning = await scannerRef.current.isScanning();
            if (isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (err) {
            console.error('Scanner cleanup error:', err);
          }
        }
      };

      cleanup();
      document.removeEventListener('keydown', handleBarcodeInput);
      
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [location, handleBarcodeInput, initializeScanner]);

  return (
    <div className="max-w-lg w-full mx-auto mb-8">
      {!location ? (
        <div className="aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 flex items-center justify-center text-white text-opacity-70">
          Please select a location to activate scanner
        </div>
      ) : hasCameraPermission === false ? (
        <div className="aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 flex flex-col items-center justify-center text-white text-opacity-70">
          <Ban size={48} className="mb-4 text-red-400" />
          <p>Camera access denied</p>
          <p className="text-sm mt-2">USB scanner still available</p>
        </div>
      ) : (
        <div 
          id="qr-reader" 
          className={`aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 ${
            !scannerReady ? 'animate-pulse' : ''
          }`} 
        />
      )}
      
      {error && (
        <div className="mt-4 text-red-400 text-sm text-center">
          {error}
        </div>
      )}
    </div>
  );
};

export default Scanner;
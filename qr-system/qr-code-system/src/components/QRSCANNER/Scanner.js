// src/components/QRSCANNER/Scanner.js
// Enhanced QR scanning component with improved error handling and state management

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Ban } from 'lucide-react';
import { debounce } from 'lodash';

const Scanner = ({ onScan, location, eventType, mode = 'clock-in', isProcessing }) => {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [error, setError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  
  const scannerRef = useRef(null);
  const barcodeTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  // Calculate QR box size using useMemo to prevent unnecessary recalculations
  const calculateQrBoxSize = useCallback(() => {
    const container = document.getElementById('qr-reader');
    if (!container) return { width: 250, height: 250 };
    
    const minDimension = Math.min(container.offsetWidth, container.offsetHeight);
    const qrboxSize = Math.floor(minDimension * 0.7);
    return {
      width: Math.max(qrboxSize, 100),
      height: Math.max(qrboxSize, 100)
    };
  }, []);

  // Memoize scanner configuration
  const scannerConfig = useMemo(() => ({
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
  }), [calculateQrBoxSize]);

  // Handle scanner errors with improved filtering
  const handleScannerError = useCallback((error) => {
    const ignoredErrors = [
      'No QR code found',
      'NotFoundException',
      'No MultiFormat Readers',
      'ZXing did not provide an output'
    ];
    
    // Don't show benign scanning errors
    if (!ignoredErrors.some(msg => error.includes(msg))) {
      console.error('Scanner error:', error);
      // Only update the error state if it's a new error
      setError(prevError => {
        if (prevError !== error) {
          return error;
        }
        return prevError;
      });
    }
  }, []);

  // Handle successful scans with debouncing
  const handleSuccessfulScan = useMemo(() => 
    debounce((decodedText) => {
      if (!isProcessing && decodedText && mountedRef.current) {
        onScan(decodedText.trim());
      }
    }, 300),
    [isProcessing, onScan]
  );

  // Stop the scanner safely
  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    
    try {
      const isScanning = await scannerRef.current.isScanning();
      if (isScanning) {
        await scannerRef.current.stop();
      }
      // Don't clear the scanner element immediately - this can cause media interruption errors
      setTimeout(() => {
        if (scannerRef.current && mountedRef.current) {
          scannerRef.current.clear();
        }
      }, 100);
      
      setIsScannerActive(false);
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  }, []);

  // Initialize camera and check permissions
  const initializeCamera = useCallback(async () => {
    try {
      // First check if media devices are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      
      // Always clean up the stream properly
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
        // Enable manual mode automatically when camera fails
        setManualMode(true);
      }
      return false;
    }
  }, []);

  // Initialize scanner with improved error handling and state management
  const initializeScanner = useCallback(async () => {
    // Prevent multiple initializations
    if (!location || !mountedRef.current || initializingRef.current || isScannerActive) return;
    
    initializingRef.current = true;
    setError('');
    
    try {
      const hasCamera = await initializeCamera();
      if (!hasCamera || !mountedRef.current) {
        initializingRef.current = false;
        // If camera fails, don't prevent moving forward - enable manual input
        setManualMode(true);
        return;
      }

      // Clear any existing scanner instance
      if (scannerRef.current) {
        await stopScanner();
        scannerRef.current = null;
      }
      
      // Create scanner instance with error handling
      const qrContainer = document.getElementById('qr-reader');
      if (!qrContainer) {
        throw new Error('Scanner container not found');
      }
      
      // Ensure the container is empty before initializing
      qrContainer.innerHTML = '';
      
      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner;

      const startScanner = async (config) => {
        try {
          await scanner.start(
            { facingMode: "environment" },
            config,
            handleSuccessfulScan,
            handleScannerError
          );
        } catch (err) {
          // Additional error logging
          console.error('Scanner start error details:', err);
          // Try to provide more specific error messages
          if (err.message && err.message.includes('NotReadableError')) {
            throw new Error('Cannot access camera. The camera may be in use by another application.');
          } else if (err.message && err.message.includes('NotAllowedError')) {
            throw new Error('Camera access denied. Please check your browser permissions.');
          } else {
            throw err;
          }
        }
      };

      try {
        await startScanner({
          ...scannerConfig,
          recoveryPeriod: 1000,
          disableFlip: false,
          experimentalFeatures: {
            ...scannerConfig.experimentalFeatures,
            useBarCodeDetectorIfSupported: true
          }
        });
      } catch (startError) {
        console.error('First scanner start attempt failed:', startError);
        // Try fallback if first attempt fails
        if (startError.message && (
            startError.message.includes('CanvasRenderingContext2D') || 
            startError.message.includes('NotFoundError') ||
            startError.message.includes('NotAllowedError') ||
            startError.message.includes('NotReadableError')
        )) {
          console.log('Attempting fallback scanning mode...');
          try {
            await startScanner({
              ...scannerConfig,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
              }
            });
          } catch (fallbackError) {
            console.error('Fallback scanner also failed:', fallbackError);
            throw new Error('Scanner initialization failed. Please try manual input.');
          }
        } else {
          throw startError;
        }
      }

      if (mountedRef.current) {
        setScannerReady(true);
        setIsScannerActive(true);
      }
    } catch (err) {
      console.error('Scanner initialization error:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to initialize scanner. Try manual input.');
        setManualMode(true);
      }
    } finally {
      initializingRef.current = false;
    }
  }, [location, handleSuccessfulScan, handleScannerError, initializeCamera, scannerConfig, isScannerActive, stopScanner]);

  // Handle barcode input with improved debouncing
  const handleBarcodeInput = useCallback((event) => {
    if (isProcessing || !location) return;

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

    if (event.key.length === 1 && /[\w\-]/.test(event.key)) {
      setBarcodeInput(prev => {
        const newInput = prev + event.key;
        
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

  // Handle resize with debounce and proper error handling
  const handleResize = useMemo(() => 
    debounce(() => {
      if (scannerRef.current && isScannerActive) {
        try {
          const newConfig = {
            ...scannerConfig,
            qrbox: calculateQrBoxSize()
          };
          scannerRef.current.applyVideoConstraints(newConfig);
        } catch (err) {
          console.error('Error applying video constraints:', err);
        }
      }
    }, 250),
    [scannerConfig, calculateQrBoxSize, isScannerActive]
  );

  // Handle visibility changes to properly pause/resume camera
  const handleVisibilityChange = useCallback(() => {
    if (!scannerRef.current) return;
    
    if (document.hidden) {
      // Page is hidden, pause the scanner to avoid media interruption
      if (isScannerActive) {
        stopScanner()
          .catch(err => console.error('Error pausing scanner:', err));
      }
    } else if (!document.hidden && location && !isProcessing && !isScannerActive && !initializingRef.current) {
      // Page is visible again, restart the scanner
      initializeScanner()
        .catch(err => console.error('Error resuming scanner:', err));
    }
  }, [location, isProcessing, isScannerActive, stopScanner, initializeScanner]);

  // Setup effect with improved cleanup
  useEffect(() => {
    mountedRef.current = true;
    
    if (location) {
      initializeScanner();
      document.addEventListener('keydown', handleBarcodeInput);
      window.addEventListener('resize', handleResize);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        mountedRef.current = false;
        document.removeEventListener('keydown', handleBarcodeInput);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        handleResize.cancel();
        handleSuccessfulScan.cancel();
        
        // Enhanced cleanup with proper error handling
        if (scannerRef.current) {
          stopScanner()
            .catch(err => console.error('Final scanner cleanup error:', err))
            .finally(() => {
              scannerRef.current = null;
            });
        }
        
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
          barcodeTimeoutRef.current = null;
        }
      };
    }

    return () => {
      mountedRef.current = false;
    };
  }, [location, handleBarcodeInput, initializeScanner, handleResize, handleVisibilityChange, handleSuccessfulScan, stopScanner]);

  // Reset scanner when processing state changes (successful scan)
  useEffect(() => {
    if (!isProcessing && location && !isScannerActive && !initializingRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeScanner()
          .catch(err => console.error('Error reinitializing scanner after processing:', err));
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isProcessing, location, isScannerActive, initializeScanner]);

  // Handle manual barcode submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  // Toggle between camera and manual input
  const toggleInputMode = () => {
    setManualMode(!manualMode);
    if (manualMode && scannerRef.current === null) {
      // If switching to camera mode, initialize scanner
      initializeScanner()
        .catch(err => console.error('Error initializing scanner after manual mode:', err));
    }
  };

  // Get appropriate placeholder and messaging based on mode
  const getModePlaceholder = () => {
    return mode === 'clock-in' ? 'Enter barcode/ID to clock in' : 'Enter barcode/ID to clock out';
  };

  const getModeMessage = () => {
    if (mode === 'clock-in') {
      return 'Scan QR code or ID to clock in';
    } else {
      return 'Scan QR code or ID to clock out';
    }
  };

  const getModeTitle = () => {
    return mode === 'clock-in' ? 'Clock In Scanner' : 'Clock Out Scanner';
  };

  return (
    <div className="max-w-lg w-full mx-auto mb-8">
      {!location ? (
        <div className="aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 flex items-center justify-center text-white text-opacity-70">
          Please select a location to activate scanner
        </div>
      ) : manualMode ? (
        <div className="aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 flex flex-col items-center justify-center p-4">
          <h3 className="text-white text-lg mb-4">{getModeTitle()}</h3>
          <form onSubmit={handleManualSubmit} className="w-full max-w-sm">
            <div className="flex items-center border-b border-white border-opacity-20 py-2 mb-4">
              <input 
                type="text" 
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={getModePlaceholder()}
                className="appearance-none bg-transparent border-none w-full text-white mr-3 py-1 px-2 leading-tight focus:outline-none"
              />
              <button 
                type="submit"
                className={`flex-shrink-0 ${
                  mode === 'clock-in' ? 'bg-green-500 hover:bg-green-700 border-green-500 hover:border-green-700' 
                                      : 'bg-blue-500 hover:bg-blue-700 border-blue-500 hover:border-blue-700'
                } text-sm border-4 text-white py-1 px-2 rounded`}
                disabled={isProcessing}
              >
                {mode === 'clock-in' ? 'Clock In' : 'Clock Out'}
              </button>
            </div>
          </form>
          <p className="text-white text-opacity-70 text-sm mb-4 text-center">
            {getModeMessage()} - You can scan with USB scanner or type the ID
          </p>
          <button 
            onClick={toggleInputMode}
            className="mt-4 text-blue-400 hover:text-blue-300 underline"
          >
            Switch to camera scanner
          </button>
        </div>
      ) : hasCameraPermission === false ? (
        <div className="aspect-square rounded-2xl overflow-hidden bg-black bg-opacity-20 border border-white border-opacity-10 flex flex-col items-center justify-center text-white text-opacity-70">
          <Ban size={48} className="mb-4 text-red-400" />
          <p>Camera access denied</p>
          <p className="text-sm mt-2">USB scanner still available</p>
          <p className="text-sm mt-2 text-center">{getModeMessage()}</p>
          <button 
            onClick={toggleInputMode}
            className={`mt-6 px-4 py-2 ${
              mode === 'clock-in' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-md`}
          >
            Use Manual Input
          </button>
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
          {error.toLowerCase().includes('scanner') && (
            <button 
              onClick={toggleInputMode}
              className="ml-2 text-blue-400 hover:text-blue-300 underline"
            >
              Switch to manual input
            </button>
          )}
        </div>
      )}

      {/* Mode indicator and toggle button */}
      {location && (
        <div className="mt-4 text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-sm mb-2 ${
            mode === 'clock-in' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {mode === 'clock-in' ? 'Clock In Mode' : 'Clock Out Mode'}
          </div>
          <br />
          <button
            onClick={toggleInputMode}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            {manualMode ? 'Try camera scanner' : 'Use manual input instead'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Scanner;
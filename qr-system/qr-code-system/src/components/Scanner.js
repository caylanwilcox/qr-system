// Scanner.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const SCAN_STATES = {
  UNKNOWN: 0,
  NOT_STARTED: 1,
  SCANNING: 2,
  PAUSED: 3,
};

const Scanner = ({ setMessage, mode, location, onClockIn }) => {
  const [errors, setErrors] = useState([]);
  const qrScannerRef = useRef(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode('qr-reader');
    qrScannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: 300,
          },
          handleScan,
          handleError
        );
        console.log('Scanner started successfully.');
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        logError(`Error starting scanner: ${err.message || err}`);
      }
    };

    startScanner();

    return () => {
      if (qrScannerRef.current) {
        const scannerState = qrScannerRef.current.getState();
        console.log('Scanner state during cleanup:', scannerState);

        if (
          scannerState === SCAN_STATES.SCANNING ||
          scannerState === SCAN_STATES.PAUSED
        ) {
          qrScannerRef.current
            .stop()
            .then(() => {
              console.log('QR scanner stopped.');
              qrScannerRef.current.clear();
              qrScannerRef.current = null;
            })
            .catch((err) => {
              console.error('Error stopping scanner:', err);
            });
        } else {
          qrScannerRef.current.clear();
          qrScannerRef.current = null;
        }
      }
    };
  }, []);
  const handleScan = async (decodedText) => {
    if (!decodedText) {
      setMessage('No data scanned');
      logError('No data scanned');
      return;
    }
  
    console.log('Scanned data:', decodedText);
  
    // Parse the scanned data
    let scannedData;
    try {
      scannedData = JSON.parse(decodedText);
    } catch (e) {
      console.error('Error parsing scanned data:', e);
      setMessage('Error parsing scanned data');
      return;
    }
  
    const { employeeId, name, location } = scannedData;
  
    if (!employeeId || !location) {
      const errorMsg = `Invalid scanned data: employeeId or location is missing.`;
      console.error(errorMsg);
      logError(errorMsg);
      setMessage(errorMsg);
      return;
    }
  
    // Prepare the data payload for the backend
    const clockInData = {
      employeeId,
      location,
      name,
      mode: modeRef.current,
      timestamp: new Date().toISOString(),
    };
  
    try {
      const response = await fetch('http://localhost:3003/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clockInData),
      });
  
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
  
      const result = await response.json();
      setMessage(result.message);
  
      // If clock-in was successful, use the provided callback to show data in the UI
      if (result.success && modeRef.current === 'clock-in') {
        onClockIn({
          name: result.employeeName,
          photo: result.employeePhoto || '',
        });
      }
    } catch (error) {
      console.error('Error during fetch:', error);
      setMessage('Error during clock-in/out process: ' + error.message);
      logError(`Error during fetch: ${error.message}`);
    }
  };
  
  const handleError = (err) => {
    const knownErrors = ['NotFoundException']; // List of errors to suppress
    if (knownErrors.some((errorType) => err.message?.includes(errorType))) {
      // Suppress these errors to avoid console spam
      return;
    }
  
    console.error('Scanner error:', err); // Log other unexpected errors
    logError(`Scanner error: ${err.message || err}`);
  };
  

  const logError = (message) => {
    setErrors((prevErrors) => [...prevErrors, message]);
  };

  return (
    <div id="qr-reader"></div>
  );
};

export default Scanner;

import React, { useState, useRef, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';
import './App.css';

const Scanner = ({ setMessage, mode, location }) => {
  const [scanning, setScanning] = useState(true);
  const [scannedResult, setScannedResult] = useState('');
  const [errors, setErrors] = useState([]);
  const lastErrorTimeRef = useRef(0);
  const modeRef = useRef(mode); // Create a ref to hold the mode
  const ERROR_THROTTLE_TIME = 5000; // 5 seconds

  useEffect(() => {
    modeRef.current = mode; // Update the ref whenever mode changes
    console.log('Scanner component received mode:', mode);
  }, [mode]);

  const handleScan = async (data) => {
    if (!data) {
      console.log('No data scanned');
      setMessage('No data scanned');
      logError('No data scanned');
      return;
    }

    console.log('Current mode in handleScan:', modeRef.current);
    console.log('Scanned data:', data);
    setScannedResult(data);
    setScanning(false);

    const [employeeId, additionalData] = data.split('|');
    if (!employeeId || !additionalData) {
      const errorMsg = `Invalid scanned data: ${data}`;
      console.error(errorMsg);
      logError(errorMsg);
      return;
    }

    const url = `http://localhost:3003/${modeRef.current}?employeeId=${employeeId}&location=${location}`;
    console.log(`Fetching URL: ${url}, Mode: ${modeRef.current}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      const result = await response.text();
      setMessage(result);
      console.log('Server response:', result);
    } catch (error) {
      console.error('Error during fetch:', error);
      setMessage('Error during clock-in/out process: ' + error.message);
      logError(`Error during fetch: ${error.message}`);
    }
  };

  const handleError = (err) => {
    const currentTime = Date.now();
    if (err && currentTime - lastErrorTimeRef.current > ERROR_THROTTLE_TIME) {
      console.error('Scanner error:', err);
      lastErrorTimeRef.current = currentTime;
      logError(`Scanner error: ${err.message}`);
    }
  };

  const logError = (message) => {
    setErrors(prevErrors => [...prevErrors, message]);
  };

  return (
    <div className="scanner-container">
      <div id="qr-reader">
        <QrReader
          delay={300}
          onError={handleError}
          onResult={(result, error) => {
            if (result) {
              handleScan(result.text);
            }
            if (error) {
              handleError(error);
            }
          }}
          style={{ width: '100%' }}
        />
        {scanning && <p>Scanner is active. Please scan a QR code.</p>}
        {scannedResult && <p>Scanned Result: {scannedResult}</p>}
      </div>
    </div>
  );
};

export default Scanner;

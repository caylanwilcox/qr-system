import React, { useState, useRef } from 'react';
import { QrReader } from 'react-qr-reader';
import './App.css';
import ErrorLog from './ErrorLog';

const Scanner = ({ setMessage, mode }) => {
  const [scanning, setScanning] = useState(true);
  const [scannedResult, setScannedResult] = useState('');
  const [errors, setErrors] = useState([]);
  const lastErrorTimeRef = useRef(0);
  const ERROR_THROTTLE_TIME = 5000; // 5 seconds

  const handleScan = (data) => {
    if (data) {
      console.log('Scanned data:', data);
      setScannedResult(data);
      setScanning(false);

      const [employeeId, location] = data.split('|');
      if (!employeeId || !location) {
        const errorMsg = `Invalid scanned data: ${data}`;
        console.error(errorMsg);
        logError(errorMsg);
        return;
      }

      const url = `http://localhost:3003/${mode}?employeeId=${employeeId}&location=${location}`;
      console.log(`Fetching URL: ${url}, Mode: ${mode}`);

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${response.status}: ${response.statusText}`);
          }
          return response.text();
        })
        .then((result) => {
          setMessage(result);
          console.log('Server response:', result);
        })
        .catch((error) => {
          console.error('Error during fetch:', error);
          setMessage('Error during clock-in/out process: ' + error.message);
          logError(`Error during fetch: ${error.message}`);
        });
    } else {
      console.log('No data scanned');
      setMessage('No data scanned');
      logError('No data scanned');
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
      <ErrorLog errors={errors} />
    </div>
  );
};

export default Scanner;
